# E026 Dev Notes — SDK Enhancement Log

Running log of gaps, surprises, and SDK improvements discovered during
implementation. Each entry gets a TODO id if actionable.

---

## SDK gaps found during E026 demo build

### TODO-25fd9a5b — execSync find hack in markdown picker
`openMarkdownViewerWindow` in app-controller.ts shell-called `find` when
no filePath given. Replaced with a proper recursive `fs.readdirSync` walk
(`collectMarkdownFiles()`). Fixed in feat(markdown) S03 commit.

### TODO-5f986603 — host.ui primitives not directly importable from SDK
`createButtonBar`, `createStack`, `createColumns`, `createHeaderBar`,
`createStatusBar`, `createTextBlock`, `createRule`, `createFigletDisplay`,
`createAnimatedPanel` all live on `host.ui.*` but are NOT re-exported
from `microapp-sdk.ts`. Module authors importing standalone (like
`createTimer`, `createTreeWidget`) hit a dead end.

Fix: add named exports from `microapp-sdk.ts` for all `host.ui` members.
Update `.agents/microapp-sdk.md` with a "Layout primitives (direct import)"
section.

---

## Patterns that worked well

### createTimer + Set<Timeout> lifecycle
`createTimer(fn, ms, timers)` with `clearTimers(timers)` in `onCleanup`
is clean and zero-leak. No raw `setInterval` needed. Good SDK primitive.

### RenderMonitor via screen.render wrap
Wrapping `screen.render` at the source catches every render from every
subsystem (animations, timers, keypresses). One monitor gives full picture.
The `subscribe(fn, intervalMs)` pattern fits naturally with createTimer.

### TreeWidget focus trap — fix pattern
Once a blessed list takes focus, parent key bindings go deaf. Fix:
wire all global keys on BOTH `win.body` AND `tree.widget`. Add
`Tab`/`Escape` on the tree to return focus to body. Wire `Tab` on body
to enter the tree. This is the canonical focus-escape pattern for any
focusable sub-widget.

### Button bar as focus escape hatch
Clickable footer button bar (`host.ui.createButtonBar`) removes the need
for keyboard-only action discovery. Click handlers call `win.body.focus()`
first to reset focus state, then fire the action. Always pair a button bar
with key bindings — buttons for discoverability, keys for speed.

### tweenWindowPosition / tweenWindowSize
`elasticOut` for positional slides, `bounceOut` for size animations,
`easeOutCubic` for resets. These three cover 90% of cases.
FPS spikes to 30+ during tween (visible in RenderMonitor), drops to 1-2
at idle. That contrast is the point.

---

## Surprises / things to codify

- `host.ui.createButtonBar` `layout()` call requires a Rect-like object.
  When placing at the bottom of win.body, use `bottom: 0` not a calculated
  top value — `calc()` strings don't work in `applyRect`. Pattern:
  `bar.layout({ top: -1, left: 0, width: "100%", height: 1 })` with the
  `as any` cast works but is fragile. Should expose a `layoutAtBottom()`
  convenience or document the correct rect shape in SDK docs.

- `MicroappWindowHandle` doesn't expose `screen` directly — use
  `host.screen`. Common mistake: `win.screen?.render()` silently does
  nothing (optional chain on undefined). Always `host.screen.render()`.

- `host.windowManager()` does not exist — use `host.windows`. Worth
  adding to the "common mistakes" table in microapp-sdk.md (done).

- `"calc(50% - 1)"` as a height string — **Blessed has no calc() support**.
  The string is silently ignored and the box gets zero height. Always use
  `bottom: N` for "height minus N rows from bottom" instead of calc strings.
  Top panels: `height: "50%"`. Bottom panels: `top: "50%", bottom: 1`.

- `panel("50%", "50%", "50%", "calc(50% - 0)")` — blessed percentage
  heights in a split layout sometimes off-by-one at the bottom edge.
  Empirically `calc(50% - 0)` and `calc(50% - 1)` differ by one row
  depending on odd/even window height. No clean solution; accept minor
  seam at mid-point.
