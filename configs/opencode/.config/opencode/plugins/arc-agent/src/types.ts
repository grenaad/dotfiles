/**
 * Type definitions for arc-agent.
 *
 * Single source of truth for:
 * - Subagent names + per-subagent char ceilings
 * - Plan-size buckets + their thresholds
 * - Helper-call labels
 * - LogLine discriminated union (one variant per log site)
 * - Task tool args shape + type guard
 */

/**
 * Per-subagent prompt size ceilings (chars).
 * Truncation happens at hook level if exceeded.
 *
 * SubagentType is derived from this object's keys, so adding a new subagent
 * requires editing exactly one place.
 *
 * v0.16: raised by ~1000 chars across the board to absorb the larger DeepSeek
 * preamble (DELEGATION_PREAMBLE + REASONING_CONVENTIONS now totals ~2013 chars,
 * up from ~1400 in the Opus-tuned v0.15). Without this bump, restater (1000)
 * and delta-mapper (1500) ceilings sit BELOW the preamble alone, and
 * `truncateAtBoundary` (naive head-keep) silently truncates the USER task
 * content from the tail — degrading subagent quality without surfacing it.
 */
export const CEILINGS = {
  // primary subagents (v0.1+)
  frame: 3_500, // was 2_000 — preamble ~2k + task ~750 + headroom
  librarian: 6_500, // was 5_000
  explore: 6_500, // was 5_000
  edgecases: 7_500, // was 6_000
  plan: 14_000, // was 12_000
  review: 20_000, // was 18_000
  "quick-answer": 5_500, // was 4_000
  general: 9_500, // was 8_000
  // micro-subagents (v0.14): specialized reasoning moves
  // Note: ceilings here cap the INPUT prompt size, not the output budget.
  // Critic reads the full plan as input, so its ceiling must approximate review's.
  restater: 3_000, // was 1_000 — preamble alone is 2k; need real headroom for the task verbatim
  "delta-mapper": 3_500, // was 1_500
  "ambiguity-spotter": 4_000, // was 2_000
  alternatives: 5_000, // was 3_000
  "batch-planner": 6_500, // was 5_000
  critic: 20_000, // was 18_000
  // v0.15 additions
  synthesis: 7_500, // was 6_000
  "decision-options": 22_000, // was 20_000
  // v0.17 — background self-skepticism auditor; reads accumulated workflow at checkpoints.
  // Ceiling is generous because skeptic at CP4 ingests the entire workflow-so-far
  // (frame + expectations + librarian + explore + analysis batch + alternatives +
  // batch-planner + plan + review + critic + decision-options). Roughly matches
  // critic's input ceiling for similar reasons.
  skeptic: 20_000,
  // v0.18 — six specialist micro-agents that extract previously-inlined behaviors.
  // Each one runs in parallel with existing Step 4/5 calls or at step transitions.
  // Ceilings scale by typical input size: agents that read full plan (confidence-auditor,
  // assumption-ledger, falsifier) need higher ceilings; agents that read narrower slices
  // (cost-checker, scope-guard, expectation-keeper) need less.
  "confidence-auditor": 18_000, // reads full plan + full findings
  "cost-checker": 12_000, // reads framing + explore + librarian + candidates
  "assumption-ledger": 16_000, // reads framing + plan + cross-source findings
  falsifier: 10_000, // reads framing + picked option + relevant findings excerpts
  "scope-guard": 8_000, // reads framing's ask/goals + latest step output
  "expectation-keeper": 15_000, // reads expectations + cumulative evidence (grows over passes)
} as const

export type SubagentType = keyof typeof CEILINGS

const SUBAGENT_NAMES = Object.keys(CEILINGS) as readonly SubagentType[]

export function isSubagent(s: unknown): s is SubagentType {
  return typeof s === "string" && (SUBAGENT_NAMES as readonly string[]).includes(s)
}

/**
 * Subagents whose outputs are NOT expected to contain `## Open Questions`
 * sections. The plugin hardcode-skips the strip helper for these.
 *
 * Primary subagent `frame` is also in this set because its prompt is
 * just preamble + raw user text (no Open Questions possible).
 */
export const NO_OPEN_QUESTIONS_SUBAGENTS = new Set<SubagentType>([
  "frame",
  "restater",
  "delta-mapper",
  "ambiguity-spotter",
  "alternatives",
  "batch-planner",
  "critic",
  "synthesis",
  "decision-options",
  "skeptic",
  "confidence-auditor",
  "cost-checker",
  "assumption-ledger",
  "falsifier",
  "scope-guard",
  "expectation-keeper",
])

/**
 * v0.19 — Workflow-memory: which subagents are authorized to write notes via
 * the `workflow_note` tool. The set is intentionally narrow: only the analysis
 * specialists whose job is meta-evaluation (skeptic, expectation-keeper,
 * assumption-ledger, confidence-auditor, scope-guard, falsifier). Primary
 * subagents (frame, librarian, plan, review) and structural micro-agents
 * (restater, delta-mapper, etc.) do NOT write notes — their outputs are
 * captured automatically as workflow entries instead.
 */
