---
id: E042-B1
title: "Dead Code + Circular Dep Cleanup"
status: not-started
depends_on: []
---

# E042-B1 — Dead Code + Circular Dep Cleanup

**Sessions**: 1 · **Tools**: knip, madge

## Why First

Removes noise, fixes architecture violations, establishes clean baseline. Can't build SDK primitives on a foundation with a microapp leaking into the SDK import chain.

## Findings (2026-03-15)

### Knip
- 28 unused exports (dead code from extractions)
- 38 unused exported types
- 12,302 "unused files" — noise from dynamic microapp loading, needs config

### Madge — 6 circular dependencies
1. **CRITICAL**: `microapp-sdk.ts → canvas-types.ts → sy2-chronicles/panel-types.ts` — microapp types polluting SDK
2. `ui-parts.ts → ui-parts-data.ts` — barrel re-export cycle
3. `ui-parts.ts → ui-parts-feedback.ts` — barrel re-export cycle
4. `ui-parts.ts → ui-parts-forms.ts` — barrel re-export cycle
5. `skeleton-renderer.ts → webcam-renderer.ts` — renderer cross-dep
6. `capability-service.ts → chrome-browser-service.ts` — service cross-dep

## Tasks

- [ ] Configure `knip.json` (ignore microapps/, .pi/, scripts/, .trash/, .disabled/)
- [ ] Kill 28 unused exports + 38 unused types
- [ ] Fix 6 circular deps:
  - Critical: sever sy2-chronicles panel-types leak from SDK chain
  - Break ui-parts.ts barrel cycle → direct imports from sub-modules
  - Fix skeleton-renderer ↔ webcam-renderer cross-dep
  - Fix capability-service ↔ chrome-browser-service cross-dep
- [ ] Add `bun run health` script (typecheck + coat + lint + knip + madge --circular)
- [ ] Fix scaffold-microapp.sh manifest format
- [ ] Nuke `.disabled/` (or move to `.trash/disabled-microapps/`)

## Gate

After all fixes, restart app and **ops smoke check**:
- `wibwob health` — app responds
- `wibwob state` — desktop state valid
- Open/close one core microapp via API
- Dead code removal must not break the running TUI

## Acceptance

- `bunx knip` unused exports → 0
- `bunx madge --circular src/` → 0 cycles
- `bun run health` passes (new composite script)
- Ops smoke check passes

## Autoresearch

Harness at `autoresearch/dead-code/`. Primary metric: combined finding count (lower is better).
