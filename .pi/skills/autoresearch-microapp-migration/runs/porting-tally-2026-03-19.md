# Microapp porting tally — 2026-03-19

Loop rule:
- commit each logical app promotion slice when verified
- if an app exceeds 15 porting attempts, move to Parking Lot (non-blocking)

## Completed

| app dir | microapp id | action | attempts | status | commit |
|---|---|---|---:|---|---|
| demo-layout-stress-test-pi | wibwob.layout-stress-test-pi | promoted to core + Demos menu routing baseline | 1 | done | b8214826 |
| demo-glitchbox | wibwob.glitchbox | promoted tier to core + fixed SDK button bar API breakage + verified menu/state | 2 | done | d303edd3, 211ad2e2 |
| demo-e026-demo | wibwob.example.e026 | promoted tier to core + fixed missing createCanvas import + verified menu/state | 1 | done | 6fb08f28 |
| demo-hello-world | wibwob.example.hello | promoted tier to core + added explicit menu/palette command wiring + verified menu/state | 1 | done | e1f04468 |
| demo-wibwob-poetry-clock | wibwob.poetry-clock | promoted tier to core + verified menu/state | 1 | done | 9b0e2d37 |
| demo-wibwob-tidepool | wibwob.tidepool | promoted tier to core + verified menu/state + auto-pause after inactivity hardened | 2 | done | ac34bc4a, dbcc92db |
| terrarium-life | wibwob.terrarium-life | migrated from .disabled + promoted tier to core + verified menu/state | 1 | done | b0ee3569 |
| demo-ansi-lab | wibwob.ansi-lab | migrated from .disabled + promoted to core/demos + verified menu/state/window-text | 1 | done | dc92b90d |
| demo-patchbay-lab | wibwob.patchbay | migrated from .disabled + promoted to core/demos + verified menu/state | 1 | done | ca9f24ce |
| demo-forms-playground | wibwob.forms-playground | migrated from .disabled + promoted to core/demos + verified menu/state | 1 | done | pending |

## Parking Lot (attempts > 15 or blocked)

| app dir | reason | attempts |
|---|---|---:|
| dashboard | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| dashboard-xxl | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-flex-bands-demo-codex | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-flex-bands-demo-pi | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-flex-workbench-demo-codex | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-flex-workbench-demo-pi | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-flex-wrap-demo-codex | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-flex-wrap-demo-pi | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-layout-stress-test-codex | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-responsive-panels-demo-codex | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-responsive-panels-demo-pi | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |
| demo-symbient-twitter | no active counterpart under microapps/; full port/migration required from .disabled | queued (if >15 then park) |

## Next queued

- Invent 3 new microapps after migration sweep, then run autoresearch loops for UI quality + funness.
