# AGENTS.md

This file is local guidance for agents working in `/Users/james/Repos/wibandwob-dos`.

`CLAUDE.md` is a symlink to this file.

## Extended reference (imports)

This file imports three reference docs. When those files exist, Claude Code
loads them automatically via `@` imports. Other agents should read them on
demand. Create each file when ready to split — the signposts below mark what
moves where.

@.agents/architecture.md
<!-- WHAT GOES HERE:
  - Full service/file inventory with one-line purpose summaries
  - window-facade.ts: the 11-method interface and its 4 consumers
  - Editing guidance: checklist for adding a new window type
    (extend WindowKind, wire menus, focus, cleanup, describeState,
    content-measurement, window-chrome, theme tokens)
-->

@.agents/invariants.md
<!-- WHAT GOES HERE:
  - All 13 architecture invariants (currently inline below — move here)
  - Anti-patterns list (currently inline below — move here)
  - Pi Session Bridge topology and tooling
  - Code style rules (DRY, explicit state, no framework theater)
-->

@.agents/control-api.md
<!-- WHAT GOES HERE:
  - Full HTTP endpoint reference (GET/POST with body shapes)
  - All /view/* routes and /commands/run quick-reference ids
  - Specific command ids: plasma, contour, terrain, poetry-clock, desktop.clear-all
  - Native agent debug loop (8-step)
  - Proactive tool use rules and wwdos-state.ts injection note
  - Visual/layout smoke: screenshot-window.sh, minimap.sh
  - Scratch output paths
-->

## Purpose

WibWob-DOS is a terminal-native TypeScript desktop shell.

Current product direction:
- stay terminal-native
- use Bun as runtime and package manager
- use `blessed` for rendering
- prove overlapping desktop-style windows, menus, file viewers, editing, and small animated views
- keep scope small and honest

Non-goals:
- do not pretend this is already a full VT terminal emulator
- do not pivot toward webview or browser UI unless explicitly asked
- do not add speculative abstractions before the simpler thing is proven insufficient

## Canon

The design bar is:
- one concept, one owner
- one measurement path
- one sizing path
- one state path
- one layout path
- one agent/runtime integration path per feature
- one control/API path for every user-visible surface

Implementation rules:
- extend the existing owner for a concern instead of creating a parallel helper
- content measurement is content-only; chrome math belongs in `window-chrome.ts`
- geometry comes from `DesktopGeometryService`
- every meaningful window exposes semantic metadata through `describeState()`
- user-visible features must also be API-visible
- services own logic; windows own rendering, input wiring, focus, cleanup, and `describeState()`

## Architecture

Core files — see `@.agents/architecture.md` for the full service inventory.

- `src/app.ts` — runtime bootstrap only
- `src/core/app-controller.ts` — composition root; window opening, command flow, menus, restore, startup
- `src/core/command-catalog.ts` — source of truth for user-visible command definitions
- `src/core/command-registry.ts` — execution and projection layer over the catalog
- `src/core/window-facade.ts` — 11-method interface; single seam for workspace restore, agent tools, control API, and controller
- `src/core/window-manager.ts` — z-order, focus, drag, resize, tile, cascade, close
- `src/core/window-chrome.ts` — content-to-window sizing; chrome offsets live here, not inline
- `src/core/overlay-manager.ts` — shared prompts, flash, and open/select flows
- `src/services/state-service.ts` — canonical live desktop state
- `src/services/control-api.ts` — local HTTP control surface
- `src/services/content-measurement.ts` — shared measurement for primers, text, and future content types
- `src/services/wibwob-agent-session.ts` — embedded pi-based native agent session
- `src/windows/wibwob-agent-window.ts` — native Wib&Wob Agent window

## Architecture Invariants

These are strict. Treat violations as bugs. Full list in `@.agents/invariants.md`.

1. Single source of truth per concern — extend the existing owner, never create a parallel path.
2. Measurement is content-only — chrome math belongs in `window-chrome.ts`, not in callers.
3. Chrome is declarative — no inline `+2`, `+3`, `+6` formulas in window code.
4. Desktop geometry is canonical — width/height/cellAspect come from `DesktopGeometryService`.
5. Window state is self-describing — every window exposes semantic metadata through `describeState()`.
6. One reusable interaction component before many prompts — repeated flows belong in `OverlayManager`.
7. Layout is an engine — new placement logic moves toward shared primitives, not bespoke coordinate code.
8. User-visible commands defined once — derive menu and palette entries from `command-catalog.ts`.
9. Services own logic, windows own wiring — services discover/measure/persist; windows render/bind/clean up.
10. No duplicate fallbacks unless centrally owned — declare fallbacks in the owning service.
11. Experimental integrations stay behind one seam — wrap foreign runtimes in a single service boundary.
12. User-visible surfaces must be API-visible — typed desktop state and a control path in `control-api.ts`.
13. Reorg passes do not add product surface area — extract and normalise before adding new UI.

## Command Rules

- add new user-visible commands in `src/core/command-catalog.ts` first
- do not hand-wire duplicate menu/palette/API entries in multiple places
- use spaced `order` values like `0, 10, 20`
- `actionKey` must resolve to an `AppMenuActions` implementation in `app-controller.ts`
- prefer registry commands first in agent workflows
- use low-level window tools only when registry commands are insufficient
- preserve the naming split:
  - `Document Reader` = local file/markdown reader
  - `Chrome Browser` = real web browser/extraction surface

## Anti-Patterns

Do not introduce these:
- parallel measurement functions for different callers
- per-window copies of generic sizing logic
- state fields that duplicate the same fact under different names
- direct widget scraping when semantic state can be exposed
- vendor code referenced directly from many app files
- giant controller growth when a window family or service can be extracted cleanly
- "just this once" prompt flows that should be shared components
- hardcoded geometry magic numbers without named ownership

## Agent Model

The in-app `Wib&Wob Agent` is a customized pi agent running inside the Blessed TUI.

- it is a native app surface, not a sidecar terminal toy
- registry-aware TUI tools: `tui_list_commands`, `tui_run_command`
- jailed coding tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
- file/process access is scoped to `REPO_ROOT`

Practical rule: registry command first → low-level TUI tool if needed → expose semantically via state and control API if it matters to users.

## Pi Session Bridge

Three agent tools: `list_sessions`, `send_to_session`, `get_session_message`.
`sessionName` is sufficient to route — `--session-control` only needed on the sending side.
External pi sessions create sockets at `~/.pi/session-control/<id>.sock`.
The in-app bridge is currently a client only — does not appear in `list_sessions`.

## Startup

```bash
bun install
bun run typecheck
bun run start
```

After launch, wait until the control API responds before acting:

```bash
curl -s http://127.0.0.1:8099/health
curl -s http://127.0.0.1:8099/help
```

If those do not respond, do not guess window ids or command availability.

## Control Loop

API on `127.0.0.1:8099`. Full endpoint reference in `@.agents/control-api.md`.

Authoritative discovery: `GET /help` or `GET /openapi.json`.

Critical rules:
- always `GET /state` before acting on specific windows — use real ids, never guessed ones
- `GET /commands/list` before `POST /commands/run` if command ids are uncertain
- prefer `POST /windows/batch` over chained move/resize calls

Core reads: `GET /health` · `GET /help` · `GET /state` · `GET /commands/list`

Core writes:
- `POST /commands/run` — `{"id":"command-id","args":{}}`
- `POST /windows/batch` — `{"ops":[{"id":N,"x":X,"y":Y,"w":W,"h":H}]}`
- `POST /windows/input` — `{"id":N,"input":"text\r"}`

Common openers: `/view/wibwob-agent/open` · `/view/primer/open` · `/view/editor/open` · `/view/figlet/open` · `/view/art/open`

Windows without `/view` routes open via `POST /commands/run` — discover ids from `GET /commands/list`.

## Verification

Minimum:

```bash
bun run typecheck
```

After any code change affecting a window: open it via the API, read `/state`, capture a screenshot or text export. Do not stop at typecheck alone.

Manual smoke targets:
- open menu items, open a primer, open a text file, type in the editor, drag and close a window
- open Wib&Wob Agent and verify input, slash commands, and agent-spawned windows work
- verify spawned surfaces can be opened/focused/moved/resized/closed via the HTTP API
- verify `/state` and `describeState()` stay in parity with what a human sees on screen

Visual smoke:

```bash
./scripts/screenshot-window.sh "Window Title"
./scripts/minimap.sh
```

## Constraints

- keep it pragmatic — smallest vertical slice that proves the direction
- preserve the overlapping desktop/window-manager feel
- be honest about the terminal
- prefer simple custom behavior over broken widget magic
- keep Bun-first assumptions

## Preferred Next Steps

Good slices:
1. async workspace restore race fix
2. workspace startup unification
3. appearance/theme subsystem
4. deeper agent/session restore parity
5. stronger window record typing
6. stronger resize/window management
7. project more shared window-local actions onto the command registry path

Avoid:
1. heavy framework layering
2. pretending terminal emulation is solved when it is not
3. speculative abstractions before the simpler thing is proven not to work
