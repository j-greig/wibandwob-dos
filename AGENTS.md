# AGENTS.md

WibWob-DOS is a terminal-native TypeScript desktop shell.
Runtime: Bun. Renderer: blessed. Entry: `src/app.ts`.
Concept: proactive, autonomous AI/agent has equal control of OS with a human.

**Discovery:** `bash scripts/discover.sh` — scripts, skills, and docs organized by lens.

---

## Building a Microapp

Most agents arrive here to build a microapp addon. Start here.

1. `bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>`
2. Read `docs/building-custom-microapps.md` — lifecycle, SDK, common mistakes
3. Edit the scaffold, `bun run typecheck`, restart app

Quick start: `.agents/microapp-dev/quick-start.md`
Full docs: `.agents/microapp-dev/` (7 docs)
**You do not need `.agents/shell-dev/` to build a microapp.**

---

## Shell Development

For contributors working on shell internals: window manager, command registry,
state service, control API, theme engine.

@.agents/shell-dev/architecture.md
@.agents/shell-dev/invariants.md
@.agents/shell-dev/control-api.md

Subsystem specs: `.agents/shell-dev/specs/` — read before touching `src/` files listed in each.

## COAT — Command Once, Adapt Thin

The runtime is a **shared semantic core** with four explicit seams:

- **command** — one catalog, one dispatch path, one discovery surface
- **inspection** — one snapshot shape, one access path
- **window** — one facade, one lifecycle
- **workspace** — one save/restore path

TUI, CLI, API, agent, and microapps are **thin adapters** over these seams.
No adapter owns semantics. No adapter invents its own command/control path.

**The COAT test:** "Would this work if I deleted the TUI and only had the API?"
If no — the semantics are in the wrong place.

**Say "COAT" to invoke this principle.**

## Six Lenses

Agents aren't departments — they're lenses. Same tools, same API, different focus.

| # | Lens | Focus |
|---|------|-------|
| 0 | **shell-architect** | Host runtime, TypeScript, COAT integrity |
| 1 | **microapp-builder** | Build & migrate microapps |
| 2 | **ops** | Process lifecycle, health, screenshots |
| 3 | **quality** | Tests, parity, verification |
| 4 | **creative** | Visual composition, art, music |
| 5 | **planner** | Planning docs, epics, what's next |

Full lens model + script mapping: `.agents/agent-master-plan.md`

## Key Files

- `src/core/app-controller.ts` — composition root
- `src/core/command-catalog.ts` — command source of truth
- `src/core/command-registry.ts` — execution + dispatch
- `src/core/window-facade.ts` — 11-method window interface
- `src/core/window-chrome.ts` — chrome sizing math
- `src/core/microapp-registry.ts` — tier classification
- `src/services/control-api.ts` — HTTP surface (port 8099)
- `src/services/state-service.ts` — live desktop state
- `src/services/microapp-loader.ts` — microapp discovery + host creation
- `src/services/microapp-sdk.ts` — SDK export surface

Full index: `.agents/shell-dev/architecture.md`

## Quick Commands

```bash
bun run typecheck                      # minimum gate before any commit
bun run check-coat                     # COAT enforcement (6 checks)
bash scripts/ensure-running.sh         # idempotent start (--direct default)
bash scripts/restart.sh                # stop → relaunch → verify
bash scripts/reload-microapp.sh <id>   # close → reload code → reopen
bash scripts/discover.sh               # full discovery index
bash scripts/list-scripts.sh           # all scripts with descriptions
./scripts/minimap.sh                   # spatial map of desktop
./scripts/screenshot-window.sh "Title" # text crop of one window
```

**CLI:** `wibwob` is the single command surface. No `ww-*` aliases, no raw `curl`.

```bash
wibwob health                          # instance identity
wibwob state                           # full desktop state JSON
wibwob map                             # spatial desktop HUD
wibwob commands -q                     # list all command IDs
wibwob cmd <id> [--key val]            # run any command
wibwob read <id>                       # text out of a window
wibwob write <id>                      # pipe text into a window (stdin)
wibwob plumb --from <id> --to <id>     # route text between windows
wibwob start                           # idempotent launch
wibwob restart                         # clean restart
wibwob instances                       # list running instances
wibwob attach                          # resurrect from orphan workspace
```

**Plumb** reads text from source (`captureText`), writes to dest via fallback
chain: `<appType>.write` → `.send` → `.create`. Works across microapps and
host windows. No new endpoints — just `/screenshot/text` + `/commands/run`.

