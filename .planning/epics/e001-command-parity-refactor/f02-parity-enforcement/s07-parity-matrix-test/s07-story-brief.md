# S07: Parity Matrix Test (Menu, Registry, MCP)

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f02-parity-enforcement`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f02-parity-enforcement/f02-feature-brief.md`

## Objective

Add a matrix-style drift test that validates migrated commands remain aligned across C++ menu handlers, C++ registry capabilities, and MCP command-tool mappings.

## Tasks

- [x] Add parity matrix test that checks menu/registry/MCP mapping
- [x] Include migrated command set coverage in one assertion path
- [x] Update planning for F02 story kickoff

## Acceptance Criteria

- [x] **AC-1:** Parity matrix test passes for current migrated command set
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_surface_parity_matrix.py -q`
- [x] **AC-2:** Test detects drift when mappings diverge
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_surface_parity_matrix.py -q`

## Rollback

- Revert parity matrix test and restore prior parity test-only setup.

## Status

Status: `done`
GitHub issue: #9
PR: —
