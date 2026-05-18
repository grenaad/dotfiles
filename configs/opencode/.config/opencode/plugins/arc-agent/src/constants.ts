/**
 * Shared text constants injected into every subagent prompt.
 *
 * Centralizing here means changing the preamble or reasoning conventions
 * happens in ONE place — orchestrator.md no longer carries the canonical
 * version. The plugin's tool.execute.before auto-prepends these to every
 * subagent prompt (Phase 5 — TS leverage G).
 */

export const DELEGATION_PREAMBLE = `PLANNING MODE — read-only. Do not write, edit, or create files. Do not run implementation
commands. Your output is research, analysis, or planning text only. Another agent or the
user will decide whether to execute later. If you are about to take an action that modifies
the filesystem or runs a build/test command, STOP and instead describe what you would do.`

export const REASONING_CONVENTIONS = `REASONING CONVENTIONS:
- Length discipline: default 3-6 lines per reasoning chunk. Use longer ONLY for architectural decisions, multi-option tradeoffs, or post-tool synthesis. If you find yourself padding, stop and produce the decision.
- Self-correction tokens: if mid-reasoning you realize an earlier statement was wrong, write "Wait — <correction>" or "Actually — <revised view>". Do NOT silently revise. Surfacing the correction lets the reader follow your reasoning.
- Key insight call-out: when you reach the load-bearing realization that justifies a decision, mark it on its own line as **Key insight**: <single sentence>. Reviewers and downstream agents weigh marked insights hardest.
- Forward handoff: end each major section with one line — "Next: <specific action>". Never trail off.
- Concrete anchoring: cite file paths, line numbers, function names, version numbers, or literal output. Vague claims ("recent changes", "various functions") are unusable downstream.
- Named alternatives: when picking a design or approach, name 2-3 alternatives considered. State why each rejected; state why one picked. Single-path reasoning without rejected alternatives is incomplete.`

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
