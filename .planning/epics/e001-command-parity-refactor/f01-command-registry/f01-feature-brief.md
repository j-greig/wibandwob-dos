# F01: Command Registry (Canonical Source)

## Parent

- Epic: `e001-command-parity-refactor`
- Epic brief: `.planning/epics/e001-command-parity-refactor/e001-epic-brief.md`

## Objective

Define commands once in C++ and derive capabilities from that source to remove duplicated command declarations across UI, IPC/API, and MCP surfaces.

## Stories

- [~] `.planning/epics/e001-command-parity-refactor/f01-command-registry/s01-registry-skeleton/s01-story-brief.md` — registry skeleton + first capability-driven path
- [x] `.planning/epics/e001-command-parity-refactor/f01-command-registry/s02-parity-expansion/s02-story-brief.md` — expand MCP parity coverage + drift enforcement
- [x] `.planning/epics/e001-command-parity-refactor/f01-command-registry/s03-mcp-capability-registration/s03-story-brief.md` — capability-driven MCP command tool registration
- [x] `.planning/epics/e001-command-parity-refactor/f01-command-registry/s04-full-mcp-command-parity/s04-story-brief.md` — full MCP parity for migrated registry commands

## Acceptance Criteria

- [ ] **AC-1:** Registry can enumerate canonical command metadata
  - Test: `ctest --test-dir build --output-on-failure -R command_registry`
- [ ] **AC-2:** Capability export for at least one command path comes from canonical source
  - Test: `uv run python tools/api_server/test_registry_dispatch.py`
- [ ] **AC-3:** No hand-maintained duplicate command list remains on migrated path
  - Test: `rg -n 'hardcoded|\\[.*command.*\\]' tools/api_server tools/mcp && exit 1 || exit 0`

## Status

Status: `in-progress`
GitHub issue: #3
PR: —

## Notes

- Local-first scope only in this refactor pass.
- Retrieval pipeline features are out of scope.
