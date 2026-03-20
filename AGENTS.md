# AGENTS.md

> Philosophy: `PHILOSOPHY.md` · Architecture + build guide: `ARCHITECTURE.md` · Vocabulary: `LEXICON.md`

WibWob-DOS — terminal desktop, equal human/agent control. Bun + blessed + local HTTP API.

---

## How these docs work

Five CAPS MD files at repo root are the entire doc surface:
`AGENTS.md` · `PHILOSOPHY.md` · `ARCHITECTURE.md` · `LEXICON.md` · `COAT.md`

Human maintains the first four. `COAT.md` is auto-generated.

`<progressive-disclosure>` tags mark where a `scripts/gen-*` script provides
deeper generated detail. Run the script to get it:

```
scripts/gen-coat.ts          → COAT.md (all endpoints + commands)
scripts/gen-skills.py        → .pi/skills/skills.md (skill index + usage)
scripts/gen-sdk-surface.ts   → (TBD) SDK export directory with tiers
scripts/gen-primitives.ts    → src/core/primitives.ts barrel
```

---

## Instance targeting (do this first, every session)

Every `wibwob` command needs `-i <label>`. Find your label:

```bash
bun run src/cli/wibwob.ts instances
```

Then pin it to every call:

```bash
wibwob -i <label> health                   # verify alive
wibwob -i <label> minimap                  # visual ASCII desktop map
wibwob -i <label> windows                  # JSON window list with IDs
wibwob -i <label> state                    # full live desktop state
wibwob -i <label> commands -q              # all command IDs
```

Window operations:

```bash
wibwob -i <label> cmd <command.id>
wibwob -i <label> window <id> resize --width 120 --height 40
wibwob -i <label> window <id> move --left 10 --top 5
wibwob -i <label> read <id>                # semantic text from window
echo "text" | wibwob -i <label> write <id>
```

For TUI-related work eg on the frontend, **visual verification is mandatory.** API responses are not sufficient proof.

---

## Building a microapp

```bash
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>
```

**Non-obvious:** the microapp won't appear until you add it to
`src/core/microapp-registry.ts` → `REGISTRY`.
Tiers: `core` = menu + API visible, `beta` = API only.

Full guide: `ARCHITECTURE.md §The microapp model`

---

## Lifecycle + ops

```bash
bun install && bun run typecheck && bun run dev:world  # start fresh
bash scripts/restart.sh                                 # restart (preferred)
kill $(cat scratch/wibwob.pid)                         # stop — SIGTERM, never -9
bash scripts/reload-microapp.sh <id>                   # hot reload one microapp
wibwob clean --kill                                    # kill orphan instances
bun run health                                         # gate: tests + typecheck + COAT
```

---

## Agent resources

**Microapp triad** — use for any microapp, SDK, or microapp-doc work:

1. **microapp-product-owner** — scope + keep/cut decisions (always goes first)
2. **microapp-developer** — implements one slice only
3. **microapp-doc-refiner** — updates canonical docs for that slice

Rules: product-owner defines the slice before developer touches code. Every slice
produces binary evidence (pass/fail + artefact path). 3 small slices > 1 large one.

Other subagents (`.pi/agents/`): `ops` (runtime/health/debug), `arch-reviewer`
(COAT compliance), `code-reviewer` (quality + type safety).

**PTC** — `.pi/extensions/ptc.ts` registers `execute_code`. Write JS calling pi
tools as async functions; only `console.log()` returns to context. Use when
chaining 3+ non-bash tool calls.

**Devlog** — `scripts/devlog.sh "note"` → `.pi/reflections/2026-W{nn}.md`.
Write friction, patterns that confused, things that worked.

<progressive-disclosure>
Full skill index with usage data: run `python3 scripts/gen-skills.py`
</progressive-disclosure>

---

## Planning

- **GitHub issues** — brainfart capture. Graduate or close same session.
- **`.pi/todos`** — session whiteboard. Two sessions max.
- **`.planning/` briefs** — permanent source of truth.

Branches: `epic/e0NN-slug` · `spike/spk-slug` · `fix/slug` · `feat/slug`
Never commit to `main`.
Worktrees: `git worktree add ~/Repos/wibwob-<slug> <branch>`

---

## Posture

Self-directing, self-debugging. Smallest slice that proves the direction.

- Something breaks → diagnose, fix, verify, commit
- Docs are wrong → fix in the same commit
- A pattern confuses → write a devlog entry
- "It typechecks" is not done — run the thing
- Bun-first. No Node-only assumptions.

---

## Parking lot

BPM-synced animation · ASCII music video · Ambient-presence v3 ·
Unicode/cell-aware rendering · Terminal subsystem (swap term.js for @xterm/headless)
