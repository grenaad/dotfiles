/**
 * arc-agent types (v0.25.1 — Path B / integrated orchestrator).
 *
 * Surviving subagents (5): cost-checker, review, critic, confidence-auditor,
 * falsifier. All others (frame, librarian, explore, synthesis, spike,
 * restater, alternatives, edgecases, scope-guard, expectation-keeper,
 * unknowns-auditor, frame-validity-check, skeptic, assumption-ledger,
 * ambiguity-spotter, delta-mapper, batch-planner, decision-options) were
 * removed in v0.25 — the orchestrator now performs those cognitive
 * operations inline.
 *
 * The orchestrator itself is a primary-mode agent (not in CEILINGS — primary
 * agents are not constrained by this map).
 */

/**
 * Per-subagent input-prompt ceiling (chars). The plugin's `tool.execute.before`
 * hook truncates subagent prompts that exceed their ceiling.
 *
 * v0.25.1: the 5 surviving subagents are all advisory (review, critic,
 * confidence-auditor, cost-checker, falsifier). Review + critic + confidence-
 * auditor ingest full plans, so their ceilings remain generous. Cost-checker
 * + falsifier ingest narrower slices.
 */
export const CEILINGS = {
  review: 20_000,
  critic: 20_000,
  "confidence-auditor": 18_000,
  "cost-checker": 12_000,
  falsifier: 10_000,
  // v0.26: new violation-driven auditors. Ceilings tuned to plan-body size.
  "unverified-auditor": 18_000,
  "compound-cause-auditor": 18_000,
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
 * All v0.25.1 survivors are advisory/specialist subagents that never emit
 * Open Questions — they audit, critique, or report verdicts.
 */
export const NO_OPEN_QUESTIONS_SUBAGENTS = new Set<SubagentType>([
  "review",
  "critic",
  "confidence-auditor",
  "cost-checker",
  "falsifier",
])

/**
 * NoteType categories for workflow_note writes.
 *
 * v0.25.1: only the orchestrator and the 5 surviving subagents write notes.
 * Note types dropped: `prediction`, `insufficiency`, `contradiction` — these
 * were specific to the v0.21 cognitive-loop ledger driven by deprecated
 * subagents (frame/synthesis/frame-validity-check). The orchestrator tracks
 * predictions inline in its own reasoning trace; cross-turn coordination
 * notes use the simpler observation/concern/pattern set.
 */
export const NOTE_TYPES = {
  observation: "observation",
  concern: "concern",
  pattern: "pattern",
  retraction: "retraction",
} as const

export type NoteType = (typeof NOTE_TYPES)[keyof typeof NOTE_TYPES]

export const NOTE_TYPE_VALUES = [
  NOTE_TYPES.observation,
  NOTE_TYPES.concern,
  NOTE_TYPES.pattern,
  NOTE_TYPES.retraction,
] as const satisfies ReadonlyArray<NoteType>

/**
 * Per-author allowed NoteType map. Enforced inside `appendNote`.
 *
 * v0.25.1: the 5 survivors can write observations/concerns/patterns. None
 * write `retraction` (that was a self-correction mechanism for the deprecated
 * skeptic subagent across multiple checkpoints — v0.25 orchestrator self-
 * corrects inline with "Wait —" / "Actually —" tokens).
 */
export const NOTE_TYPE_AUTHORIZATION: Record<string, ReadonlyArray<NoteType>> = {
  review: [NOTE_TYPES.observation, NOTE_TYPES.concern],
  critic: [NOTE_TYPES.observation, NOTE_TYPES.concern],
  "confidence-auditor": [NOTE_TYPES.observation, NOTE_TYPES.concern],
  "cost-checker": [NOTE_TYPES.observation, NOTE_TYPES.concern],
  falsifier: [NOTE_TYPES.concern],
  // v0.26: violation-driven auditors emit concerns (corrections) only.
  "unverified-auditor": [NOTE_TYPES.concern],
  "compound-cause-auditor": [NOTE_TYPES.concern],
}

/**
 * The set of subagents authorized to write notes via `workflow_note`.
 * Derived from `NOTE_TYPE_AUTHORIZATION` keys.
 */
export const WRITE_NOTE_SUBAGENTS: ReadonlySet<SubagentType> = new Set(
  Object.keys(NOTE_TYPE_AUTHORIZATION).filter((k): k is SubagentType =>
    (SUBAGENT_NAMES as readonly string[]).includes(k),
  ),
)

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

/**
 * Plan-size buckets — used by plan-quality measurement on the orchestrator's
 * plan-draft turn.
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
  return PLAN_BUCKETS[PLAN_BUCKETS.length - 1]!.name
}

export interface PlanInfo {
  size: number
  bucket: PlanSizeBucket
  content: string
}

/**
 * Per-session state.
 *
 * v0.25.1: dropped fields that only deprecated subagents populated:
 *   - trivialityTier (classifier removed)
 *   - frameRebuildPending / frameRebuildCount (frame-validity-check removed)
 *   - taskShape (frame removed)
 *   - reframeOfferDeclined (synthesis re-frame loop removed)
 *   - predictionsContradicted (ledger removed)
 *   - openQuestions per source-subagent (no deprecated subagents emit them)
 *   - helperSessionID (compress_plan helper removed; orchestrator handles directly)
 */
export interface ArcState {
  sessionID: string
  parentSessionID?: string
  lastPlan?: PlanInfo
  /** Captured from the orchestrator's plan-draft turn for plan-quality. */
  taskType?: TaskType
  /** Captured from review output by normalizeVerdict. */
  normalizedVerdict?: NormalizedVerdict
  hookErrors: Array<{ hook: string; t: number; error: string }>
  /**
   * v0.19 — Workflow-memory: intra-workflow cross-turn memory.
   * Initialized lazily on first orchestrator turn capture. Available to the
   * orchestrator for cross-turn recall and to the 5 surviving subagents for
   * fresh-eyes context.
   */
  workflowMemory?: WorkflowMemoryState
  /**
   * v0.25 — Tracks whether `measurePlanQuality` has already fired this
   * workflow (idempotency for the orchestrator-turn heuristic detection).
   */
  planQualityMeasured?: boolean
  /**
   * v0.26.1 — Tracks whether mechanical violation detection already ran for
   * this workflow. Prevents duplicate notes if the plan is split across
   * multiple completed text parts.
   */
  violationsDetected?: boolean
  /**
   * v0.26.1 — Accumulates plan text across split assistant text parts until
   * the mechanical text-complete hook sees a full plan shape.
   */
  pendingPlanText?: string
  /** v0.26.3 — Counts primary investigation tool calls for budget pressure. */
  investigationToolCalls?: number
  /** v0.26.3 — Tracks whether the budget sentinel has already been emitted. */
  investigationBudgetWarned?: boolean
  /** v0.26.7 — File paths the orchestrator has read in this session (basename-normalized). */
  readFiles?: Set<string>
  /** v0.26.7 — Grep patterns the orchestrator has searched in this session. */
  greppedPatterns?: Set<string>
  /** v0.26.25 — Counts non-empty assistant text completions before plan telemetry. */
  assistantTextParts?: number
  /** v0.26.25 — Question tool recommended optional pasted-doc feature expansion. */
  optionalDocScopeExpansionQuestion?: boolean
}

/**
 * Task type detected from the orchestrator's plan output (via template
 * heading detection) — drives section-completeness checks in plan-quality.
 */
export type TaskType = "feature" | "fix" | "refactor" | "investigate" | "docs"

export const TASK_TYPE_VALUES = [
  "feature",
  "fix",
  "refactor",
  "investigate",
  "docs",
] as const satisfies ReadonlyArray<TaskType>

/**
 * Workflow-memory types — unchanged from v0.24.
 *
 * Lifecycle: in-memory only, lives in ArcState.workflowMemory, cleared
 * between workflows. The orchestrator and surviving subagents can read/write
 * via workflow_* tools.
 */

export interface WorkflowEntry {
  id: string
  seq: number
  subagent: SubagentType | "orchestrator"
  tMs: number
  output: string
  size: number
  truncated: boolean
  tags: string[]
}

export interface WorkflowNote {
  id: string
  seq: number
  author: SubagentType | "orchestrator"
  tMs: number
  type: NoteType
  topic: string
  content: string
  refs: string[]
}

export interface WorkflowMemoryState {
  startedAtMs: number
  entries: WorkflowEntry[]
  notes: WorkflowNote[]
  nextEntrySeq: number
  nextNoteSeqByAuthor: Partial<Record<SubagentType | "orchestrator", number>>
}

/** Caps for workflow-memory writes. */
export const ENTRY_MAX_CHARS = 8_000
export const NOTE_MAX_CHARS = 200
export const NOTE_TOPIC_MAX_CHARS = 80

/** Caps for recall queries. */
export const RECALL_DEFAULT_LIMIT = 5
export const RECALL_MAX_LIMIT = 20
export const RECALL_EXCERPT_CHARS = 300

export type NormalizedVerdict = "proceed" | "needs-revision" | "reject"

/**
 * Discriminated LogLine union.
 *
 * v0.25.1: dropped all log variants tied to deprecated subagents:
 * unknowns ledger, prediction ledger, task shape, failure chain,
 * frame-validity-check, reframe loop, trivial-skip stub, mechanical
 * verdict stub, prediction auto-confirm bypass, fallback-parsed notes.
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
  ceiling_hit: boolean
}

export interface ToolAfterLog extends LogBase {
  kind: "tool.execute.after"
  subagent: SubagentType
  original_chars: number
  /** Normalized verdict when subagent is review. */
  normalized_verdict?: NormalizedVerdict
}

