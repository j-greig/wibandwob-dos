# AGENTS.md

This file is local guidance for agents working in `/Users/james/Repos/wibandwob-dos`.

## Purpose

WibWob-DOS is a terminal-native TypeScript desktop shell.

Canonical doc inventory:
- `docs/000-docs-overview.md`
  - update this whenever a doc is added or its status materially changes
  - use this to decide which docs are live; do not assume every file in `docs/` is current

Doc triage rule:
- prefer `active` and `partial` docs for current work
- treat `reference` as background only
- treat `retired` as archaeology only unless you are validating or backfilling something specific
- when an older doc has been absorbed into a canonical active doc, prefer
  retiring or deleting it over keeping two overlapping planning sources alive
- when a doc is retired but worth preserving briefly, move it under
  `docs/.trash/` so it stops polluting the active docs root

Current goals:
- stay terminal-native
- use Bun as the runtime and package manager
- use `blessed` for rendering
- prove overlapping desktop-style windows, menus, file viewers, editing, and small animated views
- keep scope small and honest

Non-goals:
- do not port all of Turbo Vision here
- do not pretend this is already a full VT terminal emulator
- do not pivot toward Electrobun or webview rendering unless explicitly requested

## Design Canon

This codebase exists partly to undo the duplication and verbosity that accumulated in the C++ app.

The bar is:

- one concept, one owner
- one measurement path
- one sizing path
- one state path
- one layout path
- one agent/runtime integration path per feature
- one control/API path for every user-visible window/app surface

The code should be:

- DRY without becoming abstract theater
- small in surface area
- explicit in data flow
- semantically precise
- easy for multiple agents to extend without creating parallel systems

Prefer the most elegant correct implementation, not the fastest pile of special cases.

## Stack

- Runtime: Bun
- Renderer: `blessed`
- Main app entry: `/Users/james/Repos/wibandwob-dos/src/app.ts`
- Prefer Bun/package.json scripts for app startup and common tasks.
- Prefer `package.json` scripts first, `scripts/` for harnesses and operational tooling.

## Architecture

- `src/app.ts`
  - runtime bootstrap only
  - normalize env before importing the app controller
- `src/core/app-controller.ts`
  - app composition root
  - owns menus, startup, window creation, workspace restore, and high-level command flow
  - should coordinate, not become a utility dump
- `src/core/window-facade.ts`
  - 11-method interface for all window operations (query, geometry, content)
  - implemented by WindowManager
  - single seam consumed by workspace restore, agent tools, control API, and controller
- `src/core/command-catalog.ts`
  - source of truth for user-visible command metadata
  - owns command ids, groups, menu placements, palette placement, and surface visibility
  - each command defined ONCE with menuPlacements[] for cross-menu appearance
  - current menu intent:
    - `File` = file/workspace operations
    - `View` = meta views such as palette/inspector/document reader
    - `Window` = focus/layout/workspace management
    - `Applications` = app launchers
- `src/core/command-registry.ts`
  - execution-capable adapter over the catalog
  - builds menus, builds palette entries, lists commands for API/agent use, and runs commands by id
  - consumed by control API (GET /commands/list, POST /commands/run) and agent tools (tui_list_commands, tui_run_command)
- `src/core/window-manager.ts`
  - z-order, focus, drag, resize, tile, cascade, close
  - implements WindowFacade interface
- `src/core/desktop-geometry.ts`
  - canonical terminal geometry snapshot
  - exposes `{width, height, cellAspect}`
- `src/core/window-chrome.ts`
  - maps content size to window size
  - chrome offsets live here, not inline in window code
- `src/core/overlay-manager.ts`
  - transient UI primitives: flash, prompts, shared browser/openers
- `src/services/state-service.ts`
  - canonical live desktop/app/window state snapshot
  - every window should report semantic content metadata through `describeState()`
- `src/services/control-api.ts`
  - local HTTP control surface over state + window actions
- `src/services/workspace-service.ts`
  - named workspace persistence only
- `src/services/content-service.ts`
  - repo content discovery and text-file utility behavior
- `src/services/content-measurement.ts`
  - shared content measurement for primers, text, and future content types
  - returns content metrics, never chrome-adjusted widget math baked into callers
- `src/services/backrooms-service.ts`
  - Backrooms-specific corpus, run-root prep, playback helpers
- `src/services/figlet-service.ts`
  - shared FIGlet catalogue + real CLI render bridge
