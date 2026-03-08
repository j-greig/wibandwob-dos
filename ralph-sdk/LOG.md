# SDK Runtime Build Log

## 2026-03-08 22:57 — Story 1: Poetry Clock SDK Rewrite

**Step**: Added `#sdk` package imports alias to package.json, rewrote poetry-clock to use `import ... from "#sdk"` instead of `../../src/services/microapp-sdk.js`. Verified Bun resolves it at runtime.
**Typecheck**: pass
**Done conditions**: 1/1 passing (zero `../src` imports)
**Next**: Story 2 — ModuleRuntimeService + /modules/list

## 2026-03-08 23:05 — Story 2: ModuleRuntimeService + /modules/list

**Step**: Created `module-runtime-service.ts` with discovery tracking, list/unload/reload methods, dev-mode file watcher. Added `removeDynamic()` to CommandRegistry. Added `/modules/list`, `/modules/unload`, `/modules/reload` endpoints to control-api. Wired service into app-controller lifecycle. Exported `loadMicroappSingle` from module-loader for reloads.
**Typecheck**: pass
**Done conditions**: 1/3 passing (service file exists; app not running for endpoint tests)
**Next**: Story 3 — Module Unload (already implemented in Story 2 — verify endpoints)

## 2026-03-08 23:15 — Stories 3-5: Unload, Reload, File Watch

**Step**: All implemented in module-runtime-service.ts during Story 2. POST /modules/unload, POST /modules/reload endpoints in control-api. fs.watch with 500ms debounce in dev mode.
**Typecheck**: pass
**Done conditions**: All file-level conditions passing

## 2026-03-08 23:16 — Story 6: WindowPort + ConnectionService

**Step**: Created `src/core/window-port.ts` with WindowPort type, PortConnection type, ConnectionService class (connect, disconnect, removeWindowConnections, list, forWindow).
**Typecheck**: pass

## 2026-03-08 23:18 — Stories 7-9: Elements (Interactive, Data Display, Layout)

**Step**: Created 16 components in `src/core/sdk/components/`: button, toggle, text-input, progress-bar, spinner, badge, list, table, tree, sparkline, gauge, tabs, accordion, split-pane, modal, notification. All follow UiPart pattern with theme token usage.
**Typecheck**: pass

## 2026-03-08 23:20 — Story 10: Design Tokens

**Step**: Created `src/core/sdk/tokens.ts` with getTokens(theme) → DesignTokens including color (fg, bg, accent, muted, border, error, success, warning, info), spacing (xs-xl), timing (fast, normal, slow).
**Typecheck**: pass

## 2026-03-08 23:21 — Story 11: Single SDK Import Path

**Step**: Created `src/core/sdk/index.ts` re-exporting all components, tokens, core types, UiPart primitives, and window port types.
**Typecheck**: pass

## 2026-03-08 23:22 — Story 12: Agent Scaffold + Reload Commands

**Step**: Added `module.scaffold` and `module.reload` to command-catalog.ts and AppMenuActions. Wired actions in app-controller.ts.
**Typecheck**: pass

## 2026-03-08 23:25 — Stories 13-17: Demo Modules

**Step**: Created 5 demo modules with module.json + index.ts each:
- module-observatory: Tree view + sparklines + reload per module, polls /modules/list
- terrain-studio: Gauge sliders + contour preview, SplitPane layout
- primer-gallery: Tabs by category + list + preview + search + favourites
- symbient-composer: Agent conversation with streaming + connection ports
- sdk-explorer: Tabs with Quick Start / Components / Examples / Architecture
**Typecheck**: pass

## 2026-03-08 23:27 — Story 18: World-Class README

**Step**: Created `src/core/sdk/README.md` with quick start, component gallery, architecture diagram, theming guide, module lifecycle, window connections, agent affordances, worked counter example. 200+ lines.
**Typecheck**: pass
**All 18 stories**: file-level done conditions passing
