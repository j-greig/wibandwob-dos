# BUILD — Master Checklist

Single source of truth for outstanding TS TUI build work.
Update checkboxes here as work lands. Do not maintain parallel trackers.

Architecture reference: `.planning/refactor-docs/020-target-architecture.md`
Legacy C++ handover: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/`

Rules:
- Work top-down through tiers. Items near the top unblock items further down.
- When an item becomes blocked or deprioritised, move it to the Parking Lot
  with a note explaining why.
- Parking lot items can be promoted back when conditions change.

## Tier 1 — Substrate (do first)

- [x] **Default workspace boot**
  Restore `scratch/workspaces/default.json` on launch, optional last-used pointer, if no workspace exists then workspace is empty.
  Status: landed

- [x] **Window manager hardening**
  Fix repaint/shadow invalidation, drag/release bugs, z-order correctness, stale cell cleanup, resize sanity.
  Status: landed — app-owned shadows (offset 2E 1S, themed, synced on drag/resize/move/close), blessed shadow:true permanently replaced. Resize signals content, coordinate fix, drag click suppression, titlebar/close overlap fix. Remaining edge case: drag-disappear on fast moves (low priority).
  Spec: `.planning/refactor-docs/015-window-manager-reference-and-repair-plan.md`

- [x] **Controller extraction — backrooms + agent + terminal**
  Extract remaining Backrooms, agent, and terminal window construction out of `app-controller.ts`.
  Status: landed — backrooms extracted to backrooms-windows.ts (649 lines). Controller now 1013 lines, only shell chrome construction remains. No window createFrame calls left in controller.
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/004-window-type-registry-and-factories.md`

## Tier 2 — Command and state surface

