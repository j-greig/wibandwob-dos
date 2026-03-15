# Architecture Reference

Full service and file inventory for WibWob-DOS.
The app is built for a proactive autonomous agent with equal control of the OS alongside a human — every surface that matters to a human must be equally reachable by an agent.

## File Inventory

### Core

- `src/app.ts` — runtime bootstrap only; normalise env before importing the app controller
- `src/core/app-controller.ts` — composition root; owns menus, startup, window creation, workspace restore, high-level command flow
- `src/core/window-facade.ts` — 11-method interface for all window operations (query, geometry, content); implemented by WindowManager; single seam consumed by workspace restore, agent tools, control API, and controller
- `src/core/command-catalog.ts` — source of truth for user-visible command metadata; owns ids, groups, menu placements, palette placement, surface visibility; each command defined ONCE
- `src/core/command-registry.ts` — execution-capable adapter over the catalog; builds menus, palette, lists commands for API/agent use, runs commands by id
- `src/core/window-manager.ts` — z-order, focus, drag, resize, tile, cascade, close; implements WindowFacade
- `src/core/desktop-geometry.ts` — canonical terminal geometry snapshot; exposes `{width, height, cellAspect}`
- `src/core/window-chrome.ts` — maps content size to window size; chrome offsets live here, never inline in window code
- `src/core/overlay-manager.ts` — transient UI primitives: flash, prompts, shared file browser, openers
- `src/core/safe-fs.ts` — filesystem wrappers (safeReadFile, safeWriteFile, safeReadJSON, etc.)
- `src/core/theme/resolver.ts` — runtime theme state, cycle, external theme registration with token fallback fill
- `src/core/ui-parts.ts` — **shim**: re-exports from `src/ui/` for backward compat

### UI Design System (`src/ui/`)

Terminal component library. See `docs/design-system.md` for full reference.

- `src/ui/types.ts` — Rect, LayoutPart, FlexBasis, TrackSize, AxisAlign
- `src/ui/layout.ts` — Stack, Row, Grid, responsive breakpoints, rect helpers
- `src/ui/chrome.ts` — HeaderBar, StatusBar, TextBlock, InputLine, MessageHistory, Rule, FigletDisplay, AnimatedPanel, ButtonBar
- `src/ui/containers.ts` — ScrollViewport, BorderedPanel, CollapsibleBlock, ContentStack, SidebarPanel, SelectableList, InlineSearch, Tabs
- `src/ui/data.ts` — KeyValuePanel, LogView, DataTable
- `src/ui/feedback.ts` — ProgressBar, Spinner, Toast
- `src/ui/forms.ts` — Button, Checkbox, RadioGroup, Select, FilterableList, FormField, TextArea
- `src/ui/patterns.ts` — 11 pattern generators, data simulation helpers, colour utilities

### SDK (`src/sdk/`)

Microapp-facing surface. Stable import path: `src/services/microapp-sdk.ts`.

- `src/sdk/composition-helpers.ts` — handle-based UI helpers (createSimpleStatusBar, createTextViewer, createListPanel, createSplitView, createSimpleButtonBar)
- `src/sdk/microapp-host.ts` — host/window/chat contract for microapp authors
- `src/sdk/runtime-helpers.ts` — reusable SDK helpers
- `src/sdk/runtime-client.ts` — read-only runtime API helpers

### Services

- `src/services/state-service.ts` — canonical live desktop/app/window state; every window reports semantic content metadata through `describeState()`
- `src/services/control-api.ts` — local HTTP control surface; see `.agents/shell-dev/control-api.md` for full endpoint list
- `src/services/workspace-service.ts` — named workspace persistence only
- `src/services/content-service.ts` — repo content discovery and text-file utility behaviour
- `src/services/content-measurement.ts` — shared content measurement for primers, text, and future content types; returns content metrics, never chrome-adjusted widget math
- `src/services/backrooms-service.ts` — Backrooms-specific corpus, run-root prep, playback helpers
- `src/services/figlet-service.ts` — shared FIGlet catalogue and real `figlet` CLI render bridge
- `src/services/agent-tools.ts` — agent-facing TUI tools; registry-backed `tui_list_commands` and `tui_run_command`; all tools use TuiToolContext wrapping WindowFacade
- `src/services/wibwob-agent-session.ts` — native agent session; owns model selection, tool wiring, desktop state injection via transformContext; 7 jailed coding tools scoped to REPO_ROOT
- `src/services/file-actions.ts` — file I/O: open primer, open editor, save, save-as
- `src/services/scene-planner.ts` — VJ timeline scene planning
- `src/services/timeline-types.ts` — shared types for VJ timeline

### Windows

