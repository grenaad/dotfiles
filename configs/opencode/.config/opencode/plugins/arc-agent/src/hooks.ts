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

import {
  clearFrameRebuild,
  clearState,
  ensureWorkflowMemory,
  getState,
  markFrameSuperseded,
  resetWorkflowMemory,
} from "./state"
import { log } from "./log"
import { appendEntry, latestFrame, unknownsStatus } from "./workflow-memory"
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
  WRITE_NOTE_SUBAGENTS,
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

/** v0.20 — marker for the frame-rebuild directive preamble. Idempotent injection. */
const FRAME_REBUILD_MARKER = "FRAME REBUILD REQUIRED"

/**
 * v0.20 — When a re-frame is pending, inject a rebuild directive into the
 * next subagent prompt. Two shapes:
 *   - For non-frame subagents: tell them to STOP and let restater+frame run
 *     before any further analysis (soft injection — agent's prompt-following
 *     does the actual halt)
 *   - For frame itself: thread the pivot into its preamble so the next frame
 *     output incorporates the rebuild context
 *
 * Returns the (possibly modified) prompt. Idempotent.
 */
function injectFrameRebuildDirective(
  prompt: string,
  sub: SubagentType,
  pending: { reason: string; pivot: string; triggeredBy: string },
): string {
  if (prompt.slice(0, 1200).includes(FRAME_REBUILD_MARKER)) return prompt

  if (sub === "frame") {
    const directive =
      `${FRAME_REBUILD_MARKER} — incorporate this pivot into your output.\n` +
      `Pivot: ${pending.pivot}\n` +
      `Reason: ${pending.reason}\n` +
      `Triggered by: ${pending.triggeredBy}\n` +
      `Use the re-frame protocol from your spec: emit \`Re-framing: <reason>.\`, ` +
      `re-emit the ENTIRE frame output from scratch, and add a \`## Drift Notes\` ` +
      `section listing what changed.\n\n`
    return directive + prompt
  }

  // For non-frame/non-restater subagents, refuse-by-prompt: tell them not to
  // do further analysis until frame re-runs.
  if (sub !== "restater") {
    const directive =
      `${FRAME_REBUILD_MARKER}.\n` +
      `Reason: ${pending.reason}\n` +
      `New pivot: ${pending.pivot}\n` +
      `Triggered by: ${pending.triggeredBy}\n\n` +
      `STOP. Do NOT proceed with the requested analysis. The frame that this ` +
      `workflow is based on has been factually contradicted. The orchestrator ` +
      `must re-run restater + frame with the pivot above before any further ` +
      `analysis is meaningful. Output one short line acknowledging this and ` +
      `return without doing work.\n\n`
    return directive + prompt
  }

  return prompt
}

/**
 * v0.20 — Parse a frame-validity-check output for `Status: rebuild` and
 * extract the structured fields. Returns null when the verdict is valid /
 * refine or when parsing fails (best-effort).
 */
function parseRebuildVerdict(
  output: string,
): { reason: string; pivot: string } | null {
  // Status line must explicitly say rebuild.
  const statusMatch = /^\s*Status:\s*(valid|refine|rebuild)\b/im.exec(output)
  if (!statusMatch || statusMatch[1]!.toLowerCase() !== "rebuild") return null

  const reasonMatch = /Contradicted assumption:\s*"?([^"\n]+?)"?\s*$/im.exec(output)
  const pivotMatch = /New pivot:\s*([^\n]+?)\s*$/im.exec(output)
  if (!reasonMatch || !pivotMatch) return null

  const reason = (reasonMatch[1] ?? "").trim().slice(0, 300)
  const pivot = (pivotMatch[1] ?? "").trim().slice(0, 300)
  if (!reason || !pivot) return null
  return { reason, pivot }
}

/**
 * v0.20 — Parse synthesis output to count multi-layer enumeration. Returns
 * counts of layers explicitly listed, layers marked N/A, and the number of
 * disagreement/contradiction bullets in the Cross-Reference section.
 */
