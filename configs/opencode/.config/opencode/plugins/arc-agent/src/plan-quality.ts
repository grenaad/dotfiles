/**
 * v0.23 — Plan-quality measurement.
 *
 * Inspects the rendered plan markdown and emits six heuristic signals
 * describing how "load-bearing" vs "form-filled" the plan is. All signals
 * are advisory; nothing here gates or rejects a plan — the reviewer
 * subagent remains the sole verdict authority.
 *
 * The measurement exists so plan-quality regressions become observable in
 * the JSONL log the same way the v0.21 cognitive loop became observable
 * via workflow.prediction.reconciled.
 *
 * Six signals (see WorkflowPlanQualityLog in types.ts for field docs):
 *   1. loadBearingRefs       — count of file:line refs in design sections
 *   2. checkableWrongIf      — Falsification's Wrong-if names a real check
 *   3. forbiddenPhraseCount  — bare-justification phrase count
 *   4. oversizedSections     — sections exceeding length contract
 *   5. ungroundedInsufficiencies — Insufficient claims without named constraint
 *   6. contradictionAcknowledged — outstanding contradictions referenced in design
 *
 * Heuristics are deliberately permissive for v0.23 (advisory, not gating).
 * v0.24+ may tune thresholds based on observed data.
 */

import type { ArcState } from "./types"
import type { TaskType } from "./templates"

/** Public result shape. Mirrors WorkflowPlanQualityLog field names without `kind`. */
export interface PlanQualitySignals {
  loadBearingRefs: number
  grounded: boolean
  checkableWrongIf: boolean
  forbiddenPhraseCount: number
  oversizedSections: string[]
  ungroundedInsufficiencies: number
  contradictionAcknowledged: boolean
}

/**
 * Sections whose body is scanned for `file.ext:NN` refs. These are the
 * "design sections" — where load-bearing decisions land per task type.
 * Cross-shape: any section listed here is scanned if present, regardless
 * of task type. Sections absent from the rendered plan are silently
 * skipped (no synthetic penalty).
 */
const DESIGN_SECTION_HEADINGS = [
  "## Architecture Decisions",
  "## Implementation Steps",
  "## Fix Strategy",
  "## Target Shape",
  "## Migration Steps",
  "## Recommendation",
] as const

/**
 * Per-section length contract (line counts, excluding heading + blank lines).
 * Sections not listed have no length contract. Heading must match exactly
 * (case-sensitive) — extracted sections compare on the normalized heading
 * we emit via splitSections().
 */
const SECTION_LINE_LIMITS: Record<string, number> = {
  "## Architecture Decisions": 25,
  "## Fix Strategy": 20,
  "## Target Shape": 25,
  "## Recommendation": 15,
  "## Falsification": 3,
}

/**
 * Per-step length contract for the Implementation Steps section. Counts
 * lines per numbered/bulleted step. If any step exceeds the limit, the
 * whole section is flagged. (Total-section limit is intentionally absent
 * here — long Implementation Steps sections can be legitimate when there
 * are many steps; what's NOT legitimate is a single step with 12 lines of
 * prose.)
 */
const IMPL_STEP_LINE_LIMIT = 10

/**
 * Bare-justification phrases that are forbidden as standalone reasons in
 * design sections. Detection is case-insensitive substring match within
 * the design sections only — finding "different domain" inside an Out of
 * Scope bullet does NOT count, but finding it in Architecture Decisions
 * does.
 */
const FORBIDDEN_PHRASES = [
  "cleaner separation",
  "better organization",
  "more maintainable",
  "easier to reason about",
  "different domain",
  "feels right",
  "best practice",
  "cleaner code",
] as const

/**
 * Keywords that count as a "named constraint" inside an Insufficient
 * claim's surrounding sentence. Presence of any one of these in the
 * bullet line containing "Insufficient" passes the groundedness check.
 */
const CONSTRAINT_KEYWORDS = [
  "because",
  "requires",
  "lacks",
  "constraint",
  "invariant",
  "contract",
  "schema",
  "api",
  "protocol",
  "performance",
  "latency",
  "throughput",
  "concurrency",
  "thread-safety",
  "atomicity",
] as const

/**
 * Verb / condition tokens that mark a Wrong-if as checkable. Detection
 * is permissive — any one of these in the Wrong-if text passes. The
 * negative test is more important: bare hedges like "the design is wrong"
 * fail because none of these tokens appear AND the line is short.
 */
const CHECKABLE_WRONG_IF_TOKENS = [
  "when",
  "if",
  "returns",
  "raises",
  "exceeds",
  "fails to",
  "does not",
  "produces",
  "is missing",
  "contains",
  "differs from",
  "drops",
  "leaks",
  "blocks",
  "deadlocks",
  "exceeds",
  "is greater than",
  "is less than",
  ">",
  "<",
  "==",
  "!=",
] as const

