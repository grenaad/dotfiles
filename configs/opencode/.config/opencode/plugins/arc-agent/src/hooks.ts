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
import {
  appendEntry,
  appendNote,
  latestFrame,
  parseFrameInsufficiencies,
  parseFramePredictions,
  parseFrameUnknowns,
  predictionReconciliation,
  unknownsStatus,
} from "./workflow-memory"
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
  computeScopeGuardVerdict,
  computeUnknownsVerdict,
  extractOpenQuestions,
  normalizeVerdict,
  planSizeAdvisory,
  predictionsAllTriviallyConfirmed,
} from "./analyzers"
import {
  DELEGATION_PREAMBLE,
  MECHANICAL_VERDICT_MARKER,
  MECHANICAL_VERDICT_STUB_TEMPLATE,
  REASONING_CONVENTIONS,
  REASONING_CONVENTIONS_SLIM,
  PREAMBLE_MARKER,
  CONVENTIONS_MARKER,
  REQUIRED_SECTIONS_BLOCK_HEADER,
  REQUIRED_SECTIONS_BLOCK_FOOTER,
  REQUIRED_SECTIONS_MARKER_PREFIX,
  REQUIRED_SECTIONS_MARKER_SUFFIX,
  TRIVIAL_SKIP_MARKER,
  TRIVIAL_SKIP_STUB_TEMPLATE,
} from "./constants"
import { TASK_TYPE_TEMPLATES, REQUIRED_SECTIONS_BY_TYPE } from "./templates"
import { measurePlanQuality } from "./plan-quality"
import { getPlanPosture, PLAN_POSTURE_MARKER } from "./plan-posture"
import {
  CEILINGS,
  bucketFor,
  isSubagent,
  isTaskToolArgs,
  MECHANICAL_CHECK_SUBAGENTS,
  NO_OPEN_QUESTIONS_SUBAGENTS,
  NOTE_TYPES,
  suppressesWorkflowMemory,
  TASK_SHAPE_VALUES,
  TRIVIAL_SKIPPED_SUBAGENTS,
  UNKNOWN_RESOLVABILITY,
  WRITE_NOTE_SUBAGENTS,
  type SubagentType,
  type TaskShape,
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
 *
 * v0.24: when `sub` is in MECHANICAL_CHECK_SUBAGENTS, inject the slim
 * conventions variant (~1,500 chars) instead of the full block (~10k chars).
 * Mechanical-check subagents emit short structured verdicts; the full
 * conventions block is overkill and burns DeepSeek input tokens unnecessarily.
 */
function injectPreamble(prompt: string, sub: SubagentType): string {
  const head = prompt.slice(0, 500)
  const hasPreamble = head.includes(PREAMBLE_MARKER)
  const hasConventions = head.includes(CONVENTIONS_MARKER) || prompt.slice(0, 2000).includes(CONVENTIONS_MARKER)
  if (hasPreamble && hasConventions) return prompt
  const conventionsBlock = MECHANICAL_CHECK_SUBAGENTS.has(sub)
    ? REASONING_CONVENTIONS_SLIM
    : REASONING_CONVENTIONS
  const pieces: string[] = []
  if (!hasPreamble) pieces.push(DELEGATION_PREAMBLE, "")
  if (!hasConventions) pieces.push(conventionsBlock, "")
  pieces.push(prompt)
  return pieces.join("\n")
}

/**
 * v0.24 — Replace the entire prompt with the trivial-skip stub template.
 * Idempotent: skip if the marker is already present.
 *
 * The plugin can't block a `task` tool call from dispatching (OpenCode plugin
 * hooks can only mutate `output.args.prompt`). The stub replacement makes the
 * call return a fixed ~50-char output in one model round-trip instead of
 * doing the full subagent's work.
 */
function injectTrivialSkipStub(_prompt: string, sub: SubagentType): string {
  return TRIVIAL_SKIP_STUB_TEMPLATE.replace(/\{subagent\}/g, sub)
}

/**
 * v0.24 — Replace the prompt with the mechanical-verdict stub. The plugin
 * computed the verdict deterministically from workflow memory; we tell the
 * subagent to return the pre-computed verdict line and end.
 */
function injectMechanicalVerdictStub(
  _prompt: string,
  sub: SubagentType,
  verdictLine: string,
): string {
  return MECHANICAL_VERDICT_STUB_TEMPLATE.replace(/\{verdict_line\}/g, verdictLine).replace(
    /\{subagent\}/g,
    sub,
  )
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
 * v0.21 — Marker for the unknowns-blocking soft-injection. Plan-bound
 * subagents get a halt directive when pre-design unknowns remain open.
 * Idempotent via substring-check in head.
 */
const UNKNOWNS_BLOCKING_MARKER = "UNRESOLVED PRE-DESIGN UNKNOWNS"

/**
 * v0.21 — Soft-inject an unknowns-blocking directive at the head of the plan
 * subagent's prompt. The frame declared one or more unknowns as
 * `R: pre_design` (must resolve before designing). If any remain open at
 * plan time, the plan must halt and surface them — not produce a design on
 * top of unresolved questions. Idempotent.
 */
function injectUnknownsBlockingDirective(
  prompt: string,
  blocking: ReadonlyArray<{ topic: string; question?: string }>,
): string {
  if (prompt.slice(0, 1200).includes(UNKNOWNS_BLOCKING_MARKER)) return prompt
  const lines: string[] = []
  lines.push(`${UNKNOWNS_BLOCKING_MARKER} — ${blocking.length} item(s).`)
  lines.push(
    "The framer declared the following unknowns with resolvability=pre_design, " +
      "meaning they must be resolved BEFORE design. They remain open at plan time.",
  )
  for (const u of blocking.slice(0, 8)) {
    const q = u.question ? `: ${u.question}` : ""
    lines.push(`  - ${u.topic.toUpperCase()}${q}`)
  }
  lines.push(
    "STOP. Do NOT produce a design that assumes these are resolved. Either: " +
      "(a) emit a short output stating which unknowns block the plan and what " +
      "research is needed to resolve them, OR (b) if you can resolve them inline " +
      "from your own knowledge with citation, write resolved-by-plan notes via " +
      "`workflow_note` and then proceed.",
  )
  lines.push("")
  return `${lines.join("\n")}${prompt}`
}

/**
 * v0.21 — Env flag: when set to "1", the orchestrator's plugin will NOT
 * auto-supersede the frame on synthesis-detected prediction contradictions.
 * This is the non-interactive safety valve described in the v0.21 plan.
 * Default: auto-supersede (mirroring v0.20 frame-validity-check behavior).
 */
const REFRAME_AUTO_DECLINE = process.env.ARC_AGENT_REFRAME_AUTO_DECLINE === "1"

/**
 * v0.21 — Parse a `## Task Shape` block from frame output. Recognized form:
 *
 *   ## Task Shape
 *   Primary:   <one of TASK_SHAPE_VALUES>
 *   Secondary: <optional>
 *   Rationale: <one sentence>
 *
 * Returns null when the section is missing or unparseable.
 */
function parseTaskShape(
  output: string,
): { primary: TaskShape; secondary?: TaskShape; rationale: string } | null {
  const sectionMatch = /##\s*Task Shape\s*\n([\s\S]*?)(?:\n##|$)/i.exec(output)
  if (!sectionMatch?.[1]) return null
  const body = sectionMatch[1]

  const primaryMatch = /Primary\s*:\s*([a-z\-_]+)/i.exec(body)
  if (!primaryMatch?.[1]) return null
  const primaryRaw = primaryMatch[1].toLowerCase()
  let primary: TaskShape | undefined
  for (const v of TASK_SHAPE_VALUES) {
    if (v === primaryRaw) {
      primary = v
      break
    }
  }
  if (!primary) return null

  let secondary: TaskShape | undefined
  const secondaryMatch = /Secondary\s*:\s*([a-z\-_]+)/i.exec(body)
  if (secondaryMatch?.[1]) {
    const raw = secondaryMatch[1].toLowerCase()
    if (raw !== "none" && raw !== "n/a" && raw !== "—") {
      for (const v of TASK_SHAPE_VALUES) {
        if (v === raw) {
          secondary = v
          break
        }
      }
    }
  }

  const rationaleMatch = /Rationale\s*:\s*([^\n]+)/i.exec(body)
  const rationale = (rationaleMatch?.[1] ?? "").trim().slice(0, 300)

  return { primary, secondary, rationale }
}

/**
 * v0.21 — Parse a `## Existing Solutions Check` block from frame or plan
 * output for log-emission counts. Returns counts of mechanisms enumerated
 * and the count flagged as insufficient (rejected with named constraint).
 *
 * Recognizes either bullet shapes:
 *   - **<mechanism>** — Sufficient: <how to extend>
 *   - **<mechanism>** — Insufficient: <named constraint>
 *
 * Permissive: any line containing "insufficient:" in the section counts as a
 * rejection; total mechanisms is the count of bullet-lead lines.
 */
function parseExistingCheck(
  output: string,
): { mechanisms: number; rejections: number } | null {
  const sectionMatch = /##\s*Existing Solutions Check\s*(?:\(re-affirmed\))?\s*\n([\s\S]*?)(?:\n##|$)/i.exec(
    output,
  )
  if (!sectionMatch?.[1]) return null
  const body = sectionMatch[1]
  const bulletLines = body.split("\n").filter((l) => /^\s*[-*]\s+/.test(l))
  const mechanisms = bulletLines.length
  const rejections = bulletLines.filter((l) => /\binsufficient\s*:/i.test(l)).length
  return { mechanisms, rejections }
}

/**
 * v0.21 — Parse a `## Failure Chain` block (fix + investigate task types).
 * Returns structural counts so the orchestrator can verify the methodology
 * was actually applied (not just the heading present).
 *
 * - hasTimeline:       any non-"Not applicable" body under ### Timeline
 * - hasClassification: ditto ### Classification
 * - hasRootCause:      ditto ### Root Cause (or sibling ## Root Cause)
 * - confirmations:     count of numbered/bulleted items under ### Confirmation
 * - hasAttribution:    any non-"Not applicable" body under ### Attribution
 */
function parseFailureChain(output: string): {
  hasTimeline: boolean
  hasClassification: boolean
  hasRootCause: boolean
  confirmations: number
  hasAttribution: boolean
} | null {
  const sectionMatch = /##\s*Failure Chain\s*\n([\s\S]*?)(?:\n##\s+|$)/i.exec(output)
  if (!sectionMatch?.[1]) return null
  const body = sectionMatch[1]
  const subsection = (name: string): string | null => {
    const m = new RegExp(`###\\s*${name}\\s*\\n([\\s\\S]*?)(?:\\n###|$)`, "i").exec(body)
    return m?.[1]?.trim() ?? null
  }
  const isPresent = (s: string | null): boolean => {
    if (!s) return false
    const trimmed = s.trim()
    if (trimmed.length === 0) return false
    if (/^not applicable\b/i.test(trimmed)) return false
    if (/^n\/a\b/i.test(trimmed)) return false
    return true
  }
  const timeline = subsection("Timeline")
  const classification = subsection("Classification")
  const rootCauseSub = subsection("Root Cause")
  // For fix templates the root cause may be a sibling section; check both.
  const hasRootCause = isPresent(rootCauseSub) || /##\s*Root Cause\s*\n[\s\S]*?\S/i.test(output)
  const confirmation = subsection("Confirmation")
  const attribution = subsection("Attribution")

  let confirmations = 0
  if (isPresent(confirmation)) {
    const lines = confirmation!
      .split("\n")
      .filter((l) => /^\s*(?:\d+\.|[-*])\s+\S/.test(l) && !/^not applicable/i.test(l.trim()))
    confirmations = lines.length
  }

  return {
    hasTimeline: isPresent(timeline),
    hasClassification: isPresent(classification),
    hasRootCause,
    confirmations,
    hasAttribution: isPresent(attribution),
  }
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

/**
 * v0.23 — Inject the plan cognitive posture between REASONING_CONVENTIONS
 * (auto-prepended by injectPreamble) and the orchestrator's task body.
 *
 * Lives plugin-side rather than under agents/ because OpenCode has a
 * built-in `plan` primary-mode agent (invokable via `opencode --agent plan`)
 * — dropping `agents/plan.md` would shadow that built-in and break the
 * user's top-level planning workflow. See plan-posture.ts for the load
 * mechanics.
 *
 * Idempotent: skip if PLAN_POSTURE_MARKER is already in the prompt head
 * (defensive — the posture should only ever appear once).
 *
 * Failure mode: if `getPlanPosture()` returns "" (file missing/unreadable),
 * the prompt is returned unchanged — the plan still runs with preamble +
 * template, the posture is the enhancement layer.
 */
function injectPlanPosture(prompt: string): string {
  if (prompt.slice(0, 8000).includes(PLAN_POSTURE_MARKER)) return prompt
  const posture = getPlanPosture()
  if (!posture) return prompt
  // Insert after the REASONING_CONVENTIONS block. injectPreamble has already
  // prepended DELEGATION_PREAMBLE + "" + REASONING_CONVENTIONS + "" + prompt;
  // find the END of REASONING_CONVENTIONS by looking for the conventions
  // closing structure-output bullet and splicing after the trailing blank.
  // If we can't locate it cleanly, prepend the posture at the very top —
  // still functional (the model reads it before the rest), just suboptimal
  // ordering.
  const conventionsIdx = prompt.indexOf(CONVENTIONS_MARKER)
  if (conventionsIdx < 0) {
    return `${posture}\n${prompt}`
  }
  // Find the end of the conventions block: it ends with a closing backtick
  // template-literal in the constant. Easier: split on the first blank line
  // after the conventions marker.
  const afterMarker = prompt.indexOf("\n\n", conventionsIdx)
  // CONVENTIONS_MARKER itself contains internal blank lines (Phase 1, Phase 2…),
  // so the FIRST blank line after the marker is inside the block, not after it.
  // Walk forward past internal blanks by tracking the last "## " heading;
  // the conventions block ends when we see a heading that isn't Phase/Layer/Output.
  // Pragmatic fallback: insert posture AFTER the entire conventions block
  // by searching for the next non-conventions heading (heuristic: a line
  // that doesn't start with "## Layer", "## Phase", "## Specialist",
  // "## Visible", "## Output discipline", and is preceded by a blank line).
  //
  // Simpler approach: locate the literal closing-bullet of conventions
  // ("- **Structured output**:") — present at the very end of REASONING_CONVENTIONS
  // — and inject AFTER its trailing newline.
  const endMarker = "- **Structured output**:"
  const endIdx = prompt.indexOf(endMarker, conventionsIdx)
  if (endIdx < 0) {
    // Could not locate the conventions end; fall back to "right after the
    // first blank line" heuristic. This may place posture mid-conventions
    // (unlikely in practice; injectPreamble produced the canonical block).
    if (afterMarker < 0) return `${prompt}\n\n${posture}\n`
    return `${prompt.slice(0, afterMarker)}\n\n${posture}\n${prompt.slice(afterMarker)}`
  }
  // Skip past the closing bullet's line (until next newline).
  const lineEnd = prompt.indexOf("\n", endIdx)
  const splitIdx = lineEnd >= 0 ? lineEnd + 1 : prompt.length
  return `${prompt.slice(0, splitIdx)}\n${posture}\n${prompt.slice(splitIdx)}`
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

        // v0.24 — Trivial fast-path enforcement (P0). When the workflow is
        // on the `ultra`/`trivial` tier AND the subagent is one that the
        // orchestrator workflow doc says to skip (TRIVIAL_SKIPPED_SUBAGENTS),
        // replace the entire prompt with the trivial-skip stub template.
        // The subagent still runs (we can't block the dispatch from a hook)
        // but it returns a ~50-char stub line in one round-trip instead of
        // doing the full subagent's work.
        //
        // Short-circuit: log + emit and skip all downstream injections.
        if (
          suppressesWorkflowMemory(s.trivialityTier) &&
          TRIVIAL_SKIPPED_SUBAGENTS.has(sub) &&
          !working.includes(TRIVIAL_SKIP_MARKER)
        ) {
          const preStubLen = working.length
          working = injectTrivialSkipStub(working, sub)
          output.args = { ...output.args, prompt: working }
          await log({
            kind: "workflow.trivial.skip",
            session: input.sessionID,
            subagent: sub,
            triviality_tier: s.trivialityTier!,
          })
          await log({
            kind: "tool.execute.before",
            session: input.sessionID,
            subagent: sub,
            original_chars: preStubLen,
            final_chars: working.length,
            stripped_open_questions: false,
            ceiling_hit: false,
            compressed: false,
            pre_filter_skip: true,
          })
          return
        }

        // Phase 5 — auto-prepend delegation preamble + REASONING CONVENTIONS
        // v0.24: injectPreamble now picks slim vs full based on subagent type.
        working = injectPreamble(working, sub)

        // v0.23 — on plan subagent, inject the cognitive posture between
        // REASONING_CONVENTIONS and the orchestrator's task body. The
        // posture is what `agents/plan.md` would carry if we could write
        // one without shadowing OpenCode's built-in `plan` primary-mode
        // agent. See plan-posture.ts for the mechanics.
        if (sub === "plan") {
          working = injectPlanPosture(working)
        }

        // Phase 3 — on plan subagent, inject task-type structural template
        if (sub === "plan" && s.taskType) {
          working = injectTemplate(working, s.taskType)
        }

        // v0.19 — Phase D: workflow-memory awareness block. Only inject on
        // `full` workflows (we don't have a confirmed tier yet if frame is the
        // first call, but the memory will be empty in that case and the
        // function no-ops). Skip on `ultra`/`trivial` even when memory exists.
        const memory = s.workflowMemory
        const trivialitySuppresses = suppressesWorkflowMemory(s.trivialityTier)
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

        // v0.24 — Mechanical-verdict stub (P3). For scope-guard and
        // unknowns-auditor on `full` workflows, attempt to compute the verdict
        // deterministically from workflow memory. If the deterministic
        // verdict is the common-case clean result, replace the prompt with
        // a stub that tells the subagent to return only the verdict line.
        //
        // Conservative: only fires when the deterministic check is confident.
        // Ambiguous cases fall through to the full LLM call.
        if (
          memory &&
          !trivialitySuppresses &&
          !working.includes(MECHANICAL_VERDICT_MARKER)
        ) {
          if (sub === "scope-guard") {
            // Find the latest restater entry and latest non-restater entry
            // (the artifact being scope-checked).
            const restaterEntry = [...memory.entries]
              .reverse()
              .find((e) => e.subagent === "restater")
            const artifactEntry = [...memory.entries]
              .reverse()
              .find((e) => e.subagent !== "restater" && e.subagent !== "scope-guard")
            if (restaterEntry && artifactEntry) {
              const verdict = computeScopeGuardVerdict(
                restaterEntry.output,
                artifactEntry.output,
              )
              if (verdict === "in-scope") {
                working = injectMechanicalVerdictStub(working, sub, "✅ In scope")
                await log({
                  kind: "workflow.mechanical.stub",
                  session: input.sessionID,
                  subagent: sub,
                  verdict: "✅ In scope",
                })
              }
            }
          } else if (sub === "unknowns-auditor") {
            const verdict = computeUnknownsVerdict(memory)
            if (verdict === "ALL_RESOLVED") {
              const verdictLine = `## Verdict\nALL_RESOLVED — no unknowns to resolve (computed deterministically by plugin).`
              working = injectMechanicalVerdictStub(working, sub, verdictLine)
              await log({
                kind: "workflow.mechanical.stub",
                session: input.sessionID,
                subagent: sub,
                verdict: "ALL_RESOLVED",
              })
            }
            // OPEN_UNKNOWNS_REMAIN / USER_INPUT_REQUIRED / DEFERRED_ACCEPTABLE
            // fall through — the auditor's LLM-side reasoning may still be
            // useful (false-resolution detection, evidence sanity check).
          }
        }

        // v0.21 — Unknowns-blocking gate. Before the plan subagent runs,
        // check the unknowns ledger for any open + pre_design entries. If
        // present, soft-inject a halt directive (plan must surface and not
        // proceed on top of unresolved load-bearing questions). Best-effort:
        // skips on ultra/trivial workflows where the ledger is suppressed.
        if (sub === "plan" && memory && !trivialitySuppresses) {
          try {
            const ureport = unknownsStatus(memory)
            const blocking = ureport.open.filter(
              (u) => u.resolvability === UNKNOWN_RESOLVABILITY.pre_design,
            )
            if (blocking.length > 0) {
              working = injectUnknownsBlockingDirective(
                working,
                blocking.map((b) => ({ topic: b.topic, question: b.question })),
              )
              await log({
                kind: "workflow.unknowns.blocking",
                session: input.sessionID,
                count: blocking.length,
                topics: blocking.map((b) => b.topic).slice(0, 16),
              })
            }
          } catch (err) {
            // Best-effort; ledger lookup failures must not block plan.
            await log({
              kind: "error",
              session: input.sessionID,
              hook: "tool.execute.before.unknowns-blocking",
              subagent: sub,
              error: (err as Error).message,
            })
          }
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
          const trivialitySuppresses = suppressesWorkflowMemory(s.trivialityTier)
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

          // v0.21 — Capture Task Shape (cognitive methodology classifier).
          // Distinct from taskType (production-line classifier).
          const shape = parseTaskShape(outText)
          if (shape) {
            s.taskShape = shape
            await log({
              kind: "workflow.task-shape.declared",
              session: input.sessionID,
              primary: shape.primary,
              secondary: shape.secondary,
              rationale_excerpt: shape.rationale.slice(0, 200),
            })
          }

          // v0.21 — Capture Existing Solutions Check counts from frame output.
          const existing = parseExistingCheck(outText)
          if (existing) {
            await log({
              kind: "workflow.existing-check.declared",
              session: input.sessionID,
              author: sub,
              mechanisms: existing.mechanisms,
              rejections: existing.rejections,
            })
          }

          // v0.22 — Belt-and-suspenders for the v0.21 predict-observe-compare
          // loop. The PRIMARY path is frame's own workflow_note calls; the
          // v0.22 parent-resolution fix makes those land correctly. But if a
          // future regression ever re-breaks the tool path (or DeepSeek skips
          // the tool calls and only emits the markdown), the parsed-markdown
          // fallback below ensures the loop still has its predictions,
          // unknowns, and insufficiencies recorded as notes.
          //
          // Strategy: count existing frame-authored notes per kind; if the
          // parsed markdown contains MORE items than were recorded, synthesize
          // the difference. This is idempotent — re-running the parse never
          // creates duplicate notes for the same items (parsed list is bounded
          // by what's in the markdown; existing notes are subtracted).
          //
          // Only runs on `full` workflows; suppressed when triviality is
          // ultra/trivial because workflow memory itself is suppressed there.
          const frameTrivialitySuppresses = suppressesWorkflowMemory(s.trivialityTier)
          if (!frameTrivialitySuppresses) {
            try {
              const memoryNow = s.workflowMemory
              if (memoryNow) {
                const countNotesOfType = (t: typeof NOTE_TYPES[keyof typeof NOTE_TYPES]) =>
                  memoryNow.notes.filter((n) => n.author === "frame" && n.type === t).length

                const parsedPreds = parseFramePredictions(outText)
                const existingPreds = countNotesOfType(NOTE_TYPES.prediction)
                if (parsedPreds.length > existingPreds) {
                  const missing = parsedPreds.slice(existingPreds)
                  let synthesized = 0
                  for (const p of missing) {
                    const r = appendNote(memoryNow, {
                      author: "frame",
                      type: NOTE_TYPES.prediction,
                      topic: p.topic,
                      content: p.content,
                    })
                    if (r.ok) synthesized++
                  }
                  if (synthesized > 0) {
                    await log({
                      kind: "workflow.note.fallback-parsed",
                      session: input.sessionID,
                      note_kind: "prediction",
                      count: synthesized,
                      author: "frame",
                    })
                  }
                }

                const parsedUnks = parseFrameUnknowns(outText)
                const existingUnks = countNotesOfType(NOTE_TYPES.unknown)
                if (parsedUnks.length > existingUnks) {
                  const missing = parsedUnks.slice(existingUnks)
                  let synthesized = 0
                  for (const u of missing) {
                    const r = appendNote(memoryNow, {
                      author: "frame",
                      type: NOTE_TYPES.unknown,
                      topic: u.topic,
                      content: u.content,
                    })
                    if (r.ok) synthesized++
                  }
                  if (synthesized > 0) {
                    await log({
                      kind: "workflow.note.fallback-parsed",
                      session: input.sessionID,
                      note_kind: "unknown",
                      count: synthesized,
                      author: "frame",
                    })
                  }
                }

                const parsedIns = parseFrameInsufficiencies(outText)
                const existingIns = countNotesOfType(NOTE_TYPES.insufficiency)
                if (parsedIns.length > existingIns) {
                  const missing = parsedIns.slice(existingIns)
                  let synthesized = 0
                  for (const i of missing) {
                    const r = appendNote(memoryNow, {
                      author: "frame",
                      type: NOTE_TYPES.insufficiency,
                      topic: i.topic,
                      content: i.content,
                    })
                    if (r.ok) synthesized++
                  }
                  if (synthesized > 0) {
                    await log({
                      kind: "workflow.note.fallback-parsed",
                      session: input.sessionID,
                      note_kind: "insufficiency",
                      count: synthesized,
                      author: "frame",
                    })
                  }
                }
              }
            } catch (err) {
              // Best-effort; parser failures must not block the workflow.
              await log({
                kind: "error",
                session: input.sessionID,
                hook: "tool.execute.after.frame-fallback-parse",
                subagent: sub,
                error: (err as Error).message,
              })
            }
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

          // v0.21 — Predict-observe-compare reconciliation. Compute against
          // the memory's prediction + observation notes; emit reconciled log.
          // If contradicted >=1 AND cap not exhausted AND not env-declined
          // AND user hasn't declined this workflow, auto-mark frame as
          // superseded so the orchestrator's existing v0.20 re-frame path
          // takes over for the next subagent invocation.
          const memoryNow = s.workflowMemory
          if (memoryNow) {
            try {
              const recon = predictionReconciliation(memoryNow)
              await log({
                kind: "workflow.prediction.reconciled",
                session: input.sessionID,
                confirmed: recon.confirmed.length,
                contradicted: recon.contradicted.length,
                inconclusive: recon.inconclusive.length,
                unobserved: recon.unobserved.length,
              })

              // v0.24 — Prediction auto-confirm bypass observability (P5).
              // When all predictions in memory are confirmed with non-empty
              // evidence, the synthesis-side reconciliation work was
              // unnecessary — log it so the orchestrator's prompt-side
              // bypass directive can be measured against actual savings.
              if (predictionsAllTriviallyConfirmed(memoryNow)) {
                await log({
                  kind: "workflow.prediction.auto-confirm",
                  session: input.sessionID,
                  prediction_count: recon.confirmed.length,
                })
              }

              // v0.23 — Persist contradicted count on ArcState so the plan-
              // quality measurement (plan-after hook) can check whether the
              // plan acknowledges outstanding contradictions in its design
              // sections. Running sum across multiple synthesis passes within
              // the same workflow (each pass overwrites with the latest count
              // rather than accumulating — what matters is "are there
              // contradictions still on the table at plan time", and synthesis
              // recomputes the full set each pass).
              s.predictionsContradicted = recon.contradicted.length

              if (recon.contradicted.length > 0) {
                const rebuildCount = s.frameRebuildCount ?? 0
                const capExhausted = rebuildCount >= 1
                const userDeclined = s.reframeOfferDeclined === true
                const contradictedTopics = recon.contradicted.map((c) => c.topic)

                let outcome: string
                if (REFRAME_AUTO_DECLINE) {
                  outcome = "auto-declined-via-env"
                } else if (userDeclined) {
                  outcome = "user-declined-prior"
                } else if (capExhausted) {
                  outcome = "cap-exhausted"
                } else if (s.frameRebuildPending) {
                  outcome = "rebuild-already-pending"
                } else {
                  const frame = latestFrame(memoryNow)
                  if (!frame) {
                    outcome = "no-frame-to-supersede"
                  } else {
                    const reason = `synthesis surfaced ${recon.contradicted.length} contradicted prediction(s): ${contradictedTopics.join(", ")}`
                    const pivot =
                      recon.contradicted[0]!.evidence ??
                      recon.contradicted[0]!.predictionContent.slice(0, 200)
                    const triggeredBy = "synthesis prediction reconciliation"
                    markFrameSuperseded(s, frame.id, reason, pivot, triggeredBy)
                    await log({
                      kind: "workflow.reframe.triggered",
                      session: input.sessionID,
                      reason_excerpt: reason.slice(0, 200),
                      pivot_excerpt: pivot.slice(0, 200),
                      triggered_by: triggeredBy,
                    })
                    outcome = "accepted-auto"
                  }
                }

                await log({
                  kind: "workflow.reframe.offered",
                  session: input.sessionID,
                  contradicted: recon.contradicted.length,
                  predictions: contradictedTopics.slice(0, 16),
                  outcome,
                })

                if (outcome !== "accepted-auto" && outcome !== "rebuild-already-pending") {
                  await log({
                    kind: "workflow.reframe.suppressed",
                    session: input.sessionID,
                    reason: outcome,
                  })
                }
              }
            } catch (err) {
              await log({
                kind: "error",
                session: input.sessionID,
                hook: "tool.execute.after.predict-observe",
                subagent: sub,
                error: (err as Error).message,
              })
            }
          }
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

          // v0.21 — Existing Solutions Check (re-affirmed) counts from plan.
          const planExisting = parseExistingCheck(outText)
          if (planExisting) {
            await log({
              kind: "workflow.existing-check.declared",
              session: input.sessionID,
              author: sub,
              mechanisms: planExisting.mechanisms,
              rejections: planExisting.rejections,
            })
          }

          // v0.21 — Failure Chain detection. Only meaningful for fix +
          // investigate task types (templates require the section there).
          // Reports presence of each subsection and the corroboration count;
          // the required-section check (above) handles the strict structural
          // enforcement.
          if (s.taskType === "fix" || s.taskType === "investigate") {
            const chain = parseFailureChain(outText)
            if (chain) {
              await log({
                kind: "workflow.failure-chain.declared",
                session: input.sessionID,
                has_timeline: chain.hasTimeline,
                has_classification: chain.hasClassification,
                has_root_cause: chain.hasRootCause,
                confirmations: chain.confirmations,
                has_attribution: chain.hasAttribution,
              })
            }
          }

          // v0.23 — Plan-quality measurement. Six heuristic signals describing
          // load-bearing-ness vs form-filling. All advisory; the reviewer
          // remains the sole verdict authority. Emitted only when taskType
          // is known (which it always is when frame ran; falls back silently
          // otherwise).
          if (s.taskType) {
            try {
              const quality = measurePlanQuality(outText, s.taskType, s)
              await log({
                kind: "workflow.plan.quality",
                session: input.sessionID,
                task_type: s.taskType,
                load_bearing_refs: quality.loadBearingRefs,
                grounded: quality.grounded,
                checkable_wrong_if: quality.checkableWrongIf,
                forbidden_phrase_count: quality.forbiddenPhraseCount,
                oversized_sections: quality.oversizedSections,
                ungrounded_insufficiencies: quality.ungroundedInsufficiencies,
                contradiction_acknowledged: quality.contradictionAcknowledged,
              })
            } catch (err) {
              // Best-effort. Plan-quality measurement must NEVER block the
              // workflow. A heuristic crash is logged as `error` and the
              // plan proceeds normally.
              await log({
                kind: "error",
                session: input.sessionID,
                hook: "tool.execute.after",
                subagent: sub,
                error: `measurePlanQuality failed: ${(err as Error).message}`,
              })
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
