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
  // v0.20 — cognitive-loop infrastructure
  // spike: light reconnaissance before frame; reads minimal prompt + does 1-4 tool calls
  spike: 4_500,
  // unknowns-auditor: gates plan; reads unknowns-status + relevant entries via tools
  "unknowns-auditor": 8_000,
  // frame-validity-check: detects contradiction between frame and research; reads
  // frame + research entries + multi-layer cross-reference notes
  "frame-validity-check": 16_000,
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
  // v0.20 additions
  "spike",
  "unknowns-auditor",
  "frame-validity-check",
])

/**
 * NoteType categories for workflow_note writes.
 *
 * Defined as a const map so the runtime values and the literal-union type
 * stay in sync. `NoteType` is derived from `NOTE_TYPES` — never write the
 * string literal ("unknown" etc.) inline anywhere; always reference
 * `NOTE_TYPES.<member>` for the value.
 *
 * Categories:
 *   - observation:   neutral finding worth recording
 *   - concern:       potential issue surfaced for later review
 *   - pattern:       recurring shape worth flagging across turns
 *   - retraction:    explicit withdrawal of a prior note
 *   - unknown:       L1 unknowns-ledger entry (uses Q/I/S/R/E content shape)
 *   - contradiction: L3 multi-layer or cross-source contradiction;
 *                    also used by frame-validity-check on L4 re-frame trigger
 *   - assumption:    L0 assumption-ledger entry
 *   - prediction:    v0.21 — frame's testable belief; "Wrong if X" falsifier
 *                    attached. Researchers reconcile via `observation` notes
 *                    against the same topic (P1, P2...).
 *   - insufficiency: v0.21 — frame/plan declares an existing mechanism that
 *                    was considered and rejected, naming the specific
 *                    constraint that makes it insufficient. Content shape:
 *                    "M: <mechanism> | I: <named constraint>".
 */
export const NOTE_TYPES = {
  observation: "observation",
  concern: "concern",
  pattern: "pattern",
  retraction: "retraction",
  unknown: "unknown",
  contradiction: "contradiction",
  assumption: "assumption",
  prediction: "prediction",
  insufficiency: "insufficiency",
} as const

export type NoteType = (typeof NOTE_TYPES)[keyof typeof NOTE_TYPES]

/** Ordered tuple form, useful for enum-style zod schemas and exhaustive checks. */
export const NOTE_TYPE_VALUES = [
  NOTE_TYPES.observation,
  NOTE_TYPES.concern,
  NOTE_TYPES.pattern,
  NOTE_TYPES.retraction,
  NOTE_TYPES.unknown,
  NOTE_TYPES.contradiction,
  NOTE_TYPES.assumption,
  NOTE_TYPES.prediction,
  NOTE_TYPES.insufficiency,
] as const satisfies ReadonlyArray<NoteType>

/**
 * Per-author allowed NoteType map. Enforced inside `appendNote`.
 *
 * Two cohorts:
 *   - Researchers (frame, librarian, explore, synthesis) — narrowly scoped:
 *     unknowns + observations + (synthesis only) contradictions.
 *     Researchers discover; they don't critique.
 *   - Analysts (skeptic, falsifier, scope-guard, etc.) — broader authorship
 *     because their job IS critique. `scope-guard` and `unknowns-auditor` are
 *     also authorized for `unknown` so they can mark items as deferred (see
 *     DEFERRAL_AUTHORIZED_AUTHORS).
 *
 * `plan` and `review` are deliberately absent — primary artifact producers
 * are read-write through their captured entries, not via notes.
 */
