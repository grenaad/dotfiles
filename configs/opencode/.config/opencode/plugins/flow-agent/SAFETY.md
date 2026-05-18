# flow-agent SAFETY

Notes on the operational hazards we discovered while bringing flow-agent up,
and the design decisions taken to mitigate them.

## 1. OpenCode agent frontmatter `permission:` is narrow-keyed, default-allow

The OpenCode `permission:` block on an agent's YAML frontmatter only
recognizes a fixed set of keys:

  - `edit`
  - `bash`
  - `webfetch`
  - `doom_loop`
  - `external_directory`

Source: `@opencode-ai/sdk/dist/gen/types.gen.d.ts` lines 857-865.

**Any other key is silently ignored.**

In particular:
  - Plugin-registered tools (e.g., `flow_plan` from this plugin, `pty_spawn`
    from the opencode-pty plugin) **cannot be gated via frontmatter**.
  - Built-in tools other than `edit`/`bash`/`webfetch` (like `read`, `grep`,
    `glob`, `task`) **cannot be gated via frontmatter**.

The agent shell we originally tried (`agents/flow.md`) listed
`flow_plan: allow / read: allow / grep: allow / glob: allow / edit: deny /
bash: deny / task: deny`, but only the `edit`/`bash` deny was actually
honoured. The DeepSeek model — when its desired tool was unavailable —
routed file mutations through `pty_spawn` (which was not denied because no
schema entry for it exists), and successfully appended code to plugin
source files without consent.

**Mitigation (current):** flow-agent is invoked via a slash command at
`command/flow.md`, not a primary agent. Slash commands run with the calling
agent's permission profile. Invoke `/flow ...` only from a plan-mode
session for a fully read-only run.

**Mitigation (defense-in-depth, future):**
  - Document this gap in the README.
  - Consider a `chat.params` hook that strips tools from the allowed set
    before they reach the model, if the OpenCode plugin SDK supports that.
  - Track upstream: this should arguably be a schema error or warning, not
    a silent ignore.

## 2. Plugin module-load errors are silently swallowed

If a plugin's `server` function throws at module load (or any imported
module throws at top-level evaluation), OpenCode logs nothing visible to
the user. The plugin simply does not load, and any tool it intended to
register is missing — usually causing the model to invent workarounds.

We hit this when `graph.ts` called `validateGraph()` at module load and
threw because Wave 2 had an intra-wave dependency. The flow-agent plugin
silently failed to register, the `flow_plan` tool was never offered, and
the model improvised dangerous workarounds (see Section 1).

**Mitigation (current):** the `init` log line at the very start of the
`server` function is our load-success canary. Always check
`~/.local/share/opencode/log/flow-agent.log` for a `kind:"init"` entry at
the timestamp of any opencode startup. If absent, the plugin didn't load.

**Mitigation (future):** wrap the entire `server` body in a try/catch that
logs the exception before re-throwing, so even failed loads leave a trace.

## 3. Concurrent helper sessions

The arc-agent helper pattern uses a single shared child session per main
session. That's safe because arc-agent's helper calls are sequential.

flow-agent's scheduler dispatches a wave's nodes via `Promise.all`. If they
all shared a single child session, the concurrent `promptAsync` calls would
race — the poll loop's "latest assistant message after start" heuristic
would conflate them, returning wrong outputs to wrong nodes.

**Mitigation (implemented):** `executor.ts` creates a fresh child session
per node call (`createNodeSession`). One `session.create` per node is
cheap (no model call, just a UUID) and gives perfect isolation. Each node's
prompt and output are independently inspectable in the OpenCode DB.

## 4. `--variant` is not exposed by the v1 plugin SDK

`opencode run --variant max` works at the CLI level, but the
`promptAsync` body in the v1 SDK has no `variant` field. The v2 SDK has it
but the plugin uses v1.

**Mitigation (current):** flow-agent pins only the model ID
(`deepseek/deepseek-v4-pro`) on each node call. All nodes run at provider
default reasoning effort. The `scout` vs `synthesize` tier still drives
the per-node timeout but does not differentiate variant.

**Mitigation (future):** revisit when the SDK exposes variant. Until then,
the design's promise of "many fast scouts + one slow synthesis" is
partial.

## 5. Plan-mode is the primary safety boundary

flow-agent's `flow_plan` tool runs DAG nodes via child sessions. Those
child sessions inherit the parent's project/directory but receive new
prompts authored by the plugin. The system prompt forces JSON-only output
and the prompts forbid tool calls (in spirit), but **the child sessions
still have access to whatever tools the parent agent allows**.

This means flow-agent only contains the blast radius if invoked from an
already-safe agent. Plan mode is the recommended choice.

If you must invoke from a non-plan agent, audit the tool list available
to that agent and accept the risk that DeepSeek's child sessions may
attempt file mutations if their prompts somehow incite it.

## 6. Long-running synthesis nodes

The `draft_plan` synthesis node has a 4-minute timeout. Empirically a
20k-char arc-agent plan takes 3-7 minutes on DeepSeek v4-pro-max. Plan for
the executor's deadline to bite occasionally; the node will return with
`timedOut=true` and the scheduler will continue with partial outputs.

When this happens repeatedly, raise `NODE_TIMEOUT_SYNTHESIZE_MS` in
`constants.ts` rather than adding retry logic.
