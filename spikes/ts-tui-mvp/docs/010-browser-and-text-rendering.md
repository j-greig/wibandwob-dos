# 010 — Browser & Text Rendering

> Developer handover for the WibWob-DOS TypeScript rebuild.
> Covers the in-TUI web browser, text editor, text document, and ANSI art views.

---

## 1. Browser Pipeline: URL → Readable Text → TUI

The browser is the most complex widget in WibWob-DOS. It spans three layers:

| Layer | Files | Role |
|-------|-------|------|
| **C++ TUI** | `app/browser_view.cpp`, `app/browser_view.h` | Window chrome, keyboard nav, async fetch via `popen`/curl, ANSI-to-cell rendering |
| **Python API** | `tools/api_server/main.py` (endpoints), `tools/api_server/controller.py` (orchestration) | REST endpoints, window state management, history tracking |
| **Pipeline** | `tools/api_server/browser_pipeline.py` | Fetch HTML, extract article, convert to markdown, render images via chafa |

### 1.1 Fetch Pipeline (browser_pipeline.py)

```
URL
 │
 ├─ Edge Markdown Probe ── sends Accept: text/markdown header
 │   │                      if server returns markdown directly, skip extraction
 │   └─ Fallback: full HTML fetch
 │
 ├─ Content Extraction (one of):
 │   ├─ trafilatura.extract() — 3 attempts with decreasing fidelity
 │   ├─ readability-lxml Document().summary() — fallback
 │   └─ _html_to_markdown() — raw regex stripping
 │
 ├─ Link Extraction ── regex over <a> tags, deduped, re-numbered
 │
 ├─ Image Asset Extraction ── regex over <img> tags → asset list
 │
 ├─ Image Rendering (per asset, budget-limited):
 │   ├─ HTTP fetch image bytes
 │   ├─ PIL dimension probe (reject >4096px)
 │   ├─ chafa --size WxH --format symbols --animate off
 │   └─ JSON cache (by source_hash + mode + width + backend)
 │
 └─ render_markdown() ── assemble final TUI text with image blocks
```

### 1.2 `fetch_render_bundle()` Return Shape

```typescript
interface RenderBundle {
  url: string;
  title: string;
  markdown: string;        // Clean extracted article
  tui_text: string;        // Pre-rendered for TUI display (may include ANSI image blocks)
  links: Array<{ id: number; text: string; url: string }>;
  assets: ImageAsset[];    // Per-image render status + ANSI blocks
  meta: {
    fetched_at: string;
    cache: "hit" | "miss";
    source_bytes: number;
    cache_key: string;
    image_mode: string;
    source_format: "html_reader" | "edge_markdown";
    edge_markdown_tokens?: string;
    edge_content_type?: string;
    edge_server?: string;
  };
}
```

### 1.3 C++ TUI ↔ Python Communication

The C++ browser window (`TBrowserWindow`) communicates with the Python API server via **popen + curl**:

```
TBrowserWindow::startFetch()
  → popen("curl -s -X POST http://127.0.0.1:8089/browser/fetch_ext ...")
  → Non-blocking read via fcntl(O_NONBLOCK)
  → Timer-driven poll (100ms interval) via TWindow::setTimer()
  → On EOF: finishFetch() parses JSON response
```

Key detail: The C++ side has its own **hand-rolled JSON string extractor** (`extractJsonStringField`) with full `\uXXXX` Unicode escape + surrogate pair decoding. This exists because the C++ app doesn't link a JSON library.

### 1.4 TS Rebuild: Unified Pipeline

In TypeScript, this simplifies dramatically:

```
fetch(url) → response.text()
  → readability / @mozilla/readability (JSDOM)
  → turndown (HTML→Markdown)
  → JSON.parse() for API responses
```

The Python pipeline can either:
- **(A) Stay as-is** — TS TUI calls the same `/browser/fetch_ext` endpoint, treats it as a service
- **(B) Port to TypeScript** — use `@mozilla/readability` + `turndown` + `sharp` for image handling