export const NOTE_TYPE_AUTHORIZATION: Record<string, ReadonlyArray<NoteType>> = {
  // Researchers
  // v0.21: frame writes prediction + insufficiency in addition to unknown.
  // Predictions are testable beliefs that researchers later reconcile.
  // Insufficiencies record rejected existing mechanisms ("M: foo | I: <constraint>").
  frame: [NOTE_TYPES.unknown, NOTE_TYPES.prediction, NOTE_TYPES.insufficiency],
  librarian: [NOTE_TYPES.unknown, NOTE_TYPES.observation],
  explore: [NOTE_TYPES.unknown, NOTE_TYPES.observation],
  edgecases: [NOTE_TYPES.observation, NOTE_TYPES.concern],
  synthesis: [NOTE_TYPES.unknown, NOTE_TYPES.observation, NOTE_TYPES.contradiction],
  // Analysts
  skeptic: [
    NOTE_TYPES.pattern,
    NOTE_TYPES.concern,
    NOTE_TYPES.retraction,
    NOTE_TYPES.contradiction,
    NOTE_TYPES.assumption,
    NOTE_TYPES.unknown,
  ],
  "expectation-keeper": [NOTE_TYPES.observation, NOTE_TYPES.contradiction, NOTE_TYPES.concern],
  "assumption-ledger": [NOTE_TYPES.assumption, NOTE_TYPES.concern],
  "confidence-auditor": [NOTE_TYPES.observation, NOTE_TYPES.contradiction, NOTE_TYPES.concern],
  "scope-guard": [NOTE_TYPES.observation, NOTE_TYPES.concern, NOTE_TYPES.unknown],
  falsifier: [NOTE_TYPES.contradiction, NOTE_TYPES.concern],
  "unknowns-auditor": [NOTE_TYPES.observation, NOTE_TYPES.unknown],
  "frame-validity-check": [NOTE_TYPES.contradiction],
  // v0.21 — plan may also declare insufficiencies when re-affirming existing-check
  // (or discovering new rejections during design). Plan is otherwise read-only.
  plan: [NOTE_TYPES.insufficiency],
}

/**
 * The set of subagents authorized to write notes via `workflow_note`.
 * Derived from `NOTE_TYPE_AUTHORIZATION` keys so adding a new author requires
 * editing exactly one place.
 *
 * Researchers (frame, librarian, explore, synthesis) and analysts (skeptic,
 * falsifier, etc.) write notes. Primary artifact producers (plan, review)
 * and structural micro-agents (restater, delta-mapper, etc.) do not —
 * their outputs are captured automatically as entries instead.
 */
export const WRITE_NOTE_SUBAGENTS: ReadonlySet<SubagentType> = new Set(
  Object.keys(NOTE_TYPE_AUTHORIZATION).filter((k): k is SubagentType =>
    (SUBAGENT_NAMES as readonly string[]).includes(k),
  ),
)

/**
 * v0.20 — Unknowns ledger status. Const map + derived type so callers
 * reference `UNKNOWN_STATUSES.open` rather than string literals.
 */
export const UNKNOWN_STATUSES = {
  open: "open",
  resolved: "resolved",
  deferred: "deferred",
} as const

export type UnknownStatus = (typeof UNKNOWN_STATUSES)[keyof typeof UNKNOWN_STATUSES]

export const UNKNOWN_STATUS_VALUES = [
  UNKNOWN_STATUSES.open,
  UNKNOWN_STATUSES.resolved,
  UNKNOWN_STATUSES.deferred,
] as const satisfies ReadonlyArray<UnknownStatus>

/**
 * v0.21 — Unknown resolvability classification. Frame declares this on each
 * unknown via "R: <resolvability>" in note content. Drives orchestrator
 * behavior at the plan boundary:
 *   - pre_design: must resolve before plan runs (block + soft directive)
 *   - user_input: requires interactive question() gate at unknowns-auditor
 *   - accept_risk: ship without resolution; mitigation documented in note
 */
export const UNKNOWN_RESOLVABILITY = {
  pre_design: "pre_design",
  user_input: "user_input",
  accept_risk: "accept_risk",
} as const

export type UnknownResolvability =
  (typeof UNKNOWN_RESOLVABILITY)[keyof typeof UNKNOWN_RESOLVABILITY]

export const UNKNOWN_RESOLVABILITY_VALUES = [
  UNKNOWN_RESOLVABILITY.pre_design,
  UNKNOWN_RESOLVABILITY.user_input,
  UNKNOWN_RESOLVABILITY.accept_risk,
] as const satisfies ReadonlyArray<UnknownResolvability>

/**
 * v0.21 — Task shape classification. Distinct from `TaskType` (feature/fix/
 * refactor/investigate/docs which is production-line classification). Task
 * Shape names the *cognitive methodology* the task requires. Frame declares
 * primary + optional secondary in its output; orchestrator captures via
 * parseTaskShape and propagates downstream.
 */
