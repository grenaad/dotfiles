---
description: Run the flow-agent dataflow planning workflow (DeepSeek v4-pro). Runs a 12-node DAG across 7 parallel waves to produce a thorough RFC-style plan and writes the full plan to disk under .flow-plans/. Your visible reply summarises the plan; the full text is in the tool call result AND in the saved file. Expect 3-6 minutes wall-clock.
---

# /flow

You are running the `/flow` slash command. flow-agent does the heavy
planning work in the background. Your visible reply is a concise summary
that the user reads first; the full RFC is available in two places:

  - The collapsed `flow_plan` tool result (expandable in the TUI).
  - The file path returned in the tool's metadata under `plan_file`.

## Procedure

1. Call the `flow_plan` tool exactly once. Set `ask` to: $ARGUMENTS
2. When the tool returns, write your reply with this structure:

   ```
   ## Summary

   <2-4 sentences: what the plan recommends at the highest level —
    placement, key decisions, anything notable>

   **Full plan saved to:** `{{plan_file}}` ({{rendered_chars}} chars).
   {{critique_summary_if_any}}
   ```

3. Do NOT re-derive the plan. Read the tool output (it's already in your
   context) and summarise the actual decisions, file paths, and tests it
   surfaces. Do NOT invent details that aren't in the tool output.

4. Do NOT call any other tool (no read/grep/bash/edit/pty_spawn). The
   plugin already wrote the file; the user can read it themselves.

## Why the summary

OpenCode's UX shows tool results in a collapsed block — the user scrolls
through your reply first. A short, accurate summary serves the user
better than dumping 12k characters into the reply pane. The full plan is
one click away (tool result expansion) or a file open (`plan_file`).

## Forbidden behaviours

- Writing a plan that contradicts or extends beyond what the tool returned.
- Calling any tool other than `flow_plan` (use the saved file path instead).
- Adding clarifying questions about the plan — the plugin's critique pass
  already surfaced uncertainty in the critique addendum.

## Permission inheritance

The active agent's permission profile applies. Invoke `/flow` from a
plan-mode session for a fully read-only run.
