/**
 * v0.26 — Mechanical violation detection for the orchestrator's plan output.
 *
 * Pure functions, no IO, no model calls. Each function takes the plan
 * markdown and returns whether a specific violation is present + evidence.
 *
 * The top-level `detectViolations()` runs all detectors and returns a
 * filtered list of violations, ranked by severity descending. The hook uses
 * this to record telemetry and suggested follow-up auditors in workflow notes.
 *
 * Design constraints:
 *   - High precision on saved validation matrices is the gate for shipping.
 *     False positives pollute telemetry and make follow-up analysis noisy.
 *   - Detectors must be robust to fenced code blocks (which may contain
 *     literal `## What I couldn't verify` examples without the plan
 *     actually having the section).
 *   - Detectors fire on plans only. The hook upstream is responsible for
 *     deciding the input IS a plan (via hasPlanHeading).
 *   - The `## Tool unavailability` short-plan shape is exempt from
 *     section-presence checks — it's a deliberate minimal output.
 */

import type { TaskType, Violation, ViolationKind } from "./types"

// --- Section-boundary helpers ----------------------------------------------

const FENCE_RE = /^```[\s\S]*?^```/gm
const HEADER_RE = /^(#{1,6})\s+(.+?)\s*$/gm

/**
 * Strip fenced code blocks so detectors can scan plan structure without
 * being fooled by literal markdown inside ``` examples.
 *
 * Preserves line structure (replaces fence content with blank lines of
 * equal count) so line-anchored regexes still match the same positions.
 */
function stripFencedBlocks(plan: string): string {
  return plan.replace(FENCE_RE, (match) => {
    const lines = match.split("\n").length
    return Array(lines).fill("").join("\n")
  })
}

/**
 * Check whether a heading exists at H2/H3 level (case-sensitive, anchored
 * to start-of-line, outside fenced blocks).
 */
function hasHeading(plan: string, heading: string): boolean {
  const stripped = stripFencedBlocks(plan)
  const re = new RegExp(`^#{2,3}\\s+${escapeRegex(heading)}\\b`, "m")
  return re.test(stripped)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Extract the body of a section (case-sensitive heading match). Returns
 * empty string if section not found.
 */
function sectionBody(plan: string, heading: string): string {
  const stripped = stripFencedBlocks(plan)
  // Note: we keep the original `plan` for evidence extraction but search
  // section boundaries on stripped version.
  const headerRe = new RegExp(`^(#{2,3})\\s+${escapeRegex(heading)}\\b.*$`, "m")
  const m = headerRe.exec(stripped)
  if (!m) return ""
  const start = m.index + m[0].length
  const level = m[1]!.length
  const rest = stripped.slice(start)
  // Find next heading at same-or-higher level
  const nextRe = new RegExp(`^#{1,${level}}\\s+`, "m")
  const next = nextRe.exec(rest)
  const body = next ? rest.slice(0, next.index) : rest
  return body.trim()
}

// --- Confidence-marker helpers ---------------------------------------------

const FINDINGS_SECTIONS = ["Findings", "Diagnosis", "Key Findings", "Predictions"]
const MARKER_RE = /✅|🔶|⚠️/g
const ESCAPE_NOTE_RE =
  /all (?:items|claims) above are direct-evidence/i

/**
 * Find the first marker-eligible Findings/Diagnosis section in the plan.
 * Returns null if none present. Otherwise returns the heading + body.
 */
function findFindingsSection(plan: string): { heading: string; body: string } | null {
  for (const h of FINDINGS_SECTIONS) {
    const body = sectionBody(plan, h)
    if (body.length > 0) return { heading: h, body }
  }
  return null
}

function countMarkers(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  const matches = text.match(MARKER_RE) ?? []
  for (const m of matches) {
    counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  return counts
}

// --- Compound-failure heuristics -------------------------------------------

// A heuristic for "≥2 distinct root-cause claims" in a Findings section.
// We look for repeated patterns of "root cause" / "factor" / "primary"
// markers, OR a numbered/bulleted list of ✅ items with each item appearing
// to name a distinct factor (length ≥ 60 chars after the marker).
const ROOT_CAUSE_PHRASES = [
  /\broot cause\s*\d+\b/gi,
  /\bfactor\s*\d+\b/gi,
  /\bprimary\b/gi,
  /\bsecondary\b/gi,
  /\btertiary\b/gi,
  /\bproblem\s*\d+\b/gi,
  /\bcause\s*\d+\b/gi,
]

function countDistinctRootCauseSignals(body: string): number {
  let total = 0
  for (const re of ROOT_CAUSE_PHRASES) {
    const matches = body.match(re)
    if (matches) total += matches.length
  }
  return total
}

/**
 * Heuristic: does this Findings section appear to describe ≥2 independent
 * root causes? Two signals:
 *   1. ROOT_CAUSE_PHRASES match count ≥ 2
 *   2. ≥ 3 ✅ markers in the section AND ≥ 2 of them are followed by
 *      a `**bold lead**` ≥ 30 chars (typical "Root cause N — …" shape)
 */
function looksLikeCompoundFailure(body: string): boolean {
  if (countDistinctRootCauseSignals(body) >= 2) return true
  // Pattern: ≥ 3 ✅ each followed by a bold lead of substantial text.
  const boldLeadPattern = /✅[^\n]*?\*\*[^*]{20,}\*\*/g
  const boldLeads = body.match(boldLeadPattern) ?? []
  return boldLeads.length >= 3
}

// --- Tool-unavailability short-plan sentinel -------------------------------

function isToolUnavailabilityPlan(plan: string): boolean {
  return hasHeading(plan, "Tool unavailability") || hasHeading(plan, "Provisional findings")
}

// --- Individual detectors --------------------------------------------------

/**
 * Detector 1: plan has an Assumptions section but no `## What I couldn't
 * verify` section.
 *
 * Rationale: v0.25.9 introduced this section as an "optional micro-section".
 * Opus adopted 12/12 on the matrix. Flash adopted 2/12. Mechanical detection
 * makes the gap observable without adding another model turn.
 *
 * Suppressed for: investigate plans where assumptions are absent (rare),
 * tool-unavailability short plans (the template differs).
 */
function detectMissingUnverifiedSection(plan: string): Violation | null {
  if (isToolUnavailabilityPlan(plan)) return null
  // Some kind of Assumptions section must exist.
  const hasAssumptions =
    hasHeading(plan, "Assumptions") ||
    hasHeading(plan, "Assumptions (please correct any that are wrong)") ||
    /^##\s+Assumptions/m.test(stripFencedBlocks(plan))
  if (!hasAssumptions) return null
  if (hasHeading(plan, "What I couldn't verify")) return null
  // Already present.
  return {
    kind: "missing-unverified-section",
    evidence: "Plan has `## Assumptions` but lacks `## What I couldn't verify` section.",
    suggestedSubagent: "unverified-auditor",
    severity: "med",
  }
}

/**
 * Detector 2: Findings/Diagnosis has 3+ uniform-✅ markers AND the escape
 * note ("All items above are direct-evidence ✅…") is missing.
 *
 * The v0.25.9 prompt mandates the escape note when uniform-✅ is legitimate
 * (e.g., structural-diff tasks). Adoption: 0/12 on Flash, 0/12 on Opus in
 * the v0.25.9 matrix. Cheap mechanical fix.
 */
function detectUniformMarkerNoEscapeNote(plan: string): Violation | null {
  if (isToolUnavailabilityPlan(plan)) return null
  const section = findFindingsSection(plan)
  if (!section) return null
  const counts = countMarkers(section.body)
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)
  const distinct = counts.size
  if (total < 3 || distinct !== 1) return null
  // Uniform with 3+ markers. Is the escape note present?
  if (ESCAPE_NOTE_RE.test(section.body)) return null
  return {
    kind: "uniform-marker-no-escape-note",
    evidence: `## ${section.heading} has ${total} uniform markers but no "All items above are direct-evidence" escape note.`,
    suggestedSubagent: "confidence-auditor",
    severity: "low",
  }
}

/**
 * Detector 3: Findings appears to describe a compound failure (≥2 distinct
 * root causes) but no `## Compound-failure notes` or `### Compound-failure
 * note` section is present.
 *
 * The v0.25.9 prompt added this as a recommendation. Adoption: 2/12 Opus,
 * 1/12 Flash on matrix. Higher-stakes correction → suggested auditor recorded
 * in telemetry for later analysis.
 */
function detectCompoundCausesNoNotes(plan: string): Violation | null {
  if (isToolUnavailabilityPlan(plan)) return null
  const section = findFindingsSection(plan)
  if (!section) return null
  if (!looksLikeCompoundFailure(section.body)) return null
  // Check both ## and ### level (Flash sometimes uses ###).
  const stripped = stripFencedBlocks(plan)
  if (
    /^#{2,3}\s+Compound[\s-]+failure\s+notes?\b/im.test(stripped)
  ) {
    return null
  }
  return {
    kind: "compound-causes-no-notes-section",
    evidence: `## ${section.heading} describes multiple root causes but no "## Compound-failure notes" section is present.`,
    suggestedSubagent: "compound-cause-auditor",
    severity: "high",
  }
}

// --- Top-level detector ----------------------------------------------------

/**
 * Run all detectors on the plan and return violations ranked
 * high → med → low.
 *
 * The hook caller is responsible for capping the number of violations
 * that trigger workflow_notes (v0.26 default: hard cap of 2).
 */
export function detectViolations(plan: string, _taskType: TaskType): Violation[] {
  const detectors = [
    detectMissingUnverifiedSection,
    detectUniformMarkerNoEscapeNote,
    detectCompoundCausesNoNotes,
  ]
  const violations: Violation[] = []
  for (const d of detectors) {
    const v = d(plan)
    if (v) violations.push(v)
  }
  // Sort by severity (high first, then med, then low).
  const order: Record<string, number> = { high: 0, med: 1, low: 2 }
  violations.sort((a, b) => order[a.severity]! - order[b.severity]!)
  return violations
}

// Re-exports for unit tests.
export const __internals = {
  stripFencedBlocks,
  hasHeading,
  sectionBody,
  findFindingsSection,
  countMarkers,
  looksLikeCompoundFailure,
  isToolUnavailabilityPlan,
}

export type { TaskType, Violation, ViolationKind }
