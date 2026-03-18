# Agentic Docker/VPS Smoke Guide (E053)

Purpose: run a pragmatic, repeatable smoke suite that validates WibWob-DOS from an external operator perspective (SSH + CLI + API + screenshot + persistence).

## Canonical runner

```bash
bash scripts/devops/docker-vps-smoke.sh
```

Artifacts are written to:

- `scratch/captures/docker-vps-smoke-<timestamp>/report.md`
- `scratch/captures/docker-vps-smoke-<timestamp>/checks.jsonl`
- `scratch/captures/docker-vps-smoke-<timestamp>/raw.log`
- `scratch/captures/docker-vps-smoke-<timestamp>/data-root/` (mounted persistent runtime data)

A rolling changelog is appended to:

- `.planning/epics/e053-external-config-packaging/SMOKE_DEVLOG.md`

## What this suite verifies

1. Docker image builds with smoke entrypoint
2. Container boots with SSH + tmux + app process
3. SSH key login works
4. API reachable via SSH tunnel
5. CLI checks from inside container (`wibwob ...`)
6. API checks from host through tunnel (`/health`, `/state`, `/commands/list`, `/runtime/inspection`)
7. Screenshot checks (`/screenshot/text`, `/screenshot/ansi`) and text inference probe
8. Rate-limit probe (expects at least some 429s)
9. Persistence probe with mounted `WIBWOB_DATA_DIR` volume across restart

## Known gotchas (observed)

### 1) Duplicate instance discovery due legacy + canonical socket aliases

Symptom:
- CLI may report multiple entries for effectively one runtime if both canonical and legacy discovery artifacts exist.

Current status:
- mitigated by preferring instance-id selector (`-i <instanceId>`) and canonical discovery first.
- still tracked while legacy compatibility aliases remain.

### 2) API not reachable directly from host even when app is healthy in container

Symptom:
- app logs indicate `/health` is OK inside container, but host `curl 127.0.0.1:8099` fails.

Cause:
- service binds container loopback; host mapping may not reach it directly.

Fix pattern:
- use SSH tunnel (`-L 19099:127.0.0.1:8099`) and test through tunnel.

### 3) figlet font inventory mismatch on VPS-like images

Symptom:
- basic figlet rendering works but full font list availability can differ from local/macOS.

Why this matters:
- regressions can hide in optional font packs and rendering defaults.

Smoke handling:
- explicit `figlet.fonts` check is included in suite.
- keep this as a mandatory check before claiming VPS parity.

### 4) Post-restart tunnel invalidation

Symptom:
- after `docker restart`, API checks fail even if app restarts.

Fix pattern:
- recreate SSH tunnel after restart before post-restart API assertions.

### 5) False-positive PASS due shell pipelines

Symptom:
- command body fails but pipeline exits 0 (`head`, `jq` without `-e`, etc.).

Fix pattern:
- execute checks under `bash -o pipefail -lc ...`
- use `jq -e` for assertions.

## Operating guidance for agents

- Always derive `instanceId` from `/health` and target CLI with `-i <instanceId>`.
- Prefer API assertions through tunnel over direct host-port assumptions.
- Treat screenshot checks as first-class acceptance gates, not optional debug output.
- Keep `checks.jsonl` machine-readable and reviewable by subagents.
- When smoke fails, append root-cause + remediation to `SMOKE_DEVLOG.md` in same session.

## Next hardening steps

- Add dedicated assertion that `figlet.fonts` count exceeds minimum threshold expected for deployment profile.
- Add check that duplicate instance rows resolve to unique `instanceId` set of size 1 for single-instance smoke.
- Add auto-generated "top failures" section from `checks.jsonl` into report.
- Add optional Discord summary poster (future) for smoke run status.