Option B eliminates the Python dependency entirely but loses trafilatura (no JS equivalent with the same quality).

---

## 2. Image Handling (Chafa Conversion)

### 2.1 Image Modes

The browser supports four image rendering modes, cycled via the `i` key:

| Mode | Behaviour | Asset Selection |
|------|-----------|-----------------|
| `none` | No images | Skip all |
| `key-inline` | Hero + first 4 images inline | First `KEY_INLINE_MAX_IMAGES` (4) |
| `all-inline` | All images inline in article flow | All assets |
| `gallery` | All images rendered (same as all-inline currently) | All assets |

### 2.2 Chafa Render Pipeline

```
_render_asset()
  ├─ Check image cache (SHA256 of source_url + mode + width + backend)
  ├─ HTTP fetch image bytes (max 10MB)
  ├─ PIL dimension probe (max 4096×4096)
  ├─ target_width = page_width × 0.5 (IMAGE_WIDTH_RATIO)
  ├─ height = max(1, min(34, width/2)) (MAX_IMAGE_HEIGHT_CELLS)
  └─ subprocess: chafa --size WxH --format symbols --animate off tmp.img
       └─ Returns ANSI escape sequence string (the "ansi_block")
```

**Budget system**: Total 10s budget across all images, 3s per image. If budget exhausted, remaining assets get `status: "deferred"`.

### 2.3 Cache System

Two-tier caching:
1. **Bundle cache**: `cache/browser/{sha256_key}/bundle.json` — full render bundle
2. **Image cache**: `cache/browser/images/{sha256_key}.json` — per-image ANSI block + render metadata

Cache is busted on `PIPELINE_CACHE_VERSION` change (currently `"v9"`).

### 2.4 TS Rebuild Recommendation

For the terminal-based TS rebuild, image rendering options:
- **Keep chafa**: Shell out to `chafa` — it's the best-in-class for terminal art. Use `child_process.execFile()`.
- **Use sixel/kitty protocols**: Modern terminals support pixel-perfect images via these protocols. Libraries like `terminal-image` or `term-img` handle detection.
- **Use canvas-to-text**: For headless/web environments, pre-render server-side.

The budget system and caching are good patterns to keep.

---

## 3. Navigation: Back, Forward, Refresh, History Stack

### 3.1 C++ Side (TBrowserWindow)

The C++ browser maintains its own history stack:

```cpp
std::vector<std::string> urlHistory;  // Linear URL list
int historyIndex = -1;                // Current position

pushHistory(url)    // Truncates forward history, appends, moves index
navigateBack()      // Decrements index, re-fetches
navigateForward()   // Increments index, re-fetches
```

Navigation truncates forward history on new navigation (standard browser behaviour).

### 3.2 Python API Side (Controller)

The controller also tracks history **per window** in `win.props`:

```python
win.props["history"]       # List[str] of URLs
win.props["history_index"] # int, current position
```

API endpoints:
- `POST /browser/{window_id}/back` — decrement index, re-navigate
- `POST /browser/{window_id}/forward` — increment index, re-navigate  
- `POST /browser/{window_id}/refresh` — re-fetch current URL

### 3.3 Dual History Stacks Problem

There is **duplicated state**: both C++ and Python track history independently. The C++ side manages its own stack for keyboard-driven navigation (`b`/`f` keys), while the Python side manages it for API-driven navigation. They can diverge.

### 3.4 TS Rebuild Recommendation

Consolidate to a single history model:

```typescript
interface BrowserHistory {
  entries: Array<{ url: string; title: string; scrollY: number }>;
  index: number;
  
  push(url: string): void;     // Truncates forward, appends
  back(): string | null;
  forward(): string | null;
  current(): string | null;
  canGoBack(): boolean;
  canGoForward(): boolean;
}
```

