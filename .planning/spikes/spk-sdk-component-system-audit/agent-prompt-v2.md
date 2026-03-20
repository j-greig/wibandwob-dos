# Agent Prompt v2 — SDK Component System Audit + Upgrade

Use this prompt to run the spike with a three-lens swarm.

---

You are working in WibWob-DOS. Run a **ruthless SDK component-system audit and upgrade**.

## Objective

Make the microapp SDK world-class for humans and coding agents:
- coherent component taxonomy,
- fewer but stronger primitives,
- DRY docs with canonical owners,
- clearer showcase surface,
- easier third-party microapp authoring.

Follow root `AGENTS.md`, shell invariants, and COAT.

## Team lenses (must all be used)

1. **microapp-product-owner**
   - chooses scope, keeps/cuts aggressively, controls category coherence
2. **microapp-developer**
   - implements smallest safe code slices
3. **microapp-doc-refiner**
   - updates docs to canonical owner model, progressive disclosure

## Work order

1. **Inventory current system**
   - list all SDK exports and component primitives
   - map to categories (typography, chrome/layout, nav, forms, feedback, data display, overlays, motion, utilities)
   - output: `component-inventory.md`

2. **Compare external baselines**
   - terminal: Textual, Rich, Bubble Tea/Bubbles
   - product UI: Radix UI, shadcn/ui, Headless UI
   - for each category: parity, ergonomic notes, intentional out-of-scope
   - output: `external-comparison-matrix.md`

3. **Run keep/cut triage**
   - classify each questionable component/demo path as keep/merge/deprecate/delete/defer
   - include reason + migration path + product impact score
   - output: `gap-triage.md`

4. **Showcase decision**
   - either harden `microapps/sdk-showcase` or create `microapps/sdk-storybook`
   - ensure it demonstrates canonical components and interaction semantics

5. **SDK/API tightening**
   - improve naming consistency, export clarity, callback/error semantics, cleanup patterns
   - avoid adding niche primitives without category justification

6. **Docs tightening**
   - quick-start = shortest path
   - guides = task-focused
   - reference = full contracts
   - remove duplicates; use backlinks to canonical owner docs

## Constraints

- No uncontrolled feature sprawl.
- No component lands without owner category + usage scenario + docs contract.
- Prefer removing weak components over keeping confusing duplicates.
- Verify visually and via CLI/API, not API-only.

## Verification

Run per slice:
- `bun run typecheck`
- `bun run test`
- `bun run src/cli/wibwob.ts instances`
- `bun run src/cli/wibwob.ts -i <label> cmd microapps.reload`
- `bun run src/cli/wibwob.ts -i <label> minimap`
- `./scripts/screenshot-window.sh "<title>"`

## Output format (required)

- What was audited
- Keep/cut decisions made
- Code/docs changes
- Verification evidence
- Next 3 smallest safe slices
- Open risks / deferred items

---

Decision posture: **product clarity over component count**.