/**
 * Bare-hedge tokens that, when found alone (without a checkable token),
 * fail the Wrong-if check. These are the "design is wrong" / "approach is
 * flawed" tells.
 */
const BARE_HEDGE_PATTERNS = [
  /\bdesign is (wrong|flawed|incorrect|bad)\b/i,
  /\bapproach is (wrong|flawed|incorrect|bad)\b/i,
  /\bsolution is (wrong|flawed|incorrect|bad)\b/i,
  /\bthis is (wrong|flawed|incorrect|bad)\b/i,
  /\bplan is (wrong|flawed|incorrect|bad)\b/i,
  /\bfix is (wrong|flawed|incorrect|bad)\b/i,
] as const

/**
 * Heading regex: matches `## ` followed by anything to end of line.
 * Capture group 1 is the heading text (without the `## ` prefix).
 */
const SECTION_HEADING_RE = /^(##\s+[^\n]+)$/gm

/**
 * file:line ref regex. Matches `foo.ext:NN` or `path/foo.ext:NN`.
 * Permissive on extensions (3+ alphanum chars). Excludes trailing punctuation.
 */
const FILE_LINE_REF_RE =
  /\b[\w./-]+\.(?:ts|tsx|js|jsx|py|md|go|rs|java|kt|scala|rb|cs|cpp|c|h|hpp|sql|yml|yaml|json|toml|sh|bash):\d+/g

/**
 * Split a plan into `{heading -> body}` sections. The heading is the full
 * `## Foo` line; the body is everything up to the next `## ` heading or EOF.
 * Sub-headings (`### Foo`) stay inside the parent section body.
 */
function splitSections(plan: string): Map<string, string> {
  const sections = new Map<string, string>()
  const matches = Array.from(plan.matchAll(SECTION_HEADING_RE))
  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i]![1]!.trim()
    const start = matches[i]!.index! + matches[i]![0].length
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : plan.length
    const body = plan.slice(start, end).trim()
    sections.set(heading, body)
  }
  return sections
}

/**
 * Count file:line refs across the design sections present in `sections`.
 */
function countLoadBearingRefs(sections: Map<string, string>): number {
  let count = 0
  for (const heading of DESIGN_SECTION_HEADINGS) {
    const body = sections.get(heading)
    if (!body) continue
    const matches = body.match(FILE_LINE_REF_RE)
    if (matches) count += matches.length
  }
  return count
}

/**
 * Extract the `Wrong if:` text from the Falsification section. Returns the
 * text after `Wrong if:` (trimmed) or null if no Wrong-if line found.
 */
function extractWrongIf(sections: Map<string, string>): string | null {
  const body = sections.get("## Falsification")
  if (!body) return null
  const m = /^[\s>*-]*Wrong if:\s*(.+?)$/im.exec(body)
  if (!m) return null
  return m[1]!.trim()
}

/**
 * Decide if a Wrong-if text is checkable. Permissive: any one of the
 * checkable tokens AND not matching a bare-hedge pattern AND not absurdly
 * short. A 12-char Wrong-if with no tokens fails.
 */
function isCheckableWrongIf(text: string | null): boolean {
  if (!text) return false
  const trimmed = text.trim()
  if (trimmed.length < 20) return false
  for (const re of BARE_HEDGE_PATTERNS) {
    if (re.test(trimmed)) return false
  }
  const lower = trimmed.toLowerCase()
  for (const tok of CHECKABLE_WRONG_IF_TOKENS) {
    if (lower.includes(tok)) return true
  }
  // Last-chance: file:line ref counts as checkable on its own.
  if (FILE_LINE_REF_RE.test(trimmed)) return true
  return false
}

/**
 * Count forbidden-phrase occurrences in design sections only. Bullets
 * elsewhere ("Out of Scope: this is more maintainable than ...") don't
 * count — only design sections.
 */
function countForbiddenPhrases(sections: Map<string, string>): number {
  let count = 0
  for (const heading of DESIGN_SECTION_HEADINGS) {
    const body = sections.get(heading)
    if (!body) continue
    const lower = body.toLowerCase()
    for (const phrase of FORBIDDEN_PHRASES) {
      let idx = lower.indexOf(phrase)
      while (idx !== -1) {
        count++
        idx = lower.indexOf(phrase, idx + phrase.length)
      }
    }
  }
  return count
}

/**
 * Return list of section headings whose body exceeds the per-section line
 * contract. Also flags Implementation Steps if any single step exceeds
 * IMPL_STEP_LINE_LIMIT lines.
 */
