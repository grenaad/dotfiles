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
import {
  bucketFor,
  TRIVIALITY_TIERS,
  UNKNOWN_RESOLVABILITY,
  UNKNOWN_STATUSES,
  type PlanSizeBucket,
  type TrivialityTier,
  type NormalizedVerdict,
} from "./types"
import { predictionReconciliation, unknownsStatus } from "./workflow-memory"
import type { WorkflowMemoryState } from "./types"

/**
 * Parse the ## Task Type section emitted by frame.md. Returns null if absent
 * or unparseable.
 *
 * v0.23: also accepts inline shapes that DeepSeek occasionally emits when
 * compressing the output:
 *   - `## Task Type` heading followed by `feature` on a later line (original)
 *   - `## Task Type` heading with `feature` on the same line: `## Task Type: feature`
 *   - Inline `Task Type: feature` bullet without a heading
 *   - Inline `**Task Type**: feature` bold bullet
 *
 * The match is anchored on the first occurrence of a recognized shape; later
 * occurrences are ignored.
 */
export function extractTaskType(framing: string): TaskType | null {
  const lines = framing.split("\n")

  // Pass 1: full ## Task Type heading (original behavior).
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
    if (trimmed === "") continue
    if (trimmed.startsWith("#")) break
    // Strip leading bullet markers, code-fence backticks, and bold markers
    // before tokenizing. DeepSeek often emits e.g. "`feature`" or "- feature".
    const cleaned = trimmed.replace(/^[-*]\s+/, "").replace(/[`*_]/g, "").trim()
    const firstToken = cleaned.split(/[\s|<>]/)[0]?.toLowerCase().trim() ?? ""
    if (isTaskType(firstToken)) return firstToken
    break
  }

  // Pass 2: inline shapes. Match the FIRST occurrence (frame's output
  // typically declares task type once; alternatives/plan templates also use
  // the phrase but those don't appear in frame's own output).
  //
  // Permissive regex: optional leading `## ` heading, optional bold markers,
  // optional colon, then one of the known task type tokens. We require the
  // word "Task Type" or "## Task Type" near the start of the matched line.
  const inlineRe =
    /^(?:#{1,4}\s+)?(?:[*_]{0,2})?\s*Task Type(?:[*_]{0,2})?\s*[:=]\s*(?:[`*_]{0,2})?\s*(feature|fix|refactor|investigate|docs)\b/im
  const m = inlineRe.exec(framing)
  if (m) {
    const token = m[1]!.toLowerCase()
    if (isTaskType(token)) return token
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
    return TRIVIALITY_TIERS.ultra
  }

  // Tier 2 TRIVIAL: simple feature/fix, short, no architectural keywords, no resolved clarifications
  if (
    (taskType === "feature" || taskType === "fix") &&
    wc <= 20 &&
    !hasFullKeyword &&
    !hasResolvedClarifications
  ) {
    return TRIVIALITY_TIERS.trivial
  }

  // Tier 3 FULL: everything else
  return TRIVIALITY_TIERS.full
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

/**
 * v0.24 — Deterministic scope-guard verdict.
 *
 * Compares the original ask (restater output) against the latest artifact
 * (plan, alternatives, etc.) via token-set overlap. The common "no drift"
 * case is a token-overlap ratio of the original-ask-tokens that appear in
 * the latest-artifact tokens. We default to ≥0.8 — strict enough to flag
 * genuine scope expansion, loose enough to accept implementation-token
 * introductions ("def fix() ..." that don't appear in the ask).
 *
 * Returns `"in-scope"` when the deterministic check is confident the
 * verdict will be ✅ In scope. Returns `"ambiguous"` otherwise — caller
 * dispatches the LLM-side scope-guard for the harder cases.
 */
export function computeScopeGuardVerdict(
  originalAsk: string,
  latestArtifact: string,
  thresholdRatio = 0.6,
): "in-scope" | "ambiguous" {
  if (!originalAsk || !latestArtifact) return "ambiguous"
  const askTokens = tokenize(originalAsk)
  const artifactTokens = new Set(tokenize(latestArtifact))
  if (askTokens.size === 0) return "ambiguous"
  let overlap = 0
  for (const tok of askTokens) {
    if (artifactTokens.has(tok)) overlap++
  }
  const ratio = overlap / askTokens.size
  return ratio >= thresholdRatio ? "in-scope" : "ambiguous"
}

/**
 * Lowercase + strip punctuation + split on whitespace; drop stopwords +
 * tokens shorter than 3 chars. Returns unique token set.
 */
function tokenize(text: string): Set<string> {
  const STOPWORDS = new Set([
    "the", "and", "for", "with", "that", "this", "from", "into", "your",
    "have", "has", "had", "are", "was", "were", "will", "would", "should",
    "could", "can", "may", "might", "must", "but", "not", "any", "all",
    "use", "uses", "using", "used", "via", "per", "out", "off", "see",
  ])
  const tokens = new Set<string>()
  const cleaned = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, " ")
  for (const raw of cleaned.split(/\s+/)) {
    const t = raw.trim()
    if (t.length < 3) continue
    if (STOPWORDS.has(t)) continue
    tokens.add(t)
  }
  return tokens
}

/**
 * v0.24 — Deterministic unknowns-auditor verdict.
 *
 * Reads workflow memory directly (no LLM call). Mirrors the verdict logic
 * in agents/unknowns-auditor.md:
 *
 *   - ALL_RESOLVED: no opens, or no unknowns declared.
 *   - OPEN_UNKNOWNS_REMAIN: at least one S:open + R:pre_design.
 *   - USER_INPUT_REQUIRED: at least one S:open + R:user_input (no pre_design).
 *   - DEFERRED_ACCEPTABLE: all opens are R:accept_risk OR have been deferred.
 *   - UNCLASSIFIED: returns null so the orchestrator falls back to LLM.
 *
 * Returns null when the workflow memory has any open unknowns whose
 * resolvability we couldn't parse — caller should dispatch the LLM-side
 * auditor for the edge case.
 */
export type UnknownsVerdict =
  | "ALL_RESOLVED"
  | "OPEN_UNKNOWNS_REMAIN"
  | "USER_INPUT_REQUIRED"
  | "DEFERRED_ACCEPTABLE"

export function computeUnknownsVerdict(
  memory: WorkflowMemoryState | undefined,
): UnknownsVerdict | null {
  if (!memory) return "ALL_RESOLVED"
  const report = unknownsStatus(memory)
  const total =
    report.open.length +
    report.resolved.length +
    report.deferred.length +
    report.unparseable.length
  if (total === 0) return "ALL_RESOLVED"
  if (report.unparseable.length > 0) return null

  // Order matters: pre_design > user_input > accept_risk
  const openPreDesign = report.open.filter(
    (e) => e.resolvability === UNKNOWN_RESOLVABILITY.pre_design,
  )
  if (openPreDesign.length > 0) return "OPEN_UNKNOWNS_REMAIN"

  const openUserInput = report.open.filter(
    (e) => e.resolvability === UNKNOWN_RESOLVABILITY.user_input,
  )
  if (openUserInput.length > 0) return "USER_INPUT_REQUIRED"

  // Any remaining opens (no resolvability or accept_risk) → DEFERRED_ACCEPTABLE
  const openOther = report.open.filter(
    (e) =>
      e.status === UNKNOWN_STATUSES.open &&
      e.resolvability !== UNKNOWN_RESOLVABILITY.pre_design &&
      e.resolvability !== UNKNOWN_RESOLVABILITY.user_input,
  )
  if (openOther.length === 0) return "ALL_RESOLVED"
  return "DEFERRED_ACCEPTABLE"
}

/**
 * v0.24 — Detect whether all predictions are trivially confirmed (no
 * reconciliation work needed).
 *
 * Returns true when:
 *   - At least one prediction exists in memory.
 *   - Every prediction has a matching observation note with
 *     verdict=confirmed AND non-empty evidence.
 *
 * False otherwise (any contradicted / inconclusive / unobserved, or no
 * predictions at all). Caller skips the LLM-side synthesis reconciliation
 * sub-step when this returns true.
 */
export function predictionsAllTriviallyConfirmed(
  memory: WorkflowMemoryState | undefined,
): boolean {
  if (!memory) return false
  const recon = predictionReconciliation(memory)
  if (recon.confirmed.length === 0) return false
  if (recon.contradicted.length > 0) return false
  if (recon.inconclusive.length > 0) return false
  if (recon.unobserved.length > 0) return false
  // All predictions must have non-empty evidence to count as "trivially" confirmed.
  for (const c of recon.confirmed) {
    if (!c.evidence || c.evidence.trim().length === 0) return false
  }
  return true
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
