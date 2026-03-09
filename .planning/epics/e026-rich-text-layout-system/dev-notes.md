# E026 Dev Notes — SDK Enhancement Log

Running log of gaps, surprises, and SDK improvements discovered during
implementation. Each entry gets a TODO id if actionable.

---

## SDK gaps found during E026 demo build

### TODO-25fd9a5b — execSync find hack in markdown picker
`openMarkdownViewerWindow` in app-controller.ts shell-called `find` when
no filePath given. Replaced with a proper recursive `fs.readdirSync` walk
(`collectMarkdownFiles()`). Fixed in feat(markdown) S03 commit.

### ~~TODO-5f986603~~ DONE — host.ui primitives now directly importable from SDK
`createButtonBar`, `createStack`, `createColumns`, `createHeaderBar`,
`createStatusBar`, `createTextBlock`, `createInputLine`, `createMessageHistory`,
`createRule`, `createFigletDisplay`, `createAnimatedPanel` all re-exported from
`microapp-sdk.ts`. `import { createButtonBar } from "microapp-sdk"` works.
e026-demo dogfoods it — all SDK imports consolidated to one block.

### ~~Panel border ANSI wrapping bug~~ FIXED — wrap:false + style.fg pattern
ANSI escape codes in `setContent()` confuse blessed's line-width calculation
causing long border lines to wrap — putting the `╗` corner at column 0 of
the next row. Fix: no ANSI in border content, use `wrap: false` on the outer
box, set colour via `style.fg` only. Title rendered in a separate child box
at `top:0, left:2`. Result: correct single↔double border corners on all panels.

---

## SDK enhancement ideas — from E026 panel work

### Border style system — should be an SDK primitive
Currently every microapp that wants styled borders has to roll its own
box-drawing character logic. This is a gap. The SDK should expose a
`createStyledBorder(parent, opts)` UiPart (or a `setBorderStyle(box, style)`
utility) with a defined set of named styles:

  thin      ╌╌╌  (U+254C/254E dashed)
  single    ───   ┌┐└┘│─   (current blessed "line" border)
  bold      ━━━   ┏┓┗┛┃━   (U+2501 heavy)
  double    ═══   ╔╗╚╝║═   (U+2550 double)

Each style should support:
  - active/inactive colour from theme (windowBorderUnfocused / titleBarFocused.bg)
  - a title string embedded in the top rail
  - `setActive(bool)` to swap style + colour
  - `layout(rect)` from UiPart protocol
  - `restyle()` hook for theme changes

