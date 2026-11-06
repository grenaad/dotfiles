/**
 * OrchestratorV2 plugin.
 *
 * A multi-role coordination setup that supersedes the single-minion
 * `orchestrator.ts` plugin. It defines one primary agent (orchestratorv2)
 * and four subagents (worker, architect, smith, grunt), each with a scoped
 * prompt, model, and permission set.
 *
 * The execution roles are split by kind of work: worker handles
 * non-implementation work — discovery/search/investigation and prose /
 * documentation — while smith handles all code work: implementation,
 * debugging, and refactoring. architect is an optional read-only reviewer.
 * The primary delegates to whichever role fits rather than doing substantial
 * work itself.
 *
 * grunt is a low-cost execution subagent. The thinking stays with the Opus
 * agents (orchestratorv2, smith, worker, architect); grunt does the
 * mechanical work they brief it on: bulk file reads/searches, MCP calls,
 * applying code edits to a precise spec, and running commands or checks.
 *
 * Registration mirrors `orchestrator.ts` (OpenCode v2 plugin API): agents are
 * registered through `ctx.agent.transform(...)`. An agent that already exists
 * (e.g. declared in opencode.json `agents`) is left untouched, so user
 * definitions win over these bundled ones. New agents start with an empty
 * permission ruleset (unmatched rules default to "ask"), so they are seeded
 * from the built-in `build` (primary) / `general` (subagent) rulesets before
 * the role-specific rules are appended. Rules are ordered; last match wins.
 *
 * Delegation is on-demand and bounded: the primary decides per task whether
 * to handle it directly or hand it to a subagent (worker, smith, grunt, or
 * optionally architect). Independent work runs in the background/in parallel
 * via the runtime's normal Task behaviour; there are no custom config flags
 * for concurrency and no polling — the primary is notified when a subagent
 * finishes. The other subagents call grunt in the foreground, because their
 * final answer returns to their caller when their turn ends.
 *
 * Models / variants:
 *   - orchestratorv2 -> inherited (no model/variant pinned; uses the caller's
 *                       active model, matching orchestrator.ts's primary)
 *   - worker         -> anthropic/claude-opus-5-5 (effort variant: max)
 *   - architect      -> inherited (no model/variant pinned; an independent
 *                       optional review specialist, not a "higher-reasoning" tier)
 *   - smith          -> anthropic/claude-opus-5-5 (effort variant: high)
 *   - grunt          -> opencode-go/deepseek-v4.1-flash (effort variant: max)
 *
 * Dispatch convention (architect):
 *   architect is a subagent, so its only invocation path is the subagent tool.
 *   The intended workflow is that only orchestratorv2 dispatches it. This is a
 *   prompt/convention expectation, not a runtime guarantee: there is no
 *   cross-agent caller restriction enforced here, and any agent able to use the
 *   subagent tool could in principle target architect. Restricting architect to
 *   orchestratorv2 relies on the prompts below and the primary's own task
 *   allowlist, not on plugin-level enforcement.
 *
 * Dispatch convention (grunt):
 *   grunt may be dispatched by orchestratorv2, smith, worker, and architect
 *   (each allowlists it after its `subagent * deny`); grunt itself spawns no
 *   subagents. worker and architect are limited to read-only grunt tasks by
 *   prompt convention only: subagents run with their own permissions, not a
 *   subset of the caller's, so architect's `edit * deny` does not extend to
 *   work it hands grunt.
 */

const GRUNT_READS =
  "Hand bulk reading and searching, MCP calls, and command runs to grunt, the low-cost execution subagent; keep the thinking yourself. Brief it like a work order: exact files, exact data to return, reply format. You may do small targeted reads yourself.";

const GRUNT_EDITS =
  "grunt also makes code edits you specify precisely: give it the exact files and changes.";

const GRUNT_FOREGROUND =
  "Call grunt in the foreground (parallel calls are fine) so you have its results before you answer.";

const ESCALATE =
  "If the task is ambiguous or blocked, stop and report what you found instead of guessing.";

const ORCHESTRATOR_PROMPT = [
  "You are OrchestratorV2, the primary agent: you plan, delegate, verify, and synthesize.",
  "Do coordination work yourself: quick reads for a better brief, small integration edits, checks of reported work. Delegate everything else to the one subagent that fits:",
  "  - smith: implementation, debugging, refactoring.",
  "  - worker: investigation with path:line evidence, and documentation.",
  "  - architect: optional independent review of a design or high-risk change.",
  "  - grunt: fully specified mechanical tasks (fetch an issue, run a command, apply an exact edit), including all MCP calls and bulk reads.",
  "Run subagents in the background and never poll; you are notified when they finish.",
  "Brief each one with the goal, constraints, expected output, and known context. Then synthesize the results and report concisely.",
].join("\n");