export const WRITE_NOTE_SUBAGENTS = new Set<SubagentType>([
  "skeptic",
  "expectation-keeper",
  "assumption-ledger",
  "confidence-auditor",
  "scope-guard",
  "falsifier",
])

/**
 * Plan-size buckets. Buckets are ordered by ascending size; `bucketFor`
 * picks the first whose `max` is not exceeded.
 *
 * Co-locating threshold + name eliminates drift risk between hooks.ts
 * (which used magic numbers in v0.1) and types.ts (which named the buckets).
 */
export const PLAN_BUCKETS = [
  { name: "small", max: 8_000 },
  { name: "target", max: 15_000 },
  { name: "above", max: 20_000 },
  { name: "compress", max: Number.POSITIVE_INFINITY },
] as const satisfies ReadonlyArray<{ name: string; max: number }>

export type PlanSizeBucket = (typeof PLAN_BUCKETS)[number]["name"]

export function bucketFor(size: number): PlanSizeBucket {
  for (const b of PLAN_BUCKETS) {
    if (size < b.max) return b.name
  }
  // Unreachable because the last bucket's max is +Infinity, but TS doesn't know that.
  return PLAN_BUCKETS[PLAN_BUCKETS.length - 1]!.name
}

/**
 * Known helper-call labels. Extending v0.2 with new helpers requires
 * adding the label here AND a transform function that uses it.
 */
export type HelperLabel = "strip_open_questions" | "compress_plan"

/**
 * Shape of the `task` tool's args field — what the orchestrator passes
 * when invoking a subagent.
 */
export interface TaskToolArgs {
  subagent_type: string
  prompt: string
  description?: string
}

export function isTaskToolArgs(x: unknown): x is TaskToolArgs {
  if (typeof x !== "object" || x === null) return false
  const r = x as Record<string, unknown>
  return typeof r.subagent_type === "string" && typeof r.prompt === "string"
}

export interface PlanInfo {
  size: number
  bucket: PlanSizeBucket
  content: string
  /** populated lazily when bucket === 'compress' */
  compressedForReview?: string
}

export interface ArcState {
  sessionID: string
  parentSessionID?: string
  helperSessionID?: string
  lastPlan?: PlanInfo
  /** Captured from frame output post-Step 1.25; drives template injection + section enforcement. */
  taskType?: import("./templates").TaskType
  /** Computed from frame output by classifyTriviality (Phase 6). */
  trivialityTier?: TrivialityTier
  /** Captured from review output by normalizeVerdict (Phase 8). */
  normalizedVerdict?: NormalizedVerdict
  /** Extracted open-question strings per source subagent (Phase 7). */
  openQuestions?: Array<{ source: SubagentType; questions: string[] }>
  hookErrors: Array<{ hook: string; t: number; error: string }>
  /**
   * v0.19 — Workflow-memory: intra-workflow cross-turn memory.
   * Initialized lazily on first subagent capture. Cleared when restater is
   * called with non-empty memory (signals start of a new workflow within the
   * same session).
   */
  workflowMemory?: WorkflowMemoryState
}

/**
 * v0.19 — Workflow-memory types.
 *
 * Solves Sub-problem A (intra-workflow cross-turn memory): subagents within a
 * single workflow can query past subagent outputs and read structured notes
 * left by analysis specialists at earlier steps.
 *
 * Lifecycle: in-memory only, lives in ArcState.workflowMemory, cleared when a
 * new workflow starts. No disk persistence — for cross-session memory see
 * Sub-problem B (separate plan, not implemented here).
 */

/**
 * A captured subagent output. The plugin's `tool.execute.after` hook appends
 * one entry per subagent invocation (after task type / verdict / open-question
 * extraction has already happened). Append-only.
 */
export interface WorkflowEntry {
  /** Stable id: `<subagent>-<seq>` e.g. "frame-001", "skeptic-003". */
  id: string
  /** Monotonic sequence number across the whole workflow. */
  seq: number
  /** Source subagent. */
  subagent: SubagentType
  /** ms-since-workflow-start when capture happened. */
  tMs: number
  /** Verbatim output. May be truncated; see `truncated`. */
  output: string
  /** Original output size in chars (before any truncation). */
  size: number
  /** True when `output` was truncated to fit ENTRY_MAX_CHARS. */
  truncated: boolean
  /** Auto-extracted tags: section headings + key terms. */
  tags: string[]
}

/**
 * A structured note authored by an analysis specialist (WRITE_NOTE_SUBAGENTS).
 * Used for cross-turn signal — e.g. skeptic CP1 writes a `pattern` note that
 * skeptic CP4 can recall to detect recurrence.
 */
