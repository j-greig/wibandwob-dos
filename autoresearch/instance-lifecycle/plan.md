# E039 Instance Lifecycle — Autoresearch Plan

> **Rule:** prefer `wibwob <command>` over `curl $API/...` everywhere.
> If you find yourself writing `curl -X POST $API/commands/run -d '{"id":"..."}' `,
> stop — use `wibwob <id> --arg val` instead. If the CLI subcommand doesn't
> exist yet (e.g. `workspace.save`), add it to `src/cli/wibwob.ts` first,
> then use it. The CLI handles sockets, JSON, errors. Raw curl is for debugging.

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

## API → wibwob CLI mapping

Every `curl` call in the test harness can be a `wibwob` command instead.
Prefer CLI — it handles socket targeting, JSON parsing, and error codes.

| Test step | curl (current) | wibwob (preferred) |
|-----------|---------------|-------------------|
| Health check | `curl $API/health` | `wibwob health` |
| Open figlet | `curl -X POST $API/commands/run -d '{...}'` | `wibwob microapp.wibwob.figlet.open --text TEST --font doom` |
| Open inspector | `curl -X POST $API/commands/run -d '{...}'` | `wibwob microapp.wibwob.runtime-inspector.open` |
| Open contour | `curl -X POST $API/commands/run -d '{...}'` | `wibwob microapp.wibwob.contour.open` |
| Save workspace | `curl -X POST $API/workspace/save -d '{...}'` | `wibwob workspace.save --name test` ⚠️ needs adding |
| Load workspace | `curl -X POST $API/workspace/load -d '{...}'` | `wibwob workspace.load --name test` ⚠️ needs adding |
| Clear desktop | `curl -X POST $API/commands/run -d '{...}'` | `wibwob desktop.clear-all` |
| Get state | `curl $API/state` | `wibwob state` |
| Count windows | `curl $API/state \| python3 ...` | `wibwob windows -q \| wc -l` |
| Check window type | `curl $API/state \| python3 ...` | `wibwob state \| jq '.windows[].appType'` |
| Get PID | `curl $API/health \| python3 ...` | `wibwob health \| jq .pid` |
| Spatial check | `curl $API/state \| python3 ...` | `wibwob map` |
| Per-window text | `curl $API/screenshot/text?id=N` | `wibwob screenshot N` |
| Target instance | `curl --unix-socket ...` | `wibwob --instance main ...` |
| List instances | `ls scratch/instances/*.sock` | `wibwob instances` |

### Commands we need to add

| Command | What it does | Why |
|---------|-------------|-----|
| `wibwob workspace.save --name X` | Save workspace via command dispatch | Avoid raw curl for save |
| `wibwob workspace.load --name X` | Load workspace via command dispatch | Avoid raw curl for load |
| `wibwob attach` | Detect orphan → start → load → clean up | Core F4 deliverable |

### Test recipe rewritten with wibwob CLI

```bash
# Phase 1: snapshot parity
wibwob microapp.wibwob.figlet.open --text LIFECYCLE --font doom
wibwob microapp.wibwob.runtime-inspector.open
wibwob microapp.wibwob.contour.open
wibwob map                                    # verify 3+ windows
wibwob workspace.save --name lifecycle-test
bash scripts/restart.sh
wibwob workspace.load --name lifecycle-test
wibwob map                                    # should show same windows

# Phase 2: clean death
PID=$(wibwob health | jq -r .pid)
kill -HUP $PID
sleep 2
wibwob instances                              # should be empty
ls scratch/workspaces/orphan-main.json        # should exist

# Phase 3: boot workspace
WIBWOB_WORKSPACE=orphan-main bash scripts/ensure-running.sh
wibwob map                                    # should show restored windows

# Phase 4: attach
kill -HUP $(wibwob health | jq -r .pid)
wibwob attach                                 # one command does it all
wibwob map                                    # everything back
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
