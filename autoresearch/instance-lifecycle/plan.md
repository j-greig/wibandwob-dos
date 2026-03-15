# E039 Instance Lifecycle — Autoresearch Plan

## How This Differs from Microapp Autoresearch

| Microapp experiments | This experiment |
|---------------------|-----------------|
| Iterate on one `index.ts` | Touch 7+ files across `src/`, `microapps/`, `src/cli/` |
| Score = visual UI + features | Score = pass/fail behaviour checks |
| Screenshot-based verification | CLI-based verification (`wibwob` commands) |
| Restart between runs | Tests involve kill/restart as part of the test itself |
| Single process lifecycle | Tests cross process boundaries (kill → start → verify) |

## Iteration Strategy

### Phase 1: Microapp Snapshots (F2) — safest, most isolated

Add `registerSnapshot()` to figlet, runtime-inspector, contour.
Each is self-contained in its own `index.ts`. No `src/` changes needed.

**Test:** save workspace → restart → load → verify windows present via API.

```bash
wibwob microapp.wibwob.figlet.open --text TEST --font doom
wibwob microapp.wibwob.runtime-inspector.open
wibwob microapp.wibwob.contour.open
# save
curl -X POST $API/workspace/save -d '{"name":"test"}'
# restart
bash scripts/restart.sh
# load
curl -X POST $API/workspace/load -d '{"name":"test"}'
# verify
wibwob map  # should show 3+ windows
```

### Phase 2: Clean Death (F1) — signal handlers

Add SIGHUP + process.on('exit') handlers to `src/app.ts`.
Auto-save workspace, clean socket, clean PID file.

**Test:** 
```bash
PID=$(wibwob health | jq .pid)
kill -HUP $PID
sleep 2
ls scratch/instances/     # should be empty
ls scratch/workspaces/    # should have orphan-main.json
cat scratch/wibwob.pid    # should be gone
```

### Phase 3: Boot Workspace (F3)

Add `--workspace` flag to CLI and startup sequence.

**Test:**
```bash
WIBWOB_WORKSPACE=orphan-main bun run dev:world
# or
bun run src/app.ts --workspace orphan-main
wibwob map  # should show restored windows
```

### Phase 4: wibwob attach (F4) — ties it all together

Detect orphan workspace, start new instance, load it.

**Test:**
```bash
# simulate orphan death (from Phase 2)
kill -HUP $(wibwob health | jq .pid)
sleep 2
# resurrect
wibwob attach
wibwob map  # everything back
```

## Key Decisions to Make Before Starting

1. **Workspace format for orphan save** — use existing `WorkspaceService.save()`
   (snapshot registry, misses microapps without handlers) or
   `desktop-save.sh` approach (full /state capture, all microapps)?
   → Answer: snapshot registry, AFTER adding registerSnapshot to Core 7.

2. **Orphan workspace naming** — `orphan-<label>.json` or `orphan-<id>.json`?
   → Label is stable across restarts, id changes. Use label.

3. **Auto-load on boot** — should a new instance auto-load an orphan
   workspace if one exists? Or require explicit `wibwob attach`?
   → Explicit is safer. Auto-load could surprise the user.

4. **What about the alt instance?** — `zuk` has its own scratch dir.
   Socket is at `scratch/alt/instances/zuk.sock`. Same pattern works.
