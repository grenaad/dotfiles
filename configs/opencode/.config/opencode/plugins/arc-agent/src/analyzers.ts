/**
 * Deterministic analyzers — pure functions, no model calls, no IO.
 *
 * v0.25.1: trimmed to the functions still used post-Path-B. Dropped:
 *   - classifyTriviality (no more skip-stub gating)
 *   - computeScopeGuardVerdict / computeUnknownsVerdict
 *     / predictionsAllTriviallyConfirmed (no scope-guard / unknowns-auditor /
 *     synthesis subagents)
 *   - hasImplementationVerb / wordCount (only used by classifyTriviality)
 */

import {
  bucketFor,
  TASK_TYPE_VALUES,
  type NormalizedVerdict,
  type PlanSizeBucket,
  type TaskType,
} from "./types"

function isTaskType(v: unknown): v is TaskType {
  return typeof v === "string" && (TASK_TYPE_VALUES as readonly string[]).includes(v)
}

/**
 * Parse the `## Task Type` section emitted by an orchestrator plan output.
 * Also accepts inline shapes (e.g. `**Task type**: feature`).
 *
 * Returns null if the orchestrator's output doesn't declare a task type — in
 * which case plan-quality measurement falls back to defaults.
 */
export function extractTaskType(framing: string): TaskType | null {
  const lines = framing.split("\n")

  // Pass 1: full `## Task Type` heading.
  let inSection = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!inSection) {
      if (/^#{1,4}\s*Task Type\s*$/i.test(trimmed)) inSection = true
      continue
    }
    if (trimmed === "") continue
    if (trimmed.startsWith("#")) break
    const cleaned = trimmed.replace(/^[-*]\s+/, "").replace(/[`*_]/g, "").trim()
    const firstToken = cleaned.split(/[\s|<>]/)[0]?.toLowerCase().trim() ?? ""
    if (isTaskType(firstToken)) return firstToken
    break
  }

  // Pass 2: inline shapes (Task Type: <type> or **Task type**: <type>).
  const inlineRe =
    /^(?:#{1,4}\s+)?(?:[*_]{0,2})?\s*Task Type(?:[*_]{0,2})?\s*[:=]\s*(?:[`*_]{0,2})?\s*(feature|fix|refactor|investigate|docs)\b/im
  const m = inlineRe.exec(framing)
  if (m) {
    const token = m[1]!.toLowerCase()
    if (isTaskType(token)) return token
  }

  return null
}

/**
 * Detect a Plan-class heading anywhere in the assistant output. Used to
 * decide whether the current turn is the orchestrator's plan-draft turn
 * (triggers plan-quality measurement).
 *
 * Accepts: `# Plan`, `## Plan`, `# Plan: <title>`, `# Diagnosis & Fix Plan`,
 * `# Recommendation`, `## Recommendation`, `# Findings`, `# Comparison`.
 */
export function hasPlanHeading(text: string): boolean {
  if (!text) return false
  // Top-level heading containing plan/diagnosis/recommendation/findings/comparison
  if (/^#{1,3}[\t ].*(plan|diagnosis|recommendation|findings|comparison)\b/im.test(text))
    return true
  // Sub-heading variants
  if (/^#{2,3}[\t ]+(recommendation|plan|findings|conclusion)\b/im.test(text)) return true
  return false
}

/** Return required section headings missing from `plan`. */
export function checkRequiredSections(
  plan: string,
  requiredSections: readonly string[],
): string[] {
  const missing: string[] = []
  for (const heading of requiredSections) {
    if (!plan.includes(heading)) missing.push(heading)
  }
  return missing
}

/**
 * Parse Open Questions sections from output. Returns the list of questions
 * (each as a single string). Used by the orchestrator's clarification flow.
 */
export function extractOpenQuestions(text: string): string[] {
  const lines = text.split("\n")
  const questions: string[] = []
  let inSection = false
  let sectionHeadingLevel = 0

  const HEADING_PHRASES = [
    "open questions",
    "open question",
    "clarifications",
    "clarification",
    "questions for user",
    "questions for the user",
    "open decisions",
  ]

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    const hashMatch = /^(#{1,6})\s*(.+?)\s*$/.exec(trimmed)
    if (hashMatch) {
      const level = hashMatch[1]!.length
      const heading = hashMatch[2]!.toLowerCase()
      if (
        !inSection &&
        HEADING_PHRASES.some((p) => heading === p || heading.startsWith(`${p} `))
      ) {
        inSection = true
        sectionHeadingLevel = level
        continue
      }
      if (inSection && level <= sectionHeadingLevel) {
        inSection = false
        sectionHeadingLevel = 0
        continue
      }
    }
    if (inSection) {
      const bulletMatch =
        /^[-*+]\s+(.+?)$/.exec(trimmed) ?? /^\d+\.\s+(.+?)$/.exec(trimmed)
      if (bulletMatch) {
        const q = bulletMatch[1]!.trim()
        if (q && !["none", "n/a", "—", "-", ""].includes(q.toLowerCase())) {
          questions.push(q)
        }
      }
    }
  }
  return questions
}

/** Normalize reviewer verdict strings to one of three canonical values. */
export function normalizeVerdict(text: string): NormalizedVerdict | null {
  const lines = text.split("\n")
  let inVerdictSection = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!inVerdictSection) {
      if (/^#{1,4}\s*Verdict\s*$/i.test(trimmed)) inVerdictSection = true
      continue
    }
    if (trimmed === "") continue
    if (trimmed.startsWith("#")) break
    const lower = trimmed.toLowerCase()
    if (/^(approve|approved|ship[-_ ]?it|lgtm|ok|looks[-_ ]?good|ready|proceed)$/.test(lower))
      return "proceed"
    if (/^reject(ed)?$/.test(lower)) return "reject"
    if (/^(needs[-_ ]?revision|request[-_ ]?changes|blocked|revise)$/.test(lower))
      return "needs-revision"
    return "needs-revision"
  }
  return null
}

/** Generate the plan-size advisory line. Empty string when no advisory needed. */
export function planSizeAdvisory(size: number): string {
  const bucket: PlanSizeBucket = bucketFor(size)
  switch (bucket) {
    case "small":
    case "target":
      return ""
    case "above":
      return `Plan size: ${size} chars — above target (8k-15k). Proceeding to clarification check.`
    case "compress":
      if (size > 30_000) {
        return `Plan size: ${size} chars — significantly over budget. Plan will be compressed for review.`
      }
      return `Plan size: ${size} chars — over 20k threshold. Plan will be compressed before review forwarding.`
  }
}
