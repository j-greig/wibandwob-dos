---
id: E026
title: Rich Text and Layout System
status: not-started
issue: ~
pr: ~
depends_on: [E015, E016]
---

# E026 — Rich Text and Layout System

Elevate WibWob-DOS text rendering and layout primitives, taking direct
inspiration from Rich, Textual, and pi-mono/tui. Delivers: markdown rendering
with figlet headings, inline styles (bold/italic/links/code), a tree component,
a timed-refresh primitive, a motion/tween affordance for microapps, and stretch
syntax highlighting via Rich/pygments.

Reference docs compiled from vendor libs:
- `docs/vendor-reference/rich-internals-reference.md`
- `docs/vendor-reference/textual-reference.md`
- `docs/vendor-reference/pi-mono-tui-reference.md`

---

## Architecture Decisions (pre-decided)

### Rich bridge strategy — subprocess, not port

Rich is a Python library backed by Pygments and markdown-it. Porting it to
TypeScript is months of work with no clear benefit over a thin subprocess bridge.
The figlet-service.ts pattern (`spawnSync`) already proves the model works.

**Canon approach:**
- `src/services/rich-bridge.ts` — `spawnSync("python3", ["-c", ...])` with
  `force_terminal=True, width=N` on a Console writing to StringIO. Returns an
  ANSI string.
- Blessed viewports accept raw ANSI content via `setContent()` with
  `tags: false` and direct escape injection, or via a thin ANSI→blessed tag
  adapter.
- Rich's Markdown class is used for body text. Rich's Syntax class is used for
  code blocks (stretch).
- If python3+rich is absent, degrade gracefully to plain text.

### Figlet heading system — native, not bridged

figlet-service.ts already has 148 fonts with height/width metadata.
The wibwob-sdk fonts are identical to the local copy — no import needed.
Heading rendering stays TypeScript-native: detect H1–H6 in a markdown pre-pass,
render each heading with renderFiglet(), splice into the output stream before
passing body text to the Rich bridge.

Wrapping policy: if figlet output exceeds container inner width, downgrade to
the next smaller font in the heading's font chain. If no font fits, fall back to
plain bold text.

### Timed refresh — TS setInterval with lifecycle binding

No need to port Textual's `set_interval`. Bun's `setInterval` is the primitive.
The pattern: a createTimer(fn, ms, cleanupSet) helper that returns a handle and
registers it in a Set<NodeJS.Timeout> owned by the window. On window close, the
window calls clearAllTimers(cleanupSet). This lives in `src/core/ui-primitives.ts`
as a named export.

### Motion/tween — thin animator over blessed style properties

Textual's animate() tweens CSS variables. Our equivalent: animate blessed box
properties (style.fg, style.bg, position top/left, width, height) over time using
requestAnimationFrame-equivalent (setInterval at 16ms). A `tweenStyle` helper
interpolates between two states over a duration with an easing function. This is
new functionality in `src/services/motion-service.ts`.

### Tree component — Blessed-native port of the concept

Rich's Tree class and Textual's Tree widget share the same model: nodes with
children, expand/collapse, guide lines. pi-tui's SelectList shows how to do
interactive keyboard navigation in a string-render model. Our port is a native
Blessed implementation — a box containing a list with virtual indent/guide
rendering and keyboard toggle. Lives in `src/windows/tree-widget.ts`.

---

## Feature Checklist

- [ ] F01 Architecture spikes — subprocess ANSI bridge PoC + pi-tui port audit
- [ ] F02 Markdown viewer — Rich bridge + scrollable MarkdownViewer window
- [ ] F03 Figlet heading system — H1–H6 with per-level font config + wrapping policy
- [ ] F04 Inline styles — bold, italic, code span, link, code block border
- [ ] F05 Tree component — collapsible blessed-native TreeWidget
- [ ] F06 Timed refresh primitive — lifecycle-bound createTimer in ui-primitives
- [ ] F07 Motion service — tweenStyle + easing for microapps and window components
- [ ] F08 (stretch) Syntax highlighting — Rich Syntax bridge for code blocks

---

## F01 — Architecture Spikes

### Status
Status: not-started

### S01 — Rich subprocess bridge proof of concept

**Goal:** verify that `spawnSync("python3", ["-c", RICH_SCRIPT, markdown_text])`
produces usable ANSI output in a Blessed viewport before committing to this path.

Tasks:
- [ ] Write a 20-line python3 one-liner that accepts markdown via argv[1] or stdin,
      renders with `Console(force_terminal=True, width=N, file=StringIO())` and
      prints to stdout
