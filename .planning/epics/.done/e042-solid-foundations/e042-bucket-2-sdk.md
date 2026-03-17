---
id: E042-B2
title: "SDK Composition Helpers"
status: not-started
depends_on: [E042-B1]
---

# E042-B2 — SDK Composition Helpers

**Sessions**: 1–2

## Why Second

Hero apps need these to demonstrate best practice. `src/sdk/` stubs already exist (`microapp-host.ts`, `runtime-helpers.ts`, `runtime-client.ts`) — this extends them with UI composition helpers.

## Context

`src/sdk/README.md` says: "keep `src/services/microapp-sdk.ts` as the stable public import path, move real SDK ownership here gradually, avoid exposing Blessed or unrelated internal helpers directly."

Currently 34/34 non-disabled microapps `import blessed from "blessed"` directly. The SDK provides 48 re-exports but zero composition helpers. blessed IS the primitive — SDK provides standardised patterns on top.

## Tasks

- [ ] Build composition helpers in `src/sdk/` (export via `microapp-sdk.ts`):
  - `createStatusBar(parent, opts)` → themed bottom bar with left/right text
  - `createSplitView(parent, opts)` → left/right or top/bottom panes
  - `createListPanel(parent, opts)` → selectable list with theme + vi keys
  - `createTextViewer(parent, opts)` → scrollable text box, wrap option
  - `createButtonBar(parent, buttons)` → bottom toolbar with keybindings
- [ ] Each: typed options interface, theme-aware, returns handle with update/destroy
- [ ] Document in `docs/sdk-primitives.md` with inline examples
- [ ] Update `microapp-sdk.ts` to export new primitives
- [ ] Verify: refactor notepad to use SDK primitives (swap raw blessed → helpers)

## Acceptance

- 5+ composition helpers exported from `microapp-sdk.ts`
- notepad uses at least 2 helpers (statusBar + textViewer)
- `bun run typecheck` clean
- `docs/sdk-primitives.md` exists with examples

## Autoresearch

Harness at `autoresearch/sdk-primitives/`. Primary metric: primitive count (higher is better).
