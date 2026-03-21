---
purpose: operational devlog for Claude Code agents running in cloud/headless environments
audience: future Claude Code agents working on WibWob-DOS
created: 2026-03-21
---

# Claude Code Cloud Agent Devlog — WibWob-DOS

> What a headless agent needs to know to be productive in this codebase,
> including every gotcha, failed command, and workaround discovered.

---

## 1. Environment Setup

### Installing dependencies
```bash
# WORKS:
bun install --ignore-scripts
# The canvas native module fails to build in cloud — use --ignore-scripts

# FAILS:
bun install
# → error: install script from "canvas" exited with 1
# → node-pre-gyp ERR! (native compilation fails in cloud containers)
```

### Typecheck
```bash
bun run typecheck  # → runs node_modules/.bin/tsc --noEmit
# Must run bun install first or you get "No such file or directory"
```

---

## 2. Starting WibWob-DOS

### What works
```bash
bash scripts/ensure-running.sh --tmux
# Creates tmux session "wibwob" at 205x55, launches bun run dev:world
# Polls /health until API responds
# Output: ✓ ready  instance=XXXX  port=8099  mode=tmux
```

### What FAILS
```bash
bash scripts/ensure-running.sh --direct
# FAILS in cloud — uses `script` command for PTY allocation
# Error: "script: unexpected number of arguments"
# The `script` command in this Linux container has different flags than macOS
# ALWAYS use --tmux mode in cloud
```

### Restart
```bash
# Clean restart:
bash scripts/restart.sh --tmux

# Hard restart (when API is hung):
kill -9 $(ps aux | grep "bun run src" | grep -v grep | awk '{print $2}')
tmux kill-session -t wibwob
sleep 2
bash scripts/ensure-running.sh --tmux

# If port 8099 is stuck:
bash scripts/clean-instances.sh --kill
# May need --force for stubborn processes
```

### Zombie processes gotcha
When running many curl commands in quick succession, stale bash/curl processes
can accumulate. If the API stops responding:
1. Check `ps aux | grep bun | grep -v grep` — is bun alive?
2. Check CPU: if bun is at 80%+, a microapp is likely causing a render storm
3. Kill stale curl: `pkill -f "curl.*8099"` — BUT this will kill your own curl too
   if you chain it. Run in a separate invocation.

---

## 3. API Interaction

### Key endpoints
```bash
# Health:
curl -sf --max-time 5 http://127.0.0.1:8099/health

# State (all windows):
curl -sf --max-time 5 http://127.0.0.1:8099/state

# List commands:
curl -sf --max-time 5 http://127.0.0.1:8099/commands/list

# Run a command:
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.click-counter.open"}'

# Close a window:
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"window.close","args":{"id":1}}'

# Screenshot (clean text — captureText output):
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/text?id=1"

# Screenshot (ANSI — blessed screen dump):
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/ansi?id=1"

# List windows:
bash scripts/screenshot-window.sh --list
```

### CRITICAL: always use --max-time
```bash
# BAD — will hang forever if API is unresponsive:
curl -sf http://127.0.0.1:8099/health

# GOOD:
curl -sf --max-time 5 http://127.0.0.1:8099/health
```

Without `--max-time`, a hung API will cause your bash command to run in
background forever, consuming a process slot.

### Command ID format
Microapp commands are prefixed: `microapp.{appId}.{commandId}`
- e.g., `microapp.wibwob.click-counter.open`
- The `{appId}` comes from `microapp.json` → `microapp.id`
- The `{commandId}` comes from `host.registerCommand({ id: "open" })`

### Parsing state JSON
```python
# Read window state:
curl -sf --max-time 5 http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    print(f'id={w[\"id\"]} title={w.get(\"title\",\"?\")}')
"
```

---

## 4. Microapp Scaffold

```bash
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh \
  microapps/<dir-name> <app-id> "<Title>" <menu-order>

# Example:
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh \
  microapps/click-counter wibwob.click-counter "Click Counter" 200
```

After scaffolding:
1. Edit `microapps/<name>/index.ts`
2. Add to `src/core/microapp-registry.ts` (beta tier is fine for development)
3. `bun run typecheck`
4. Restart wwdos to load the new microapp

### Registry entry format
```typescript
// In src/core/microapp-registry.ts, add inside REGISTRY:
"wibwob.your-app-id": "beta",
```

---

## 5. Visual Verification Pattern

The correct workflow for verifying a microapp:

```bash
# 1. Open the microapp
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.your-app.open"}'
sleep 1  # wait for render

# 2. List windows to get ID
bash scripts/screenshot-window.sh --list

# 3. Text screenshot (captureText output)
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/text?id=1"

# 4. ANSI screenshot (visual render)
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/ansi?id=1"

# 5. Check window state
curl -sf --max-time 5 http://127.0.0.1:8099/state | python3 -c "
import sys,json; d=json.load(sys.stdin)
for w in d['windows']:
    print(json.dumps(w, indent=2)[:500])
"

# 6. Close window before testing next
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"window.close","args":{"id":1}}'
```

### DO NOT batch-verify microapps in a loop
Running many curl commands rapidly causes the API to become unresponsive.
Test one microapp at a time with proper delays.

---

## 6. Performance Gotchas

### Animation clock + grid-canvas = CPU cliff
```
createAnimationClock(30) + per-cell ANSI codes + gridToText + host.screen.render()
= 87% CPU, API unresponsive, instance effectively dead
```

**Fixes:**
- Use 8-10fps max for animation clocks
- Call `clock.pause()` immediately after creation (it starts running!)
- Avoid ANSI escape codes inside grid cells — use plain characters
- Always call `clock.pause()` when user pauses
- `clock.destroy()` in `onCleanup`

