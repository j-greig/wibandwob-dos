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
partykit_server: https://wibwob-rooms.j-greig.partykit.dev
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

- [x] `s01-config-fields` — add multiplayer fields to parser/validator
- [x] `s02-orchestrator-env` — pass partykit env vars when multiplayer:true

## Acceptance Criteria

- [x] **AC-1:** room_config.py parses multiplayer fields when present; single-player configs unchanged
  - Test: `TestMultiplayerFieldsParsed::test_multiplayer_fields_in_room_config` and `test_single_player_config_unaffected`
- [x] **AC-2:** Orchestrator sets WIBWOB_PARTYKIT_URL and WIBWOB_PARTYKIT_ROOM in spawned process env when multiplayer:true
  - Test: `TestOrchestratorMultiplayerEnv::test_partykit_env_vars_set_for_multiplayer`
- [x] **AC-3:** Validation rejects multiplayer:true without partykit_room or partykit_server
  - Test: `TestMultiplayerValidation::test_multiplayer_without_partykit_room_rejected` and `test_multiplayer_without_partykit_server_rejected`

## Status

Status: done
GitHub issue: #65
PR: —
