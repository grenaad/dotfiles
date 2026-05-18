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
 */
export const CEILINGS = {
  // primary subagents (v0.1+)
  frame: 2_000,
  librarian: 5_000,
  explore: 5_000,
  edgecases: 6_000,
  plan: 12_000,
  review: 18_000,
  "quick-answer": 4_000,
  general: 8_000,
  // micro-subagents (v0.14): specialized reasoning moves
  // Note: ceilings here cap the INPUT prompt size, not the output budget.
  // Critic reads the full plan as input, so its ceiling must approximate review's.
  restater: 1_000,
  "delta-mapper": 1_500,
  "ambiguity-spotter": 2_000,
  alternatives: 3_000,
  "batch-planner": 5_000,
  critic: 18_000,
  // v0.15 additions
  synthesis: 6_000,
  "decision-options": 20_000,
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
}

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

export type LogLine = StartupLog | ToolBeforeLog | ToolAfterLog | HelperLog | ErrorLog
