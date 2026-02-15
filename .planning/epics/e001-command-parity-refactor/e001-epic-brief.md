# E001: Command/Capability Parity Refactor

## Objective

Eliminate drift between UI, IPC/API, and MCP/tool surfaces by establishing one canonical command/capability source in C++ and routing state mutation through a single command path.

## Source of Truth

- Planning canon: `.planning/README.md`
- Active execution prompt: `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/refactor-prompt-2026-02-15.md`
- Quality gates: `workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md`

If this file conflicts with `.planning/README.md`, follow `.planning/README.md`.
The active execution prompt is implementation guidance; it does not override canon.
If guidance conflicts with canon, open a docs issue and reconcile before execution.

## Epic Structure (GitHub-first)

- Epic issue: `E001` (`epic` label)
- Features: child issues (`feature` label)
- Stories: child issues under each feature (`story` label)
- Tasks: checklist items or child issues (`task` label)
- Spikes: timeboxed issues (`spike` label)

Naming:
- Epic: `E: command/capability parity refactor`
- Feature: `F: <capability>`
- Story: `S: <vertical-slice>`

## Features

- [x] **F1: Command Registry** — define commands once in C++, derive capabilities, remove duplicates
  - Brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`
- [x] **F2: Parity Enforcement** — automated drift checks for menu, IPC/API, MCP surfaces
  - Brief: `.planning/epics/e001-command-parity-refactor/f02-parity-enforcement/f02-feature-brief.md`
- [ ] **F3: State/Event Authority** — `exec_command` dispatch, typed events, snapshot sanity
- [ ] **F4: Instance Boundaries** — isolation for state, vault, events; local-first this pass

## Story Backlog

- [x] **S1 (PR-1):** Registry skeleton + first capability-driven path
  - Brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/s01-registry-skeleton/s01-story-brief.md`
- [x] **S2 (PR-2+):** Expand parity coverage + enforce drift tests
- [x] **S3 (PR-2+):** Capability-driven MCP command tool registration
  - Brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/s03-mcp-capability-registration/s03-story-brief.md`
- [x] **S4 (PR-2+):** Full MCP parity for migrated registry commands
  - Brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/s04-full-mcp-command-parity/s04-story-brief.md`
- [x] **S5 (PR-2+):** Native ctest coverage for command registry
  - Brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/s05-command-registry-ctest/s05-story-brief.md`
- [x] **S6 (PR-2+):** F01 closeout quality gates
  - Brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/s06-f01-closeout/s06-story-brief.md`
- [x] **S7 (PR-2+):** Parity matrix test for menu/registry/MCP
  - Brief: `.planning/epics/e001-command-parity-refactor/f02-parity-enforcement/s07-parity-matrix-test/s07-story-brief.md`

## Acceptance Criteria (PR-1)

- [ ] **AC-1:** Registry exposes capabilities JSON for registered commands
  - Test: `uv run pytest tests/contract/test_capabilities_schema.py::test_registry_capabilities_payload_validates`
- [ ] **AC-2:** At least one API/MCP path dispatches via canonical command source
  - Test: `uv run python tools/api_server/test_registry_dispatch.py`
- [ ] **AC-3:** Everyday command parity does not regress
  - Test: `uv run pytest tests/contract/test_parity_drift.py::test_menu_vs_capabilities_parity`
- [ ] **AC-4:** Snapshot/event sanity is preserved
  - Test: `uv run pytest tests/contract/test_snapshot_event_sanity.py::test_snapshot_round_trip_and_event_emission`

## Required Artifacts

- [ ] `docs/architecture/parity-drift-audit.md`
- [ ] `docs/architecture/refactor-brief-vnext.md`
- [ ] `docs/migration/vnext-migration-plan.md`
- [ ] `docs/architecture/phase-zero-canon-alignment.md`
- [ ] `docs/manifestos/symbient-os-manifesto-template.md`
- [ ] Versioned schemas under `contracts/`
- [ ] Tests covering parity + contracts + snapshot/event sanity

## Phase Sequencing

1. Phase 0: Invariants digest grounded in actual repo files
2. Phase 1: Drift and state-authority audit with file references
3. Phase 2: Incremental vNext architecture proposal
4. Phase 3: PR-sized rollout plan (PR-1/PR-2/PR-3)
5. Phase 4: Execute PR-1 only, then stop/report

## Definition of Done (Epic)

- [ ] Canonical command source exists and is used by at least one end-to-end path
- [ ] Capability export is schema-validated
- [ ] Parity drift tests exist and are enforced in CI
- [ ] Snapshot/event sanity tests exist
- [ ] PRs follow issue-first, branch-per-issue, rollback-noted workflow

## Status

Status: `in-progress`
GitHub issue: #1
PR: —

Next action: execute S01 PR-1 vertical slice and publish test evidence
