# Phase 0 Canon Alignment (E001/F01/S01)

Status: in-progress  
Scope: S01 PR-1 vertical slice only

## Inputs Read Before Changes

- `.planning/README.md`
- `.planning/epics/e001-command-parity-refactor/e001-epic-brief.md`
- `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`
- `.planning/epics/e001-command-parity-refactor/f01-command-registry/s01-registry-skeleton/s01-story-brief.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/refactor-prompt-2026-02-15.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/overview.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/thread-memory-refresh.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/spec-state-log-vault-browser.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/prompts/execution-prompts.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phase-a.md`
- `workings/chatgpt-refactor-vision-planning-2026-01-15/local-first-research-phases-b-f.md`

## Invariants Applied to This Repo

1. Engine command authority remains in C++ (`app/test_pattern_app.cpp` handlers).
2. API/MCP command exposure must derive from a canonical source, not hardcoded duplicates.
3. Existing behavior is preserved where possible; PR-1 migrates a single vertical path.
4. Contracts live under versioned `contracts/` and are validated in tests.
5. Snapshot/event sanity is maintained by tests, even with minimal scaffolding.

## Hook/Workflow Constraints Applied

- Naming and planning metadata rules from:
  - `.claude/hooks/name-lint.sh`
  - `.claude/hooks/planning-post-write-guard.sh`
  - `.claude/hooks/stop-ac-check.sh`
  - `.claude/hooks/commit-lint.sh`
- Issue-first/branch-per-issue workflow: epic/feature/story issues created before execution.
