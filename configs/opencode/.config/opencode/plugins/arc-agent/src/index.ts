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
 */

import type { Plugin, PluginModule } from "@opencode-ai/plugin"

import { buildHooks } from "./hooks"
import { log } from "./log"

const server: Plugin = async ({ client }) => {
  await log({ kind: "init", session: "<startup>", note: "arc-agent loaded" })
  return buildHooks(client)
}

const pluginModule: PluginModule = {
  id: "arc-agent",
  server,
}

export default pluginModule