export interface WorkflowNote {
  /** Stable id: `note-<author>-<seq>` e.g. "note-skeptic-002". */
  id: string
  /** Per-author sequence number. */
  seq: number
  /** Author subagent (must be in WRITE_NOTE_SUBAGENTS). */
  author: SubagentType
  /** ms-since-workflow-start when written. */
  tMs: number
  /** Note category. */
  type: "observation" | "concern" | "pattern" | "retraction"
  /**
   * Short anchor for cross-step matching, e.g. "expectation:postgresql" or
   * "pattern:frame-capture-risk". Lowercased; substring-matched on query.
   */
  topic: string
  /** Content of the note. Bounded by NOTE_MAX_CHARS (200). */
  content: string
  /** Ids of related entries/notes (best-effort; not validated). */
  refs: string[]
}

export interface WorkflowMemoryState {
  /** ms timestamp when the workflow started (first capture). */
  startedAtMs: number
  /** Append-only entry log. */
  entries: WorkflowEntry[]
  /** Append-only note log. */
  notes: WorkflowNote[]
  /** Next sequence number for entries (global). */
  nextEntrySeq: number
  /** Next sequence number for notes, per author. */
  nextNoteSeqByAuthor: Partial<Record<SubagentType, number>>
  /** Triviality at the time of creation; memory is suppressed on ultra/trivial. */
  trivialityAtCreation?: TrivialityTier
}

/** Caps for workflow-memory writes. Soft limits enforced by store. */
export const ENTRY_MAX_CHARS = 8_000
export const NOTE_MAX_CHARS = 200
export const NOTE_TOPIC_MAX_CHARS = 80

/** Caps for recall queries. */
export const RECALL_DEFAULT_LIMIT = 5
export const RECALL_MAX_LIMIT = 20
export const RECALL_EXCERPT_CHARS = 300

export type TrivialityTier = "ultra" | "trivial" | "full"

export type NormalizedVerdict = "proceed" | "needs-revision" | "reject"

/**
 * Discriminated LogLine union.
 *
 * Each log site is associated with exactly one variant; TS enforces that
 * all required fields are present per variant. The `kind` field is the
 * discriminant. The base `t` field is added by the logger itself.
 */

interface LogBase {
  t?: string
  session: string
}

export interface StartupLog extends LogBase {
  kind: "init"
  note: string
}

export interface ToolBeforeLog extends LogBase {
  kind: "tool.execute.before"
  subagent: SubagentType
  original_chars: number
  final_chars: number
  stripped_open_questions: boolean
  ceiling_hit: boolean
  compressed: boolean
  /** True when the cheap pre-filter skipped invoking the strip helper. */
  pre_filter_skip?: boolean
  /** True when the strip helper aborted on timeout. */
  helper_timeout?: boolean
}

export interface ToolAfterLog extends LogBase {
  kind: "tool.execute.after"
  subagent: SubagentType
  original_chars: number
  plan_bucket?: PlanSizeBucket
  final_chars?: number
  compressed?: boolean
  /** v0.15 — captured task type when subagent is frame */
  task_type?: import("./templates").TaskType
  /** v0.15 — computed triviality tier when subagent is frame */
  triviality_tier?: TrivialityTier
  /** v0.15 — normalized verdict when subagent is review */
  normalized_verdict?: NormalizedVerdict
  /** v0.15 — missing required sections on plan */
  missing_sections?: string[]
}

export interface HelperLog extends LogBase {
  kind: "helper"
  helper_call: HelperLabel
  helper_latency_ms: number
  final_chars: number
  /** True when the helper call was aborted on timeout. */
  helper_timeout?: boolean
  /** True when compress output failed sanity check and was discarded. */
  sanity_check_failed?: boolean
}

export interface ErrorLog extends LogBase {
  kind: "error"
  hook: string
  subagent?: SubagentType
  error: string
}

/** v0.19 — workflow-memory log variants. */

export interface WorkflowCaptureLog extends LogBase {
  kind: "workflow.capture"
  subagent: SubagentType
  entry_id: string
  size: number
  truncated: boolean
  tag_count: number
  memory_total_entries: number
}

export interface WorkflowRecallLog extends LogBase {
  kind: "workflow.recall"
  /** Caller subagent (best-effort, may be unknown when called by orchestrator directly). */
  caller?: SubagentType
  query_keys: string[]
  result_count: number
  /** True when memory was empty / not initialized at recall time. */
  empty: boolean
}

export interface WorkflowNoteLog extends LogBase {
  kind: "workflow.note"
  author: SubagentType
  note_id: string
  type: WorkflowNote["type"]
  topic: string
  /** True when author is NOT in WRITE_NOTE_SUBAGENTS and the write was rejected. */
  rejected?: boolean
}

export interface WorkflowResetLog extends LogBase {
  kind: "workflow.reset"
  /** Reason for clearing memory; usually "restater-after-existing-entries". */
  reason: string
  prior_entry_count: number
}

export type LogLine =
  | StartupLog
  | ToolBeforeLog
  | ToolAfterLog
  | HelperLog
  | ErrorLog
  | WorkflowCaptureLog
  | WorkflowRecallLog
  | WorkflowNoteLog
  | WorkflowResetLog
