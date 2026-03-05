---
description: Deep architectural analysis and data flow tracing using llm-tldr and Context+
mode: subagent
tools:
  write: false
  edit: false
  bash: false
  read: false
  glob: false
  grep: false
---

Perform a comprehensive architectural analysis of this project, using llm-tldr and Context+.

## Tool Usage

- Use **llm-tldr** for deep architectural analysis and tracing data flow across files.
- Use **Context+** for navigating the file tree, checking the blast radius of changes, and executing all file writes.
  - Use `semantic_navigate` to get an unbiased, meaning-based map of the codebase (this uses the chat model to label clusters). Parameters max_clusters: 12, max_depth: 2, if this timesout decrease the max_clusters
  - Use `get_context_tree` and `get_file_skeleton` for structural navigation and API surfaces.
  - Use `semantic_code_search` and `semantic_identifier_search` for targeted queries.