export interface ErrorLog extends LogBase {
  kind: "error"
  hook: string
  subagent?: SubagentType
  error: string
}

export interface WorkflowCaptureLog extends LogBase {
  kind: "workflow.capture"
  subagent: SubagentType | "orchestrator"
  entry_id: string
  size: number
  truncated: boolean
  tag_count: number
  memory_total_entries: number
}

export interface WorkflowRecallLog extends LogBase {
  kind: "workflow.recall"
  caller?: SubagentType | "orchestrator"
  query_keys: string[]
  result_count: number
  empty: boolean
}

export interface WorkflowNoteLog extends LogBase {
  kind: "workflow.note"
  author: string
  note_id: string
  type: NoteType
  topic: string
  rejected?: boolean
}

export interface WorkflowResetLog extends LogBase {
  kind: "workflow.reset"
  reason: string
  prior_entry_count: number
}

export interface WorkflowNoteMemoryUninitializedLog extends LogBase {
  kind: "workflow.note.memory-uninitialized"
  root_session: string
  resolution_failed?: boolean
  author?: string
  type?: string
  topic?: string
}

/**
 * v0.23 — Plan-quality measurement. v0.25.1: re-targeted to fire on the
 * orchestrator's plan-draft turn (detected by template-marker presence in
 * assistant output), not on a deprecated `plan` subagent dispatch.
 */
