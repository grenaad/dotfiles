## MCP servers

All servers are **lazy** — they don't connect until a tool is invoked. Discover with
`mcp({ search: "..." })` or `mcp({ server: "name" })`, then call via
`mcp({ tool: "name", args: '{...}' })`. Prefer native pi tools (pi-lens, Read, Bash,
web_search) first; reach for an MCP server only when it's the right surface.

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

### When to use subagents

Proactively delegate — don't wait to be asked — when a task matches:

- **Broad codebase recon** → `scout` (fast map, compressed handoff).
- **Multi-file implementation** → `worker` (forked context, keeps the main session clean).
- **Non-trivial design (3+ steps)** → `planner`, then hand the plan to `worker`.
- **Review a diff, plan, or decision** → `reviewer`; reserve `oracle` for deep, high-stakes checks.
- **Focused web research** → `researcher`.
- **Context gathering for a handoff** → `context-builder` or `scout`.

Keep the main session in control: delegate independent/heavy legs, fan out in
parallel when work is independent, and integrate results yourself.

### Model routing

When delegating with `pi-subagents`, **default to Sonnet** (`anthropic/claude-sonnet-4-6`)
and bump the model up only when the task's reasoning complexity warrants it.

| Model                         | Subagents                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `anthropic/claude-sonnet-4-6` | `scout`, `delegate`, `researcher`, `context-builder`, `reviewer`, routine `worker`  |
| `anthropic/claude-opus-4-5`   | `planner`, complex `worker` (also `context-builder`/`reviewer` when large/critical) |
| `anthropic/claude-opus-4-8`   | `oracle` — reserve for deep trajectory calls; overkill elsewhere                    |

Set it per run via the tool call:

```typescript
subagent({
  agent: "scout",
  task: "Map the auth flow",
  model: "anthropic/claude-sonnet-4-6",
});

subagent({
  agent: "oracle",
  task: "Review this architecture decision",
  model: "anthropic/claude-opus-4-5",
});
```

## Peer sessions (pi-intercom)

For a long-lived, visible worker/planner split, spawn a second `pi` instance in a
tmux window. Any pi session with `pi-intercom` loaded auto-connects to the
same-machine broker on startup — no manual pairing.

Choose a descriptive name for the task and use it for **both** the tmux window
(`-n`) and the pi session name (`/name`). Pick it from the work at hand — e.g.
`research`, `auth-worker`, `docs-review` — not a generic `pi-worker`.

```bash
# open a new tmux window in the current session running pi in this repo
# swap `research` for a name that describes the task
tmux new-window -c "$(pwd)" -n research 'pi'
```

Then name the pi session to match, so it is targetable over intercom:

```text
/name research          # run inside the new session; use the same name as -n above
```

The `-n` value is the tmux window label; `/name` is the pi/intercom session name
that `intercom({ to: "..." })` targets. Keep them identical to avoid confusion.

```typescript
intercom({ action: "list" }); // discover peers + live status
intercom({
  action: "send",
  to: "research",
  message: "Take task X. Ask if blocked.",
});
intercom({ action: "ask", to: "research", message: "Status on task X?" }); // blocks up to 10 min
```

Intercom is same-machine only. Verify a session joined with
`intercom({ action: "status" })`. Prefer `cmux new-split right` when available for
a side-by-side view; use tmux as the fallback.
