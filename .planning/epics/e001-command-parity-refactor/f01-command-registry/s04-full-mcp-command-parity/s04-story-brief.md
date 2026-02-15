# S04: Full Registry-to-MCP Command Parity (Migrated Set)

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f01-command-registry`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`

## Objective

Complete MCP command-tool coverage for the migrated registry command set and enforce full mapping parity in tests.

## Tasks

- [x] Add MCP command tools for remaining migrated registry commands (`save_workspace`, `open_workspace`)
- [x] Enforce full registry-to-MCP mapping parity in tests
- [x] Update parity and registration tests to include new command tools

## Acceptance Criteria

- [x] **AC-1:** All migrated registry commands have MCP command-tool mappings
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_registry_parity_full.py::test_all_registry_commands_have_mcp_command_tool_mapping -q`
- [x] **AC-2:** Capability-driven registration includes new command tools and fallback remains complete
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_tool_registration.py -q`

## Rollback

- Revert MCP command-tool additions and full parity test updates.

## Status

Status: `done`
GitHub issue: #6
PR: —