Store scroll position per history entry so back-navigation restores position. Single source of truth — no dual stacks.

---

## 4. Browser Tools

### 4.1 Clip (`/browser/{window_id}/clip`)

Saves current page markdown to a file:

```python
async def browser_clip(window_id, path=None, include_images=False):
    # Default path: clips/{window_id}.md
    # If include_images: appends image status/ANSI blocks as markdown
    # Writes to disk
```

### 4.2 Copy (`/browser/{window_id}/copy`)

Copies content to system clipboard:

- **Formats**: `plain` (ANSI stripped), `markdown`, `tui` (with ANSI)
- **Image URLs**: Optionally appends resolved image URLs
- Uses `_copy_text_to_system_clipboard()` — presumably calls `pbcopy`/`xclip`

The C++ side also has `copyPageToClipboard()` which:
1. Gets the plain text from `latestMarkdown`
2. Flattens markdown links: `[label](url)` → `label\nurl`
3. Appends collected image source URLs
4. Writes to clipboard via `THardwareInfo::setClipboardText()`

### 4.3 Find (`/browser/{window_id}/find`)

Simple substring search (case-insensitive) on `tui_text`:

```python
idx = text.lower().find(query.lower())
return {"ok": idx >= 0, "index": idx, "direction": direction}
```

No highlighting or match cycling currently — just returns whether found and position.

### 4.4 Extract Links (`/browser/{window_id}/extract_links`)

Returns the link list from `win.props["links"]`, optionally filtered by regex pattern:

```python
async def browser_extract_links(window_id, pattern=None):
    links = list(win.props.get("links", []))
    if pattern:
        rx = re.compile(pattern)
        links = [l for l in links if rx.search(url) or rx.search(text)]
    return {"ok": True, "links": links}
```

### 4.5 Summarise (`/browser/{window_id}/summarise`)

Naive summarisation — truncates markdown to 400 chars:

```python
summary = (text[:400] + "...") if len(text) > 400 else text
```

Opens a new text editor window with the summary. No LLM integration here (the "AI" summarisation may be handled elsewhere via MCP tools).

### 4.6 Gallery Mode (`/browser/{window_id}/gallery`)

`browser_toggle_gallery()`:
1. Sets window's `image_mode` to `"gallery"`
2. Creates a companion text_view window listing all assets
3. Stores `gallery_window_id` in props for reuse

### 4.7 TS Rebuild Recommendation

All tools map cleanly to TypeScript. Consider:
- **Find**: Add match highlighting and `next`/`prev` cycling (current impl is minimal)
- **Summarise**: Wire to an LLM endpoint instead of truncation
- **Clip**: Use the TS filesystem API; consider clipboard libraries like `clipboardy`
- **Gallery**: Render as a proper grid/tile view rather than text list

---

## 5. Browser AI Tools

No dedicated "ask questions about page content" endpoint was found in the current Python API. The `browser_summarise` endpoint does basic truncation only.

AI capabilities are likely delivered via **MCP (Model Context Protocol) tools** that:
1. Call `browser_get_content(window_id, format="markdown")` to get page content
2. Pass the content to an LLM as context
3. Return the LLM response to the user

### TS Rebuild Recommendation

Implement a `browser_ask` tool:

```typescript
interface BrowserAskRequest {
  window_id: string;
  question: string;
  context_format: "markdown" | "text";  // How much of the page to include
  max_context_chars?: number;           // Token budget for context
}
```

This should:
1. Retrieve page markdown from browser state
2. Truncate to token budget
3. Call LLM with `system: "Answer based on this web page"` + page content + user question
4. Return structured response

---

## 6. Render Modes and Width Clamping

### 6.1 Render Modes

Two orthogonal mode axes:

**Headings mode** (`render_mode`):
| Value | Effect |
|-------|--------|
| `plain` | Headings left as markdown `# H1`, `## H2` etc. |
| other | Headings replaced with `[H1]`, `[H2]`, `[H3]` prefixes |