export const TASK_SHAPES = {
  failure_chain: "failure-chain",
  greenfield_plan: "greenfield-plan",
  refactor_existing: "refactor-existing",
  compare_evaluate: "compare-evaluate",
  investigate_unknown: "investigate-unknown",
  map_system: "map-system",
} as const

export type TaskShape = (typeof TASK_SHAPES)[keyof typeof TASK_SHAPES]

export const TASK_SHAPE_VALUES = [
  TASK_SHAPES.failure_chain,
  TASK_SHAPES.greenfield_plan,
  TASK_SHAPES.refactor_existing,
  TASK_SHAPES.compare_evaluate,
  TASK_SHAPES.investigate_unknown,
  TASK_SHAPES.map_system,
] as const satisfies ReadonlyArray<TaskShape>

/**
 * v0.21 — Prediction verdict. Researcher observations against a P# topic
 * carry "V: <verdict> | E: <evidence>" content; synthesis aggregates into the
 * reconciliation table. `inconclusive` covers both explicit non-determination
 * and absence (no observation note found for a declared prediction).
 */
export const PREDICTION_VERDICTS = {
  confirmed: "confirmed",
  contradicted: "contradicted",
  inconclusive: "inconclusive",
} as const

export type PredictionVerdict =
  (typeof PREDICTION_VERDICTS)[keyof typeof PREDICTION_VERDICTS]

export const PREDICTION_VERDICT_VALUES = [
  PREDICTION_VERDICTS.confirmed,
  PREDICTION_VERDICTS.contradicted,
  PREDICTION_VERDICTS.inconclusive,
] as const satisfies ReadonlyArray<PredictionVerdict>

/**
 * Authors who may write `S: deferred` status into an unknown note.
 *
 * Researchers (frame, librarian, explore, synthesis) can only write open
 * or resolved. Deferral is a *decision* about whether the unknown is
 * acceptable to ship without — that's an analyst/specialist responsibility.
 *
 * Note: authors must ALSO be authorized to write `unknown`-type notes via
 * NOTE_TYPE_AUTHORIZATION. The two checks compose: author is allowed type
 * X AND (for unknowns specifically) author is allowed to defer.
 */
