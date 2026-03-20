# Autoresearch Session Log (Persistent)

This file is outside the dashboard and intended for durable audit/history.

## Files that persist run history

- `results.tsv` (human-readable score table)
- `results.json` (dashboard data source)
- `experiments.jsonl` (append-friendly machine log)
- `changelog.md` (reasoning per experiment)

## Current summary

- experiments: 8 (0..7)
- baseline: 87.5%
- best: 100.0%
- latest: 100.0%
- latest status: keep
- eval suite: v3 (13 binary checks)

## Latest kept improvements

1. Explicit adapter preconditions (`FLY_APP_NAME`, npm prepublish/tgz path, `WIBWOB_DATA_DIR`)
2. Persistent non-dashboard run-history contract
3. Failure taxonomy + remediation event contract + dynamic tunnel-port guidance

Generated: 2026-03-18T22:15:00Z
