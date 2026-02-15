# Refactor Brief vNext (PR-1 Slice)

## Goal

Establish an initial canonical command/capability source in C++ and prove one API path consumes it.

## PR-1 Architecture

1. `app/command_registry.cpp` defines command capabilities and registry dispatch.
2. `app/api_ipc.cpp` exposes:
   - `cmd:get_capabilities`
   - `cmd:exec_command name=<command>`
3. `tools/api_server/controller.py` uses:
   - `send_cmd("get_capabilities")` for capability export
   - `send_cmd("exec_command", ...)` for `/menu/command` dispatch
4. `tools/api_server/main.py` `/capabilities` now derives from controller registry data.

## Why This Is Incremental

- Existing IPC command endpoints remain intact.
- Only one API path is migrated to canonical source.
- No full command-surface rewrite in this pass.

## Risks

1. API behavior now depends more directly on IPC availability for migrated path.
2. MCP tools still use controller methods and are not generated from capabilities yet.
3. Registry currently captures a migrated subset, not full command universe.