export const DEFERRAL_AUTHORIZED_AUTHORS: ReadonlySet<string> = new Set([
  "skeptic",
  "scope-guard",
  "unknowns-auditor",
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
  /**
   * v0.20 — Re-frame state. `frameRebuildPending` is set when
   * frame-validity-check returns Status: rebuild; the next subagent prompt is
   * augmented with a rebuild directive (Layer 4 forced re-frame). Cap of 1
   * rebuild per workflow via `frameRebuildCount`.
   */
  frameRebuildCount?: number
  frameRebuildPending?: {
    reason: string
    pivot: string
    triggeredBy: string
  }
  /**
   * v0.21 — Task Shape captured from frame output (parseTaskShape). Drives
   * downstream prompt-shaping (currently log-only; agent prompts may
   * reference state.taskShape in future).
   */
  taskShape?: {
    primary: TaskShape
    secondary?: TaskShape
    rationale: string
  }
  /**
   * v0.21 — Re-frame offer state. Set true after the orchestrator's
   * synthesis-contradiction question() gate is declined, so we don't re-ask
   * within the same workflow. Cleared on resetWorkflowMemory.
   */
  reframeOfferDeclined?: boolean
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
  /**
   * v0.20 — Set when a later re-frame (frame-validity-check returning rebuild)
   * invalidates this entry. History is preserved (entries remain append-only);
   * downstream consumers can detect superseded artifacts via this marker.
   */
  superseded?: { byId?: string; reason: string }
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
  /** Note category. v0.20 expanded — see NoteType. */
  type: NoteType
  /**
   * Short anchor for cross-step matching, e.g. "expectation:postgresql" or
   * "pattern:frame-capture-risk" or "U1" (for unknowns). Lowercased;
   * substring-matched on query.
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

/**
 * Triviality tier — derived from frame's task type + raw user prompt by
 * `classifyTriviality`. Three values:
 *
 *   - `ultra`   — one-liner clarifications, single-grep questions. Skip
 *                 everything except restater+frame.
 *   - `trivial` — small features/fixes (one file, no architectural choice).
 *                 Skip research and analysis specialist passes; workflow
 *                 memory is suppressed.
 *   - `full`    — non-trivial planning. Run the full pipeline.
 *
 * `ultra` and `trivial` both suppress workflow memory; use
 * `suppressesWorkflowMemory(tier)` rather than inline string comparisons.
 */
export const TRIVIALITY_TIERS = {
  ultra: "ultra",
  trivial: "trivial",
  full: "full",
} as const

export type TrivialityTier = (typeof TRIVIALITY_TIERS)[keyof typeof TRIVIALITY_TIERS]

export const TRIVIALITY_TIER_VALUES = [
  TRIVIALITY_TIERS.ultra,
  TRIVIALITY_TIERS.trivial,
  TRIVIALITY_TIERS.full,
] as const satisfies ReadonlyArray<TrivialityTier>

/**
 * Tiers that SUPPRESS workflow memory and the v0.21 cognitive-loop machinery
 * (predict-observe-compare, unknowns ledger, existing-solutions check). The
 * full pipeline only runs on `full`.
 *
 * Single source of truth — every callsite that gates on memory suppression
 * imports `suppressesWorkflowMemory` rather than comparing tier strings
 * inline. Adding a new tier (e.g. `micro` between trivial and full) requires
 * editing exactly one place.
 */
export const MEMORY_SUPPRESSING_TIERS: ReadonlySet<TrivialityTier> = new Set([
  TRIVIALITY_TIERS.ultra,
  TRIVIALITY_TIERS.trivial,
])

export function suppressesWorkflowMemory(tier: TrivialityTier | undefined): boolean {
  return tier !== undefined && MEMORY_SUPPRESSING_TIERS.has(tier)
}

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
  /** Author as provided by the tool caller; not narrowed to SubagentType because rejected writes may carry an invalid name. */
  author: string
  note_id: string
  type: NoteType
  topic: string
  /** True when the write was rejected (invalid author, unauthorized type, or other validation failure). */
  rejected?: boolean
}

export interface WorkflowResetLog extends LogBase {
  kind: "workflow.reset"
  /** Reason for clearing memory; usually "restater-after-existing-entries". */
  reason: string
  prior_entry_count: number
}

/** v0.20 — cognitive-loop observability log variants. */

export interface WorkflowStanceLog extends LogBase {
  kind: "workflow.stance"
  /** First artifact subagent observed in this workflow. */
  first_artifact_subagent: SubagentType
}

export interface WorkflowUnknownDeclaredLog extends LogBase {
  kind: "workflow.unknown.declared"
  author: SubagentType
  topic: string
  /** Truncated question text for the log. */
  question_excerpt: string
}

export interface WorkflowUnknownResolvedLog extends LogBase {
  kind: "workflow.unknown.resolved"
  author: SubagentType
  topic: string
  note_id: string
  /** Truncated evidence text for the log. */
  evidence_excerpt: string
}

export interface WorkflowUnknownDeferredLog extends LogBase {
  kind: "workflow.unknown.deferred"
  author: SubagentType
  topic: string
  reason_excerpt: string
}

export interface WorkflowUnknownGateLog extends LogBase {
  kind: "workflow.unknown.gate"
  verdict: "ALL_RESOLVED" | "OPEN_UNKNOWNS_REMAIN" | "DEFERRED_ACCEPTABLE" | "UNKNOWN"
  open_count: number
  resolved_count: number
  deferred_count: number
}

export interface WorkflowLayerCheckLog extends LogBase {
  kind: "workflow.layer-check"
  layers_present: number
  layers_na: number
  contradictions: number
}

export interface WorkflowReframeTriggeredLog extends LogBase {
  kind: "workflow.reframe.triggered"
  reason_excerpt: string
  pivot_excerpt: string
  triggered_by: string
}

export interface WorkflowReframeSuppressedLog extends LogBase {
  kind: "workflow.reframe.suppressed"
  reason: string
}

export interface WorkflowSpikeExecutedLog extends LogBase {
  kind: "workflow.spike.executed"
  output_size: number
  na: boolean
}

/** v0.21 — predict-observe-compare loop + simplest-path + failure-chain logs. */

export interface WorkflowPredictionDeclaredLog extends LogBase {
  kind: "workflow.prediction.declared"
  topic: string
  /** Truncated claim text. */
  claim_excerpt: string
}

export interface WorkflowPredictionObservedLog extends LogBase {
  kind: "workflow.prediction.observed"
  author: SubagentType
  topic: string
  verdict: PredictionVerdict | "unparseable"
  evidence_excerpt: string
}

export interface WorkflowPredictionReconciledLog extends LogBase {
  kind: "workflow.prediction.reconciled"
  confirmed: number
  contradicted: number
  inconclusive: number
  unobserved: number
}

export interface WorkflowReframeOfferedLog extends LogBase {
  kind: "workflow.reframe.offered"
  contradicted: number
  predictions: string[]
  /** "accepted" | "declined" | "non-interactive" | "cap-exhausted" */
  outcome: string
}

export interface WorkflowUnknownsBlockingLog extends LogBase {
  kind: "workflow.unknowns.blocking"
  count: number
  topics: string[]
}

export interface WorkflowTaskShapeDeclaredLog extends LogBase {
  kind: "workflow.task-shape.declared"
  primary: TaskShape
  secondary?: TaskShape
  rationale_excerpt: string
}

export interface WorkflowExistingCheckDeclaredLog extends LogBase {
  kind: "workflow.existing-check.declared"
  author: SubagentType
  mechanisms: number
  rejections: number
}

export interface WorkflowFailureChainDeclaredLog extends LogBase {
  kind: "workflow.failure-chain.declared"
  has_timeline: boolean
  has_classification: boolean
  has_root_cause: boolean
  confirmations: number
  has_attribution: boolean
}

/**
 * v0.22 — Observability for the workflow_note memory-uninitialized rejection
 * path. Previously this failure was silent: the tool returned the "not
 * initialized" message to the caller but emitted no log entry, so subagent
 * note writes that landed in a fresh child-session ArcState (because the
 * tool was reading `context.sessionID` directly instead of resolving to the
 * parent) were invisible in the JSONL log. This variant makes those drops
 * observable so future regressions surface immediately.
 *
 * `root_session` is the resolved parent (after the child→parent walk) — if
 * resolution failed and we fell back to `context.sessionID`, the two values
 * will match.
 */
export interface WorkflowNoteMemoryUninitializedLog extends LogBase {
  kind: "workflow.note.memory-uninitialized"
  /** The session id we resolved to via the parent walk (may equal `session`). */
  root_session: string
  /** True when the parent walk failed and we fell back to the original sessionID. */
  resolution_failed?: boolean
  author?: string
  type?: string
  topic?: string
}

/**
 * v0.22 — Belt-and-suspenders: emitted from the parent's tool.execute.after
 * hook when frame's structured markdown sections (Predictions / Unknowns /
 * Existing Solutions Check) contain more items than the workflow_note tool
 * actually recorded into memory. The hook synthesizes the missing notes
 * from the parsed markdown so v0.21's predict-observe-compare loop still
 * has the predictions/unknowns/insufficiencies it expects, even when the
 * subagent's tool calls dropped them (e.g. due to a regression in the
 * parent-session resolution path).
 */
export interface WorkflowNoteFallbackParsedLog extends LogBase {
  kind: "workflow.note.fallback-parsed"
  note_kind: "prediction" | "unknown" | "insufficiency"
  /** How many notes were synthesized from the parsed markdown. */
  count: number
  /** Author the synthesized notes were attributed to. */
  author: SubagentType
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
  | WorkflowStanceLog
  | WorkflowUnknownDeclaredLog
  | WorkflowUnknownResolvedLog
  | WorkflowUnknownDeferredLog
  | WorkflowUnknownGateLog
  | WorkflowLayerCheckLog
  | WorkflowReframeTriggeredLog
  | WorkflowReframeSuppressedLog
  | WorkflowSpikeExecutedLog
  | WorkflowPredictionDeclaredLog
  | WorkflowPredictionObservedLog
  | WorkflowPredictionReconciledLog
  | WorkflowReframeOfferedLog
  | WorkflowUnknownsBlockingLog
  | WorkflowTaskShapeDeclaredLog
  | WorkflowExistingCheckDeclaredLog
  | WorkflowFailureChainDeclaredLog
  | WorkflowNoteMemoryUninitializedLog
  | WorkflowNoteFallbackParsedLog
