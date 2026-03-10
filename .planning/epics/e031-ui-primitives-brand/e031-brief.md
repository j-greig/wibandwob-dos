---
id: E031
title: Shared UI Primitives + Brand Nomenclature
status: in-progress
issue: ~
pr: ~
depends_on: []
branch: epic/e031-ui-primitives-brand
---

# E031 — Shared UI Primitives + Brand Nomenclature

> TL;DR: Two parallel problems.
> 
> First: the app has ~10 categories of
> duplicated raw-blessed construction across 30+ files — sidebars, restyle
> hooks, list widgets, search overlays, status bars. Extract each pattern
> once into ui-parts.ts, export via SDK, migrate every consumer.
> 
> Second: the system presents itself as a jumble of generic names, dev
> jargon ("Demo", "MVP", "Inspector"), and inconsistent conventions. Audit
> every user-facing string, module ID, API endpoint, and internal type name.
> Make it feel like a single bespoke WibWob-DOS system, not an accretion
> of random decisions.

---

---

## Pattern catalogue

Severity: HIGH = 3+ occurrences, complex, confirmed bugs.
MEDIUM = 2–3, moderate. LOW = minor.

### P01 — Sidebars — HIGH

Six modules build sidebars from raw blessed boxes. Three different width
policies. Zero overflow guards. Two confirmed overflow bugs.