- `src/windows/wibwob-agent-window.ts` — native agent window factory; themed tool display using wibwob-tv colour palette; reports appType `wibwob-agent`
- `src/windows/file-manager-window.ts` — Finder-style file manager (1627 lines)
- `src/windows/primer-gallery-window.ts` — tabbed primer gallery with search
- `src/windows/text-viewer-window.ts` — primer/reader content viewer
- `src/windows/primer-browser-window.ts` — simple primer list browser
- `src/windows/browser-reader-window.ts` — thin file→viewer facade
- `src/windows/browser-utils.ts` — shared viewport/label utilities
- `src/windows/backrooms-windows.ts` — Backrooms TV window and log browser

## Adding a New Window Type

Checklist — every item is mandatory:

1. Extend `WindowKind` in `src/core/types.ts`
2. Wire through menus or a clear key path in `command-catalog.ts`
3. Ensure it can focus cleanly (`frame.focus = () => { windowManager.focusWindow(frame); widget.focus(); }`)
4. Ensure cleanup runs on close if timers or external resources are involved
5. Add meaningful `describeState()` metadata — appType, summary, and any semantic fields agents need
6. If it renders sized content, route measurement through `content-measurement.ts`
7. If it needs non-standard chrome, declare offsets in `window-chrome.ts`
8. If it repeats a pattern already used elsewhere, extract the pattern first
9. Route all colours, borders, and emphasis through semantic theme tokens — never inline blessed style literals
10. Add a control path in `control-api.ts` and verify it appears in `GET /commands/list`

## Code Style

- keep state explicit — prefer plain values and small records over hidden widget state
- keep services pure where possible — discovery, render helpers, workspace I/O, catalogue logic belong in services
- keep window behaviour local to the window factory — content widget wiring, focus, cleanup, and `describeState()`
- reuse shared browser/picker primitives — do not add ad hoc one-line prompts when a browser fits
- one source of truth per concern — geometry in `DesktopGeometryService`, chrome in `window-chrome.ts`, measurement in `content-measurement.ts`, state shape in `StateService` + `types.ts`
- content metrics are content metrics — `contentWidth`/`contentHeight` describe the renderable payload; borders and padding belong to chrome
- keep names precise — `measurePrimerContent`, `contentToWindowSize`, `getPrimerInfo`; avoid `utils`, `misc`, `helpers2`
- prefer composable helpers over inheritance theater — small functions, direct wiring, obvious ownership

### Blessed Pattern

When adding new app/game/chat windows, copy the structural pattern of existing modular windows such as:
- `src/windows/wibwob-agent-window.ts`
- microapps under `microapps-private/`

The preferred shape is:
- service-owned logic/state
- window-owned render + focus + cleanup
- explicit top/transcript/status/input regions where needed
- explicit boxes and layout over magic widgets
- no reliance on implicit Blessed textbox magic if a plain input box is clearer

## Completed Architecture Work

- **WindowFacade** — 11-method interface; all 4 consumers collapsed; ~80 lines deleted from controller
- **Chat collapse** — standalone chat removed; agent work centred on native Wib&Wob Agent path
- **Command catalog** — single source of truth; `menuPlacements[]` eliminates triple-entry duplication
- **Command registry** — execution layer with list/run; consumed by control API and agent tools
- **Context menus** — shared desktop/window commands from registry, not a second hard-coded list
- **Editor save** — Save, Save As, dirty indicator, context menu
- **Agent tools** — registry-backed `tui_list_commands`/`tui_run_command` plus jailed coding tools

## Known Rough Edges

- `app-controller.ts` ~2050 lines — continue decomposing into focused window families
- Workspace startup: intended direction is restore `scratch/workspaces/default.json` first, Scramble fallback second; not yet unified
- Theme/appearance not yet a first-class subsystem — target: `appearance-service` with semantic tokens compiled into blessed styles
- Async workspace restore race: `getLastWindow()` after promise-returning openers can miss the window
- Chrome browser service has pre-existing type errors (`@types/jsdom`, `@types/turndown-plugin-gfm`)

## World Chat / IRC Transport

World chat is a service-transport split. Never conflate them.

**Service** — `src/services/world-chat-service.ts`
Owns channel state, participants, message history, chatspot registry, and the `ensureWorld`
world-key lifecycle. The service never touches sockets or IRC protocol directly.

**Transport** — `src/services/world-chat-transport.ts`
Implements `WorldChatTransport` (5 methods: `connect`, `join`, `send`, `status`, `onEvent`).
Two concrete implementations:
- `LocalWorldChatTransport` — no-op stub (default when `WIBWOB_CHAT_TRANSPORT` is unset)
- `IrcWorldChatTransport` — backed by `irc-framework` (kiwiirc); handles protocol,
  PING/PONG, and auto-reconnect. Activated by `WIBWOB_CHAT_TRANSPORT=irc`.

