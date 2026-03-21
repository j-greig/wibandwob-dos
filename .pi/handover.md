# Handover: Implement scripts/coat-compliance.sh

## What you're building

A single executable script — `scripts/coat-compliance.sh` — that performs a
**runtime COAT compliance check** against a live WibWob-DOS instance. It answers:
*"Can an agent do everything a human can, using only the HTTP API?"*

This is NOT the static checker. `scripts/checks/check-coat.ts` already exists
and checks import boundaries, manifests, orphan keys. You are writing the
**runtime behavioural complement** — does the API produce observable state?

The full spec is at:
`.planning/spikes/spk-coat-compliance-runtime/BRIEF.md`

---

## Branch / worktree

- **Branch:** `feat/coat-compliance-script`
- **Worktree:** `~/Repos/wibwob-coat-compliance` ← you are here
- **Do not touch** anything the other agent (ralph/gotcha-cures) is editing:
  `src/services/control-api.ts`, `src/services/microapp-loader.ts`
- You are only adding: `scripts/coat-compliance.sh` (and its baseline file on first run)

---

## API surface (verified from source)

Base URL: `http://localhost:8099` (default port)

Key endpoints for this script:

```
GET  /health                  → { id, label, pid, uptime, port }
GET  /state                   → full desktop state, windows[], each with describeState
GET  /commands/list           → { commands: [ { id, label, group, description?, api?, surface? } ] }
POST /commands/run            → { id: "command.id", args?: {} }
GET  /errors/recent           → last 20 runtime errors  ← G1 ALREADY EXISTS
```

**G1 (/errors/recent) already exists** — remove it from "not yet implemented" list.
Check G2 (`/state/stream` SSE) and G3 (symbolic window refs by title) with a real
probe at runtime — they almost certainly 404.

---

## Script phases (from spec, adapted for reality)

### Phase 1 — Health check
`curl /health` → 200? Continue. Else exit 2 (not a failure — no instance).

### Phase 2 — Capability gap assertions

| ID | Endpoint | Notes |
|----|----------|-------|
| G1 | `GET /errors/recent` | **Exists** — should pass |
| G2 | `GET /state/stream` | Likely 404 |
| G3 | `POST /windows/by-title/:title/command` | Likely 404; check `/windows/list` or similar |

Probe each. 2xx = pass. Not-2xx = report (non-gating for G2/G3 until implemented).

### Phase 3 — Command round-trip

```bash
GET /commands/list → iterate commands
  skip if: id matches *.close* | *.clear* | *.delete* | *.reset* | *.quit*
  skip if: id matches *.open* with no default args (requires input)
  for each testable command:
    snapshot=$(curl /state)
    curl -X POST /commands/run -d '{"id":"<command.id>"}'
    sleep 0.3
    after=$(curl /state)
    diff snapshot vs after → any window changed? PASS. No change? FAIL.
```

State comparison: look for changes in any window's `describeState` content,
or `lastCommand` field if present. A changed `updatedAt` timestamp also counts.

**Important:** Run commands that open windows (e.g. `art.open`, `primer.open`)
then close them after. Don't leave the desktop in a broken state.

### Phase 4 — State observability

For every open window in `/state`:
- `describeState` must exist and be non-empty (`{}` = FAIL)
- Must have at least one key beyond static metadata

### Phase 5 — Report + exit code

Human-readable output (see spec for format). Exit 0 = all gating checks pass.
Exit 1 = failures. Exit 2 = no instance.

---

## Baseline mechanism

On first run (no `coat-compliance.baseline.json` at repo root):
1. Run all checks
2. Write all failures to baseline file
3. Exit 0 (first run is inventory, not gate)

On subsequent runs:
- Failures IN baseline → REPORT ONLY (existing debt)
- Failures NOT in baseline → GATE (regression → exit 1)
- Items IN baseline that now PASS → report as 🎉 improvement

`--update-baseline` flag re-records all current failures (use after intentional deferral).

Baseline file lives at repo root: `coat-compliance.baseline.json`
(commit it; it's the known-debt inventory)

---

## Implementation approach

Write it as a **bash script** (not bun/ts). The existing checks are `.ts` but
this one benefits from being a plain shell script: no bun dependency at call
site, easier to run from CI/hooks, readable without toolchain context.

Use `curl` + `jq` for all HTTP + JSON work. `jq` is available on this machine.

Rough structure:
```bash
#!/usr/bin/env bash
set -euo pipefail
PORT=${WIBWOB_PORT:-8099}
BASELINE="$(git rev-parse --show-toplevel)/coat-compliance.baseline.json"
...
```

---

## Testing the script

WibWob must be running to test. Launch it:

```bash
# From this worktree:
bash scripts/ensure-running.sh
# Wait ~5s then:
curl http://localhost:8099/health
```

Then run your script:
```bash
bash scripts/coat-compliance.sh
```

Test the three exit paths:
1. Instance running, all passing → exit 0
2. Instance running, regressions → exit 1  
3. No instance → exit 2 (test with a wrong port: `WIBWOB_PORT=9999 bash scripts/coat-compliance.sh`)

Test baseline:
```bash
rm -f coat-compliance.baseline.json
bash scripts/coat-compliance.sh   # first run → writes baseline, exits 0
bash scripts/coat-compliance.sh   # second run → existing debt reported only
```

---

## Acceptance criteria (from spec)

- [ ] Script runs against live instance, exits 0/1/2 correctly
- [ ] First run (no baseline) writes baseline.json, exits 0
- [ ] Subsequent runs gate regressions, not existing debt
- [ ] `--update-baseline` flag works
- [ ] G1/G2/G3 capability gaps reported (G1 should pass already)
- [ ] Command round-trip covers non-skipped commands
- [ ] State observability covers all open windows
- [ ] Human-readable output by default
- [ ] `--json` flag outputs machine-readable JSON
- [ ] Script added to `scripts/health-full.sh` call chain

---

## Files to create

- `scripts/coat-compliance.sh` ← main deliverable
- `coat-compliance.baseline.json` ← generated on first run; commit it

## Files NOT to touch

- `src/services/control-api.ts` ← other agent owns this
- `src/services/microapp-loader.ts` ← other agent owns this
- Anything under `src/core/` or `microapps/`
