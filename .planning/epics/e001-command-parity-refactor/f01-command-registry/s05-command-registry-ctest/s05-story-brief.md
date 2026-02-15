# S05: Native CTest Coverage for Command Registry

## Parent

- Epic: `e001-command-parity-refactor`
- Feature: `f01-command-registry`
- Feature brief: `.planning/epics/e001-command-parity-refactor/f01-command-registry/f01-feature-brief.md`

## Objective

Add a native C++ ctest target for command registry so feature-level C++ coverage exists for canonical command metadata.

## Tasks

- [x] Add `command_registry_test` C++ executable
- [x] Validate capability payload includes required migrated commands
- [x] Wire test into CMake as `command_registry`

## Acceptance Criteria

- [x] **AC-1:** `ctest` command registry target exists and passes
  - Test: `ctest --test-dir build --output-on-failure -R command_registry`
- [x] **AC-2:** C++ test validates migrated command capabilities are present
  - Test: `cmake --build build -j4 --target command_registry_test`

## Rollback

- Revert C++ test target and CMake test registration.

## Status

Status: `done`
GitHub issue: #7
PR: —
