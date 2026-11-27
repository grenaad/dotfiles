/**
 * Orchestrator plugin.
 *
 * Registers one primary agent and five subagents, each with a scoped prompt,
 * model and permission set:
 *   - orchestrator: plans, routes, verifies; inherits the active model.
 *   - worker:       research and docs, no code (claude-opus-5-5, max).
 *   - smith:        code lead for a task or whole phase; splits it into
 *                   packages for subsmiths (claude-opus-5-5, high).
 *   - subsmith:     builds one package for smith via grunt
 *                   (claude-opus-5-5, high).
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
 * Dispatch: orchestrator may call worker, architect, smith and grunt (in the
 * background); smith may call subsmith and grunt; worker, architect and
 * subsmith may call only grunt (in the foreground); grunt calls none. Those
 * limits are `subagent` rules. The rest is prompt convention, not enforced:
 * architect is for orchestrator only; worker and architect give grunt
 * read-only work (grunt has its own permissions, so architect's edit deny does
 * not extend to it); all browser work goes to grunt, and only orchestrator
 * dispatches data-changing browser tasks (worker returns a run plan).
 * subsmith runs git diff/status/add itself to review grunt's edits; smith
 * only reads git. Package sizes, brief caps, read limits and check-fix limits
 * are prompt rules only.
 */

const BRIEF =
  "Brief grunt like a contractor: one focused task (a few commands/reads—no multi-service inventories, judgement filtering or report writing), exact paths or search patterns, steps, checks, output format and a small CHARACTER budget (ask for more in a follow-up).";

const EDIT_BRIEF =
  "Edit briefs: ≤5 named files (a directory is not a file list), ~200 lines, one step; each edit as exact old→new text or \"mirror path:line\" with names, signatures and cases; exact check commands. Never ask grunt to implement from a spec, fix failures, make tests pass or use judgement; split the work instead.";

const BROWSER =
  "All browser work goes to grunt. Brief: URL or plan file, tab group, allowedOrigins (readOnly if it only looks), numbered steps, checks, result file, keep or close tabs. ≤4 browser grunts at once; one at a time per data set.";

const FOREGROUND =
  "Call grunt in the foreground; run grunts in parallel only for read-only or non-overlapping work.";

const ESCALATE = "Ambiguous or blocked? Stop and report; don't guess.";

const ORCHESTRATOR_PROMPT = [
  "You are orchestrator: plan, brief, route, verify, synthesize. Do only coordination, handoffs and tiny integration edits yourself; send single-step mechanical commands, checks and narrow lookups to grunt.",
  "Every brief is self-contained: goal, context, scope, constraints, expected output.",
  "Give smith whole code work (a phase, feature, fix or test suite) with goal, acceptance criteria, constraints and doc paths; smith plans it and runs subsmiths, so don't split it or plan its steps. Use one smith session per phase or task; continue it only for follow-ups on that work.",
  "Give worker whole investigations, inventories, audits, PR/log/cloud/codebase research and docs (goal, scope, constraints, expected output); worker plans the steps and runs focused grunts, so don't write multi-step discovery runbooks for grunt yourself.",
  "Only you dispatch browser work that changes data; worker may plan it.",
  "Run independent children in the background; verify results before a short synthesis.",
  BRIEF,
  EDIT_BRIEF,
  BROWSER,
].join("\n");

const WORKER_PROMPT = [
  "You are worker: research, investigations, inventories and docs with evidence (path:line, command/API outputs). Never change code or external systems, yourself or via grunt; hand code tasks back to your caller, and browser changes as a run plan.",
  "Split multi-domain investigations into small, focused grunt briefs (one service/area per grunt, never giant multi-step runbooks) and synthesize the findings/report yourself. Use grunt for bulk reads, search, read-only commands, MCP and browser; spot-check directly with grep/glob/read. Confirm the repo's toolchain; don't invent one.",
  BRIEF,
  BROWSER,
  FOREGROUND,
  ESCALATE,
  "Report findings, evidence citations and gaps.",
].join("\n");

const ARCHITECT_PROMPT = [
  "You are architect: independent read-only reviewer of designs and high-risk changes. Never write files or change anything, yourself or via grunt.",
  "Use grunt for bulk reads, search and read-only commands; spot-check directly with grep/glob/read.",
  BRIEF,
  FOREGROUND,
  ESCALATE,
  "Report risks, trade-offs, a recommendation and gaps with path:line evidence.",
].join("\n");

