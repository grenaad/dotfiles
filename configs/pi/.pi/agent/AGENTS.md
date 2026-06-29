## MCP servers

All servers are **lazy** — they don't connect until a tool is invoked. Discover with
`mcp({ search: "..." })` or `mcp({ server: "name" })`, then call via
`mcp({ tool: "name", args: '{...}' })`. Prefer native pi tools (pi-lens, Read, Bash,
web_search) first; reach for an MCP server only when it's the right surface.

### Code & repositories

| Server     | Use for                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| `github`   | GitHub repos, issues, PRs, code search, file contents on remote repos         |
| `grep-app` | `searchGitHub` — find real-world code examples across 1M+ public repos        |
| `context7` | Up-to-date library/framework documentation and API references                 |
| `tldr`     | Code structure, call graphs, control/data flow (CFG/DFG/PDG) — see note below |

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

### tldr usage note

Not pinned to a directory — always pass an absolute `project` path in `args`
(default to cwd). Use for **CFG / DFG / PDG**, call-graph aggregation, and
token-efficient structure extraction. **Not** for find-references / go-to-definition /
outline — pi-lens handles those natively.
