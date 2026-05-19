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
 */

import type { Plugin, PluginModule } from "@opencode-ai/plugin"

import { buildHooks } from "./hooks"
import { log } from "./log"
import {
  workflowNoteTool,
  workflowRecallFullTool,
  workflowRecallTool,
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
    },
  }
}

const pluginModule: PluginModule = {
  id: "arc-agent",
  server,
}

export default pluginModule
