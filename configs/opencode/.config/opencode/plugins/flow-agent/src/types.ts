/**
 * flow-agent types
 *
 * Core types for the dataflow executor. The graph is a directed acyclic
 * graph of nodes; each node has a fixed input/output schema and is invoked
 * via one helper-session DeepSeek call.
 */

/**
 * All node names in the graph. Adding a new node?
 *   1. Add the name here
 *   2. Add a NodeDef in nodes.ts
 *   3. Add it to a wave in graph.ts
 */
export type NodeName =
  // Wave 0
  | "understand_ask"
  // Wave 1 — codebase context (parallel)
  | "scan_target_area"
  | "identify_patterns"
  | "enumerate_risks"
  // Wave 2 — design (parallel)
  | "decide_placement"
  | "decide_signature"
  | "decide_integration"
  // Wave 3 — verification (parallel)
  | "list_test_cases"
  | "list_failure_modes"
  // Wave 4 — synthesis (serial)
  | "draft_plan"
  // Wave 5 — critique (parallel, conditional)
  | "critique_completeness"
  | "critique_traceability"
  // Note: final render is done in TS, not as a node — see scheduler.ts.

/** Effort tier — drives variant + timeout. */
export type EffortTier = "scout" | "synthesize"

/**
 * A NodeOutput is JSON-shaped. We store everything as a parsed object so
 * downstream nodes can extract specific fields without re-parsing.
 *
 * The "raw" field holds the model's full raw text response (for logging
 * and debugging when JSON parsing fails).
 */
export interface NodeOutput {
  /** The parsed JSON the model returned, or null if parsing failed. */
  data: Record<string, unknown> | null
  /** Raw response text from the model. */
  raw: string
  /** Whether JSON parse succeeded. */
  parsed: boolean
  /** Wall-clock duration in ms for this single node. */
  durationMs: number
  /** True if the node timed out (output is empty / partial). */
  timedOut: boolean
  /** Error message if the call failed entirely. */
  error?: string
}

/**
 * NodeDef — static definition of a single node in the graph.
 *
 * The prompt template receives the upstream outputs map and the original
 * user ask. It returns a string to send to the model. The model is expected
 * to return JSON matching the documented output shape (validation is best-
 * effort; downstream nodes tolerate partial outputs).
 */
export interface NodeDef {
  name: NodeName
  tier: EffortTier
  /** Names of upstream nodes whose outputs this node depends on. */
  dependsOn: readonly NodeName[]
  /**
   * Human-readable description of the node's purpose. Embedded in the
   * prompt so the model knows what to produce.
   */
  description: string
  /**
   * Build the prompt body for this node. Receives:
   *   - ask: the user's original prompt
   *   - upstream: map of all already-completed node outputs
   * Returns the full prompt text (system message is separate).
   */
  buildPrompt(ask: string, upstream: NodeOutputs): string
  /**
   * Documented output keys this node is expected to emit in its JSON.
   * Used for validation and for the next-wave nodes to know what they
   * can rely on.
   */
  outputKeys: readonly string[]
}

/** Completed outputs by node name. Used as input to downstream nodes. */
export type NodeOutputs = Partial<Record<NodeName, NodeOutput>>

/**
 * A wave is a set of nodes that can run in parallel (no inter-dependencies
 * within the wave). The scheduler executes waves in order; nodes within a
 * wave run concurrently via Promise.all.
 */
export interface Wave {
  index: number
  nodes: readonly NodeName[]
}

/** Result of executing a full DAG. */
export interface FlowResult {
  outputs: NodeOutputs
  /** Total wall-clock time across all waves. */
  totalDurationMs: number
  /** Per-wave timing summary. */
  waveDurations: Array<{ wave: number; durationMs: number; nodes: readonly NodeName[] }>
  /** Final rendered plan — built deterministically from draft_plan + critique. */
  rendered: string
  /** Names of nodes that timed out or errored. */
  failures: readonly NodeName[]
}

/** Per-session state held in memory. */
export interface FlowState {
  /** Last completed FlowResult for this session (debug / re-render). */
  lastResult?: FlowResult
}

/** JSONL log line shape. */
export type FlowLogLine =
  | { kind: "init"; t: string; note: string }
  | {
      kind: "flow.start"
      session: string
      ask_chars: number
      t: string
    }
  | {
      kind: "node.start"
      session: string
      wave: number
      node: NodeName
      tier: EffortTier
      t: string
    }
  | {
      kind: "node.end"
      session: string
      wave: number
      node: NodeName
      tier: EffortTier
      duration_ms: number
      output_chars: number
      parsed: boolean
      timed_out: boolean
      error?: string
      t: string
    }
  | {
      kind: "wave.end"
      session: string
      wave: number
      duration_ms: number
      nodes: readonly NodeName[]
      t: string
    }
  | {
      kind: "flow.end"
      session: string
      total_ms: number
      failures: readonly NodeName[]
      rendered_chars: number
      t: string
    }
