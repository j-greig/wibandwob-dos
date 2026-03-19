# Microapp porting tally — 2026-03-19

Loop rule:
- commit each logical app promotion slice when verified
- if an app exceeds 15 porting attempts, move to Parking Lot (non-blocking)

## Completed

| app dir | microapp id | action | attempts | status | commit |
|---|---|---|---:|---|---|
| demo-glitchbox | wibwob.glitchbox | promoted tier to core + fixed button bar API breakage + verified menu/state | 1 | done | pending |

## Parking Lot (attempts > 15 or blocked)

| app dir | reason | attempts |
|---|---|---:|

## Not yet promoted

- demo-e026-demo
- demo-hello-world
- demo-wibwob-poetry-clock
- demo-wibwob-tidepool