**Dev IRC server** — `.agents/skills/ww-room-chat/scripts/dev-irc-server.ts`
Hand-rolled Bun TCP server. Minimal command set: NICK, USER, JOIN, PRIVMSG, PING, QUIT.
Port 6667. Start with `bun run dev-irc-server`. No TLS, no auth, local dev only.

**Launch with IRC:**
```
WIBWOB_CHAT_TRANSPORT=irc WIBWOB_CHAT_IRC_HOST=127.0.0.1 WIBWOB_CHAT_IRC_PORT=6667 WIBWOB_INSTANCE_LABEL=main bun run src/app.ts --dev
```
Or: `bun run dev:world` (package.json alias).

**Fixed (e020 S06):** `worldKey` no longer encodes viewport dimensions. Key is now
`terrainName:seed` only. Resize recalculates chatspot positions only; channel state
(messages, participants) is preserved. Fix landed in `world-chat-service.ts:ensureWorld`.

**Type stubs:** `src/types/irc-framework.d.ts` — typed event overloads for `registered`,
`message`, `join`, `close`, `error`. Extend here if new events are needed.

**Reference impl:** `vendor/pirc-extension/src/` — shows irc-framework + pi extension
integration patterns. `driver.ts` (subprocess RPC) is protocol-agnostic and reusable.

## Tmux session management

The live app runs in tmux session **`wibwob`**. Agents interact via the control API
(port 8099) and `tmux send-keys` for keyboard input.

**Restart pattern** (preserve session, replace process):
```bash
APP_PID=$(ps aux | grep "bun run src/app.ts" | grep -v grep | awk '{print $2}')
kill $APP_PID          # SIGTERM — blessed cleanup runs
sleep 3
tmux send-keys -t wibwob 'bun run dev:world' Enter
sleep 10 && curl -s http://127.0.0.1:8099/health
```

Use `kill -9` only as fallback. If terminal is left dirty after a hard kill, run
`printf '\033[?1000l\033[?1002l\033[?1003l\033[?1006l\033[?25h\033[0m' && reset`
in the tmux pane.

Full launch/restart reference: `.agents/skills/ww-ops/SKILL.md`

## Dual-instance setup

Running two WibWob-DOS instances on one machine requires three isolations:

| Resource | Conflict | Fix |
|----------|----------|-----|
| HTTP API port | both bind 8099 → EADDRINUSE | `CONTROL_API_PORT=8098` for alt |
| Workspace + state | both read/write `scratch/workspaces/`, `scratch/app-state.json` | `SCRATCH_DIR=scratch/alt` for alt |
| World-chat log | both append to same file | same `SCRATCH_DIR` fix covers this |
| IRC nick | both try same nick → 433 | `WIBWOB_INSTANCE_LABEL=zuk` for alt |
| TTY | blessed crashes without a real PTY | each instance needs its own tmux window |

**Launch pattern:**
```bash
# Main instance already in wibwob:0

# Alt instance — use the script, not inline tmux commands
bash scripts/start-alt-instance.sh
# → creates window, launches, polls /health, prints window index

curl -s http://127.0.0.1:8099/health   # main
curl -s http://127.0.0.1:8098/health   # alt
```

**Window targeting pitfall:** `tmux new-window -n "alt"` names the window but
does not make "alt" a valid target. Always capture the index:
`WIN=$(tmux new-window -t wibwob -P -F '#{window_index}')`

`dev:world:alt` sets `WIBWOB_INSTANCE_LABEL=zuk CONTROL_API_PORT=8098 SCRATCH_DIR=scratch/alt`.

The alt instance will NOT restore the main workspace on first run (no `scratch/alt/workspaces/default.json`
exists) — it falls back to Scramble. That is fine for smoke tests.

**Scratch paths** — `SCRATCH_DIR` env var (config.ts) controls:
- `WORKSPACES_DIR` → `<SCRATCH_BASE>/workspaces`
- `STATE_PATH`     → `<SCRATCH_BASE>/app-state.json`
- `CAPTURES_DIR`   → `<SCRATCH_BASE>/captures`
- `LOGS_DIR`       → `<SCRATCH_BASE>/logs`
- `PI_AGENT_HOME`  → `<SCRATCH_BASE>/pi-agent-home`
- `APP_NOTES_PATH` → `<SCRATCH_BASE>/mvp-notes.txt`

Paths NOT yet covered by `SCRATCH_DIR` (hard-coded in individual windows):
`scratch/captures` in contour/plasma/terrain windows, `scratch/generated/smear` in
app-controller. These are captures only (not read on startup) — they don't cause
dual-instance conflicts in practice.