const WORKER_PROMPT = [
  "You are worker, a research and writing subagent. You investigate how code works or where things live, back findings with path:line evidence, and write documentation. You never change code, yourself or through grunt; if the task needs code changes, say so and stop.",
  GRUNT_READS,
  GRUNT_FOREGROUND,
  "Follow the repository's conventions; don't assume a toolchain you haven't confirmed.",
  ESCALATE,
  "Report concisely: findings or what you wrote, path:line citations, open questions.",
].join("\n");

const ARCHITECT_PROMPT = [
  "You are architect, an independent, read-only reviewer of designs and high-risk changes. You never edit files, yourself or through grunt.",
  GRUNT_READS,
  GRUNT_FOREGROUND,
  "Give a clear assessment: risks, trade-offs, and a recommendation, citing path:line.",
].join("\n");

const SMITH_PROMPT = [
  "You are smith, the coding subagent. You investigate, design, and precisely specify implementation, debugging, and refactoring changes; grunt makes the edits.",
  "Understand the relevant code and conventions before specifying an edit; don't assume a toolchain you haven't confirmed.",
  GRUNT_READS,
  GRUNT_EDITS,
  GRUNT_FOREGROUND,
  "Review grunt's diff and send a follow-up brief if it's wrong; make tiny fixes yourself when briefing would cost more. Run (or have grunt run) the repository's checks.",
  ESCALATE,
  "Report concisely: what changed, files touched (path:line), checks and results, gaps.",
].join("\n");

const GRUNT_PROMPT = [
  "You are grunt, a low-cost execution subagent. Another agent did the thinking; carry out its brief literally: read or search files, make MCP calls, apply specified edits, run commands. Make no design decisions and change nothing you weren't asked to.",
  "If the brief is ambiguous, the code doesn't match it, or a judgment call is needed, stop and report what you found.",
  "Report facts only, briefly: verbatim code with path:line, trimmed command output, only the requested MCP fields; after edits, the files and lines changed and the results of any checks the brief named.",
].join("\n");

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

const AGENTS: Record<string, Definition> = {
  orchestratorv2: {
    mode: "primary",
    // No model/variant pinned: inherit the caller's active model, matching
    // the orchestrator.ts primary.
    description:
      "Primary coordinator: plans, delegates to worker/smith/architect/grunt, performs integration edits and verification.",
    system: ORCHESTRATOR_PROMPT,
    // Broad rule first, narrow rules last (last match wins): deny arbitrary
    // subagent spawning, but allow delegation to worker, architect, smith,
    // and grunt.
    permissions: [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "worker", effect: "allow" },
      { action: "subagent", resource: "architect", effect: "allow" },
      { action: "subagent", resource: "smith", effect: "allow" },
      { action: "subagent", resource: "grunt", effect: "allow" },
    ],
  },
  worker: {
    mode: "subagent",
    model: { providerID: "anthropic", id: "claude-opus-5-5", variant: "max" },
    description:
      "Research and writing subagent: discovery, search, and investigation with concrete path:line evidence (using grunt for evidence gathering), plus prose/documentation writing. Does not make code changes.",
    system: WORKER_PROMPT,
    // Normal tooling (inherit defaults); block subagent spawning except grunt.
    permissions: [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "grunt", effect: "allow" },
    ],
  },
  architect: {
    mode: "subagent",
    // No model/variant pinned: inherit the active model. architect is an
    // independent optional review specialist, not a "higher-reasoning" tier.
    description:
      "Independent, optional, read-only reviewer of designs and high-risk changes.",
    system: ARCHITECT_PROMPT,
    // The edit deny applies to architect only; grunt runs with its own
    // permissions, so read-only grunt use is a prompt convention.
    permissions: [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "edit", resource: "*", effect: "deny" },
      { action: "subagent", resource: "grunt", effect: "allow" },
    ],
  },
  smith: {
    mode: "subagent",
    model: { providerID: "anthropic", id: "claude-opus-5-5", variant: "high" },
    description:
      "Coding subagent: designs implementation, debugging, and refactoring changes, has grunt make the mechanical edits, and reviews the results with repository checks.",
    system: SMITH_PROMPT,
    // Normal tooling (inherit defaults); block subagent spawning except grunt.
    // No edit deny — smith is the role that edits code.
    permissions: [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "grunt", effect: "allow" },
    ],
  },
  grunt: {
    mode: "subagent",
    model: {
      providerID: "opencode-go",
      id: "deepseek-v4.1-flash",
      variant: "max",
    },
    description:
      "Low-cost executor: reads and searches files, makes MCP calls, applies precisely specified edits, runs commands. No design or diagnosis.",
    system: GRUNT_PROMPT,
    // Normal tooling (inherit defaults); only block further subagent spawning.
    permissions: [{ action: "subagent", resource: "*", effect: "deny" }],
  },
};

export default {
  id: "orchestratorv2",
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