**Image mode** (`image_mode`): See §2.1 above.

Set via `POST /browser/{window_id}/set_mode` with optional `headings` and `images` params. Triggers re-render of current page.

### 6.2 Width Clamping

Width flows through the pipeline at multiple points:

1. **C++ side**: `targetWidth = max(20, contentView->size.x)` — sent as JSON field in fetch request
2. **Pipeline**: `_clamp_width(width)` → `max(20, min(width, 120))` — caps at `MAX_RENDER_WIDTH_CELLS = 120`
3. **Image rendering**: `target_width = max(20, int(width_cells * 0.5))` — images get half the page width
4. **Text output**: `render_markdown()` normalises whitespace but doesn't do column wrapping — that's left to the TUI view

The C++ `TBrowserContentView` does **not** word-wrap in its `rebuildWrappedLines()` — it parses ANSI lines and renders them with horizontal scroll. The `TTextEditorView` does wrap (see §8).

### 6.3 Content Size Limits

```python
MAX_TUI_TEXT_CHARS = 1_200_000    # Total output cap
MAX_IMAGE_SECTION_CHARS = 900_000  # Image ANSI blocks budget
```

Body text gets ~60% of budget, image blocks get the rest. Oversized image sections are truncated with a `[images truncated: N more]` marker.

### 6.4 TS Rebuild Recommendation

- Keep the width-clamping pipeline — it prevents render blowout
- Add **responsive re-render on resize**: when terminal width changes, re-run `render_markdown()` with new width
- Consider **lazy image rendering**: only render images that are within the viewport + small lookahead

---

## 7. ANSI Parsing (Shared Infrastructure)

Both the browser view and the ANSI view parse ANSI escape sequences. There are **two independent parsers**:

### 7.1 Browser View Parser (`browser_view.cpp`)

Full RGB colour support:
- SGR 0 (reset), 1 (bold), 22 (unbold)
- 30–37, 90–97 (standard + bright foreground)
- 40–47, 100–107 (standard + bright background)
- 38;2;R;G;B (24-bit foreground), 48;2;R;G;B (24-bit background)
- 38;5;N (256-colour foreground), 48;5;N (256-colour background)
- 39 (default fg), 49 (default bg)

Produces `StyledLine` = vector of `{text, TColorAttr}` segments.

### 7.2 ANSI View Parser (`ansi_view.cpp`)

Minimal MVP parser:
- SGR 0, 1, 22
- 30–37 (fg), 40–47 (bg), 39, 49
- Bold treated as bright (fg += 8 if < 8)
- No 256-colour or 24-bit support
- Handles C-style escaped files (`\x1b` → real ESC byte)
- Tab expansion (8-column stops)

### 7.3 TS Rebuild Recommendation

Consolidate to **one ANSI parser** that handles the full SGR spec:

```typescript
interface StyledCell {
  char: string;
  fg: RGBColor;
  bg: RGBColor;
  bold: boolean;
  // italic, underline, etc. as needed
}

type StyledLine = StyledCell[];

function parseAnsi(text: string, defaults?: { fg: RGBColor; bg: RGBColor }): StyledLine[];
```

Libraries to consider:
- **ansi-parser** / **anser**: Parse ANSI to structured tokens
- **chalk**: For generating ANSI output
- Roll your own: The parser is small (~100 lines in TS) and avoids dependency risk

The xterm 256-colour lookup table (`xtermToRgb` in `browser_view.cpp`) should be ported — it's 16 named colours + 216 colour cube + 24 greyscale ramp.

---

## 8. Text Editor View (`text_editor_view.cpp`)

### 8.1 Architecture

```
TTextEditorWindow (TWindow)
  ├── TScrollBar (vertical)
  └── TTextEditorView (TView)
        ├── lines: vector<string>        // Logical lines
        ├── visualMap: vector<VisualLine> // Wrapped display lines
        ├── cursor: {line, col}
        └── scroll: {top, left}
```

