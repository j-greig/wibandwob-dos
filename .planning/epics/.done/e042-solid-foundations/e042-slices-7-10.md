---
id: E042-S7-S10
title: "SDK Convergence — Naming, Handle API, Annotations, File-Manager Migration"
status: done
depends_on: [E042-B01, E042-B02, E042-B06]
---

# E042 Slices 7–10: SDK Convergence

Follow-on from B01–B06. Completes all 🟡 in-progress items from PHILOSOPHY.md §9.

Execution order: S7 → S8 → S9 → S10 (strict).

---

## S7 — SDK Naming: Drop `Simple` Prefix

**Goal:** Give clean canonical names to SDK Handle components. Rename old LayoutPart
versions to `createLayout*` internally so SDK gets `createStatusBar`/`createButtonBar`.

### Tasks

- [x] Rename `createStatusBar` → `createLayoutStatusBar` in `src/ui/chrome.ts`
- [x] Rename `createButtonBar` → `createLayoutButtonBar` in `src/ui/chrome.ts`
- [x] Update all 7 internal files that import the old names:
  - [x] `src/core/modal.ts`
  - [x] `src/core/overlay-manager.ts`
  - [x] `src/sdk/microapp-host.ts`
  - [x] `src/services/microapp-loader.ts`
  - [x] `src/windows/music-player-window.ts`
  - [x] `src/windows/terrain-lab-window.ts`
  - [x] `src/core/primitives.ts`
- [x] Rename `createSimpleStatusBar` → `createStatusBar` in `src/sdk/composition-helpers.ts`
- [x] Rename `createSimpleButtonBar` → `createButtonBar` in `src/sdk/composition-helpers.ts`
- [x] Update `src/services/microapp-sdk.ts` exports (drop `Simple`)
- [x] Update microapps: notepad, data-dashboard
- [x] Update `docs/sdk-primitives.md`, `docs/design-system.md`
- [x] `bun run health` passes
- [x] No `Simple` in any SDK-facing export

**Gate:** `bun run health`, grep confirms no `createSimple` in SDK surface.

---

## S8 — Handle API for Key LayoutPart Components

**Goal:** Build Handle versions of the 5 most-needed LayoutPart components so microapp
authors never need raw blessed for common patterns.

### Tasks

- [x] `createHeaderBar(parent, opts)` → themed top bar with left/right text
- [x] `createScrollView(parent, opts)` → scrollable content area with scrollbar
- [x] `createTabs(parent, opts)` → tabbed container with keyboard switching
- [x] `createRule(parent, opts)` → horizontal divider line
- [x] `createInputLine(parent, opts)` → text input with submit/cancel
- [x] Export all from `src/sdk/composition-helpers.ts`
- [x] Export all from `src/services/microapp-sdk.ts`
- [x] Update `docs/sdk-primitives.md` with examples for each
- [x] Update `docs/design-system.md` Handle API inventory
- [x] `bun run health` passes
- [x] Total SDK Handle components: 10

**Gate:** `bun run health`, 10 Handle components exported from SDK.

---

## S9 — Stability Annotations

**Goal:** Tag every SDK export with `@public`, `@beta`, or `@internal` so developers
and agents know what's safe to depend on.

### Tasks

- [x] Annotate `src/services/microapp-sdk.ts` exports (~350 lines):
  - [x] `@public` — MicroappHost, createWindow, describeState, captureText, theme types
  - [x] `@public` — Handle API helpers (createStatusBar, createTextViewer, etc.)
  - [x] `@beta` — canvas/zine types, newer Handle components from S8
  - [x] `@internal` — LayoutPart API, layout engine re-exports
- [x] Update `docs/sdk-primitives.md` with stability tier per component
- [x] Update `PHILOSOPHY.md` §4 status from 🟡 to ✅
- [x] `bun run health` passes

**Gate:** `bun run health`, every export in microapp-sdk.ts has a stability JSDoc tag.

---

## S10 — File-Manager Microapp Migration

**Goal:** Move `src/windows/file-manager-window.ts` (1623 lines) to `microapps/file-manager/`,
making it hero app #7.

### Tasks

- [x] Scaffold `microapps/file-manager/microapp.json`
- [x] Move window code to `microapps/file-manager/index.ts`
- [x] Fix imports (SDK where possible, keep blessed for complex internals)
- [x] Register `wibwob.file-manager` in `src/core/microapp-registry.ts`
- [x] Wire `describeState()` if missing
- [x] Wire `captureText()` if missing
- [x] Remove `src/windows/file-manager-window.ts`
- [x] Update `src/core/app-controller.ts` references → use microapp command
- [x] Update `docs/microapp-examples.md` (hero #7 no longer "migration pending")
- [x] Update `PHILOSOPHY.md` §6 hero app status
- [x] `bun run health` passes
- [x] File-manager opens via API, returns valid describeState
- [x] hero_pass_count = 7/7

**Gate:** `bun run health`, `hero_pass_count=7`, no file-manager code in `src/windows/`.

---

## Related: WibMux

MVP at `/Users/james/Repos/wibandwob-dos-wibmux/autoresearch/wibmux/wibmux.sh`.
May affect scripting patterns and `wibwob attach` v2. Reference if relevant during S8–S10.
