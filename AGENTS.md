---
title: WibWob-DOS — Agent Orientation
description: Conventions, workflow posture, microapp triad, planning tools, CLI, ops.
audience: agents
---

# AGENTS.md

WibWob-DOS — terminal desktop, equal human/agent control. Bun + blessed + local HTTP API.

---

## How these docs work

> This system is an instance of autopoietic homoiconicity — see `PHILOSOPHY.md §The documentation principle`.

CAPS MD files at repo root are the entire doc surface — hand-written stable prose, one concern each. Add a new one only when a concern is important enough to live at that level.

| File | Concern |
|------|---------|
| `AGENTS.md` | Conventions, workflow, posture (this file) |
| `PHILOSOPHY.md` | Why this exists, design filters, SDK boundary |
| `ARCHITECTURE.md` | COAT, subsystems, invariants |
| `GOTCHAS.md` | Non-obvious failure modes — add when something burns you |
| `SDK-MICROAPP-DEV.md` | Building microapps: quick-start → host API → UI → persistence → cloud ops |

### Generated outputs

Generated docs are linked inline with bold markdown — wherever they're relevant in the text:

**→ [COAT.md](COAT.md)** — committed snapshot, read this

**Agents read outputs. Run generators only when source files change.**

Generated markdown files carry a YAML frontmatter block — any agent opening them knows not to edit and how to refresh:
```yaml
---
generated-by: bun scripts/gen-integration-surface.ts
watches:
  - src/services/control-api.ts
  - src/core/command-catalog.ts
parent: ARCHITECTURE.md
do-not-edit: true
---
```
The full generator manifest — what produces what, watching which sources — lives in `ARCHITECTURE.md` frontmatter.

### Gen script contract (atypical — not standard dev pattern)

Every `scripts/gen-*` file declares its own metadata via comment headers:

```typescript
// @watches src/services/control-api.ts src/core/command-catalog.ts
// @output  COAT.md
// @run     bun scripts/gen-integration-surface.ts
```

`bash scripts/doc-sync.sh` greps these headers across all gen scripts, diffs them against changed files, and runs only what's stale. **Self-registering — add a new gen script with these headers and it participates automatically. No other files to update.**

#### When this matters

- You deleted a skill → `doc-sync.sh` detects `.pi/skills/` changed → reruns `gen-skills.py` → `skills.md` stays honest
- You added an API endpoint → `doc-sync.sh` detects `control-api.ts` changed → reruns `gen-integration-surface.ts` → `COAT.md` reflects it
- You added a new gen script → add `@watches`/`@output`/`@run` headers **and** add an entry to `ARCHITECTURE.md` frontmatter `generators:` block → done.
- You open a generated file and consider editing it → the `do-not-edit: true` frontmatter field stops you → you run the generator instead

#### What NOT to do

Don't duplicate watched file mappings in prose. The canonical sources are: `ARCHITECTURE.md` frontmatter (primary, machine-readable) and gen script `@watches` headers (fallback). A list anywhere else will drift.

---

## CLI

`wibwob --help` for full usage. `-i <label>` targets a specific instance — optional
for single instance, required when multiple agents or humans share a machine.

**Visual verification is mandatory.** API responses alone are not sufficient proof.

---

## Microapps

Use the `microapp-creator` skill. It covers scaffold, register, hooks, and dev loop.

**→ [.pi/skills/skills.md](.pi/skills/skills.md)** — full skill index with triggers, boundaries, last-used

The **microapp triad** workflow for any microapp work:

1. **microapp-product-owner** — scope + keep/cut decisions (always goes first)
2. **microapp-developer** — implements one slice only
3. **microapp-doc-refiner** — updates canonical docs for that slice

Product-owner defines the slice before developer touches code. Every slice
produces binary evidence (pass/fail + artefact path). 3 small slices > 1 large one.

---

## Ops

`bash scripts/ensure-running.sh` · `bash scripts/restart.sh` · `bash scripts/reload-microapp.sh <id>`
`curl localhost:8099/health` · `curl localhost:8099/state` · `wibwob --help` for full CLI.

---

## Planning

- **GitHub issues** — brainfart capture. Graduate or close same session.
- **`.pi/todos`** — session whiteboard. Two sessions max.
- **`.planning/` briefs** — permanent source of truth.

Branches: `epic/e0NN-slug` · `spike/spk-slug` · `fix/slug` · `feat/slug`
Never commit to `main`.

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