Root cause of this gap: blessed's built-in `border: "line"` only does
single-line chars and doesn't expose the char set. Any richer border
requires manual setContent() — which has a pitfall (ANSI codes confuse
blessed's line-width calc → wrapping). Fix: use `wrap: false` + plain
box-drawing chars + `style.fg` for colour (no ANSI in content).

TODO: extract `createPanel` from `modules/e026-demo/index.ts` into
`src/core/ui-parts.ts` as a proper exported SDK primitive once the
implementation is proven stable.

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

## SDK gaps found during demo wiring (continued)

### host.runCommand vs global system commands — internal/external distinction broken
`host.runCommand(id, args)` ALWAYS namespaces the id:
  `"markdown.open"` → `"microapp.e026-demo.markdown.open"` → not found → silent fail.

There is no way for a microapp to call a global system command (e.g. `markdown.open`,
`primer.open`, any File menu command) via the host API. The distinction between
"internal microapp command" and "external system command" is not exposed.

Fix needed in `src/services/module-loader.ts`:
  - Add `host.runGlobalCommand(id, args)` that calls `commands.run(id, args)` directly
    without any namespace prefix.
  - Keep `host.runCommand(localId)` for internal commands (prefixed as now).
  - Document both clearly in `.agents/microapp-sdk.md` with examples.

Also add `runGlobalCommand` to the "common mistakes" table:
  WRONG: `host.runCommand("markdown.open", { filePath })`   → silently does nothing
  RIGHT: `host.runGlobalCommand("markdown.open", { filePath })`

TODO: wire the impl in module-loader.ts and export type from microapp-sdk.ts.
(Type declaration added; impl pending — see fix/e026-demo-runGlobalCommand branch)

---

### statusLine / any bar widget: tags:false by default — blessed tags not rendered
Spotted in e017 worktree: `statusLine` was showing `{grey-fg}haiku-4-5` as
literal text instead of rendering the colour. Root cause: the box was created
without `tags: true`. Blessed boxes default to `tags: false` — you MUST set
`tags: true` explicitly if you use `{color}text{/}` style tag syntax in content.

Two valid approaches:
  1. `tags: true` on the box + `{colour-name}text{/colour-name}` blessed tags
  2. `tags: false` + raw ANSI escape codes `\x1b[...m` (no blessed tag parsing)

They are mutually exclusive. Mixing them produces literal `{` characters in output.
SDK docs should call this out. The statusLine in app-controller.ts already has
`tags: true` — but any NEW bar or status widget created without it will silently
show tags as text with no error.

Pattern to codify in microapp-sdk.md common-mistakes table:
  WRONG: `blessed.box({ content: "{green-fg}ok{/green-fg}" })` → shows literal braces
  RIGHT: `blessed.box({ tags: true, content: "{green-fg}ok{/green-fg}" })`
  OR:    `blessed.box({ tags: false, content: "\x1b[32mok\x1b[0m" })`

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

---

## Pi session-control socket discovery — stale socket accumulation (2026-03-09)

**Context:** During E017 Scramble Brains, Scramble was given a pi inter-agent
session socket so `send_to_session "scramble"` works from the Wib&Wob agent.
While verifying, `~/.pi/session-control/` was found to have 100+ stale `.sock`
files from previous sessions that were never cleaned up.

**The directory:**
```
~/.pi/session-control/
  scramble.alias          → scramble-5be76b.sock   (live)
  wibwob-tui.alias        → wibwob-agent-....sock  (live)
  scramble-81c49e.sock    (stale — previous app run)
  scramble-fed92d.sock    (stale)
  wibwob-agent-1772575141085-gq42af.sock  (stale, one of ~100)
  ...
```

**How `list_sessions` discovers sessions:**
`src/services/pi-session-bridge.ts` — `listSessions()` function (line ~100).
It reads the directory, finds all `.sock` files, probes each one with a
`get_message` JSON RPC call, and includes the session if it responds.
Stale sockets fail to connect and are skipped, but the probe attempt adds
latency — O(n) where n = all dead sockets.

**Alias resolution:**
`.alias` files are symlinks. The basename before `.alias` is the human name
(`scramble`, `wibwob-tui`). `listSessions()` builds an alias map at line ~118,
matching socket paths to their alias names.

**`startSessionServer` alias param** was hardcoded as `"wibwob-tui"` — fixed in
E017 by adding optional `aliasName` field to `SessionServerTarget` interface
(`src/services/pi-session-bridge.ts` ~line 207). Scramble registers as
`"scramble"`. Any session can now pass a custom alias.

**Suggested fix — startup cleanup sweep:**
On `startSessionServer`, before creating the new socket, scan the directory and
remove any stale `.sock` files (i.e. files that fail a connect probe). Could
also be done on app startup in `app-controller.ts` constructor. A simple
approach: `fs.readdirSync(CONTROL_DIR).filter(f => f.endsWith('.sock'))` →
probe each → `fs.unlinkSync` the dead ones. Skip files modified in the last
30s to avoid racing with a session that just started.

**File references:**
- `src/services/pi-session-bridge.ts` — `listSessions()`, `startSessionServer()`,
  `SessionServerTarget` interface, `CONTROL_DIR` constant
- `src/services/wibwob-agent-session.ts` line ~604 — where `startSessionServer`
  is called for the main agent (wibwob-tui alias)
- `src/services/scramble-brain.ts` — `startSessionSocket()` / `stopSessionSocket()`
  — where Scramble registers her socket (scramble alias)

**Not blocking anything** — `list_sessions` works correctly despite the clutter,
just slower. Good candidate for a small cleanup script or a startup sweep.
