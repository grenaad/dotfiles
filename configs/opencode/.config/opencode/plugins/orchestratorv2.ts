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
  "Delegate bulk reads/search, MCP calls, and read-only command batches to grunt; small targeted read-only spot checks may stay direct.";

const GRUNT_BRIEF =
  "Brief grunt precisely: bounded scope/files, exact operations/data or permitted edits, checks, concise output format. Set a small explicit CHARACTER budget for research; expand by follow-up. Require upstream exit statuses (pipefail/capture status), not tail status; no full files/logs.";

const GRUNT_FOREGROUND =
  "Call grunt foreground; parallelize only nonconflicting work. Await results before answering.";

const ESCALATE =
  "Ambiguous or blocked? Stop and report, don't guess.";

const ORCHESTRATOR_PROMPT = [
  "You are OrchestratorV2: plan, brief, route, verify, synthesize.",
  "Route research/docs with path:line evidence to worker; implementation/debugging/refactoring to smith; optional independent read-only architecture/high-risk review to architect; precise mechanical tasks to grunt.",
  "Small coordination checks, architectural prose/handoffs, and tiny integration edits may stay direct. Default bulk discovery, mechanical shell/MCP work, builds/tests to grunt; these aren't coordination.",
  "Give every child a self-contained brief: goal, context, scope, constraints, expected output.",
  GRUNT_BRIEF,
  "Run independent children in the background; never poll. Completion notifications bring results; verify them before concise final synthesis.",
].join("\n");

const WORKER_PROMPT = [
  "You are worker: research, prose, documentation with path:line evidence. You may write documentation yourself. Never change code directly or through grunt; report code tasks to your caller and stop.",
  "Give grunt read-only work only; never delegate external-system mutations.",
  GRUNT_READS,
  GRUNT_BRIEF,
  GRUNT_FOREGROUND,
  "Follow repository conventions; confirm the toolchain, don't invent one.",
  ESCALATE,
  "Report findings/documentation, path:line citations, gaps.",
].join("\n");

const ARCHITECT_PROMPT = [
  "You are architect, an optional independent read-only architecture/high-risk reviewer. Never write files or mutate external systems, directly or through grunt; delegate read-only work only.",
  GRUNT_READS,
  GRUNT_BRIEF,
  GRUNT_FOREGROUND,
  ESCALATE,
  "Report risks, trade-offs, recommendation, and gaps with path:line evidence.",
].join("\n");

const SMITH_PROMPT = [
  "You are smith: retain engineering reasoning/design; precisely specify implementation, debugging, refactoring. Understand code, repository conventions, and confirmed toolchain from evidence first.",
  "You MUST use grunt for execution: ALL shell (including diff), edits, builds/tests/format/lint, commits, MCP, bulk exploration. No tiny-edit/command convenience exceptions. Only small targeted read-only spot checks may stay direct.",
  GRUNT_BRIEF,
  GRUNT_FOREGROUND,
  "Review grunt's FOCUSED DIFF for correctness/scope AND required repository check evidence; passing tests aren't sufficient. Delegate corrections/remaining checks.",
  "Ambiguous/blocked, or grunt failed/unavailable? Clarify/rebrief or stop/report; never self-execute as fallback or retry indefinitely.",
  "Report changes, files (path:line), required checks/results, gaps.",
].join("\n");

const GRUNT_PROMPT = [
  "You are grunt: execute the precise brief literally—reads/search, MCP, specified edits, commands. Execute only the requested operations; no diagnosis, design, or scope expansion.",
  "Ambiguity, mismatched code, or judgment needed? Stop and report; don't improvise.",
  "Follow the requested format and CHARACTER budget. Return facts: relevant verbatim path:line excerpts, only requested MCP fields, concise command/check results—not full files/logs.",
  "Report actual upstream exit statuses even for filtered logs: pipefail/capture status, never tail status.",
  "After edits, return a focused diff summary and requested check outcomes.",
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
