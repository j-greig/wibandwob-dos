# Today Plan — spk-microapp-dev-hygiene

## Outcome

Build a combined **code + docs** improvement system:
- improve `src/services/microapp-sdk.ts` and microapp component usage quality
- improve `.agents/guides/microapp/*` + `docs/building-custom-microapps.md`
- run continual looping (`microloop`) for iteration cadence, not as a replacement for code work

## Approach ranking (best first)

1. **Paired loop (best): code slice + docs sync each iteration**
   - `microapp-developer` ships smallest code reliability/SDK slice
   - `microapp-doc-refiner` syncs canonical docs in same slice
   - gates + visual proof + fresh-eyes pass
2. **Code-first batch, docs-later**
   - faster short-term, high doc drift risk
3. **Docs-first only + self-prompt loop only**
   - improves guidance but does not reduce runtime defects enough

## Scenarios (how both agents work together)

### S1 — SDK contract mismatch found in a microapp
- Developer agent: fix SDK usage / lifecycle hooks / command wiring
- Doc refiner agent: update canonical SDK docs + pitfalls + quick-start links
- Keep only if typecheck + runtime gates + visual proof pass

### S2 — Repeated blessed/layout failure pattern
- Developer agent: extract minimal reusable helper into SDK (only after 2+ concrete uses)
- Doc refiner agent: add gotcha + usage example + migration note
- Fresh-eyes pass: check simplification opportunities and overfitting risk

### S3 — Command-surface confusion (`ok:true` but wrong outcome)
- Developer agent: enforce arg correctness / direct command path / state signal
- Doc refiner agent: tighten command guidance and verification checklist
- Log root cause in spike devlog and skill gotchas

## Execution order

- [ ] 1) Baseline audit
  - map duplicated concepts across:
    - `docs/building-custom-microapps.md`
    - `.agents/guides/microapp/*.md`
  - identify stale links and inconsistent terminology

- [ ] 2) Canonical ownership table
  - one owner file per concept:
    - lifecycle hooks
    - verification contract
    - persistence contract
    - SDK API reference
    - pitfalls/gotchas

- [ ] 3) Agent/skill setup
  - use `.pi/agents/microapp-doc-refiner.md` for doc architecture + dedupe
  - use `.pi/agents/microapp-developer.md` for implementation/debugging parity checks
  - use `/microloop start` to enforce iterative cadence and self-prompting

- [ ] 4) Pilot rewrite slice
  - focus only on lifecycle + verification + imports/SDK surface language
  - replace repeated prose with canonical links

- [ ] 5) Full microapp guide pass
  - quick-start remains short and procedural
  - deep API remains in sdk-reference + linked references

- [ ] 6) Verification + closeout
  - link/path checks
  - no merge markers in active source docs
  - `bun run typecheck`
  - update spike devlog with failures, fixes, and canon updates

## Risks to watch

- Docs drift from code reality (must verify examples)
- Over-refactoring wording without reducing duplication
- Adding style polish but no deterministic verification checklist

## Current SDK primitive queue (this loop)

- [x] `createSegmentedControl` (forms mode/density selector)
- [x] `createToggleSwitch` (boolean mode flag with keyboard/click parity)
- [ ] next: one lightweight navigation/status primitive with demo adoption

## Definition of done (today slice)

- [ ] canonical ownership table exists and is applied
- [ ] repeated lifecycle guidance reduced to one canonical source
- [ ] quick-start doc is shorter, clearer, and link-driven
- [ ] partner agents are configured in `.pi/agents/` and referenced from spike README
- [ ] devlog captures at least 3 concrete pain→why→fix learnings
