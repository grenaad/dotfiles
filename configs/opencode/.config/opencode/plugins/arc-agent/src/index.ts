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