- [ ] Call it from a test script in `scripts/rich-bridge-test.ts` via `spawnSync`
- [ ] Capture output and render it into a raw Blessed box via `setContent`
- [ ] Measure round-trip latency for a 200-line document at widths 40/60/80
- [ ] Verify graceful degradation when python3 or rich is absent (exit code check)
- [ ] Document findings in `S01-findings.md`

AC-1: `bun run scripts/rich-bridge-test.ts` opens a Blessed window with rendered
markdown visible (headings, bold, code blocks).
Test: manual smoke — run the script, screenshot the window.

AC-2: When python3 or rich is absent, the script falls back to plain text output
(no crash, no empty screen).
Test: `PATH="" bun run scripts/rich-bridge-test.ts` — confirm plain text fallback.

AC-3: Round-trip latency < 300ms for a 200-line document.
Test: `time bun run scripts/rich-bridge-test.ts --benchmark`.

### S02 — pi-tui port audit

**Goal:** determine which pi-tui components are worth porting to Blessed and which
are redundant given existing wwdos primitives.

Tasks:
- [ ] Read vendor/pi-mono/packages/tui/src/components/markdown.ts in full
- [ ] Read components/box.ts, text.ts, truncated-text.ts
- [ ] Compare markdown.ts approach vs Rich bridge — is a pure TS port viable?
- [ ] Identify any utils.ts functions (visibleWidth, wrapTextWithAnsi,
      truncateToWidth) that improve on or duplicate existing stringWidth usage
- [ ] Identify any render patterns worth lifting into wwdos ui-primitives
- [ ] Document findings and go/no-go decisions in `S02-findings.md`

AC-1: S02-findings.md exists with a table: component | port? | reason | target file.
Test: cat .planning/epics/e026-rich-text-layout-system/S02-findings.md

---

## F02 — Markdown Viewer Window

### Status
Status: not-started

### S03 — rich-bridge.ts service

New service at `src/services/rich-bridge.ts`.

Tasks:
- [ ] `renderMarkdown(text: string, width: number): string` — subprocess call,
      returns ANSI string. Throws if subprocess fails with rich error, returns
      plain text if python3/rich absent.
- [ ] `isRichAvailable(): boolean` — cached check for python3 + rich import
- [ ] Error boundaries: if rich renders empty output, return raw text unchanged
- [ ] Unit test: `tests/unit/rich-bridge.test.ts` — mock spawnSync, assert output
      contains ANSI escape codes for a known input

AC-1: `renderMarkdown("# Hello\n\n**bold**", 80)` returns a string containing
ANSI escape sequences.
Test: `bun test tests/unit/rich-bridge.test.ts`

AC-2: `isRichAvailable()` returns false and renderMarkdown returns plain text
when python3 is not on PATH.
Test: mock PATH in test, assert no ANSI codes in fallback output.

### S04 — MarkdownViewer window

New window type: `markdown-viewer`. Factory in `src/windows/markdown-viewer-window.ts`.

Tasks:
- [ ] Extend WindowKind with `"markdown-viewer"`
- [ ] Wire command `open_markdown_viewer` in command-catalog.ts (palette + File menu)
- [ ] Window opens a file picker filtered to *.md, then opens a scrollable viewer
- [ ] On open: call rich-bridge.renderMarkdown(fileContent, innerWidth)
- [ ] Re-render on resize (debounced 200ms)
- [ ] Scrollbar, keyboard scroll (j/k, PgUp/PgDn, g/G)
- [ ] `describeState()` includes: filePath, scrollOffset, rendererMode (rich|plain)
- [ ] Workspace snapshot round-trips filePath + scrollOffset
- [ ] Add to control-api.ts: `POST /windows/markdown-viewer {filePath}`
- [ ] `bun run typecheck` clean

AC-1: Opening a .md file via command palette shows rendered markdown with visible
heading hierarchy, bold text, and code block borders.
Test: manual smoke + `./scripts/screenshot-window.sh "Markdown Viewer"`.

AC-2: Window survives resize without crash; content re-renders to new width.
Test: resize window via API, confirm no crash, screenshot.

AC-3: `GET /state` includes a markdown-viewer entry with filePath and scrollOffset.
Test: `curl http://127.0.0.1:8099/state | jq '.windows[] | select(.appType=="markdown-viewer")'`.

AC-4: Workspace restore reopens the file at the saved scroll position.
Test: Open file, scroll to line 20, save workspace, restart, confirm scroll offset.

---

## F03 — Figlet Heading System

