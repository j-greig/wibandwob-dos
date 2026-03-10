---
subsystem: window-system
covers: WindowManager, WindowFacade, WindowRecord, WindowKind, microapps
files:
  - src/core/window-manager.ts
  - src/core/window-facade.ts
  - src/core/window-chrome.ts
  - src/core/types.ts (WindowRecord, WindowKind, AppType)
  - src/core/app-controller.ts (focusOrCreate, clearDesktop)
  - .agents/microapp-sdk.md
triggers:
  pre-change: window lifecycle, createFrame, registerWindow, describeState, WindowRecord fields
  post-change: verify bun run typecheck, GET /state, window appears/closes correctly
---

## Overview

WindowManager owns all live windows: creation (createFrame + registerWindow), z-order,
focus, drag, resize, tile, cascade, close. WindowFacade is the single 11-method interface
consumed by control API, agent tools, workspace restore, and app-controller. Every window
is a WindowRecord — a plain object combining blessed widgets with lifecycle hooks.
Microapps register their own window types at runtime via module-loader.ts.

## Key Files

- src/core/window-manager.ts — z-order stack, focus, drag/resize, layout, implements WindowFacade
- src/core/window-facade.ts — interface contract: getWindows, getWindowById, moveWindow, resizeWindow, toggleMaximize, focusWindow, closeWindow, sendInput, writeEditorText, captureText
- src/core/window-chrome.ts — chrome sizing math (borders, padding offsets); never inline in window code
- src/core/types.ts:231 — WindowRecord definition; :9 — WindowKind union; :111 — AppType union
- src/core/app-controller.ts:364 — focusOrCreate (singleton guard pattern); :734 — findWindowByAppType
- .agents/microapp-sdk.md — full microapp registration contract

## Core Types

WindowRecord (types.ts:220) — live in-memory window. Key fields:
  id: number          — unique, auto-incremented, never reused in a session
  kind: WindowKind    — "editor"|"primer"|"reader"|"browser"|"gallery"|"chat"|"backrooms"|
                        "markdown-viewer"|"art"|"pattern"|"companion"|"inspector"|
                        "microapp"|"figlet"|"palette"|"workspace"|"contour"|"terrain-lab"|
                        "monster-cam"|"scramble" (+ more)
  frame: Box          — outermost blessed box (has border, mouse, position/size)
  body: Box           — inner content area (top:1, left:2, right:2, bottom:1 inside frame)
  close: () => void   — cleans up, removes from stack, focuses next window
  focus: () => void   — brings to front, calls body.focus()
  describeState?: () => WindowStateDetails  — semantic metadata for state API
  filePath?: string   — set by file-backed windows (editor, primer, reader, markdown)
  editor?: EditorState — set by text-windows.ts (editor windows only)
  finder?: FinderController — set by content-windows.ts (browser/file-manager)
  microappId?: string — set by module-loader.ts (microapp windows only)
  savedBounds?        — set when maximized; cleared on restore or any manual geometry change
  cleanup?: () => void — called by close(); timers, subscriptions, external resources
  refresh?: () => void — called after resize; reflow content
  onRestyle?: () => void — called by restyleAll(); apply current theme tokens

DesktopWindowState (types.ts:175) — serialised shape in GET /state:
  id, kind, appType, title, left, top, width, height (null if not set), zIndex,
  focused, maximized, filePath?, details: WindowStateDetails

## Invariants

1. Every window MUST call registerWindow(record) after createFrame — without this
   the window is not in the managed stack and will not appear in GET /state.
2. describeState() MUST return { appType } at minimum. Missing appType causes
   workspace save to lose the window type on restore.
3. chrome math (border offsets) belongs in window-chrome.ts — never compute
   contentWidth = frameWidth - 4 inline in window code.
4. cleanup() MUST stop all timers/intervals/subscriptions — blessed does not GC
   event listeners when a box is destroyed.
5. savedBounds MUST be cleared before any manual geometry mutation (move/resize)
   — clearMaximize() does this; skipping it leaves maximize state stale.
6. focusOrCreate() is the correct pattern for singleton windows — never open a second
   wibwob-agent or companion by checking findWindowByAppType first.
7. Window IDs are session-local auto-incremented integers. Never hardcode or cache
   across restarts — always resolve via getWindowById() or GET /state.

## Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Window not in GET /state after creation | registerWindow() not called | Call registerWindow(record) after all hooks are wired |
| describeState returns wrong appType | appType string hardcoded incorrectly | Match exactly to PersistableAppType/TransientAppType in types.ts:111 |
| Window geometry wrong after maximize+resize | savedBounds not cleared | Call clearMaximize (private) or use moveWindow/resizeWindow which call clearMaximize |
| Window title bar shows stale title | title set on record but not on titleBar.setContent | Call titleBar.setContent(` ${newTitle} `) and record.title = newTitle together |
| Close button fires during drag | suppressClickWindowId not set | Don't bypass WindowManager click wiring — use createFrame and its built-in suppression |
| Content overflows chrome into borders | content width calculated without chrome offsets | Import window-chrome.ts contentToWindowSize(); never compute offsets inline |
| Microapp window missing from /state | microappId not set on record | Set record.microappId = moduleId in the microapp factory before registerWindow |
| Double wibwob-agent or companion window | focusOrCreate not used | Replace openX() with focusOrCreate(appType, createFn) — app-controller.ts:364 |