| Consumer | Side | Width policy | Toggle | Bug |
|----------|------|-------------|--------|-----|
| patchbay-lab | left | clamp(32%, 24, 36) | mode-gated | none confirmed |
| world-chatroom | right | fixed 26 | none | overflow at narrow width |
| wibwobworld | right | max(14, w/6) | i key | overflow at small window |
| wibwob-tidepool | right | fixed 26 (in TWO files) | none | latent drift |
| zine | left | fixed 26 + divider | [ key | none |
| scene-layout | both | 30% (geometry only) | N/A | — |

### P02 — frame.focus boilerplate — HIGH

23 occurrences in src/windows/. Every window hand-wires the identical
focusWindow + widget.focus() pair. Only the target widget varies.
Should be frame.setFocusTarget(widget) so windows declare not imperative-wire.

Files: content-windows.ts (×4), backrooms-log-browser-window.ts,
chrome-browser-window.ts, figlet-windows.ts, misc-windows.ts (×6),
scramble-window.ts (×2), terrain-lab-window.ts, contour-window.ts,
wibwob-agent-window.ts, monster-cam-window.ts, markdown-viewer-window.ts,
music-player-window.ts, plasma-window.ts.

### P03 — frame.onRestyle boilerplate — HIGH

24 occurrences in src/windows/. Every restyle hook hand-rolls safeSetStyle
per widget with inline theme token lookup. No shared convention; some windows
miss widgets leaving stale colours on theme switch.
Should be createRestyleBundle(entries) so coverage is declarative and complete.

Files: content-windows.ts (×4), backrooms-log-browser-window.ts,
chrome-browser-window.ts, figlet-windows.ts, misc-windows.ts (×6),
scramble-window.ts (×2), terrain-lab-window.ts, contour-window.ts,
wibwob-agent-window.ts, plasma-window.ts, text-windows.ts.

### P04 — Raw selectable list — HIGH

14 blessed.list() constructions across src/windows + modules + core. Every
one repeats keys:true, vi:true, mouse:true, scrollbar, scrollable. Style
tokens applied inline — none use scrollableStyle(). Three inside
overlay-manager.ts are already centralised; the other 11 are scattered.
Primitive: createSelectableList(parent, opts) with scrollableStyle() baked in.

### P05 — Raw status bar — HIGH

13 raw blessed.box status bars vs 7 using the createStatusBar SDK primitive.
Six bypass the primitive: music-player-window.ts, monster-cam-window.ts,
scramble-window.ts (×2), markdown-viewer-window.ts,
backrooms-log-browser-window.ts. All six hand-roll identical height:1 chrome.
Migrate-only. No new primitive needed.

### P06 — Inline search overlay — MEDIUM

Two modules build an identical bottom-of-window search overlay from scratch:
modules/zine/index.ts:568 and modules/sy2-chronicles/index.ts:2343.
Both: blessed.box at bottom, blessed.textbox inside, Escape/Enter handling,
show/hide by destroy+recreate. Should be createInlineSearch(parent, opts).

### P07 — Raw toolbar / header box — HIGH (promoted from MEDIUM)

13 raw blessed.box toolbar/header constructions not using createHeaderBar.
All share: height:1, top/bottom anchor, tags:true, inline button strings.
content-windows.ts (tab bar :140, filter bar :148), backrooms-windows.ts,
chrome-browser-window.ts, music-player-window.ts, zine sidebar buttons,
sy2-chronicles toolbar (imports createButtonBar directly, not via SDK).
Migrate-only for most; SDK import path fix for sy2-chronicles.

### P08 — Vi scroll key bindings — MEDIUM

Repeated j/k/g/G/d/u key registration across 6+ windows with custom
scrollable boxes. Blessed lists handle vi with vi:true — duplication is
only in non-list scrollable boxes. Helper: bindScrollKeys(widget, box).

### P09 — Empty state strings — LOW

Scattered inline strings: "No primer selected.", "No matches found.",
"No file selected.", "(empty)", "(no message)". Extract to
src/core/empty-states.ts constants. No blessed primitive — string constants
only. Slot into F05 cleanup pass.

### P10 — Inline textbox input prompt — LOW

music-player-window.ts:240 hand-rolls a blessed.textbox for file input.
Migrate to overlays.openValuePrompt. Migrate-only.

---

### W01 — Split-pane ratio magic numbers — MEDIUM

Hardcoded 34%/36% list-to-preview split ratios appear 10 times inside
content-windows.ts (:152, :162, :176, :585, :594, :605, :638, :1010, :1011,
:1012). No shared constant. If the ratio changes one instance drifts.
Extract: PREVIEW_SPLIT_RATIO = 0.34 constant at top of file.

### W02 — Mode-key routing duplicated between list and icon view — MEDIUM

content-windows.ts has two key-handler blocks (list view :1082 and icon view
:1254) that duplicate the same 5 command branches: v, slash, s, backspace,
tab. If a key is added to one it must be manually mirrored in the other.
Extract a shared dispatchFileManagerKey(mode, key) function.

### W03 — Deferred preview-update setTimeout(0) — MEDIUM

Three windows use setTimeout(..., 0) to defer a preview/content update after
a list selection event: content-windows.ts :266, :1133 and
backrooms-windows.ts :257. The pattern is identical — force a blessed render
tick before updating preview content. Should be a named helper
deferRender(fn) so the intent is clear and the magic 0 is in one place.

### W04 — Close-key wiring inconsistent — MEDIUM

Five windows wire close keys in different ways:
  markdown-viewer-window.ts :182 — .key(["q"], closeWindow)
  backrooms-log-browser-window.ts :235 — .key(["q", "escape"], close)
  monster-cam-window.ts :155 — .key(["q", "escape"], closeWindow)
  music-player-window.ts :233 — .key(["q"], closeWindow)
  monster-cam-window.ts :62 — escape only, no q
Some use frame.close(), some use windowManager.closeWindow(id). No
consistent pattern. Should be a single bindCloseKeys(widget, frame)
helper that always wires both q and Escape to windowManager.closeWindow.

### W05 — initialPos restore block verbatim duplicate — LOW

Two windows copy-paste the identical 4-line restore block:
  wibwob-agent-window.ts :38
  scramble-window.ts :135
Both do: frame.frame.top/left/width/height = initialPos.*
Extract to applyInitialPos(frame, pos) helper.

### W06 — Clamp math repeated — LOW

Math.max(0, Math.min(...)) inline clamp appears 7 times across text-windows.ts
and content-windows.ts. ui-primitives.ts already has a clampSize() function
that is private. Export it or add a clamp(value, min, max) to ui-primitives.ts
and replace inline occurrences.

### C01 — Overlay split-browser prompt duplicated internally — MEDIUM

overlay-manager.ts has two full implementations of the same split-pane search
modal shell: openBrowserPrompt (:326) and openFileBrowserPrompt (:534). Both
re-implement focusSearch (:455/:709), jumpToLetter (:461/:696), search keypress
(:477/:721), and list keypress (:508/:751). Extract a private
createSearchListPreviewOverlay() returning { modal, searchBox, list, preview,
close } and let both public methods use it.

### C02 — Overlay input prompt lifecycle duplicated — LOW

openValuePrompt (:50) and openPathPrompt (:117) duplicate the modal/input/
button-bar lifecycle — closePrompt/submitValue at :76/:163 and :83/:173.
They differ only in completion behaviour. Extract shared private
openTextInputPrompt({ onSubmit, completion? }).

### C03 — Shadow rendering duplicated with magic offsets — MEDIUM

Shadow creation and sync logic is duplicated across window-manager.ts (:81,
:591) and menu-overlay-manager.ts (:238, :256). Both use hardcoded +2/+1
offsets and identical char-fill logic with no shared constant or helper.
Extract SHADOW_X_OFFSET=2, SHADOW_Y_OFFSET=1 constants and a shared
syncShadowRect(shadow, frame) helper into window-chrome.ts.

### C04 — Theme tokens bypassed in overlays — MEDIUM

overlay-manager.ts has 22 hardcoded fg/bg color literals in prompt style
blocks (:342, :350, :360, :398, :553, :568, :578, :601, :610 and more).
All other core surfaces use theme() resolver tokens. Overlays are immune
to theme switching. Migrate overlay prompt styles to theme().body,
theme().selected, theme().highlight etc.

### C05 — createHeaderBar and createStatusBar near-identical — LOW

ui-parts.ts :259 and :301 — the two functions differ only in prop type and
default left inset. The render/layout/restyle implementation is copy-pasted.
Extract a shared private createAlignedBarPart() and let both call it.

### C06 — command-catalog boilerplate — LOW

62 command entries repeat api:true, agent:true as explicit fields. Could be
defaulted to true with explicit opt-outs. The four window-by-id commands
(focus, move, resize, close) share identical shape and could use a
windowByIdCommand() local builder to remove copy-paste.

### C07 — Near-identical types in types.ts — LOW

Three duplication clusters:
  PrimerGroup and GalleryTab (:51 and :56) — same {label, entries} shape
  DragState and ResizeState (:320 and :329) — same {windowId, startX, startY} base
  WindowSnapshot and DesktopWindowState (:94 and :172) — overlapping geometry fields
Extract shared base types: LabeledEntries, PointerDragBase, WindowGeometry.

### M01 — Raw setInterval bypassing createTimer SDK — MEDIUM

Four modules use raw setInterval/clearInterval instead of the SDK createTimer:
  wibwob-poetry-clock/index.ts :115, :124, :501, :504
  touchlab-mvp/index.ts :747, :800
  glitchbox/index.ts :419, :420 (partial — mixes raw and SDK)
Other modules (sy2-chronicles, zine, e026-demo) correctly use createTimer +
clearTimers. Inconsistent teardown means leaks on window close if the module
does not manually call clearInterval in its cleanup. Migrate all to createTimer.

### M02 — appType values inconsistent across modules — MEDIUM

appType strings use three different formats:
  "glitchbox"         — bare name (glitchbox)
  "wibwob.tidepool"   — dot namespaced (tidepool)
  "sy2-chronicles"    — hyphenated (sy2-chronicles)
  "wibwob.zine"       — dot namespaced (zine)
appType drives workspace restore — drift here causes silently broken restores.
Normalise to wibwob.slug to match the module ID convention from N02/S00b.
Files: glitchbox/index.ts :532, wibwob-tidepool/index.ts :331,
sy2-chronicles/index.ts :2097/:2159/:2504, zine/index.ts :887.

### M03 — Modules importing directly from src/core/ bypassing SDK — MEDIUM

Three modules reach past the SDK into src/core/ directly:
  e026-demo/index.ts :31 — imports createTreeWidget from src/core/tree-widget
  e026-demo/index.ts :32 — imports createTimer from src/core/ui-primitives
  zine/index.ts :31 — imports createTimer from src/core/ui-primitives
  zine/index.ts :32 — imports createButtonBar from src/core/ui-parts
  sy2-chronicles/panel-types.ts :15 — imports paintLines from src/core/grid-canvas
These should go through microapp-sdk.ts. Missing SDK exports need adding.
Leaky imports mean modules break if core file paths change.

### M04 — Single-instance open guard only in glitchbox — LOW

Only glitchbox.ts :246 has an explicit "if already open, focus and return"
guard. Other modules (wibwob-tidepool, wibwobworld, patchbay-lab, zine)
open a second window without checking. Inconsistent — some surfaces should
be singletons. The SDK has no focusOrCreate() helper. Add one.

---

## Nomenclature audit

The system presents itself inconsistently. User-facing strings, module IDs,
API endpoints, and internal types all follow different conventions set by
different contributors at different times. The result feels like a toolkit,
not an OS.

### N01 — Command label inconsistency — HIGH

Three conflicting label conventions in command-catalog.ts:

Convention A (most common): "Open X" prefix
  "Open Chrome Browser", "Open Wib&Wob Agent", "Open Gallery", "Open Markdown..."

Convention B: bare noun / verb
  "Monster Cam", "Music Player", "Terrain Lab", "Contour Studio", "Cascade Windows"

Convention C: namespaced
  "Finder: Search Files", "Scramble: meow", "Scramble: expand/collapse"


### N02 — Module ID inconsistency — MEDIUM

Module IDs use three different separator conventions:
  Dot-namespaced: wibwob.tidepool, wibwob.poetry-clock, wibwob.glitchbox,
                  touchlab.mvp, patchbay.lab, example.hello-world
  Pure hyphen: world-chatroom (no namespace)
  No separator: wibwobworld

Developer names leaking into IDs: touchlab.mvp, wibwob.e026-demo, example.hello-world


### N03 — API endpoint inconsistency — MEDIUM

Current endpoint shape is a mix of three patterns:
  /view/X/open — opening windows (mostly consistent, good)
  /scramble/... — own namespace (good, should be the pattern for all subsystems)
  /world-chat/... — hyphenated resource name
  /windows/... — plural resource

Problems:
  /view/companion/smol — "smol" is internal slang, not a public API verb
  /view/inspector/open — "inspector" is dev jargon
  /view/browser-reader/open — double noun
  /view/wibwob-agent/open — "wibwob" is redundant in a WibWob-DOS API
  /view/art/open — too generic
  /view/companion/open and /view/companion/smol — mixed verbs

### N04 — WindowKind type values — LOW

WindowKind union contains a mix of naming styles:
  Simple: "primer", "editor", "browser", "art", "chat"
  Hyphenated: "terrain-lab", "monster-cam", "markdown-viewer"
  Full phrase: "markdown-viewer" (should just be "reader" or "markdown")

The values must match window registration and workspace restore — renames
require careful migration. Low priority but worth a single cleanup pass.

### N05 — Internal file names — LOW

src/windows/misc-windows.ts — "misc" is a smell. Contents should be split
or renamed to reflect what is actually in there.
src/windows/content-windows.ts — very generic. The file contains primer
browser, gallery, file manager, and finder. Should be split or renamed.

---

## What already exists (do not duplicate)

ui-parts.ts exports: createStack, createColumns, createHeaderBar,
createStatusBar, createTextBlock, createInputLine, createMessageHistory,
createRule, createFigletDisplay, createAnimatedPanel, createCollapsibleBlock,
createContentStack, createButtonBar.

ui-primitives.ts exports: createScrollbar, scrollableStyle, safeSetStyle,
isRightClick, createTimer, clearTimers.

New primitives go into ui-parts.ts only. Migrate-only items need no new code.

---

## Build order

### F00 — Brand naming, pure strings (N01, N02) — SHIP FIRST

Zero logic risk. Touches only command-catalog.ts string literals and
module.json ID fields. Cannot break windows, overflow sidebars, or corrupt
workspace state. Ships as a single PR before any primitive migration begins.
Gives every subsequent story a system that already looks intentional.

#### S00a — Command label rename (N01)

Apply the WibWob-DOS label convention to command-catalog.ts:
  - Bare Title Case. No "Open" prefix. No redundant "Window".
  - "..." only when a prompt fires before anything opens.
  - Subsystem colon prefix for groups of 3+ commands.
  - No dev jargon.

Rename table:
  "Open Wib&Wob Agent"            → "Wib&Wob Agent"
  "Open Chrome Browser"           → "Web Browser"
  "Open Gallery"                  → "Gallery"
  "Open File Manager"             → "File Manager"
  "Open Figlet Banner"            → "Figlet Banner"
  "Open Generative Art Demo"      → "Generative Art"
  "Open State Inspector"          → "State Inspector"
  "Open §y² Chronicles"           → "§y² Chronicles"
  "Pattern Window"                → "Plasma Patterns"
  "Plasma Screensaver"            → "Plasma"
  "Plasma from Primer"            → "Plasma: From Primer"
  "Smear Text Surface"            → "Smear Surface"
  "Document Reader"               → "Reader"
  "View README"                   → "README"
  "Backrooms TV..."               → "Backrooms: Live TV"
  "Backrooms Log Browser"         → "Backrooms: Log Browser"
  "Open Backrooms TV (with args)" → remove (internal/debug)
  "Scramble (floating)"           → "Scramble: Floating"
  "Scramble (popup)"              → "Scramble: Popup"

AC: All labels updated in command-catalog.ts. Menu and palette display
correct. bun run typecheck clean.

#### S00b — Module ID normalisation (N02)

Establish: every production module ID is wibwob.slug (dot + lowercase-hyphen).

  world-chatroom      → wibwob.chatroom
  wibwobworld         → wibwob.world
  patchbay.lab        → wibwob.patchbay
  touchlab.mvp        → wibwob.touchlab
  example.hello-world → wibwob.example.hello
  wibwob.e026-demo    → wibwob.example.e026

Module display titles unchanged — only ID slugs change.
AC: All module.json IDs updated. Module reload via command still works.
State service returns correct IDs. GET /state shows new IDs.

---

### F01 — Sidebar primitive (P01)

#### S01 — createSidebarPanel in ui-parts.ts
```typescript
interface SidebarPanelOptions {
  parent: blessed.Widgets.BoxElement;
  side: "left" | "right";
  width: { fixed: number } | { percent: number; min?: number; max?: number };
  divider?: boolean;       // default true
  open?: boolean;          // default true
  mainMinWidth?: number;   // default 12, overflow guard
  style?: { sidebar?; main?; divider? };
}
interface SidebarPanel {
  main: blessed.Widgets.BoxElement;
  sidebar: blessed.Widgets.BoxElement;
  divider?: blessed.Widgets.BoxElement;
  toggle(): void;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  layout(): void;
  sidebarWidth(): number;
  mainWidth(): number;
}
```
Width resolution: fixed | clamp(floor(total*pct), min, max).
Overflow guard: if resolved + divider + mainMinWidth > total, shrink sidebar.
Export via microapp-sdk.ts.
AC: typecheck clean. Unit test for width resolution edge cases.

#### S02 — Unit tests for width resolution
Fixed at various sizes. Percent with min/max. Overflow guard fires correctly.
Zero-width edge case. AC: bun test passes.

#### S03 — Migrate world-chatroom
Fixed 26, right, no toggle. Overflow bug fixed at narrow widths.

#### S04 — Migrate ZINE
Fixed 26, left, [ toggle. Canvas geometry updates correctly.

#### S05 — Migrate WibWobWorld
Percent 1/6 min 14, right, i toggle, mode-aware setOpen.
Overflow bug fixed.

#### S06 — Migrate Patchbay Lab
Percent 32% clamp 24–36, left, mode-gated via setOpen.

#### S07 — Tidepool: shared sizing constant
Single constant imported by both renderer.ts and index.ts. Full primitive
migration deferred until renderer uses blessed nodes.

#### S08 — Remove dead sidebar code
BLOCKED ON: S03–S07 all smoke-tested.
grep for manual sidebar patterns returns zero results.

---

### F02 — Selectable list + toolbar (P04, P07)

These are grouped because both affect the same consumer files — doing them
together means one restyle sweep per file, not two.

#### S09 — createSelectableList in ui-parts.ts
Wraps blessed.list with keys:true, vi:true, mouse:true, scrollableStyle().
Returns typed handle: setItems, selected, onSelect callback. Export via SDK.

#### S10 — Migrate raw blessed.list calls outside overlay-manager
content-windows.ts (×3), backrooms-log-browser-window.ts,
backrooms-windows.ts, zine module. Leave overlay-manager.ts untouched.

#### S11 — Migrate raw toolbar/header boxes to createHeaderBar (P07)
content-windows.ts (tab bar, filter bar), backrooms-windows.ts,
chrome-browser-window.ts, music-player-window.ts.
Fix sy2-chronicles to import createButtonBar via SDK not direct path.

---

### F03 — Inline search overlay (P06)

#### S12 — createInlineSearch in ui-parts.ts
createInlineSearch(parent, { placeholder, onSubmit, onCancel }) →
{ open(), close(), isOpen() }.
Bottom-anchored, textbox inside, Escape cancels, Enter commits.
Export via SDK.

#### S13 — Migrate zine and sy2-chronicles
Replace openSearchPrompt() in both with createInlineSearch.

---

### F04 — Focus + restyle (P02, P03)

NOTE: S14 touches window-manager/facade (a core type). S15 touches
ui-parts. Ship as separate PRs to keep diffs clean.

#### S14 — frame.setFocusTarget(widget) on WindowFacade
Encapsulates the 23 identical frame.focus boilerplate blocks.
Behaviour not data — belongs on WindowFacade not WindowRecord.
All 23 callers migrate to a single line.

#### S15 — createRestyleBundle in ui-parts.ts
createRestyleBundle(entries: Array<[widget, () => Style]>) → { restyle() }.
Windows: frame.onRestyle = bundle.restyle.
Declarative coverage guarantees no missed-widget restyle bugs.
Migrate the 24 frame.onRestyle blocks.

---

### F05 — Cleanup pass (P05, P08, P09, P10)

Zero new code. One agent, one PR.

#### S16 — Raw status bars → createStatusBar (P05)
music-player-window.ts, monster-cam-window.ts, scramble-window.ts (×2),
markdown-viewer-window.ts, backrooms-log-browser-window.ts.

#### S17 — Vi scroll keys → bindScrollKeys helper (P08)
Extract helper, migrate custom scrollable boxes that hand-roll j/k/g/G.

#### S18 — Inline textbox prompts → overlays.openValuePrompt (P10)
music-player-window.ts file input. Remove raw blessed.textbox.

#### S19 — Empty state constants (P09)
src/core/empty-states.ts. Migrate scattered inline strings.

---

### F06 — Type renames + structural cleanup (N03–N05)

Pure renaming, no logic changes. Ships after all primitive migrations are
complete — these stories touch the same files. One story per PR.

#### S20 — API endpoint surface rename (N03)

Targeted endpoint renames — no logic change, only route string and any
places that construct the URL:
  /view/wibwob-agent/open  → /view/agent/open
  /view/browser-reader/open → /view/reader/open
  /view/companion/smol     → /view/companion/compact
  /view/inspector/open     → /view/inspector/open       (keep, it is fine)
  /view/art/open           → /view/generative-art/open

Update control-api.ts routes. Update any agent skill files or docs that
reference the old paths. AC: GET /help shows new paths. Existing callers
(skills, docs) updated.

#### S21 — WindowKind type cleanup (N04)

Minor cleanup pass on the WindowKind union:
  "markdown-viewer" → "reader"   (aligns with command "Reader")

Single value rename — requires migration in: types.ts definition,
command-catalog.ts actionKey, app-controller.ts factory, workspace restore.
AC: typecheck clean. Workspace snapshots with old kind load gracefully
(add legacy alias in restore logic).

#### S22 — File name cleanup (N05)

src/windows/misc-windows.ts — audit contents, rename to descriptive name
or split into logical files. Likely: misc-windows → desktop-windows.ts or
system-windows.ts (contains workspace manager, command palette, etc).

src/windows/content-windows.ts — very large (1400+ lines, 4+ window types).
Audit split: primer-browser-window.ts, gallery-window.ts, file-manager-window.ts.
Do not break imports — update re-exports.

AC: No files named misc-windows.ts. content-windows.ts either split or
renamed. All imports updated. typecheck clean.

---

## Acceptance criteria

### Brand naming — FIRST (F00)
- [ ] AC-0a: Command labels follow WibWob-DOS convention, rename table applied
- [ ] AC-0b: Module IDs normalised to wibwob.slug, state service reflects new IDs

### Sidebar (F01)
- [x] AC-1: Audit complete, all sidebar implementations catalogued
- [ ] AC-2: createSidebarPanel in ui-parts.ts, exported via SDK
- [ ] AC-3: Width resolution handles fixed, percent, overflow
- [ ] AC-4: world-chatroom migrated, overflow fixed
- [ ] AC-5: ZINE migrated, toggle preserved
- [ ] AC-6: WibWobWorld migrated, mode-awareness preserved
- [ ] AC-7: Patchbay Lab migrated, mode-gated visibility preserved
- [ ] AC-8: Tidepool width constant deduped
- [ ] AC-9: Dead sidebar code removed (blocked on AC-4–AC-8 smoked)

### List + toolbar (F02)
- [ ] AC-10: createSelectableList in ui-parts.ts, exported via SDK
- [ ] AC-11: Raw blessed.list calls outside overlay-manager migrated
- [ ] AC-12: Raw toolbar boxes migrated to createHeaderBar

### Inline search (F03)
- [ ] AC-13: createInlineSearch in ui-parts.ts, exported via SDK
- [ ] AC-14: zine and sy2-chronicles migrated

### Focus + restyle (F04)
- [ ] AC-15: frame.setFocusTarget on WindowFacade, 23 callers migrated
- [ ] AC-16: createRestyleBundle in ui-parts.ts, 24 restyle blocks migrated

### Cleanup (F05)
- [ ] AC-17: 6 raw status bars → createStatusBar
- [ ] AC-18: Vi scroll key bindings → bindScrollKeys helper
- [ ] AC-19: Inline textbox prompts → overlays.openValuePrompt
- [ ] AC-20: Empty state strings → constants module

### Type renames + structure (F06)
- [ ] AC-21: API endpoints renamed, skill files and docs updated
- [ ] AC-22: WindowKind "markdown-viewer" → "reader", workspace restore handles legacy
- [ ] AC-23: misc-windows.ts renamed/split, content-windows.ts audited

### Second sweep — windows (W01–W06)
- [ ] AC-28: PREVIEW_SPLIT_RATIO constant, 10 inline ratios replaced
- [ ] AC-29: dispatchFileManagerKey shared, list/icon view key parity
- [ ] AC-30: deferRender(fn) helper, 3 setTimeout(0) calls replaced
- [ ] AC-31: bindCloseKeys helper, q+Escape consistent across all windows
- [ ] AC-32: applyInitialPos helper, 2 restore blocks replaced
- [ ] AC-33: clamp() exported from ui-primitives, 7 inline clamps replaced

### Second sweep — core (C01–C07)
- [ ] AC-34: createSearchListPreviewOverlay private helper, browser prompts unified
- [ ] AC-35: openTextInputPrompt private helper, value/path prompts unified
- [ ] AC-36: SHADOW_X_OFFSET/Y_OFFSET constants + syncShadowRect helper
- [ ] AC-37: Overlay prompt styles use theme() tokens, no hardcoded colors
- [ ] AC-38: createAlignedBarPart shared, createHeaderBar/createStatusBar unified
- [ ] AC-39: command-catalog windowByIdCommand builder, api/agent defaults
- [ ] AC-40: Shared base types extracted (LabeledEntries, PointerDragBase, WindowGeometry)

### Second sweep — modules (M01–M04)
- [ ] AC-41: All modules use createTimer/clearTimers, raw setInterval removed
- [ ] AC-42: appType values normalised to wibwob.slug
- [ ] AC-43: Direct src/core/ imports removed, SDK exports added
- [ ] AC-44: SDK focusOrCreate() helper added, singleton modules use it

### Throughout
- [ ] AC-26: bun run typecheck clean after every story
- [ ] AC-27: Smoke test all migrated modules after each F-block

---

## Decisions

- New primitives go in ui-parts.ts only. No parallel helper files.
- Export every new primitive via microapp-sdk.ts so modules can use them.
- F05 (cleanup pass) is zero new code — assign to one agent, ship as one PR.
- F00 (brand naming) ships first — zero logic risk, high emotional payoff.
  Pure string literals and JSON fields. One PR before any primitive work.
- F06 (type renames + file structure) ships last — touches same files as
  primitive migrations. Zero logic change. One story per PR.
- Overlay-manager's blessed.list constructions are NOT migrated (already
  centralised inside one owner).
- Tidepool full sidebar migration deferred until renderer uses blessed nodes.
- S24 (file split) should not attempt to redesign module boundaries — rename
  and split only, no logic movement.

## Open questions

- Should createSelectableList support column headers, or leave to consumers?
  (Recommendation: leave it — the panes are plain boxes.)
- Should createRestyleBundle be a class or plain object factory?
  (Recommendation: plain factory — consistent with ui-parts.ts conventions.)
- Does frame.setFocusTarget belong on WindowRecord (type) or WindowFacade?
  (Recommendation: WindowFacade — it is behaviour, not data.)
- Should the "Open" prefix be dropped from ALL commands including those that
  open prompts? ("Open Markdown..." → "Markdown...")?
  (Currently: keeping "Open X..." for commands that show a prompt before
  opening. Could also drop the Open and just keep "...". TBD.)
- Should §y² in command labels and module names be kept (it is a WibWob brand
  mark) or replaced with plain text for terminal compatibility?
  (Recommendation: keep — it renders correctly in blessed.)