### Status
Status: not-started

### S05 — FigletHeadingConfig schema

Define the per-level heading configuration schema.

Font catalogue reference: `modules/wibwob-figlet-fonts/fonts.json` (148 fonts, each
with height and width metadata). Use `figlet-service.ts` exclusively — do not
re-implement font discovery.

Tasks:
- [ ] Define `FigletHeadingConfig` interface in `src/core/types.ts`:
      ```ts
      interface FigletHeadingLevel {
        font: string;           // figlet font name
        fallbackFonts: string[]; // tried in order if primary overflows
        plainFallback: boolean;  // if true, use bold plain text when all fonts overflow
      }
      interface FigletHeadingConfig {
        h1: FigletHeadingLevel;
        h2: FigletHeadingLevel;
        h3: FigletHeadingLevel;
        h4: FigletHeadingLevel;
        h5: FigletHeadingLevel;
        h6: FigletHeadingLevel;
      }
      ```
- [ ] Define `DEFAULT_FIGLET_HEADING_CONFIG: FigletHeadingConfig` in
      `src/core/defaults.ts` using favourite fonts from the catalogue
      (h1→big/banner, h2→standard, h3→small, h4–h6→term/mini)
- [ ] Export from `src/core/primitives.ts`

AC-1: TypeScript compile clean after adding types.
Test: `bun run typecheck`.

### S06 — Heading pre-pass renderer

Tasks:
- [ ] `renderMarkdownHeadings(text: string, config: FigletHeadingConfig, width: number): string`
      in `src/services/markdown-heading-service.ts`
- [ ] Parse H1–H6 lines (lines starting with `#`..`######` followed by space)
- [ ] For each heading: call `renderFiglet(headingText, font, width)` from
      figlet-service.ts
- [ ] If rendered width > container width, try fallbackFonts in order
- [ ] If all overflow, fall back to plain styled text (if plainFallback) or
      smallest font that fits
- [ ] Return full document with heading lines replaced by figlet blocks

AC-1: `renderMarkdownHeadings("# Hello World\nBody", DEFAULT_CONFIG, 80)` returns
a string where "Hello World" is replaced by multi-line figlet art.
Test: `bun test tests/unit/markdown-heading.test.ts`

AC-2: When figlet output would overflow width, a narrower font is used instead.
Test: call with width=20, assert output lines all <= 20 chars.

### S07 — Wrapping policy + integration into MarkdownViewer

Tasks:
- [ ] Integrate heading pre-pass into MarkdownViewer render pipeline:
      1. Run `renderMarkdownHeadings` on raw markdown
      2. Pass result to `rich-bridge.renderMarkdown`
      3. Display final ANSI string in viewport
- [ ] MarkdownViewer settings: toggle figlet headings on/off (keybind `h`)
- [ ] Per-viewer heading config overridable via workspace state (allows custom font
      assignments saved per-file)

AC-1: Opening a markdown file with H1 and H2 shows figlet art for headings with
body text rendered by Rich below.
Test: smoke screenshot.

AC-2: Pressing `h` in the viewer toggles between figlet and plain headings.
Test: manual smoke.

---

## F04 — Inline Styles

### Status
Status: not-started

Rich handles bold, italic, code spans, and links natively via its Markdown class.
This feature is about ensuring those styles survive the ANSI→Blessed pipeline and
adding explicit code block border rendering on top.

### S08 — ANSI→Blessed style verification

