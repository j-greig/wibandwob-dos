# COAT Enforcement — Running Notes

How we keep COAT honest as the codebase grows. Capture ideas here as
they emerge during migration work. Not a spec yet — just a scratchpad.

## The problem

COAT says: one command definition, four shared seams, thin adapters.
But nothing currently *stops* someone (human or agent) from:

- hardcoding a command in app-controller without a catalog entry
- importing `src/core/*` directly from a microapp
- adding API behaviour that doesn't go through the command seam
- registering menu items that bypass the manifest

## Enforcement categories

### 1. Deterministic / code checks

Things we can catch with linting, import analysis, or bun scripts.

- [ ] **Import boundary lint**: microapps must not import from `src/core/*`, `src/services/*` (except `microapp-sdk.ts`). Could be an ESLint rule or a simple grep-based bun script.
- [ ] **Orphan actionKey check**: scan `AppMenuActions` interface for keys with no corresponding catalog entry, or catalog entries with no controller handler.
- [ ] **Manifest completeness**: every `microapps/*/microapp.json` has required fields (id, title, menu or palette, agent/api flags).
- [ ] **Command id format**: enforce `<domain>.<action>` naming via regex in catalog or a check script.
- [ ] **No direct blessed in SDK**: `src/sdk/*.ts` should not import blessed directly (host-internal leakage).

### 2. Bun scripts (we have many — consolidate?)

Current scripts worth auditing for overlap:
- `bun run typecheck` — keep, minimum gate
- `bun run check-themes` — keep, theme-specific
- `bun run gen-primitives` — keep, generated index
- `bun run planning:status` / `planning:sync` — keep, planning
- `bun run scaffold:microapp` — keep, authoring

Potential new scripts:
- `bun run check:coat` — runs all COAT boundary checks (import lint, orphan check, manifest check)
- Or fold into existing typecheck as a post-step?

Concern: too many scripts already. Maybe one `bun run check` that runs typecheck + coat checks + theme checks. Single gate.

### 3. Agent skills / guardrails

When an agent is building a microapp or adding commands:

- [ ] **Microapp scaffold skill** already exists and produces correct structure. Good.
- [ ] **Post-migration checklist** in the migration map doc. Needs to become a reusable skill or at least a skill-referenced checklist.
- [ ] **COAT test prompt**: could add to the microapp-dev skill — "before you ship, ask: would this work if the TUI didn't exist?"
- [ ] **Command parity smoke**: agent skill that hits `/commands/list` and cross-references against catalog. Catches drift.

### 4. AI inference checks

Heavier checks that need LLM reasoning, not just grep:

- [ ] Review new `src/windows/*.ts` files for host-internal coupling that should be SDK
- [ ] Review new command handlers in app-controller for logic that should live in a service
- [ ] Review microapp PRs for direct blessed manipulation that should use SDK components
- [ ] Detect when an adapter (API/CLI/TUI) is accumulating behaviour instead of staying thin

These could be PR review prompts, or a periodic "COAT audit" skill.

### 5. Things I haven't thought of yet

(Add here as they emerge during migration work)

---

## Observations during migration

### figlet-banner (first migration)

- **SDK gap: `host.pickFromList()`** — The host exposes `pickFile()`, `promptValue()`,
  and `flash()` but no generic list picker. The old code used `OverlayManager.openListPrompt()`
  directly (host-internal). The microapp builds an inline blessed list instead.
  This is fine for now but a proper `host.pickFromList(title, choices, opts)` should
  be added to the SDK to avoid every microapp reinventing list pickers.

- **SDK exports expanded**: added `getFigletCatalogue`, `getFigletFontChoices`,
  `getDefaultFigletFont`, `getFigletWindowContentSize` to `microapp-sdk.ts`.
  These were service-internal before — microapps need them for figlet authoring.

- **Auto-sizing**: The old code used `applyMeasuredWindowSize()` which is host-internal
  (knows about chrome modes). The microapp uses `host.windows.resizeWindow()` with
  manual chrome padding (+4w, +6h). This is slightly fragile — if chrome changes,
  the padding is wrong. Consider adding `host.windows.resizeToContent(id, {width, height})`
  that accounts for chrome automatically.

- **Command parity note**: The old `figlet.open` command in the catalog had `requires: ["bin.figlet"]`.
  Microapp manifests don't have a `requires` field yet. The figlet-service itself handles
  the fallback gracefully, but this is a manifest gap worth noting.

- **Loader `registerCommand` accepted boolean menu/palette but crashed**: Passing
  `menu: true` caused `def.menu?.map is not a function` because `true?.map` is
  `undefined` and calling `undefined(...)` throws. Fixed with `Array.isArray` guard.
  Same issue existed for `palette: true`. This was documented in the devlog (2026-03-10)
  as a known friction point but never fixed in the loader itself until now.

- **Log location**: App logs go to `logs/tui-app/YYYY-MM-DD.log`, NOT `scratch/logs/app.log`.
  The scratch log is stale/legacy. Agents should check the dated log.

### generative-art migration

- **Partial file migration is OK.** `generative-windows.ts` contains both migratable
  surfaces (pattern, art) and host-internal surfaces (palette, workspace manager,
  state inspector). Migrated the surfaces, left the host internals. The file stays
  but with dead code (old pattern/art functions no longer called).

- **`multiInstance: false` + multiple commands = confusing.** The loader wraps all
  commands in the same `focusOrCreate`, so opening "art" after "pattern" just focused
  the pattern window. Fix: set `multiInstance: true` and use `direct: true` on commands.

### text-windows.ts assessment (deferred)

- **Not migratable as-is.** Deeply coupled to `EditorCoordinator` (src/core/,
  247 lines), `WindowRecord.editor` property, and host-internal overlay/save flows.
  Would need EditorCoordinator to become an SDK service first.

### browser-windows.ts assessment (deferred)

- **God-file needs decomposition first.** 2082 lines containing 4+ different window
  factories sharing internal helpers. Can't extract one function without untangling
  the shared code. Separate refactor track.
