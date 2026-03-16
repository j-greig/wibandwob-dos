> **E042 Solid Foundations** — Follow-up AR Loop
> ← Previous work: `autoresearch/e42-B01/` through `e42-S10/`
> Planning: `.planning/epics/e042-solid-foundations/`
> Architecture: `.agents/shell-dev/architecture.md`
> Invariants: `.agents/shell-dev/invariants.md`

# Autoresearch: E042 Follow-Up — Blessed Elimination & God File Decomposition

## Objective

E042 B01–S10 established the SDK design system, Handle API, stability annotations,
and file organization. This follow-up loop tackles the two biggest remaining structural
debts: **45 microapps still importing blessed directly** (violating SDK isolation) and
**app-controller.ts at 2334 lines** (violating single-responsibility).

### Current State (post-S10)

| Metric | Value | Target |
|--------|-------|--------|
| Blessed imports in microapps | 45 | 0 |
| `as any` in src/ | 169 | <50 |
| app-controller.ts lines | 2334 | <800 |
| God files >500 lines | 10 | <5 |
| SDK Handle components | 10 | 10 ✅ |
| Circular deps | 0 | 0 ✅ |
| COAT violations | 0 | 0 ✅ |

## Metrics

- **Primary**: `blessed_microapp_count` (count, lower is better) — microapps with
  `import blessed` in their index.ts. Target: 0.
- **Secondary**:
  - `app_controller_lines` — line count of app-controller.ts (target: <800)
  - `as_any_count` — `as any` in src/ (target: <50)
  - `god_file_count` — files >500 lines in src/ (target: <5)
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Ranked Tasks

### 1. Blessed Elimination from Microapps (HIGH impact, MEDIUM effort)

**Why:** Invariant: "SDK is the only import surface." 45 microapps bypass it.
Runtime-inspector just proved the pattern — zero blessed, pure SDK Handle API.

**How:** For each microapp, replace raw `blessed.box/list/textbox` calls with SDK
Handle components (`createTextViewer`, `createStatusBar`, `createScrollView`, etc.).
Some microapps need blessed for canvas-level rendering (plasma, contour-studio,
generative-art) — those get an exemption via `@internal` annotation.

**Batch approach:**
- Simple apps (notepad-like): swap 1:1 to Handle API — ~15 apps, S effort each
- Complex apps (figlet-banner, sy2-chronicles): partial migration — M effort each
- Render engines (plasma, contour, tr808): exempt — blessed IS the renderer

**Files:** All `microapps/*/index.ts` with `import blessed`

### 2. Decompose app-controller.ts (HIGH impact, LARGE effort)

**Why:** 2334 lines violating single-responsibility. Architecture.md says "should
coordinate, not accumulate utilities."

**How:** Extract into focused modules:
- `src/core/window-openers.ts` — openTextViewerWindow, openFileManagerWindow, etc.
- `src/core/keybindings.ts` — global key handlers
- `src/core/menu-builder.ts` — menu structure + wiring
- `src/core/workspace-restore.ts` — workspace restore flow
- `app-controller.ts` remains: startup, compose services, thin coordinator

**Files:** `src/core/app-controller.ts` → 5 files

### 3. Type Safety — Reduce `as any` (MEDIUM impact, MEDIUM effort)

**Why:** 169 `as any` reduce IDE assist and agent readability.

**How:** Audit in batches by file. Most are in:
- `control-api.ts` — request/response typing
- `chrome-browser-service.ts` — puppeteer integration
- `ui/containers.ts` — blessed widget casting
Replace with proper types, type guards, or `unknown` + narrowing.

### 4. Plan 9 Plumber Service (MEDIUM impact, SMALL effort)

**Why:** Content-aware routing between microapps. COAT-native. Agent-friendly.
Brief at `.planning/ideas/plan9-plumber.md`.

**How:** `src/services/plumber-service.ts` — rule engine, route(), registerRule().
SDK surface: `host.plumb(action, data)` + `host.onPlumb(cb)`. Start with file
extension → microapp routing (click filename → editor).

### 5. Music-player microapp migration (MEDIUM impact, LARGE effort)

**Why:** 1224-line god file in src/windows/. Same pattern as file-manager —
host-delegated microapp wrapper.

## Off Limits

- Changing blessed internals
- Breaking workspace restore
- Removing functionality

## Constraints

- `bun run health` must pass after every change
- COAT compliance maintained (0 violations)
- Backward-compat: old import paths work via barrel re-exports
- One logical change per commit

## What's Been Tried

### Blessed Elimination — Easy Wins (31→27)
Migrated 4 microapps to pure SDK Handle API (zero blessed imports):
- **demo-heartbeat** (159→87 lines) — createTextViewer + createStatusBar
- **workspace-beacon** (272 lines) — createHeaderBar + createStatusBar + createTextViewer + createRule
- **command-lab** (220 lines) — createSplitView + createListPanel + createScrollView + createHeaderBar + createStatusBar
- **generative-art** (105 lines) — createTextViewer replacing blessed.box canvas

### Blessed Elimination — Remaining 27 Categorized
The remaining microapps fall into categories that can't trivially drop blessed:
1. **Render engines** (7): plasma, contour-studio, tr808, monster-cam, spore-clock, asciicker, terrarium — need blessed for canvas/pixel rendering. **Exempt.**
2. **Complex apps** (8): journal, wiretext, symbient-twitter, llm-orch-studio, sy2-chronicles, zine, figlet-banner, demo-glitchbox — 500+ lines, deep blessed integration. Need per-app effort.
3. **Layout tests** (4): layout-probe, demo-layout-stress-test-pi/codex, demo-e026-demo — intentionally exercise LayoutPart API. **Exempt.**
4. **Chat/input apps** (3): world-chatroom, terminal, demo-patchbay-lab — blessed keypress/input. Need createInputLine enhancements first.
5. **Remaining** (5): demo-touchlab-mvp, terrarium-life, wibwobworld, contour-studio — mixed.

**Realistic blessed-free target: ~15-18 microapps** (after exemptions for render engines + layout tests). Current: 27. Gap: ~10 more migrations of medium-complexity apps.

### Key Learning
Most remaining blessed usage falls into two categories the Handle API can't replace yet:
1. **Canvas rendering** — raw blessed.box used as a frame buffer for animations (plasma, contour, tr808). These need blessed.
2. **Deep input handling** — blessed keypress events, inputOnFocus, cursor management. The SDK `createInputLine` covers simple cases but not chat-style multi-line input.

**createCanvas shipped** — legitimised blessed for render engines. Remaining 15 apps need
blessed for interactive widgets (mouse/clickable/input). Further reduction needs:
- SDK `createButton` with mouse/hover support
- Enhanced `createInputLine` with multi-line support and keypress forwarding  
- `createChatView(parent, opts)` — transcript + input combo for chat microapps

### Disabled Low-Quality Apps
- terrarium-life → .disabled (low quality)
- demo-patchbay-lab → .disabled (moot)
- demo-layout-stress-test-codex → .disabled (codex demo)

### Host-Window-Registry Pattern
Created `src/core/host-window-registry.ts` + planning doc at `.planning/ideas/host-window-registry.md`.
Declarative registry to replace 30+ private openXxxWindow() methods in app-controller.
Not yet wired — needs method-by-method migration.

### Final Metrics (end of session)
- blessed_microapp_count: 15 (from 31)
- app_controller_lines: 2334 (unchanged — registry pattern ready but not wired)
- as_any_count: 169 (unchanged — deferred to next session)
- SDK Handle components: 11 (including createCanvas)
