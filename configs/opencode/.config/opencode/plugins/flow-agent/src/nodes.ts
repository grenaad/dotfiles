/**
 * flow-agent node definitions.
 *
 * Each node is a deterministic prompt template + output schema. Prompts are
 * intentionally terse and schema-explicit — DeepSeek v4-pro-max thrives on
 * structured tasks with clear input/output contracts.
 *
 * Style rules (followed by every prompt):
 *   - Open with one-line role/purpose statement.
 *   - Provide context as labeled sections, not prose paragraphs.
 *   - End with "Respond with JSON: {keys...}" so the schema is the last thing
 *     the model sees.
 *   - Keep total prompt ≤ 1500 chars where possible. Each node should "see"
 *     only the upstream fields it needs.
 */

import type { NodeDef, NodeName, NodeOutput, NodeOutputs } from "./types"

/* ----------------------------- helpers ----------------------------- */

/** Format an upstream node's data as a compact, fenced JSON snippet. */
function fmtUpstream(label: string, output: NodeOutput | undefined): string {
  if (!output) return `${label}: (missing)`
  if (output.error) return `${label}: (failed: ${output.error})`
  if (!output.data) return `${label}: (no parsed data; raw was ${output.raw.length} chars)`
  return `${label}:\n\`\`\`json\n${JSON.stringify(output.data, null, 2)}\n\`\`\``
}

/** Pick specific keys from upstream output's parsed data. */
function pickFields(output: NodeOutput | undefined, keys: readonly string[]): Record<string, unknown> {
  if (!output?.data) return {}
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (k in output.data) out[k] = output.data[k]
  }
  return out
}

/** Format a subset of upstream fields as a fenced JSON block. */
function fmtFields(label: string, output: NodeOutput | undefined, keys: readonly string[]): string {
  const picked = pickFields(output, keys)
  if (Object.keys(picked).length === 0) return `${label}: (none available)`
  return `${label}:\n\`\`\`json\n${JSON.stringify(picked, null, 2)}\n\`\`\``
}

/* ============================ NODES ============================ */

const understand_ask: NodeDef = {
  name: "understand_ask",
  tier: "scout",
  dependsOn: [],
  description: "Restate the user's ask as structured fields.",
  outputKeys: ["goal", "scope", "deliverable_shape", "success_criteria", "task_type"],
  buildPrompt(ask) {
    return `Restate the user's ask as structured fields.

USER ASK:
${ask}

Identify:
  - goal: one-sentence outcome the user wants.
  - scope: bounded list of code areas / files / concepts the work touches.
  - deliverable_shape: one of {plan, fix, feature, refactor, investigation, docs}.
  - success_criteria: 2-5 testable criteria for "done".
  - task_type: same as deliverable_shape (kept separate for clarity).

Respond with JSON: { "goal", "scope", "deliverable_shape", "success_criteria", "task_type" }
  - goal: string
  - scope: array of strings (file globs, module names, concepts)
  - deliverable_shape: one of the five strings above
  - success_criteria: array of strings
  - task_type: one of the five strings above`
  },
}

const scan_target_area: NodeDef = {
  name: "scan_target_area",
  // v0.2: promoted scout→synthesize. Without read/grep/glob tools (TODO below)
  // this node has to enumerate plausible files from training memory, which
  // takes longer than 90s on DeepSeek for non-trivial scopes. 240s budget
  // matches its real latency profile. Same rationale applies to identify_patterns,
  // decide_placement, decide_integration below.
  tier: "synthesize",
  dependsOn: ["understand_ask"],
  description: "Identify the relevant files, key symbols, and conventions in the scope.",
  outputKeys: ["relevant_files", "key_symbols", "conventions"],
  // TODO(flow-agent v0.2): this node should receive read/grep/glob tools so it
  // can actually scan the codebase. For v0.1 it runs tool-less and produces
  // best-guess fields from training-time knowledge.
  buildPrompt(ask, upstream) {
    return `Identify codebase context for the scope below.

USER ASK:
${ask}

${fmtFields("UPSTREAM understand_ask", upstream.understand_ask, ["scope", "deliverable_shape"])}

You cannot read files directly in this node. Based on your prior knowledge of
typical projects of this shape (and any context already in your system),
produce best-guess fields. If the scope is too vague, populate fields with
"(unknown — needs file read)".

Respond with JSON:
  - relevant_files: array of likely file paths (relative)
  - key_symbols: array of {name, kind, file} entries for important functions/types/constants
  - conventions: array of strings describing patterns to follow (naming, layout, style)`
  },
}