- [x] **Command registry completion**
  Collapse remaining bespoke command paths into one registry with typed execution contracts.
  Status: landed — menu-config.ts collapsed into command-catalog.ts, AppMenuActions now single-sourced. All commands defined once in catalog, projected to menus/palette/API/agent. ~15 bespoke /view/*/open API routes remain as convenience aliases (functional but redundant with /commands/run).
  Spec: `.planning/refactor-docs/018-command-registry-and-tool-adapter-prd.md`
  Also: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/006-command-registry-and-ipc-protocol.md`

- [x] **Context-sensitive menus**
  Finish static contextual menu filtering. Dynamic top-level categories only later.
  Status: landed — context menus are registry-driven with windowKind filtering and enabled predicates. Top-level menus remain static (File/Edit/View/Window/Applications). Phase 2 (dynamic top-level categories) is deliberately deferred.
  Spec: `.planning/refactor-docs/019-context-sensitive-menu-bar-prd.md`

- [ ] **Typed window/state/snapshot contracts**
  Move payloads from `Record<string, unknown>` toward discriminated unions or runtime-validated schemas. Modules own their own serialize/restore. 14 window kinds to type. Medium refactor, no runtime behaviour change.
  Status: partial — deferred to parking lot for now, promotes back when snapshot round-trip bugs surface.
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/window-facade-full-review.md`

## Tier 3 — Appearance and rendering

- [x] **Appearance and theme system**
  Implement theme types, resolver, and variants. Semantic tokens, live switching, remove inline colour literals.
  Status: landed — 5 themes (dark, nord, pastel, phosphor, light) cycling live via Alt+T / menu / API. Theme picker (Choose Theme...) and `app.set_theme` API command for direct selection. Workspace theme persistence (v2 envelope). Themed overlays, shadows, desktop fill, menus, context menus, status line. `safeSetStyle` helper handles blessed sub-styles. Fleet audit: 35 windows x 5 themes verified. Remaining: expose theme in `/state` endpoint.
  Epic: `.planning/epics/e014-theme-system/EPIC.md`
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/008-theme-system-and-desktop-rendering.md`

- [ ] **Unicode/cell-aware text rendering**
  Replace fragile string repaint for complex Unicode with a shared text-to-cells path.
  Status: not-started — deferred. Shadow disable fixed the main stale cell source. Remaining glitches are emoji-specific (2 files use string-width). Low priority until more content surfaces demand it.
  Spec: `.planning/refactor-docs/021-unicode-cell-rendering-follow-on.md`

## Tier 4 — Content and browser surfaces

- [x] **Content measurement consistency**
  Use shared measurement consistently on open for primers/text/figlet/other content-aware surfaces.
  Status: landed — all content viewers (primers, text, figlet) go through measureContent(). App-type windows (backrooms, browser, companion) use fixed sizes correctly. No dual measurement paths remain.
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/001-primer-dimensions-and-agent-sizing.md`

- [x] **Browser/document/text rendering**
  Finish cleaning document reader/browser/file-manager/text rendering on shared measurement and repaint.
  Status: landed — all surfaces extracted to dedicated window files, themed, using shared measurement. Spec was C++ handover; TS equivalents are built.
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/010-browser-and-text-rendering.md`

## Tier 5 — Agent surface

- [x] **Agent surface convergence**
  Continue converging on native agent window + shared command/state tools. Remove stale assumptions.
  Status: landed — agent-tools (476 lines), agent-session (543 lines), agent-window (345 lines) all exist, themed, registry-backed tools. One minor legacy fallback path remains in session.
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/spk-agent-window-enhancement.md`
  Also: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/005-llm-integration-and-claude-sdk-bridge.md`

## Tier 6 — New subsystems (defer until shell is boring)

- [ ] **Animation subsystem**
  Build `animation-service.ts` + `animation-windows.ts`. Frame source, playback, live generators, overlay composition.
  Status: not-started
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/011-games-and-generative-art.md`
  Also: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/016-terminal-kit-screenbuffer-animation-spike.md`

- [ ] **Terminal subsystem**
  Build `pty-session.ts`, `terminal-buffer.ts`, `terminal-renderer.ts`, `terminal-windows.ts`. Only after shell/paint/contracts are boring.
  Status: not-started
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/007-terminal-emulator.md`
  Also: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/terminal-native-research.md`

- [ ] **Event/persistence/multi-instance model**
  Re-spec and implement modern TS-native event/persistence/multi-instance behaviour.
  Status: not-started
  Spec: `.planning/epics/e002-ts-tui-root-migration/legacy-docs/013-events-persistence-and-multi-instance.md`

## Tier 7 — Testing

- [x] **Contract tests**
  Add `src/tests/` with: `command-registry.test.ts`, `state-service.test.ts`, `workspace-snapshots.test.ts`, `window-manager.test.ts`.
  Status: partial — 11 tests passing (command registry, state service, theme cycle, screenshot text). Fleet test script. Text screenshot API. Remaining: workspace round-trip, parity audit automation, golden file baselines.

## Parking lot

Items not on the critical path. Move blocked or deprioritised checklist items
here with a note. Promote back when conditions change.

- **`pi-theme-adapter.ts`**: was in Tier 3 theme system. Pi theme import/export is an integration adapter, not needed until the native theme system exists and an external format needs bridging. Promote back after appearance-service lands.
- **Primer dims header**: add `# dims: 68x22` to primer files to skip full measurement scan (~14s across 197 files)
- **tmux-launch rewrite**: replace C++/API era launcher with TS-native tmux harness
- **CI and contract tests**: rebuild C++ era contract test patterns in TS against the new API surface
- **WindowRecord shape**: optional fields still grow per type — refactor to discriminated union
- ~~**28 hardcoded blessed style literals**~~: done — all surfaces now use theme tokens
- **Parity audit**: 8 window kinds untested (figlet, pattern, inspector, workspace, chrome-browser, wibwob-agent, backrooms-tv, reader). Need automated test that catches missing appType/summary.
- **Double-line fix audit**: setViewportContent scrollbar fix landed for primers. Audit gallery preview, editor, file manager for same bug.
- **Proportional layout**: derive viewport width from window evidence, never absolute cols. Dual-monitor blessed reports combined width.
- **Theme in /state**: expose active theme name in desktop state endpoint

## History

This file absorbs and supersedes:
- Outstanding Build Work table from `.planning/refactor-docs/020-target-architecture.md`
- Epoch 3 items from `.planning/.trash/refactor-epoch-plan.md`
- Parking lot items from `.planning/.trash/refactor-epoch-plan.md`
