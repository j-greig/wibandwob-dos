# AGENTS.md

WibWob-DOS — terminal desktop, equal human/agent control. Bun + blessed + local HTTP API.

---

## How these docs work

Four CAPS MD files at repo root are the entire doc surface:

- `AGENTS.md` — conventions, workflow, posture (this file)
- `PHILOSOPHY.md` — why this exists, design filters, SDK boundary
- `ARCHITECTURE.md` — COAT (Command Once, Adapt Thin), subsystems, invariants
- `LEXICON.md` — vocabulary

`<progressive-disclosure>` tags mark where a `scripts/gen-*` script provides
deeper generated detail. Run the script to get it:

```
`scripts/gen-COAT.ts`          → snapshot of endpoints + commands
`scripts/gen-skills.py`        → `.pi/skills/skills.md` (skill index + usage)
`scripts/gen-sdk-surface.ts`   → (TBD) SDK export directory with tiers
`scripts/gen-primitives.ts`    → `src/core/primitives.ts` barrel
```

---

## CLI

`wibwob --help` for full usage. `-i <label>` targets a specific instance — optional
for single instance, required when multiple agents or humans share a machine.

**Visual verification is mandatory.** API responses alone are not sufficient proof.

---

## Microapps

Use the `microapp-creator` skill. It covers scaffold, register, hooks, and dev loop.

The **microapp triad** workflow for any microapp work:

1. **microapp-product-owner** — scope + keep/cut decisions (always goes first)
2. **microapp-developer** — implements one slice only
3. **microapp-doc-refiner** — updates canonical docs for that slice

Product-owner defines the slice before developer touches code. Every slice
produces binary evidence (pass/fail + artefact path). 3 small slices > 1 large one.

---

## Ops

Use the `ww-ops` skill. It covers start, restart, reload, health, screenshots, tmux.

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
- A pattern confuses → write a devlog entry (`scripts/devlog.sh "note"`)
- "It typechecks" is not done — run the thing
- Bun-first. No Node-only assumptions.

---

## Parking lot

BPM-synced animation · ASCII music video · Ambient-presence v3 ·
Unicode/cell-aware rendering · Terminal subsystem (swap term.js for @xterm/headless)
