/**
 * Hook implementations. Every hook is wrapped in a top-level try/catch so any
 * plugin error logs and falls through (workflow continues unchanged).
 *
 * v0.15 additions:
 *   - Auto-prepend delegation preamble + REASONING CONVENTIONS to every prompt
 *   - Inject task-type template on plan subagent calls
 *   - Capture task type from frame output; classify triviality
 *   - Mark plan with missing-required-section annotations (advisory to reviewer)
 *   - Normalize reviewer verdict; emit plan-size advisory
 *
 * Hooks implemented:
 *   tool.execute.before: auto-prepend constants, inject template on plan,
 *                        enforce per-subagent ceilings, strip Open Questions
 *                        from subagent prompts (pre-filtered, time-bounded),
 *                        on `review` substitute compressed plan if stashed
 *   tool.execute.after:  capture frame task type, capture review verdict,
 *                        on `plan` returns measure size + mark missing sections,
 *                        on bucket compress precompute compressed-for-review
 *   event:               passive logging + session cleanup
 */

import type { Hooks } from "@opencode-ai/plugin"
import type { createOpencodeClient, Event } from "@opencode-ai/sdk"

import { getState, clearState } from "./state"
import { log } from "./log"
import {
  stripOpenQuestions,
  compressPlanForReview,
  hasCandidateHeading,
  compressSanityCheck,
  STRIP_TIMEOUT_MS,
  COMPRESS_TIMEOUT_MS,
} from "./transforms"
import {
  extractTaskType,
  checkRequiredSections,
  classifyTriviality,
  extractOpenQuestions,
  normalizeVerdict,
  planSizeAdvisory,
} from "./analyzers"
import {
  DELEGATION_PREAMBLE,
  REASONING_CONVENTIONS,
  PREAMBLE_MARKER,
  CONVENTIONS_MARKER,
  REQUIRED_SECTIONS_BLOCK_HEADER,
  REQUIRED_SECTIONS_BLOCK_FOOTER,
  REQUIRED_SECTIONS_MARKER_PREFIX,
  REQUIRED_SECTIONS_MARKER_SUFFIX,
} from "./constants"
import { TASK_TYPE_TEMPLATES, REQUIRED_SECTIONS_BY_TYPE } from "./templates"
import {
  CEILINGS,
  bucketFor,
  isSubagent,
  isTaskToolArgs,
  NO_OPEN_QUESTIONS_SUBAGENTS,
  type SubagentType,
} from "./types"

type Client = ReturnType<typeof createOpencodeClient>

const ENV_DISABLE = "ARC_AGENT_DISABLED" as const
const DISABLED = process.env[ENV_DISABLE] === "1"

function truncateAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const lastNL = slice.lastIndexOf("\n\n")
  const cut = lastNL > max * 0.8 ? lastNL : slice.lastIndexOf("\n")
  const body = (cut > 0 ? slice.slice(0, cut) : slice).trimEnd()
  return body + `\n\n[truncated by arc-agent: prompt was ${text.length} chars, ceiling ${max}]`
}