### blessed render is the bottleneck
Every `host.screen.render()` triggers blessed's full diffing algorithm.
At 30fps with complex content, this saturates the event loop and blocks
HTTP request handling.

---

## 7. Failed Approaches (what NOT to do)

### DON'T: run verify loops with many curl calls
```bash
# THIS CAUSES HANGS:
for i in {1..10}; do
  curl -sf -X POST ... open app
  curl -sf ... screenshot
  curl -sf -X POST ... close
done
# The rapid curl churn overwhelms the single-threaded bun runtime
```

### DON'T: use pkill with patterns that match yourself
```bash
# THIS KILLS YOUR OWN COMMAND:
pkill -f "curl.*8099" && curl http://127.0.0.1:8099/health
# The pkill runs first and kills the curl in the && chain
# Instead, run pkill in a separate bash invocation
```

### DON'T: use --direct mode in cloud
```bash
# FAILS: bash scripts/ensure-running.sh --direct
# WORKS: bash scripts/ensure-running.sh --tmux
```

### DON'T: rely on background commands for API calls
Commands that `curl` the API may run in background when the main tool
executor decides to background them. Always use `--max-time` so they
don't hang indefinitely.

---

## 8. SDK Import Pattern

```typescript
// ONLY import from this path:
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createStatusBar, createHeaderBar, ... } from "../../src/services/microapp-sdk.js";

// NEVER import from:
// - src/core/*
// - src/services/* (except microapp-sdk.ts)
// - src/ui/*
// - src/sdk/* directly
```

### Two component models (the biggest confusion)
1. **Composition helpers** (@public, from `sdk/composition-helpers.ts`):
   - `createStatusBar`, `createTextViewer`, `createListPanel`, `createSplitView`,
     `createTabs`, `createCanvas`, `createInputLine`, `createHeaderBar`, `createScrollView`
   - Take `parent: blessed.Widgets.BoxElement` as first arg
   - Position themselves in parent with `top`/`bottom` offsets
   - Return handles with `.element`, `.update()`, `.destroy()`

2. **LayoutPart components** (@internal, from `core/ui-parts*.ts`):
   - `createProgressBar`, `createKeyValuePanel`, `createDataTable`, `createSpinner`
   - Do NOT take a parent arg
   - Need `createStack`/`createRow` for positioning
   - Return `LayoutPart` with `.node`, `.layout(rect)`, `.restyle()`, `.destroy()`
   - Used via: `const root = createStack(win.body, [{ key, basis, part }])`

Both are imported from `microapp-sdk.ts` — no indication which is which.

---

## 9. Devlog Script

```bash
scripts/devlog.sh "your note here"
# Appends timestamped entry to .pi/reflections/YYYY-WNN.md
```

---

## 11. Follow-up Assessment (2026-03-21)

> Added after review of the full branch. These are conclusions from the Cladue Code agent
> reading the devlog end-to-end and assessing what should happen next to make their
> next run easier and smoother.

### Can the scripts be modified to work for both humans and agents?

**Yes, and mostly they already do.** Two specific issues:

- **`--direct` mode** (default in `ensure-running.sh`, `restart.sh`, `start-alt-instance.sh`) uses macOS `script` flags that don't exist on cloud Linux.
- **The gen-\* scripts all work headlessly already** — they're pure file-I/O, no running instance needed.

**The fix is small:** add a no-TTY guard to startup scripts:
```bash
if [ ! -t 0 ]; then MODE=tmux; fi
```
This makes them auto-select `--tmux` when there's no interactive terminal — agents get `--tmux` automatically, humans keep `--direct` as default. No interface change needed.

### Should the devlog become a proper reference doc?

**Yes.** The devlog content is already excellent and was the primary reference for the whole session. The issue isn't content — it's **discoverability**. It's buried at `.pi/reflections/`.

### Best location for future Claude Code agents to find it

**Proposed: `MICROAPP-DEV.md` at the repo root.**

Reasoning:
- Root-level CAPS `.md` files are the established convention (`AGENTS.md`, `ARCHITECTURE.md`, `PHILOSOPHY.md`, `LEXICON.md`)
- Claude Code reads `CLAUDE.md` first — one pointer line there gives instant discoverability
- Name matches what agents need: microapp development procedures
- Content should be **proven procedures** distilled from this devlog, not the raw trial-and-error narrative

### Proposed next actions (in priority order)

1. **Create `MICROAPP-DEV.md`** at repo root — curated procedures from this devlog
2. **Patch startup scripts** — add the `! -t 0` headless guard to `ensure-running.sh`, `restart.sh`, `start-alt-instance.sh`
3. **Add pointer in `CLAUDE.md`** — single line pointing to `MICROAPP-DEV.md`

---

## 10. Quick Reference Commands

```bash
# Start:           bash scripts/ensure-running.sh --tmux
# Restart:         bash scripts/restart.sh --tmux
# Hard kill:        kill -9 $(ps aux | grep "bun run src" | grep -v grep | awk '{print $2}')
# Typecheck:        bun run typecheck
# Health:           curl -sf --max-time 5 http://127.0.0.1:8099/health
# State:            curl -sf --max-time 5 http://127.0.0.1:8099/state
# Open app:         curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' -d '{"id":"microapp.ID.open"}'
# Screenshot:       curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/text?id=N"
# ANSI screenshot:  curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/ansi?id=N"
# Window list:      bash scripts/screenshot-window.sh --list
# Close window:     curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' -d '{"id":"window.close","args":{"id":N}}'
# Scaffold:         bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh microapps/<dir> <id> "<title>" <order>
# Devlog:           scripts/devlog.sh "note"
```