function parseMultiLayerCounts(
  output: string,
): { present: number; na: number; contradictions: number } {
  const layerRe = /^\s*-\s*\*\*Layer\s+\d+\s+—\s+[^*]+\*\*\s*:\s*(.+?)\s*$/gim
  let present = 0
  let na = 0
  for (const m of output.matchAll(layerRe)) {
    const body = (m[1] ?? "").trim().toLowerCase()
    if (body === "n/a" || body === "n/a." || body === "(n/a)" || body.startsWith("n/a ")) {
      na++
    } else if (body.length > 0) {
      present++
    }
  }
  // Cross-Reference disagreement bullets
  const xrefMatch = /###\s*Cross-Reference\s*\n([\s\S]*?)(?:\n##|$)/i.exec(output)
  let contradictions = 0
  if (xrefMatch?.[1]) {
    const disagreementBlock = /\*\*Disagreement\*\*\s*:\s*([\s\S]*?)(?:\n-\s*\*\*|\n##|$)/i.exec(xrefMatch[1])
    if (disagreementBlock?.[1]) {
      const lines = disagreementBlock[1].split("\n").filter((l) => l.trim().startsWith("-"))
      contradictions = lines.length
      // Single inline content counts as 1 if no bullets
      if (contradictions === 0 && disagreementBlock[1].trim().length > 0 && !disagreementBlock[1].trim().match(/^(none|n\/a|nothing)/i)) {
        contradictions = 1
      }
    }
  }
  return { present, na, contradictions }
}

/**
 * v0.20 — Set of subagents considered "artifact producers" for the
 * workflow.stance log emission. We log the stance once per workflow when the
 * first artifact subagent is invoked.
 */
const ARTIFACT_SUBAGENTS = new Set<SubagentType>([
  "frame",
  "alternatives",
  "plan",
  "review",
  "critic",
  "delta-mapper",
  "synthesis",
  "spike",
])

/**
 * v0.20 — Extract the verdict line from an unknowns-auditor output.
 */
function extractUnknownsAuditVerdict(
  output: string,
): "ALL_RESOLVED" | "OPEN_UNKNOWNS_REMAIN" | "DEFERRED_ACCEPTABLE" | "UNKNOWN" {
  const m = /^\s*(ALL_RESOLVED|OPEN_UNKNOWNS_REMAIN|DEFERRED_ACCEPTABLE)\b/im.exec(output)
  if (m) return m[1]! as "ALL_RESOLVED" | "OPEN_UNKNOWNS_REMAIN" | "DEFERRED_ACCEPTABLE"
  return "UNKNOWN"
}

const WORKFLOW_MEMORY_MARKER = "Workflow memory available"

/**
 * v0.19 — Inject a short "workflow memory available" awareness block. Only
 * fires on full-triviality workflows with non-empty memory. Idempotent (skips
 * if the marker is already present in the prompt head).
 */
function injectWorkflowMemoryAwareness(
  prompt: string,
  entryCount: number,
  noteCount: number,
  canWriteNotes: boolean,
): string {
  if (prompt.slice(0, 4000).includes(WORKFLOW_MEMORY_MARKER)) return prompt
  if (entryCount === 0 && noteCount === 0) return prompt

  const lines: string[] = []
  lines.push(`${WORKFLOW_MEMORY_MARKER} (${entryCount} entries, ${noteCount} notes from earlier in this workflow):`)
  lines.push("- `workflow_recall` — query past subagent outputs and analysis-specialist notes by subagent/topic/keyword.")
  if (canWriteNotes) {
    lines.push(
      "- `workflow_note` — write a structured note (observation/concern/pattern/retraction) " +
        "for later specialists to recall. Authorized for analysis specialists only.",
    )
  }
  lines.push(
    "Use recall when context from an earlier step would sharpen your analysis. Do not " +
      "duplicate verbatim content the orchestrator already threaded into this prompt. " +
      "Recall is best-effort; if it fails or returns nothing, continue without it.",
  )
  lines.push("")

  return `${lines.join("\n")}${prompt}`
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

        // v0.19 — New-workflow detection. When restater is the next called
        // subagent AND memory already has entries, this is a new workflow
        // within the same session: clear memory before capture begins. Also
        // clear stale per-workflow flags so a fresh workflow starts cleanly.
        if (sub === "restater" && s.workflowMemory && s.workflowMemory.entries.length > 0) {
          const prior = s.workflowMemory.entries.length
          resetWorkflowMemory(s)
          s.taskType = undefined
          s.trivialityTier = undefined
          s.normalizedVerdict = undefined
          s.openQuestions = undefined
          s.lastPlan = undefined
          await log({
            kind: "workflow.reset",
            session: input.sessionID,
            reason: "restater-after-existing-entries",
            prior_entry_count: prior,
          })
        }

        let working = output.args.prompt

        // Phase 5 — auto-prepend delegation preamble + REASONING CONVENTIONS
        working = injectPreamble(working)

        // Phase 3 — on plan subagent, inject task-type structural template
        if (sub === "plan" && s.taskType) {
          working = injectTemplate(working, s.taskType)
        }

        // v0.19 — Phase D: workflow-memory awareness block. Only inject on
        // `full` workflows (we don't have a confirmed tier yet if frame is the
        // first call, but the memory will be empty in that case and the
        // function no-ops). Skip on `ultra`/`trivial` even when memory exists.
        const memory = s.workflowMemory
        const trivialitySuppresses = s.trivialityTier === "ultra" || s.trivialityTier === "trivial"
        if (memory && !trivialitySuppresses) {
          working = injectWorkflowMemoryAwareness(
            working,
            memory.entries.length,
            memory.notes.length,
            WRITE_NOTE_SUBAGENTS.has(sub),
          )
        }

        // v0.20 — Phase E: forced re-frame soft-injection. When a rebuild is
        // pending, prepend a directive instructing the next subagent to halt
        // (or, for frame itself, to incorporate the pivot). The flag clears
        // in tool.execute.after when frame captures successfully.
        if (s.frameRebuildPending) {
          working = injectFrameRebuildDirective(working, sub, s.frameRebuildPending)
        }

        // v0.20 — Phase F: workflow.stance log. Fires once per workflow on the
        // first artifact-subagent call. The marker for "first artifact" is
        // the absence of prior artifact captures in memory.
        if (ARTIFACT_SUBAGENTS.has(sub) && !trivialitySuppresses) {
          const memoryNow = s.workflowMemory
          const priorArtifacts = memoryNow
            ? memoryNow.entries.some((e) => ARTIFACT_SUBAGENTS.has(e.subagent))
            : false
          if (!priorArtifacts) {
            await log({
              kind: "workflow.stance",
              session: input.sessionID,
              first_artifact_subagent: sub,
            })
          }
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

        // v0.19 — Phase B: auto-capture subagent output into workflow memory.
        // Suppress on ultra/trivial triviality (memory not useful when there
        // are only 3-5 entries; cost not justified). Capture happens BEFORE
        // any of the existing branches so it covers every subagent uniformly.
        try {
          const trivialitySuppresses = s.trivialityTier === "ultra" || s.trivialityTier === "trivial"
          if (!trivialitySuppresses && outText.length > 0) {
            const memory = ensureWorkflowMemory(s)
            const entry = appendEntry(memory, { subagent: sub, output: outText })
            await log({
              kind: "workflow.capture",
              session: input.sessionID,
              subagent: sub,
              entry_id: entry.id,
              size: entry.size,
              truncated: entry.truncated,
              tag_count: entry.tags.length,
              memory_total_entries: memory.entries.length,
            })
          }
        } catch (err) {
          // Best-effort; do not let memory failures break the workflow.
          await log({
            kind: "error",
            session: input.sessionID,
            hook: "tool.execute.after.workflow-capture",
            subagent: sub,
            error: (err as Error).message,
          })
        }

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

          // v0.20 — Phase E: clear pending rebuild after frame completes. The
          // next workflow steps will see the new frame entry; rebuild count
          // increments so the cap is enforceable.
          if (s.frameRebuildPending) {
            clearFrameRebuild(s)
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

        // v0.20 — Phase E: detect frame-validity-check rebuild verdict.
        if (sub === "frame-validity-check") {
          const verdict = parseRebuildVerdict(outText)
          if (verdict) {
            const rebuildCount = s.frameRebuildCount ?? 0
            if (rebuildCount >= 1) {
              await log({
                kind: "workflow.reframe.suppressed",
                session: input.sessionID,
                reason: `rebuild cap (1) already reached; current count=${rebuildCount}`,
              })
            } else {
              const memoryNow = s.workflowMemory
              const frame = memoryNow ? latestFrame(memoryNow) : undefined
              if (frame) {
                const triggeredBy = `frame-validity-check entry for ${frame.id}`
                markFrameSuperseded(s, frame.id, verdict.reason, verdict.pivot, triggeredBy)
                await log({
                  kind: "workflow.reframe.triggered",
                  session: input.sessionID,
                  reason_excerpt: verdict.reason.slice(0, 200),
                  pivot_excerpt: verdict.pivot.slice(0, 200),
                  triggered_by: triggeredBy,
                })
              } else {
                await log({
                  kind: "workflow.reframe.suppressed",
                  session: input.sessionID,
                  reason: "no frame entry in workflow memory to supersede",
                })
              }
            }
          }
          await log({
            kind: "tool.execute.after",
            session: input.sessionID,
            subagent: sub,
            original_chars: size,
          })
          return
        }

        // v0.20 — Phase F: synthesis multi-layer log.
        if (sub === "synthesis") {
          const counts = parseMultiLayerCounts(outText)
          await log({
            kind: "workflow.layer-check",
            session: input.sessionID,
            layers_present: counts.present,
            layers_na: counts.na,
            contradictions: counts.contradictions,
          })
          // Fall through to the generic open-questions extraction below
        }

        // v0.20 — Phase F: spike executed log.
        if (sub === "spike") {
          const na = /^\s*##\s*Spike\s*[—-]\s*N\/A\b/im.test(outText)
          await log({
            kind: "workflow.spike.executed",
            session: input.sessionID,
            output_size: size,
            na,
          })
          await log({
            kind: "tool.execute.after",
            session: input.sessionID,
            subagent: sub,
            original_chars: size,
          })
          return
        }

        // v0.20 — Phase F: unknowns-auditor verdict log + gate.
        if (sub === "unknowns-auditor") {
          const verdict = extractUnknownsAuditVerdict(outText)
          const memoryNow = s.workflowMemory
          let open = 0
          let resolved = 0
          let deferred = 0
          if (memoryNow) {
            const report = unknownsStatus(memoryNow)
            open = report.open.length
            resolved = report.resolved.length
            deferred = report.deferred.length
          }
          await log({
            kind: "workflow.unknown.gate",
            session: input.sessionID,
            verdict,
            open_count: open,
            resolved_count: resolved,
            deferred_count: deferred,
          })
          await log({
            kind: "tool.execute.after",
            session: input.sessionID,
            subagent: sub,
            original_chars: size,
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
