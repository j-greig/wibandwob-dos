---
name: wibwob-vps-smoke
description: >
  Run end-to-end Docker/VPS smoke validation for WibWob-DOS using SSH + CLI + API + screenshot checks + persistence checks, then produce an agent-readable report with binary pass/fail gates and remediation notes. Use when asked to "smoke test deploy", "test Docker/VPS", "verify production-like runtime", "check CLI/API in container", "validate persistence", or "dogfood the deployment path".
---

# WibWob VPS Smoke Skill

Use this skill for **production-like smoke testing** of WibWob-DOS in Docker.

This skill is optimized for:
- SSH-driven control-plane tests
- `wibwob` CLI + Control API parity checks
- `/screenshot/*` inference checks
- persistence validation via mounted `WIBWOB_DATA_DIR`
- report + changelog artifacts

## Core rule set

1. **Run the canonical smoke runner** (do not ad hoc re-create checks).
2. **Treat checks as binary** (pass/fail), not vibes.
3. **Prioritize critical failures** (SSH/API not ready, no instance, command execution broken).
4. **Use instanceId targeting** (`-i <instanceId>`) for deterministic CLI behavior.
5. **Update planning docs when signal changes** (new failures fixed or discovered).

## Canonical command

```bash
bash scripts/devops/docker-vps-smoke.sh
# human-in-loop TUI pause (recommended for visual verification)
bash scripts/devops/docker-vps-smoke.sh --human-loop
# keep container alive after run for manual follow-up
bash scripts/devops/docker-vps-smoke.sh --human-loop --keep-container
```

Artifacts are produced under:
- `scratch/captures/docker-vps-smoke-<timestamp>/`

## Standard post-run flow

### 1) Summarize latest run

```bash
python3 .pi/skills/wibwob-vps-smoke/scripts/summarize-latest-smoke.py
```

### 2) If critical failures exist

- Read latest `raw.log` + `report.md`
- Fix root cause in code/scripts/docs
- Re-run smoke
- Compare before/after failures

### 3) Keep planning synced

Update if needed:
- `.planning/epics/e053-external-config-packaging/PART2_EXECUTION_CHECKLIST.md`
- `.planning/epics/e053-external-config-packaging/PART3_RATE_LIMITS_CHECKLIST.md`
- `.planning/epics/e053-external-config-packaging/SMOKE_DEVLOG.md`

## Binary acceptance gates (default)

Read full gate definitions:
- `assets/smoke-evals.json`

At minimum, these must pass:
- Docker build succeeds
- SSH ready
- API ready (via tunnel)
- CLI health/state/commands pass with `-i <instanceId>`
- API `/health`, `/state`, `/commands/list` pass
- screenshot text endpoint returns non-empty output
- persistence leaves state files in mounted data root after restart

## Gotcha handling

See:
- `references/gotchas.md`

Known recurring gotchas include:
- duplicate instance discovery during legacy compatibility window
- API reachability differences (host direct vs SSH tunnel)
- figlet font inventory mismatch across environments
- false PASS from shell pipelines without `pipefail`

## Optional agent checkpoint

After substantial fixes, delegate a short review:
- Ask reviewer/ops subagent for “top 3 residual risks + top 3 next fixes”.
- Use that to decide whether to continue hardening or close iteration.

## Output expectations

A good run leaves:
- machine-readable `checks.jsonl`
- human-readable `report.md`
- append-only changelog entry in e053 smoke devlog
- clear statement of remaining failures (if any)
