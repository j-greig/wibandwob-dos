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

Full invariants and anti-patterns: `.agents/invariants.md`

## Key Files

Quick index — full descriptions live in `.agents/architecture.md`.

- `src/core/app-controller.ts` — composition root
- `src/core/command-catalog.ts` — command source of truth
- `src/core/command-registry.ts` — execution + list/run layer
- `src/core/window-facade.ts` — 11-method window interface
- `src/core/window-chrome.ts` — chrome sizing math
- `src/core/overlay-manager.ts` — shared prompts and pickers
- `src/services/control-api.ts` — HTTP control surface (port 8099)
- `src/services/state-service.ts` — live desktop state
- `src/services/content-measurement.ts` — content measurement
- `src/services/wibwob-agent-session.ts` — pi agent session

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

## Stopping the App

**Always use SIGTERM — never `kill -9`.** Blessed must clean up mouse tracking and
alternate screen or the terminal fills with garbage escape sequences.

```bash
# Clean stop — preferred
kill $(cat scratch/wibwob.pid)

# By process title — includes session ID shown in TUI top-right
# e.g. if TUI shows "jp9", process is named "wibwob-dos-main-jp9"
pkill wibwob-dos-jp9   # kill exact session
pkill wibwob-dos       # kill any wibwob instance

# Last resort only — will leak escape codes to terminal
kill -9 $(lsof -ti:8099)
```

If the terminal does get poisoned after a hard kill, run in the affected pane:
```
printf '\033[?1000l\033[?1002l\033[?1003l\033[?1006l\033[?25h\033[0m\033[?1049l' && reset
```

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

Never stop at typecheck alone. Default proactive behaviour after code changes: `.agents/control-api.md § Proactive Tool Use`.

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

## Operating Posture

You are self-directing, self-enhancing, self-improving, self-debugging.

When something doesn't work: diagnose it, fix it, verify the fix, commit it.
When documentation is wrong or missing: update it in the same commit.
When a pattern causes repeated confusion: codify the correct pattern in `.agents/`.
When a task is done: verify it is actually done — typecheck, smoke, screenshot, API check.

Do not wait to be told to do the obvious next thing.
Do not leave a trail of micro-commits — one logical change, one commit.
Do not stop at "it typechecks" — run the thing.

## Preferred Next Steps

1. async workspace restore race fix
2. workspace startup unification (`default.json` → Scramble fallback)
3. appearance/theme subsystem with semantic tokens
4. stronger `WindowRecord` discriminated union
5. deeper agent/session restore parity
6. project more window-local actions onto the command registry path
