# S03: Capability-Driven MCP Command Tool Registration

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f01-command-registry`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`

## Objective

Register command-style MCP tools from canonical registry capabilities instead of static hand-maintained command registrations.

## Tasks

- [x] Read capability names from canonical registry endpoint during MCP tool registration
- [x] Register command-style MCP tools from capability-derived mapping
- [x] Add tests for capability-driven registration
- [x] Add fallback test when registry is unavailable

## Acceptance Criteria

- [x] **AC-1:** Command-style MCP tool registration derives from registry capabilities
  - Test: `uv run --with pytest pytest tests/contract/test_mcp_tool_registration.py::test_registers_command_tools_from_registry_capabilities -q`
- [x] **AC-2:** Fallback registration keeps MCP command tools available when registry is unavailable
  - Test: `uv run --with pytest pytest tests/contract/test_mcp_tool_registration.py::test_fallback_registration_when_registry_unavailable -q`

## Rollback

- Revert capability-driven registration loop and restore static command-tool decorators.

## Status

Status: `done`
GitHub issue: #5
PR: —
