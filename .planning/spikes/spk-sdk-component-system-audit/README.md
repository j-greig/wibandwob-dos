---
status: not-started
owner: agent
branch: spike/spk-sdk-component-system-audit
updated: 2026-03-19
---

# spk-sdk-component-system-audit

Build a ruthless, product-grade component + SDK baseline for WibWob-DOS microapps.

## Why this spike exists

We have useful primitives and demos, but the surface has grown unevenly.
This spike creates a clear system:
1. what exists,
2. what is missing,
3. what to cut,
4. what to standardise in the SDK,
5. what to showcase as canonical usage.

COAT rule applies: every user-visible capability should remain command/API reachable, not TUI-only magic.

## Mission

Produce a **world-class, DRY, agent-friendly microapp SDK** with:
- coherent component taxonomy,
- external baseline comparisons (terminal + product UI libraries),
- explicit keep/cut/defer decisions,
- a canonical interactive showcase microapp (storybook-style),
- tightened docs with one owner per concept.

## Scope

### In
- `src/services/microapp-sdk.ts` API coherence and exports
- `src/ui/*` and `src/core/ui-*` reusable component surfaces
- microapp demos as evidence and migration targets
- microapp docs under `docs/` + `.agents/guides/microapp/`
- new showcase microapp if required (`microapps/sdk-storybook`)

### Out (unless explicitly promoted)
- marketing-site style component expansion
- non-microapp shell architecture rewrites
- unrelated infra/deployment work

## Mandatory philosophy ingest (before implementation)

Read and align decisions with:
- `.agents/guides/shell/invariants.md`
- `.agents/guides/shell/architecture.md`
- `.agents/guides/microapp/quick-start.md`
- `.agents/guides/microapp/component-contract.md`
- `.agents/guides/microapp/layout.md`

Interpretation rule:
- keep terminal-native focus,
- enforce COAT parity,
- reduce entropy (merge/delete where possible),
- avoid broad web-UI scope creep.

## Workstreams

### WS1 — Inventory + taxonomy (truth first)
Create a full component index grouped by categories:
- Typography/text presentation (headers, blocks, emphasis, syntax-like rendering)
- Chrome/layout (header bars, status bars, sidebars, panels, rules, splitters, stacks)
- Navigation (tabs, lists, pickers, search, segmented controls)
- Forms/inputs (buttons, inputs, checkbox/radio/select/toggle, text areas)
- Feedback/state (progress, spinner, toast, banners, empty/error states)
- Data display (key-value, logs, tables/charts, structured views)
- Overlays/flow (modals/dialogs/confirmations)
- Motion/timing (animation clock, tween, timers)
- Utilities/foundations (safe destroy, scrollbar helpers, theme adapters)

Output: `component-inventory.md`

### WS2 — External baseline comparison
Compare against pragmatic baselines (not exhaustive):
- Terminal-native: **Textual**, **Rich**, **Bubble Tea/Bubbles**
- Product/UI system: **Radix UI**, **shadcn/ui**, **Headless UI**

For each category, capture:
- parity (have/partial/missing),
- interaction model quality,
- API ergonomics,
- accessibility/keyboard semantics,
- composability and theming patterns,
- what is intentionally out-of-scope for WibWob-DOS.

Output: `external-comparison-matrix.md`

### WS3 — Gap triage + ruthless pruning
For every gap or duplicate:
- classify `keep`, `merge`, `deprecate`, `delete`, `defer`.
- require reason + migration path.
- require product impact score (developer value, maintenance cost, cognitive load).
- prioritise deleting noisy demos/components that distract from canonical SDK.

Output: `gap-triage.md`

### WS4 — Showcase microapp (interactive storybook)
Create/upgrade a single canonical showcase that demonstrates:
- each supported component category,
- keyboard and focus behaviour,
- restyle/theming resilience,
- captureText/describeState quality,
- command/API visibility.

Output: `microapps/sdk-storybook` (or harden `microapps/sdk-showcase` if better)

### WS5 — Docs refactor to canonical owner model
Apply progressive disclosure and DRY ownership:
- Quick-start: shortest path
- Task guides: focused how-to
- Reference: full API contract

Ensure every concept has one owner document and backlinks only.

Output: updated docs + `docs-owner-map.md`

## Agent strategy

Use a three-lens swarm deliberately:
- `.pi/agents/microapp-developer.md` → component implementation, cleanup, showcase behaviour
- `.pi/agents/microapp-doc-refiner.md` → IA, dedupe, progressive disclosure, owner mapping
- `microapp-product-owner` (new) → ruthless scope control, category coherence, keep/cut calls, user journey quality
- `arch-reviewer` (optional) → COAT/invariants audits before merge

Recommended cadence per slice:
1. microapp-product-owner picks one high-leverage slice and defines explicit keep/cut intent
2. microapp-developer implements smallest safe change
3. microapp-doc-refiner tightens docs for that exact slice
4. verify visually + API/CLI + typecheck/tests

Decision rule:
- No new component lands without an owner category, usage scenario, and keep/cut review note.

## Acceptance criteria (binary)

- [ ] AC-1: Component inventory exists and maps every exported SDK component to a category + owner file.
- [ ] AC-2: External comparison matrix covers at least 3 terminal and 3 product UI baselines with explicit parity notes.
- [ ] AC-3: Gap triage marks every non-canonical/demo-only component path as keep/merge/deprecate/delete/defer with rationale.
- [ ] AC-4: A single interactive showcase microapp demonstrates all kept categories with keyboard hints and stable cleanup/restyle.
- [ ] AC-5: SDK docs are reorganised to owner model (quick-start/task/reference) with no contradictory guidance in microapp docs.
- [ ] AC-6: Verification pass includes `bun run typecheck`, relevant tests, `wibwob` command checks, and visual proof artefacts.

## Verification contract (per implementation slice)

```bash
bun run typecheck
bun run test
bun run src/cli/wibwob.ts instances
bun run src/cli/wibwob.ts -i <label> cmd microapps.reload
bun run src/cli/wibwob.ts -i <label> commands -q | grep microapp.
bun run src/cli/wibwob.ts -i <label> minimap
./scripts/screenshot-window.sh "<showcase title>"
```

## Deliverables

- `component-inventory.md`
- `external-comparison-matrix.md`
- `gap-triage.md`
- `docs-owner-map.md`
- `agent-prompt-v2.md`
- showcase implementation notes + evidence paths

## Closeout checklist

- [ ] all deliverables updated
- [ ] docs and SDK exports aligned
- [ ] deprecations/deletions documented
- [ ] visual evidence captured
- [ ] next execution stories proposed
