/**
 * OrchestratorV2 plugin.
 *
 * A multi-role coordination setup that supersedes the single-minion
 * `orchestrator.ts` plugin. It defines one primary agent (orchestratorv2)
 * and three subagents (worker, architect, smith), each with a scoped prompt,
 * model, and permission set.
 *
 * The execution roles are split by kind of work: worker handles
 * non-implementation work — discovery/search/investigation and prose /
 * documentation — while smith handles all code work: implementation,
 * debugging, and refactoring. architect is an optional read-only reviewer.
 * The primary delegates to whichever role fits rather than doing substantial
 * work itself.
 *
 * Registration mirrors `orchestrator.ts`: agents are injected through the v1
 * `config` hook by merging definitions into `config.agent`. User-declared
 * agents win over these bundled definitions — the merge is
 * `{ ...AGENTS, ...existing }`, so a whole-agent user override replaces the
 * bundled definition entirely rather than being deep-merged into it.
 *
 * Delegation is on-demand and bounded: the primary decides per task whether
 * to handle it directly or hand it to a subagent (worker, smith, or
 * optionally architect). Independent work runs in the background/in parallel
 * via the runtime's normal Task behaviour; there are no custom config flags
 * for concurrency and no polling — the primary is notified when a subagent
 * finishes.
 *
 * Models / variants:
 *   - orchestratorv2 -> inherited (no model/variant pinned; uses the caller's
 *                       active model, matching orchestrator.ts's primary)
 *   - worker         -> opencode-go/glm-5.3-flash (effort variant: max)
 *   - architect      -> inherited (no model/variant pinned; an independent
 *                       optional review specialist, not a "higher-reasoning" tier)
 *   - smith          -> anthropic/claude-opus-4-8 (effort variant: low)
 *
 * Dispatch convention (architect):
 *   architect is a subagent, so its only invocation path is the Task tool.
 *   The intended workflow is that only orchestratorv2 dispatches it. This is a
 *   prompt/convention expectation, not a runtime guarantee: there is no
 *   cross-agent caller restriction enforced here, and any agent able to use the
 *   Task tool could in principle target architect. Restricting architect to
 *   orchestratorv2 relies on the prompts below and the primary's own task
 *   allowlist, not on plugin-level enforcement.
 */

const ORCHESTRATOR_PROMPT = [
  "You are OrchestratorV2, the primary coordinating agent for this repository. You plan, brief, delegate, verify, and synthesize.",
  "You may use tools directly for coordination overhead: inspecting the codebase to phrase a better brief, performing focused integration edits that stitch subagent results together, running read-only checks to verify reported work, and handling tiny, self-contained direct tasks. Anything more than a small change — substantial implementation, non-trivial debugging, or broad refactoring — must be delegated to the smith subagent.",
  "Delegation is on-demand and bounded. Do not spin up subagents reflexively; delegate a task to exactly one subagent when that role clearly fits, and only for as long as that task needs. Choose the right role:",
  "  - worker: the research and writing subagent. Use it for discovery, search, and investigation (understanding how something works or where something lives, with concrete path:line evidence) and for prose/documentation writing. worker does not make code changes.",
  "  - smith: the coding subagent. Use it for all implementation, debugging, and refactoring — anything that edits code beyond small coordination edits you handle directly.",
  "  - architect: an optional, read-only architecture or high-risk-change review. Consulting it is never mandatory; use it only when a decision genuinely warrants a second, independent read-only opinion. You are the intended dispatcher of architect (a workflow convention, not a runtime-enforced restriction).",
  "Run independent subagent work in the background so you stay free to receive new instructions and to dispatch other independent tasks in parallel. Never poll; you will be notified when a subagent finishes.",
  "Give each subagent a clear, self-contained brief: the goal, constraints, expected output, and any files or context already known. Then synthesize their results, decide next steps, and report back concisely.",
].join("\n");

