# E039 Instance Lifecycle — Autoresearch Brief

## Objective

Make WibWob-DOS instances survive terminal death and resurrect cleanly.
Four features: clean death, microapp snapshots, boot workspace, `wibwob attach`.

## Primary Metric

`lifecycle_score` — sum of pass/fail behaviour checks (0–100).

Higher is better. Each check is binary — it works or it doesn't.

### Scoring Breakdown

| Feature | Points | Checks |
|---------|--------|--------|
| F1: Clean Death | 30 | SIGHUP saves workspace (10), socket cleaned on SIGHUP (5), socket cleaned on SIGTERM (5), PID file cleaned (5), no orphan process after kill (5) |
| F2: Microapp Snapshots | 30 | figlet save+restore (10), runtime-inspector save+restore (10), contour save+restore (10) |
| F3: Boot Workspace | 20 | --workspace flag works (10), orphan workspace auto-detected (10) |
| F4: wibwob attach | 20 | detects orphan (5), kills stale process (5), starts new instance (5), loads workspace (5) |

## How to Run

```bash
bash autoresearch/instance-lifecycle/autoresearch.sh
```

## Test Strategy

Unlike visual microapp experiments, this tests **behaviours** not **appearance**.
Each check follows the pattern:

1. Set up state (open windows, save workspace)
2. Trigger event (SIGHUP, SIGTERM, restart, attach)
3. Verify outcome (socket gone? workspace file exists? windows restored?)

All verification via `wibwob` CLI — no tmux, no curl, no ww-* aliases, no screenshots.
`wibwob` is the canon command surface. If a `wibwob` subcommand is missing,
add it to `src/cli/wibwob.ts` before writing the test.

```
  start instance
       │
       ├── open figlet + inspector + contour
       ├── wibwob map (verify 3+ windows)
       │
       ├── SIGHUP → verify:
       │     socket gone?
       │     PID file gone?
       │     orphan workspace saved?
       │     process dead?
       │
       ├── wibwob attach → verify:
       │     new instance running?
       │     workspace loaded?
       │     wibwob map shows same windows?
       │
       └── score = passed checks / total checks × 100
```

## Files in Scope

- `src/app.ts` — signal handlers, PID lifecycle
- `src/services/control-api.ts` — socket cleanup
- `src/core/app-controller.ts` — auto-save, boot workspace
- `src/cli/wibwob.ts` — `attach` subcommand
- `microapps/figlet-banner/index.ts` — registerSnapshot
- `microapps/runtime-inspector/index.ts` — registerSnapshot
- `microapps/contour-studio/index.ts` — registerSnapshot

## Off Limits

- Other microapps (not Core 7 focus)
- Theme files
- `src/core/window-manager.ts` (no window system changes)
- Remote/VPS multi-instance

## Constraints

- `bun run typecheck` must pass
- `wibwob health` must respond within 5s of start
- Socket must be at `scratch/instances/<label>.sock`
- No new npm dependencies
- Workspace files must be valid JSON loadable by `/workspace/load`

## Iteration Order

1. F2 first — microapp registerSnapshot (most isolated, unblocks F3/F4 testing)
2. F1 — signal handlers + cleanup (needs careful testing)
3. F3 — boot workspace selection
4. F4 — wibwob attach (depends on F1+F2+F3)