function findOversizedSections(sections: Map<string, string>): string[] {
  const oversized: string[] = []
  for (const [heading, body] of sections) {
    const limit = SECTION_LINE_LIMITS[heading]
    if (limit !== undefined) {
      const contentLines = body.split("\n").filter((l) => l.trim().length > 0)
      if (contentLines.length > limit) oversized.push(heading)
    }
  }
  // Implementation Steps: check per-step length.
  const implBody = sections.get("## Implementation Steps")
  if (implBody) {
    const stepStartRe = /^\s*(?:\d+\.|[-*])\s+/
    const lines = implBody.split("\n")
    let currentStepLines = 0
    let inStep = false
    for (const line of lines) {
      if (stepStartRe.test(line)) {
        if (inStep && currentStepLines > IMPL_STEP_LINE_LIMIT) {
          oversized.push("## Implementation Steps")
          return oversized
        }
        inStep = true
        currentStepLines = 1
      } else if (inStep) {
        if (line.trim().length > 0) currentStepLines++
      }
    }
    if (inStep && currentStepLines > IMPL_STEP_LINE_LIMIT) {
      oversized.push("## Implementation Steps")
    }
  }
  return oversized
}

/**
 * Count Insufficient claims in Existing Solutions Check that lack a named
 * constraint. The check is per-bullet: a bullet containing "Insufficient"
 * must also contain at least one CONSTRAINT_KEYWORD on the same line, OR
 * the bullet text after "Insufficient:" must be substantial enough
 * (>= 40 chars) to plausibly name a constraint inline.
 */
function countUngroundedInsufficiencies(sections: Map<string, string>): number {
  const body =
    sections.get("## Existing Solutions Check") ??
    sections.get("## Existing Solutions Check (re-affirmed)")
  if (!body) return 0
  let count = 0
  const bulletRe = /^\s*[-*]\s+(.+)$/gm
  for (const m of body.matchAll(bulletRe)) {
    const bullet = m[1]!
    const insufficientMatch = /\binsufficient\s*:\s*(.+)$/i.exec(bullet)
    if (!insufficientMatch) continue
    const reason = insufficientMatch[1]!.trim()
    // Constraint keyword check is scoped to the REASON text after
    // "Insufficient:" — not the full bullet, which can mention the
    // mechanism name (e.g. "APIRouter") that happens to contain a
    // keyword substring (e.g. "api"). Word-boundary match in the reason.
    const reasonLower = reason.toLowerCase()
    const hasKeyword = CONSTRAINT_KEYWORDS.some((k) => {
      const re = new RegExp(`\\b${k}\\b`, "i")
      return re.test(reasonLower)
    })
    if (hasKeyword) continue
    if (reason.length >= 40) continue
    count++
  }
  return count
}

/**
 * Check whether the plan acknowledges any prior contradicted prediction.
 * Heuristic: scan design sections for either a P# reference (P1, P2 …) OR
 * "previously assumed" / "contradicted" / "earlier prediction" language.
 *
 * Vacuously true when state.predictionsContradicted is 0 — no outstanding
 * debt to acknowledge.
 */
function checkContradictionAcknowledged(
  sections: Map<string, string>,
  predictionsContradicted: number,
): boolean {
  if (predictionsContradicted <= 0) return true

  const acknowledgmentPatterns: RegExp[] = [
    /\bP\d+\b/, // P1, P2, ...
    /\bpreviously assumed\b/i,
    /\bcontradicted\b/i,
    /\bearlier prediction\b/i,
    /\bprediction (?:p\d+|was)\b/i,
    /\breconciliation\b/i,
    /\bcorrected (?:assumption|prediction)\b/i,
  ]

  for (const heading of DESIGN_SECTION_HEADINGS) {
    const body = sections.get(heading)
    if (!body) continue
    for (const re of acknowledgmentPatterns) {
      if (re.test(body)) return true
    }
  }
  return false
}

/**
 * Public entry point. Compute all six signals from a rendered plan.
 *
 * @param plan      The plan output as rendered by the plan subagent.
 * @param taskType  The captured task type (drives nothing in v0.23 — every
 *                  design section is scanned regardless — but reserved for
 *                  v0.24+ when per-task-type thresholds may diverge).
 * @param state     ArcState for the workflow; only `predictionsContradicted`
 *                  is read.
 */
export function measurePlanQuality(
  plan: string,
  _taskType: TaskType,
  state: ArcState,
): PlanQualitySignals {
  const sections = splitSections(plan)
  const loadBearingRefs = countLoadBearingRefs(sections)
  const wrongIfText = extractWrongIf(sections)
  const checkableWrongIf = isCheckableWrongIf(wrongIfText)
  const forbiddenPhraseCount = countForbiddenPhrases(sections)
  const oversizedSections = findOversizedSections(sections)
  const ungroundedInsufficiencies = countUngroundedInsufficiencies(sections)
  const predictionsContradicted = state.predictionsContradicted ?? 0
  const contradictionAcknowledged = checkContradictionAcknowledged(
    sections,
    predictionsContradicted,
  )

  return {
    loadBearingRefs,
    grounded: loadBearingRefs >= 1,
    checkableWrongIf,
    forbiddenPhraseCount,
    oversizedSections,
    ungroundedInsufficiencies,
    contradictionAcknowledged,
  }
}
