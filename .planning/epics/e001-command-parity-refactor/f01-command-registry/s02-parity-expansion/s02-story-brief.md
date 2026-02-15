# S02: Expand Parity Coverage + Enforce Drift Tests

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f01-command-registry`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`

## Objective

Expand PR-1 parity work so MCP command-style tools route through canonical command dispatch and drift is test-enforced.

## Tasks

- [x] Route command-style MCP tools through `exec_command(name,args,actor)` equivalent path
- [x] Add test asserting MCP command-style tools use canonical dispatch
- [x] Add test asserting registry commands have matching MCP tool coverage for migrated set
- [x] Update planning/docs for PR-2 scope

## Acceptance Criteria

- [x] **AC-1:** MCP command-style tools use canonical dispatch path
  - Test: `uv run --with pytest pytest tests/contract/test_mcp_registry_parity.py::test_mcp_command_tools_use_canonical_dispatch -q`
- [x] **AC-2:** Registry and MCP command-style tool mapping does not drift
  - Test: `uv run --with pytest pytest tests/contract/test_mcp_registry_parity.py::test_registry_commands_have_matching_mcp_command_tools -q`

## Rollback

- Revert MCP tool dispatch wiring changes
- Revert parity enforcement test additions

## Status

Status: `done`
GitHub issue: #4
PR: —
