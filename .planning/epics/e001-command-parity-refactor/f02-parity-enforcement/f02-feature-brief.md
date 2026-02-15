# F02: Parity Enforcement

## Parent

- Epic: `e001-command-parity-refactor`
- Epic brief: `.planning/epics/e001-command-parity-refactor/e001-epic-brief.md`

## Objective

Add and enforce drift tests across menu, registry, API capabilities, and MCP command-tool mappings.

## Stories

- [x] `.planning/epics/e001-command-parity-refactor/f02-parity-enforcement/s07-parity-matrix-test/s07-story-brief.md` — add parity matrix drift test for migrated command set

## Acceptance Criteria

- [x] **AC-1:** Automated parity tests cover menu/registry/MCP migrated command set
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_surface_parity_matrix.py -q`
- [x] **AC-2:** Drift in mapped command surfaces fails tests
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_surface_parity_matrix.py -q`

## Status

Status: `done`
GitHub issue: #10
PR: —
