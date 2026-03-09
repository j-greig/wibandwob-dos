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
inspiration from Rich, Textual, and pi-mono/tui. Delivers: a general-purpose
markdown viewer that opens any .md file with figlet headings, inline styles,
code block borders, and optional syntax highlighting — plus a tree component,
timed-refresh primitive, motion/tween affordance, and the panel layout engine
extracted from sy2-chronicles into the SDK.

Reference docs compiled from vendor libs:
- `docs/vendor-reference/rich-internals-reference.md`
- `docs/vendor-reference/textual-reference.md`
- `docs/vendor-reference/pi-mono-tui-reference.md`

---

## Prior Art — pi-markdown-reader prototype

Before touching any story in this epic, read:

  `wibwob-sdk/modules/pi-markdown-reader/` — 1,523 lines across 5 files.

This prototype already proves the core rendering pipeline works end-to-end
in native TypeScript. Its approach is not necessarily the best approach for
every decision in this epic, but it is the baseline all implementation
stories build from or consciously depart from.

What it delivers:
- `renderer.ts` (443 lines) — full marked-AST → ANSI pipeline. Heading
  dispatch to figlet (H1→doom, H2→slant, H3→shadow, H4→small, H5→smslant)
  with ANSI colour gradient. Inline bold/italic/code/links/strikethrough.
  Tables with unicode box borders and proportional column sizing. Blockquotes
  with │ borders. Lists (ordered + unordered, nested). Code blocks with dark
  background strip and ``` lang header/footer.
- `highlight.ts` (255 lines) — regex-based syntax highlighter (Rich-inspired
  Monokai palette). Separate alternation regexes for Python, TypeScript, Bash.
  Comments dim-gray-italic, strings sage-green, keywords cornflower-blue,
  numbers orange, decorators gold, function names pale-yellow, types sky-blue.
- `utils.ts` (368 lines) — direct port of pi-mono's ANSI utilities:
  visibleWidth (grapheme-aware, Intl.Segmenter + get-east-asian-width),
  wrapTextWithAnsi (preserves ANSI codes across line breaks), padToWidth,
  extractAnsiCode, AnsiCodeTracker.
- `index.ts` (170 lines) — scrollable blessed box, resize-aware re-render,
  vi keys, status bar. Renders hardcoded `PI_README` from content.ts.

What the prototype does NOT have (the work this epic actually does):
- Opens arbitrary .md files (not hardcoded content)
- File picker integration
- Workspace persistence (filePath, scrollOffset)
- Figlet heading config (per-level font, fallback chain, toggle)
- The ANSI-in-Blessed question is answered: `tags: false` + raw ANSI works.
- Per-file heading config saved to workspace state
- All the non-markdown features (tree, motion, panel primitives, timers)

---

## Architecture Decisions

### Rendering strategy — open question, decided in S01

The prototype proves native TS (marked + figlet CLI + ANSI) is viable with
zero Python dependency and no subprocess startup cost. Python Rich as a
subprocess is an alternative path with broader language support for syntax
highlighting but adds a dependency and ~300-500ms cold start.

S01 evaluates both approaches honestly and chooses one. The leading candidate
is the native TS path (prototype evidence), with Rich subprocess as a
stretch-only option for syntax highlighting breadth (F08).

### Figlet heading system — native, proven

figlet-service.ts has 148 fonts with height/width metadata. The prototype
confirms doom/slant/shadow/small/smslant with ANSI colour gradient renders
correctly. The heading pre-pass calls renderFiglet() from figlet-service.ts.

Always pass innerWidth (window body width minus chrome offsets), never raw
terminal width.

Fallback chain: if figlet output exceeds container width, try fallbackFonts
in order. If all overflow, use plain bold ANSI text.

### ANSI in Blessed — resolved by prototype

The prototype uses `tags: false` on the scrollable box and sets raw ANSI
string content. This works. No ANSI→Blessed tag adapter is needed. This
question is closed — do not reopen it.

### pi-tui utils — already ported

The prototype's `utils.ts` is a direct port of pi-mono's ANSI utilities.
Before writing any new ANSI measurement or wrapping code, check whether
utils.ts covers it. For wwdos core, promote these to `src/core/ui-primitives.ts`
rather than duplicating from the module.

### Timed refresh — TS setInterval with lifecycle binding

Bun's `setInterval` is the primitive. Wrap it as createTimer(fn, ms, timers)
where timers is a Set<NodeJS.Timeout> owned by the window and cleared in
onCleanup. Lives in `src/core/ui-primitives.ts`.

### Motion/tween — thin animator over blessed numeric properties

`src/services/motion-service.ts` — tween(opts) at 16ms tick with easing
functions ported from Textual's easing.py (already in vendor/textual).
tweenWindowPosition and tweenWindowSize as convenience wrappers.

### Tree component — Blessed-native

Rich's Tree and Textual's Tree share the model: nodes, expand/collapse,
unicode guide lines. Our port is native Blessed — a list-backed widget with
virtual indent rendering. Lives in `src/core/tree-widget.ts`.

---

## Feature Checklist

- [ ] F01 Approach spike — native TS vs subprocess decision + gap analysis
- [ ] F02 Markdown viewer — port prototype into core service + general file opener
- [ ] F03 Figlet heading config — per-level schema, fallback chain, toggle
- [ ] F04 Inline styles + code blocks — verify coverage, fill gaps vs prototype
- [ ] F05 Tree component — collapsible blessed-native TreeWidget
- [ ] F06 Timed refresh primitive — lifecycle-bound createTimer in ui-primitives
- [ ] F07 Motion service — tweenStyle + easing for microapps and window components
- [ ] F09 Panel layout and grid canvas primitives — extract from sy2-chronicles
- [ ] F08 (stretch) Syntax highlighting — evaluate Rich subprocess vs extend regex
- [ ] F10 (stretch) Markdown panels in sy2-chronicles — .md files as live panels

---

## F01 — Approach Spike

### Status
Status: not-started

### S01 — Evaluate rendering approaches, decide, document

The prototype is evidence. This spike evaluates it honestly against alternatives
and produces a decision document all subsequent stories implement against.

Three approaches to evaluate:

A. Python Rich subprocess — `spawnSync("python3", ["-c", ...])`, Console with
   `force_terminal=True`, StringIO capture, ANSI piped into Blessed. Pros:
   full Pygments language coverage, handles markdown-it AST internally. Cons:
   Python dependency, ~300-500ms cold start, subprocess-per-render unless
   long-running helper process added.

B. Native TS — marked AST tokeniser + figlet-service.ts + regex highlighter
   as in prototype. Pros: zero new dependencies, no subprocess startup cost,
   full control, already working. Cons: regex highlighter covers only
   Python/TS/Bash unless extended; less battle-tested for edge cases.

C. pi-tui markdown.ts direct port — port the full Markdown class from
   `vendor/pi-mono/packages/tui/src/components/markdown.ts` to Blessed.
   Pros: mature pipeline. Cons: prototype already did most of this; the delta
   between pi-tui Markdown and the prototype's renderer.ts is small.

Tasks:
- [ ] Read prototype's renderer.ts in full; identify any gaps vs a real-world
      .md file (the pi-mono README is a good stress test)
- [ ] Run the prototype on 3 representative .md files from the wwdos repo and
      note any rendering failures
- [ ] Write `scripts/rich-bridge-test.sh` that measures Python Rich subprocess
      cold-start latency on 3 file sizes
- [ ] Compare: what does Python Rich give us that the prototype doesn't?
- [ ] Decision: choose approach B (native TS) or A (subprocess) or hybrid
      (B for body, A for syntax highlighting stretch)
- [ ] Write `S01-findings.md` with the decision and rationale

AC-1: S01-findings.md exists with: approach chosen, latency numbers for option A,
gap analysis for option B, decision rationale.
Test: `cat .planning/epics/e026-rich-text-layout-system/S01-findings.md`

AC-2: Prototype renderer correctly handles a real .md file from the wwdos repo
(e.g. AGENTS.md) without crashing.
Test: load AGENTS.md through prototype renderer, screenshot output.

---

## F02 — Markdown Viewer Window

### Status
Status: not-started

The prototype's rendering pipeline is the foundation. This feature promotes it
from a hardcoded demo into a general-purpose markdown viewer that opens any
file and integrates with wwdos workspace persistence.

Prototype reference: `wibwob-sdk/modules/pi-markdown-reader/renderer.ts` +
`utils.ts` + `highlight.ts` + `index.ts`. Read before implementing any story
in this feature.

### S02 — Promote rendering pipeline to wwdos core service

Extract the prototype's rendering code into wwdos-core as a proper service.
Do not copy-paste — the prototype is the authoritative source; import or port
cleanly with full attribution.

Tasks:
- [ ] Create `src/services/markdown-service.ts`:
      - `renderMarkdown(text, width, opts?) → string[]` — port from prototype
        renderer.ts. Same pipeline: marked.lexer → renderToken dispatch →
        wrapTextWithAnsi → padToWidth.
      - `isMarkdownFile(path) → boolean` — extension check (.md, .markdown)
      - `renderMarkdownFile(filePath, width, opts?) → string[]` — read + render
- [ ] Promote prototype utils.ts to `src/core/ansi-utils.ts`:
      export `visibleWidth`, `wrapTextWithAnsi`, `padToWidth`, `extractAnsiCode`,
      `AnsiCodeTracker`. These replace any existing stringWidth usage for ANSI
      content. Add to `src/core/primitives.ts`.
- [ ] Promote prototype highlight.ts to `src/services/syntax-highlight.ts`:
      export `highlightCode(text, lang) → string[]`. Currently covers Python,
      TypeScript, Bash. Document extension points for new languages.
- [ ] Unit tests:
      - `renderMarkdown("# Hello\n\n**bold**", 80)` returns lines containing
        ANSI for figlet output + bold escape codes
      - `visibleWidth` correct for emoji, CJK, plain ASCII
      - `wrapTextWithAnsi` preserves ANSI codes across wrap point
- [ ] `bun run typecheck` clean

AC-1: `import { renderMarkdown } from "src/services/markdown-service"` works.
Test: `bun run typecheck` + `bun test tests/unit/markdown-service.test.ts`

AC-2: `visibleWidth("hello 👋")` returns 8 (not 7).
Test: `bun test tests/unit/ansi-utils.test.ts`

### S03 — MarkdownViewer window — general file opener

New window type `markdown-viewer`. The prototype's index.ts is the structural
reference — promote from hardcoded content to arbitrary file opener.

Tasks:
- [ ] Extend `WindowKind` with `"markdown-viewer"`
- [ ] Factory in `src/windows/markdown-viewer-window.ts`. Pattern: follows
      prototype's index.ts structure (scrollBox + statusBar + resize re-render)
      but opens a file from disk rather than PI_README.
- [ ] Wire `open_markdown_viewer` in command-catalog.ts (File menu + palette)
- [ ] On open: show overlay file picker filtered to *.md; on select call
      `renderMarkdownFile(path, innerWidth)` and set scrollBox content
- [ ] Resize handler: re-render at new width (same cache-by-width pattern as
      prototype's `lastWidth` guard)
- [ ] Status bar: line position + percentage (port from prototype)
- [ ] Keybindings: j/k/d/u/g/G/q (port from prototype)
- [ ] `describeState()`: appType, filePath, scrollOffset, rendererMode
- [ ] Workspace snapshot: round-trips filePath + scrollOffset; restore reopens
      file at saved position
- [ ] `POST /windows/markdown-viewer {filePath}` in control-api.ts
- [ ] `bun run typecheck` clean

AC-1: Opening AGENTS.md via command palette shows rendered markdown — figlet
H1/H2, bold, code blocks with dark background.
Test: screenshot `./scripts/screenshot-window.sh "Markdown Viewer"`

AC-2: Resize triggers re-render at new width; no crash.
Test: resize via API, screenshot before/after.

AC-3: `GET /state` includes markdown-viewer with filePath and scrollOffset.
Test: `curl .../state | jq '.windows[] | select(.appType=="markdown-viewer")'`

AC-4: Workspace restore reopens file at saved scroll position.
Test: scroll to line 30, save workspace, restart, confirm position via state API.

---

## F03 — Figlet Heading Config

### Status
Status: not-started

The prototype hardcodes doom/slant/shadow/small/smslant with a fixed colour
gradient. This feature makes heading configuration explicit, per-level, and
overridable per viewer instance. The font choices and colour gradient from the
prototype are the defaults.

### S04 — FigletHeadingConfig schema and defaults

Tasks:
- [ ] Define `FigletHeadingLevel` and `FigletHeadingConfig` in `src/core/types.ts`:
      ```ts
      interface FigletHeadingLevel {
        font: string;            // figlet font name (from 148-font catalogue)
        fallbackFonts: string[]; // tried in order if primary overflows width
        color: string;           // ANSI escape prefix e.g. "\x1b[96m"
        plainFallback: boolean;  // bold ANSI text if all fonts overflow
      }
      interface FigletHeadingConfig {
        h1: FigletHeadingLevel;  // default: doom + bright cyan
        h2: FigletHeadingLevel;  // default: slant + bright blue
        h3: FigletHeadingLevel;  // default: shadow + bright magenta
        h4: FigletHeadingLevel;  // default: small + bright yellow
        h5: FigletHeadingLevel;  // default: smslant + bright green
        h6: FigletHeadingLevel;  // default: term + dim (no figlet art)
      }
      ```
- [ ] `DEFAULT_FIGLET_HEADING_CONFIG` in `src/core/defaults.ts` — mirrors the
      prototype's HEADING_FONTS and HEADING_COLORS exactly as the baseline
- [ ] Export from `src/core/primitives.ts`
- [ ] `bun run typecheck` clean

AC-1: Type compiles and DEFAULT_FIGLET_HEADING_CONFIG is importable.
Test: `bun run typecheck`

### S05 — Heading pre-pass service + viewer integration

Tasks:
- [ ] Integrate heading rendering into markdown-service.ts:
      `renderToken` dispatches headings through FigletHeadingConfig rather
      than hardcoded font array. Pass config as an opts parameter.
- [ ] Wrapping policy: if figlet output exceeds innerWidth, try fallbackFonts;
      if all fail and plainFallback is true, emit bold ANSI heading; else use
      smallest font that fits. Always pass innerWidth, never terminal width.
- [ ] MarkdownViewer: keybind `h` toggles between figlet and plain headings
      (switches between DEFAULT_FIGLET_HEADING_CONFIG and a plain config)
- [ ] Per-viewer heading config serialised to workspace state so custom font
      assignments survive restart
- [ ] Heading config overridable via control API:
      `PATCH /windows/:id/markdown-heading-config {h1: {font: "big"}}`

AC-1: Opening a .md with H1 and H2 shows figlet art using doom and slant fonts.
Test: screenshot.

AC-2: Pressing `h` switches headings to plain bold text and back.
Test: manual smoke.

AC-3: A heading that overflows at width=40 falls back to a narrower font.
Test: `bun test tests/unit/markdown-heading.test.ts` — render H1 at width=20,
assert all output lines <= 20 chars.

---

## F04 — Inline Styles and Code Blocks

### Status
Status: not-started

The prototype's renderer.ts already handles bold, italic, code spans, links,
strikethrough, tables, blockquotes, and code blocks with dark background.
This feature verifies full coverage, documents any gaps found during S01/S02,
and adds the `c` keybind for copying code blocks.

### S06 — Style coverage audit and gap-fill

Tasks:
- [ ] Run prototype renderer against a comprehensive .md file and list any
      rendering gaps (e.g. nested blockquotes, definition lists, footnotes,
      HTML passthrough)
- [ ] Fix any gaps found in markdown-service.ts
- [ ] Code block copy: `c` key cycles focus to next code block in the viewport;
      `y` copies the raw (un-ANSI-decorated) code to clipboard via `pbcopy`
      (macOS) or `xclip` (Linux)
- [ ] Verify inline code spans render with distinct colour/background (confirmed
      in prototype: `\x1b[38;5;223m\x1b[48;5;236m text \x1b[0m`)
- [ ] Verify links render as underlined text + dim URL in parens (confirmed in
      prototype's theme.link + theme.linkUrl)

Note: ANSI-in-Blessed is solved — `tags: false` + raw ANSI content works.
This is proven by the prototype. Do not add an ANSI→Blessed adapter.

AC-1: Bold, italic, code spans, links, strikethrough all render visually
distinct in the MarkdownViewer.
Test: screenshot of a .md file exercising each style.

AC-2: A .md file with a triple-backtick Python block shows a dark-background
code block with ``` python header and ``` footer.
Test: screenshot.

AC-3: `y` on a focused code block copies raw text to clipboard.
Test: focus code block, press `y`, assert `pbpaste` returns the block content.

---

## F05 — Tree Component

### Status
Status: not-started

Port the concept from Rich's Tree class and pi-tui's SelectList to a native
Blessed collapsible tree widget.

### S07 — TreeWidget

`src/core/tree-widget.ts`

```ts
interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  data?: unknown;
  expanded?: boolean;   // default true
}
```

Tasks:
- [ ] `createTreeWidget(parent, nodes, opts)` — Blessed list-backed widget
      with unicode guide lines (├── └── │) rendered as virtual list rows
- [ ] Keyboard: j/k navigate, Enter/Space expand/collapse, `o` expand all,
      `O` collapse all
- [ ] Mouse: click to select, click indicator to toggle
- [ ] Emit events: `select`, `expand`, `collapse`
- [ ] `setNodes(nodes: TreeNode[])`, `getSelectedNode(): TreeNode | null`
- [ ] Theme tokens for guide line colour, selected row, expand indicator
- [ ] Export from `src/core/primitives.ts`
- [ ] Demo command `open_tree_demo` in command-catalog.ts with a file hierarchy

AC-1: TreeWidget renders nested nodes with guide lines and expand/collapse.
Test: screenshot of tree demo window.

AC-2: j/k navigates; Enter toggles expand/collapse.
Test: manual smoke.

AC-3: `describeState()` on a tree-containing window reports selected node id.
Test: `GET /state` after selecting a node.

---

## F06 — Timed Refresh Primitive

### Status
Status: not-started

Textual's `set_interval(fn, seconds)` bound to widget lifecycle. Our TS
equivalent. This is the missing piece that makes PanelDef `live: true` panels
clean across window open/close cycles.

### S08 — createTimer in ui-primitives.ts

Tasks:
- [ ] Add to `src/core/ui-primitives.ts`:
      ```ts
      type TimerHandle = ReturnType<typeof setInterval>;
      type TimerSet    = Set<TimerHandle>;
      function createTimerSet(): TimerSet
      function createTimer(fn: () => void, ms: number, timers: TimerSet): TimerHandle
      function clearTimers(timers: TimerSet): void
      ```
- [ ] Export from `src/core/primitives.ts`
- [ ] Document the pattern in AGENTS.md: "timed-refresh primitive"

### S09 — Wire into animation-service.ts

Tasks:
- [ ] Convert animation-service.ts FramePlayer to use createTimer instead of
      raw setInterval. Timers owned by the window's TimerSet; cleared in
      onCleanup.
- [ ] Wire MarkdownViewer resize debounce to use createTimer

AC-1: Opening and closing an animated primer 10 times leaves no dangling
setInterval handles.
Test: `bun test tests/unit/timer-cleanup.test.ts`

---

## F07 — Motion Service

### Status
Status: not-started

### S10 — motion-service.ts

`src/services/motion-service.ts`

```ts
interface TweenOptions {
  from: number;
  to: number;
  duration: number;      // ms
  easing?: EasingFn;     // default: easeInOutCubic
  onUpdate: (v: number) => void;
  onComplete?: () => void;
  timers: TimerSet;      // auto-cancelled on window close
}
function tween(opts: TweenOptions): void
const easings: Record<string, EasingFn>
```

Tasks:
- [ ] 16ms tick setInterval via createTimer
- [ ] Easing functions: linear, easeInCubic, easeOutCubic, easeInOutCubic,
      bounce, elastic — port formulas from `vendor/textual/src/textual/css/
      easing.py` (already in vendor tree)
- [ ] `tweenWindowPosition(window, {x, y}, duration, timers)` — animate left/top
- [ ] `tweenWindowSize(window, {w, h}, duration, timers)` — animate width/height
- [ ] Export from `src/services/`

### S11 — API surface

Tasks:
- [ ] Command `animate_window` in command-catalog.ts
- [ ] `POST /windows/:id/animate {property, to, duration}` in control-api.ts
- [ ] State reports in-progress animation

AC-1: `POST /windows/:id/animate {property:"left", to:20, duration:500}` moves
window smoothly.
Test: call endpoint, screenshot at 250ms and 500ms, verify position in GET /state.

AC-2: Animation cancels cleanly when window is closed mid-tween.
Test: start 2s tween, close at 100ms, verify no further state changes.

---

## F09 — Panel Layout and Grid Canvas Primitives

### Status
Status: not-started

`modules/sy2-chronicles/index.ts` contains a battle-tested responsive panel
layout engine and 2D string-canvas API currently locked inside one microapp.
Extract them to SDK. Reference: read sy2-chronicles/index.ts in full first.

### S12 — Extract panel layout engine and grid canvas to primitives

**What to extract from sy2-chronicles:**

`layoutPanels(panels, maxWidth): LayoutResult` — responsive reflow. Wraps
rows when they exceed maxWidth. Respects per-panel `col` hint. Returns
`{ placements: [{id, x, y}], contentWidth, contentHeight }`.

Grid canvas API (pure, no Blessed dependency):
- `blankGrid(w, h)`, `paintText(grid, x, y, text)`, `paintCentered(grid, y, text)`
- `paintLines(w, h, lines, opts?): string` (centerX/centerY options)
- `drawArrow(grid, fromX, fromY, toX, toY)`, `gridToText(grid)`
- `waveLine(width, tick, phaseShift): string`, `bar(label, fill, total, value): string`

Interaction helpers (Blessed-aware, document with JSDoc):
- `measureViewport(canvas): {width, height}` — use `(canvas as any).width/height`,
  NOT `lpos` (stale in scrollable boxes)
- `pointerToContent(canvas, screenX, screenY): {x, y}` — use `atop/aleft`, not `lpos`
- `hitPanel(panelNodes, cx, cy): PanelNode | undefined`

PanelDef / PanelNode / LayoutResult types — formalise as interfaces.

Patterns documented but not extracted (too app-specific; promote when second
consumer exists): drag-to-move (single screen-level handler pattern), inline
double-click edit, resize grip.

Tasks:
- [ ] `src/core/panel-layout.ts` — pure: layoutPanels + types
- [ ] `src/core/grid-canvas.ts` — pure: all 8 grid functions
- [ ] Add measureViewport/pointerToContent/hitPanel to `src/core/ui-primitives.ts`
      with JSDoc on the atop/aleft-vs-lpos distinction
- [ ] Export all from `src/core/primitives.ts`
- [ ] Refactor sy2-chronicles to import from new primitives. Verify no regression.
- [ ] Tests: panel-layout.test.ts (row wrap, col sort, width clamp) +
      grid-canvas.test.ts (centring, wrapping, arrow)
- [ ] `bun run typecheck` clean
- [ ] Document drag-to-move and resize grip patterns in `.agents/invariants.md`

AC-1: sy2-chronicles imports from panel-layout.ts and grid-canvas.ts.
Test: `bun run typecheck`

AC-2: layoutPanels output identical for full PANEL_DEFS array at width=120.
Test: snapshot test vs pre-refactor output.

AC-3: sy2-chronicles opens and renders without regression.
Test: `./scripts/screenshot-window.sh "§y² Chronicles"`

Why panel layout + PanelDef + grid canvas matters beyond sy2-chronicles:
the `content: (tick, w, h) => string` callback pairs with F06 createTimer.
A live panel = `createTimer(() => node.content.setContent(def.content(tick++,
w, h)), 120, timers)`. This is the primitive for any magazine-layout microapp.

---

## F08 (Stretch) — Syntax Highlighting

### Status
Status: not-started

The prototype's highlight.ts covers Python, TypeScript, and Bash via regex.
This stretch feature evaluates whether extending the regex approach or adding
a Python Rich subprocess for syntax highlighting gives better ROI.

### S13 — Evaluate and extend syntax highlighting

Tasks:
- [ ] Audit which languages appear most in wwdos .md files and docs
- [ ] Option A: extend highlight.ts with new regex alternations for top-N
      missing languages (e.g. Bash already there, add JSON, YAML, CSS, SQL)
- [ ] Option B: add `renderSyntax(code, lang, width): string` via Python Rich
      subprocess (Pygments, 500+ languages): `python3 -c "from rich.console
      import Console; from io import StringIO; from rich.syntax import Syntax;
      s=StringIO(); c=Console(file=s, force_terminal=True, width=N);
      c.print(Syntax(code, lang, theme='monokai')); print(s.getvalue())"`
- [ ] Decide based on language coverage vs dependency cost
- [ ] Integrate chosen approach into markdown-service.ts code block renderer
- [ ] Degrade gracefully if chosen approach unavailable

AC-1: A Python code block renders with Monokai syntax colours (at minimum:
keywords, strings, comments visually distinct).
Test: screenshot.

AC-2: An unknown language fence falls back to plain code block without error.
Test: open file with ```brainfuck fence, confirm no crash.

---

## F10 (Stretch) — Markdown Panels in sy2-chronicles

### Status
Status: not-started

Depends on: F02 (markdown-service.ts), F09 (panel-layout primitives)

The sy2-chronicles microapp has a PanelDef system where each panel is a
`content: (tick, w, h) => string` callback. This stretch feature adds a
`MarkdownPanelDef` variant — a panel backed by a .md file, rendered via
markdown-service.ts, displayed as a live panel within the chronicles
scrollable canvas. The result: documentation, notes, or any .md file can
appear as a first-class panel inside the chronicle layout.

This is composability in practice: panel-layout primitives (F09) +
markdown-service (F02) + sy2-chronicles = .md files as subwindows without
a full MarkdownViewer window.

### S14 — MarkdownPanelDef type and renderer

Tasks:
- [ ] Define `MarkdownPanelDef` extending `PanelDef` in `src/core/panel-layout.ts`:
      ```ts
      interface MarkdownPanelDef extends Omit<PanelDef, 'content'> {
        type: 'markdown';
        filePath: string;   // path to .md file, relative to REPO_ROOT
        headingConfig?: FigletHeadingConfig;  // defaults to no figlet (plain)
      }
      ```
- [ ] `createMarkdownPanelContent(def: MarkdownPanelDef): PanelDef['content']` —
      returns a content function `(tick, w, h) => string` that:
      - On first call: reads filePath, calls `renderMarkdown(text, w)` from
        markdown-service.ts, caches result keyed by (w)
      - On resize (w changes): re-renders at new width
      - Returns `cachedLines.slice(0, h).join('\n')` — viewport-clips to panel height
      - tick is unused (markdown panels are static by default unless file changes)
- [ ] File-watch variant (opt-in, `live: true`): if `live` is set, re-render
      when the file mtime changes. Use `fs.statSync` on each tick, re-render
      if mtime differs from cached value. This makes the panel a live preview
      of the .md file.
- [ ] Wire into sy2-chronicles: add 1–2 sample MarkdownPanelDefs pointing at
      real .md files in the repo (e.g. WELCOME.md, NOTES.md) to demonstrate
      the feature. Position them in the layout as regular panels.
- [ ] Height policy: `h` in the MarkdownPanelDef controls the panel viewport
      height. Content taller than h is clipped (no scroll within the panel —
      the parent canvas scrolls). Recommended h = first screenful of the doc.
- [ ] Export `createMarkdownPanelContent` from `src/core/panel-layout.ts`

**Design notes:**

No figlet headings by default — inside a panel, figlet art for headings is
almost always too wide and too tall to be useful. The `headingConfig` override
lets callers opt in to figlet for specific panel sizes if they want it.
Plain bold ANSI headings are the right default for embedded panels.

The viewport-clip (slice to h rows) is intentional. A MarkdownPanel is a
window into a document, not a full reader. Use MarkdownViewer (F02/S03) when
you need scrollable reading. Use MarkdownPanel when you want the doc embedded
in a composition.

The live file-watch pattern (mtime polling on tick) reuses the sy2-chronicles
tick loop already in place. No new timer infrastructure needed — the existing
`setInterval(120)` in openChronicles already drives tick for live panels.

AC-1: Opening sy2-chronicles shows at least one panel rendering the content
of a real .md file with inline styles (bold, code spans) visible.
Test: `./scripts/screenshot-window.sh "§y² Chronicles"` — confirm markdown
panel content is visible and styled.

AC-2: A MarkdownPanel with `live: true` updates when the source .md file is
modified on disk.
Test: open chronicles, edit NOTES.md, confirm panel content updates within
one tick cycle (~120ms).

AC-3: A MarkdownPanel wider than its content does not overflow into adjacent
panels (viewport-clipped to panel inner width).
Test: screenshot at various canvas widths.

AC-4: `createMarkdownPanelContent` is importable from `src/core/panel-layout.ts`
and usable by any microapp — not locked inside sy2-chronicles.
Test: `bun run typecheck` with a test import from a different module.

---

## Notes and Decisions

### Figlet font catalogue — no import needed

Local catalogue `modules/wibwob-figlet-fonts/fonts.json` is identical to the
wibwob-sdk copy (148 fonts, same metadata). No import story required.
figlet-service.ts `getFigletCatalogue()`, `renderFiglet()`, `measureFiglet()`
are the canonical APIs. Never re-implement font discovery.

### pi-tui utils — already ported in prototype

`wibwob-sdk/modules/pi-markdown-reader/utils.ts` is a direct port of pi-mono
utils. S02 promotes this to wwdos core. Do not re-port from vendor/pi-mono
unless the prototype's version is found to be incorrect.

### No Textual CSS port

Textual's CSS layout system is not worth porting. The explicit Blessed layout
model is different in kind. Take inspiration (fr units, docking concepts) but
do not attempt a CSS engine. If auto-layout is needed, start with a simple
flex-row/flex-col helper in panel-layout.ts, not a full cascade.

### Rich subprocess startup cost

If the spike (S01) chooses the subprocess path for any feature, first-call
latency is 300–500ms. Mitigation: cache rendered output per (filePath, mtime,
width), or keep a long-running Python helper process alive. S01 measures and
decides.

---

## Parking Lot

- **Live markdown preview** — side-by-side editor + MarkdownViewer updating as
  you type. Needs debounced re-render and likely long-running Python helper if
  subprocess path chosen. Deferred post F02.
- **Custom syntax theme** — wwdos theme system controls Rich/Pygments theme
  (monokai, dracula, etc.). Deferred post F08.
- **TreeWidget as file manager backbone** — replace flat primer-browser list
  with TreeWidget showing directory hierarchy. Deferred post F05.
- **Drag-to-move panels as SDK primitive** — single screen-level handler
  pattern from sy2-chronicles. Promote when a second microapp needs it.
  Deferred post F09.
- **Inline double-click edit as SDK primitive** — same. Deferred post F09.
- **Animated window entrance/exit** — tweenWindowPosition to slide windows in
  from screen edge on open. Deferred post F07.