- `src/services/agent-tools.ts`
  - agent-facing TUI tools, including registry-backed `tui_list_commands` and `tui_run_command`
  - all tools use TuiToolContext which wraps WindowFacade
- `src/services/wibwob-agent-session.ts`
  - native agent session for the in-app Wib&Wob Agent surface
  - owns model selection, tool wiring, and desktop state injection via transformContext
  - 7 jailed coding tools (read, write, edit, bash, grep, find, ls) scoped to REPO_ROOT
- `src/windows/wibwob-agent-window.ts`
  - native agent window factory
  - themed tool display using wibwob-tv colour palette
  - reports appType `wibwob-agent`
- `src/services/file-actions.ts`
  - file I/O: save, save-as, writeEditorWindow (returns boolean)

## Architecture Invariants

These rules are strict. Treat violations as bugs, not style nits.

1. Single source of truth per concern.
   - If a concept already has a home, extend that home.
   - Do not create a second helper/service/path for the same concern because it is locally convenient.

2. Measurement is content-only.
   - Content measurement returns content dimensions and content semantics.
   - Border, titlebar, padding, toolbar, and shadow are chrome, not content.

3. Chrome is declarative.
   - Window size math belongs in `window-chrome.ts`.
   - No inline `+2`, `+3`, `+6`, or copied size formulas in window code.

4. Desktop geometry is canonical.
   - Screen width/height/cellAspect come from `DesktopGeometryService`.
   - Do not invent local geometry math unless the result is immediately derived from canonical geometry.

5. Window state is self-describing.
   - Every window type must expose semantic metadata through `describeState()`.
   - If an agent needs a property, add it to the window metadata contract rather than teaching the agent to scrape UI text.

6. One reusable interaction component before many prompts.
   - Repeated picker/open/select flows belong in `OverlayManager` or a dedicated shared component.
   - Do not add one-off textbox prompts for file/font/workspace/content selection when a shared browser can do it.

7. Layout is an engine, not scattered commands.
   - New placement logic should move toward shared layout primitives, not bespoke coordinate code per feature.

8. User-visible commands should be defined once.
   - Menu and palette entries should derive from `command-catalog.ts`.
   - Use explicit `order` values with gaps (`0, 10, 20...`) so commands can be inserted later without renumbering everything.
   - `category` decides the menu bucket, not ad hoc hand placement in multiple files.

9. Services own logic, windows own wiring.
   - Services discover, measure, persist, resolve, and transform data.
   - Window factories render widgets, bind keys/mouse, manage focus/cleanup, and expose state.

10. No duplicate fallbacks unless centrally owned.
   - If a fallback mode exists, it must be declared in the owning service.
   - Do not embed secondary fallback logic inside window code and service code at the same time.

11. Experimental integrations must stay behind one seam.
   - If we try a foreign runtime or agent stack, wrap it in a single service boundary first.
   - Do not leak vendor-specific assumptions across the app.

12. User-visible surfaces must be API-visible.
   - If a window, app, button, command, mode, or state matters to a user, it must have a typed representation in desktop state and a control path in `control-api.ts`.
   - Do not add UI-only commands that agents cannot discover or invoke later.
   - `describeState()` and the control API should evolve together.
   - Window-local actions count too. If a window has a primary action like send, restart, run, save, or open, expose a control path for it instead of requiring UI scraping.

13. Reorg passes do not add product surface area.
   - When the active goal is architecture cleanup, do not add new window types or scattered UI entry points unless the user explicitly asks for them in that same pass.
   - Prefer extracting, consolidating, and normalizing existing behavior first.

## Code Style

- Keep state explicit.
  - Prefer plain values and small records over hidden widget state.
- Keep services pure where possible.
  - File discovery, render helpers, workspace I/O, and catalogue logic belong in services.
- Keep window behavior local to the window factory.
  - A window type should own its content widget wiring, focus behavior, cleanup, and `describeState()`.
- Reuse shared browser/picker primitives.
  - Do not add new ad hoc one-line prompts for file/workspace/font selection when a browser/list picker fits.
- One source of truth per concern.
  - Workspace paths live in `WorkspaceService`.
  - Desktop geometry lives in `DesktopGeometryService`.
  - Window chrome math lives in `window-chrome.ts`.
  - Content measurement lives in `content-measurement.ts`.
  - Desktop state shape lives in `StateService` + `types.ts`.
  - Backrooms primer resolution lives in `BackroomsService`.