export interface WorkflowPlanQualityLog extends LogBase {
  kind: "workflow.plan.quality"
  task_type: TaskType
  load_bearing_refs: number
  grounded: boolean
  checkable_wrong_if: boolean
  forbidden_phrase_count: number
  oversized_sections: string[]
}

/**
 * v0.26 — Mechanical violation detection.
 *
 * The plan emitted by the orchestrator is scanned (deterministic regex) for
 * adoption gaps where the prompt MUST has historically had low adoption on
 * Flash (e.g., omitted `## What I couldn't verify`, missing uniform-✅ escape
 * note). Each detected violation is recorded as telemetry and as a workflow
 * note for post-hoc analysis; it does not enqueue another model turn.
 *
 * Detection is observation-only — the plan ships unchanged.
 */
export type ViolationKind =
  | "missing-unverified-section"
  | "missing-falsification-section"
  | "uniform-marker-no-escape-note"
  | "compound-causes-no-notes-section"
  | "turn-budget-exceeded"
  | "assistant-turn-churn"
  | "optional-doc-scope-creep"
  | "falsifier-references-unread-file"
  | "load-bearing-claim-no-citation"
  | "cross-service-contract-not-gated"

export type ViolationSeverity = "high" | "med" | "low"

export interface Violation {
  kind: ViolationKind
  evidence: string                       // Quoted plan excerpt
  suggestedSubagent?: SubagentType       // Auditor recommendation recorded in telemetry.
  severity: ViolationSeverity
}

export interface WorkflowViolationLog extends LogBase {
  kind: "workflow.violation"
  task_type: TaskType
  source?: string
  violations: Array<{
    kind: ViolationKind
    severity: ViolationSeverity
    suggested_subagent?: SubagentType
  }>
  dispatched_subagents: SubagentType[]    // Auditor recommendations recorded as workflow notes.
  total_count: number
  cap_hit: boolean
}

export interface WorkflowPlanNormalizeLog extends LogBase {
  kind: "workflow.plan.normalize"
  rewrites: string[]
}

export interface WorkflowPathNormalizeLog extends LogBase {
  kind: "workflow.path.normalize"
  tool: string
  field: string
  from: string
  to: string
}

export interface WorkflowPathPermissionAllowLog extends LogBase {
  kind: "workflow.path.permission_allow"
  pattern: string
}

export interface WorkflowToolBudgetLog extends LogBase {
  kind: "workflow.tool_budget"
  tool: string
  count: number
  budget: number
  action: "warn-output"
}

export interface WorkflowDeprecatedSubagentBlockLog extends LogBase {
  kind: "workflow.deprecated_subagent.block"
  requested_subagent: string
  replacement_subagent: SubagentType
}

export type LogLine =
  | StartupLog
  | ToolBeforeLog
  | ToolAfterLog
  | ErrorLog
  | WorkflowCaptureLog
  | WorkflowRecallLog
  | WorkflowNoteLog
  | WorkflowResetLog
  | WorkflowNoteMemoryUninitializedLog
  | WorkflowPlanQualityLog
  | WorkflowViolationLog
  | WorkflowPlanNormalizeLog
  | WorkflowPathNormalizeLog
  | WorkflowPathPermissionAllowLog
  | WorkflowToolBudgetLog
  | WorkflowDeprecatedSubagentBlockLog
