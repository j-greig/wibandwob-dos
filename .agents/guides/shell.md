# Shell Guide

> COAT principle, state flow, four seams, key files: `ARCHITECTURE.md`

Invariants, anti-patterns, control API, and shell-specific patterns.

---

## Architecture invariants

**1. One concept, one owner.**
If a concept has a home, extend that home. Do not create parallel helpers for the same concern.

**2. Services own logic, windows own wiring.**
Services: discover, measure, persist, resolve, transform. Windows: render, bind keys/mouse, manage focus/cleanup, expose state. Never swap.

**3. User-visible = API-visible.**
Every window, command, mode, or state that matters to a user must have a typed representation in desktop state and a control path in `control-api.ts`. `describeState()` and the API evolve together.

**4. Every themed widget must be restyleable.**
Any blessed node created with a theme colour must be reachable from `onRestyle()`. Verify by switching theme with the window open.

**5. Reorg passes do not add product surface.**
When the goal is cleanup: extract, consolidate, normalise first. No new window types or UI entry points unless explicitly asked.

**6. WindowFacade is the only window seam.**
`src/core/window-facade.ts` — 11 methods. All consumers (TUI, CLI, API, agent tools) use this interface identically. Never access `window-manager.ts` directly from outside `src/core/`.

**7. All filesystem I/O through `safe-fs.ts`.**
Never raw `fs.*` calls elsewhere in `src/`. `safe-fs.ts` handles error normalisation, path safety, and test interception.

**8. Command catalog is the single source of truth.**
`src/core/command-catalog.ts` — every user-visible command is defined once here. `command-registry.ts` is execution only. Never add a command in the registry without a catalog entry.

**9. Microapps import only from `microapp-sdk.ts`.**
COAT boundary. If a microapp touches `src/core/` or `src/services/` directly, it's a violation.

**10. `describeState()` is not optional.**
Every window that an agent could need to inspect must implement `describeState()`. Agents cannot scrape UI text.

**11. Host owns complexity, microapps stay small.**
The host handles rendering, layout, focus, lifecycle, input routing, diagnostics. A microapp that replicates host concerns is wrong.

**12. Every SDK component follows the component contract.**
Return type is `{ node, destroy() }`. `destroy()` in `onCleanup`. Theme in `onRestyle`. See `guides/microapp.md §Component contract`.

**13. Geometry flows one direction.**
`DesktopGeometryService` → chrome calculation → content measurement → widget sizing. Never set blessed geometry values derived from magic constants or widget.width at call time.

**14. No inline blessed style literals.**
All colours and styles via semantic theme tokens (`host.theme()`). Inline literals break theme switching and are invisible to agents.

---

## Anti-patterns

| Anti-pattern | Correct approach |
|-------------|-----------------|
| Adding a new command directly to `command-registry.ts` | Add to `command-catalog.ts` first |
| `fs.readFile` directly | `safeFs.readFile` |
| Accessing window-manager from outside `src/core/` | Use `WindowFacade` |
| Duplicating window-open logic per caller | One command in catalog, one factory |
| Teaching agents to scrape UI text | Add `describeState()` field |
| Caching `host.theme()` result | Call fresh in `onRestyle` |
| Parenting widgets to `host.screen` | Parent to `win.body` |
| `setTimeout` / `setInterval` without cleanup | Register in `onCleanup` |

---

## Pi session bridge

The in-app Wib&Wob Agent can communicate with external pi sessions. Three agent tools: `list_sessions`, `send_to_session`, `get_session_message`. `sessionName` (e.g. `wibwob1`) is sufficient — `--session-control` only required on the sending side.

Current: `pi-session-bridge.ts` is CLIENT only. To make wibwob-dos a first-class peer: spin up a socket server, register under `~/.pi/session-control/<id>.sock`, implement four RPC methods.

**Pi integration rule:** wrap pi behind one service — `wibwob-agent-session.ts`. The app owns window chrome, workspace restore, desktop state, z-order/resize/drag, and typed metadata.

---

## Control API

Default port `8099`. Use `wibwob` CLI — it handles socket discovery and JSON formatting. `curl` for one-off debugging only.

### Core reads

```bash
wibwob -i <label> health                  # process alive?
wibwob -i <label> state                   # full desktop state + all window metadata
wibwob -i <label> windows                 # window list with IDs
wibwob -i <label> read <id>               # captureText() output for a window
wibwob -i <label> minimap                 # ASCII desktop layout
wibwob -i <label> commands                # all command IDs
wibwob -i <label> commands -q             # quiet: IDs only
```

Raw equivalents:
```bash
curl -s http://localhost:8099/health
curl -s http://localhost:8099/state
curl -s http://localhost:8099/screenshot/text?id=<N>
```

### Core writes

```bash
wibwob -i <label> cmd <command.id>                    # run command
wibwob -i <label> window <id> resize --width 120 --height 40
wibwob -i <label> window <id> move --left 10 --top 5
echo "text" | wibwob -i <label> write <id>            # writeInput to window
```

