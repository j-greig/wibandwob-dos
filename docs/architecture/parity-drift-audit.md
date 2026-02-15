# Phase 1 Drift and Authority Audit (E001/F01/S01)

## Command Definition Surfaces (Current)

1. Turbo Vision menu command IDs and handlers are defined in C++:
   - `app/test_pattern_app.cpp:126` (command constants)
   - `app/test_pattern_app.cpp:677` (command dispatch switch)
   - `app/test_pattern_app.cpp:1655` (menu item bindings)
2. IPC command parsing and dispatch exists independently:
   - `app/api_ipc.cpp:151` (line protocol parse)
   - `app/api_ipc.cpp:169` (IPC command dispatch switch)
3. FastAPI capability response is hardcoded:
   - `tools/api_server/main.py:93`
4. FastAPI `/menu/command` dispatch logic is hardcoded in Python:
   - `tools/api_server/controller.py:369`
5. MCP tools call controller methods directly and are not registry-derived:
   - `tools/api_server/mcp_tools.py:47`
   - `tools/api_server/mcp_tools.py:212`
   - `tools/api_server/mcp_tools.py:233`
   - `tools/api_server/mcp_tools.py:257`

## Drift Findings

1. Capability list drift risk: `/capabilities` returns a Python-maintained list unrelated to C++ source (`tools/api_server/main.py:98`).
2. Dispatch drift risk: `/menu/command` is resolved in Python, separate from IPC switch and menu handlers (`tools/api_server/controller.py:372`).
3. Source split: menu/IPC/API/MCP each define command behavior independently.
4. Contract gap: no versioned capabilities schema existed under `contracts/`.
5. Test gap: no AC-mapped parity/schema/snapshot-event tests at required paths.

## PR-1 Migration Boundary (S01)

Migrate one vertical slice:
- Canonical command metadata and dispatch skeleton in C++ registry.
- API `/capabilities` and `/menu/command` derived from that canonical source.
- Add contract + parity + snapshot/event sanity tests.

Out of scope for PR-1:
- Full MCP tool-generation from capabilities.
- Full migration of every command path.
