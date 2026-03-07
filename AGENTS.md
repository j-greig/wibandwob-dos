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

## App Lifecycle

**Start** (first time or after `bun install`):
```bash
bun install && bun run typecheck && bun run dev:world
```

**Restart without human involvement** — preferred for agents:
```bash
bash scripts/restart.sh
```
SIGTERM → waits for clean exit → `tmux send-keys` → polls `/health` until ready.
Returns the new session ID. Requires tmux session `wibwob` with the app in window 0.

**Wait for API before acting:**
```bash
curl -s http://127.0.0.1:8099/health   # returns {"ok":true,"sessionId":"abc"}
```
Do not guess window ids or command availability before `/health` responds.

**Stop — always SIGTERM, never `kill -9`.** Blessed must run cleanup or mouse
tracking escape codes leak into the terminal.
```bash
kill $(cat scratch/wibwob.pid)   # preferred — uses PID file written on startup
pkill wibwob-dos                 # by process title (includes session ID: wibwob-dos-main-jp9)
```

**Last resort only** (will poison terminal):
```bash
kill -9 $(lsof -ti:8099)
```
Terminal reset after a poisoned kill:
```
printf '\033[?1000l\033[?1002l\033[?1003l\033[?1006l\033[?25h\033[0m\033[?1049l' && reset
```

**Alt instance** (port 8098, label=zuk):
```bash
bash scripts/start-alt-instance.sh
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

## Planning Updates

After completing any story, feature, or epic — update `.planning` immediately. Do not leave docs stale.

```bash
bun run planning:status   # see current epic state
bun run planning:sync     # regenerate EPIC_STATUS.md from frontmatter
```

Rule: one logical change = one planning update commit. Use the `planning-update` skill for exact patterns.

Checkbox states: `[ ]` not-started · `[~]` in-progress · `[x]` done · `[-]` dropped
Epic status values: `not-started` · `in-progress` · `blocked` · `done` · `dropped`

Closeout ceremony (run after final PR merges):
1. Verify all ACs against running app
2. Tick all checkboxes `[x]`
3. Set `status: done` in frontmatter
4. `bun run planning:sync`
5. Commit: `docs(planning): close E0NN <title>`

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

1. **E022 WibWobWorld restore & layout fidelity** — `.planning/epics/e022-wibwobworld-restore-layout-fidelity/e022-brief.md`
   Six root causes, implementation order S01→S06. Start with S01 (breadcrumbs) then S02 (renderMode restore — highest daily pain).
2. workspace startup unification (`default.json` → Scramble fallback)
3. appearance/theme subsystem with semantic tokens — `.planning/epics/e014-theme-system/`
4. stronger `WindowRecord` discriminated union

## Parking Lot

Deferred work not yet epic-tracked. Promote when conditions change.

- **Unicode/cell-aware text rendering** — replace fragile string repaint for complex Unicode with shared text-to-cells path. Deferred; emoji-specific glitches only. Spec: `.planning/refactor-docs/021-unicode-cell-rendering-follow-on.md`
- **Terminal subsystem** — `pty-session.ts`, `terminal-buffer.ts`, `terminal-renderer.ts`. Only after shell/paint are stable. Spec: `e002 legacy-docs/007-terminal-emulator.md`
- **Event/persistence/multi-instance model** — re-spec TS-native event/persistence layer. Spec: `e002 legacy-docs/013-events-persistence-and-multi-instance.md`
