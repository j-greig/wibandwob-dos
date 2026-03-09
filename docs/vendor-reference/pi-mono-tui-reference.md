# Pi-Mono TUI Technical Reference

A comprehensive deep dive into the `@mariozechner/pi-tui` TypeScript terminal UI library. This document covers the core rendering model, components, and architecture.

## Table of Contents

1. [Core Rendering Model](#core-rendering-model)
2. [Component Interface](#component-interface)
3. [Text Utilities & Width Handling](#text-utilities--width-handling)
4. [Box & Layout System](#box--layout-system)
5. [Text Components](#text-components)
6. [Input Component](#input-component)
7. [Editor Component](#editor-component)
8. [Select List Component](#select-list-component)
9. [Markdown Component](#markdown-component)
10. [Loader & Animation](#loader--animation)
11. [Image Rendering](#image-rendering)
12. [Key Handling & Keybindings](#key-handling--keybindings)
13. [Overlay System](#overlay-system)
14. [Terminal Interface](#terminal-interface)
15. [Comparison vs Blessed](#comparison-vs-blessed)

---

## Core Rendering Model

### Architecture Overview

The TUI operates on a **differential rendering** model that only redraws what changed:

```
┌─────────────────────────────────────────────────────┐
│  TUI (Container extends)                             │
│  - Manages component tree                            │
│  - Tracks previous render state                      │
│  - Handles input and resize events                   │
│  - Manages overlays and focus                        │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│  render(width) → string[]                            │
│  - Recursively renders all children                  │
│  - Composes overlay graphics on top                  │
│  - Returns terminal output as array of lines         │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│  Differential Rendering Strategy Selection           │
│  1. First render → output all lines (no clear)       │
│  2. Width/height changed → full re-render (clear)    │
│  3. Change above viewport → full re-render (clear)   │
│  4. Normal update → move to first changed line,      │
│     clear to end, render changed lines only          │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│  Synchronized Output (CSI 2026)                      │
│  - All updates wrapped in \x1b[?2026h ... \x1b[?2026l
│  - Prevents visible flicker during redraw            │
└─────────────────────────────────────────────────────┘
```

### Render Loop Execution

From `tui.ts` `doRender()` method:

```typescript
// Core rendering phases:

// 1. Render all components to lines
let newLines = this.render(width);

// 2. Composite overlays on top of content
if (this.overlayStack.length > 0) {
    newLines = this.compositeOverlays(newLines, width, height);
}

// 3. Extract cursor position for IME (before applying line resets)
const cursorPos = this.extractCursorPosition(newLines, height);

// 4. Apply SGR reset + OSC 8 reset to each line
newLines = this.applyLineResets(newLines);

// 5. Differential compare: find first and last changed lines
let firstChanged = -1, lastChanged = -1;
for (let i = 0; i < maxLines; i++) {
    const oldLine = previousLines[i] ?? "";
    const newLine = newLines[i] ?? "";
    if (oldLine !== newLine) {
        if (firstChanged === -1) firstChanged = i;
        lastChanged = i;
    }
}

// 6. Select rendering strategy:
if (previousLines.length === 0) {
    // First render - output all without clearing scrollback
    fullRender(false);
} else if (widthChanged || heightChanged) {
    // Terminal resized - full clear and re-render
    fullRender(true);
} else if (firstChanged === -1) {
    // No changes - just position hardware cursor
    positionHardwareCursor(cursorPos, newLines.length);
} else {
    // Differential: move to first changed, clear to end, render changed lines
    // 6a. Check if change is above visible viewport
    if (firstChanged < previousContentViewportTop) {
        fullRender(true);
    } else {
        // 6b. Calculate cursor movements and render only changed range
        buffer = `\x1b[?2026h`; // Begin synchronized output
        // Move cursor to first changed line
        // Clear changed lines
        // Render changed lines (firstChanged to lastChanged only, NOT all lines to end)
        buffer += `\x1b[?2026l`; // End synchronized output
        terminal.write(buffer);
    }
}

// 7. Position hardware cursor for IME if needed
positionHardwareCursor(cursorPos, newLines.length);
```

**Key insight**: The TUI renders only the **firstChanged to lastChanged** range, not all lines from firstChanged to the end. This minimizes flicker for single-line changes (e.g., spinner animations).

### Viewport Tracking

The TUI maintains three cursor position concepts:

- **`cursorRow`**: End of rendered content (used for viewport calculation)
- **`hardwareCursorRow`**: Actual terminal cursor position (used for movement)
- **`maxLinesRendered`**: Maximum lines ever rendered (grows, doesn't shrink unless cleared)
- **`scrollOffset`** (in Editor): Which lines are visible at the top

### First Render vs Full Redraw

**First Render** (when `previousLines.length === 0`):
- Output all lines without clearing scrollback
- Assumes terminal starts clean
- No `\x1b[2J` (clear screen) because scrollback is preserved

**Full Redraw** (terminal resize, width change, or change above viewport):
```typescript
let buffer = "\x1b[3J\x1b[2J\x1b[H"; // Clear scrollback, screen, home
for (let i = 0; i < newLines.length; i++) {
    if (i > 0) buffer += "\r\n";
    buffer += newLines[i];
}
```

---

## Component Interface

### Component Contract

All components implement:

```typescript
interface Component {
    // Required: Render to array of lines for given width
    render(width: number): string[];
    
    // Optional: Handle keyboard input when component has focus
    handleInput?(data: string): void;
    
    // Optional: Clear any cached render state
    invalidate?(): void;
    
    // Optional: Component wants key release events (Kitty protocol)
    wantsKeyRelease?: boolean;
}
```

**Line width contract**: Each line returned by `render(width)` **must not exceed `width`** visible columns. The TUI will error if a line is too wide. Use `visibleWidth()` to measure and `truncateToWidth()` or `sliceByColumn()` to truncate.

### Focusable Interface (IME Support)

For components with text cursors that need proper IME (Input Method Editor) positioning:

```typescript
interface Focusable {
    focused: boolean;  // Set by TUI when focus changes
}
```

When a `Focusable` component has focus:
1. Emit `CURSOR_MARKER` (zero-width APC sequence `\x1b_pi:c\x07`) at the cursor position
2. TUI finds the marker in rendered output, positions hardware cursor there
3. IME candidate windows appear at correct location for CJK input

Example:

```typescript
export const CURSOR_MARKER = "\x1b_pi:c\x07";

class MyInput implements Component, Focusable {
    focused: boolean = false;
    
    render(width: number): string[] {
        const beforeCursor = value.slice(0, cursor);
        const atCursor = value[cursor] ?? " ";
        const afterCursor = value.slice(cursor + 1);
        
        const marker = this.focused ? CURSOR_MARKER : "";
        const cursorChar = `\x1b[7m${atCursor}\x1b[27m`; // Inverse video
        
        return [beforeCursor + marker + cursorChar + afterCursor];
    }
}
```

---

## Text Utilities & Width Handling

### Core Problem: Unicode Width

Terminals render characters with varying widths:
- ASCII letters: 1 column
- Emojis: typically 2 columns
- Combining marks: 0 columns (zero-width)
- Wide characters (CJK): 2 columns each
- Control sequences (ANSI codes): 0 columns (invisible)

### visibleWidth(str: string): number

Calculate the actual terminal column width of a string (ignoring ANSI escape codes):

```typescript
import { visibleWidth } from "@mariozechner/pi-tui";

const width = visibleWidth("\x1b[31mHello\x1b[0m"); // 5 (not 20)
const width = visibleWidth("Hello🎉"); // 7 (5 + 2 for emoji)
const width = visibleWidth("你好"); // 4 (2 wide chars per 2 columns)
```

**Implementation details**:
- Uses `Intl.Segmenter` to split into grapheme clusters (handles emoji sequences, combining marks)
- Caches results for non-ASCII strings (LRU cache, max 512 entries)
- Extracts and strips ANSI codes: CSI (`ESC[...m`), OSC (`ESC]...\x07`), APC (`ESC_...\x07`)
- Calls `eastAsianWidth()` from `get-east-asian-width` library for codepoint width lookup
- Fast path for pure ASCII: returns `.length` immediately

### truncateToWidth(text: string, maxWidth: number, ellipsis?: string): string

Truncate text to fit within max visible width, optionally adding ellipsis:

```typescript
import { truncateToWidth } from "@mariozechner/pi-tui";

// Basic truncation
truncateToWidth("Hello World", 8); // "Hello..." (adds … if truncated)

// Without ellipsis
truncateToWidth("Hello World", 8, ""); // "Hello Wo"

// Preserves ANSI codes and properly closes them on truncation
const styled = chalk.red("Hello") + " " + chalk.blue("World");
truncateToWidth(styled, 8); // Red "Hello" + reset + "..." (proper closure)
```

### wrapTextWithAnsi(text: string, width: number): string[]

Wrap text to fit width, preserving ANSI codes across line breaks:

```typescript
import { wrapTextWithAnsi } from "@mariozechner/pi-tui";

const lines = wrapTextWithAnsi("This is a very long line", 10);
// Result: ["This is a", "very long", "line"]

// Preserves styles across breaks:
const styled = chalk.red("Hello ") + chalk.blue("World");
wrapTextWithAnsi(styled, 6);
// Result: [Red "Hello " + reset, Blue "World" + reset]
```

**Algorithm**:
1. Split by newlines (preserving ANSI state across breaks)
2. For each line: tokenize into words + whitespace
3. For each token:
   - If it fits on current line: add it
   - If token is too long: character-by-character wrapping
   - If token overflows: backtrack to last wrap opportunity (after whitespace)
4. Reapply active ANSI codes at start of each new line

### sliceByColumn(line: string, startCol: number, length: number, strict?: boolean): string

Extract a range of visible columns from a line, preserving ANSI codes:

```typescript
const line = "\x1b[31mHello\x1b[0m World";
sliceByColumn(line, 0, 5);    // Red "Hello" + reset
sliceByColumn(line, 6, 5);    // " World"
sliceByColumn(line, 3, 2);    // Red "ll" + reset
```

The `strict` parameter (default `false`):
- `true`: Exclude wide characters at boundary that would extend past the range
- Used for overlay compositing to avoid overflow

### extractSegments(line: string, beforeEnd: number, afterStart: number, afterLen: number)

Extract "before" and "after" segments from a line in a single pass, preserving styling from "before" that applies to "after":

```typescript
// Used for overlay compositing
const { before, beforeWidth, after, afterWidth } = extractSegments(
    "Base content with styling",
    10,    // beforeEnd: columns 0-9
    15,    // afterStart: columns 15+
    10     // afterLen: extract 10 columns starting at afterStart
);
// Result: before = "Base conte", after = "with styling" (with inherited style)
```

---

## Box & Layout System

### Box Component

A container that applies padding and background color to all children:

```typescript
class Box implements Component {
    constructor(
        paddingX: number = 1,    // Left/right padding
        paddingY: number = 1,    // Top/bottom padding
        bgFn?: (text: string) => string  // Background color function
    )
}
```

**Sizing calculation**:
```
Terminal width: 80
Box padding: 2 (left + right)
Content width for children: 80 - 2 = 78

For each child line:
1. Measure visible width
2. Add left padding ("  " + child)
3. Add right padding (+ "  ")
4. Apply background to entire line (fills to 80 columns)
```

**Code example**:

```typescript
import { Box, Text } from "@mariozechner/pi-tui";
import chalk from "chalk";

const box = new Box(1, 1, (text) => chalk.bgBlue(text));
box.addChild(new Text("Hello World", 0, 0));

tui.addChild(box);
// Output:
// \x1b[44m \x1b[0m  <- Blue background, 80 columns wide
// \x1b[44m Hello World \x1b[0m
// \x1b[44m \x1b[0m
```

**Caching**: Box caches rendered output and revalidates on:
- Child content changes (via `child.render()` comparison)
- Background function changes (detects via sampling `bgFn("test")`)

---

## Text Components

### Text Component

Multi-line text with word wrapping and padding:

```typescript
class Text implements Component {
    constructor(
        text: string = "",
        paddingX: number = 1,
        paddingY: number = 1,
        customBgFn?: (text: string) => string
    )
}
```

**Rendering process**:
1. Normalize tabs to 3 spaces
2. Calculate content width: `width - paddingX * 2`
3. Wrap text using `wrapTextWithAnsi()` (respects ANSI codes)
4. Add left/right padding margins to each wrapped line
5. Apply background function (if provided) - fills to full width
6. Add top/bottom padding (empty lines)

**Example**:

```typescript
const text = new Text(
    "Hello **bold** world",
    1,              // paddingX
    1,              // paddingY
    (text) => chalk.bgGray(text)
);

// For width=80:
// Line 1: "                                        " (80 spaces, bg gray) - top pad
// Line 2: " Hello **bold** world                   " (1 + content + pad to 80, bg gray)
// Line 3: "                                        " (80 spaces, bg gray) - bottom pad
```

**Mutation API**:
```typescript
text.setText("New content");
text.setCustomBgFn((text) => chalk.bgGreen(text));
text.invalidate();  // Clear cache
```

### TruncatedText Component

Single-line text that truncates to fit width (no wrapping):

```typescript
class TruncatedText implements Component {
    constructor(
        text: string,
        paddingX: number = 0,
        paddingY: number = 0
    )
}
```

**Rendering**:
1. Takes only first line (stops at newline)
2. Truncates to `width - paddingX * 2` with ellipsis if needed
3. Adds left/right padding
4. Pads to full width with spaces

**Use case**: Status lines, headers that should stay single-line.

---

## Input Component

Single-line text input with cursor, kill ring, undo, and history:

```typescript
class Input implements Component, Focusable {
    focused: boolean = false;
    onSubmit?: (value: string) => void;
    onEscape?: () => void;
    
    getValue(): string;
    setValue(value: string): void;
    handleInput(data: string): void;
    render(width: number): string[];
}
```

### Rendering

```
Prompt: "> "
Cursor: displayed as inverse video (reverse SGR 7)
Content: scrolls horizontally if longer than available width

Example:
"> This is a long input field with [cursor here] and more text"
// Terminal width = 40:
// Visible: "> s a long input field with [cu"
//               ^1 char scrolled left
```

### Key Bindings

**Cursor Movement**:
- `Left/Right` or `Ctrl+B/Ctrl+F`: Move by one grapheme
- `Alt+Left/Right` or `Ctrl+Left/Right`: Move by word
- `Home/Ctrl+A`: Line start
- `End/Ctrl+E`: Line end

**Deletion**:
- `Backspace`: Delete grapheme before cursor
- `Delete/Ctrl+D`: Delete grapheme at cursor
- `Ctrl+W/Alt+Backspace`: Delete word backwards
- `Alt+D/Alt+Delete`: Delete word forwards
- `Ctrl+U`: Delete to line start
- `Ctrl+K`: Delete to line end

**Text Input**:
- Regular characters and Unicode
- `Enter`: Submit
- Bracketed paste mode (`\x1b[200~...\x1b[201~`): Handled automatically

**Kill Ring (Emacs-style)** - kill/yank for cut/copy/paste:
- `Ctrl+U/Ctrl+K`: Kill (cut) → stored in kill ring
- `Ctrl+Y`: Yank (paste) most recent kill
- `Alt+Y`: Yank pop - cycle through kill ring

**Undo**:
- `Ctrl+-`: Undo (with smart coalescing for consecutive characters)

### Undo Coalescing

Consecutive word characters coalesce into one undo unit. Whitespace (space, newline) captures state before itself:

```
User types: "hello world"
Undo stack:
1. Insert 'h' -> state: ""
2. Insert 'e','l','l','o' -> state: "h" (coalesced into one unit)
3. Space -> state: "hello"
4. Insert 'w','o','r','l','d' -> state: "hello "

Pressing Ctrl+- repeatedly:
1. "hello " → state before space
2. "hello" → state before first char of word
3. "" → initial state
```

### Kill Ring

A ring buffer of deleted text (like Emacs):

```typescript
private killRing = new KillRing();

// After Ctrl+U (delete to line start):
killRing.push("deleted text", { prepend: true });

// After Ctrl+Y:
const text = killRing.peek();  // "deleted text"

// After Alt+Y (while lastAction === "yank"):
killRing.rotate();  // Move end to front
const text = killRing.peek();  // Previous entry
```

### Bracketed Paste Handling

Terminal sends pasted text wrapped in markers:

```typescript
// Terminal sends:
"\x1b[200~pasted content\x1b[201~"

// Input component:
// 1. Detects `\x1b[200~` start
// 2. Buffers content until `\x1b[201~`
// 3. Cleans: removes newlines/CR, expands tabs
// 4. Inserts at cursor
```

---

## Editor Component

Multi-line text editor with word wrapping, autocomplete, undo, kill ring, and history:

```typescript
class Editor implements Component, Focusable {
    focused: boolean = false;
    onSubmit?: (text: string) => void;
    onChange?: (text: string) => void;
    disableSubmit: boolean = false;
    
    getText(): string;
    getLines(): string[];
    getCursor(): { line: number; col: number };
    setText(text: string): void;
    insertTextAtCursor(text: string): void;
    addToHistory(text: string): void;
    
    getAutocompleteMaxVisible(): number;
    setAutocompleteMaxVisible(maxVisible: number): void;
    setAutocompleteProvider(provider: AutocompleteProvider): void;
    isShowingAutocomplete(): boolean;
}
```

### State Structure

```typescript
interface EditorState {
    lines: string[];       // Array of logical lines
    cursorLine: number;    // Current line index
    cursorCol: number;     // Column in current line
}
```

### Vertical Scrolling

The editor displays up to **30% of terminal height** (minimum 5 lines):

```typescript
// In render():
const terminalRows = this.tui.terminal.rows;
const maxVisibleLines = Math.max(5, Math.floor(terminalRows * 0.3));

// Adjust scrollOffset to keep cursor visible:
if (cursorLineIndex < this.scrollOffset) {
    this.scrollOffset = cursorLineIndex;
} else if (cursorLineIndex >= this.scrollOffset + maxVisibleLines) {
    this.scrollOffset = cursorLineIndex - maxVisibleLines + 1;
}
```

### Word Wrapping Algorithm

The `wordWrapLine()` function wraps at word boundaries intelligently:

```typescript
export interface TextChunk {
    text: string;
    startIndex: number;    // Position in original line
    endIndex: number;
}

export function wordWrapLine(line: string, maxWidth: number): TextChunk[] {
    // 1. Tokenize into words + whitespace
    // 2. For each token:
    //    - If fits: add to current chunk
    //    - If overflow: backtrack to last wrap opportunity (after whitespace)
    //    - If token too long: character-by-character break
    // 3. Return chunks with position information for cursor tracking
}
```

**Wrap opportunity** = position after the last whitespace before a non-whitespace grapheme.

### Layout and Rendering

The editor's `layoutText()` method builds visual lines with cursor info:

```typescript
interface LayoutLine {
    text: string;          // Wrapped line content
    hasCursor: boolean;    // Does cursor appear on this line?
    cursorPos?: number;    // Visual position of cursor on line
}

render(width: number): string[] {
    // 1. Build visual line map with word wrapping
    const layoutLines = this.layoutText(layoutWidth);
    
    // 2. Find cursor's visual line
    const cursorLineIndex = layoutLines.findIndex(l => l.hasCursor);
    
    // 3. Adjust scroll to keep cursor visible
    // (scroll offset logic above)
    
    // 4. Render top border with scroll indicator if needed
    // 5. Render visible lines with cursor
    // 6. Render bottom border with scroll indicator if needed
    // 7. Append autocomplete list if active
    
    return result;
}
```

### Cursor Movement & Sticky Column

When moving up/down, the editor tracks a "preferred visual column" so cursor stays in the same position when jumping to longer/shorter lines:

```typescript
private preferredVisualCol: number | null = null;

// Decision table for vertical movement:
// P = preferred col is set
// S = cursor in middle of source line (not clamped to end)
// T = target line shorter than current visual col
// U = target line shorter than preferred col

// Case 1 (P=0, S=*, T=0): cursor in middle, target fits → use current col
// Case 2 (P=0, S=*, T=1): target too short → save current as preferred, use target end
// Case 3 (P=1, S=0, T=0, U=0): use preferred, clear it
// Case 4 (P=1, S=0, T=0, U=1): target still too short → keep preferred, use target end
// ...and so on
```

### Autocomplete Integration

```typescript
interface AutocompleteProvider {
    getSuggestions(
        lines: string[],
        cursorLine: number,
        cursorCol: number
    ): {
        items: Array<{ value: string; label: string }>;
        prefix: string;
    } | null;
    
    applyCompletion(
        lines: string[],
        cursorLine: number,
        cursorCol: number,
        item: SelectItem,
        prefix: string
    ): { lines: string[]; cursorLine: number; cursorCol: number };
}
```

**Auto-trigger conditions**:
- `/` at start of line → slash commands
- `@` after whitespace → file references
- Letters/numbers in slash command context → command argument autocomplete

**Keybindings**:
- `Tab`: Trigger file completion or slash command completion
- `Up/Down` in autocomplete: Navigate list
- `Enter` in autocomplete: Apply completion
- `Escape`: Cancel autocomplete

### Paste Handling for Large Content

Pastes > 10 lines or > 1000 characters are replaced with markers:

```
[paste #1 +150 lines]

// Marker stored in:
private pastes: Map<number, string>

// On submit: markers expanded back to full content
```

This keeps the editor responsive while preserving the ability to view paste summaries.

### History Navigation

After submission, prompts are stored in history. Use Up/Down arrows to browse:

```typescript
private history: string[] = [];
private historyIndex: number = -1;  // -1 = not browsing

// Up arrow:
// - If empty editor: browse to most recent
// - If at top of content: browse to older
// - Capture current state on first entry to history mode

// Down arrow:
// - If browsing history: move to newer or back to "current"

// Any text edit:
// - Exit history mode (historyIndex = -1)
```

### Kill Ring, Undo, and Delete Operations

Same as Input component, but operating on multi-line text:

```typescript
// Delete operations preserve newlines in kill ring:
killRing.push("\n", { prepend: true });  // Backspace at line start
killRing.push("\n", { prepend: false }); // Delete at line end

// Undo coalescing: consecutive word chars coalesce across line breaks
// Whitespace captures state before itself
```

### Jump-to-Character (Ctrl+])

```
Ctrl+]      → Enter jump-forward mode (await next character)
Ctrl+Alt+]  → Enter jump-backward mode
<any char>  → Jump to first occurrence of that character
<any other key> → Cancel jump mode
```

---

## Select List Component

Interactive list selection with keyboard navigation and filtering:

```typescript
class SelectList implements Component {
    constructor(
        items: SelectItem[],
        maxVisible: number,
        theme: SelectListTheme
    )
    
    setFilter(filter: string): void;
    setSelectedIndex(index: number): void;
    getSelectedItem(): SelectItem | null;
    handleInput(keyData: string): void;
    
    onSelect?: (item: SelectItem) => void;
    onCancel?: () => void;
    onSelectionChange?: (item: SelectItem) => void;
}

interface SelectItem {
    value: string;
    label: string;
    description?: string;
}

interface SelectListTheme {
    selectedPrefix: (text: string) => string;  // Arrow "→"
    selectedText: (text: string) => string;    // Selection highlight
    description: (text: string) => string;     // Description styling
    scrollInfo: (text: string) => string;      // "(3/10)" counter
    noMatch: (text: string) => string;         // "No matching commands"
}
```

### Rendering

For each item:
- **Selected**: `→ Label` with `selectedText` styling, description on right
- **Unselected**: `  Label` with description on right, description in different color
- **Scrolling**: Center selection in visible range with (N/Total) counter

```
Width >= 40, has description:
→ MyCommand                    This command does X

Width < 40, no description:
→ My short label...
```

### Keybindings

- `Up`: Previous item (wraps to bottom)
- `Down`: Next item (wraps to top)
- `Enter`: Select
- `Escape`/`Ctrl+C`: Cancel

---

## Markdown Component

Parse and render markdown to terminal with syntax highlighting:

```typescript
class Markdown implements Component {
    constructor(
        text: string,
        paddingX: number,
        paddingY: number,
        theme: MarkdownTheme,
        defaultTextStyle?: DefaultTextStyle
    )
    
    setText(text: string): void;
    invalidate(): void;
    render(width: number): string[];
}

interface MarkdownTheme {
    heading: (text: string) => string;
    link: (text: string) => string;
    linkUrl: (text: string) => string;
    code: (text: string) => string;
    codeBlock: (text: string) => string;
    codeBlockBorder: (text: string) => string;
    quote: (text: string) => string;
    quoteBorder: (text: string) => string;
    hr: (text: string) => string;
    listBullet: (text: string) => string;
    bold: (text: string) => string;
    italic: (text: string) => string;
    strikethrough: (text: string) => string;
    underline: (text: string) => string;
    highlightCode?: (code: string, lang?: string) => string[];
    codeBlockIndent?: string;  // Default: "  "
}

interface DefaultTextStyle {
    color?: (text: string) => string;
    bgColor?: (text: string) => string;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
}
```

### Rendering Pipeline

1. **Parse** markdown using `marked.lexer()` → token stream
2. **Render tokens** to styled strings (apply theme functions)
3. **Wrap lines** with `wrapTextWithAnsi()` (preserves ANSI codes across breaks)
4. **Add padding & background** (same as Text component)

### Token Types Supported

| Markdown | Token | Rendering |
|----------|-------|-----------|
| `# Heading 1` | `heading` (depth=1) | Bold + underline + theme.heading |
| `## Heading 2` | `heading` (depth=2) | Bold + theme.heading |
| `### Heading 3` | `heading` (depth=3) | `### ` prefix + bold + theme.heading |
| `**bold**` | `strong` | `theme.bold()` |
| `*italic*` | `em` | `theme.italic()` |
| `` `code` `` | `codespan` | `theme.code()` |
| ` ```js\ncode\n``` ` | `code` (with lang) | Code block with border, optional syntax highlight |
| `- item\n- item` | `list` | `theme.listBullet()` with nesting support |
| `1. item` | `list` (ordered) | Numbered with theme.listBullet |
| `> quote` | `blockquote` | `│ ` border + italic + theme.quote |
| `---` | `hr` | `─────` line via `theme.hr()` |
| `[link](url)` | `link` | Underlined link text + `(url)` via `theme.linkUrl()` |

### Inline Formatting Preservation

Active ANSI codes (colors, bold, etc.) are tracked and reapplied at line breaks:

```typescript
// Example:
const md = "**Bold text that** wraps to next line";

// Rendered:
// Line 1: `\x1b[1mBold text that\x1b[0m` + reapply bold
// Line 2: `\x1b[1mwraps to next line\x1b[0m`
```

### Code Block Syntax Highlighting

If `theme.highlightCode` is provided, it's called for each code block:

```typescript
highlightCode?: (code: string, lang?: string) => string[]

// Example with Prism/Highlight.js:
highlightCode: (code, lang) => {
    const highlighted = highlight.highlight(code, { language: lang });
    return highlighted.value.split("\n");
}
```

Without highlighting, code blocks are wrapped in `theme.codeBlock()` and `theme.codeBlockBorder()`.

---

## Loader & Animation

### Loader Component

Animated spinner for indicating loading state:

```typescript
class Loader extends Text {
    constructor(
        ui: TUI,
        spinnerColorFn: (str: string) => string,
        messageColorFn: (str: string) => string,
        message: string = "Loading..."
    )
    
    start(): void;
    stop(): void;
    setMessage(message: string): void;
}
```

**Animation**:
- Frames: `["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]` (Braille spinner)
- Interval: 80ms between frames
- Updates via `setInterval()` and `tui.requestRender()`

**Rendering**:
```
Spinner: ⠙ Loading...
         │  │
      Color Color
```

### CancellableLoader

Extends Loader with Escape key handling and AbortSignal:

```typescript
class CancellableLoader extends Loader {
    readonly signal: AbortSignal;
    get aborted(): boolean;
    onAbort?: () => void;
}

// Usage:
const loader = new CancellableLoader(tui, spinnerColor, msgColor, "Working...");
doAsyncWork(loader.signal).then(done);

loader.onAbort = () => {
    // User pressed Escape
};
```

### Timed Updates (setInterval Pattern)

Since TUI uses differential rendering, periodic updates work via:

1. Start interval in component
2. On each interval tick: call `tui.requestRender()`
3. TUI detects change (frame number changed) and re-renders
4. Stop interval on cleanup (component destruction or `.stop()`)

```typescript
// In Loader:
this.intervalId = setInterval(() => {
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    this.updateDisplay();  // Updates text, which invalidates render cache
    this.ui?.requestRender();  // Request render on next tick
}, 80);
```

**Important**: Components **must not** have `setInterval` or timers without cleanup, or they'll leak and keep the TUI updating forever.

---

## Image Rendering

Render images inline for Kitty/iTerm2 graphics protocols (or plain text fallback):

```typescript
class Image implements Component {
    constructor(
        base64Data: string,
        mimeType: string,
        theme: ImageTheme,
        options?: ImageOptions,
        dimensions?: ImageDimensions
    )
    
    getImageId(): number | undefined;
    render(width: number): string[];
}

interface ImageOptions {
    maxWidthCells?: number;
    maxHeightCells?: number;
    filename?: string;
    imageId?: number;  // Reuse ID for animations
}

interface ImageTheme {
    fallbackColor: (str: string) => string;
}
```

### Rendering Strategy

1. **Kitty Graphics Protocol** (if supported):
   - Send image data via Kitty protocol escape sequences
   - Allocate image ID for reuse (animations)
   - Return placeholder lines equal to image height
   - First N-1 lines are empty (TUI clears them)
   - Last line: move cursor up + image sequence

2. **Fallback** (unsupported terminals):
   - Return text representation: `[Image: PNG 800x600]`
   - Styled with theme fallback color

### Capabilities Detection

```typescript
const caps = getCapabilities();
// caps.images: boolean - Kitty/iTerm2 graphics protocol supported

if (caps.images) {
    renderImage(...);  // Use graphics protocol
} else {
    imageFallback(...);  // Use text
}
```

---

## Key Handling & Keybindings

### Terminal Keyboard Input

The TUI supports two keyboard protocols:

1. **Legacy Terminal Sequences** (universal):
   - Arrow keys: `\x1b[A`, `\x1b[B`, `\x1b[C`, `\x1b[D`
   - F-keys: `\x1b[11~`, `\x1b[12~`, etc.
   - Modifiers don't always distinguish (e.g., Shift+Tab = `\x1b[Z`)
   - Ctrl+symbol combos overlap with ASCII (e.g., Ctrl+[ = ESC)

2. **Kitty Keyboard Protocol** (opt-in, preferred):
   - Sends CSI-u sequences: `\x1b[97u` for 'a', `\x1b[97;2u` for Shift+a
   - Full disambiguation of all modifier combinations
   - Base layout key (codepoint for non-Latin keyboards)
   - Explicit key release events

### Key Matching

```typescript
import { matchesKey, Key, type KeyId } from "@mariozechner/pi-tui";

// Type-safe key identifiers with autocomplete:
if (matchesKey(data, Key.enter)) { ... }
if (matchesKey(data, Key.ctrl("c"))) { ... }
if (matchesKey(data, Key.ctrlShift("p"))) { ... }
if (matchesKey(data, "enter")) { ... }  // String literal also works
if (matchesKey(data, "ctrl+c")) { ... }

// Helper object for common keys:
const Key = {
    escape: "escape",
    enter: "enter",
    tab: "tab",
    ctrl(letter: BaseKey): KeyId,
    shift(key: BaseKey): KeyId,
    alt(key: BaseKey): KeyId,
    ctrlShift(key: BaseKey): KeyId,
    ctrlAlt(key: BaseKey): KeyId,
    // ... etc
};

type BaseKey = Letter | Digit | SymbolKey | SpecialKey;
type KeyId = BaseKey | `ctrl+${BaseKey}` | `shift+${BaseKey}` | ...;
```

### Editor Keybindings Manager

Centralized keybinding configuration:

```typescript
interface EditorKeybindingsConfig {
    cursorUp?: KeyId | KeyId[];
    cursorDown?: KeyId | KeyId[];
    deleteCharBackward?: KeyId | KeyId[];
    // ... more actions
}

const kb = new EditorKeybindingsManager(config);

// Check if input matches an action:
if (kb.matches(data, "cursorUp")) { ... }

// Get keys bound to an action:
const keys = kb.getKeys("submit");  // ["enter", "ctrl+j"]

// Update config:
kb.setConfig({ submit: "ctrl+m" });

// Global instance:
import { getEditorKeybindings } from "@mariozechner/pi-tui";
const keybindings = getEditorKeybindings();
```

### Bracketed Paste Mode

Terminals send large pastes wrapped in markers for reliable detection:

```
\x1b[200~pasted content\x1b[201~
         │               │
    Start marker      End marker
```

**Input and Editor components** automatically handle:
1. Detect `\x1b[200~` start
2. Buffer content until `\x1b[201~`
3. Clean: remove newlines/CR, expand tabs
4. Insert at cursor

---

## Overlay System

### Overlay Positioning & Sizing

Overlays render on top of base content with flexible positioning:

```typescript
tui.showOverlay(component, {
    // === Sizing ===
    width: 60,                 // Fixed columns
    width: "80%",              // Percentage of terminal
    minWidth: 40,
    maxHeight: 20,
    maxHeight: "50%",
    
    // === Positioning - anchor-based (default) ===
    anchor: "center",          // "top-left", "bottom-right", etc.
    offsetX: 2,                // Offset from anchor
    offsetY: -1,
    
    // === Positioning - absolute ===
    row: 5,                    // Absolute row
    col: 10,                   // Absolute column
    
    // === Positioning - percentage ===
    row: "25%",                // % from top (0% = top, 100% = bottom)
    col: "50%",                // % from left
    
    // === Margins from edges ===
    margin: 2,                 // All sides
    margin: { top: 1, right: 2, bottom: 1, left: 2 },
    
    // === Visibility ===
    visible: (termWidth, termHeight) => termWidth >= 100,  // Responsive
    nonCapturing: true,        // Don't capture keyboard focus
}): OverlayHandle
```

**Resolution order**:
1. Absolute `row`/`col` (if provided) → use as-is
2. Percentage `row`/`col` (if provided) → compute from percentage
3. `anchor` (default: "center") + `offsetX`/`offsetY` → compute from anchor point
4. `margin` clamps final position to stay within bounds
5. `visible` callback controls whether overlay is rendered

### Overlay Compositing

Overlays composite on top of base content via line-by-line masking:

```typescript
// For each overlay line at (row, col) with width w:
// 1. Extract "before" content (columns 0 to col-1)
// 2. Extract "overlay" content (overlay line, width w)
// 3. Extract "after" content (columns col+w to end)
// 4. Composite: before + overlay + after + padding

// Preserves styling from "before" that applies to "after"
// (uses extractSegments() for single-pass efficiency)
```

### OverlayHandle API

```typescript
interface OverlayHandle {
    hide(): void;                    // Remove permanently
    setHidden(hidden: boolean): void; // Temporarily hide/show
    isHidden(): boolean;
    focus(): void;                   // Give focus & bring to front
    unfocus(): void;                 // Release focus
    isFocused(): boolean;
}
```

### Focus Management with Overlays

- When overlay is shown: automatically captures focus (unless `nonCapturing: true`)
- When overlay is hidden: focus restored to previous component
- When focused overlay is no longer visible: focus moves to next visible overlay or previous component
- Input goes to focused overlay first, then falls back to base content

---

## Terminal Interface

### Terminal Contract

All rendering goes through a `Terminal` interface (allow custom implementations):

```typescript
interface Terminal {
    start(onInput: (data: string) => void, onResize: () => void): void;
    stop(): void;
    
    write(data: string): void;
    get columns(): number;
    get rows(): number;
    get kittyProtocolActive(): boolean;
    
    moveBy(lines: number): void;
    hideCursor(): void;
    showCursor(): void;
    clearLine(): void;
    clearFromCursor(): void;
    clearScreen(): void;
    setTitle(title: string): void;
    
    async drainInput(maxMs?: number, idleMs?: number): Promise<void>;
}
```

### ProcessTerminal (Default Implementation)

Uses `process.stdin`/`process.stdout` with raw mode:

```typescript
class ProcessTerminal implements Terminal {
    constructor() { ... }
    
    // Enables:
    // 1. Raw mode (tty.setRawMode)
    // 2. Bracketed paste mode (\x1b[?2004h)
    // 3. Kitty keyboard protocol query + enable
    // 4. Windows VT input mode (on Windows)
    // 5. StdinBuffer to split batched input into individual sequences
}
```

**Kitty Protocol Negotiation**:
1. Query: `\x1b[?u`
2. If terminal responds `\x1b[?<flags>u`: protocol supported
3. Enable with flags: `\x1b[>7u` (flag 1=disambiguate, flag 2=key releases, flag 4=base layout)

**Windows Support**:
- Uses `koffi` (FFI library) to call `SetConsoleMode`
- Enables `ENABLE_VIRTUAL_TERMINAL_INPUT` for VT sequence support

### Input Buffering & Parsing

The `StdinBuffer` splits raw stdin data into individual key sequences:

```typescript
class StdinBuffer {
    on("data", (sequence: string) => {
        // Called with individual escape sequences or printable chars
        // e.g., "\x1b[A" (arrow up), "a" (letter a), "\x1b[200~..." (paste)
    });
    
    on("paste", (content: string) => {
        // Called when bracketed paste completes
        // content excludes markers
    });
}
```

This ensures components receive discrete events, not batched/split sequences.

---

## Comparison vs Blessed

### Key Differences

| Aspect | pi-tui | Blessed |
|--------|--------|---------|
| **Philosophy** | Minimal, differential rendering | Full widget framework with box model |
| **Component Model** | Simple: `render(width) → string[]` | Complex: nested widget tree with events |
| **Rendering** | Differential (only changed lines) | Full re-render each frame (optimized) |
| **Async Updates** | Manual: `requestRender()` + `setInterval` | Event-driven, automatic invalidation |
| **Text Width Handling** | Sophisticated: grapheme-aware, ANSI-preserving | Less sophisticated (basic `strip-ansi`) |
| **Overlays** | First-class: compositing + positioning system | Box-based, limited overlay support |
| **IME Support** | Full: hardware cursor positioning via CURSOR_MARKER | Not supported |
| **Keyboard Protocols** | Kitty protocol + legacy + Windows VT | Legacy only |
| **Paste Handling** | Bracketed paste mode built-in | Not standardized |
| **Code Size** | ~5KB minified (tui.ts) | ~100KB+ (full blessed dist) |
| **Dependencies** | chalk (colors), marked (markdown) | Multiple (e.g., unicode-width) |
| **Terminal Emulators** | Kitty, iTerm2, WezTerm, xterm, tmux | Universal support |

### Similarities

Both libraries:
- Use ANSI escape codes for styling
- Support multiple components/containers
- Handle keyboard input
- Manage terminal raw mode
- Provide text utilities (width calculation, truncation, wrapping)

### When to Use Each

**Use pi-tui when**:
- Building minimal, responsive CLIs
- Precise control over rendering performance needed
- Working with text editors, code input, markdown
- Need IME support for international users
- Terminal-native surfaces without chrome

**Use Blessed when**:
- Building rich TUI applications with many widgets
- Need buttons, textboxes, tables, layouts out of the box
- Want mouse support and complex event handling
- Building full-screen terminal applications

### Architecture Philosophy

**pi-tui**: "Render to strings, compose with functions"
- Component is a pure function: `(width: number) → string[]`
- Composition via container children
- Update by calling `setText()` or `requestRender()`
- TUI handles all rendering

**Blessed**: "Nested widgets with event handlers"
- Component is an object with properties and event listeners
- Layout via box model (x, y, width, height, margin, padding)
- Update by setting properties or emitting events
- Widget handles its own invalidation

---

## Summary

The pi-tui library is a **minimal, high-performance terminal UI framework** optimized for:

1. **Text-heavy applications** (markdown, code editors, logs)
2. **Responsive rendering** (differential updates, synchronized output)
3. **International users** (IME support via hardware cursor positioning)
4. **Modern terminals** (Kitty protocol, iTerm2 images)
5. **Developer experience** (simple component interface, type-safe keybindings)

**Core strengths**:
- ✅ Sophisticated text handling (Unicode-aware, ANSI-preserving)
- ✅ Efficient rendering (differential, no flicker)
- ✅ Multi-line editing (editor with word wrap, undo, kill ring)
- ✅ Flexible overlays (positioning, sizing, compositing)
- ✅ IME support (hardware cursor positioning for CJK input)

**Trade-offs**:
- ⚠️ Fewer pre-built widgets than Blessed
- ⚠️ No mouse support
- ⚠️ Requires manual orchestration of complex layouts
- ⚠️ Component cache invalidation is manual

---

## Code Examples

### Minimal App

```typescript
import { TUI, ProcessTerminal, Text, Editor } from "@mariozechner/pi-tui";

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

tui.addChild(new Text("Hello, terminal!", 0, 0));

const editor = new Editor(tui, {
    borderColor: (s) => `\x1b[36m${s}\x1b[0m`,
    selectList: { /* theme */ },
});
editor.onSubmit = (text) => {
    console.log("Submitted:", text);
    tui.stop();
};
tui.addChild(editor);

tui.start();
```

### Custom Component with Caching

```typescript
import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";

class StatusLine implements Component {
    private text: string = "";
    private cachedWidth?: number;
    private cachedLines?: string[];
    
    setText(text: string) {
        this.text = text;
        this.invalidate();
    }
    
    invalidate() {
        this.cachedWidth = undefined;
        this.cachedLines = undefined;
    }
    
    render(width: number): string[] {
        if (this.cachedLines && this.cachedWidth === width) {
            return this.cachedLines;
        }
        
        const truncated = truncateToWidth(this.text, width);
        const line = truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
        
        this.cachedWidth = width;
        this.cachedLines = [line];
        return this.cachedLines;
    }
}
```