Batch operations (one HTTP call):
```bash
curl -s -X POST http://localhost:8099/windows/batch \
  -H "Content-Type: application/json" \
  -d '[{"id":1,"op":"resize","width":120,"height":40},{"id":1,"op":"move","left":10,"top":5}]'
```

Overlay control (file browser, primer, etc.):
```bash
curl -s -X POST http://localhost:8099/overlay/dismiss   # dismiss any open overlay
curl -s -X POST http://localhost:8099/overlay/confirm   # confirm/select in overlay
```

### Command invocation rules

- Always use the **full command ID** from `GET /commands/list` (e.g. `wibwob.notepad.open`)
- From inside a microapp use `host.runCommand("open")` — prefix auto-added
- `direct: true` bypasses `focusOrCreate` — use for toggle/query commands

### Agent debug loop

```bash
# 1. Discover the instance
bun run src/cli/wibwob.ts instances

# 2. Gate
wibwob -i <label> health

# 3. State snapshot
wibwob -i <label> state | jq '.windows[] | {id, title, appType, summary}'

# 4. Open a window
wibwob -i <label> cmd wibwob.notepad.open

# 5. Read it back
wibwob -i <label> read <id>

# 6. Visual confirmation (preferred over trusting JSON alone)
bash scripts/screenshot-window.sh <id>
```

Desktop state auto-injection: the native Wib&Wob Agent receives `GET /state` automatically at each turn. Agents should call `GET /state` directly when they need the current window list — do not rely on stale injected state from earlier in the conversation.

---

## Adding a new window type (host-managed only)

> This applies to `src/windows/`. Microapps do not extend `WindowKind` — see `guides/microapp.md`.

Mandatory checklist:
1. Extend `WindowKind` in `src/core/types.ts`
2. Wire through `command-catalog.ts` (not registry-only)
3. Clean focus: `frame.focus = () => { windowManager.focusWindow(frame); widget.focus(); }`
4. Cleanup timers/resources in `onCleanup`
5. Meaningful `describeState()` — appType, summary, semantic fields agents need
6. Sized content → route through `content-measurement.ts`
7. Non-standard chrome → declare offsets in `window-chrome.ts`
8. Repeated pattern → extract first, then use
9. All colours via theme tokens — no inline blessed style literals
10. Add control path in `control-api.ts` → verify in `GET /commands/list`

---

## World Chat / IRC transport

Service-transport split — never conflate them.

**Service** — `src/services/world-chat-service.ts`: channel state, participants, message history, chatspot registry, `ensureWorld` lifecycle. Never touches sockets.

**Transport** — `src/services/world-chat-transport.ts`: `WorldChatTransport` interface (5 methods: `connect`, `join`, `send`, `status`, `onEvent`).
- `LocalWorldChatTransport` — no-op stub (default)
- `IrcWorldChatTransport` — irc-framework; handles protocol, PING/PONG, auto-reconnect. Activated by `WIBWOB_CHAT_TRANSPORT=irc`

**Dev IRC server:** `.pi/skills/ww-room-chat/scripts/dev-irc-server.ts` — minimal Bun TCP server, port 6667.

**Launch with IRC:**
```bash
WIBWOB_CHAT_TRANSPORT=irc WIBWOB_CHAT_IRC_HOST=127.0.0.1 WIBWOB_CHAT_IRC_PORT=6667 \
  WIBWOB_INSTANCE_LABEL=main bun run src/app.ts --dev
# or: bun run dev:world
```

---

## Dual-instance setup

| Resource | Conflict | Fix |
|----------|----------|-----|
| HTTP API port | both bind 8099 | `CONTROL_API_PORT=8098` for alt |
| Runtime data root | shared state | `WIBWOB_DATA_DIR=~/.wibwob-zuk` for alt |
| IRC nick | 433 collision | `WIBWOB_INSTANCE_LABEL=zuk` for alt |
| TTY | blessed crashes without PTY | each instance in its own tmux window |

```bash
bash scripts/start-alt-instance.sh    # creates window, launches, polls health

# Explicit data-root isolation (preferred for e053+):
WIBWOB_INSTANCE_LABEL=main WIBWOB_DATA_DIR=$HOME/.wibwob-main bun run dev:world
WIBWOB_INSTANCE_LABEL=zuk  WIBWOB_DATA_DIR=$HOME/.wibwob-zuk  CONTROL_API_PORT=8098 bun run dev:world
```

**tmux window targeting:** always capture the index — `WIN=$(tmux new-window -t wibwob -P -F '#{window_index}')`. Window names are not valid targets.

---

## Blessed mouse drag pattern

Terminals send repeated `mousedown` (not `mousemove`) during drag. Blessed's `screen.on("mouse")` can swallow events during drag.

```
1. screen.on("mouse")          → mousedown (start) + mouseup (end)
2. screen.program.on("mouse")  → drag motion (raw, no element routing)
3. Check data.action === "mousedown" with changing x,y
4. Track dragStart coords + original element position
5. Apply delta: newPos = origPos + (currentMouse - dragStart)
6. screen.program.off("mouse", handler) in onCleanup
```
