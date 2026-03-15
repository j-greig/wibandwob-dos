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

## COAT Audit

F2 (snapshots) must go through the **workspace seam**, not host shortcuts.

| Microapp | Current state | COAT fix |
|----------|--------------|----------|
| figlet-banner | HOST-side handler in `snapshot-registry.ts` using `actions.openFigletWindow()` — COAT violation | Move to `host.registerSnapshot()` in microapp `index.ts`, remove host handler, remove from `PersistableAppType` |
| contour-studio | In `TransientAppType` — explicitly excluded from save | Remove from `TransientAppType`, add `host.registerSnapshot()` in microapp |
| runtime-inspector | Not in either type list — dynamic appType, no handler | Add `host.registerSnapshot()` in microapp |

The COAT pattern (from journal, command-lab, world):
```ts
host.registerSnapshot({
  serialize: (window) => {
    const state = window.describeState?.() ?? {};
    return { /* pick what matters */ };
  },
  restore: (_snapshot, payload) => {
    host.runCommand("open", payload);  // ← command seam, not host method
  },
});
```

## Files in Scope

### Microapp files (F2 — registerSnapshot)
- `microapps/figlet-banner/index.ts` — add registerSnapshot, remove host dependency
- `microapps/runtime-inspector/index.ts` — add registerSnapshot
- `microapps/contour-studio/index.ts` — add registerSnapshot

### Host files needing cleanup (F2 — remove COAT violations)
- `src/core/snapshot-registry.ts` — remove `figlet-banner` host handler, remove `openFigletWindow` from `SnapshotRestoreActions`
- `src/core/types.ts` — remove `figlet-banner` from `PersistableAppType`, remove `contour-studio` from `TransientAppType`

### Host files (F1 — signal handlers)
- `src/app.ts` — SIGHUP handler, PID cleanup, auto-save
- `src/services/control-api.ts` — socket cleanup on all exit paths

### Host files (F3 — boot workspace)
- `src/core/app-controller.ts` — `--workspace` flag, orphan detection

### CLI (F4 — attach)
- `src/cli/wibwob.ts` — `attach`, `start`, `restart` subcommands

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

1. F2 first — microapp registerSnapshot + host cleanup (COAT violation fix)
   - Add `host.registerSnapshot()` to figlet, contour, runtime-inspector
   - Remove figlet host handler from `snapshot-registry.ts`
   - Remove figlet from `PersistableAppType`, contour from `TransientAppType`
   - This is the COAT migration — microapps own their own persistence
2. F1 — signal handlers + cleanup (needs careful testing)
3. F3 — boot workspace selection (`--workspace` flag)
4. F4 — wibwob attach (depends on F1+F2+F3)
   - Also add `wibwob start`, `wibwob restart` subcommands (replace script aliases)
