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
