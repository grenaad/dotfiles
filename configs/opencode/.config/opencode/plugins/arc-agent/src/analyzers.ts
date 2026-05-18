/**
 * Deterministic analyzers — pure functions, no model calls, no IO.
 *
 * These power the TS-leverage phases:
 *   - extractTaskType: parse frame output for ## Task Type (Phase 3 dependency)
 *   - checkRequiredSections: detect missing required headings (Phase 4)
 *   - classifyTriviality: tier classifier for Step 1.6 fast-path (Phase 6)
 *   - extractOpenQuestions: parse Open Questions sections (Phase 7)
 *   - normalizeVerdict: reviewer verdict normalization (Phase 8)
 *   - planSizeAdvisory: bucket-based plan-size advisory text (Phase 8)
 *
 * All matchers use line-based scanning, NOT regex on free text. Inputs are
 * lowercased + trimmed where appropriate before comparison.
 */

import { isTaskType, type TaskType } from "./templates"
import { bucketFor, type PlanSizeBucket, type TrivialityTier, type NormalizedVerdict } from "./types"

/** Parse the ## Task Type section emitted by frame.md. Returns null if absent or unparseable. */
export function extractTaskType(framing: string): TaskType | null {
  const lines = framing.split("\n")
  let inTaskTypeSection = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()
    if (!inTaskTypeSection) {
      if (/^#{1,4}\s*Task Type\s*$/i.test(trimmed)) {
        inTaskTypeSection = true
      }
      continue
    }
    // We're in the section — first non-blank, non-heading line is the answer
    if (trimmed === "") continue
    if (trimmed.startsWith("#")) break
    // trimmed may be "feature" or "feature  -- justification follows"
    const firstToken = trimmed.split(/[\s|<>]/)[0]?.toLowerCase().trim() ?? ""
    if (isTaskType(firstToken)) return firstToken
    break
  }
  return null
}

/** Return required section headings missing from `plan` for the given task type. */
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
 * Verb patterns that imply implementation work (NOT trivial).
 * Conservative list — only canonical imperatives.
 */
const IMPLEMENTATION_VERBS = [
  "create",
  "add",
  "fix",
  "write",
  "build",
  "refactor",
  "migrate",
  "rename",
  "implement",
  "scaffold",
  "set up",
  "setup",
  "configure",
  "integrate",
  "extract",
  "split",
] as const

/** Heuristic verb scan: returns true if user prompt contains any implementation verb. */
export function hasImplementationVerb(userPrompt: string): boolean {
  const lower = userPrompt.toLowerCase()
  for (const v of IMPLEMENTATION_VERBS) {
    // word boundary check via padded match
    if (lower.includes(` ${v} `) || lower.startsWith(`${v} `) || lower.includes(` ${v}.`) || lower.includes(` ${v},`)) {
      return true
    }
  }
  return false
}

/** Crude word-count heuristic — splits on whitespace. */
export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Triviality classifier — port of orchestrator Step 1.6 prose.
 *
 * Tier rules (FIRST MATCHING TIER WINS):
 *   - ultra: task type is investigate AND no implementation verb AND prompt ≤ 30 words
 *   - trivial: task type is feature/fix AND prompt ≤ 20 words AND no implementation verb on architectural keywords
 *   - full: everything else
 *
 * Pure heuristic — orchestrator can still override via clarifications.
 */
export function classifyTriviality(args: {
  taskType: TaskType | null
  userPrompt: string
  hasResolvedClarifications: boolean
}): TrivialityTier {
  const { taskType, userPrompt, hasResolvedClarifications } = args
  const wc = wordCount(userPrompt)
  const hasVerb = hasImplementationVerb(userPrompt)
  const lower = userPrompt.toLowerCase()
  const FULL_WORKFLOW_KEYWORDS = [
    "application",
    "service",
    "api",
    "system",
    "architecture",
    "framework",
    "refactor",
    "migrate",
    "platform",
    "microservice",
  ]
  const hasFullKeyword = FULL_WORKFLOW_KEYWORDS.some((k) => lower.includes(k))

  // Tier 1 ULTRA: question-like investigation, no verb, short
  if (taskType === "investigate" && !hasVerb && wc <= 30 && !hasFullKeyword) {
    return "ultra"
  }

  // Tier 2 TRIVIAL: simple feature/fix, short, no architectural keywords, no resolved clarifications
  if (
    (taskType === "feature" || taskType === "fix") &&
    wc <= 20 &&
    !hasFullKeyword &&
    !hasResolvedClarifications
  ) {
    return "trivial"
  }

  // Tier 3 FULL: everything else
  return "full"
}

/**
 * Parse Open Questions sections from a subagent's markdown output.
 *
 * Looks for headings matching `## Open Questions`, `## Clarifications`,
 * `## Questions for User`, `## Questions for the User`. For each found,
 * extracts bullets/lines until the next same-or-higher level heading.
 *
 * Returns an array of question strings. Empty if no section or section
 * contains only placeholder text (None / N/A / —).
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
  ]

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    const hashMatch = /^(#{1,6})\s*(.+?)\s*$/.exec(trimmed)
    if (hashMatch) {
      const level = hashMatch[1]!.length
      const heading = hashMatch[2]!.toLowerCase()
      if (!inSection && HEADING_PHRASES.some((p) => heading === p || heading.startsWith(`${p} `))) {
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
      // bullets and numbered items
      const bulletMatch = /^[-*+]\s+(.+?)$/.exec(trimmed) ?? /^\d+\.\s+(.+?)$/.exec(trimmed)
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
      if (/^#{1,4}\s*Verdict\s*$/i.test(trimmed)) {
        inVerdictSection = true
      }
      continue
    }
    if (trimmed === "") continue
    if (trimmed.startsWith("#")) break
    const lower = trimmed.toLowerCase()
    // affirmative
    if (
      /^(approve|approved|ship[-_ ]?it|lgtm|ok|looks[-_ ]?good|ready|proceed)$/.test(lower)
    ) {
      return "proceed"
    }
    if (/^reject(ed)?$/.test(lower)) return "reject"
    if (
      /^(needs[-_ ]?revision|request[-_ ]?changes|blocked|revise)$/.test(lower)
    ) {
      return "needs-revision"
    }
    // Unknown wording — treat as needs-revision (conservative)
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
        return `Plan size: ${size} chars — significantly over budget. Plan will be compressed for review. Consider whether task scope can be reduced; continuing for now.`
      }
      return `Plan size: ${size} chars — over 20k threshold. Plan will be compressed before review forwarding. Proceeding to clarification check.`
  }
}