- Content metrics are content metrics.
  - `contentWidth` / `contentHeight` should describe the renderable payload.
  - Border, titlebar, toolbar, and padding belong to chrome sizing, not measurement.
- Keep names precise.
  - Prefer domain names that describe intent: `measurePrimerContent`, `contentToWindowSize`, `getPrimerInfo`.
  - Avoid vague helpers like `utils`, `misc`, `helpers2`, or duplicate verbs for the same operation.
- Prefer composable helpers over inheritance theater.
  - No framework-within-a-framework.
  - Small functions, direct wiring, obvious ownership.

## Command Catalog Usage

- `src/core/command-catalog.ts` is the source of truth for user-visible command definitions.
- `src/core/command-registry.ts` is the execution and projection layer over that catalog.
- If you add a new user-visible command, add it to the command catalog first instead of hand-wiring menu and palette entries in multiple places.
- Use explicit spaced `order` values (`0, 10, 20...`) so later insertions do not force renumbering.
- Use `menuPlacements` for commands that appear in more than one menu. Do not duplicate those as separate command ids just to hit File/View/Window/Applications.
- Default to one top-level menu placement per command. Duplicate placements
  should be rare exceptions, not normal practice.
- `group` is for logical clustering and future separators/adapters.
- `actionKey` must point at an `AppMenuActions` entry implemented by `app-controller.ts`.
- Preserve the naming split:
  - `Document Reader` = local file/markdown reader
  - `Chrome Browser` = real web browser/extraction surface
- Current registry phase covers menu/palette projection plus generic control API command discovery/execution.
- `Wib&Wob Agent` also has registry-backed `tui_list_commands` and `tui_run_command` tools now.
- Agent guidance should prefer registry commands first for high-level actions and use low-level window tools only for precise manipulation.
- Some window-local actions and MCP exposure still lag behind the registry. Shared context-menu actions are already on the registry path.

## Anti-Patterns

Do not introduce these:

- parallel measurement functions for different callers
- per-window copies of generic sizing logic
- state fields that duplicate the same fact under different names
- direct widget scraping when semantic state can be exposed
- vendor code referenced directly from many app files
- giant controller growth when a window family or service can be extracted cleanly
- “just this once” prompt flows that should be shared components
- hardcoded geometry magic numbers without named ownership

## Pi Session Bridge

The in-app Wib&Wob Agent can communicate with external pi sessions (wibwob1, wibwob2) running on the same machine.

Three agent tools:
- `list_sessions` — discover all live sessions by name and socket id
- `send_to_session` — deliver a message to a named session
- `get_session_message` — read the last response from a session

Routing note: `sessionName` (e.g. "wibwob1") is sufficient to route a message. The `--session-control` flag is only required on the SENDING side. The receiver does not need it. No extra flag is needed when calling `send_to_session` from the in-app agent.

Current topology: pi sessions (wibwob1, wibwob2) create Unix sockets at `~/.pi/session-control/<id>.sock` and speak JSON-RPC. The in-app agent bridge (`pi-session-bridge.ts`) is currently a CLIENT only — it can send to pi sessions but does not appear in `list_sessions` itself.

To make wibwob-dos a first-class peer visible to other nodes:
- spin up a socket SERVER in `pi-session-bridge.ts`
- register the socket under `~/.pi/session-control/<id>.sock`
- implement four RPC methods: `send`, `get_message`, `get_summary`, `clear`
- then `list_sessions` from any node will discover wibwob-dos automatically

## Pi Integration Rule

`pi-mono` is vendored for evaluation and potential runtime reuse.

Current direction:

- yes to using `pi-coding-agent` as an engine inside the app
- no to letting vendor UI own the desktop/window-manager architecture

The safe rule is:

- if we embed pi, wrap it behind one service such as `wibwob-agent-service.ts`
- our app still owns:
  - window chrome
  - workspace restore
  - desktop state
  - z-order / resize / drag
  - typed metadata for agent-visible state

If terminal-hosted pi work ever returns, treat it as an experiment, not the architectural foundation. The foundation should still be service-backed and state-aware.

Run commands:

```bash
bun install
bun run typecheck
bun run dev
```

## Current Behavior

