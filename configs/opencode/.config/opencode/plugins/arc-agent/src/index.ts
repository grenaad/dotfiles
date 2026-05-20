/**
 * arc-agent — OpenCode plugin for the arc-agent workflow.
 *
 * Enforces mechanical rules (char ceilings, state caching) in pure code and
 * delegates semantic transforms (Open Questions stripping, plan compression)
 * to model calls via the OpenCode client.
 *
 * Disable with env var: ARC_AGENT_DISABLED=1
 *
 * Logs to: ~/.local/share/opencode/log/arc-agent.log
 *
 * v0.19 additions:
 *   - Workflow-memory store (intra-workflow cross-turn memory)
 *   - Tools: workflow_recall, workflow_recall_full, workflow_note
 *
 * v0.20 additions:
 *   - Layer 0 stance + Layer 5 falsification clause (prompt-level)
 *   - Unknowns ledger (numbered U1..Un) with per-author authorization
 *   - Multi-layer analysis (synthesis template)
 *   - Spike-first reconnaissance node (new agent)
 *   - Forced re-frame on contradiction (new agent + soft prompt injection)
 *   - Tool: workflow_unknowns_status
 *   - Observability: workflow.stance, workflow.unknown.*, workflow.layer-check,
 *     workflow.reframe.*, workflow.spike.executed log lines
 *
 * v0.21 additions (install the Opus cognitive modes):
 *   - Predict-observe-compare loop: prediction note type with `Wrong if:`
 *     falsifier; researchers emit observation notes against P# topics;
 *     synthesis reconciles. Contradicted predictions auto-supersede the
 *     frame (cap 1 per workflow; suppressible via ARC_AGENT_REFRAME_AUTO_DECLINE=1).
 *   - Unknown resolvability classification (pre_design / user_input /
 *     accept_risk): orchestrator blocks plan on open pre_design unknowns
 *     via soft injection; unknowns-auditor gates user_input via new
 *     USER_INPUT_REQUIRED verdict.
 *   - Task Shape (cognitive methodology classifier): frame declares
 *     primary + optional secondary from {failure-chain, greenfield-plan,
 *     refactor-existing, compare-evaluate, investigate-unknown, map-system};
 *     captured in ArcState.taskShape and logged via workflow.task-shape.declared.
 *   - Existing Solutions Check + insufficiency note type: frame and plan
 *     enumerate existing mechanisms; rejected ones must cite the specific
 *     constraint that makes them insufficient. Default verdict: extend
 *     existing. New code requires a corresponding insufficiency note.
 *   - Multi-axis Comparison Matrix in alternatives.md (strengths-and-
 *     weaknesses per axis; no single winner).
 *   - Failure Chain section (fix + investigate templates): Timeline +
 *     Classification + Root Cause + Confirmation (≥2 corroborations) +
 *     Attribution. Captured via parseFailureChain and logged.
 *   - Reviewer v0.21 checks: matrix-reference, insufficiency-addressed,
 *     constraint-cited complexity.
 *   - Observability: workflow.prediction.{declared,observed,reconciled},
 *     workflow.reframe.offered, workflow.unknowns.blocking,
 *     workflow.task-shape.declared, workflow.existing-check.declared,
 *     workflow.failure-chain.declared log lines.
 */

import type { Plugin, PluginModule } from "@opencode-ai/plugin"

import { buildHooks } from "./hooks"
import { log } from "./log"
import {
  workflowNoteTool,
  workflowRecallFullTool,
  workflowRecallTool,
  workflowUnknownsStatusTool,
} from "./workflow-memory-tools"

const ENV_DISABLE = "ARC_AGENT_DISABLED" as const
const DISABLED = process.env[ENV_DISABLE] === "1"

const server: Plugin = async ({ client }) => {
  await log({ kind: "init", session: "<startup>", note: "arc-agent loaded" })
  const hooks = buildHooks(client)
  // When disabled, suppress tool registration too — buildHooks already returns
  // a minimal Hooks object; we just skip the tool map.
  if (DISABLED) return hooks
  return {
    ...hooks,
    tool: {
      ...(hooks.tool ?? {}),
      workflow_recall: workflowRecallTool,
      workflow_recall_full: workflowRecallFullTool,
      workflow_note: workflowNoteTool,
      workflow_unknowns_status: workflowUnknownsStatusTool,
    },
  }
}

const pluginModule: PluginModule = {
  id: "arc-agent",
  server,
}

export default pluginModule
