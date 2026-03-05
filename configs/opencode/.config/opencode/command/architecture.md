---
description: Perform a comprehensive architectural analysis using llm-tldr and Context+
agent: code_analyzer
---

Perform a comprehensive architectural analysis of this project. Cover the following:

1. **Project Overview**: Identify what this project is (name, purpose, tech stack).
2. **Semantic Map**: Use `contextplus_semantic_navigate` first to discover conceptual groupings across the codebase, then validate against the directory structure.
3. **Directory Structure**: Map out the top-level and key nested directory structure, identifying the role of each major directory.
4. **Package Organization**: Identify all packages, their purposes, and inter-dependencies.
5. **Core Architecture Patterns**: Identify the main architectural patterns (e.g., client-server, event-driven, plugin architecture).
6. **Data Flow**: Use `tldr_context` to trace how data flows through the system — from entry points to core logic to output. Trace across file boundaries.
7. **Key Technologies & Dependencies**: List the main frameworks, libraries, and tools used.
8. **Build & Development Setup**: Identify the build system, test framework, and development tooling.
9. **Entry Points**: Identify the main entry points for the application and any CLI commands.
10. **Database/Storage Layer**: Identify how data persistence works.
11. **API Surface**: Identify any APIs (REST, WebSocket, SDK, etc.) exposed by the project.

Return a detailed architectural summary covering all the above points. $ARGUMENTS