The app currently includes:
- fullscreen terminal app shell
- top menu bar, bottom status line (shows theme name, window count, focus info)
- desktop background fill with themed fill characters
- draggable floating windows with app-owned shadows
- theme system: 5 variants (dark, nord, pastel, phosphor, light), live switching via Alt+T / menu / palette / API, theme picker, `theme.set` API command, workspace theme persistence
- primer viewer window
- text editor window
- primer browser window (discovers symlinked private primers)
- primer gallery with tabbed categories and preview
- file manager browser
- document reader
- chrome browser (web extraction)
- shared browser/openers for workspace and file selection
- animated generative art window
- pattern field window
- companion (Scramble the cat)
- command palette
- state inspector
- workspace manager with save/load
- native `Wib&Wob Agent` backed by `WibWobAgentSession`
- Backrooms TV with real/fake-live modes and per-run primer roots
- FIGlet window backed by the shared font catalogue and real `figlet` CLI

## Control Loop

The app has a local HTTP control surface intended for autonomous debug loops and agent-driven validation.

`AGENTS.md` and `CLAUDE.md` should stay identical in this section.

Primary use:
- open windows
- inspect live desktop/window state
- send input to agent/editor windows
- export text captures to `scratch`
- compare captures while iterating on code

State/control owner:
- `src/services/control-api.ts`

Current control endpoints (POST bodies shown where non-obvious):

Use `GET /help` or `GET /openapi.json` first for the live authoritative endpoint catalogue. `GET /help` returns structured endpoint objects including body field shapes. The static list below is quick reference only.

- `GET /state`
- `GET /health`
- `GET /help`                        — structured endpoint catalogue with method, path, description, body field shapes
- `GET /openapi.json`               — OpenAPI 3.0 spec derived from ENDPOINT_CATALOGUE (paste into editor.swagger.io)

`AGENTS.md` and `CLAUDE.md` should stay identical in this section.
Use `GET /help` or `GET /openapi.json` first for the live authoritative endpoint catalogue. `GET /help` returns structured endpoint objects with body field shapes. The static list below is quick reference only.

`AGENTS.md` and `CLAUDE.md` should stay identical in this section.
Use `GET /help` or `GET /openapi.json` first for the live authoritative endpoint catalogue. `GET /help` returns structured endpoint objects with body field shapes. The static list below is quick reference only.
- `GET /commands/list`
- `GET /content/primer-info?path=...`
- `GET /windows/text?id=...`
- `GET /screenshot/text?id=...`
- `POST /commands/run`              `{"id":"command-id","args":{}}` — canonical field is `id`; `command` accepted as deprecated alias
- `POST /view/primer/open`          `{"filePath":"/abs/path.txt"}`
- `POST /view/figlet/open`          `{"text":"HELLO","font":"optional"}`
- `POST /view/backrooms/open`       `{"theme":"...","mode":"auto|live|fake-live","model":"haiku|sonnet","turns":3,"primers":"optional"}`
- `POST /view/editor/open`          `{"filePath":"/abs/path.txt"}`
- `POST /view/browser-reader/open`  `{"filePath":"/abs/path.txt"}`
- `POST /view/art/open`             `{}` (no args)
- `POST /view/wibwob-agent/open`    `{}` (focuses existing if open)
- `POST /view/companion/open`       `{}`
- `POST /view/primer-browser/open`  `{}`
- `POST /view/file-manager/open`    `{}`
- `POST /view/primer-gallery/open`  `{}`
- `POST /view/workspace/open`       `{}`
- `POST /view/palette/open`         `{}`
- `POST /view/inspector/open`       `{}`
- `POST /windows/focus`             `{"id":N}`
- `POST /windows/move`              `{"id":N,"left":X,"top":Y}`
- `POST /windows/resize`            `{"id":N,"width":W,"height":H}`
- `POST /windows/close`             `{"id":N}`
- `POST /windows/batch`             `{"ops":[{"id":N,"x":X,"y":Y,"w":W,"h":H},{"id":M,"close":true},...]}` — move/resize/close many windows in one call, applied in order. Prefer this over chained individual calls.
- `POST /windows/input`             `{"id":N,"input":"text\r"}` — trailing `\r` submits
- `POST /windows/agent-message`     `{"id":N,"text":"message","sender":"wibwob2"}` — send to agent window with named sender label. Outbound messages from the in-app agent include `replyVia: {url:"http://127.0.0.1:8099/windows/agent-message", windowId:N}` as return address.
- `POST /windows/text/export`       `{"id":N,"name":"optional-name"}` — `name` is canonical; `label` accepted as alias
- `POST /workspace/load`            `{"name":"workspace-name"}`
- `POST /workspace/load`            `{"name":"workspace-name"}`
- `POST /workspace/save`            `{"name":"workspace-name"}`
- `POST /workspace/load`            `{"name":"workspace-name"}`

