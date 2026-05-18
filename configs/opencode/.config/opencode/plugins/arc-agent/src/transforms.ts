/**
 * Semantic transforms. Each one is a single helper-model call with a tightly
 * constrained prompt. No regex parsing; we trust the model output as-given
 * and feed it into the downstream consumer.
 *
 * A cheap heading-level substring scan acts as a PRE-FILTER (not a transform)
 * to avoid invoking the model when there's clearly nothing to strip.
 */

import type { createOpencodeClient } from "@opencode-ai/sdk"

import { helperCall } from "./helper"

type Client = ReturnType<typeof createOpencodeClient>

/** Helper-call timeouts. Strip is often a no-op so we fail-fast; compress
 *  is unconditionally valuable when triggered so we give it more headroom. */
export const STRIP_TIMEOUT_MS = 30_000
export const COMPRESS_TIMEOUT_MS = 90_000

/**
 * Phrases that, when appearing as part of a markdown heading line, indicate
 * a section the strip transform may want to remove. The list is conservative:
 * only canonical phrasings the orchestrator and subagent markdown files emit.
 *
 * Matching is substring on lowercased heading lines — no regex.
 */
const CANDIDATE_HEADINGS = [
  "open question",
  "open issues",
  "clarification",
  "questions for user",
  "questions for the user",
  "pending decision",
  "pending question",
] as const

/**
 * Pre-filter: does the text contain any markdown heading line (`#`-prefixed)
 * whose lowercased text contains a candidate phrase?
 *
 * Returns false → safe to skip the strip helper.
 * Returns true → invoke strip helper (model decides semantically).
 *
 * Pure substring scan, O(n) once. No regex.
 */
export function hasCandidateHeading(text: string): boolean {
  for (const rawLine of text.split("\n")) {
    const trimmed = rawLine.trimStart()
    if (!trimmed.startsWith("#")) continue
    const lower = trimmed.toLowerCase()
    for (const h of CANDIDATE_HEADINGS) {
      if (lower.includes(h)) return true
    }
  }
  return false
}

const STRIP_OPEN_QUESTIONS_PROMPT = `
TASK: Strip any "Open Questions" / "Clarifications" / "Pending Decisions" /
"Questions for User" section from the text below. Such a section may be
introduced by a heading at any markdown level (#, ##, ###, ####) and ends
where the next same-or-higher-level heading begins, or at end-of-text.

Identify the section semantically — the title may be worded differently than
the canonical phrases above, but the intent (a list of questions asked of the
user that have already been answered) is what matters.

If no such section exists, return the text unchanged.

Return only the transformed text. No commentary, no markdown fences.

--- TEXT BEGIN ---
{TEXT}
--- TEXT END ---
`

const COMPRESS_PLAN_PROMPT = `
TASK: Compress the implementation plan below for a downstream reviewer that
has a limited context budget. Follow these rules EXACTLY:

1. Keep "## Edge Case → Handling Matrix" section VERBATIM (every row).
2. Keep "## Test Plan" section VERBATIM (every row).
3. Keep "## Scope & Goals" section VERBATIM.
4. Keep "## Verification" section VERBATIM.
5. For every other "##" section, replace its body with TWO sentences that
   capture the section's key decisions. The heading itself stays.

The matrix and test-plan tables are the reviewer's traceability anchors —
they MUST survive untouched.

Preserve the original section ORDER. Preserve markdown heading syntax.

Return only the compressed plan. No preamble, no commentary.

--- PLAN BEGIN ---
{TEXT}
--- PLAN END ---
`

export async function stripOpenQuestions(
  client: Client,
  sessionID: string,
  text: string,
  signal?: AbortSignal,
): Promise<string> {
  return helperCall({
    client,
    sessionID,
    label: "strip_open_questions",
    prompt: STRIP_OPEN_QUESTIONS_PROMPT.replace("{TEXT}", text),
    signal,
  })
}

export async function compressPlanForReview(
  client: Client,
  sessionID: string,
  plan: string,
  signal?: AbortSignal,
): Promise<string> {
  return helperCall({
    client,
    sessionID,
    label: "compress_plan",
    prompt: COMPRESS_PLAN_PROMPT.replace("{TEXT}", plan),
    signal,
  })
}

/**
 * Sanity check for compressed plan output. Returns reason for failure or null
 * if the output looks valid. Plugin treats failure as "fall back to original".
 *
 * Pure substring scan; no regex.
 */
export function compressSanityCheck(
  original: string,
  compressed: string,
): string | null {
  if (compressed.length === 0) return "empty output"
  if (compressed.length > original.length * 0.5)
    return `compression too small: ${compressed.length}/${original.length}`
  if (!compressed.includes("## Edge Case → Handling Matrix"))
    return "missing Edge Case Handling Matrix section"
  if (!compressed.includes("## Test Plan"))
    return "missing Test Plan section"
  return null
}
