/**
 * Hook implementations. Every hook is wrapped in a top-level try/catch so any
 * plugin error logs and falls through (workflow continues unchanged).
 *
 * Hooks implemented:
 *   tool.execute.before: enforce per-subagent ceilings, strip Open Questions
 *                        from subagent prompts (pre-filtered, time-bounded),
 *                        on `review` substitute compressed plan if stashed
 *   tool.execute.after:  on `plan` returns, measure size and stash; on bucket
 *                        === "compress", precompute compressed-for-review
 *                        variant (time-bounded, sanity-checked)
 *   event:               passive logging only
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
  CEILINGS,
  bucketFor,
  isSubagent,
  isTaskToolArgs,
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
        const originalChars = output.args.prompt.length
        let working = output.args.prompt

        // Step 1 — semantic dedup of Open Questions, with pre-filter + timeout.
        // Skip on frame (its prompt is just preamble + raw user prompt — no
        // Open Questions possible). Skip when the cheap heading-scan finds no
        // candidate phrases. Otherwise invoke model with 30s timeout.
        let strippedFlag = false
        let preFilterSkip = false
        let stripTimedOut = false

        if (sub === "frame" || !hasCandidateHeading(working)) {
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

        // Step 2 — on review, swap in compressed plan if stashed
        let compressedFlag = false
        if (sub === "review") {
          const s = getState(input.sessionID)
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

        // Step 3 — hard ceiling enforcement
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

        if (sub === "plan") {
          const bucket = bucketFor(size)
          const s = getState(input.sessionID)
          s.lastPlan = { size, bucket, content: outText }

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
                })
              } else {
                const sanityFail = compressSanityCheck(outText, compressed)
                if (sanityFail) {
                  // Discard the compressed output; fall back to forwarding the
                  // original plan to review. Log so we know why.
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