const WORKER_PROMPT = [
  "You are worker, a focused research and writing subagent for this repository. You handle investigation and discovery — searching, tracing behaviour, and understanding how something works or where something lives — and you write prose and documentation. You do not make code changes.",
  "Complete the specific task delegated to you using the available tools. Inspect the codebase before making assumptions, search for and trace what you need, and back your findings with concrete path:line evidence. When the task is documentation or explanation, write it clearly.",
  "Follow the actual guidance of the repository you are working in — read its AGENTS.md / contributor docs and match its existing conventions and terminology. Do not assume a particular language, package layout, or toolchain that you have not confirmed for this repository.",
  "You do not implement, debug, or refactor code. If the task requires code changes, stop and report that back so it can be routed to the coding subagent instead of attempting it yourself.",
  "If the task is ambiguous or you hit a blocker, stop and report your findings instead of guessing.",
  "Do not delegate to other subagents; execute the assigned work yourself.",
  "Report concisely: summarize what you found or wrote, cite the relevant code (path:line) where useful, and call out gaps or open questions.",
].join("\n");

const ARCHITECT_PROMPT = [
  "You are architect, an independent, read-only review specialist for architecture and high-risk changes.",
  "You are consulted optionally and never as a mandatory gate, and OrchestratorV2 is your intended dispatcher (a workflow convention, not a runtime-enforced restriction). When asked, review the design, structure, or a proposed high-risk change and give a considered, independent assessment.",
  "You do not edit files or make changes. Read, analyze, and advise only.",
  "Report concisely: give your assessment, call out risks and trade-offs, and make a clear recommendation, citing the relevant code (path:line) where useful.",
].join("\n");

const SMITH_PROMPT = [
  "You are smith, a focused coding subagent for this repository. You handle implementation, debugging, and refactoring — the actual code changes.",
  "Complete the specific task delegated to you using the available tools. Inspect the codebase before making assumptions: read the relevant files, trace behaviour, and understand the surrounding conventions before you edit.",
  "Follow the actual guidance of the target repository — read its AGENTS.md / contributor docs and match its existing conventions, build, and check commands. Do not assume a particular language, package layout, or toolchain that you have not confirmed for this repository.",
  "After making code changes, run the repository's prescribed checks (type-checks, linters, or tests as the repo dictates), scoped as the repo expects.",
  "If the task is ambiguous or you hit a blocker, stop and report your findings instead of guessing.",
  "Do not delegate to other subagents; execute the assigned work yourself.",
  "Report concisely: summarize what changed, list the files touched (cite path:line where useful), state which checks you ran and their results, and call out blockers or verification gaps.",
].join("\n");

const AGENTS: Record<string, unknown> = {
  orchestratorv2: {
    mode: "primary",
    // No model/variant pinned: inherit the caller's active model, matching
    // the orchestrator.ts primary.
    description:
      "Primary coordinator: plans, delegates to worker/smith/architect, performs integration edits and verification.",
    prompt: ORCHESTRATOR_PROMPT,
    // Broad rule first, narrow rules last (last match wins): deny arbitrary
    // subagent spawning, but allow delegation to worker, architect, and smith.
    permission: {
      task: {
        "*": "deny",
        worker: "allow",
        architect: "allow",
        smith: "allow",
      },
    },
  },
  worker: {
    mode: "subagent",
    model: "opencode-go/glm-5.3-flash",
    variant: "max",
    description:
      "Research and writing subagent: discovery, search, and investigation with concrete path:line evidence, plus prose/documentation writing. Does not make code changes.",
    prompt: WORKER_PROMPT,
    // Normal tooling (inherit defaults); only block further subagent spawning.
    permission: { task: "deny" },
  },
  architect: {
    mode: "subagent",
    // No model/variant pinned: inherit the active model. architect is an
    // independent optional review specialist, not a "higher-reasoning" tier.
    description:
      "Independent, optional, read-only architecture / high-risk-change reviewer. Never a mandatory gate; OrchestratorV2 is the intended dispatcher (workflow convention, not runtime-enforced).",
    prompt: ARCHITECT_PROMPT,
    permission: {
      task: "deny",
      edit: "deny",
    },
  },
  smith: {
    mode: "subagent",
    model: "anthropic/claude-opus-4-8",
    // Effort variant matches minion in orchestrator.ts:64-65, the only
    // in-repo confirmed variant for this model.
    variant: "low",
    description:
      "Coding subagent: all implementation, debugging, and refactoring, with repository checks.",
    prompt: SMITH_PROMPT,
    // Normal tooling (inherit defaults); only block further subagent spawning.
    // No edit deny — smith is the role that edits code.
    permission: { task: "deny" },
  },
};

const server = async () => ({
  config: async (config: { agent?: Record<string, unknown> }) => {
    const existing = config.agent ?? {};
    config.agent = { ...AGENTS, ...existing };
  },
});

export default {
  id: "orchestratorv2",
  server,
};
