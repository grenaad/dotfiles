---
description: Deep architectural analysis and data flow tracing using llm-tldr and Context+
mode: subagent
tools:
  write: false
  edit: false
---

Perform a comprehensive architectural analysis of the giving project or this project, using llm-tldr and Context+.

## Tool Usage

- Use **llm-tldr** for deep architectural analysis and tracing data flow across files.
- Use **Context+** for navigating the file tree, checking the blast radius of changes, and executing all file writes.
- Use `semantic_navigate` to get an unbiased, meaning-based map of the codebase (this uses the chat model to label clusters). Parameters max_clusters: 12, max_depth: 2, if this timesout decrease the max_clusters
- Use `get_context_tree` and `get_file_skeleton` for structural navigation and API surfaces.
- Use `semantic_code_search` and `semantic_identifier_search` for targeted queries.

- Use **Context+** memory tools exclusively for all operations.
  - Use `search_memory_graph` FIRST to check what the graph already knows before doing any work.
  - Use `upsert_memory_node` to store discoveries as nodes (types: concept, file, symbol, note).
  - Use `create_relation` to link nodes with typed edges (depends_on, implements, references, relates_to, similar_to, contains).
  - Use `add_interlinked_context` to bulk-import multiple related nodes with auto-similarity linking.
  - Use `retrieve_with_traversal` to explore a specific node's neighborhood after finding it via search.
  - Use `prune_stale_links` to clean up decayed edges and orphan nodes when the graph gets large.
