---
description: Deep code analysis and data flow tracing using llm-tldr and Context+
mode: subagent
tools:
  write: false
  edit: false
  bash: false
  contextplus_propose_commit: false
---

Perform a comprehensive architectural analysis of the given project or this project, using llm-tldr and Context+.

## Tool Usage

- Use **llm-tldr** for deep architectural analysis and tracing data flow across files.
  - `tldr_tree` — project file structure
  - `tldr_arch` — architectural layers and circular dependencies
  - `tldr_context` — follow a function's call graph to trace data flow
  - `tldr_impact` — find all callers of a function (reverse call graph)
- Use **Context+** for navigating the file tree and checking the blast radius of changes.
  - `contextplus_semantic_navigate` — meaning-based map of the codebase (use max_clusters: 12, max_depth: 2; decrease max_clusters if it times out)
  - `contextplus_get_context_tree` — file headers and symbol names
  - `contextplus_get_file_skeleton` — function signatures, parameters, return types
  - `contextplus_semantic_code_search` — find files by meaning
  - `contextplus_semantic_identifier_search` — find functions/classes/variables by intent
  - `contextplus_get_blast_radius` — find every file and line where a symbol is used

- Use **Context+** memory tools to persist discoveries.
  - `contextplus_search_memory_graph` FIRST to check what the graph already knows before doing any work.
  - `contextplus_upsert_memory_node` to store discoveries as nodes (types: concept, file, symbol, note).
  - `contextplus_create_relation` to link nodes with typed edges (depends_on, implements, references, relates_to, similar_to, contains).
  - `contextplus_add_interlinked_context` to bulk-import multiple related nodes with auto-similarity linking.
  - `contextplus_retrieve_with_traversal` to explore a specific node's neighborhood after finding it via search.
  - `contextplus_prune_stale_links` to clean up decayed edges and orphan nodes when the graph gets large.