**API:** `http://127.0.0.1:8099` — `GET /health`, `GET /state`, `POST /commands/run`.
Always `GET /state` first — use real window ids, never guessed ones.

## App Lifecycle

### Process modes: --direct (default) vs --tmux

OPS scripts support two modes via `scripts/lib/process-manager.sh`:

| Mode | Flag | How it works |
|------|------|-------------|
| **direct** (default) | `--direct` or omit | PTY via `script`, background process, log at `scratch/wibwob.log` |
| **tmux** | `--tmux` | Named tmux session, `send-keys` launch (legacy) |

All modes use the same HTTP API for health checks, state queries, and command dispatch.
Set `export WW_MODE="tmux"` in `~/.wibwob` to default to tmux mode.

Shell aliases (from `~/.wibwob`):
```bash
ww-start                    # ensure-running (direct)
ww-restart                  # restart (direct)
ww-attach                   # status + tail log (direct) or tmux attach (--tmux)
ww-alt                      # second instance on port 8098
```

| Script | What |
|--------|------|
| `bun run start` | Launch (no dev mode) |
| `bun run dev` | Dev mode (Ctrl+R reload) |
| `bun run dev:world` | Dev + IRC + label `main` |
| `bun run dev:world:alt` | Second instance (port 8098, label `zuk`) |

**Start fresh:** `bun install && bun run typecheck && bun run dev:world`
**Restart:** `bash scripts/restart.sh` (SIGTERM → relaunch → poll `/health`)
**Stop:** `kill $(cat scratch/wibwob.pid)` — always SIGTERM, never `kill -9`.

### Reload vs restart

| Changed | Action |
|---------|--------|
| `microapps/*/` | `bash scripts/reload-microapp.sh <id>` |
| `src/`, themes, package.json | `bash scripts/restart.sh` |

## Canon

One concept, one owner. One measurement path. One sizing path. One state path.

- extend the existing owner instead of creating a parallel helper
- services own logic; windows own rendering, input wiring, focus, cleanup
- every meaningful window exposes `describeState()`
- user-visible features must also be API-visible
- add commands in `command-catalog.ts` first — never hand-wire separately

Full invariants: `.agents/shell-dev/invariants.md`

## Verification

```bash
bun run typecheck        # minimum bar
bun run check-themes     # after theme changes
bun run check-coat       # after migrations
```

**Visual verification is mandatory.** API responses are NOT sufficient proof.
The human must see the running TUI. Ensure tmux session exists, tell human to attach.

## Agent Tooling

**Discovery:** `bash scripts/discover.sh` — organized by lens.
**Devlog:** `.agents/shell-dev/devlogs/W{nn}.md` — weekly, new file each Monday.
**Standing notes:** `.agents/shell-dev/devlogs/standing.md` — rolling, prune when items land.

When agent tooling causes friction — improve it, don't work around it.

## Planning

| Tier | System | Lifetime |
|------|--------|---------|
| Capture | GitHub issues | One session: promote or close |
| Ephemeral | `.pi/todos` | Two sessions max: promote or close |
| Truth | `.planning/` briefs | Permanent until done/dropped |

Branch naming: `epic/e0NN-slug`, `spike/spk-slug`, `fix/slug`, `feat/slug`.
Never commit directly to `main`. Run `git status` first.

Checkbox: `[ ]` not-started · `[~]` in-progress · `[x]` done · `[-]` dropped

## Constraints

- pragmatic — smallest slice that proves the direction
- preserve the overlapping window-manager desktop feel
- simple custom behavior over broken blessed widget magic
- Bun-first; no Node-only runtime assumptions

## Operating Posture

You are self-directing, self-enhancing, self-improving, self-debugging.

When something doesn't work: diagnose, fix, verify, commit.
When documentation is wrong: update it in the same commit.
When a pattern causes repeated confusion: codify in `.agents/`.
Do not wait to be told. Do not stop at "it typechecks" — run the thing.

## Parking Lot

- **BPM-synced animation** — primer frame rate synced to beats. Deferred pending vj-timeline stability.
- **ASCII music video** — WibWob-DOS as visual substrate. Deferred pending timeline spec.
- **Ambient-presence v3** — composer-grade chiptune. Long-arc creative process.
- **/microapps/list endpoint** — module inspection for operators. Future work.
- **Unicode/cell-aware rendering** — replace fragile string repaint. Emoji-only.
- **Terminal subsystem (production)** — swap term.js for @xterm/headless.
- **Event/persistence/multi-instance** — re-spec TS-native layer.
