---
status: in-progress
updated: 2026-03-19
owner: agent
---

# SDK Component System Audit — Execution Plan (Tick-off)

Goal: make the microapp SDK **crisper** in implementation + docs, with ruthless keep/cut decisions and verifiable runtime proof.

## Operating rules

- Instance targeting always explicit (`-i <label>`).
- Treat instance labels as canonical 3-char IDs from `wibwob instances` / `/health` and reuse exactly.
- Runtime lifecycle is tmux-controlled (start/restart/recover through tmux-aware ops flow).
- Every slice must include code/docs sync (no drift).
- Every slice ends with binary verification evidence.
- Prefer merge/delete/deprecate over adding overlap.
- Major features or slice completions should be committed in logical chunks

## Delegation matrix (agentic-friendly)

- **microapp-product-owner**: scope, keep/cut, taxonomy decisions.
- **microapp-developer**: SDK/component code changes + showcase behaviour.
- **microapp-doc-refiner**: docs owner model + dedupe + quick-start tightening.
- **arch-reviewer** (checkpoint): COAT/invariants sanity before large merges.

Relevant skills to load when needed (not all skills, only fit-for-purpose):
- `.pi/skills/ww-ops/SKILL.md` (runtime lifecycle, restart, screenshots)
- `.pi/skills/simplify-docs/SKILL.md` (docs crispness pass)
- `.pi/skills/simplify/SKILL.md` (code simplification pass)
- `.pi/skills/planning-update/SKILL.md` (closeout)

## Phase 0 — Runtime bootstrap + crash protocol

- [x] P0.1 Start/restore WibWob-DOS runtime in tmux.
- [x] P0.2 Capture active instance label and health.
- [ ] P0.3 Confirm restart protocol works.
- [x] P0.4 Record crash-recovery command snippets (tmux send-keys + restart path) in this spike notes.
- [~] P0.5 Ghostty mouse smoke for File + Applications menu (attempted; requires attached terminal context for positive validation).

Commands:
```bash
bun run src/cli/wibwob.ts instances
bun run src/cli/wibwob.ts -i <label> health
bash scripts/restart.sh
bun run src/cli/wibwob.ts instances
```

Pass criteria:
- at least one healthy instance exists,
- label is known and reused in all commands,
- restart returns to healthy state.

## Phase 1 — Inventory (truth map)

- [x] P1.1 Generate SDK export inventory (`src/services/microapp-sdk.ts`).
- [x] P1.2 Map exports to category taxonomy.
- [x] P1.3 Map each category to canonical owner docs.

Outputs:
- [ ] `component-inventory.md`
- [ ] `docs-owner-map.md`

Pass criteria:
- every SDK export appears exactly once in taxonomy.

## Phase 2 — External baseline comparison

- [x] P2.1 Terminal baseline comparison (Textual, Rich, Bubble Tea/Bubbles).
- [x] P2.2 Product baseline comparison (Radix UI, shadcn/ui, Headless UI).
- [x] P2.3 Mark intentional out-of-scope items for WibWob-DOS.

Output:
- [ ] `external-comparison-matrix.md`

Pass criteria:
- each category has parity status: have / partial / missing / intentionally out.

## Phase 3 — Ruthless keep/cut decisions

- [x] P3.1 Decide keep/merge/deprecate/delete/defer for overlaps.
- [x] P3.2 Include migration path for every deprecate/delete.
- [x] P3.3 Flag demo microapps to keep vs prune.

Output:
- [ ] `gap-triage.md`

Pass criteria:
- no undecided overlaps remain.

## Phase 4 — Crisp SDK implementation upgrades (priority)

- [x] P4.1 Tighten naming/typing/export coherence in `microapp-sdk.ts` (added `toEvenCellWidth`, exported motion helper suite, clarified preferred naming policy).
- [x] P4.2 Strengthen lifecycle reliability in selected components.
- [x] P4.3 Add/expand targeted tests for high-value controls (full `bun run test` + `typecheck` green after changes).
- [~] P4.4 Remove or merge low-value duplicated primitives (decision doc done; alias/deprecation consolidation still pending).

Pass criteria:
- typecheck/test pass,
- no regression in showcase + key demos,
- reduced surface complexity (measured in triage notes).

## Phase 5 — Crisp docs upgrades (priority)

- [ ] P5.1 Quick-start reduced to shortest valid path.
- [ ] P5.2 Task guides contain only operational guidance.
- [~] P5.3 Reference owns full API contract; duplicates removed (animation helper docs updated; full dedupe pass pending).
- [x] P5.4 Pitfalls synced to real failure evidence.

Pass criteria:
- no contradictory guidance across microapp docs,
- each concept has one canonical owner.

## Automation discovery input (carry into verification tooling)

- Source: `.agents/reflections/2026-W12.md` discovery note.
- Discovery: Ghostty AppleScript supports:
  - `send mouse position x <pixels> y <pixels> to <terminal>`
  - `send mouse button <left/right/middle button> action <press/release> to <terminal>`
- Use: optional scripted visual interaction for showcase smoke checks when keyboard-only flow is insufficient.
- Constraint: keep this as optional harness automation; canonical control path remains `wibwob` CLI + API-visible actions.

## Phase 6 — Showcase + verification evidence

- [x] P6.1 Harden existing `microapps/sdk-showcase` OR create `microapps/sdk-storybook` (hardened `sdk-showcase`, split demo catalogue into `demos.ts`, added motion helper demo).
- [x] P6.2 Ensure keyboard/focus/restyle/cleanup behaviour is demonstrable.
- [x] P6.3 Capture screenshots + minimap + state evidence.

Verification commands (per slice):
```bash
bun run typecheck
bun run test
bun run src/cli/wibwob.ts -i <label> cmd microapps.reload
bun run src/cli/wibwob.ts -i <label> minimap
bun run src/cli/wibwob.ts -i <label> state
./scripts/screenshot-window.sh "<window title>"
```

Pass criteria:
- binary evidence attached for each slice (pass/fail + artefact path).

## Phase 7 — External inspiration synthesis (gstack)

- [x] P7.1 Vendor install + read core docs (`README`, `docs/skills`, `ARCHITECTURE`).
- [x] P7.2 Extract COAT-compatible adaptations for WibWob systems.
- [x] P7.3 Write prioritised adaptation notes.

Output:
- [x] `gstack-inspiration-notes.md`

## Current status snapshot

- Runtime instance in use: `95d` (port `8100`, tmux-managed).
- Completed: Phases 1, 2, 3, 6, 7; Phase 4 mostly complete; Phase 5 partially complete.
- Next action: finish Phase 5 docs dedupe + remaining Phase 4 alias/deprecation consolidation.
