# Microapp improvement autoloop — start here

## Purpose

Start an auto-running microapp improvement loop with binary gates and run logs.

## v1 scope

- baseline + iterative mutate/eval loop
- keeps score automatically
- writes machine-readable run artefacts
- safe default: baseline-only unless `MUTATE_CMD` is provided

## Command

```bash
bash .planning/spikes/spk-microapp-dev-hygiene/scripts/start-microapp-autoloop.sh \
  layout-stress-test-pi-v2 \
  microapps/demo-layout-stress-test-pi \
  microapp.wibwob.layout-stress-test-pi.open
```

## Enable auto-loop mutations

```bash
MUTATE_CMD='bash scripts/my-next-mutation.sh' \
MAX_LOOPS=10 \
SLEEP_SECONDS=20 \
bash .planning/spikes/spk-microapp-dev-hygiene/scripts/start-microapp-autoloop.sh \
  layout-stress-test-pi-v2 \
  microapps/demo-layout-stress-test-pi \
  microapp.wibwob.layout-stress-test-pi.open
```

## Artefacts

Run output path:
- `.planning/spikes/spk-microapp-dev-hygiene/runs/<slug>/`

Files:
- `results.tsv`
- `results.json`
- `changelog.md`
- `notes.md`

## Gate source

Uses existing migration gate runner:
- `.pi/skills/autoresearch-microapp-migration/scripts/run-gates.sh`

## Current limitation

`keep/discard` is score-based only in v1. It does not auto-revert failed mutations.
Use branch/worktree discipline or explicit revert logic in mutation scripts.