### 8.2 Visual Line Mapping

The editor maintains a `visualMap` that maps logical lines to display lines for word wrap:

```cpp
struct VisualLine {
    size_t logicalLine;  // Index into lines[]
    size_t startCol;     // Offset within logical line
    size_t len;          // Characters in this visual line
};
```

When `wordWrap` is enabled, logical lines are hard-broken at `size.x` columns (no word-boundary awareness — intentional simplification for predictable cursor math).

### 8.3 Editing Capabilities

| Key | Action |
|-----|--------|
| Arrow keys | Move cursor (visual-line aware for up/down) |
| Home/End | Start/end of visual line (wrap-aware) |
| PgUp/PgDn | Scroll by viewport height |
| Enter | Split line at cursor |
| Backspace | Delete char before cursor, or join with previous line |
| Delete | Delete char at cursor, or join with next line |
| Printable chars | Insert at cursor position |

### 8.4 Content API (`sendText`)

The editor can be programmatically controlled:

```cpp
void sendText(const std::string& content, const std::string& mode, const std::string& position);
// mode: "replace" | "append" | "insert"
// position: "cursor" | "start" | "end"
```

Also supports **FIGlet rendering**:

```cpp
void sendFigletText(const std::string& text, const std::string& font, int width, const std::string& mode);
// Renders text through figlet_utils, inserts result into editor
```

### 8.5 What's Missing

- No selection / copy / cut / paste
- No undo/redo
- No syntax highlighting
- No file save/load (content is set via API only)
- Word wrap is hard-break only (no word boundary awareness)
- Only ASCII printable chars (32–126) accepted

### 8.6 TS Rebuild Recommendation

For a TypeScript TUI editor, use an existing library:
- **blessed-contrib** textarea widget
- **@xterm/xterm** with a custom editor layer
- **codemirror** (if targeting a web-based TUI)

If rolling your own, the visual-line mapping pattern from the C++ is solid — port the `VisualLine` concept. But add:
- Selection model (anchor + cursor range)
- Undo/redo (operation log or immutable document model)
- UTF-8 awareness for cursor movement (use `Intl.Segmenter` or grapheme-splitter)

---

## 9. Text Document View (`text_doc_window.cpp`)

### 9.1 Architecture

This is the simplest of the three text views — it's a thin wrapper around Turbo Vision's built-in `TEditWindow`/`TFileEditor`:

```cpp
TWindow* createTextDocumentWindow(const TRect &bounds, int windowNumber) {
    return new TEditWindow(bounds, TStringView(""), windowNumber);
}

void initializeTextDocumentFromString(TWindow *w, const std::string &text) {
    // Casts to TEditWindow, gets editor, inserts text
    ew->editor->insertText(text.c_str(), text.size(), False);
}
```

### 9.2 Capabilities

Inherits all of `TFileEditor`/`TEditor`:
- Full text editing (selection, copy, paste, undo)
- Scrolling with scroll bars
- File open/save dialogs
- Search and replace
- Word wrap toggle

### 9.3 TS Rebuild Recommendation

This is a "rich editor" window. In the TS rebuild, you could:
- Reuse the same editor component from §8 with full features enabled
- Or embed a proper editor (Monaco, CodeMirror) if targeting a web-based TUI
- The key requirement is API-injectable content (`initializeTextDocumentFromString`)

---

## 10. ANSI View (`ansi_view.cpp`)

### 10.1 Architecture

```
TAnsiMiniWindow (TWindow)
  ├── TScrollBar (horizontal, from standardScrollBar)
  ├── TScrollBar (vertical, from standardScrollBar)
  └── TAnsiMiniView (TScroller)
        ├── lines: vector<AnsiLine>  // Pre-parsed styled lines
        ├── state: AttrState         // Current SGR state during parse
        └── docWidth, docHeight      // Document dimensions
```

### 10.2 File Loading

