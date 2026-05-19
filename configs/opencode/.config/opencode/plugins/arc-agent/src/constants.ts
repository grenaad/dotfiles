/**
 * Shared text constants injected into every subagent prompt.
 *
 * Centralizing here means changing the preamble or reasoning conventions
 * happens in ONE place — orchestrator.md no longer carries the canonical
 * version. The plugin's tool.execute.before auto-prepends these to every
 * subagent prompt (Phase 5 — TS leverage G).
 *
 * These constants are tuned for DeepSeek (decompose-upfront, synthesize-late
 * reasoning shape). arc-agent's primary agents (orchestrator, quick-answer)
 * and all 13 subagents are DeepSeek-only by design. Opus users should use
 * OpenCode's built-in build/plan agents instead.
 */

export const DELEGATION_PREAMBLE = `PLANNING MODE — read-only. Do not write, edit, or create files. Do not run implementation commands. Your output is research, analysis, or planning text. Another agent or the user decides execution later. If about to mutate the filesystem or run a build/test command, STOP and describe what you would do instead.

WORK SHAPE (DeepSeek):
1. Decompose the ask into named sub-problems upfront before reasoning on them.
2. State assumptions explicitly; do not silently commit.
3. Synthesize at the end in one substantial pass — large reasoning blocks are correct here, not bloat.
4. Prefer structured artifacts (headers, lists, tables) over prose paragraphs where the content is structurable.`

export const REASONING_CONVENTIONS = `REASONING CONVENTIONS:
- Decompose first: open with a 2-5 item sub-problem list. Attack them in order. Don't start synthesizing before decomposing.
- Block sizing: reasoning blocks of 500-2000 chars are correct for DeepSeek; do NOT artificially fragment into micro-thoughts. ONE long synthesis pass at the end is the right shape.
- Self-correction tokens: if mid-reasoning you realize an earlier statement was wrong, write "Wait — <correction>" or "Actually — <revised view>". Do NOT silently revise.
- Key insight call-out: when you reach the load-bearing realization that justifies a decision, mark it on its own line as **Key insight**: <single sentence>.
- Forward handoff: end each major section with one line — "Next: <specific action>". Never trail off.
- Concrete anchoring: cite file paths, line numbers, function names, version numbers, or literal output. Vague claims ("recent changes", "various functions") are unusable downstream.
- Named alternatives as a list: when picking a design or approach, output a named-tradeoffs LIST (not prose) of 2-3 alternatives. State why each rejected; state why one picked. Single-path reasoning without rejected alternatives is incomplete.
- Structured output: where the consumer is another subagent, prefer tables or bullet lists with explicit fields over narrative paragraphs.`

/** Single-line markers used to detect already-injected preambles. */
export const PREAMBLE_MARKER = "PLANNING MODE — read-only"
export const CONVENTIONS_MARKER = "REASONING CONVENTIONS:"

/**
 * Verdict-gate question structure — emitted by plugin so orchestrator
 * doesn't have to construct the same options every time (Phase 8 — TS leverage F).
 */
export const VERDICT_GATE_QUESTION_OPTIONS = [
  {
    label: "Show me plan anyway (Recommended)",
    description: "Display the plan and critique as-is. I will decide what to do.",
  },
  {
    label: "Re-run planner with critique",
    description: "Fold reviewer feedback into a single re-planning pass. Capped at one retry.",
  },
  {
    label: "Cancel — back to drawing board",
    description: "Stop here. I will restart with refined inputs.",
  },
] as const

/** Machine-readable marker injected before the plan when sections are missing. */
export const REQUIRED_SECTIONS_MARKER_PREFIX = "<!-- arc-agent: missing-required-section "
export const REQUIRED_SECTIONS_MARKER_SUFFIX = " -->"
export const REQUIRED_SECTIONS_BLOCK_HEADER = "<!-- arc-agent: required-section-check"
export const REQUIRED_SECTIONS_BLOCK_FOOTER = "<!-- arc-agent: end-required-section-check -->"