Quick reference — common commands via POST /commands/run:
- poetry clock mode:  `{"id":"microapp.wibwob.poetry-clock.set-mode","args":{"mode":"clock"|"sentient","voice":"plain"|"liminal"|"scramble"}}`

Control parity rule:
- whenever a new window family, app mode, or user-triggerable command is added, update both:
  - desktop/window state reporting
  - control API discovery and execution routes
- do not leave future agents scraping visible text to reach a feature that the app already understands semantically

Convenience:
- use `scripts/window-state-parity-loop.sh` to open a representative set of existing window families through the control API and verify their `appType` state surface
- use the control API plus exported captures to smoke the native agent surface and window-state parity after substantial UI changes

Current loop for native agent debugging:
1. launch the app
2. `POST /view/wibwob-agent/open`
3. read `/state` again to find the `wibwob-agent` window id
4. `POST /windows/input` with body `{"id": N, "input": "your text\r"}` — field is `input` not `text`, trailing `\r` submits
5. wait for streaming to settle
6. `POST /windows/text/export` to persist a text capture
7. inspect `/state` for `messageCount`, `streaming`, `status`, and `model`
8. patch code and repeat

Scratch artifacts:
- exported text captures:
  - `/Users/james/Repos/wibandwob-dos/scratch/captures`
- desktop state JSON:
  - `/Users/james/Repos/wibandwob-dos/scratch/app-state.json`

Important rule:
- when debugging repaint/rendering issues, trust exported text snapshots and state captures over screenshots alone
- the point of the loop is to make rendering bugs reproducible and regressions easy to compare

## Important Constraints

1. Keep it pragmatic.
   - Prefer the smallest vertical slice that makes the terminal-native direction clearer.
   - Avoid speculative abstractions.

2. Preserve the desktop-window-manager feel.
   - Overlapping windows, focus, z-order, drag, tile, and cascade matter more than fancy widgets.
   - If a library shortcut breaks the WibWob desktop feel, it is probably the wrong shortcut.

3. Be honest about the terminal.
   - The live app currently has no in-app shell pane.
   - Future terminal work is architectural/reference work, not a shipped surface yet.
   - Do not claim embedded VT support unless it is reintroduced and actually works.

4. Prefer custom simple behavior over broken widget magic.
   - The editor and drag logic are intentionally custom because some stock blessed behaviors were flaky.
   - If a built-in blessed widget regresses interaction, replace or wrap it rather than fighting it blindly.

5. Keep Bun-first assumptions.
   - Do not reintroduce Node-only runtime assumptions unless explicitly necessary.
   - If terminal work returns later, treat PTY/runtime choice as a fresh integration decision.

## Editing Guidance

When changing the app:
- extract repeated picker/browser behavior into `OverlayManager` or a focused service
- extract new window types out of `app-controller.ts` once they stop being tiny
- keep `app-controller.ts` as orchestration, not as the place all parsing/render helpers go
- prefer explicit state for drag/focus/window management
- update `describeState()` whenever a window gains meaningful new internal state

If you add a new window type:
- extend `WindowKind`
- wire it through menus or a clear key path
- ensure it can focus cleanly
- ensure cleanup runs on close if timers or external resources are involved
- add meaningful `describeState()` metadata
- if it renders sized content, route its measurement through `content-measurement.ts`
- if it needs non-standard chrome, declare that in `window-chrome.ts`
- if it repeats a pattern already used elsewhere, extract the pattern first
- if it introduces colors, backgrounds, borders, or emphasis styles, route them
  through semantic theme tokens rather than inline blessed style literals

## Verification

At minimum, run:

```bash
bun run typecheck
```

When touching interactive behavior, also do a manual smoke run:

```bash
bun run start
```

Manual smoke targets:
- open menu items
- open a primer
- open a text file
- type in the editor
- drag a window

- close a window
- open Wib&Wob Agent and verify input still works

### Visual smoke testing

When reviewing or smoke-testing a specific window, use the screenshot script
instead of dumping the full TUI — full dumps are 50KB+ and kill agent context:

