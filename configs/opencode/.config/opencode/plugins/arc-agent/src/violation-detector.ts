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

// --- Load-bearing-claim-without-citation detector --------------------------

/**
 * Sections where load-bearing claims live. We only scan these — claims in
 * `## Plan`, `## Implementation Steps`, etc. are forward-looking statements
 * about future work and should not be required to cite extant code.
 */
const CLAIM_SECTIONS = [
  "Findings",
  "Diagnosis",
  "Key Findings",
  "Predictions",
  "Constraints",
  "Risk",
  "Risks",
]

/**
 * Load-bearing modal verbs. A sentence containing one of these in an
 * assertive context is making a claim about the current code/system
 * that should be backed by a `file:line` citation.
 */
const LOAD_BEARING_RE =
  /\b(?:must|will|requires?|depends on|breaks if|fails when|cannot|always|never|currently|because|since)\b/i

/**
 * Citation shape: `path/to/file.ext` with optional `:line` or `:line-line`.
 * Same alphabet as FALSIFIER_FILE_RE but matched anywhere in the sentence.
 */
const CITATION_RE =
  /\b[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|swift|c|cpp|cc|h|hpp|md|toml|yaml|yml|json|sh|sql|graphql|proto|css|scss|html|vue|svelte|sav|ini|env|sln|csproj|gradle)(?::\d+(?:-\d+)?)?\b/

/**
 * Split body into sentence-like units. Markdown table cells and list items
 * count as separate units. We don't try to be perfect — false positives are
 * OK so long as the ratio threshold is conservative.
 */
function splitSentences(body: string): string[] {
  // First split on newline-bounded structure (list items, table rows, paragraphs).
  const lines = body.split(/\n+/)
  const out: string[] = []
  for (const line of lines) {
    let trimmed = line.trim()
    if (!trimmed) continue
    // Skip headings, fences, blockquote, separator-only lines (--- or ===)
    if (/^(#|```|>|---+\s*$|===+\s*$)/.test(trimmed)) continue
    // Skip pure markdown table rows (|---|---|)
    if (/^\|[\s\-:|]+\|?\s*$/.test(trimmed)) continue
    // Strip leading list marker (-, *, +, 1., 1)) or table-cell pipe
    trimmed = trimmed.replace(/^([-*+]\s+|\d+[.)]\s+|\|\s*)/, "")
    if (!trimmed) continue
    // Then split on sentence terminators
    const parts = trimmed.split(/(?<=[.!?])\s+(?=[A-Z✅🔶⚠️])/)
    for (const p of parts) {
      const t = p.trim()
      if (t.length >= 20) out.push(t)
    }
  }
  return out
}

/**
 * Detector 4 (v0.26.11): the agent makes load-bearing claims in the
 * Findings/Diagnosis section without grounding them in file:line citations.
 *
 * Rationale (from v0.26.11 gap-analysis): evidence_quality was the only
 * judge-rubric axis with a meaningful cohort-mean gap to Opus-full
 * (+0.50 / 10% of max). Opus tends to cite `file.py:123` for each
 * load-bearing assertion; Flash sometimes asserts without citation.
 *
 * Threshold: if there are ≥3 load-bearing sentences in claim sections
 * AND ≥50% of them lack a citation in the same sentence, emit a warning.
 *
 * Suppressed for: tool-unavailability short plans, or plans where
 * Findings is purely a question list (no assertions).
 */
function detectLoadBearingClaimsWithoutCitation(plan: string): Violation | null {
  if (isToolUnavailabilityPlan(plan)) return null
  const stripped = stripFencedBlocks(plan)
  let combined = ""
  for (const h of CLAIM_SECTIONS) {
    const body = sectionBody(stripped, h)
    if (body) combined += "\n\n" + body
  }
  if (!combined.trim()) return null

  const sentences = splitSentences(combined)
  if (sentences.length < 3) return null

  let loadBearing = 0
  let uncited = 0
  const uncitedSamples: string[] = []

  for (const s of sentences) {
    if (!LOAD_BEARING_RE.test(s)) continue
    // Skip pure questions
    if (s.trim().endsWith("?")) continue
    // Skip sentences that explicitly mark themselves as assumption/hypothesis
    if (/^(if |assuming |hypothesis|maybe |perhaps )/i.test(s.trim())) continue
    loadBearing += 1
    if (!CITATION_RE.test(s)) {
      uncited += 1
      if (uncitedSamples.length < 3) {
        uncitedSamples.push(s.slice(0, 120).replace(/\s+/g, " "))
      }
    }
  }

  if (loadBearing < 3) return null
  const ratio = uncited / loadBearing
  if (ratio < 0.5) return null

  return {
    kind: "load-bearing-claim-no-citation",
    severity: "low",
    evidence:
      `${uncited}/${loadBearing} load-bearing claims in Findings/Diagnosis lack file:line citations. Examples: ` +
      uncitedSamples.map((s) => `"${s}…"`).join(" | "),
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
    detectLoadBearingClaimsWithoutCitation,
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

/**
 * v0.26.7 — detect Falsification bullets referencing files the orchestrator
 * never opened. Soft-mode: returns a violation; the pipeline writes a note
 * but does not rewrite the plan.
 *
 * Algorithm:
 *   1. Extract `## Falsification` section body (case-sensitive).
 *   2. Regex out file-like tokens: `<word>.<ext>` with optional `:<line>` suffix.
 *   3. For each token, check whether it (or its basename) appears in
 *      `readFiles`. If none of the falsifier file refs were read, the
 *      falsifier is vestigial.
 *   4. Skip if Falsification section is empty or contains no file refs
 *      (a non-file-shaped falsifier like "wrong if behavior X" is fine).
 */
const FALSIFIER_FILE_RE = /\b[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|swift|c|cpp|cc|h|hpp|md|toml|yaml|yml|json|sh|sql|graphql|proto|css|scss|html|vue|svelte)(?::\d+(?:-\d+)?)?\b/g

export function detectFalsifierUnreadFiles(plan: string, readFiles: Set<string> | undefined): Violation | null {
  if (!readFiles || readFiles.size === 0) return null
  const body = sectionBody(plan, "Falsification")
  if (!body) return null
  const refs = new Set<string>()
  let m: RegExpExecArray | null
  FALSIFIER_FILE_RE.lastIndex = 0
  while ((m = FALSIFIER_FILE_RE.exec(body)) !== null) {
    const raw = m[0].split(":")[0]!
    refs.add(raw)
  }
  if (refs.size === 0) return null
  // Resolve each ref: it's "read" if either the full path or basename appears
  // in readFiles.
  const unread: string[] = []
  for (const ref of refs) {
    const base = ref.split("/").pop() ?? ref
    if (!readFiles.has(ref) && !readFiles.has(base)) {
      unread.push(ref)
    }
  }
  if (unread.length === 0) return null
  return {
    kind: "falsifier-references-unread-file",
    severity: "med",
    evidence: `Falsification references unread files: ${unread.slice(0, 5).join(", ")}${unread.length > 5 ? ` (+${unread.length - 5} more)` : ""}`,
  }
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
  detectLoadBearingClaimsWithoutCitation,
  splitSentences,
}

export type { TaskType, Violation, ViolationKind }
