# AGENTS.md

WibWob-DOS is a terminal-native TypeScript desktop shell.
Runtime: Bun. Renderer: blessed. Entry: `src/app.ts`.
Concept: proactive, autonomous AI/agent has equal control of OS with a human.

@.agents/architecture.md
@.agents/invariants.md
@.agents/control-api.md
@.agents/microapp-sdk.md

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

## Building a New Module

1. `bash scripts/scaffold-microapp.sh modules/<name> wibwob.<id> "<Title>" <menuOrder>`
2. Read `docs/building-custom-modules.md` — lifecycle, SDK, common mistakes
3. Edit the scaffold, `bun run typecheck`, restart app
4. Reference modules: `glitchbox` (animated), `e026-demo` (broad sampler), `wibwob-poetry-clock` (compact real app)
5. SDK surface: `.agents/microapp-sdk.md`

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

## When to reload vs restart

| Changed | Action |
|---------|--------|
| `modules/*/index.ts` or `module.json` | Reload: `POST /commands/run` with `modules.reload` |
| `.pi/skills/*`, `scratch/*`, docs | No action needed — read at use time |
| `src/core/*`, `src/services/*` | RESTART required (`bash scripts/restart.sh`) |
| `src/windows/*` | RESTART required |
| Theme files | RESTART required (theme loaded at startup) |
| `package.json`, `tsconfig.json` | RESTART required |

Rule of thumb: if it lives in `modules/`, reload. If it lives in `src/`, restart.

## Subsystem Specs

Four subsystem specs live in `.agents/specs/`. Read the relevant one before
touching the files listed. Agents may edit specs directly — append findings,
correct errors, update failure modes. They are living documents.

### Pre-change triggers — read spec BEFORE touching these files

| Files | Read spec |
|-------|-----------|
| `src/core/window-manager.ts`, `src/core/window-facade.ts`, `src/core/window-chrome.ts`, `src/core/types.ts` (WindowRecord/WindowKind), any `modules/*/index.ts` | `.agents/specs/window-system.md` |
| `src/services/state-service.ts`, `src/services/control-api.ts`, `src/services/agent-tools.ts` | `.agents/specs/state-and-api.md` |
| `src/services/workspace-service.ts`, workspace restore in `src/core/app-controller.ts` | `.agents/specs/workspace.md` |
| `src/services/wibwob-agent-session.ts`, `src/services/scramble-brain.ts`, `src/windows/wibwob-agent-window.ts`, `src/windows/scramble-window.ts`, any `modules/*/` | `.agents/specs/agent-session.md` |

### Post-change triggers — verify after touching these files

| Files changed | Verify |
|---------------|--------|
| Window system | `bun run typecheck` · GET /state shows correct windows · close() removes from stack |
| State / API | GET /state field names match · /health responds · tui_get_state returns real IDs |
| Workspace | Save → restart → windows restore at correct positions with correct content |
| Agent session / modules | Module loads without stderr errors · command appears in menu · no double-input |

### Self-edit rule

When you discover a failure mode, correction, or pattern not in a spec:
edit it in. Use the `## Agent Notes` table for quick session findings,
or edit the spec body directly if the finding is clearly correct.

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

### Visual verification is mandatory

API responses and `/state` JSON are NOT sufficient proof that a feature works.
The human must be able to see the running TUI. Every test or demo workflow must:

1. **Ensure the app is running in tmux** — if not, start it:
   ```bash
   tmux new-session -d -s wibwob -x 230 -y 62 'bun run start'
   ```
2. **Tell the human to attach** — after making visual changes, say:
   ```
   tmux attach -t wibwob
   ```
3. **Never skip this step.** API-only testing misses rendering bugs, layout
   issues, visual regressions, and chrome problems that only show on screen.

If the human is already attached (they told you so, or you're in an interactive
session), skip the prompt. But when in doubt: remind them to look.

## Agent Tooling

Scripts and skills that exist to help agents work are **agent tooling**. When agent tooling causes friction, degrades, or fails — improve it, don't work around it. Delegate improvement to Codex when the fix is self-contained.

### Canon names for self-testing work

| Name | What it means |
|------|--------------|
| **typecheck** | `bun run typecheck` — minimum gate before any commit |
| **smoke** | Manual or scripted run through key surfaces (menus, windows, API) |
| **restart** | `bash scripts/restart.sh` — clean SIGTERM → wait → launch → poll `/health` |
| **API parity** | `/state` response matches what is visually on screen |
| **screenshot** | `./scripts/screenshot-window.sh "Title"` — capture a window |
| **minimap** | `./scripts/minimap.sh` — spatial overview of all open windows |
| **overlap-check** | `./scripts/overlap-check.sh` — detect overlapping windows |
| **handover** | `bun run handover` — generate session handover doc from live state |
| **planning-sync** | `bun run planning:sync` — regenerate EPIC_STATUS.md from frontmatter |

### Codex delegation pattern for tooling improvement

When a script or skill is causing repeated friction, has a known failure mode, or needs a new capability — delegate improvement to Codex rather than patching around it:

```
Use the codex-worker subagent.
Task: describe what the script does, what the failure mode is, what the fix should be.
Files: point at the script(s) to improve.
```

