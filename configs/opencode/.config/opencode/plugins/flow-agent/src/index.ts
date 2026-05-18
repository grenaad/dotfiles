/**
 * flow-agent — OpenCode plugin for the dataflow-graph planning workflow.
 *
 * Tuned for DeepSeek v4-pro-max: many short "scout" passes feeding a single
 * "synthesize" pass. See README.md for the design.
 *
 * Registers one custom tool: `flow_plan`. The user-facing slash command
 * (command/flow.md) calls this tool with the user's request; the tool runs
 * the DAG via child sessions pinned to deepseek/deepseek-v4-pro, writes
 * the rendered plan to disk under .flow-plans/, and returns a summary
 * payload that the model can sensibly relay to the user.
 *
 * Disable with env: FLOW_AGENT_DISABLED=1
 * Logs to: ~/.local/share/opencode/log/flow-agent.log
 * Plans:   <project-dir>/.flow-plans/<timestamp>-<session>.md
 */

import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

import { ENV_DISABLED } from "./constants"
import { runDag } from "./scheduler"
import { log } from "./log"

const PLAN_DIR = ".flow-plans"

function planFilename(sessionID: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  // Last 12 chars of session id is plenty to disambiguate within a project.
  const sidSuffix = sessionID.slice(-12)
  return `${ts}-${sidSuffix}.md`
}

async function writePlanFile(directory: string, sessionID: string, content: string): Promise<string | null> {
  try {
    const dir = join(directory, PLAN_DIR)
    await mkdir(dir, { recursive: true })
    const filename = planFilename(sessionID)
    const full = join(dir, filename)
    await writeFile(full, content, "utf8")
    return full
  } catch {
    return null
  }
}

const server: Plugin = async ({ client, directory }) => {
  await log({ kind: "init", note: "flow-agent loaded" })

  const disabled = process.env[ENV_DISABLED] === "1"

  return {
    tool: {
      flow_plan: tool({
        description:
          "Run the flow-agent dataflow planning graph and write the full " +
          "plan to disk under .flow-plans/. Runs DeepSeek v4-pro-max across " +
          "12 nodes / 7 parallel waves (~3-6 min wall-clock). " +
          "Returns: a SHORT summary in `output` (plan file path + size + " +
          "any critique findings) for the calling agent to relay to the " +
          "user, and `metadata.plan_file` pointing at the saved markdown. " +
          "The full plan is also visible in this tool result if expanded. " +
          "Use this for planning tasks (features, fixes, refactors) where " +
          "you want a thorough RFC done in the background.",
        args: {
          ask: tool.schema
            .string()
            .min(1)
            .describe(
              "The user's full request. Pass it verbatim — flow-agent " +
                "will restate it internally as its first node.",
            ),
        },
        async execute(args, ctx) {
          if (disabled) {
            return {
              title: "flow-agent disabled",
              output:
                "flow-agent is disabled via FLOW_AGENT_DISABLED=1. " +
                "Unset the env var or use the orchestrator agent instead.",
            }
          }

          const result = await runDag({
            client,
            mainSessionID: ctx.sessionID,
            ask: args.ask,
          })

          // Persist the full plan to disk so the calling agent can point
          // the user at a stable artifact (and so the full text is recoverable
          // even after session compaction).
          const planFile = await writePlanFile(directory, ctx.sessionID, result.rendered)

          // Short summary for the calling agent to relay.
          const lines: string[] = []
          lines.push(`flow-agent completed: ${result.rendered.length} chars across ${result.waveDurations.length} waves in ${(result.totalDurationMs / 1000).toFixed(1)}s.`)
          if (planFile) {
            lines.push(`Plan file: ${planFile}`)
          } else {
            lines.push("Plan file: (write failed — see tool result for full content)")
          }
          if (result.failures.length > 0) {
            lines.push(`Failed nodes: ${result.failures.join(", ")}`)
          }
          lines.push("")
          lines.push("--- FULL PLAN (verbatim, for user reference) ---")
          lines.push("")
          lines.push(result.rendered)

          return {
            title: planFile ? `flow-agent: ${planFile}` : "flow-agent plan",
            output: lines.join("\n"),
            metadata: {
              total_ms: result.totalDurationMs,
              wave_count: result.waveDurations.length,
              failures: result.failures,
              rendered_chars: result.rendered.length,
              plan_file: planFile,
            },
          }
        },
      }),
    },
  }
}

const pluginModule: PluginModule = {
  id: "flow-agent",
  server,
}

export default pluginModule