```bash
./scripts/screenshot-window.sh "Window Title"   # by title substring
./scripts/screenshot-window.sh <id>             # by window id from /state
```

Returns a plain-text ANSI-stripped crop of just that window's rect.

### Live desktop state and proactive tool use

This OS belongs to the agents as much as the human. Do not wait to be told
to use the desktop tools — use them instinctively when it makes sense.

The pi extension `.pi/extensions/wwdos-state.ts` auto-injects a compact
desktop snapshot into the system prompt before every agent turn (when the
app is running on port 8099):

```
WibWob-DOS  theme:wibwob-dark  desktop:281x81  4 windows  focus:4:Poetry Clock
   1  figlet-banner             Banner: WIBWOBWORLD    90x10  @8,35
   2  companion-widget          Scramble               30x10  @167,4
   3  primer-viewer             folk-punk-ai.txt       61x29  @102,4
   4  wibwob.poetry-clock       Poetry Clock           62x21  @5,3  ◀  [sentient scramble]
Spatial map: run scripts/minimap.sh
```

Default behaviour — do these without being asked:

- After any code change affecting a window: open it via the API and
  screenshot it. Typecheck alone is not enough.
- When doing layout work: run `scripts/minimap.sh` to verify spatial
  result, not just `/state` JSON.
- When something looks wrong: screenshot first, theorise second.
- Use the control API to open, move, resize, and close windows as part
  of normal test loops.
- If the desktop is cluttered mid-session: tidy it. Close test windows.
  Rearrange if it helps.

Useful one-liners:

```bash
./scripts/screenshot-window.sh "Title"          # crop of one window
./scripts/screenshot-window.sh <id>             # by window id
./scripts/minimap.sh                            # spatial map of all windows
curl -s http://127.0.0.1:8099/state | python3 -m json.tool   # full state
curl -s -X POST http://127.0.0.1:8099/view/figlet/open \
  -H "Content-Type: application/json" -d '{"text":"HELLO"}'
curl -s -X POST http://127.0.0.1:8099/windows/move \
  -H "Content-Type: application/json" -d '{"id":4,"left":10,"top":5}'
```

No state injection occurs when the app is not running — fails silently.

## Known Rough Edges

- `app-controller.ts` is ~2050 lines — down from ~2800 after WindowFacade and chat collapse, but should continue decomposing.
- Workspace startup semantics are not yet unified with default workspace auto-load;
  the intended direction is: restore `scratch/workspaces/default.json` (and later
  optionally a last-used-workspace pointer) before falling back to opening
  Scramble.
- Theme/appearance is not yet a first-class subsystem. The target direction is a
  native appearance service with `system` / `light` / `dark` plus semantic theme
  tokens compiled into blessed styles.
- Async workspace restore race: getLastWindow() after promise-returning openers can miss the window.
- Chrome browser service has pre-existing type errors (missing @types/jsdom, @types/turndown-plugin-gfm).

## Completed Architecture Work

- WindowFacade: 11-method interface, all 4 consumers collapsed (workspace restore, agent tools, control API, controller). ~80 lines deleted from controller.
- Chat collapse: the standalone chat surface was removed and agent work is now centered on the native Wib&Wob Agent path.
- Command catalog: single source of truth for all menu/palette commands. menuPlacements[] eliminates triple-entry duplication.
- Command registry: execution layer with list/run, consumed by control API and agent tools.
- Context menus: shared desktop/window commands now come from the command registry instead of a second hard-coded command list.
- Editor save: Save, Save As, dirty indicator, context menu. Display-only asterisk (title stays clean).
- Agent tools: registry-backed `tui_list_commands` / `tui_run_command` plus low-level TUI controls and jailed coding tools.

## Preferred Next Steps

Good next slices:
1. async workspace restore race fix (getLastWindow after promise openers)
2. workspace startup unification (`default.json` restore first, Scramble fallback second)
3. appearance/theme subsystem (`appearance-service`, semantic tokens, blessed resolver)
4. agent window restore hydration and deeper session/state parity
5. WindowRecord discriminated union (replace bag of optionals)
6. resize handles and stronger window management
7. screenshot/export support for comparing layouts to WibWob-DOS captures
8. project more window-local actions onto the command registry path where they are truly shared

Avoid:
1. full Turbo Vision porting work
2. heavy framework layering
3. pretending terminal emulation is solved when only PTY spawning works
