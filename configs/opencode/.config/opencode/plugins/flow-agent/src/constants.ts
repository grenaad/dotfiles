/**
 * flow-agent constants
 *
 * Tunables for the dataflow executor. Keep this file small — anything
 * conditional on user input belongs in the graph or node definitions.
 */

/** Model used for every node. DeepSeek v4-pro is the design target. */
export const FLOW_MODEL_PROVIDER = "deepseek"
export const FLOW_MODEL_ID = "deepseek-v4-pro"

/**
 * Variant per effort tier.
 *
 *   scout     — many fast, structured passes. Low reasoning effort.
 *   synthesize — the ONE big draft_plan node. Max reasoning effort.
 */
export const VARIANT_SCOUT = "low"
export const VARIANT_SYNTHESIZE = "max"

/** Per-node deadlines (milliseconds). Tunable. */
export const NODE_TIMEOUT_SCOUT_MS = 90_000 // 90s
export const NODE_TIMEOUT_SYNTHESIZE_MS = 240_000 // 4 min

/** Per-wave parallelism cap. Most waves have ≤4 nodes; cap is a safety net. */
export const WAVE_MAX_PARALLEL = 6

/**
 * Output ceilings (characters) — applied AFTER the model returns. We log when
 * exceeded but do not truncate; downstream nodes pull only the fields they
 * need from each NodeOutput.
 */
export const SCOUT_OUTPUT_SOFT_CEILING = 2_000
export const SYNTHESIZE_OUTPUT_SOFT_CEILING = 12_000

/**
 * Marker comment injected into the final rendered plan to identify flow-agent
 * outputs. Reviewers / downstream tooling can detect.
 */
export const FLOW_AGENT_MARKER = "<!-- flow-agent: v0.1 -->"

/** Disable env var. If set to "1", the plugin loads but does nothing. */
export const ENV_DISABLED = "FLOW_AGENT_DISABLED"