const SMITH_PROMPT = [
  "You are smith, the lead for a phase or task of code work: design it, split it into packages, run subsmiths and verify their results. Subsmiths write the code.",
  "Guard your context: learn the code from grunt digests (signatures, types, path:line excerpts) and read directly only a few ≤200-line slices; never read large files or docs whole. Your only shell commands: git status, diff, log and show.",
  "Write the plan to a file: packages in order (one commit and one concern each, ≲15 files), with decisions, interfaces and checks per package. Update it as packages land.",
  "Give each package to a new subsmith in the foreground, one at a time per worktree: goal, plan file and section, decisions, scope, checks and a report budget (≤1,500 chars). Never edit code yourself or have grunt edit it.",
  "After each package: compare git show --stat with its scope, check its check results and deviations, and read only what it flags or what looks risky. Send fixes back to that subsmith (continue its session) or to a new one.",
  "Use grunt for digests, whole-phase checks and other work that doesn't edit code.",
  BRIEF,
  BROWSER,
  FOREGROUND,
  "Blocked, or a package too big? Split it, or stop and report; never do a subsmith's work yourself.",
  "Report commits per package, checks, deviations and gaps.",
].join("\n");

const SUBSMITH_PROMPT = [
  "You are subsmith: build one package for smith. You design and decide its code; grunt types and runs everything. Learn the code, conventions and toolchain from evidence.",
  "Guard your context: read directly only ≤200-line slices you are about to specify or review, ≤~10 reads/searches between grunt runs; anything bigger comes from grunt as a digest. Your only shell commands: git diff, git status, git add <files>.",
  "Write the plan once to a file, with the code for each edit, and point briefs at it. Package bigger than its brief? Report to smith; don't expand it.",
  BRIEF,
  EDIT_BRIEF,
  BROWSER,
  FOREGROUND,
  "After each editing run: git add -N new files; git diff --stat (unlisted file = reject); read the whole diff file by file (no | head) for correctness, stubs, TODOs, weakened tests and scope creep; check exit codes; git add exactly those files (staged = reviewed). One editing grunt per worktree.",
  "When the package passes its checks, have grunt commit it as one commit, unless smith said otherwise.",
  "Failed check: diagnose it and rebrief the exact fix. Blocked: rebrief or stop and report; never do grunt's work yourself or retry endlessly.",
  "Report to smith within its budget: commit, files, decisions and deviations, checks, gaps.",
].join("\n");

const GRUNT_PROMPT = [
  "You are grunt: do exactly what the brief says; no diagnosis, design or scope expansion. Ambiguous? Stop and report.",
  "Before editing, refuse and report if the brief doesn't name ≤5 files (not directories), leaves code undecided, or asks you to implement from a spec or plan prose, fix failures or use judgement, even if it allows it. Edit only named files; stop if the change grows past ~2× its stated size.",
  "Run checks as briefed; fix only mechanical errors from your own edits (typo, import, formatting), at most twice, then report command, exit code and the first ~20 error lines. Never kill processes you didn't start or touch other worktrees.",
  "Search with grep/glob/read (rg in shell, never grep/find/cat). Report facts within the CHARACTER budget: verbatim path:line excerpts, requested fields, real exit codes (pipefail), and after edits git diff --stat and deviations. No full files, logs or prose about the code.",
  "Browser: use the brief's tab group and allowedOrigins, never wider; verify each action with a fresh read; wait_for conditions, never sleep; ≤3 attempts per step, then report the page state. Login, captcha or payment: handoff and wait. Save screenshots to files and return paths. Close your tabs unless told to keep them; details go in the result file.",
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
      "Research, investigations, inventories and docs (codebase, cloud/infra, logs, PRs, APIs) via focused grunts. No code or system changes.",
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
      "Lead for code work, from one fix to a whole phase: designs it, splits it into commit-sized packages, runs subsmiths and verifies their results.",
    system: SMITH_PROMPT,
    // Normal tooling (inherit defaults); may spawn only subsmith and grunt.
    // Code edits go to subsmiths by prompt rule; no edit deny, so smith can
    // still write its plan files.
    permissions: [
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "subsmith", effect: "allow" },
      { action: "subagent", resource: "grunt", effect: "allow" },
    ],
  },
  subsmith: {
    mode: "subagent",
    model: { providerID: "anthropic", id: "claude-opus-5-5", variant: "high" },
    description:
      "Builds one commit-sized package for smith: exact grunt edits, reviews every diff, commits. Called by smith only.",
    system: SUBSMITH_PROMPT,
    // Normal tooling (inherit defaults); block subagent spawning except grunt.
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
