# Rich Library — Deep Technical Reference

Source: `vendor/rich/rich/` — read from actual source files.

---

## Table of Contents

1. [The Renderable Protocol — How Everything Fits Together](#1-the-renderable-protocol)
2. [The Console and Output Model](#2-the-console-and-output-model)
3. [The Segment — The Atom of Rendering](#3-the-segment)
4. [The Text and Style System](#4-the-text-and-style-system)
5. [Markdown Rendering Pipeline](#5-markdown-rendering-pipeline)
6. [Syntax Highlighting](#6-syntax-highlighting)
7. [Table Rendering](#7-table-rendering)
8. [Capturing Output — String Extraction and Subprocess Use](#8-capturing-output)

---

## 1. The Renderable Protocol

Everything Rich renders must satisfy one of three shapes (from `console.py`):

```python
@runtime_checkable
class ConsoleRenderable(Protocol):
    def __rich_console__(
        self, console: "Console", options: "ConsoleOptions"
    ) -> "RenderResult": ...

@runtime_checkable
class RichCast(Protocol):
    def __rich__(self) -> Union[ConsoleRenderable, RichCast, str]: ...

# Or just a plain str
RenderableType = Union[ConsoleRenderable, RichCast, str]
RenderResult = Iterable[Union[RenderableType, Segment]]
```

Key insight: `__rich_console__` is a **generator** that yields either:
- `Segment` instances (terminal atoms — plain text + style pair)
- Other `RenderableType` objects (which the Console recursively resolves)

This means renderables compose by yielding other renderables. A `Markdown` yields
`Paragraph` objects; `Paragraph` yields `Text`; `Text` yields `Segment`s.

### `ConsoleOptions` — the render context

```python
@dataclass
class ConsoleOptions:
    size: ConsoleDimensions   # (width, height)
    max_width: int            # Available width for this render
    min_width: int
    max_height: int
    is_terminal: bool
    encoding: str
    justify: Optional[JustifyMethod]   # "left","center","right","full","default"
    overflow: Optional[OverflowMethod] # "fold","crop","ellipsis","ignore"
    no_wrap: Optional[bool]
    highlight: Optional[bool]
    markup: Optional[bool]
    height: Optional[int]

    def update(self, *, width=..., justify=..., ...) -> "ConsoleOptions": ...
    # Returns a copy with updated fields — used by containers to narrow width for children
```

---

## 2. The Console and Output Model

### Construction

```python
from rich.console import Console

# Default — auto-detect terminal
console = Console()

# Force color (e.g. for subprocess/pipe use)
console = Console(force_terminal=True, width=120)

# Write to a file/StringIO — no ANSI auto-detection
import io
buf = io.StringIO()
console = Console(file=buf, force_terminal=True, width=120)

# No color at all
console = Console(no_color=True)

# Specific color depth
console = Console(color_system="truecolor")  # "standard","256","truecolor","windows"
```

**Key constructor params:**
| Param | Effect |
|---|---|
| `force_terminal=True` | Emit ANSI even if output is not a tty |
| `force_terminal=False` | Never emit ANSI |
| `width=N` | Fixed output width (no auto-detect) |
| `file=f` | Write to this file object |
| `color_system=None` | Disable all color |
| `markup=False` | Disable `[bold]...[/]` markup parsing |
| `highlight=False` | Disable auto-highlighting of strings |
| `record=True` | Record all output for later `export_text()`/`export_html()` |

### `Console.print()` — the main pipeline

```python
def print(
    self,
    *objects: Any,
    sep: str = " ",
    end: str = "\n",
    style: Optional[StyleType] = None,
    justify: Optional[JustifyMethod] = None,
    overflow: Optional[OverflowMethod] = None,
    no_wrap: Optional[bool] = None,
    emoji: Optional[bool] = None,
    markup: Optional[bool] = None,
    highlight: Optional[bool] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    crop: bool = True,
    soft_wrap: Optional[bool] = None,
    new_line_start: bool = False,
) -> None:
```

**Internal pipeline** (traced from source):

```
print(*objects)
  │
  ▼
_collect_renderables(objects, sep, end, ...)
  ├─ str objects → render_str() → Text (applies markup, emoji, highlighter)
  ├─ Text objects → appended directly
  ├─ ConsoleRenderable → appended directly
  └─ other → Pretty(object) (pretty-printer)
  │
  ▼
[render_hooks applied — e.g. Live]
  │
  ▼
render_options = self.options.update(justify, overflow, width, ...)
  │
  ▼
for renderable in renderables:
    render(renderable, render_options)  → Iterable[Segment]
  │
  ▼
Segment.split_and_crop_lines(segments, self.width)  [if crop=True]
  │
  ▼
self._buffer.extend(segments)
  │
  ▼
_check_buffer() → _render_buffer() → file.write(text)
```

### `Console.render()` — the recursive resolver

```python
def render(self, renderable, options=None) -> Iterable[Segment]:
    renderable = rich_cast(renderable)  # calls __rich__() if present
    if hasattr(renderable, "__rich_console__"):
        render_iterable = renderable.__rich_console__(self, _options)
    elif isinstance(renderable, str):
        text_renderable = self.render_str(renderable, ...)
        render_iterable = text_renderable.__rich_console__(self, _options)
    else:
        raise NotRenderableError(...)

    for render_output in iter_render:
        if isinstance(render_output, Segment):
            yield render_output
        else:
            yield from self.render(render_output, _options)  # <-- recursion
```

### `_render_buffer()` — ANSI emission

Once the `_buffer` is flushed, each `Segment` is converted to a string:

```python
def _render_buffer(self, buffer: Iterable[Segment]) -> str:
    # Each Segment has .text and .style
    # style.render(text, color_system=...) produces "\x1b[...m{text}\x1b[0m"
    ...
```

The actual ANSI production is in `Style.render()`:

```python
def render(self, text: str, *, color_system=ColorSystem.TRUECOLOR) -> str:
    attrs = self._ansi or self._make_ansi_codes(color_system)
    rendered = f"\x1b[{attrs}m{text}\x1b[0m" if attrs else text
    if self._link:
        rendered = f"\x1b]8;id={self._link_id};{self._link}\x1b\\{rendered}\x1b]8;;\x1b\\"
    return rendered
```

### Capture context manager

```python
with console.capture() as cap:
    console.print("[bold red]Hello[/]")
result: str = cap.get()
# result contains ANSI codes if force_terminal=True
```

Internally: `begin_capture()` enters a buffer context. `end_capture()` calls
`_render_buffer()` on the accumulated segments and returns the string.

### `render_lines()` — for composite renderables

Used by tables, panels, blockquotes to get fixed-width lines:

```python
lines: List[List[Segment]] = console.render_lines(
    renderable,
    options,
    style=style,   # optional background style
    pad=True,      # pad short lines with spaces
    new_lines=False
)
```

Returns a list-of-lists, where each inner list is one line's `Segment`s.

---

## 3. The Segment

```python
class Segment(NamedTuple):
    text: str
    style: Optional[Style] = None
    control: Optional[Sequence[ControlCode]] = None
```

- `Segment("hello", Style(bold=True))` — a styled text atom
- `Segment("\n")` — a newline (no style)
- `Segment.line()` — class method returning `Segment("\n")`
- `control` field carries non-printing codes (cursor move, clear screen, etc.)

Segments are the output of `render()` — they get serialized to ANSI strings only at `_render_buffer` time.

Key static methods used during layout:
```python
Segment.split_and_crop_lines(segments, width, pad=False)  # → Iterable[List[Segment]]
Segment.adjust_line_length(segments, width, style, pad)   # pad/trim one line
Segment.apply_style(segments, style)                      # add a base style
Segment.strip_styles(segments)                            # remove all styles (plain text)
```

---

## 4. The Text and Style System

### `Style` — `rich/style.py`

A style is an immutable object holding:
- `_color`: Optional foreground `Color`
- `_bgcolor`: Optional background `Color`
- `_attributes`: bitmask of bold/italic/underline/etc.
- `_set_attributes`: which bits are explicitly set (allows None/off/on distinction)
- `_link`: Optional hyperlink URL

```python
Style(
    color="red",           # foreground
    bgcolor="on blue",     # background
    bold=True,
    italic=True,
    underline=True,
    strike=True,
    dim=True,
    blink=True,
    reverse=True,
    link="https://example.com",
)
```

**Style composition** — `+` operator combines two styles. Right-hand side wins on conflict:
```python
new_style = style_a + style_b  # style_b overrides style_a
```

**ANSI code generation** (from `_make_ansi_codes`):
```python
# Maps attribute bits to SGR parameters:
_style_map = {
    0: "1",   # bold
    1: "2",   # dim
    2: "3",   # italic
    3: "4",   # underline
    4: "5",   # blink
    5: "6",   # blink2
    6: "7",   # reverse
    7: "8",   # conceal
    8: "9",   # strike
    9: "21",  # underline2
    10: "51", # frame
    11: "52", # encircle
    12: "53", # overline
}
# Color appends via Color.get_ansi_codes()
# Result joined with ";" → "\x1b[1;3;31m"
```

**`Style.parse()`** — parses style strings like `"bold red on blue link https://x.com"`:
```python
style = Style.parse("bold italic green on black")
```

**`StyleStack`** — pushed/popped during rendering:
```python
class StyleStack:
    def push(self, style: Style) -> None:
        self._stack.append(self._stack[-1] + style)  # cumulative

    def pop(self) -> Style:
        self._stack.pop()
        return self._stack[-1]

    @property
    def current(self) -> Style:
        return self._stack[-1]  # top = accumulated composite style
```

### `Text` — `rich/text.py`

`Text` is the core styled-text container. It stores:
- `_text: List[str]` — list of string fragments (joined lazily via `.plain`)
- `_spans: List[Span]` — list of `(start, end, style)` ranges over `.plain`
- `style` — base style for the whole text
- `justify`, `overflow`, `no_wrap`, `end`, `tab_size`

```python
class Span(NamedTuple):
    start: int
    end: int
    style: Union[str, Style]
```

**Building text:**
```python
text = Text("Hello World")
text.stylize("bold", 0, 5)          # "Hello" is bold
text.stylize("red", 6, 11)          # "World" is red
text.append(" extra", style="dim")  # append with style

# From markup
text = Text.from_markup("[bold]Hello[/] [red]World[/]")

# Assemble from parts
text = Text.assemble(
    ("Hello ", "bold"),
    ("World", "red"),
)

# Append tokens (used by syntax highlighter)
text.append_tokens([
    ("def ", Style(color="blue", bold=True)),
    ("foo", Style(color="green")),
    ("():", Style()),
])
```

**Rendering** — `Text.__rich_console__` calls `Text.render()`:
```python
def render(self, console, end="") -> Iterable[Segment]:
    # 1. Build a sorted event list from all span start/end points
    # 2. Walk events, maintain a stack of active style IDs
    # 3. At each offset change, emit Segment(text[prev:offset], combined_style)
    ...
    yield Segment(text[offset:next_offset], get_current_style())
```

The combined style for overlapping spans uses `Style.combine()` which sums a list
of styles left-to-right (each overriding previous).

**Text wrapping** — `Text.wrap()`:
```python
lines: Lines = text.wrap(console, width=80, justify="left", overflow="fold")
```

Uses `divide_line()` from `_wrap.py` to find word-break offsets, then `Text.divide()` to
split the text at those offsets while preserving spans across cuts.

---

## 5. Markdown Rendering Pipeline

### Overview

```
Markdown(markup)
  │
  ├─ MarkdownIt().parse(markup) → List[Token]
  │
  └─ __rich_console__(console, options)
       │
       ├─ _flatten_tokens(tokens) → flat token stream
       │
       ├─ MarkdownContext(console, options, style)
       │
       └─ for token in flat_tokens:
            ├─ "text"/"softbreak"/"hardbreak" → context.on_text(...)
            ├─ link_open/link_close → enter/leave style or push Link element
            ├─ inline tags (em, strong, code, s) → enter/leave style
            └─ block tags → element_class.create() → push/pop element stack
                 └─ on close: yield from console.render(element, options)
```

### Element map

```python
Markdown.elements = {
    "paragraph_open": Paragraph,
    "heading_open": Heading,       # h1–h6, different justify
    "fence": CodeBlock,            # fenced code → Syntax(...)
    "code_block": CodeBlock,
    "blockquote_open": BlockQuote,
    "hr": HorizontalRule,          # yields Rule(characters="-")
    "bullet_list_open": ListElement,
    "ordered_list_open": ListElement,
    "list_item_open": ListItem,
    "image": ImageItem,
    "table_open": TableElement,    # builds a rich Table
    "tbody_open": TableBodyElement,
    "thead_open": TableHeaderElement,
    "tr_open": TableRowElement,
    "td_open": TableDataElement,
    "th_open": TableDataElement,
}
```

### Key element classes

**`Paragraph`** — renders a `Text` object:
```python
class Paragraph(TextElement):
    style_name = "markdown.paragraph"
    def __rich_console__(self, console, options):
        self.text.justify = self.justify
        yield self.text
```

**`Heading`** — renders with level-specific alignment:
```python
LEVEL_ALIGN = {"h1": "center", "h2": "left", ...}
def __rich_console__(self, console, options):
    text = self.text.copy()
    text.justify = self.LEVEL_ALIGN.get(self.tag, "left")
    yield text
```

**`CodeBlock`** — wraps in `Syntax`:
```python
def __rich_console__(self, console, options):
    code = str(self.text).rstrip()
    syntax = Syntax(code, self.lexer_name, theme=self.theme, word_wrap=True, padding=1)
    yield syntax
```

**`BlockQuote`** — renders with left-margin indicator:
```python
def __rich_console__(self, console, options):
    render_options = options.update(width=options.max_width - 4)
    lines = console.render_lines(self.elements, render_options, style=self.style)
    padding = Segment("▌ ", style)
    for line in lines:
        yield padding
        yield from line
        yield Segment("\n")
```

**`ListElement`** — dispatches bullet/number rendering:
```python
def __rich_console__(self, console, options):
    if self.list_type == "bullet_list_open":
        for item in self.items:
            yield from item.render_bullet(console, options)
    else:
        for index, item in enumerate(self.items):
            yield from item.render_number(console, options, number+index, last_number)
```

Bullet items yield `Segment(" • ", bullet_style)` before each item's lines.

**`TableElement`** — constructs a `rich.Table`:
```python
def __rich_console__(self, console, options):
    table = Table(box=box.SIMPLE, pad_edge=False, ...)
    for column in self.header.row.cells:
        heading = column.content.copy()
        heading.stylize("markdown.table.header")
        table.add_column(heading)
    for row in self.body.rows:
        table.add_row(*[element.content for element in row.cells])
    yield table
```

### `MarkdownContext` — inline style tracking

```python
class MarkdownContext:
    def __init__(self, console, options, style, inline_code_lexer=None, ...):
        self.style_stack = StyleStack(style)  # cumulative style state
        self.stack = Stack()                  # element stack

    def on_text(self, text: str, node_type: str) -> None:
        if node_type in {"fence", "code_inline"} and self._syntax:
            # Run inline syntax highlighting
            highlight_text = self._syntax.highlight(text)
            self.stack.top.on_text(self, Text.assemble(highlight_text, ...))
        else:
            self.stack.top.on_text(self, text)

    def enter_style(self, style_name) -> Style:
        style = self.console.get_style(style_name)
        self.style_stack.push(style)
        return self.current_style

    def leave_style(self) -> Style:
        return self.style_stack.pop()
```

The style stack tracks cumulative inline styles like `**bold _bold italic_**`. Each
`em`, `strong`, `code`, `s` tag pushes/pops `markdown.em`, `markdown.strong`, etc.

### Named markdown styles (from `default_styles.py`)

The theme provides these names used in markdown rendering:
- `markdown.paragraph`
- `markdown.h1` .. `markdown.h6`
- `markdown.code` (inline code)
- `markdown.code_block`
- `markdown.block_quote`
- `markdown.hr`
- `markdown.item` / `markdown.item.bullet` / `markdown.item.number`
- `markdown.link` / `markdown.link_url`
- `markdown.table.header` / `markdown.table.border`
- `markdown.em` / `markdown.strong` / `markdown.s`

---

## 6. Syntax Highlighting

### Classes

```
Syntax
  ├─ SyntaxTheme (ABC)
  │    ├─ PygmentsSyntaxTheme  — wraps a Pygments Style class
  │    └─ ANSISyntaxTheme      — uses a Dict[TokenType, Style] directly
  └─ Lexer (from Pygments)
```

**Two theme paths:**
1. Named Pygments themes (`"monokai"`, `"dracula"`, `"github-dark"`, etc.) →
   `PygmentsSyntaxTheme` which calls `get_style_by_name(name)`
2. Built-in ANSI themes `"ansi_light"` / `"ansi_dark"` →
   `ANSISyntaxTheme(ANSI_LIGHT)` — uses standard terminal colors, no RGB

### `Syntax.highlight()` — core tokenization

```python
def highlight(self, code: str, line_range=None) -> Text:
    text = Text(justify=justify, style=base_style, tab_size=self.tab_size, no_wrap=not self.word_wrap)
    lexer = self.lexer or self.default_lexer

    # Pygments tokenizes the code:
    text.append_tokens(
        (token, self._theme.get_style_for_token(token_type))
        for token_type, token in lexer.get_tokens(code)
    )
    return text
```

`lexer.get_tokens(code)` returns `Iterable[Tuple[TokenType, str]]` where
`TokenType` is a tuple like `("Token", "Keyword", "Declaration")`.

`PygmentsSyntaxTheme.get_style_for_token()` converts Pygments style dicts to Rich `Style`:
```python
def get_style_for_token(self, token_type):
    pygments_style = self._pygments_style_class.style_for_token(token_type)
    color = pygments_style["color"]
    bgcolor = pygments_style["bgcolor"]
    return Style(
        color="#" + color if color else "#000000",
        bgcolor="#" + bgcolor if bgcolor else self._background_color,
        bold=pygments_style["bold"],
        italic=pygments_style["italic"],
        underline=pygments_style["underline"],
    )
```

### `Syntax.__rich_console__()` — rendering

```python
def __rich_console__(self, console, options):
    segments = Segments(self._get_syntax(console, options))
    if any(self.padding):
        yield Padding(segments, style=self._get_base_style(), pad=self.padding)
    else:
        yield segments
```

`_get_syntax()` is the main render loop:
1. `_process_code()` — normalize/dedent/expand tabs
2. `highlight()` — tokenize → `Text` with spans
3. For simple case (no line numbers, no word wrap): call `console.render_lines(text, ...)`
4. For complex case: iterate lines, optionally prepend line number segments, word-wrap each

Line number rendering:
```python
line_column = str(line_no).rjust(numbers_column_width - 2) + " "
yield Segment("  ", highlight_number_style)
yield Segment(line_column, number_style)
yield from wrapped_line
yield Segment("\n")
```

### Lexer selection

```python
# By name
syntax = Syntax(code, "python")
syntax = Syntax(code, "javascript")

# By file path (auto-detect)
syntax = Syntax.from_path("foo.py")
Syntax.guess_lexer("foo.py", code=code)  # returns alias string
```

Uses `get_lexer_by_name()` and `guess_lexer_for_filename()` from Pygments.

---

## 7. Table Rendering

### Data model

```
Table
  ├─ columns: List[Column]
  │    └─ Column._cells: List[RenderableType]
  └─ rows: List[Row]
       └─ Row.style, Row.end_section
```

`add_column()` / `add_row()` are the primary API. `add_row(*renderables)` appends one
cell per column. Cells can be any `RenderableType` (str, `Text`, nested `Table`, etc.).

### Column width algorithm — `_calculate_column_widths()`

**Step 1: Measure each column**

```python
def _measure_column(self, console, options, column) -> Measurement:
    if column.width is not None:
        # Fixed width — just return it
        return Measurement(column.width + padding, column.width + padding)

    # Flexible: measure all cells including header/footer
    for cell in self._get_cells(console, column._index, column):
        _min, _max = Measurement.get(console, options, cell.renderable)
        min_widths.append(_min)
        max_widths.append(_max)

    return Measurement(max(min_widths), max(max_widths))
```

`Measurement` has `.minimum` (longest word width) and `.maximum` (full unwrapped width).

**Step 2: Fit to available space**

```python
widths = [_range.maximum for _range in width_ranges]  # start at max
table_width = sum(widths)

if table_width > max_width:
    # _collapse_widths: iteratively shrink the widest wrappable columns
    widths = self._collapse_widths(widths, wrapable, max_width)

if table_width < max_width and self.expand:
    # Distribute excess via ratio_distribute
    pad_widths = ratio_distribute(max_width - table_width, widths)
    widths = [w + p for w, p in zip(widths, pad_widths)]
```

`_collapse_widths()` uses a level-equalizing algorithm:
- Find the widest wrappable column
- Find the second widest
- Reduce all columns at max level by `min(excess, gap_to_second)` proportionally
- Repeat until total fits

**Step 3: Flex columns with ratios**

If any column has `ratio=N` and `table.expand=True`, flexible columns are distributed
proportionally using `ratio_distribute()`.

### Border rendering — `_render()`

```python
_box = self.box.substitute(options, safe=...)  # adapt unicode chars to terminal

# Top edge
if show_edge:
    yield Segment(_box.get_top(widths), border_style)
    yield new_line

# For each row:
for row_cell in row_cells:
    # Render each cell to fixed-width lines
    lines = console.render_lines(cell.renderable, options.update(width=col_width))
    max_height = max(max_height, len(lines))

    # Emit line by line
    for line_no in range(max_height):
        if show_edge: yield left_border
        for last_cell, rendered_cell in loop_last(cells):
            yield from rendered_cell[line_no]
            if not last_cell: yield divider
        if show_edge: yield right_border
        yield new_line

    # After header:
    if show_header:
        yield Segment(_box.get_row(widths, "head", edge=show_edge), border_style)
```

Box characters come from `rich/box.py` — each `Box` is a string of 8 lines of Unicode
box-drawing characters. `get_top()`, `get_bottom()`, `get_row()` slice and repeat them.

### Minimal table example (code)

```python
from rich.table import Table
from rich.console import Console

table = Table("Name", "Score", title="Results")
table.add_row("Alice", "98")
table.add_row("Bob", "87")

console = Console()
console.print(table)
```

---

## 8. Capturing Output

### Method 1: `Console.capture()` context manager

```python
import io
from rich.console import Console
from rich.markdown import Markdown

console = Console(force_terminal=True, width=80)

with console.capture() as cap:
    console.print(Markdown("# Hello\n\nWorld **bold**"))

ansi_string: str = cap.get()
print(repr(ansi_string))  # contains \x1b[...m escape codes
```

### Method 2: `Console(file=StringIO(...))`

```python
import io
from rich.console import Console
from rich.syntax import Syntax

buf = io.StringIO()
console = Console(file=buf, force_terminal=True, width=120, color_system="truecolor")
console.print(Syntax("def foo():\n    pass", "python", theme="monokai"))

output = buf.getvalue()  # ANSI-coded string
```

### Method 3: `record=True` + `export_text()`/`export_html()`

```python
console = Console(record=True, width=100)
console.print("[bold red]Hello[/] World")

plain = console.export_text()  # no ANSI codes, plain text
html = console.export_html()   # full HTML with CSS
svg = console.export_svg()     # SVG rendering
```

### Method 4: No color / plain text

```python
console = Console(color_system=None, width=80)
# or
console = Console(no_color=True, width=80)
```

Setting `color_system=None` makes `Style.render()` return plain text (the `if not text or color_system is None: return text` branch).

### Method 5: As a subprocess — pipe ANSI to another process

```python
# Python one-liner that emits ANSI to stdout
import subprocess, sys

result = subprocess.run(
    [
        sys.executable, "-c",
        """
import sys
sys.path.insert(0, 'vendor/rich')
from rich.console import Console
from rich.markdown import Markdown
console = Console(force_terminal=True, width=100)
console.print(Markdown(open(sys.argv[1]).read()))
""",
        "README.md"
    ],
    capture_output=True,
    text=True
)
ansi_output = result.stdout
```

Or as a shell one-liner:
```bash
python3 -c "
import sys; sys.path.insert(0, 'vendor/rich')
from rich.console import Console
from rich.markdown import Markdown
Console(force_terminal=True, width=100).print(Markdown(open('README.md').read()))
" | cat
```

**Critical**: `force_terminal=True` is required. Without it, when stdout is a pipe
(not a tty), Rich auto-detects `is_terminal=False` and strips all ANSI codes.

### Color system tuning for pipe output

```python
# Auto-detect tries to read $COLORTERM and $TERM — may get it wrong in pipes.
# For safe full-color output, specify explicitly:
console = Console(
    force_terminal=True,
    color_system="truecolor",  # 24-bit RGB
    # or "256"                 # 256-color safe
    # or "standard"            # 16 standard colors
    width=120,
)
```

---

## Complete Worked Examples

### Render Markdown to ANSI string

```python
import sys
sys.path.insert(0, 'vendor/rich')

import io
from rich.console import Console
from rich.markdown import Markdown

def render_markdown_to_ansi(markdown_text: str, width: int = 80) -> str:
    buf = io.StringIO()
    console = Console(
        file=buf,
        force_terminal=True,
        color_system="truecolor",
        width=width,
    )
    console.print(Markdown(markdown_text))
    return buf.getvalue()

ansi = render_markdown_to_ansi("# Hello\n\n**Bold** and _italic_ text.")
print(ansi)
```

### Render syntax-highlighted code

```python
from rich.console import Console
from rich.syntax import Syntax
import io

def highlight_code(code: str, language: str = "python", theme: str = "monokai") -> str:
    buf = io.StringIO()
    console = Console(file=buf, force_terminal=True, color_system="truecolor", width=100)
    syntax = Syntax(
        code,
        language,
        theme=theme,
        line_numbers=True,
        word_wrap=True,
        padding=1,
    )
    console.print(syntax)
    return buf.getvalue()

code = "def greet(name: str) -> str:\n    return f'Hello, {name}!'"
print(highlight_code(code))
```

### Build and render a table

```python
from rich.console import Console
from rich.table import Table
from rich.text import Text
import io

def render_table(headers, rows, title=None) -> str:
    buf = io.StringIO()
    console = Console(file=buf, force_terminal=True, color_system="truecolor", width=100)
    table = Table(*headers, title=title, show_lines=True)
    for row in rows:
        table.add_row(*[str(cell) for cell in row])
    console.print(table)
    return buf.getvalue()

print(render_table(
    ["Name", "Language", "Stars"],
    [["Rich", "Python", "47k"], ["Ink", "TypeScript", "26k"]],
    title="Terminal Libraries"
))
```

### Styled text with spans

```python
from rich.text import Text
from rich.style import Style
from rich.console import Console
import io

buf = io.StringIO()
console = Console(file=buf, force_terminal=True, color_system="truecolor", width=80)

text = Text()
text.append("Error: ", style=Style(bold=True, color="red"))
text.append("file not found", style=Style(italic=True, color="yellow"))
text.append(" — check the path", style=Style(dim=True))

console.print(text)
print(buf.getvalue())
```

### Render Markdown from CLI

```bash
# Render a markdown file with ANSI codes to stdout
python3 -c "
import sys
sys.path.insert(0, 'vendor/rich')
from rich.console import Console
from rich.markdown import Markdown
c = Console(force_terminal=True, color_system='truecolor', width=100)
c.print(Markdown(sys.stdin.read()))
" < README.md
```

---

## Architecture Summary

```
User calls Console.print(renderable)
    │
    ▼
_collect_renderables()          # normalize objects to RenderableType list
    │
    ▼
Console.render(renderable)      # recursive resolution
    │
    ├─ calls __rich_console__(console, options)  on each renderable
    │
    ├─ Markdown.__rich_console__
    │    └─ yields Paragraph/Heading/CodeBlock/Table/...
    │         └─ each yields Text / Syntax / rich.Table / ...
    │              └─ Text.render() → Segments
    │
    ├─ Syntax.__rich_console__
    │    └─ Pygments tokenize → Text with spans → Segments
    │
    └─ Table.__rich_console__
         ├─ _calculate_column_widths()
         ├─ console.render_lines(cell)  for each cell
         └─ yields box chars + cell Segments interleaved
    │
    ▼
List[Segment]                   # flat list of (text, style) pairs
    │
    ▼
Segment.split_and_crop_lines()  # crop to terminal width
    │
    ▼
_render_buffer()                # Style.render(text) → "\x1b[...m{text}\x1b[0m"
    │
    ▼
file.write(ansi_string)         # to stdout, StringIO, or any IO
```

Key invariants:
- **Segments are lazy**: they're produced by generator chains, only materialized when the buffer flushes.
- **`force_terminal=True`** is required for ANSI output to non-ttys.
- **Width must be explicit** when rendering to a buffer — default `width=None` reads terminal size, which may be 0 in a pipe.
- **`color_system`** controls color depth; `None` = no color; `"truecolor"` = full RGB.
- **Style is additive**: child styles layer on top of parent styles via `+` and `StyleStack`.
- **`render_lines()`** is the key composition primitive: it's what lets containers (panels, tables, blockquotes) treat their children as fixed-width rectangular blocks.
