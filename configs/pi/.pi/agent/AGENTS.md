## Orchestrator role

The main Pi session is the orchestrator, not a worker. It should do meta work only:
coordinate, brief, dispatch, synthesize, and report. Delegate actual work to
subagents/minions instead of doing it directly in the orchestrator session.

Actual work includes implementation, exploration, discovery, codebase search,
reading files to understand a problem, MCP calls, and even small edits. Task size
is not a reason for the orchestrator to do work directly; exploration is work and
should be delegated.

Direct orchestrator tool use is limited to coordination overhead: quick read-only
checks that improve a delegation brief, verifying subagent results, checking
coordination state, or synthesizing final results. Launch subagents in the
background so the orchestrator remains available; do not poll unless the current
turn must block to finish the user response.

## MCP servers

All servers are **lazy** — they don't connect until a tool is invoked. Discover with
`mcp({ search: "..." })` or `mcp({ server: "name" })`, then call via
`mcp({ tool: "name", args: '{...}' })`. Prefer native pi tools (pi-lens, Read, Bash,
web_search) first; reach for an MCP server only when it's the right surface. This
guidance is primarily for delegated subagents/minions; the orchestrator should use
MCP only for coordination-only verification or final synthesis.

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

### Model routing

All subagents must use `model: "openai-codex/gpt-5.5"`. This model has been
verified to launch successfully. Use a different model only when the user
explicitly requests it or when `openai-codex/gpt-5.5` is unavailable.

```typescript
subagent({
  agent: "scout",
  task: "Map the auth flow and report the key files and risks.",
  model: "openai-codex/gpt-5.5",
  async: true,
});
```

### Minion / worker conventions

Execution subagents are leaf workers: do not delegate further. Complete the
assigned task using the available tools, inspect before making assumptions, make
targeted changes, verify when feasible, and report blockers or ambiguity instead
of guessing. Keep final responses concise with a summary, changed files,
blockers, and any verification gaps.

## Peer sessions (pi-intercom)

For a long-lived, visible worker/planner split, open a second `pi` instance in a
tmux window. Any pi session with `pi-intercom` loaded auto-connects to the
same-machine broker — no pairing. Use one descriptive, task-based name (e.g.
`research`, `auth-worker`) for **both** the tmux window (`-n`) and the pi session
(`/name`) so `intercom({ to })` can target it.

```bash
tmux new-window -c "$(pwd)" -n research 'pi'   # open the instance
```

```text
/name research                                 # run inside it; match the -n name
```

Then coordinate over intercom:

```typescript
intercom({ action: "list" }); // discover peers
intercom({ action: "send", to: "research", message: "Take task X." });
intercom({ action: "ask", to: "research", message: "Status on X?" }); // blocks up to 10 min
```

Same-machine only; verify with `intercom({ action: "status" })`. Prefer
`cmux new-split right` when available, tmux otherwise.
