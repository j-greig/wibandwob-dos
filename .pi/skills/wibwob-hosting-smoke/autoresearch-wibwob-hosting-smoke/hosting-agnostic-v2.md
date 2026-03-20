---
name: wibwob-hosting-smoke
description: >
  Run end-to-end hosting-agnostic smoke validation for WibWob-DOS across Docker/VPS/Fly.io/npm-global style deployments using adapter runners + shared binary gates (CLI/API/screenshot/persistence/external microapps), then produce an agent-readable report with pass/fail outcomes and remediation notes.
---

# WibWob Hosting Smoke Skill

Use this skill for **production-like smoke testing** of WibWob-DOS independent of hosting provider.

## Philosophy (unchanged across hosts)

1. **One semantic runtime, many thin host adapters.**
2. **Binary gates only** (pass/fail), never vibes.
3. **Critical-first triage** (readiness + command execution + persistence).
4. **Instance-targeted commands** (`wibwob -i <instanceId> ...`) for deterministic checks.
5. **No mutable writes into image/package paths** (all runtime data under `WIBWOB_DATA_DIR`).
6. **External microapps should be loadable without core-file edits.**

## Adapter model

Treat smoke as two layers:

- **Core gate pack (required everywhere):** readiness, CLI/API parity, screenshot signal, persistence, rate-limit sanity.
- **Adapter gate pack (host-specific):** Docker build/run, Fly machine health, npm-global install pathing, etc.

Required adapters:

- `docker-vps`
- `flyio`
- `npm-global`

If an adapter runner is missing or broken, that is a **FAIL** (do not silently skip).

## Preconditions per adapter

- **docker-vps**
  - Docker daemon available locally.
- **flyio**
  - `flyctl` installed and authenticated.
  - `FLY_APP_NAME` exported before running smoke.
- **npm-global**
  - `npm` and `bun` installed.
  - Use local prepublish flow (`npm pack` + tgz install) until registry publish exists.
  - Keep runtime state external with `WIBWOB_DATA_DIR`.

## Canonical runner

```bash
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh <adapter>
```

Examples:

```bash
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh docker-vps
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh flyio
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh npm-global
```

Artifacts:

- `scratch/captures/docker-vps-smoke-<timestamp>/`
- `scratch/captures/fly-smoke-<timestamp>/`
- `scratch/captures/npm-global-smoke-<timestamp>/`

Summarize latest run:

```bash
python3 .pi/skills/wibwob-hosting-smoke/scripts/summarize-latest-smoke.py
```

## Required smoke scenarios (minimum)

1. **Docker/VPS smoke**
2. **Fly.io smoke**
3. **npm-global + external microapp injection smoke**

For npm-global scenario (package not yet published), use local prepublish simulation (`npm pack` + local tgz global install) and still enforce the same gates.

## npm-global + external microapp smoke (critical checks)

- `wibwob` binary launches from installed package context.
- No mutable state is written to package/install directories.
- `WIBWOB_DATA_DIR` contains runtime-owned state.
- External microapp path is discovered.
- Custom microapp appears in commands/menu and can be opened **without editing `src/core/*`**.

## Binary acceptance gates

See:

- `assets/hosting-evals.json`

Minimum pass set:

- adapter bootstrap passes
- runtime readiness passes
- targeted CLI checks pass (`-i <instanceId>`)
- API parity checks pass (`/health`, `/state`, `/commands/list`)
- screenshot signal checks pass
- persistence survives restart
- external microapp discovery/open works without core edits

## Standard post-run flow

1. Summarize latest run.
2. If critical failures exist, inspect `raw.log` + `report.md`, fix root cause, rerun, compare deltas.
3. Sync planning docs when signal changes:
   - `.planning/epics/e053-external-config-packaging/PART2_EXECUTION_CHECKLIST.md`
   - `.planning/epics/e053-external-config-packaging/PART3_RATE_LIMITS_CHECKLIST.md`
   - `.planning/epics/e053-external-config-packaging/SMOKE_DEVLOG.md`

## Failure taxonomy + remediation event contract

When checks fail, classify failures explicitly in `checks.jsonl` using:

- `tunnel_refused`
- `app_not_ready`
- `selector_ambiguous`
- `command_error`

For readiness failures, runner/report should record remediation metadata:

- `remediation_attempted: true|false`
- remediation action (for example: one app-session restart + retry)

Transport guidance:

- prefer **dynamic local tunnel ports** over fixed ports
- startup should be **collision-safe** and avoid hard-coding `19099`/`19100`

## Gotchas

See:

- `references/gotchas.md`

## Output expectations

A good run leaves:

- machine-readable `checks.jsonl`
- human-readable `report.md`
- changelog/devlog append in e053 smoke docs
- explicit list of remaining failures
- adapter/scenario clearly labeled in the report

## Persistent run history (outside dashboard)

The dashboard is a view, not the source of truth. Keep durable logs in:

- `autoresearch-wibwob-hosting-smoke/results.tsv`
- `autoresearch-wibwob-hosting-smoke/results.json`
- `autoresearch-wibwob-hosting-smoke/experiments.jsonl`
- `autoresearch-wibwob-hosting-smoke/SESSION_LOG.md`