const identify_patterns: NodeDef = {
  name: "identify_patterns",
  // v0.2: promoted scout→synthesize. This was the worst offender — 4/6 smokes
  // timed out at 90s. DeepSeek wanders on "list patterns" prompts; 240s lets
  // it converge. Future work: tighter prompt with explicit max-count schema.
  tier: "synthesize",
  dependsOn: ["understand_ask"],
  description: "List existing patterns to mirror and anti-patterns to avoid.",
  outputKeys: ["existing_patterns_to_mirror", "anti_patterns"],
  buildPrompt(ask, upstream) {
    return `Identify patterns relevant to the deliverable.

USER ASK:
${ask}

${fmtFields("UPSTREAM understand_ask", upstream.understand_ask, ["deliverable_shape", "scope"])}

Produce:
  - existing_patterns_to_mirror: 3-6 named patterns the deliverable should follow
    (e.g., "use buildSectionMarkers shape for HTML comment emission").
  - anti_patterns: 2-4 things to explicitly avoid for this deliverable shape.

Respond with JSON:
  - existing_patterns_to_mirror: array of {name, rationale} entries
  - anti_patterns: array of {name, reason} entries`
  },
}

const enumerate_risks: NodeDef = {
  name: "enumerate_risks",
  tier: "scout",
  dependsOn: ["understand_ask"],
  description: "Categorize risks and worst-case failure modes.",
  outputKeys: ["risk_categories", "worst_cases"],
  buildPrompt(ask, upstream) {
    return `Enumerate risks for the deliverable.

USER ASK:
${ask}

${fmtFields("UPSTREAM understand_ask", upstream.understand_ask, ["deliverable_shape", "success_criteria"])}

Produce:
  - risk_categories: high-level categories that apply (e.g., "false-positive detection",
    "double-annotation", "performance on large inputs"). 3-6 items.
  - worst_cases: 3-5 concrete worst-case scenarios with one-line mitigation hints.

Respond with JSON:
  - risk_categories: array of strings
  - worst_cases: array of {scenario, mitigation_hint} entries`
  },
}

const decide_placement: NodeDef = {
  name: "decide_placement",
  // v0.2: promoted scout→synthesize. Reads two upstream synthesize-tier
  // outputs; the merge step on DeepSeek frequently exceeded 90s. Same fix
  // family as identify_patterns/scan_target_area.
  tier: "synthesize",
  dependsOn: ["scan_target_area", "identify_patterns"],
  description: "Decide where the new code lives (file + general location).",
  outputKeys: ["target_file", "rationale", "alternatives_rejected"],
  buildPrompt(ask, upstream) {
    return `Decide placement for the new code.

USER ASK:
${ask}

${fmtFields("UPSTREAM scan_target_area", upstream.scan_target_area, ["relevant_files", "conventions"])}
${fmtFields("UPSTREAM identify_patterns", upstream.identify_patterns, ["existing_patterns_to_mirror"])}

Produce:
  - target_file: the single best home for the new code (file path).
  - rationale: 1-2 sentences citing a specific upstream pattern or file.
  - alternatives_rejected: 1-3 candidate placements you considered and rejected, with one-line reasons.

Respond with JSON:
  - target_file: string
  - rationale: string
  - alternatives_rejected: array of {file, reason} entries`
  },
}

const decide_signature: NodeDef = {
  name: "decide_signature",
  tier: "scout",
  dependsOn: ["understand_ask", "identify_patterns"],
  description: "Decide function signature, return shape, and error handling.",
  outputKeys: ["signature", "return_shape", "error_handling"],
  buildPrompt(ask, upstream) {
    return `Decide the function signature and shape.

USER ASK:
${ask}

${fmtFields("UPSTREAM understand_ask", upstream.understand_ask, ["deliverable_shape", "success_criteria"])}
${fmtFields("UPSTREAM identify_patterns", upstream.identify_patterns, ["existing_patterns_to_mirror"])}

Produce:
  - signature: the TypeScript signature line (e.g., \`export function foo(x: string): string[]\`).
  - return_shape: prose describing what the return value contains.
  - error_handling: how errors / edge inputs are handled (throw / null / empty / fallback).

Respond with JSON:
  - signature: string
  - return_shape: string
  - error_handling: string`
  },
}

