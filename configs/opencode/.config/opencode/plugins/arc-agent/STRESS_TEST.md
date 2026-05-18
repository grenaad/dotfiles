# arc-agent v0.2 compression-branch stress test

Goal: trigger the `plan_bucket: "compress"` path so we observe the plugin's
`compressPlanForReview` helper firing end-to-end.

Current empirical sample: 4 orchestrator runs, none produced a plan >20k.
v0.11's length budgets in the planner prompt are effective at keeping plans
in the 12-20k range even for moderately complex tasks like the FastAPI
pydantic-app prompt. We need a deliberately larger task.

## Test prompt

Use a fresh orchestrator session on **DeepSeek-v4-pro** (variant `max`).
Opus 4.7 produces ~12k plans naturally; will not exceed 20k.

Paste this prompt verbatim:

```
Build a multi-tenant SaaS billing platform in Python. Requirements:

- Usage metering: track per-tenant API calls, storage GB-hours, and bandwidth
  per billing cycle. Idempotent ingestion. Backfill support.
- Pricing engine: tiered pricing per resource, per-tenant custom contracts,
  promotional credits, free-tier carve-outs.
- Invoicing: monthly close, proration on plan changes, tax computation
  (configurable per jurisdiction), PDF generation, immutable invoice
  history.
- Dunning: failed-payment retry schedule, grace periods, account
  suspension/reactivation, customer notifications.
- Self-serve portal: tenants view current usage, download invoices, update
  payment methods, change plans.
- Admin: define products/plans, view aggregate revenue, issue credits/refunds.

Use FastAPI, Postgres, Stripe for payments, Celery for async jobs.
Production-deployable. Include observability and idempotency throughout.
```

## What to expect

Phase 1.5 clarifications will fire (Open Questions on payment provider scope,
tax-engine choice, deployment target, etc.). Answer with whatever makes
sense — the test isn't about the answers, it's about whether the resulting
plan exceeds 20k chars.

## Success criteria

After the orchestrator session completes (or hits the verdict gate), check
`~/.local/share/opencode/log/arc-agent.log` for entries with the new session
id. The successful outcome is **any of**:

1. **Compression branch fires**: log shows `kind: "tool.execute.after"`,
   `subagent: "plan"`, `plan_bucket: "compress"`, `compressed: true`.
   This is what we want to see.
2. **Compression branch fires but sanity-check rejects output**: log shows
   `kind: "helper"`, `helper_call: "compress_plan"`,
   `sanity_check_failed: true`. Means the compression prompt needs tuning.
3. **Compression branch fires but helper times out**: log shows
   `kind: "helper"`, `helper_call: "compress_plan"`,
   `helper_timeout: true`. Means we may need to extend
   `COMPRESS_TIMEOUT_MS` past 90s for genuinely large plans.

Any of (1), (2), or (3) tells us the code path works; we adjust based on
which we see.

If the plan stays under 20k anyway (`plan_bucket: "above"`), the test
*technically* failed to exercise compression, but is itself a data point
suggesting v0.11 length budgets are effective enough that the compress
branch is rarely reached. In that case we could:

- Try an even bigger task (LSP server, monolith migration)
- Or lower `PLAN_BUCKETS` `above.max` from 20_000 to 15_000 so smaller plans
  trigger compress

## Helper latency optimization confirmation

Independent of compression, this run will tell us whether v0.2's pre-filter
+ frame-skip works. Compare:

| Subagent | Expected log entry |
|---|---|
| frame | `pre_filter_skip: true`, no helper log line for `strip_open_questions` |
| librarian, explore, edgecases | likely `pre_filter_skip: true` if framing has no Open Questions heading; otherwise normal strip |
| plan | likely `pre_filter_skip: true` (orchestrator already stripped) |
| review | likely `pre_filter_skip: true` (orchestrator scrubbed before forwarding) |

If we see `pre_filter_skip: true` on most prompts, latency drops from ~9 min
(v0.1) to roughly the cost of compression alone (~60-90s if it fires once).

## Inspection commands

After the session, capture the session_id and run:

```bash
# Full plugin log for the session
jq -r 'select(.session=="<SESSION_ID>")' ~/.local/share/opencode/log/arc-agent.log
```

```sql
-- Per-call prompt sizes from OpenCode DB
SELECT
  json_extract(data,'$.state.input.subagent_type') AS sub,
  LENGTH(json_extract(data,'$.state.input.prompt')) AS prompt_chars,
  LENGTH(json_extract(data,'$.state.output')) AS output_chars
FROM part
WHERE session_id = '<SESSION_ID>'
  AND json_extract(data,'$.tool') = 'task'
ORDER BY time_created;
```

Cross-reference plugin-log `final_chars` against DB `prompt_chars` — they
should match for each task call.
