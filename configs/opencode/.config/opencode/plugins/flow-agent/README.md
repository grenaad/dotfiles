# flow-agent

OpenCode plugin: dataflow-graph planning workflow tuned for DeepSeek v4-pro-max.

**Status**: v0.1, experimental. See `SAFETY.md` before invoking.

## Concept

A fixed directed acyclic graph of 12 nodes, executed in 7 topological waves.
Most nodes are "scout" tier (one short structured prompt → JSON output).
One node (`draft_plan`) is "synthesize" tier (full plan body in one pass).
Nodes within a wave run concurrently via `Promise.all` over child sessions.
The final render is done deterministically in TypeScript — no extra model
call needed since it's just draft body + optional critique bullets.

```
Wave 0: understand_ask
Wave 1: scan_target_area | identify_patterns | enumerate_risks   (parallel)
Wave 2: decide_placement | decide_signature                      (parallel)
Wave 3: decide_integration                                       (serial; depends on placement)
Wave 4: list_test_cases  | list_failure_modes                    (parallel)
Wave 5: draft_plan                                               (synthesize tier; the one big DeepSeek pass)
Wave 6: critique_completeness | critique_traceability            (parallel; conditional — skipped when plan looks complete)
final:  scheduler.renderFinalPlan(outputs) — pure TS, no model call
```

## Invocation

From a plan-mode opencode session:

```
/flow <your planning request, e.g. "add tracing to the order pipeline">
```

The slash command (`command/flow.md`) calls the `flow_plan` tool. The
plugin orchestrates the DAG via child sessions pinned to
`deepseek/deepseek-v4-pro` and returns the final rendered markdown as the
tool result.

## When to use vs arc-agent (orchestrator)

| Use flow-agent when | Use arc-agent (orchestrator) when |
|---|---|
| You want the plan in one tool call, no markdown-driven step narration | You want explicit step-by-step narration and clarification dialogs |
| You prefer DeepSeek v4-pro-max as the planning model | You want Opus/Sonnet/configurable per task type |
| You're okay with the plan being assembled from many small scout passes | You want each subagent to be a full markdown-defined agent |
| You want resumable / per-node observability of model outputs | You want the full reasoning trail in one session DB |

flow-agent is optimised for *one specific model* (DeepSeek v4-pro-max) and
*one specific output shape* (RFC-style markdown plan). It's not a
replacement for arc-agent. Use whichever fits the task.

## Logs

`~/.local/share/opencode/log/flow-agent.log` — JSONL with per-node and
per-wave timing. Each session's full prompt/response history is also in
the OpenCode DB under titles `flow-agent:<node_name>`.

## Environment

Disable with `FLOW_AGENT_DISABLED=1`.