const decide_integration: NodeDef = {
  name: "decide_integration",
  // v0.2: promoted scout→synthesize. Depends on decide_placement (now synthesize)
  // and identify_patterns (now synthesize). The integration reasoning is the
  // most expensive merge in the DAG; 90s was insufficient.
  tier: "synthesize",
  dependsOn: ["decide_placement", "identify_patterns"],
  description: "Decide where and how the new function is wired into existing code.",
  outputKeys: ["integration_points", "diff_outline"],
  buildPrompt(ask, upstream) {
    return `Decide integration points for the new code.

USER ASK:
${ask}

${fmtFields("UPSTREAM decide_placement", upstream.decide_placement, ["target_file"])}
${fmtFields("UPSTREAM identify_patterns", upstream.identify_patterns, ["existing_patterns_to_mirror"])}

Produce:
  - integration_points: list of call-sites or hooks where the new code is invoked.
    Each entry has {file, location_hint, change_description}.
  - diff_outline: a short ordered list of code changes (1 bullet per touched file).

Respond with JSON:
  - integration_points: array of {file, location_hint, change_description}
  - diff_outline: array of strings (one bullet per change)`
  },
}

const list_test_cases: NodeDef = {
  name: "list_test_cases",
  tier: "scout",
  dependsOn: ["decide_signature", "enumerate_risks"],
  description: "List concrete test cases as input/expected pairs.",
  outputKeys: ["test_cases"],
  buildPrompt(ask, upstream) {
    return `List concrete test cases for the function.

USER ASK:
${ask}

${fmtFields("UPSTREAM decide_signature", upstream.decide_signature, ["signature", "return_shape", "error_handling"])}
${fmtFields("UPSTREAM enumerate_risks", upstream.enumerate_risks, ["worst_cases"])}

Produce 6-10 test cases. Cover:
  - happy path (at least 2)
  - empty / null input
  - each risk category's primary scenario
  - one idempotency / double-call case if relevant

Respond with JSON:
  - test_cases: array of {name, input, expected, rationale} entries
    - input: a string description or example value
    - expected: a string description of the expected return / behavior
    - rationale: one line on why this case matters`
  },
}

const list_failure_modes: NodeDef = {
  name: "list_failure_modes",
  tier: "scout",
  dependsOn: ["decide_integration", "enumerate_risks"],
  description: "List integration-level failure modes with mitigations.",
  outputKeys: ["failure_modes"],
  buildPrompt(ask, upstream) {
    return `Enumerate integration failure modes.

USER ASK:
${ask}

${fmtFields("UPSTREAM decide_integration", upstream.decide_integration, ["integration_points"])}
${fmtFields("UPSTREAM enumerate_risks", upstream.enumerate_risks, ["risk_categories", "worst_cases"])}

For each integration point, produce a failure-mode entry:
  - what can go wrong at runtime
  - how it manifests (error message, silent corruption, perf, etc.)
  - the mitigation already planned, or a recommended new one

Aim for 3-6 entries total — concrete, not generic.

Respond with JSON:
  - failure_modes: array of {at, manifests_as, mitigation} entries`
  },
}

const draft_plan: NodeDef = {
  name: "draft_plan",
  tier: "synthesize",
  dependsOn: [
    "understand_ask",
    "scan_target_area",
    "identify_patterns",
    "enumerate_risks",
    "decide_placement",
    "decide_signature",
    "decide_integration",
    "list_test_cases",
    "list_failure_modes",
  ],
  description: "Write the final implementation plan as a structured markdown RFC.",
  outputKeys: ["plan_markdown"],
  buildPrompt(ask, upstream) {
    // The synthesis node gets everything. DeepSeek's strength is doing the
    // big synthesis in one pass — feed it the full structured context.
    const sections = [
      fmtUpstream("understand_ask", upstream.understand_ask),
      fmtUpstream("scan_target_area", upstream.scan_target_area),
      fmtUpstream("identify_patterns", upstream.identify_patterns),
      fmtUpstream("enumerate_risks", upstream.enumerate_risks),
      fmtUpstream("decide_placement", upstream.decide_placement),
      fmtUpstream("decide_signature", upstream.decide_signature),
      fmtUpstream("decide_integration", upstream.decide_integration),
      fmtUpstream("list_test_cases", upstream.list_test_cases),
      fmtUpstream("list_failure_modes", upstream.list_failure_modes),
    ].join("\n\n")

    return `Synthesize the final implementation plan.

USER ASK:
${ask}

UPSTREAM CONTEXT:
${sections}

Produce a complete markdown plan with these sections, in order:
  1. ## What you asked for          — one-paragraph restatement
  2. ## Approach                    — high-level approach, 2-4 bullets
  3. ## Placement                   — where the code goes + rationale
  4. ## Signature                   — function signature + return shape + error handling
  5. ## Integration                 — bullet list of integration points / diff outline
  6. ## Test cases                  — table of test cases (Name | Input | Expected)
  7. ## Failure modes               — table of failure modes (At | Manifests | Mitigation)
  8. ## Alternatives Considered     — what was considered and rejected
  9. ## Sanity Check                — short bullet list confirming each success criterion is met
 10. ## Files touched               — table (File | Change)

Tone: terse, RFC-style, no preamble or sign-off. Tables where the upstream data
is tabular. Use the EXACT field values from the upstream JSON where possible
rather than rephrasing.

Respond with JSON containing exactly one key:
\`\`\`json
{"plan_markdown": "..."}
\`\`\`
The key MUST be spelled "plan_markdown" (not "plan_markmark" or any variant).
The value is a single string containing the full markdown document.`
  },
}

