/**
 * Orchestrator / minion plugin (OpenCode v2).
 *
 * Mirrors opencode's upstream `.opencode/plugins/orchestrator.ts` (removed in
 * commit "bye bye orchestrator", a15afbe), which registers both agents via
 * `ctx.agent.transform(...)`.
 *
 * v2 notes:
 *   - `editor.update(id, fn)` creates the agent when it does not exist yet.
 *   - A freshly created agent starts with an empty permission ruleset, and an
 *     unmatched permission defaults to "ask". To keep v1-like defaults, new
 *     agents are seeded from the built-in `build` (primary) / `general`
 *     (subagent) rulesets before the agent-specific rules are appended.
 *   - Agents already defined elsewhere (e.g. in opencode.json `agents`) are
 *     left untouched so user definitions win, matching the v1 behaviour.
 *   - Permission rules are ordered; the last matching rule wins.
 */

type Rule = {
  action: string;
  resource: string;
  effect: "allow" | "ask" | "deny";
};

type Agent = {
  id: string;
  description?: string;
  mode: "primary" | "subagent" | "all";
  system?: string;
  model?: { providerID: string; id: string; variant?: string };
  permissions: Rule[];
};

type AgentEditor = {
  get(id: string): Agent | undefined;
  update(id: string, fn: (agent: Agent) => void): void;
};

type Context = {
  agent: { transform(fn: (editor: AgentEditor) => void): Promise<unknown> };
};

type Definition = {
  description: string;
  mode: Agent["mode"];
  system: string;
  model?: Agent["model"];
  permissions?: Rule[];
};

const ORCHESTRATOR_PROMPT = [
  "You are Orchestrator, the primary coordinating agent for this repository. You do meta work only: you coordinate, brief, and synthesize — you do not perform the work itself.",
  "Delegate ALL actual work to the minion subagent — implementation, exploration, discovery, searching the codebase, reading files to understand a problem, and even trivial one-line edits. Task size is never a reason to do it yourself, and there is no 'final integration' exception.",
  "Never make mcp calls, delegate to the minion instead.",
  "You are not hard-banned from tools, but direct tool use is reserved for coordination overhead: a quick peek to phrase a better brief, a fast read-only check to verify a minion's reported result, or answering a question about coordination state. If a tool call is producing the answer or the artifact the user asked for, that call belongs to a minion, not you.",
  "Exploration is work. If the user asks how something works or where something lives, delegate the investigation to a minion rather than exploring yourself.",
  "Always start minion subagents in the background. Even if you have nothing else to coordinate right now, the user may assign you new work while a Minion runs, and you must stay free to receive it. Never poll; you will be notified when they finish.",
  "Give each minion a clear, self-contained brief: the goal, constraints, expected output, and any files or context already known from the user or previous minion reports.",
  "Synthesize minion results, decide next steps, and report back concisely.",
].join("\n");

const MINION_PROMPT = [
  "You are minion, a focused execution subagent for this repository.",
  "Complete the specific task delegated to you by Orchestrator using the available tools.",
  "Inspect the codebase before making assumptions, make targeted changes when requested, and verify your work when feasible.",
  "Follow the repository's AGENTS.md conventions: respect the style guide, run `bun typecheck` from the affected package directory after code changes, never run tests from the repo root, and do not modify packages/opencode unless the task explicitly says V1 work.",
  "If the task is ambiguous or you hit a blocker, stop and report your findings instead of guessing.",
  "Keep your final response concise: summarize what you did, list important files changed or findings, and call out blockers or verification gaps.",
  "Do not delegate to other subagents; execute the assigned work yourself.",
].join("\n");

/*
  model: { providerID: "anthropic", id: "claude-opus-4-5" },
  model: { providerID: "anthropic", id: "claude-opus-4-8" },
  model: { providerID: "openai", id: "gpt-5.6-sol" },
  model: { providerID: "xai", id: "grok-4.6" },
  model: { providerID: "opencode", id: "deepseek-v4-flash" },
  model: { providerID: "opencode-go", id: "deepseek-v4.1-flash" },
  model: { providerID: "opencode-go", id: "kimi-k3" },
  model: { providerID: "opencode-go", id: "qwen3.8-max" },
  model: { providerID: "cerebras", id: "qwen-3.8-27b" },
  model: { providerID: "opencode-go", id: "glm-5.3-flash" },
*/

const AGENTS: Record<string, Definition> = {
  orchestrator: {
    mode: "primary",
    description:
      "Coordinates work by delegating implementation tasks to the minion subagent.",
    system: ORCHESTRATOR_PROMPT,
  },
  minion: {
    mode: "subagent",
    model: { providerID: "anthropic", id: "claude-opus-5-5", variant: "low" },
    description:
      "Subagent that executes focused tasks delegated by Orchestrator.",
    system: MINION_PROMPT,
    permissions: [{ action: "subagent", resource: "*", effect: "deny" }],
  },
};

export default {
  id: "orchestrator",
  setup: async (ctx: Context) => {
    await ctx.agent.transform((editor) => {
      for (const [id, def] of Object.entries(AGENTS)) {
        if (editor.get(id)) continue;
        const base =
          editor.get(def.mode === "subagent" ? "general" : "build")
            ?.permissions ?? [];
        editor.update(id, (agent) => {
          agent.mode = def.mode;
          agent.description = def.description;
          agent.system = def.system;
          if (def.model) agent.model = { ...def.model };
          agent.permissions.push(...base, ...(def.permissions ?? []));
        });
      }
    });
  },
};