Good candidates for Codex tooling improvement:
- `scripts/restart.sh` — if it reports ready with the same session ID (old process still alive)
- `scripts/smoke-test.sh` — if smoke targets grow stale
- `.pi/skills/*` — if a skill's instructions cause agents to make repeated mistakes
- `scripts/handover.sh` — if the epic table or todo list goes stale

Example: Codex improved `restart.sh` to capture old sessionId, confirm new sessionId differs, kill more aggressively (SIGKILL fallback), and reset terminal escape codes before launching — after the plain SIGTERM pattern left the terminal poisoned on unclean exits.

### Three-tier planning model

| Tier | System | Role | Lifetime |
|------|--------|------|---------|
| Capture | GitHub issues | Scatterbrain inbox — low-friction quick capture | One session: promote or close |
| Ephemeral | `.pi/todos` | Session whiteboard — subtasks, mid-session tracking | Two sessions max: promote or close |
| Truth | `.planning/` briefs | Everything that lasts — committed, versioned, canonical | Permanent until done/dropped |

**GitHub issues as inbox:** any GH issue that is not an epic tracker must graduate within one
session. Add it to a planning brief, add to `AGENTS.md` Parking Lot, or close it. Never leave a
non-epic GH issue open across sessions — it becomes invisible drift.

**Pi todos as whiteboard:** session-scoped only. Never use them to track work spanning more than
one session. If a todo is still open after two sessions, promote or close it.

**`.planning/` is the only source of truth.** When in doubt, write it in a brief.

Full rules: `.planning/README.md` § GitHub Mapping

### Self-improvement rule

When a pattern causes repeated confusion or failure in agent work: codify the fix in `.agents/` or the relevant skill, not just in the code. The agent constitution should reflect what actually works.

After completing any story, feature, or epic — update `.planning` immediately. Do not leave docs stale.

```bash
git status               # confirm you are not on main before starting work
bun run planning:status   # see current epic state
bun run planning:sync     # regenerate EPIC_STATUS.md from frontmatter
```

Always work on a branch tied to the current `.planning` focus. Branch naming:
`epic/e0NN-slug`, `spike/spk-slug`, `fix/slug`, `feat/slug`, `chore/slug`,
`docs/slug`.
Before starting any work: run `git status` to confirm you are not on `main`.
If you are on `main`, create the correct branch first.
Never commit directly to `main`. `main` is updated via merge only.

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
Use suitable agents in parallel or serial when possible to speed up tasks.

When something doesn't work: diagnose it, fix it, verify the fix, commit it.
When documentation is wrong or missing: update it in the same commit.
When a pattern causes repeated confusion: codify the correct pattern in `.agents/`.
When a task is done: verify it is actually done — typecheck, smoke, screenshot, API check.

Do not wait to be told to do the obvious next thing.
Do not leave a trail of micro-commits — one logical change, one commit.
Do not stop at "it typechecks" — run the thing.

## Parking Lot

Deferred work not yet epic-tracked. Promote when conditions change.

- **BPM-synced animation speed for primer frame rate** — Animated primers (multi-frame with --- separators) should sync to BPM. Concept: A 4-frame animation at 128 BPM in 4/4 = one frame per beat (~469ms). Timeline format could specify `frameSync: "beat" | "half" | "eighth" | "bar" | <ms>`. Requires either a control API endpoint or programmatic frame duplication at timeline write time. Deferred pending vj-timeline stability.
- **ASCII music video: grime remix, Gondry/Shrigley/Cunningham directed** — Use WibWob-DOS itself as visual substrate: windows as panels, primers as actors, figlets as titles. Timed workspace JSON with per-window enter/exit timecodes + effects. Architecture: define spec, build renderer, choreograph full 45s video, render at 1080x1920 15fps. Music track (grime-v2) needs more Björk/hyperpop extremeness per human feedback. Deferred pending timeline spec refinement.
- **Ambient-presence v3: composer-grade chiptune with Eno/Frahm influence** — v2 has right concept but primitive execution. Needs research (Eno, Frahm), score document (intervals, voicing, arc), compositional discipline (harmonic movement, rhythmic evolution, register interplay, dynamic arc, silence). Then implement v3 with chiptune-bricks, then unexpected remix in different genre. Custom system prompt updated with methodology; future sessions auto-carry discipline. This is a long-arc creative process, not a sprint task.
- **Module inspection endpoint: /modules/list** — No module inspection exists. GET /state has no module info, module-loader.ts has no listModules(). Needed for hosted operators to know what microapps are loaded, version, status. Shape: `GET /modules → [{name, version, appType, loaded, commands[]}]`. Codex's lane; deferred as non-MVP future work.
- **Unicode/cell-aware text rendering** — replace fragile string repaint for complex Unicode with shared text-to-cells path. Deferred; emoji-specific glitches only. Spec: `.planning/refactor-docs/021-unicode-cell-rendering-follow-on.md`
- **Terminal subsystem (production quality)** — spike-quality terminal module exists at `modules/terminal/` (blessed.terminal + Node PTY bridge). Production path: swap term.js for `@xterm/headless` per spike plan `.planning/spikes/spk-terminal-emulation/spike.md`. Known issues: mouse passthrough patched (0-based→1-based), keyboard to nested TUI apps works but fragile.
- **Event/persistence/multi-instance model** — re-spec TS-native event/persistence layer. Spec: `e002 legacy-docs/013-events-persistence-and-multi-instance.md`
