# Docs Owner Map (v0)

Goal: one concept, one canonical owner doc.

## Layer A — Quick start (short path)

- **Owner:** `.agents/guides/microapp/quick-start.md`
- Owns:
  - scaffold + minimum working microapp
  - required hooks checklist
  - basic run/verify commands
- Must link out (not duplicate):
  - layout details
  - component contract
  - full SDK API surface

## Layer B — Task guides (how-to)

- **Layout and composition owner:** `.agents/guides/microapp/layout.md`
- **Lifecycle / behaviour contract owner:** `.agents/guides/microapp/component-contract.md`
- **Failure-mode owner:** `.agents/guides/microapp/pitfalls.md`
- **Persistence owner:** `.agents/guides/microapp/persistence.md`
- **Examples owner:** `.agents/guides/microapp/examples-by-tier.md`

## Layer C — Full reference

- **SDK contract owner:** `.agents/guides/microapp/sdk-reference.md`
- **Build flow owner:** `docs/building-custom-microapps.md`

---

## Duplication cuts queued

1. `docs/building-custom-microapps.md` vs `quick-start.md`
   - Keep quick-start procedural and short.
   - Move exhaustive details to reference.

2. `component-contract.md` vs parts of `sdk-reference.md`
   - Keep behavioural guarantees in component contract.
   - Keep signatures/examples in sdk-reference.

3. Pitfalls repeated across guides
   - Keep anti-pattern catalogue in `pitfalls.md` only.
   - Other guides should backlink to precise sections.

---

## Enforcement rule for this spike

Any new SDK component/docs change must state:
1. canonical owner file,
2. backlink files that mention (without re-explaining),
3. whether it added or removed duplication.
