# AGENTS.md

WibWob-DOS is a terminal-native TypeScript desktop shell.
Runtime: Bun. Renderer: blessed. Entry: `src/app.ts`.
Concept: proactive, autonomous AI/agent has equal control of OS with a human.

@.agents/architecture.md
@.agents/invariants.md
@.agents/control-api.md

## Direction

- stay terminal-native, blessed-first
- overlapping desktop-style windows, focus, drag, z-order, tile
- keep scope small and honest

Non-goals:
- do not pretend terminal emulation is solved when it is not
- do not pivot toward webview or browser UI unless explicitly asked
- do not add speculative abstractions before the simpler thing is proven insufficient

## Canon

One concept, one owner. One measurement path. One sizing path. One state path.
One layout path. One agent/runtime integration path per feature.
One control/API path for every user-visible surface.

- extend the existing owner instead of creating a parallel helper
- content measurement is content-only; chrome math belongs in `window-chrome.ts`
- every meaningful window exposes semantic metadata through `describeState()`
- user-visible features must also be API-visible
- services own logic; windows own rendering, input wiring, focus, cleanup
- prefer established modular Blessed patterns over bespoke widget tangles

## Key Files

- `src/core/app-controller.ts` — composition root; window opening, command flow, menus, restore
- `src/core/command-catalog.ts` — single source of truth for all user-visible commands
- `src/core/command-registry.ts` — execution and projection layer; consumed by menus, palette, API, agent
- `src/core/window-facade.ts` — 11-method interface; single seam for workspace restore, agent tools, control API
- `src/core/window-chrome.ts` — all chrome/border/shadow sizing math lives here
- `src/core/overlay-manager.ts` — shared prompts, flash messages, file browser, picker flows
- `src/services/control-api.ts` — local HTTP control surface on port 8099
- `src/services/state-service.ts` — canonical live desktop and window state
- `src/services/content-measurement.ts` — shared measurement for primers, text, and future content types
- `src/services/wibwob-agent-session.ts` — embedded pi-based native agent session

Full service inventory: `.agents/architecture.md`

## Command Rules

- add commands in `src/core/command-catalog.ts` first — never hand-wire menu/palette/API separately
- `actionKey` must resolve to an `AppMenuActions` entry in `app-controller.ts`
- use spaced `order` values (`0, 10, 20`) so insertions never require renumbering
- prefer registry commands in agent workflows; low-level tools only for precise manipulation
- `Document Reader` = local file/markdown reader · `Chrome Browser` = web extraction surface

## Agent Model

The `Wib&Wob Agent` is a pi agent embedded in the Blessed TUI — a native surface, not a terminal toy.

Tools available to it:
- registry-aware: `tui_list_commands`, `tui_run_command`
- jailed coding: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` (scoped to `REPO_ROOT`)

Rule: registry command first → low-level TUI tool if insufficient → expose via state and control API if it matters to users.

## Startup

```bash
bun install && bun run typecheck && bun run start
```

Wait for the API before acting:

```bash
curl -s http://127.0.0.1:8099/health
```

Do not guess window ids or command availability before `/health` responds.

## Control Loop

API on `http://127.0.0.1:8099`. Full reference: `.agents/control-api.md`.

Always `GET /state` first — use real window ids, never guessed ones.
Use `GET /commands/list` before `POST /commands/run` if ids are uncertain.
Prefer `POST /windows/batch` over chained individual move/resize calls.

Authoritative discovery: `GET /help` · `GET /openapi.json`

## Verification

```bash
bun run typecheck        # minimum bar
bun run check-themes     # after any theme change
```

After any code change affecting a window: open it via the API, read `/state`, screenshot or export. Never stop at typecheck alone.

Smoke targets: menus, primer open, text file open, editor typing, window drag/close, Wib&Wob Agent input + slash commands, agent-spawned windows controllable via API, `/state` parity with screen.

```bash
./scripts/screenshot-window.sh "Title"
./scripts/minimap.sh
```

## Constraints

- pragmatic — smallest slice that proves the direction
- preserve the overlapping window-manager desktop feel
- simple custom behavior over broken blessed widget magic
- Bun-first; no Node-only runtime assumptions

## Preferred Next Steps

1. async workspace restore race fix
2. workspace startup unification (`default.json` → Scramble fallback)
3. appearance/theme subsystem with semantic tokens
4. stronger `WindowRecord` discriminated union
5. deeper agent/session restore parity
6. project more window-local actions onto the command registry path
