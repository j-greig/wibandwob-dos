# F01: State Export & Workspace Management

## Parent

- Epic: `e002-browser-and-state-export`
- Epic brief: `.planning/epics/e002-browser-and-state-export/e002-epic-brief.md`

## Objective

Establish a stable, versioned snapshot format for engine state. Enable workspace save/load for session persistence and event-triggered snapshot logging for audit and replay.

## Why

- Reproducible sessions: export → import produces identical state
- Reboot/restore: close and reopen exactly where you left off
- Audit trail: append-only log of who (human/AI) did what and when
- Foundation for browser session persistence (F02 depends on this)

## Stories

- [x] `.planning/epics/e002-browser-and-state-export/f01-state-export/s01-snapshot-schema/s01-story-brief.md` — versioned snapshot schema + `export_state`/`import_state` IPC commands
- [x] `.planning/epics/e002-browser-and-state-export/f01-state-export/s02-workspace-persistence/s02-story-brief.md` — `save_workspace`/`open_workspace` REST + file I/O
- [x] `.planning/epics/e002-browser-and-state-export/f01-state-export/s03-event-logging/s03-story-brief.md` — event-triggered snapshot logging (create/close/move/resize, command exec, timer)
- [ ] `.planning/epics/e002-browser-and-state-export/f01-state-export/s04-import-state-applies/s04-story-brief.md` — fix `import_state` no-op so `open_workspace` actually restores engine state

## Acceptance Criteria

- [x] **AC-1:** Snapshot schema is versioned and validates against `contracts/state/v1/snapshot.schema.json`
  - Test: schema validation test in `tests/contract/`
- [x] **AC-2:** `export_state` → `import_state` round-trip produces identical re-export (deterministic)
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_state_roundtrip_determinism.py -q`
- [x] **AC-3:** `save_workspace(path)` writes versioned JSON; `open_workspace(path)` restores windows
  - Test: save, close all, open, verify window count + types + bounds match
- [x] **AC-4:** Event log captures window lifecycle events with actor attribution
  - Test: create window via API, assert log entry with `actor="api"` and event type
- [ ] **AC-5:** `open_workspace(path)` applies imported state to running app (no false positive `ok`)
  - Test: `uv run --with pytest --with jsonschema --with fastapi pytest tests/contract/test_workspace_open_applies_state.py -q`

## Snapshot Schema (v1)

```json
{
  "version": "1",
  "timestamp": "ISO-8601",
  "canvas": { "w": 120, "h": 36 },
  "pattern_mode": "continuous",
  "windows": [
    {
      "id": "w1",
      "type": "text_editor|browser|verse|...",
      "title": "string",
      "rect": { "x": 0, "y": 0, "w": 80, "h": 24 },
      "z": 0,
      "focused": false,
      "props": {}
    }
  ]
}
```

## API Endpoints

- `POST /state/export` — `{path, format: json|ndjson}`
- `POST /state/import` — `{path, mode: replace|merge}`
- `POST /workspace/save` — `{path}`
- `POST /workspace/open` — `{path}`

## Storage

- `workspaces/*.json` — named workspace snapshots
- `logs/state/*.ndjson` — append-only event log (optional, S03)

## Implementation Notes

- C++ app is source of truth for state (existing `get_state()` IPC command)
- Python API/MCP is a thin mirror: fetches state from C++, writes to disk
- Snapshot triggers (S03): window create/close/move/resize, command exec, configurable timer

## Status

Status: `done`
GitHub issue: #15
PR: #23
