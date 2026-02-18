# F06: Room Config Extension (Multiplayer)

## Parent

- Epic: `e008-multiplayer-partykit`
- Epic brief: `.planning/epics/e008-multiplayer-partykit/e008-epic-brief.md`

## Objective

Extend room YAML frontmatter with optional multiplayer fields. Orchestrator detects `multiplayer: true` and passes `WIBWOB_PARTYKIT_URL` + `WIBWOB_PARTYKIT_ROOM` env vars to spawned instances. Single-player rooms unaffected when fields absent.

## Format Addition

```yaml
# Optional multiplayer fields (all absent = single-player, unchanged)
multiplayer: true
partykit_room: scramble-demo   # Durable Object key on PartyKit
max_players: 2
partykit_server: https://wibwob.username.partykit.dev
```

## Scope

**In:**
- Add optional fields to room config schema (room_config.py + validate_config.py)
- Orchestrator passes WIBWOB_PARTYKIT_URL and WIBWOB_PARTYKIT_ROOM when multiplayer:true
- Example multiplayer room config at `rooms/multiplayer-example.md`
- Tests for new fields + orchestrator env var passing

**Out:**
- PartyKit server itself (F01)
- C++ WebSocket client (F02)

## Stories

- [ ] `s01-config-fields` — add multiplayer fields to parser/validator
- [ ] `s02-orchestrator-env` — pass partykit env vars when multiplayer:true

## Acceptance Criteria

- [ ] **AC-1:** room_config.py parses multiplayer fields when present; single-player configs unchanged
  - Test: parse multiplayer-example.md, assert multiplayer=True, partykit_room, partykit_server extracted
- [ ] **AC-2:** Orchestrator sets WIBWOB_PARTYKIT_URL and WIBWOB_PARTYKIT_ROOM in spawned process env when multiplayer:true
  - Test: mock spawn, assert env vars present for multiplayer room, absent for single-player
- [ ] **AC-3:** Validation rejects multiplayer:true without partykit_room or partykit_server
  - Test: config with multiplayer:true but no partykit_room → validation error

## Status

Status: not-started
GitHub issue: #65
PR: —
