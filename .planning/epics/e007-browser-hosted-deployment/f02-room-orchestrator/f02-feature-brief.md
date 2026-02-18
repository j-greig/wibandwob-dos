# F02: Room Orchestrator

## Parent

- Epic: `e007-browser-hosted-deployment`
- Epic brief: `.planning/epics/e007-browser-hosted-deployment/e007-epic-brief.md`

## Objective

CLI daemon that reads room configs (markdown + YAML frontmatter), spawns ttyd+WibWob instance pairs, manages lifecycle (start/stop/health), and generates shared secrets for agent auth (F03). Single entry point: `./tools/room/orchestrator.py start rooms/*.md`.

## Scope

**In:**
- Python CLI that reads room markdown configs (F01 format), spawns ttyd wrapping WibWob-DOS per room
- Process lifecycle: start, health check, stop, restart on crash
- Shared secret generation at spawn time (passed to WibWob via env var)
- Port allocation for ttyd instances
- Stdout/stderr logging per room

**Out:**
- nginx proxy config (manual for MVP)
- Systemd service file (manual for MVP)
- Auto-scaling beyond 4 rooms

## Stories

- [x] `s02-spawn-loop` — orchestrator reads config, spawns ttyd+wibwob, tracks PIDs
- [x] `s03-health-monitor` — periodic health check via socket probe, restart on failure
- [x] `s04-secret-generation` — generate per-room shared secret, pass via WIBWOB_AUTH_SECRET env var

## Acceptance Criteria

- [x] **AC-1:** Orchestrator spawns a ttyd+WibWob pair from a room config YAML
  - Test: spawn with example config, curl ttyd port returns 200
- [x] **AC-2:** Orchestrator tracks child PIDs and logs per-room output
  - Test: kill a child process, orchestrator logs the exit and PID
- [x] **AC-3:** Health check detects dead socket and restarts the room
  - Test: kill WibWob process, orchestrator restarts within 10s
- [x] **AC-4:** Shared secret generated and passed to WibWob instance at spawn
  - Test: spawned process has WIBWOB_AUTH_SECRET env var set, value is 32+ hex chars

## Status

Status: done
GitHub issue: —
PR: —
