## Orchestrator role

The root Pi session handling the original human request is the orchestrator, not a
worker. It should do meta work only: coordinate, brief, dispatch, synthesize, and
report. Delegate actual work — to subagents/minions for filesystem/Bash work, and
to **peer `pi` sessions for MCP tool calling** — instead of doing it directly in the
orchestrator session.

Actual work includes implementation, exploration, discovery, codebase search,
reading files to understand a problem, MCP calls, and even small edits. Task size
is not a reason for the orchestrator to do work directly; exploration is work and
should be delegated. **The orchestrator does not run MCP tool calls** — those go to
a peer `pi` session (subagents have no MCP access); see
[MCP servers](#mcp-servers) and [Peer sessions](#peer-sessions-pi-intercom).

Direct orchestrator tool use is limited to coordination overhead: quick read-only
checks that improve a delegation brief, verifying subagent results, checking
coordination state, or synthesizing final results. Launch subagents in the
background so the orchestrator remains available; do not poll unless the current
turn must block to finish the user response.

## MCP recursion guard

The “do not call MCP directly” rule applies only to the root/orchestrator session
handling the original human request.

If this session receives a delegated task over pi-intercom, it is the worker peer
for that task. It should perform the requested MCP calls directly in this session
and must not open another Pi session just to make MCP calls.

Example: if `forge-worker` receives “use fd-forge MCP to inspect X”, then
`forge-worker` calls `mcp(...)` itself. It does not open another Pi instance.

## MCP servers

All servers are **lazy** — they don't connect until a tool is invoked. Discover with
`mcp({ search: "..." })` or `mcp({ server: "name" })`, then call via
`mcp({ tool: "name", args: '{...}' })`. Prefer native pi tools (pi-lens, Read, Bash,
web_search) first; reach for an MCP server only when it's the right surface.

> **MCP tool calls belong to peer `pi` sessions, not the root orchestrator.**
> The orchestrator coordinates — it should **not** run MCP tool calls itself. Subagents
> can't either: they run with **no MCP gateway** (`MCP_DIRECT_TOOLS=__none__`) and
> **cannot** call `mcp(...)`. So MCP-dependent work (e.g. `github`, `fd-forge*`,
> `linear`, `datadog`, `notion`, `playwright`) must be delegated to a **peer `pi`
> session** over pi-intercom — a full pi instance that *does* load MCP — see
> [Peer sessions](#peer-sessions-pi-intercom). If this session is that delegated
> peer, it should call `mcp(...)` directly and must not open another Pi session for
> MCP. Peer sessions run `openai-codex/gpt-5.5` with medium thinking effort, same
> as subagents. Never dispatch a subagent for MCP-dependent work (it will stall
> and escalate); the orchestrator's own MCP use is limited to the bare minimum
> needed to brief/verify a peer when no peer is available yet.

> **GitHub URLs → prefer the `github` server.** When the user gives a
> `github.com` link (repo, issue, PR, commit, diff/changes, file blob, or code
> search), prefer the `github` MCP server over `fetch_content`/`web_search`.
> Parse owner/repo/number from the URL and call the matching tool (e.g. a PR →
> `get_pull_request` plus `get_pull_request_files`/`...diff`). Fall back to a
> plain web fetch only if the `github` tools can't serve the request.

### Code & repositories

| Server     | Use for                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `github`   | GitHub repos, issues, PRs, code search, file contents — and any github.com URL |
| `grep-app` | `searchGitHub` — find real-world code examples across 1M+ public repos         |
| `context7` | Up-to-date library/framework documentation and API references                  |

### Project & work management

| Server           | Use for                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `linear`         | Linear issues, projects, cycles — read and update tickets                                                                                  |
| `notion`         | Search Notion workspace, read/create pages, query databases                                                                                |
| `float`          | Float.com time tracking — list/create/delete time entries (7 tools)                                                                        |
| `fd-forge`       | Focaldata survey platform (**prod**, `forge.focaldata.com`) — create/launch surveys, questionnaires, fieldwork, quotas, results — see note |
| `fd-forge-dev`   | Same platform, **dev** environment (`forge.focaldata.dev`)                                                                                 |
| `fd-forge-local` | Same platform run **locally** (`localhost:8080`) — connects to dev by default, can point to prod if needed                                 |

### Infrastructure & cloud

| Server         | Use for                                                             |
| -------------- | ------------------------------------------------------------------- |
| `datadog`      | Logs, metrics, monitors, traces, dashboards (Datadog EU, 148 tools) |
| `kubefwd`      | Forward K8s services to localhost; diagnose connections (28 tools)  |
| `digitalocean` | DigitalOcean droplets, databases, apps, networking (198 tools)      |

### Browser, memory & local

| Server       | Use for                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| `playwright` | Browser automation via Chrome extension — navigate, click, screenshot                                 |
| `mempalace`  | Local-first AI memory store (github.com/mempalace/mempalace) — persist/recall context across sessions |
| `open`       | Local server on `localhost:18081` <!-- TODO: confirm purpose -->                                      |

## Subagents

Use subagents for the work itself. The orchestrator should keep control of the
plan, delegation brief, and final synthesis while subagents perform exploration,
research, implementation, review, and other task execution.

Proactively delegate — don't wait to be asked:

- **Broad codebase recon** → `scout` (fast map, compressed handoff).
- **Implementation, including small edits** → `worker` (forked context, keeps the main session clean).
- **Non-trivial design (3+ steps)** → `planner`, then hand the plan to `worker`.
- **Review a diff, plan, or decision** → `reviewer`; reserve `oracle` for deep, high-stakes checks.
- **Focused web research** → `researcher`.
- **Context gathering for a handoff** → `context-builder` or `scout`.

Fan out in parallel when legs are independent, then integrate the results
yourself. Launch subagents in the background with `async: true` so the
orchestrator remains available; only poll or block when the current user response
cannot be completed without the result.

> **Exception — MCP tool calling.** Subagents have **no MCP access**, so never
> delegate MCP-dependent work (GitHub/Linear/Datadog/Notion/Playwright/fd-forge
> etc.) to a subagent. From the root/orchestrator session, delegate it to a **peer
> `pi` session** over pi-intercom instead — not to the orchestrator, which should
> not run MCP calls itself — see [Peer sessions](#peer-sessions-pi-intercom). If you
> are the peer that received the intercom task, call MCP directly in this session
> and do not delegate it onward. A subagent given an MCP task will stall and
> escalate. Subagents remain the right tool for filesystem/Bash work: code recon,
> edits, reading files, running tests/builds.

### Model routing

All subagents **and peer `pi` sessions** must use `openai-codex/gpt-5.5` with
medium thinking effort. For subagent calls, use the documented model-pattern
suffix form in `model`: `"openai-codex/gpt-5.5:medium"`. This model and effort
combination has been verified to launch successfully. Use a different model only
when the user explicitly requests it or when `openai-codex/gpt-5.5` is unavailable.

```typescript
subagent({
  agent: "scout",
  task: "Map the auth flow and report the key files and risks.",
  model: "openai-codex/gpt-5.5:medium",
  async: true,
});
```

Launch peer sessions on the same model with medium thinking effort (see
[Peer sessions](#peer-sessions-pi-intercom)):

```bash
tmux new-window -c "$(pwd)" -n forge-worker 'pi --model openai-codex/gpt-5.5 --thinking medium'
```

### Minion / worker conventions

Execution subagents are leaf workers: do not delegate further. Complete the
assigned task using the available tools, inspect before making assumptions, make
targeted changes, verify when feasible, and report blockers or ambiguity instead
of guessing. Keep final responses concise with a summary, changed files,
blockers, and any verification gaps.

## Peer sessions (pi-intercom)

Use a peer `pi` session (not a subagent) when the delegated work needs **MCP tool
calling** or a long-lived, visible worker/planner split. Because a peer is a full
`pi` instance, it loads the MCP servers that subagents lack — so **MCP-dependent
delegation (GitHub, `fd-forge*`, Linear, Datadog, Notion, Playwright, …) must go to
a peer session, not a subagent.** Verify the peer actually has the server before
relying on it (`intercom` → ask it to run `mcp({ server: "..." })`).

Only the root/orchestrator session should open peer Pi sessions. Before opening a
new peer, run `intercom({ action: "list" })` and reuse an existing idle peer in the
right cwd when available. A peer that receives an intercom task is a leaf worker
for that task and should call MCP directly when MCP is needed, rather than opening
another peer.

Open a second `pi` instance in a tmux window, **launched on
`openai-codex/gpt-5.5` with `--thinking medium`** (same model and effort as
subagents — see [Model routing](#model-routing)). Any pi session with
`pi-intercom` loaded auto-connects to the same-machine broker — no pairing. The
shorthand `--model openai-codex/gpt-5.5:medium` is equivalent, but examples use
the explicit flag form.

```bash
tmux new-window -c "$(pwd)" -n forge-worker 'pi --model openai-codex/gpt-5.5 --thinking medium'   # open the peer
```

Give the tmux window a descriptive `-n` name for your own navigation, and
optionally set a matching session label inside the peer:

```text
/name forge-worker                             # sets the peer's local label
```

> **Target peers by the id from `intercom list`, not by the `/name` label.**
> Verified on pi v0.80.3: `/name` updates the peer's own status bar but the broker
> still lists (and routes to) the peer under its **auto-generated session id** (e.g.
> `subagent-chat-019f411c`). Addressing `intercom({ to: "forge-worker" })` fails with
> "Session not found". Always run `intercom({ action: "list" })` first and copy the
> exact session identifier it shows, then use that as `to`.

Then coordinate over intercom:

```typescript
intercom({ action: "list" }); // discover peers — copy the exact session id it prints
intercom({ action: "send", to: "subagent-chat-019f411c", message: "Take task X." });
intercom({ action: "ask", to: "subagent-chat-019f411c", message: "Status on X?" }); // blocks up to 10 min
```

Same-machine only; verify with `intercom({ action: "status" })`. Prefer
`cmux new-split right` when available, tmux otherwise.