const critique_completeness: NodeDef = {
  name: "critique_completeness",
  tier: "scout",
  dependsOn: ["draft_plan", "understand_ask"],
  description: "Check whether the drafted plan covers all success criteria.",
  outputKeys: ["missing_items", "severity"],
  buildPrompt(_ask, upstream) {
    return `Check completeness of the drafted plan.

${fmtFields("UPSTREAM understand_ask", upstream.understand_ask, ["success_criteria", "scope"])}

DRAFTED PLAN:
${(upstream.draft_plan?.data?.plan_markdown as string | undefined) ?? "(missing)"}

For each success criterion, decide if the plan demonstrably addresses it.
Then identify gaps:
  - missing_items: items absent from the plan that should be there
  - severity: one of {none, low, medium, high}; "none" means the plan is complete

Respond with JSON:
  - missing_items: array of {criterion, what_is_missing} entries (may be empty)
  - severity: one of {none, low, medium, high}`
  },
}

const critique_traceability: NodeDef = {
  name: "critique_traceability",
  tier: "scout",
  dependsOn: ["draft_plan"],
  description: "Check that every claim in the plan traces back to upstream evidence.",
  outputKeys: ["orphaned_findings", "unsupported_claims"],
  buildPrompt(_ask, upstream) {
    return `Check traceability of the drafted plan.

DRAFTED PLAN:
${(upstream.draft_plan?.data?.plan_markdown as string | undefined) ?? "(missing)"}

UPSTREAM EVIDENCE:
${[
  fmtUpstream("scan_target_area", upstream.scan_target_area),
  fmtUpstream("identify_patterns", upstream.identify_patterns),
  fmtUpstream("decide_placement", upstream.decide_placement),
  fmtUpstream("decide_signature", upstream.decide_signature),
  fmtUpstream("decide_integration", upstream.decide_integration),
].join("\n\n")}

Identify:
  - orphaned_findings: upstream findings that ARE relevant but were NOT
    mentioned in the plan (each has {finding, source_node}).
  - unsupported_claims: plan claims with no upstream evidence to back them
    (each has {claim, why_suspect}).

Respond with JSON:
  - orphaned_findings: array of {finding, source_node} (may be empty)
  - unsupported_claims: array of {claim, why_suspect} (may be empty)`
  },
}

/* ----------------------------- registry ----------------------------- */

const ALL_NODES: readonly NodeDef[] = [
  understand_ask,
  scan_target_area,
  identify_patterns,
  enumerate_risks,
  decide_placement,
  decide_signature,
  decide_integration,
  list_test_cases,
  list_failure_modes,
  draft_plan,
  critique_completeness,
  critique_traceability,
]

const BY_NAME: Map<NodeName, NodeDef> = new Map(ALL_NODES.map((n) => [n.name, n]))

export function getNodeDef(name: NodeName): NodeDef {
  const def = BY_NAME.get(name)
  if (!def) throw new Error(`unknown node: ${name}`)
  return def
}

export { ALL_NODES }

/** Helper used by tests / debugging. */
export function buildPromptFor(name: NodeName, ask: string, upstream: NodeOutputs): string {
  return getNodeDef(name).buildPrompt(ask, upstream)
}