Tasks:
- [ ] Confirm that ANSI codes from Rich's Markdown render (bold=\e[1m,
      italic=\e[3m, underline=\e[4m) display correctly in a Blessed box set
      with `tags: false` and raw content injection
- [ ] If Blessed strips codes: implement a thin ANSI→Blessed-tag adapter in
      `src/core/ansi-to-blessed.ts`
- [ ] Verify link rendering: Rich renders links as underlined + URL in parens;
      confirm readable
- [ ] Unit test: assert that a known ANSI string renders visibly styled in a
      headless Blessed box

AC-1: Bold markdown text appears visually bold in the MarkdownViewer.
Test: screenshot showing bold text in a .md file.

AC-2: Code spans (backtick) appear with distinct colour/background.
Test: screenshot.

### S09 — Code block border renderer

Triple-backtick code blocks from Rich get an additional Blessed box drawn around
them with a language label in the border title.

Tasks:
- [ ] Pre-process Rich output: detect code block ANSI regions by Rich's Syntax
      framing (Rich wraps code blocks in Panel borders)
- [ ] OR: pre-process the raw markdown before bridging — extract code blocks,
      render them separately with a border box, splice back
- [ ] Code block box: border style from theme tokens, language label as title,
      monospace bg
- [ ] Keyboard: `c` cycles focus to next code block for copy (copies raw to
      clipboard via `pbcopy` on macOS / `xclip` on Linux)

AC-1: A .md file with a triple-backtick Python block shows a bordered box with
"python" label.
Test: screenshot.

AC-2: Pressing `c` copies the code block contents to clipboard.
Test: press `c`, assert `pbpaste` returns the block content.

---

## F05 — Tree Component

### Status
Status: not-started

Port the concept from Rich's Tree class and pi-tui's SelectList to a native
Blessed collapsible tree widget.

### S10 — TreeWidget

`src/windows/tree-widget.ts`

Model:
```ts
interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  data?: unknown;      // arbitrary payload for consumers
  expanded?: boolean;  // default true
}
```

Tasks:
- [ ] `createTreeWidget(parent, nodes, opts)` — returns a Blessed list-backed
      widget that renders a virtual tree with unicode guide lines (├── └── │)
- [ ] Keyboard: j/k navigate, Enter/Space expand/collapse, `o` expand all,
      `O` collapse all
- [ ] Mouse: click to select, click expand/collapse indicator
- [ ] Emit events: `select` (node selected), `expand`, `collapse`
- [ ] `setNodes(nodes: TreeNode[])` — replace tree data and re-render
- [ ] `getSelectedNode(): TreeNode | null`
- [ ] Theme tokens for guide line colour, selected row, expanded indicator
- [ ] Export from `src/core/primitives.ts`
- [ ] Demo command `open_tree_demo` in command-catalog.ts showing a file hierarchy

AC-1: TreeWidget renders a nested node structure with visible guide lines and
expand/collapse indicators.
Test: screenshot of tree demo window.

AC-2: j/k navigation moves the cursor; Enter toggles expand/collapse.
Test: manual smoke.

AC-3: `describeState()` on a tree-containing window reports selected node id.
Test: `GET /state` after selecting a node.

---

## F06 — Timed Refresh Primitive

### Status
Status: not-started

Textual's `set_interval(fn, seconds)` bound to widget lifecycle. Our TS equivalent.

### S11 — createTimer in ui-primitives.ts

Tasks:
- [ ] Add to `src/core/ui-primitives.ts`:
      ```ts
      type TimerHandle = ReturnType<typeof setInterval>;
      type TimerSet = Set<TimerHandle>;

      function createTimerSet(): TimerSet
      function createTimer(fn: () => void, ms: number, timers: TimerSet): TimerHandle
      function clearTimers(timers: TimerSet): void
      ```
- [ ] Pattern: window factory creates a TimerSet at open time, passes it to
      components that need periodic refresh, calls clearTimers in the window's
      close handler
- [ ] Export from `src/core/primitives.ts`
- [ ] Update AGENTS.md with the pattern name ("timed-refresh primitive")

### S12 — Wire into animation-service.ts and MarkdownViewer

Tasks:
- [ ] Convert animation-service.ts FramePlayer to use createTimer instead of raw
      setInterval, so timers are properly cleaned up via the window's TimerSet
- [ ] Wire MarkdownViewer to use createTimer for any deferred re-render on resize

AC-1: Opening and closing an animated primer 10 times leaves no dangling setInterval
handles (verify via heap snapshot or process.hrtime interval tracking).
Test: `bun test tests/unit/timer-cleanup.test.ts`

---

## F07 — Motion Service

### Status
Status: not-started

Textual animates CSS properties via `widget.animate(property, value, duration)`.
Our equivalent: tween numeric blessed properties over time for microapps and window
components.

### S13 — motion-service.ts

`src/services/motion-service.ts`

```ts
interface TweenOptions {
  from: number;
  to: number;
  duration: number;       // ms
  easing?: EasingFn;      // default: easeInOutCubic
  onUpdate: (value: number) => void;
  onComplete?: () => void;
  timers: TimerSet;       // lifecycle binding — auto-cancelled on window close
}

function tween(opts: TweenOptions): void
function easings: Record<string, EasingFn>  // linear, easeIn, easeOut, easeInOut, bounce, elastic
```

Tasks:
- [ ] Implement tween with 60fps setInterval (16ms tick)
- [ ] Easing functions: linear, easeInCubic, easeOutCubic, easeInOutCubic,
      bounce, elastic (port formulas from Textual's easing.py in vendor/textual)
- [ ] `tweenWindowPosition(window, {x, y}, duration, timers)` — convenience
      wrapper that animates left/top of a blessed box
- [ ] `tweenWindowSize(window, {w, h}, duration, timers)` — convenience wrapper
- [ ] Export from `src/services/`

### S14 — API surface and agent visibility

Tasks:
- [ ] Command `animate_window` in command-catalog.ts — takes windowId, property,
      target value, duration
- [ ] Expose via control-api.ts: `POST /windows/:id/animate {property, to, duration}`
- [ ] Add to state-service describeState if animation is in-progress

AC-1: `POST /windows/:id/animate {property:"left", to:20, duration:500}` smoothly
moves a window to x=20 over 500ms.
Test: call endpoint, screenshot before/after, verify position in GET /state.

AC-2: Animation auto-cancels when the window is closed mid-tween.
Test: start a 2s tween, close window after 100ms, verify no further position
changes via GET /state.

---

## F08 (Stretch) — Syntax Highlighting Bridge

### Status
Status: not-started

Use Rich's Syntax class (backed by Pygments, 500+ languages) via the same
subprocess bridge as the markdown renderer, to highlight code blocks inside the
MarkdownViewer.

### S15 — Syntax highlight subprocess

Tasks:
- [ ] Add `renderSyntax(code: string, language: string, width: number): string`
      to `src/services/rich-bridge.ts`
- [ ] Python one-liner: `Console(force_terminal=True, width=N).print(Syntax(code, lang, theme="monokai"))`
- [ ] Integration: S09 code block renderer calls renderSyntax instead of plain
      code display
- [ ] Language auto-detection: pass detected language from markdown fence info string
- [ ] Fallback: if language unknown to Pygments, plain code block
- [ ] Degrade gracefully if rich absent

AC-1: A Python code block in a .md file renders with Monokai syntax colours.
Test: screenshot.

AC-2: An unknown language fence info string (`​```brainfuck`) falls back to plain
code block without error.
Test: open a file with unknown language fence, confirm no crash.

---

## Notes and Decisions

### Figlet font catalogue — no import needed

The local catalogue at `modules/wibwob-figlet-fonts/fonts.json` is identical
to the wibwob-sdk copy (148 fonts, same metadata). No import story required.
figlet-service.ts already exposes `getFigletCatalogue()`, `renderFiglet()`,
`measureFiglet()`, and `getFigletFontHeight()`. These are the canonical APIs
for all heading rendering work in this epic.

**Figlet wrapping awareness:** the `width` parameter to `renderFiglet()` already
limits output width. The heading pre-pass must also account for the inner width
of the containing window (outer width minus chrome offsets from window-chrome.ts).
Never pass raw terminal width — always pass innerWidth from the window's body box.

### pi-tui utils worth auditing

`vendor/pi-mono/packages/tui/src/utils.ts` contains `visibleWidth()`,
`wrapTextWithAnsi()`, `truncateToWidth()`, `sliceByColumn()`. These are
grapheme-aware and ANSI-safe. Compare against our `stringWidth` usage in
`content-windows.ts` — if they are strictly better, consider adopting via
a TypeScript port into `src/core/ui-primitives.ts`.

### No full Textual port

Textual's CSS layout system is its killer feature. It is not worth porting —
the explicit blessed layout model (manual cell positions) is different in kind,
not just implementation. Take inspiration (fr units concept, docking patterns)
but do not attempt a CSS engine. If a future epic wants auto-layout, start with
a simpler flex-row/flex-col helper, not a full CSS cascade.

### Rich subprocess startup cost

Rich imports Pygments, markdown-it, and friends. First call latency may be
300–500ms. Solutions: keep a long-running Python helper process (vs spawnSync
per call), or accept the latency and cache rendered output per (filePath,
mtime, width). S01 measures this; the approach is chosen during the spike.

---

## Parking Lot

- **Live markdown preview in editor** — as you type in the editor window,
  a side-by-side MarkdownViewer updates. Requires debounced re-render and
  probably the long-running Python helper process to keep latency acceptable.
  Deferred post F02.
- **Custom theme for syntax highlight** — allow the wwdos theme system to
  control the Rich/Pygments theme (monokai, dracula, etc.) so syntax colours
  match the desktop theme. Deferred post F08.
- **TreeWidget as file manager backbone** — replace the flat list in the
  primer browser and file manager with a TreeWidget showing directory
  hierarchy. Deferred post F05.
- **Animated window entrance/exit** — use motion-service tweenWindowPosition
  to slide windows in from a screen edge on open and out on close. Deferred
  post F07.