## Do / Don't

DO: call createFrame(title, kind) → wire all hooks → registerWindow(record)
DON'T: call registerWindow before body/cleanup/describeState are wired — state will be wrong immediately

DO: use window-chrome.ts for border/padding math
DON'T: write const contentW = Number(frame.width) - 4 inline — fragile and wrong

DO: set record.filePath when opening a file-backed window
DON'T: put filePath only in describeState() details — workspace restore reads record.filePath directly

DO: call record.cleanup?.() before destroying the frame
DON'T: destroy the frame first — listeners that reference cleanup state will fire on destroy events

DO: use focusOrCreate for singleton windows (agent, companion, scramble)
DON'T: create a second instance of a singleton window — focusOrCreate already handles focus

DO: call record.refresh?.() after resize in any resize handler
DON'T: skip refresh — content widgets that cache dimensions will render stale sizes

DO: wire onRestyle to apply current theme() tokens
DON'T: hardcode style colours — theme can change at runtime

## Microapp Window Registration

Microapps (modules/*/index.ts) register window types via MicroappHost:

  host.registerWindowType({
    id: "my-app",           // unique string, kebab-case
    label: "My App",
    create: (ctx) => {
      const record = ctx.windowManager.createFrame("My App", "microapp");
      record.microappId = ctx.moduleId;
      record.describeState = () => ({ appType: "my-app", summary: "..." });
      record.cleanup = () => { /* stop timers */ };
      // ... wire content into record.body ...
      ctx.windowManager.registerWindow(record);
      return record;
    }
  });

WindowKind for all microapps is "microapp" (types.ts:9). AppType is the registered id string.
The isMicroappWindow(w) guard (types.ts) narrows to MicroappWindowRecord with guaranteed microappId.
Full SDK: .agents/microapp-sdk.md

## Blessed Scroll + Nested Child Gotchas (from agentic-devlog 2026-03-09)

These patterns affect ANY microapp that puts child elements inside a scrollable canvas.

### The double-subtraction bug — use `fixed: true` on grandchildren

When a frame (direct child of a scrollable canvas) contains children (grandchildren of
canvas), blessed's `_getCoords()` walks up and subtracts `childBase` (scroll offset)
at each scrollable ancestor. Grandchildren get it subtracted TWICE — once via `frame.lpos.yi`,
once again in `_getCoords`. Result: `yi` goes negative, `_getCoords` returns undefined,
content is never drawn. Borders render (frame = direct child, single subtraction) but
body content is blank.

Fix: `fixed: true` on ALL grandchildren (titleBar, content, editor, resize grip).
`fixed: true` tells `_getCoords` to skip past one scrollable ancestor.

Correct panel chrome pattern for scrollable canvas microapps:

  frame (parent: scrollable canvas)  → NO fixed needed
    titleBar (parent: frame)         → fixed: true  ← REQUIRED
    content (parent: frame)          → fixed: true  ← REQUIRED
    resizeGrip (parent: frame)       → fixed: true  ← REQUIRED

### Double-input from element.key()

`element.key()` in blessed registers globally on `program`, not per-element.
If you wire `canvas.key + root.key + win.onInput`, each keystroke fires 2-3x.
Fix: use ONE keypress listener at the topmost element, or use `screen.key()` with
a focus check. Never layer multiple `.key()` calls for the same action.

### Click routing breaks inside scrollable canvas with fixed:true children

`fixed: true` children desync blessed's `lpos` hit-testing from visual scroll position.
Blessed routes clicks to the wrong panel when children have `fixed: true`.
Fix: remove `clickable: true` from all panel children. Handle ALL mouse interaction at
screen level via `screen.on("mouse")` + `pointerToContent()` from panel-layout.ts.
This kills blessed auto-focus for panels entirely — that is correct behaviour.

### Scroll-jump on refocus

`screen._focus` auto-scrolls to child `rtop` on any click (via `element click` → `el.focus()`).
Do not call `el.focus()` on panel children — it triggers unwanted scroll-jump.
Keep `fixed: true` for rendering; handle focus at the canvas/screen level only.

### Panel chrome must match exactly

  border: "line"                      // shorthand — NOT { type: "line" }
  titleBar style: theme().header      // NOT theme().body
  fixed: true on titleBar and content // REQUIRED in scrollable canvas
  Separate titleBar box               // NOT blessed label property
  right: 0 + height: 1 for toolbar   // NOT computed width (root.width is 0 at creation)

### layoutPanels() col field

`col` in panel layout is SORT ORDER only, not a physical column position.
Panels flow left-to-right wrapping by width. Do NOT compute column separator
positions from `col` values — they don't map to screen columns.

## Change Checklist

When touching window-manager.ts:
- [ ] bun run typecheck passes
- [ ] GET /state shows correct window count, ids, positions after the operation
- [ ] close() removes window from stack and focuses next — no orphan records
- [ ] drag/resize clamps to desktop bounds (screen.width, screen.height - 2)
- [ ] restyleAll() applies to the changed window type

When adding a new WindowKind:
- [ ] Add to WindowKind union in types.ts
- [ ] Add to PersistableAppType or TransientAppType in types.ts
- [ ] Implement describeState() returning the new appType
- [ ] Add workspace snapshot/restore handlers if persistable
- [ ] Add to contextMenu.windowKinds in any relevant command-catalog entries
- [ ] Verify window appears in GET /state with correct kind and appType
