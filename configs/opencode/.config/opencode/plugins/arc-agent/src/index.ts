/**
 * arc-agent — OpenCode plugin for the v0.25 integrated orchestrator.
 *
 * The orchestrator agent does its own investigation directly (read/grep/glob/
 * webfetch) and produces a plan as its output. The plugin provides:
 *   - Workflow-memory store (intra-workflow cross-turn memory) — for the
 *     orchestrator's own cross-turn recall and for the 5 surviving subagents'
 *     fresh-eyes context.
 *   - Tools: workflow_recall, workflow_recall_full, workflow_note.
 *   - Hooks: prompt-preamble injection for the 5 surviving subagents; plan-
 *     quality measurement on the orchestrator's plan-draft turn (heuristic).
 *
 * Surviving subagents (5): review, critic, confidence-auditor, cost-checker,
 * falsifier. All other subagents were removed in v0.25 — the orchestrator
 * handles their cognitive operations inline.
 *
 * Disable with env var: ARC_AGENT_DISABLED=1
 * Logs to: ~/.local/share/opencode/log/arc-agent.log
 */

import type { Plugin, PluginModule } from "@opencode-ai/plugin"

import { buildHooks } from "./hooks"
import { log } from "./log"
import {
  makeWorkflowNoteTool,
  makeWorkflowRecallFullTool,
  makeWorkflowRecallTool,
} from "./workflow-memory-tools"

const ENV_DISABLE = "ARC_AGENT_DISABLED" as const
const DISABLED = process.env[ENV_DISABLE] === "1"

const server: Plugin = async ({ client }) => {
  await log({ kind: "init", session: "<startup>", note: "arc-agent loaded (v0.25.1)" })
  const hooks = buildHooks(client)
  if (DISABLED) return hooks
  return {
    ...hooks,
    tool: {
      ...(hooks.tool ?? {}),
      workflow_recall: makeWorkflowRecallTool(client),
      workflow_recall_full: makeWorkflowRecallFullTool(client),
      workflow_note: makeWorkflowNoteTool(client),
    },
  }
}

const pluginModule: PluginModule = {
  id: "arc-agent",
  server,
}

export default pluginModule
