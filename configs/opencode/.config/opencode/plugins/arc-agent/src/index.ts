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
 *
 * v0.22 additions (v0.21 finally functional):
 *   - Fix P0 workflow_note child-session bug: tools are now factories closing
 *     over the SDK client. Each tool call resolves context.sessionID up the
 *     parent chain to the orchestrator's root session before reading state,
 *     so subagent note writes (predictions, unknowns, insufficiencies) land
 *     in the orchestrator's ArcState instead of a fresh empty child ArcState.
 *     Reproduced + verified end-to-end: 0/0 lost notes post-fix vs 100% lost
 *     pre-fix on both deepseek-v4-flash and opus-4-7 smoke runs.
 *   - Belt-and-suspenders: frame's tool.execute.after parses
 *     ## Predictions / ## Open Questions / ## Existing Solutions Check
 *     directly from the markdown output and synthesizes any missing notes.
 *     If a regression ever re-breaks the tool path, the v0.21 loop still
 *     operates from parsed markdown.
 *   - Observability: workflow.note.memory-uninitialized log (previously
 *     silent rejection path), workflow.note.fallback-parsed log.
 *   - Frame prompt quality: replicability-vs-insufficiency, load-bearing
 *     predictions, rare-secondary task shapes, assumption-vs-unknown
 *     contradiction discipline.
 *   - Review prompt: strengthens the v0.21 section-presence gate so missing
 *     required sections demote the verdict.
 *   - Orchestrator drift: renamed Expectations -> Predictions throughout;
 *     added Spike (Step 0.7), Task Shape capture (Step 1.27),
 *     Unknowns-auditor gate (Step 3.7), Frame-validity-check (Step 3.8) so
 *     the agent prompt aligns with the v0.20/v0.21 infrastructure it never
 *     integrated.
 *   - Helper resilience: strip_open_questions timeout 30s -> 60s
 *     (Opus's 20k-char review prompts time out at 30s).
 */

import type { Plugin, PluginModule } from "@opencode-ai/plugin"

import { buildHooks } from "./hooks"
import { log } from "./log"
import {
  makeWorkflowNoteTool,
  makeWorkflowRecallFullTool,
  makeWorkflowRecallTool,
  makeWorkflowUnknownsStatusTool,
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
      // v0.22 — Tools are factories that close over `client` so each tool
      // call can resolve `context.sessionID` (often a child sub-session) to
      // the orchestrator's root session via client.session.get(parentID).
      // See workflow-memory-tools.ts module header for the full bug fix.
      workflow_recall: makeWorkflowRecallTool(client),
      workflow_recall_full: makeWorkflowRecallFullTool(client),
      workflow_note: makeWorkflowNoteTool(client),
      workflow_unknowns_status: makeWorkflowUnknownsStatusTool(client),
    },
  }
}

const pluginModule: PluginModule = {
  id: "arc-agent",
  server,
}

export default pluginModule
