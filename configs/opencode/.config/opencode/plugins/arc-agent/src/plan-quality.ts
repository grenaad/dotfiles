/**
 * Plan-quality measurement.
 *
 * Inspects the rendered plan markdown and emits heuristic signals describing
 * how "load-bearing" vs "form-filled" the plan is. All signals are advisory;
 * nothing here gates a plan — the reviewer subagent remains the sole verdict
 * authority.
 *
 * v0.25.1: dropped signals tied to deprecated subagents:
 *   - ungroundedInsufficiencies (frame's Existing Solutions Check section)
 *   - contradictionAcknowledged (synthesis prediction reconciliation)
 *
 * Kept 4 signals:
 *   1. loadBearingRefs       — count of file:line refs in design sections
 *   2. checkableWrongIf      — Falsification Wrong-if names a real check
 *   3. forbiddenPhraseCount  — bare-justification phrase count
 *   4. oversizedSections     — sections exceeding length contract
 */

import type { TaskType } from "./types"

export interface PlanQualitySignals {
  loadBearingRefs: number
  grounded: boolean
  checkableWrongIf: boolean
  forbiddenPhraseCount: number
  oversizedSections: string[]
}

const DESIGN_SECTION_HEADINGS = [
  "## Architecture Decisions",
  "## Implementation Steps",
  "## Fix Strategy",
  "## Target Shape",
  "## Migration Steps",
  "## Recommendation",
  "## Change Set",
  "## Root Cause",
] as const

const SECTION_LINE_LIMITS: Record<string, number> = {
  "## Architecture Decisions": 25,
  "## Fix Strategy": 20,
  "## Target Shape": 25,
  "## Recommendation": 20,
  "## Falsification": 4,
}

const IMPL_STEP_LINE_LIMIT = 10

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
  "is greater than",
  "is less than",
  ">",
  "<",
  "==",
  "!=",
] as const

const BARE_HEDGE_PATTERNS = [
  /\bdesign is (wrong|flawed|incorrect|bad)\b/i,
  /\bapproach is (wrong|flawed|incorrect|bad)\b/i,
  /\bsolution is (wrong|flawed|incorrect|bad)\b/i,
  /\bthis is (wrong|flawed|incorrect|bad)\b/i,
  /\bplan is (wrong|flawed|incorrect|bad)\b/i,
  /\bfix is (wrong|flawed|incorrect|bad)\b/i,
] as const

const SECTION_HEADING_RE = /^(##\s+[^\n]+)$/gm

const FILE_LINE_REF_RE =
  /\b[\w./-]+\.(?:ts|tsx|js|jsx|py|md|go|rs|java|kt|scala|rb|cs|cpp|c|h|hpp|sql|yml|yaml|json|toml|sh|bash):\d+/g

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

function extractWrongIf(sections: Map<string, string>): string | null {
  const body = sections.get("## Falsification")
  if (!body) return null
  const m = /^[\s>*-]*(?:\*\*)?Wrong if(?:\*\*)?\s*:\s*(.+?)$/im.exec(body)
  if (!m) return null
  return m[1]!.trim()
}

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
  if (FILE_LINE_REF_RE.test(trimmed)) return true
  return false
}

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

function findOversizedSections(sections: Map<string, string>): string[] {
  const oversized: string[] = []
  for (const [heading, body] of sections) {
    const limit = SECTION_LINE_LIMITS[heading]
    if (limit !== undefined) {
      const contentLines = body.split("\n").filter((l) => l.trim().length > 0)
      if (contentLines.length > limit) oversized.push(heading)
    }
  }
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
 * Compute the 4 plan-quality signals from a rendered plan.
 *
 * @param plan      The plan output text.
 * @param _taskType Captured task type — reserved for future per-type tuning.
 */
export function measurePlanQuality(
  plan: string,
  _taskType: TaskType,
): PlanQualitySignals {
  const sections = splitSections(plan)
  const loadBearingRefs = countLoadBearingRefs(sections)
  const wrongIfText = extractWrongIf(sections)
  const checkableWrongIf = isCheckableWrongIf(wrongIfText)
  const forbiddenPhraseCount = countForbiddenPhrases(sections)
  const oversizedSections = findOversizedSections(sections)

  return {
    loadBearingRefs,
    grounded: loadBearingRefs >= 1,
    checkableWrongIf,
    forbiddenPhraseCount,
    oversizedSections,
  }
}
