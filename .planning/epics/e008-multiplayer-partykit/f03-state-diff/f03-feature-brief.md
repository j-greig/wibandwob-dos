# F03: State Diffing

## Parent

- Epic: `e008-multiplayer-partykit`
- Epic brief: `.planning/epics/e008-multiplayer-partykit/e008-epic-brief.md`

## Objective

Standalone Python module for computing minimal add/remove/update deltas between window state snapshots. Used by the PartyKit bridge to detect local mutations and apply remote deltas without full-state replacement.

## Location

`tools/room/state_diff.py` — standalone module, no runtime deps beyond stdlib.

## API

| Function | Purpose |
|----------|---------|
| `windows_from_state(state)` | Extract `{id: window}` map from IPC get_state response (list or dict shape) |
| `state_hash(windows)` | SHA256 of sorted JSON for cheap change detection |
| `compute_delta(old, new)` | Returns `{add, remove, update}` or `None` if no change |
| `apply_delta(current, delta)` | Pure function — returns new map, does not mutate input |
| `apply_delta_to_ipc(sock_path, delta)` | Execute create/close/move IPC commands, return list of applied strings |

## Acceptance Criteria

- [x] **AC-1:** `compute_delta(old, new)` returns `None` when state is unchanged
  - Test: `TestComputeDelta::test_no_change` and `test_empty_to_empty`
- [x] **AC-2:** Delta contains only changed windows (add/remove/update buckets)
  - Test: `TestComputeDelta::test_add`, `test_remove`, `test_update`, `test_mixed`
- [x] **AC-3:** `apply_delta(old, delta)` round-trips: `apply_delta(old, compute_delta(old, new)) == new`
  - Test: `TestApplyDelta::test_round_trip`
- [x] **AC-4:** `apply_delta` does not mutate its input
  - Test: `TestApplyDelta::test_does_not_mutate_input`
- [x] **AC-5:** `apply_delta_to_ipc` calls correct IPC commands for each delta bucket
  - Test: `TestApplyDeltaToIpc` — 5 tests covering create/close/move/returns/empty

## Tests

`tests/room/test_state_diff.py` — 26 tests, all passing.

## Status

Status: done
GitHub issue: #65
PR: —
