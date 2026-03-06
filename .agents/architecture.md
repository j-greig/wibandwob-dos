# Architecture Reference

Full service and file inventory for WibWob-DOS.
The app is built for a proactive autonomous agent with equal control of the OS alongside a human — every surface that matters to a human must be equally reachable by an agent.

## File Inventory

### Core

- `src/app.ts` — runtime bootstrap only; normalise env before importing the app controller
- `src/core/app-controller.ts` — composition root; owns menus, startup, window creation, workspace restore, high-level command flow; should coordinate, not accumulate utilities (~2050 lines — decompose further)
- `src/core/window-facade.ts` — 11-method interface for all window operations (query, geometry, content); implemented by WindowManager; single seam consumed by workspace restore, agent tools, control API, and controller
- `src/core/command-catalog.ts` — source of truth for user-visible command metadata; owns ids, groups, menu placements, palette placement, surface visibility; each command defined ONCE
- `src/core/command-registry.ts` — execution-capable adapter over the catalog; builds menus, palette, lists commands for API/agent use, runs commands by id
- `src/core/window-manager.ts` — z-order, focus, drag, resize, tile, cascade, close; implements WindowFacade
- `src/core/desktop-geometry.ts` — canonical terminal geometry snapshot; exposes `{width, height, cellAspect}`
- `src/core/window-chrome.ts` — maps content size to window size; chrome offsets live here, never inline in window code
- `src/core/overlay-manager.ts` — transient UI primitives: flash, prompts, shared file browser, openers
- `src/core/theme/resolver.ts` — runtime theme state, cycle, external theme registration with token fallback fill

### Services

- `src/services/state-service.ts` — canonical live desktop/app/window state; every window reports semantic content metadata through `describeState()`
- `src/services/control-api.ts` — local HTTP control surface; see `.agents/control-api.md` for full endpoint list
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
- `src/windows/content-windows.ts` — primer viewer, text viewer, browser, gallery, file manager, backrooms TV, figlet
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
- microapps under `modules-private/`

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