/** Run a promise with a timeout. Returns null on timeout, throws on other errors. */
async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fn(ctrl.signal)
  } catch (err) {
    if ((err as Error).name === "AbortError") return null
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Prepend delegation preamble + REASONING CONVENTIONS if not already present.
 * Detection is permissive (first ~500 chars contain the marker = present).
 */
function injectPreamble(prompt: string): string {
  const head = prompt.slice(0, 500)
  const hasPreamble = head.includes(PREAMBLE_MARKER)
  const hasConventions = head.includes(CONVENTIONS_MARKER) || prompt.slice(0, 2000).includes(CONVENTIONS_MARKER)
  if (hasPreamble && hasConventions) return prompt
  const pieces: string[] = []
  if (!hasPreamble) pieces.push(DELEGATION_PREAMBLE, "")
  if (!hasConventions) pieces.push(REASONING_CONVENTIONS, "")
  pieces.push(prompt)
  return pieces.join("\n")
}

/**
 * Append the task-type structural template to a plan-subagent prompt.
 * No-op if the prompt already references the template's first heading.
 */
function injectTemplate(prompt: string, taskType: import("./templates").TaskType): string {
  const template = TASK_TYPE_TEMPLATES[taskType]
  if (!template) return prompt
  // If prompt already has the "What you asked for" header (likely manually included), skip.
  if (prompt.includes("## What you asked for") && prompt.includes("## Sanity Check")) {
    return prompt
  }
  return `${prompt.trimEnd()}\n\nYour output MUST contain these sections in this exact order, using these exact headings:\n\n${template}\n`
}

/** Build the required-section-check annotation block. Empty string when nothing missing. */
function buildSectionMarkers(missing: readonly string[]): string {
  if (missing.length === 0) return ""
  const items = missing
    .map((s) => `${REQUIRED_SECTIONS_MARKER_PREFIX}"${s}"${REQUIRED_SECTIONS_MARKER_SUFFIX}`)
    .join("\n")
  return `${REQUIRED_SECTIONS_BLOCK_HEADER}\n${items}\n${REQUIRED_SECTIONS_BLOCK_FOOTER}\n\n`
}

export function buildHooks(client: Client): Hooks {
  if (DISABLED) {
    return {
      event: async () => {
        /* disabled */
      },
    }
  }

  return {
    "tool.execute.before": async (input, output) => {
      try {
        if (input.tool !== "task") return
        if (!isTaskToolArgs(output.args)) return
        if (!isSubagent(output.args.subagent_type)) return

        const sub: SubagentType = output.args.subagent_type
        const s = getState(input.sessionID)
        let working = output.args.prompt

        // Phase 5 — auto-prepend delegation preamble + REASONING CONVENTIONS
        working = injectPreamble(working)

        // Phase 3 — on plan subagent, inject task-type structural template
        if (sub === "plan" && s.taskType) {
          working = injectTemplate(working, s.taskType)
        }

        const originalChars = working.length

        // Phase 7 (prep) — strip Open Questions semantically. Skip for
        // subagents whose prompts never carry them; skip when no candidate
        // heading present. Otherwise invoke model with timeout.
        let strippedFlag = false
        let preFilterSkip = false
        let stripTimedOut = false

        if (NO_OPEN_QUESTIONS_SUBAGENTS.has(sub) || !hasCandidateHeading(working)) {
          preFilterSkip = true
        } else {
          try {
            const stripped = await withTimeout(
              (signal) => stripOpenQuestions(client, input.sessionID, working, signal),
              STRIP_TIMEOUT_MS,
            )
            if (stripped === null) {
              stripTimedOut = true
            } else if (stripped.length > 0 && stripped.length < working.length) {
              working = stripped
              strippedFlag = true
            }
          } catch (err) {
            await log({
              kind: "error",
              session: input.sessionID,
              hook: "tool.execute.before",
              subagent: sub,
              error: `strip_open_questions failed: ${(err as Error).message}`,
            })
          }
        }

        // On review, swap in compressed plan if stashed
        let compressedFlag = false
        if (sub === "review") {
          const compressed = s.lastPlan?.compressedForReview
          if (compressed && s.lastPlan) {
            const marker = "Implementation plan to review:"
            if (working.includes(marker) && working.includes(s.lastPlan.content)) {
              working = working.replace(
                s.lastPlan.content,
                `\n[arc-agent: plan compressed from ${s.lastPlan.size} chars; ` +
                  `matrices and traceability anchors preserved verbatim]\n\n` +
                  compressed,
              )
              compressedFlag = true
            }
          }
        }

        // Hard ceiling enforcement
        const ceiling = CEILINGS[sub]
        let ceilingHit = false
        if (working.length > ceiling) {
          working = truncateAtBoundary(working, ceiling)
          ceilingHit = true
        }

        output.args = { ...output.args, prompt: working }

        await log({
          kind: "tool.execute.before",
          session: input.sessionID,
          subagent: sub,
          original_chars: originalChars,
          final_chars: working.length,
          stripped_open_questions: strippedFlag,
          ceiling_hit: ceilingHit,
          compressed: compressedFlag,
          pre_filter_skip: preFilterSkip || undefined,
          helper_timeout: stripTimedOut || undefined,
        })
      } catch (err) {
        await log({
          kind: "error",
          session: input.sessionID,
          hook: "tool.execute.before",
          error: (err as Error).message,
        })
        // fail-open: original args pass through unchanged
      }
    },

    "tool.execute.after": async (input, output) => {
      try {
        if (input.tool !== "task") return
        if (!isTaskToolArgs(input.args)) return
        if (!isSubagent(input.args.subagent_type)) return

        const sub: SubagentType = input.args.subagent_type
        const outText = typeof output.output === "string" ? output.output : ""
        const size = outText.length
        const s = getState(input.sessionID)

        // Phase 3+6 — capture task type AND classify triviality from frame
        if (sub === "frame") {
          const tt = extractTaskType(outText)
          if (tt) s.taskType = tt

          // Phase 6 — best-effort triviality classification. The orchestrator's
          // frame call body ends with `User task: <raw user prompt>`; extract
          // that and run the classifier. Orchestrator may override after the
          // clarification subroutine resolves Open Questions.
          const framePrompt = typeof input.args.prompt === "string" ? input.args.prompt : ""
          const taskMatch = /User task:\s*([\s\S]+?)$/m.exec(framePrompt)
          const rawUserTask = taskMatch?.[1]?.trim() ?? ""
          if (rawUserTask.length > 0 && tt) {
            const tier = classifyTriviality({
              taskType: tt,
              userPrompt: rawUserTask,
              hasResolvedClarifications: false,
            })
            s.trivialityTier = tier
          }

          await log({
            kind: "tool.execute.after",
            session: input.sessionID,
            subagent: sub,
            original_chars: size,
            task_type: tt ?? undefined,
            triviality_tier: s.trivialityTier,
          })
          return
        }

        // Phase 8 — normalize reviewer verdict
        if (sub === "review") {
          const v = normalizeVerdict(outText)
          if (v) s.normalizedVerdict = v
          await log({
            kind: "tool.execute.after",
            session: input.sessionID,
            subagent: sub,
            original_chars: size,
            normalized_verdict: v ?? undefined,
          })
          return
        }

        // Phase 7 — extract Open Questions for primary subagents. Micro-agents
        // are exempt (NO_OPEN_QUESTIONS_SUBAGENTS).
        if (!NO_OPEN_QUESTIONS_SUBAGENTS.has(sub)) {
          const questions = extractOpenQuestions(outText)
          if (questions.length > 0) {
            const arr = s.openQuestions ?? []
            arr.push({ source: sub, questions })
            s.openQuestions = arr
          }
        }

        if (sub === "plan") {
          const bucket = bucketFor(size)

          // Phase 4 — required-section enforcement (advisory annotation)
          let annotatedPlan = outText
          let missingSections: string[] = []
          if (s.taskType) {
            const required = REQUIRED_SECTIONS_BY_TYPE[s.taskType] ?? []
            missingSections = checkRequiredSections(outText, required)
            if (missingSections.length > 0) {
              annotatedPlan = buildSectionMarkers(missingSections) + outText
            }
          }

          s.lastPlan = { size, bucket, content: annotatedPlan }

          if (bucket === "compress") {
            try {
              const compressed = await withTimeout(
                (signal) => compressPlanForReview(client, input.sessionID, outText, signal),
                COMPRESS_TIMEOUT_MS,
              )
              if (compressed === null) {
                await log({
                  kind: "tool.execute.after",
                  session: input.sessionID,
                  subagent: sub,
                  original_chars: size,
                  plan_bucket: bucket,
                  compressed: false,
                  missing_sections: missingSections.length > 0 ? missingSections : undefined,
                })
              } else {
                const sanityFail = compressSanityCheck(outText, compressed)
                if (sanityFail) {
                  await log({
                    kind: "helper",
                    session: input.sessionID,
                    helper_call: "compress_plan",
                    helper_latency_ms: 0,
                    final_chars: compressed.length,
                    sanity_check_failed: true,
                  })
                  await log({
                    kind: "tool.execute.after",
                    session: input.sessionID,
                    subagent: sub,
                    original_chars: size,
                    plan_bucket: bucket,
                    compressed: false,
                    missing_sections: missingSections.length > 0 ? missingSections : undefined,
                  })
                } else {
                  s.lastPlan.compressedForReview = compressed
                  await log({
                    kind: "tool.execute.after",
                    session: input.sessionID,
                    subagent: sub,
                    original_chars: size,
                    final_chars: compressed.length,
                    plan_bucket: bucket,
                    compressed: true,
                    missing_sections: missingSections.length > 0 ? missingSections : undefined,
                  })
                }
              }
            } catch (err) {
              await log({
                kind: "error",
                session: input.sessionID,
                hook: "tool.execute.after",
                subagent: sub,
                error: `compress_plan failed: ${(err as Error).message}`,
              })
            }
          } else {
            await log({
              kind: "tool.execute.after",
              session: input.sessionID,
              subagent: sub,
              original_chars: size,
              plan_bucket: bucket,
              compressed: false,
              missing_sections: missingSections.length > 0 ? missingSections : undefined,
            })
          }
          return
        }

        await log({
          kind: "tool.execute.after",
          session: input.sessionID,
          subagent: sub,
          original_chars: size,
        })
      } catch (err) {
        await log({
          kind: "error",
          session: input.sessionID,
          hook: "tool.execute.after",
          error: (err as Error).message,
        })
      }
    },

    event: async ({ event }) => {
      try {
        const e = event as Event
        if (e.type === "session.deleted") {
          const props = (e as { properties?: { sessionID?: string } }).properties
          if (props?.sessionID) clearState(props.sessionID)
        }
      } catch {
        /* swallow */
      }
    },
  }
}

// Re-export public analyzers and constants for downstream consumers.
export {
  classifyTriviality,
  extractOpenQuestions,
  planSizeAdvisory,
}
