# npm-global Runbook (WibWob Hosting Smoke)

Scope: package-style install smoke before registry publish.

## Use this when

- validating `npm-global` adapter behavior
- checking global install path assumptions
- validating external microapp discovery without core edits

## Canonical smoke command

```bash
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh npm-global
```

Runner:
- `.pi/skills/wibwob-hosting-smoke/scripts/npm-global-smoke.sh`

## What this path verifies

- local prepublish flow works (`npm pack` + local tgz install)
- installed `wibwob` binary exists and responds
- package bin contract exists (`package.json.bin.wibwob`)
- external microapp can be seeded under `.wibwob/microapps/*`
- no mutable runtime writes to install tree

## Native deps note (important)

To avoid false negatives from optional/native build failures during packaging smoke:

```bash
npm install -g <tgz> --ignore-scripts --omit=optional
```

Use a separate native-deps validation profile if native build health is the explicit target.

## Artifacts

- `scratch/captures/npm-global-smoke-<timestamp>/report.md`
- `scratch/captures/npm-global-smoke-<timestamp>/checks.jsonl`
- `scratch/captures/npm-global-smoke-<timestamp>/raw.log`
