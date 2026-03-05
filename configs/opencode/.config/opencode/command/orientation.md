---
description: Run a codebase orientation using Context+ and TLDR tools to build project context before making changes. Gets file structure, architecture layers, and symbol overview.

agent: plan
---

Codebase Orientation with Context+ and TLDR
At the start of a session involving code changes, run these tools to build context before making any edits:
Quick orientation (always do this)

1. mcp_tldr_tree — Get the project file structure. Use extensions filter (e.g. [".py"]) to reduce noise.
2. mcp_contextplus_get_context_tree — Get file headers and symbol names. Use depth_limit: 2 for large projects.
   When understanding architecture or data flow
3. mcp_tldr_arch — Identify architectural layers (entry/middle/leaf) and circular dependencies.
4. mcp_tldr_context — Follow a specific function's call graph to a given depth. Use this to trace data flow through layers.
   When searching for code by intent (not exact name)
5. mcp_contextplus_semantic_code_search — Find files by meaning (e.g. "user authentication" finds login/JWT code).
6. mcp_contextplus_semantic_identifier_search — Find specific functions/classes/variables by intent.
   Before modifying or deleting code
7. mcp_contextplus_get_blast_radius — Find every file and line where a symbol is imported or used.
8. mcp_tldr_impact — Find all callers of a function (reverse call graph).
   When investigating a specific file's API surface
9. mcp_contextplus_get_file_skeleton — Get function signatures, parameters, and return types without reading the full file.
   Principle: Use these tools to gather context before editing. Prefer targeted queries (context, impact, blast_radius) over broad searches once you know what you're looking for.
