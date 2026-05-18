/**
 * flow-agent fixed DAG.
 *
 * The graph is intentionally hardcoded for v0.1 — one shape for all planning
 * tasks. The waves represent topologically-ordered groups of nodes that can
 * execute concurrently within a wave.
 *
 * Adding a new node?
 *   1. Define it in nodes.ts.
 *   2. Add it to the right wave below.
 *   3. The scheduler will validate that all dependencies fall in earlier waves.
 */

import { getNodeDef } from "./nodes"
import type { NodeName, Wave } from "./types"

/**
 * The wave structure. Nodes in the same wave run in parallel.
 *
 * Final render is done in TypeScript (scheduler.ts:renderFinalPlan) — no
 * model call needed since it's just "draft body + optional bullets". This
 * saves one model call (~10-90s) and the synthesize-tier prompt cost.
 */
export const WAVES: readonly Wave[] = [
  // Wave 0 — root: restate the ask.
  { index: 0, nodes: ["understand_ask"] },
  // Wave 1 — codebase context (parallel).
  { index: 1, nodes: ["scan_target_area", "identify_patterns", "enumerate_risks"] },
  // Wave 2 — design A: independent placement + signature decisions (parallel).
  { index: 2, nodes: ["decide_placement", "decide_signature"] },
  // Wave 3 — design B: integration depends on placement (serial).
  { index: 3, nodes: ["decide_integration"] },
  // Wave 4 — verification (parallel).
  { index: 4, nodes: ["list_test_cases", "list_failure_modes"] },
  // Wave 5 — synthesis: the ONE big DeepSeek pass.
  { index: 5, nodes: ["draft_plan"] },
  // Wave 6 — critique (parallel, conditional execution decided by scheduler).
  { index: 6, nodes: ["critique_completeness", "critique_traceability"] },
]

/** Wave index for the conditional critique stage. Used by the scheduler. */
export const CRITIQUE_WAVE_INDEX = 6

/**
 * Validate the graph at module load time: every node's dependencies must be
 * declared in a strictly earlier wave (not the same wave).
 *
 * Throws on misconfiguration so it surfaces during typecheck/dev, not at
 * runtime in the middle of a user task.
 */
export function validateGraph(): void {
  const waveOf: Map<NodeName, number> = new Map()
  for (const wave of WAVES) {
    for (const node of wave.nodes) {
      if (waveOf.has(node)) {
        throw new Error(`flow-agent graph: node ${node} appears in multiple waves`)
      }
      waveOf.set(node, wave.index)
    }
  }

  for (const wave of WAVES) {
    for (const node of wave.nodes) {
      const def = getNodeDef(node)
      for (const dep of def.dependsOn) {
        const depWave = waveOf.get(dep)
        if (depWave === undefined) {
          throw new Error(`flow-agent graph: ${node} depends on unknown node ${dep}`)
        }
        if (depWave >= wave.index) {
          throw new Error(
            `flow-agent graph: ${node} (wave ${wave.index}) depends on ${dep} (wave ${depWave}); ` +
              `dependencies must be in strictly earlier waves`,
          )
        }
      }
    }
  }
}

// Validate at module load so a bad graph fails fast.
validateGraph()
