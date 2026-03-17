# AGENTS.md

WibWob-DOS is a terminal-native TypeScript desktop shell.
Runtime: Bun. Renderer: blessed. Entry: `src/app.ts`.
Concept: human and AI share equal control of a terminal desktop.

## Where to look

- **Building a microapp?** → next section, then `docs/building-custom-microapps.md`
- **Shell internals?** → `.agents/shell-dev/architecture.md`, `invariants.md`, `control-api.md`
- **Planning & commits?** → `.planning/CONVENTIONS.md`
- **Running the app?** → Quick Commands below, or `.pi/skills/ww-ops/SKILL.md`
- **Everything at once?** → `bash scripts/discover.sh`

---

## Building a Microapp

1. `bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>`
2. Read `docs/building-custom-microapps.md`
3. Edit the scaffold, `bun run typecheck`, restart app

Full docs: `.agents/microapp-dev/` (7 docs). You don't need `.agents/shell-dev/`.

## Shell Development

Window manager, command registry, state service, control API, theme engine.

- `.agents/shell-dev/architecture.md` — file index, subsystems
- `.agents/shell-dev/invariants.md` — rules, anti-patterns
- `.agents/shell-dev/control-api.md` — API reference
- `.agents/shell-dev/specs/` — subsystem specs (read before touching listed files)

## Principles

**COAT — Command Once, Adapt Thin.** The runtime is a shared semantic core
with four seams: command, inspection, window, workspace. TUI, CLI, API,
agent, and microapps are thin adapters. No adapter owns semantics.

**The COAT test:** "Would this work without the TUI, using only the API?"

**Canon:**
- One concept, one owner. Extend the owner, don't create parallel helpers.
- Services own logic; windows own rendering, input, focus, cleanup.
- Every meaningful window exposes `describeState()`.
- User-visible features must also be API-visible.
- Add commands in `command-catalog.ts` first — never hand-wire.

Full invariants: `.agents/shell-dev/invariants.md`
Philosophy: `PHILOSOPHY.md`

## Operating

**Start fresh:** `bun install && bun run typecheck && bun run dev:world`
**Restart:** `bash scripts/restart.sh`
**Stop:** `kill $(cat scratch/wibwob.pid)` — SIGTERM, never -9
**Reload microapp:** `bash scripts/reload-microapp.sh <id>`
**Reload shell code:** `bash scripts/restart.sh`

**CLI:** `wibwob` is the single command surface. `wibwob help` for full usage.
**API:** `http://127.0.0.1:8099` — always `GET /state` first, use real window IDs.

```bash
bun run health                         # full gate: tests + typecheck + COAT
bun run typecheck                      # type check only
bun run test                           # unit tests (always green)
bash scripts/discover.sh               # discovery index
bash scripts/list-scripts.sh           # all scripts
bash scripts/git-census.sh             # branch/worktree health
```

**Visual verification is mandatory.** API responses are not sufficient proof.

## Agent Resources

**Subagents** (`.pi/agents/`):
- **ops** — process lifecycle, health, debugging
- **arch-reviewer** — architecture, COAT compliance
- **code-reviewer** — code quality, type safety
- **haiku / sonnet / opus** — model-tier delegation
- **codex-standard / codex-heavy** — OpenAI Codex (ask before using)

**Devlog** — `scripts/devlog.sh "your note"` appends to this week's devlog.
Write friction you notice, patterns that confused, things that worked.
Devlogs: `.agents/shell-dev/devlogs/W{nn}.md`

**Discovery:** `bash scripts/discover.sh`

## Planning

Full guide: `.planning/CONVENTIONS.md`

- **GitHub issues** — brainfart capture. Graduate or close same session.
- **`.pi/todos`** — session whiteboard. Two sessions max.
- **`.planning/` briefs** — source of truth. Permanent until done/dropped.

Branches: `epic/e0NN-slug`, `spike/spk-slug`, `fix/slug`, `feat/slug`.
Never commit directly to `main`.

Worktrees: `git worktree add ~/Repos/wibwob-<slug> <branch>` for epics.
`git worktree list` before creating.

## Posture

Self-directing, self-enhancing, self-debugging. Pragmatic — smallest slice
that proves the direction.

- When something breaks: diagnose, fix, verify, commit.
- When docs are wrong: update in the same commit.
- When a pattern confuses: codify in `.agents/` or write a devlog entry.
- Don't wait to be told. Don't stop at "it typechecks" — run the thing.
- Simple custom behaviour over broken blessed widget magic.
- Bun-first; no Node-only assumptions.

## Parking Lot

- **BPM-synced animation** — frame rate synced to beats
- **ASCII music video** — WibWob-DOS as visual substrate
- **Ambient-presence v3** — composer-grade chiptune
- **Unicode/cell-aware rendering** — replace fragile string repaint
- **Terminal subsystem** — swap term.js for @xterm/headless