`loadFile(path)`:
1. Reads entire file as binary
2. **Unescapes C-style escapes**: Detects `\x1b`, `\n` literals and converts to real bytes
3. Parses byte-by-byte:
   - CR/LF → new line
   - Tab → expand to 8-column stops
   - ESC`[`...`m` → apply SGR to state
   - Other bytes → accumulate into current segment
4. Builds `AnsiLine` = vector of `{text, TColorAttr}` segments

### 10.3 Drawing

Standard `TScroller` pattern — draws visible rows from `delta.y`, columns from `delta.x`:
- Iterates segments per line
- Skips segments before horizontal scroll offset
- Clips segments to viewport width
- Fills remainder with spaces

### 10.4 Limitations

- Only basic 16-colour SGR (no 256/24-bit)
- No cursor movement sequences (CSI H, CSI A/B/C/D)
- No screen clear (CSI J/K)
- No Unicode width awareness (CJK double-width chars)
- Bold = bright foreground only

### 10.5 TS Rebuild Recommendation

Port the ANSI view as a **read-only styled text viewer** that shares the unified ANSI parser from §7.3:

```typescript
class AnsiView extends ScrollableView {
  private lines: StyledLine[] = [];
  
  loadFile(path: string): void {
    const raw = fs.readFileSync(path);
    const unescaped = unescapeCStyleEscapes(raw);
    this.lines = parseAnsi(unescaped.toString());
    this.setScrollLimits();
  }
  
  loadString(content: string): void {
    this.lines = parseAnsi(content);
    this.setScrollLimits();
  }
}
```

The `loadString()` variant is useful for the browser view's inline ANSI image blocks.

---

## 11. Summary: Shared Patterns & Consolidation Opportunities

### Components to Consolidate

| C++ Component | Count | TS Target |
|---------------|-------|-----------|
| ANSI parsers | 2 (browser_view, ansi_view) | 1 shared `parseAnsi()` |
| Styled line model | 2 (`StyledLine`, `AnsiLine`) | 1 shared `StyledLine` type |
| JSON parsing | Hand-rolled in C++ | `JSON.parse()` |
| HTTP fetching | `popen` + curl (C++), `requests` (Python) | `fetch()` or `undici` |
| Text wrapping | `text_wrap.h` (shared), hard-break in editor | 1 shared `wrapText()` |
| History tracking | 2 (C++ stack, Python props) | 1 shared `BrowserHistory` |

### Architecture for TS Rebuild

```
┌─────────────────────────────────────────────────┐
│                 TS TUI Application               │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Browser  │  │  Editor  │  │   ANSI View   │  │
│  │  Window  │  │  Window  │  │    Window     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │            │
│  ┌────┴──────────────┴───────────────┴────────┐  │
│  │         Shared Styled Text Renderer         │  │
│  │  parseAnsi() · wrapText() · StyledLine     │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                           │
│  ┌────────────────────┴───────────────────────┐  │
│  │            Scrollable View Base             │  │
│  │  viewport · delta · keyboard scroll        │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │          Browser Pipeline Service           │  │
│  │  fetch → extract → markdown → render        │  │
│  │  image cache · chafa · history             │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Key Decisions for TS Rebuild

1. **Keep or replace Python API?** — If only the browser pipeline uses Python, consider porting to TS. If other features depend on it, keep it as a service.
2. **Readability library**: `@mozilla/readability` (JSDOM) is the JS equivalent of readability-lxml. No direct JS equivalent for trafilatura — consider `defuss/readability` or server-side trafilatura.
3. **Image rendering**: Keep shelling out to `chafa` — it's the gold standard. Add sixel/kitty protocol support as enhancement.
4. **ANSI parser**: Write once, share across browser and ANSI views. ~150 lines of TS for full SGR support.
5. **Editor**: Decide early if you want a basic textarea or a full code editor. The C++ version is minimal — the TS version should at least add selection + clipboard.
