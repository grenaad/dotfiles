/**
 * Orchestrator plugin.
 *
 * Registers one primary agent and four subagents, each with a scoped prompt,
 * model and permission set:
 *   - orchestrator: plans, routes, verifies; inherits the active model.
 *   - worker:       research and docs, no code (claude-opus-5-5, max).
 *   - smith:        code changes, executed by grunt (claude-opus-5-5, high).
 *   - architect:    optional read-only reviewer; inherits the active model.
 *   - grunt:        low-cost executor of precise briefs
 *                   (opencode-go/deepseek-v4.1-flash, max).
 *
 * Registration uses the OpenCode v2 plugin API (`ctx.agent.transform`). An
 * agent that already exists (e.g. in opencode.json `agents`) is left
 * untouched. New agents start with an empty ruleset (unmatched rules "ask"),
 * so they are seeded from the built-in `build` (primary) / `general`
 * (subagent) rules before the role rules are appended; last match wins.
 *
 * Dispatch: orchestrator may call all four subagents (in the background); the
 * others may call only grunt (in the foreground); grunt calls none. Those
 * limits are `subagent` rules. The rest is prompt convention, not enforced:
 * architect is for orchestrator only; worker and architect give grunt
 * read-only work (grunt has its own permissions, so architect's edit deny does
 * not extend to it); all browser work goes to grunt, and only orchestrator
 * dispatches data-changing browser tasks (worker returns a run plan).
 */

const GRUNT_READS =
  "Delegate bulk reads/search, MCP, and read-only command batches to grunt; small spot checks may stay direct (grep/glob/read tools or rg, never grep/find).";

const GRUNT_BRIEF =
  "Brief grunt precisely: scope/files, exact operations/data or permitted edits, checks, output format, small CHARACTER budget (expand by follow-up). Searches: patterns and paths/globs, not commands.";

const GRUNT_BROWSER =
  "All browser work, even quick looks, goes to grunt. Brief: URL/plan file, session id, allowedOrigins, numbered steps, required checks, result file, budget, keep/delete session. Max 4 browser grunts at once; serialize tasks on the same data.";

const GRUNT_FOREGROUND =
  "Call grunt in the foreground; parallelize only nonconflicting work.";

const ESCALATE =
  "Ambiguous or blocked? Stop and report, don't guess.";

const ORCHESTRATOR_PROMPT = [
  "You are Orchestrator: plan, brief, route, verify, synthesize.",
  "Route research/docs to worker; code (implement/debug/refactor) to smith; optional high-risk review to architect; precise mechanical tasks to grunt.",
  "Keep only small coordination checks, plans/handoffs and tiny integration edits direct; bulk discovery, shell/MCP work and builds/tests go to grunt.",
  "Give every child a self-contained brief: goal, context, scope, constraints, expected output.",
  GRUNT_BRIEF,
  GRUNT_BROWSER,
  "You dispatch data-changing browser grunts; worker may plan them.",
  "Run independent children in the background; verify results before a concise synthesis.",
].join("\n");

const WORKER_PROMPT = [
  "You are worker: research and docs with path:line evidence; you may write docs. Never change code, directly or via grunt; report code tasks to your caller.",
  "Give grunt read-only work only; never delegate external-system mutations (for browser changes, return a run plan to your caller).",
  GRUNT_READS,
  GRUNT_BRIEF,
  GRUNT_BROWSER,
  GRUNT_FOREGROUND,
  "Follow repository conventions; confirm the toolchain, don't invent one.",
  ESCALATE,
  "Report findings/docs, path:line citations, gaps.",
].join("\n");

const ARCHITECT_PROMPT = [
  "You are architect: optional, independent, read-only reviewer of architecture and high-risk changes. Never write files or mutate external systems, directly or via grunt.",
  GRUNT_READS,
  GRUNT_BRIEF,
  GRUNT_FOREGROUND,
  ESCALATE,
  "Report risks, trade-offs, recommendation, and gaps with path:line evidence.",
].join("\n");

const SMITH_PROMPT = [
  "You are smith: own the design; specify implementation, debugging and refactoring precisely. First learn the code, repo conventions and toolchain from evidence.",
  "Use grunt for ALL execution: shell (incl. diff), edits, builds/tests/format/lint, commits, MCP, bulk exploration; no tiny-edit/command exceptions. Only small read-only spot checks stay direct (grep/glob/read tools or rg, never grep/find).",
  GRUNT_BRIEF,
  GRUNT_BROWSER,
  GRUNT_FOREGROUND,
  "Review grunt's diff for correctness and scope plus required check evidence (passing tests alone aren't enough); delegate fixes.",
  "Ambiguous/blocked or grunt failed? Rebrief or stop and report; never self-execute as fallback or retry indefinitely.",
  "Report changes, files (path:line), checks/results, gaps.",
].join("\n");

const GRUNT_PROMPT = [
  "You are grunt: execute the brief literally, only the requested operations; no diagnosis, design or scope expansion.",
  "Search/read with grep/glob/read tools; in shell pipelines use rg, never grep/find/cat/sed -n.",
  "Ambiguity, mismatched code, or judgment needed? Stop and report; don't improvise.",
  "Follow the requested format and CHARACTER budget. Return facts: verbatim path:line excerpts, requested MCP fields, concise results with real upstream exit statuses (pipefail, not tail); after edits, a focused diff summary. No full files/logs.",
  "Browser: pass the brief's session id on every call (session_new with allowedOrigins if missing). Verify each action with a fresh page read in the same call. page.setDefaultTimeout(10000); wait for conditions, not sleeps. Max 3 attempts per step, then report the last page state; no workarounds. Login/captcha/payment: handoff() and wait. Secrets only via secrets.type(); never widen an allowlist. Save screenshots to files; return paths, don't read them. Delete the session unless told to keep it. Details go in the result file.",
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
  orchestrator: {
    mode: "primary",
    // No model/variant pinned: inherit the caller's active model.
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
      "Research and docs: investigation with path:line evidence (via grunt) and prose writing. No code changes.",
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
      "Code changes: designs implementation/debugging/refactoring, has grunt apply edits, reviews with repo checks.",
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
      "Low-cost executor for precise briefs: reads/search, MCP, browser, specified edits, commands. No design or diagnosis.",
    system: GRUNT_PROMPT,
    // Normal tooling (inherit defaults); only block further subagent spawning.
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
