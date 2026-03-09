# Textual Python Library — Deep Technical Reference

A comprehensive guide to core systems in the Textual TUI framework: layouts, widgets, reactivity, animation, and testing. Compiled from vendor source and documentation.

---

## Table of Contents

1. [CSS Layout System](#1-css-layout-system)
2. [Markdown Widget](#2-markdown-widget)
3. [Digits Widget](#3-digits-widget)
4. [DataTable Widget](#4-datatable-widget)
5. [TextArea Widget](#5-textarea-widget)
6. [Reactive & Message System](#6-reactive--message-system)
7. [Set Interval & Animation](#7-set-interval--animation)
8. [Testing & Headless Mode](#8-testing--headless-mode)

---

## 1. CSS Layout System

**Source:** `vendor/textual/docs/guide/layout.md`

Textual's layout system defines how widgets are arranged in containers. Multiple layout strategies support both high-level positioning and nested widget composition.

### 1.1 Vertical Layout

Arranges children from top to bottom. Default layout for `Screen`.

```python
from textual.app import ComposeResult
from textual.containers import Container
from textual.widget import Widget

class VerticalExample(Container):
    DEFAULT_CSS = """
    VerticalExample {
        layout: vertical;
        height: 100%;
    }
    VerticalExample > Widget {
        height: 1fr;  # Equal height fractions
    }
    """
```

**Key properties:**
- Widgets expand to fill parent width by default
- Set `height: 1fr` to distribute available height equally among children
- Automatic scrollbar if children exceed available height (with `overflow-y: auto`)
- Manual fixed heights (e.g., `height: 10`) override `fr` units

### 1.2 Horizontal Layout

Arranges children from left to right.

```python
class HorizontalExample(Container):
    DEFAULT_CSS = """
    HorizontalExample {
        layout: horizontal;
        overflow-x: auto;  # Enable horizontal scrollbar if needed
    }
    HorizontalExample > Widget {
        height: 100%;  # Must set explicitly; auto-width is default
        width: 1fr;    # Distribute width equally
    }
    """
```

**Key properties:**
- Widgets do NOT auto-expand vertically; must set `height: 100%` explicitly
- Auto-expands horizontally without scrollbar (children go offscreen)
- Add `overflow-x: auto` to enable horizontal scrolling

### 1.3 Grid Layout

Arranges widgets in rows and columns with powerful cell-spanning.

```python
class GridExample(Container):
    DEFAULT_CSS = """
    GridExample {
        layout: grid;
        grid-size: 3;           # 3 columns; rows auto-created
        grid-columns: 2fr 1fr 1fr;  # First col 2x width of others
        grid-rows: 25% 75%;     # Custom row heights
        grid-gutter: 1 2;       # Vertical 1, horizontal 2 spacing
    }
    
    #two {
        column-span: 2;  # Span 2 columns
        row-span: 2;     # Span 2 rows
    }
    """
```

**Grid properties:**
- `grid-size: N` — N columns, auto rows (or `N M` for fixed rows)
- `grid-columns` / `grid-rows` — space-separated per-column/row sizing
- Values can be: `1fr`, `2fr`, `auto`, percentages, fixed units
- `auto` sizes to content; values repeat if fewer than grid dimensions
- `column-span` / `row-span` — cell spanning
- `grid-gutter` — spacing between cells (not edges); use `1 2` for vertical/horizontal

**Grid auto-sizing:**
```css
grid-columns: auto 1fr 1fr;  /* First column sized to content */
```

### 1.4 Utility Containers

Compose complex layouts using `Vertical`, `Horizontal`, and nested composition.

```python
from textual.containers import Vertical, Horizontal
from textual.widgets import Static

class ComplexLayout(Static):
    def compose(self) -> ComposeResult:
        with Horizontal():
            with Vertical():  # Left column
                yield Static("Left Top")
                yield Static("Left Bottom")
            with Vertical():  # Right column
                yield Static("Right Top")
                yield Static("Right Bottom")
```

**Context manager pattern:**
```python
with Horizontal():
    yield Static("Widget A")
    yield Static("Widget B")
# Equivalent to: Horizontal(Static("Widget A"), Static("Widget B"))
```

### 1.5 Docking

Fixes a widget to an edge (top/right/bottom/left), removing it from normal flow. Docked widgets don't scroll.

```python
class DockExample(Static):
    DEFAULT_CSS = """
    #header {
        dock: top;
        height: 3;
    }
    #sidebar {
        dock: left;
        width: 20;
    }
    """
```

**Docking behavior:**
- First yielded widget appears below widgets yielded after it (z-order reversal)
- Multiple docks on same edge cause overlap
- Perfect for sticky headers, footers, sidebars
- Scrolling body content doesn't affect docked widgets

### 1.6 Layers

Control z-ordering of descendants via named layers.

```python
DEFAULT_CSS = """
Container {
    layers: background foreground overlay;  # Low to high
}

#box1 {
    layer: overlay;  # Top layer, visible above box2
}

#box2 {
    layer: background;  # Lowest, hidden behind box1
}
"""
```

**Layer mechanics:**
- Layers defined on parent, assigned to children
- Leftmost layer name = lowest (drawn first)
- Rightmost = highest (drawn last, visible on top)
- Overrides normal yield order

### 1.7 Offsets

Relative positional adjustments applied after layout resolution.

```python
DEFAULT_CSS = """
Widget {
    offset: 5 -2;  /* x: right 5 cells, y: up 2 cells */
}
"""
```

**Offset syntax:**
- First value: horizontal offset (positive = right, negative = left)
- Second value: vertical offset (positive = down, negative = up)
- Applied after layout is determined
- Useful for fine-tuning without affecting siblings

---

## 2. Markdown Widget

**Source:** `vendor/textual/src/textual/widgets/_markdown.py` (1617 lines)

A full-featured Markdown renderer with support for headings, code blocks, tables, lists, and interactive links.

### 2.1 Core Architecture

```python
class Markdown(Widget):
    """A Markdown widget."""
    
    BLOCKS: dict[str, type[MarkdownBlock]] = {
        "h1": MarkdownH1,
        "h2": MarkdownH2,
        # ... other block types
        "fence": MarkdownFence,
        "code_block": MarkdownFence,
        "table_open": MarkdownTable,
    }
    
    def __init__(
        self,
        markdown: str | None = None,
        *,
        parser_factory: Callable[[], MarkdownIt] | None = None,
        open_links: bool = True,
    ):
        super().__init__()
        self._initial_markdown = markdown
        self._markdown = ""
        self._parser_factory = parser_factory
        self._table_of_contents: TableOfContentsType | None = None
        self._open_links = open_links
```

**Key attributes:**
- `_parser_factory` — custom MarkdownIt parser (defaults to "gfm-like")
- `_table_of_contents` — cached list of (level, title, id) tuples
- `_open_links` — auto-open links if True
- `_last_parsed_line` — tracks last parsed line for incremental append

### 2.2 MarkdownStream — Streaming Support

For high-frequency markdown updates (>20/sec), use `MarkdownStream` to batch updates:

```python
class MarkdownStream:
    """Manage streaming markdown with buffering."""
    
    def __init__(self, markdown_widget: Markdown) -> None:
        self.markdown_widget = markdown_widget
        self._task: asyncio.Task | None = None
        self._new_markup = asyncio.Event()
        self._pending: list[str] = []
        self._stopped = False
    
    def start(self) -> None:
        """Start background updater."""
        if self._task is None:
            self._task = asyncio.create_task(self._run())
    
    async def write(self, markdown_fragment: str) -> None:
        """Enqueue a fragment."""
        if self._stopped:
            raise RuntimeError("Stream stopped")
        self._pending.append(markdown_fragment)
        self._new_markup.set()
        await asyncio.sleep(0)  # Let task wake
    
    async def stop(self) -> None:
        """Stop and finalize."""
        if self._task is not None:
            self._task.cancel()
            await self._task
            self._task = None
            self._stopped = True
    
    async def _run(self) -> None:
        """Background task combining fragments."""
        try:
            while await self._new_markup.wait():
                new_markdown = "".join(self._pending)
                self._pending.clear()
                self._new_markup.clear()
                await asyncio.shield(
                    self.markdown_widget.append(new_markdown)
                )
        except asyncio.CancelledError:
            pass
        
        # Finalize any remaining fragments
        new_markdown = "".join(self._pending)
        if new_markdown:
            await self.markdown_widget.append(new_markdown)
```

**Usage pattern:**
```python
@work
async def stream_markdown(self) -> None:
    markdown_widget = self.query_one(Markdown)
    stream = Markdown.get_stream(markdown_widget)
    try:
        while (chunk := await self.get_chunk()) is not None:
            await stream.write(chunk)
    finally:
        await stream.stop()
```

### 2.3 Headings (H1–H6)

Each heading level has a dedicated class with level-specific CSS:

```python
class MarkdownH1(MarkdownHeader):
    LEVEL = 1
    DEFAULT_CSS = """
    MarkdownH1 {
        content-align: center middle;
        color: $markdown-h1-color;
        background: $markdown-h1-background;
        text-style: $markdown-h1-text-style;
    }
    """

class MarkdownH2(MarkdownHeader):
    LEVEL = 2
    DEFAULT_CSS = """
    MarkdownH2 {
        color: $markdown-h2-color;
        background: $markdown-h2-background;
        text-style: $markdown-h2-text-style;
    }
    """
```

**Auto-generated IDs:**
```python
if token_type == "heading_close":
    block.id = (
        f"heading-{slug_for_tcss_id(block._content.plain)}-{id(block)}"
    )
```

Slugs are GitHub-style (lowercase, hyphens); unique via trailing object ID.

### 2.4 Code Blocks (Fence/Code Block)

```python
class MarkdownFence(MarkdownBlock):
    """Renders code with syntax highlighting."""
    
    DEFAULT_CSS = """
    MarkdownFence {
        padding: 0;
        margin: 1 0;
        overflow: scroll hidden;
        width: 1fr;
        height: auto;
        color: rgb(210,210,210);
        background: black 10%;
    }
    """
    
    def __init__(self, markdown: Markdown, token: Token, code: str) -> None:
        super().__init__(markdown, token)
        self.code = code
        self.lexer = token.info  # Language from ````python
        self._highlighted_code = self.highlight(self.code, self.lexer)
    
    @classmethod
    def highlight(cls, code: str, language: str) -> Content:
        """Syntax highlight using Textual's highlight system."""
        return highlight(code, language=language or None)
    
    def compose(self) -> ComposeResult:
        yield Label(self._highlighted_code, id="code-content")
```

**Features:**
- `token.info` = language specifier (e.g., "python")
- `highlight()` returns rich `Content` with style spans
- Horizontal scrolling enabled; vertical scroll disabled
- 10% background darkening

### 2.5 Tables

Tables render as a grid using `MarkdownTableContent`:

```python
class MarkdownTable(MarkdownBlock):
    """A Table markdown block."""
    
    def compose(self) -> ComposeResult:
        headers, rows = self._get_headers_and_rows()
        self._headers = headers
        self._rows = rows
        yield MarkdownTableContent(headers, rows)
    
    def _get_headers_and_rows(
        self,
    ) -> tuple[list[Content], list[list[Content]]]:
        """Extract headers and rows from nested blocks."""
        headers: list[Content] = []
        rows: list[list[Content]] = []
        
        for block in flatten(self):
            if isinstance(block, MarkdownTH):
                headers.append(block._content)
            elif isinstance(block, MarkdownTR):
                rows.append([])
            elif isinstance(block, MarkdownTD):
                rows[-1].append(block._content)
        
        return headers, rows
    
    async def _update_from_block(self, block: MarkdownBlock) -> None:
        """Incremental table updates (smart append)."""
        if isinstance(block, MarkdownTable):
            try:
                table_content = self.query_one(MarkdownTableContent)
            except NoMatches:
                pass
            else:
                if table_content.rows:
                    current_rows = self._rows
                    _new_headers, new_rows = block._get_headers_and_rows()
                    updated_rows = new_rows[len(current_rows) - 1 :]
                    self._rows = new_rows
                    await table_content._update_rows(updated_rows)
                    return
        await super()._update_from_block(block)


class MarkdownTableContent(Widget):
    """Grid-layout table renderer."""
    
    DEFAULT_CSS = """
    MarkdownTableContent {
        width: 1fr;
        height: auto;
        layout: grid;
        grid-columns: auto;
        grid-rows: auto;
        grid-gutter: 1 1;
        
        & > .cell {
            height: auto;
            padding: 0 1;
            text-overflow: ellipsis;
        }
        & > .header {
            color: $primary;
            content-align: left bottom;
            text-style: bold;
        }
        keyline: thin $foreground 20%;
    }
    """
```

**Grid mapping:**
- Each cell is a `MarkdownTableCellContents` widget
- Classes: `.header` for header cells, `.cellrow{N}` for body cells
- Tooltips show full cell content on hover

### 2.6 Lists (Bullet & Ordered)

```python
class MarkdownBulletList(MarkdownList):
    """Unordered list with configurable bullets."""
    
    BULLETS = ["• ", "▪ ", "‣ ", "⭑ ", "◦ "]
    
    def compose(self) -> ComposeResult:
        for block in self._blocks:
            if isinstance(block, MarkdownListItem):
                bullet = MarkdownBullet()
                bullet.symbol = block.bullet  # Rotate bullets per nesting
                yield Horizontal(bullet, Vertical(*block._blocks))
        self._blocks.clear()


class MarkdownOrderedList(MarkdownList):
    """Ordered list with smart right-padding."""
    
    def compose(self) -> ComposeResult:
        suffix = ". "
        start = 1
        if self._blocks and isinstance(self._blocks[0], MarkdownOrderedListItem):
            try:
                start = int(self._blocks[0].bullet)
            except ValueError:
                pass
        
        # Right-pad all numbers to widest
        symbol_size = max(
            len(f"{number}{suffix}")
            for number, block in enumerate(self._blocks, start)
            if isinstance(block, MarkdownListItem)
        )
        
        for number, block in enumerate(self._blocks, start):
            if isinstance(block, MarkdownListItem):
                bullet = MarkdownBullet()
                bullet.symbol = f"{number}{suffix}".rjust(symbol_size + 1)
                yield Horizontal(bullet, Vertical(*block._blocks))
```

**List item structure:**
- Item wraps content in `Horizontal(bullet, Vertical(*blocks))`
- Bullets rotated per depth
- Ordered lists right-pad numbers for alignment

### 2.7 Table of Contents

```python
@property
def table_of_contents(self) -> TableOfContentsType:
    """Extract headers as (level, title, id) tuples."""
    if self._table_of_contents is None:
        self._table_of_contents = [
            (header.LEVEL, header._content.plain, header.id)
            for header in self.children
            if isinstance(header, MarkdownHeader)
        ]
    return self._table_of_contents


class MarkdownTableOfContents(Widget, can_focus_children=True):
    """Sidebar TOC with tree navigation."""
    
    table_of_contents = reactive[Optional[TableOfContentsType]](
        None, init=False
    )
    
    def watch_table_of_contents(
        self, table_of_contents: TableOfContentsType
    ) -> None:
        """Rebuild tree when TOC changes."""
        self.rebuild_table_of_contents(table_of_contents)
    
    def rebuild_table_of_contents(
        self, table_of_contents: TableOfContentsType
    ) -> None:
        """Build hierarchical tree from flat TOC."""
        tree = self.query_one(Tree)
        tree.clear()
        root = tree.root
        for level, name, block_id in table_of_contents:
            node = root
            for _ in range(level - 1):
                if node._children:
                    node = node._children[-1]
                    node.expand()
                else:
                    node = node.add(NUMERALS[level], expand=True)
            node_label = Text.assemble(
                (f"{NUMERALS[level]} ", "dim"), name
            )
            node.add_leaf(node_label, {"block_id": block_id})
```

**NUMERALS mapping:**
```python
NUMERALS = " ⅠⅡⅢⅣⅤⅥ"  # Index = header level
```

### 2.8 Links & Actions

```python
async def action_link(self, href: str) -> None:
    """Called on link click."""
    self.post_message(Markdown.LinkClicked(self._markdown, href))


class LinkClicked(Message):
    """Posted when a link is clicked."""
    
    def __init__(self, markdown: Markdown, href: str) -> None:
        super().__init__()
        self.markdown = markdown
        self.href = unquote(href)  # URL decode


def on_markdown_link_clicked(self, event: LinkClicked) -> None:
    if self._open_links:
        self.app.open_url(event.href)
```

Inline token processing embeds links as `Style.from_meta({"@click": action})`.

### 2.9 Block Update & Append

```python
async def update(self, markdown: str) -> AwaitComplete:
    """Replace entire document (batched mount)."""
    
    async def await_update() -> None:
        BATCH_SIZE = 200
        batch: list[MarkdownBlock] = []
        
        async with self.lock:
            tokens = await asyncio.get_running_loop().run_in_executor(
                None, parser.parse, markdown
            )
            
            removed = False
            
            async def mount_batch(batch: list[MarkdownBlock]) -> None:
                nonlocal removed
                if removed:
                    await self.mount_all(batch)
                else:
                    with self.app.batch_update():
                        await markdown_block.remove()
                        await self.mount_all(batch)
                    removed = True
            
            for block in self._parse_markdown(tokens):
                batch.append(block)
                if len(batch) == BATCH_SIZE:
                    await mount_batch(batch)
                    batch.clear()
            
            if batch:
                await mount_batch(batch)
            if not removed:
                await markdown_block.remove()
        
        self._last_parsed_line = len(lines) - (1 if lines and lines[-1] else 0)
        self.post_message(
            Markdown.TableOfContentsUpdated(
                self, self.table_of_contents
            ).set_sender(self)
        )
    
    return AwaitComplete(await_update())


async def append(self, markdown: str) -> AwaitComplete:
    """Append markdown (incremental, smart)."""
    
    async def await_append() -> None:
        async with self.lock:
            tokens = parser.parse(updated_source)
            existing_blocks = [
                child for child in self.children
                if isinstance(child, MarkdownBlock)
            ]
            
            new_blocks = list(self._parse_markdown(tokens))
            any_headers = any(
                isinstance(block, MarkdownHeader)
                for block in new_blocks
            )
            
            with self.app.batch_update():
                if existing_blocks and new_blocks:
                    last_block = existing_blocks[-1]
                    last_block.source_range = new_blocks[0].source_range
                    try:
                        # Smart merge: try to reuse last block
                        await last_block._update_from_block(
                            new_blocks[0]
                        )
                    except IndexError:
                        pass
                    else:
                        new_blocks = new_blocks[1:]
                
                if new_blocks:
                    await self.mount_all(new_blocks)
            
            if any_headers:
                self._table_of_contents = None
                self.post_message(
                    Markdown.TableOfContentsUpdated(
                        self, self.table_of_contents
                    ).set_sender(self)
                )
    
    return AwaitComplete(await_append())
```

**Key insight:** Append tries to merge the last existing block with the first new block (e.g., a paragraph continuing). This prevents duplication when documents are streamed incrementally.

---

## 3. Digits Widget

**Source:** `vendor/textual/src/textual/widgets/_digits.py`

Renders large, ASCII-based numerics using a 3x3 grid of Unicode block characters.

### 3.1 Core Class

```python
class Digits(Widget):
    """Display numerical values as large ASCII digits."""
    
    DEFAULT_CSS = """
    Digits {
        width: 1fr;
        height: auto;
        text-align: left;
        box-sizing: border-box;
    }
    """
    
    def __init__(
        self,
        value: str = "",
        *,
        name: str | None = None,
        id: str | None = None,
        classes: str | None = None,
        disabled: bool = False,
    ) -> None:
        if not isinstance(value, str):
            raise TypeError("value must be a str")
        super().__init__(name=name, id=id, classes=classes, disabled=disabled)
        self._value = value
    
    @property
    def value(self) -> str:
        """The current value displayed."""
        return self._value
    
    def update(self, value: str) -> None:
        """Update with new value."""
        if not isinstance(value, str):
            raise TypeError("value must be a str")
        
        # Only re-layout if width changes
        layout_required = len(value) != len(self._value) or (
            DigitsRenderable.get_width(self._value) !=
            DigitsRenderable.get_width(value)
        )
        self._value = value
        self.refresh(layout=layout_required)
```

### 3.2 Rendering

```python
def render(self) -> RenderResult:
    """Render digits with optional selection."""
    rich_style = self.rich_style
    if self.text_selection:
        rich_style += self.selection_style
    
    digits = DigitsRenderable(self._value, rich_style)
    text_align = self.styles.text_align
    align = (
        "left"
        if text_align not in {"left", "center", "right"}
        else text_align
    )
    return Align(digits, cast(AlignMethod, align), rich_style)
```

**Renderable pattern:**
1. Create `DigitsRenderable(value, style)`
2. Wrap in `Align(renderable, align_method, style)`
3. Return from `render()`

### 3.3 Width Measurement

```python
def get_content_width(self, container: Size, viewport: Size) -> int:
    """Report optimal width."""
    return DigitsRenderable.get_width(self._value)


def get_content_height(self, container: Size, viewport: Size, width: int) -> int:
    """Always 3 lines tall."""
    return 3  # Digits use 3x3 grid = 3 lines
```

**Key insight:** Digits are always 3 lines tall (fixed). Width depends on digit count and specific glyphs.

### 3.4 Selection

```python
def get_selection(self, selection: Selection) -> str | None:
    return self._value
```

Supports text selection; returns full value when selected.

---

## 4. DataTable Widget

**Source:** `vendor/textual/src/textual/widgets/_data_table.py` (first 150 lines)

High-performance table with virtual scrolling, custom column sizing, and cursor types.

### 4.1 Core Architecture (Lines 1–150)

```python
from typing import (
    Any, Callable, ClassVar, Generic, Iterable,
    NamedTuple, TypeVar, Union,
)

CellCacheKey: TypeAlias = (
    "tuple[RowKey, ColumnKey, Style, bool, bool, bool, int, PseudoClasses]"
)
LineCacheKey: TypeAlias = (
    "tuple[int, int, int, int, Coordinate, Coordinate, Style, "
    "CursorType, bool, int, PseudoClasses]"
)
RowCacheKey: TypeAlias = (
    "tuple[RowKey, int, Style, Coordinate, Coordinate, "
    "CursorType, bool, bool, int, PseudoClasses]"
)

CursorType = Literal["cell", "row", "column", "none"]
"""Valid cursor types."""

CellType = TypeVar("CellType")
"""Generic type variable for cell values."""


class StringKey:
    """Object key that can also match string lookups."""
    
    value: str | None
    
    def __init__(self, value: str | None = None):
        self.value = value
    
    def __hash__(self):
        return hash(self.value) if self.value is not None else id(self)
    
    def __eq__(self, other: object) -> bool:
        if isinstance(other, str):
            return self.value == other
        elif isinstance(other, StringKey):
            if self.value is not None and other.value is not None:
                return self.value == other.value
            else:
                return hash(self) == hash(other)
        else:
            return NotImplemented


class RowKey(StringKey):
    """Unique row identifier (stable across sorting)."""


class ColumnKey(StringKey):
    """Unique column identifier (stable across sorting)."""


class CellKey(NamedTuple):
    """(row_key, column_key) tuple uniquely identifying a cell."""
    row_key: RowKey
    column_key: ColumnKey


# Exception types
class CellDoesNotExist(Exception):
    """Cell key/index invalid."""

class RowDoesNotExist(Exception):
    """Row key/index invalid."""

class ColumnDoesNotExist(Exception):
    """Column key/index invalid."""

class DuplicateKey(Exception):
    """Key already exists."""
```

### 4.2 Caching Strategy

DataTable uses multi-level caches for performance:

```python
CellCacheKey: TypeAlias = (
    "tuple[RowKey, ColumnKey, Style, bool, bool, bool, int, PseudoClasses]"
)
# Caches rendered segments for each cell based on:
# - Row key, column key
# - Text style, highlight, hover, focus state
# - Width
# - Pseudo-classes (:dark, :light, etc.)

LineCacheKey: TypeAlias = (
    "tuple[int, int, int, int, Coordinate, Coordinate, Style, "
    "CursorType, bool, int, PseudoClasses]"
)
# Caches full line render (y, x, width, height, ...) for scroll optimization

RowCacheKey: TypeAlias = (
    "tuple[RowKey, int, Style, Coordinate, Coordinate, "
    "CursorType, bool, bool, int, PseudoClasses]"
)
# Caches entire row rendering
```

### 4.3 Virtual Scrolling

DataTable implements virtual scrolling to handle large datasets efficiently:

```python
# Only render visible rows + padding
# Keep cells scrolled out of view in memory cache
# Invalidate cache on:
#   - Row/column data change
#   - Scroll position change
#   - Width/height change
#   - Style change
```

**Performance implications:**
- O(1) cell lookup regardless of dataset size
- Render only visible area + cache margins
- LRU cache with configurable size limits

### 4.4 Column Sizing

```python
# Supported column sizing modes:
# - Fixed width: width: 10
# - Fraction: width: 1fr
# - Auto: width: auto (size to content)
# - Percent: width: 50%

# Sizing order:
# 1. Fixed-width columns allocated first
# 2. Remaining space distributed by fr units
# 3. Auto columns grow/shrink to fit content
```

---

## 5. TextArea Widget

**Source:** `vendor/textual/src/textual/widgets/_text_area.py` (first 100 lines)

Multi-line text editor with syntax highlighting via tree-sitter integration.

### 5.1 Core Definition (Lines 1–100)

```python
from __future__ import annotations

import dataclasses
import re
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import (
    TYPE_CHECKING, ClassVar, Iterable, Optional,
    Sequence, Tuple
)

from rich.console import RenderableType
from rich.segment import Segment
from rich.style import Style
from rich.text import Text

from textual._text_area_theme import TextAreaTheme
from textual._tree_sitter import TREE_SITTER, get_language
from textual.actions import SkipAction
from textual.cache import LRUCache
from textual.color import Color
from textual.content import Content
from textual.document._document import (
    Document, DocumentBase, EditResult, Location,
    Selection, _utf8_encode,
)
from textual.document._document_navigator import DocumentNavigator
from textual.document._edit import Edit
from textual.document._history import EditHistory
from textual.document._syntax_aware_document import (
    SyntaxAwareDocument, SyntaxAwareDocumentError,
)
from textual.document._wrapped_document import WrappedDocument

if TYPE_CHECKING:
    from tree_sitter import Language, Query

# Bracket pairs
_OPENING_BRACKETS = {"{": "}", "[": "]", "(": ")"}
_CLOSING_BRACKETS = {v: k for k, v in _OPENING_BRACKETS.items()}

# Tree-sitter resource path
_TREE_SITTER_PATH = Path(__file__).parent / "../tree-sitter/"
_HIGHLIGHTS_PATH = _TREE_SITTER_PATH / "highlights/"

StartColumn = int
EndColumn = Optional[int]
HighlightName = str
Highlight = Tuple[StartColumn, EndColumn, HighlightName]
"""A highlight span: (start_col, end_col, name)."""

BUILTIN_LANGUAGES = [
    "python", "markdown", "json", "toml", "yaml",
    "html", "css", "javascript", "rust", "go",
    "regex", "sql", "java", "bash", "xml",
]
"""Languages bundled with syntax extras."""


class ThemeDoesNotExist(Exception):
    """Theme not found (builtin or registered)."""


class LanguageDoesNotExist(Exception):
    """Language not found (builtin or registered)."""


@dataclass
class TextAreaLanguage:
    """Container for a registered language."""
    # Contains: name, tree_sitter_language, highlight_query
```

### 5.2 Syntax Highlighting via Tree-Sitter

```python
# Tree-sitter integration:
# 1. Parse document into syntax tree
# 2. Run highlight query against tree
# 3. Extract named captures as style spans
# 4. Apply themes to highlight names

from textual._tree_sitter import TREE_SITTER, get_language

# Language loading:
language: Language = get_language("python")
parser = TREE_SITTER.create_parser()
parser.set_language(language)

# Syntax queries (highlight.scm files per language):
# @keyword → keyword style
# @string → string style
# @comment → comment style
# etc.
```

### 5.3 Document Model

```python
# TextArea uses multiple document layers:
# 1. DocumentBase — raw text, line breaking
# 2. SyntaxAwareDocument — parse + highlights
# 3. WrappedDocument — soft-wrapped display
# 4. Document — unified interface

# Key operations:
# - edit(start, end, replacement) → EditResult
# - get_selection() → Selection(start, end)
# - set_selection(start, end)
# - get_line(row) → str
```

### 5.4 Built-in Languages

```python
BUILTIN_LANGUAGES = [
    "python",      # Full support
    "markdown",    # Full support
    "json",        # Full support
    "toml",        # Full support
    "yaml",        # Full support
    "html",        # Full support
    "css",         # Full support
    "javascript",  # Full support
    "rust",        # Full support
    "go",          # Full support
    "regex",       # Full support
    "sql",         # Full support
    "java",        # Full support
    "bash",        # Full support
    "xml",         # Full support
]
```

All bundled via tree-sitter WASM in the `tree-sitter/` vendor directory.

### 5.5 Themes

```python
# TextAreaTheme defines:
# - base_style (bg, fg)
# - highlight styles (keyword, string, comment, etc.)
# - cursor style
# - selection style
# - diagnostic colors (error, warning, info)

# Usage:
from textual._text_area_theme import TextAreaTheme

text_area = TextArea(language="python", theme="monokai")
# or
text_area.theme = "dracula"
```

---

## 6. Reactive & Message System

**Source:** `vendor/textual/docs/guide/reactivity.md`

Textual's reactive system provides attribute change tracking, validation, watchers, and data binding.

### 6.1 Creating Reactive Attributes

```python
from textual.reactive import reactive, var
from textual.widget import Widget

class MyWidget(Widget):
    # Reactive with auto-refresh
    count = reactive(0)  # Default 0, type inferred as int
    name = reactive("Paul")  # Default "Paul", type str
    is_cool = reactive(True)  # Default True, type bool
    
    # Reactive with custom type (optional, superclass of default)
    color: reactive[Color | None] = reactive(Color.parse("red"))
    
    # Non-reactive (no refresh/layout, but can have watchers)
    _internal_state = var([])  # var() = no automatic refresh
```

### 6.2 Dynamic Defaults (Callable)

```python
from time import time
from textual.reactive import reactive

class Timer(Widget):
    # Defaults to current time when widget is created
    start_time = reactive(time)  # Callable is called for default
```

### 6.3 Smart Refresh

When a reactive attribute changes:
1. Textual detects the change
2. Calls widget's `render()` method
3. Updates content (not size)
4. Multiple changes batched into one refresh

```python
class Name(Widget):
    who = reactive("Paul")
    
    def render(self) -> str:
        return f"Hello, {self.who}!"

# In an event handler:
self.who = "Jessica"  # Automatically triggers refresh + render()
```

**Smart detection:**
- Same value assigned = no refresh
- Only content updated if `layout=False` (default)

### 6.4 Layout-Aware Refresh

```python
class MyWidget(Widget):
    # Setting layout=True triggers layout recalculation
    greeting = reactive("Hello", layout=True)
    
    DEFAULT_CSS = """
    MyWidget {
        width: auto;  # Widget grows/shrinks with greeting
    }
    """
```

When `greeting` changes and is longer/shorter, the widget resizes.

### 6.5 Validation

Add `validate_<attr>` method to validate/transform values:

```python
class Counter(Widget):
    count = reactive(0)
    
    def validate_count(self, value: int) -> int:
        """Clamp count to [0, 10]."""
        return max(0, min(10, value))
    
    def action_increment(self) -> None:
        self.count += 1  # Auto-validated to [0, 10]
```

**Validation rules:**
- Called on each assignment
- Can return modified value
- Runs before watchers

### 6.6 Watch Methods

Watch methods fire when reactive attributes change:

```python
class ColorBox(Widget):
    color = reactive(Color.parse("blue"))
    
    # Single argument = new value only
    def watch_color(self, new_color: Color) -> None:
        self.styles.background = new_color
    
    # Two arguments = old and new
    def watch_color_extended(self, old: Color, new: Color) -> None:
        self.log(f"Color changed from {old} to {new}")
```

**Watch behavior:**
- Called only if value actually changes
- Can modify other reactives (recomposition safe)
- Called AFTER validation

### 6.7 Disabling Watchers on Assignment

```python
class MyWidget(Widget):
    greeting = reactive("Hello")
    
    def watch_greeting(self, new: str) -> None:
        # This tries to query DOM
        self.query_one("#label").update(new)
    
    def on_mount(self) -> None:
        # Can't use normal assignment in __init__ before mount
        # Use set_reactive to skip watcher
        self.set_reactive(MyWidget.greeting, "Hi")
```

### 6.8 Mutable Collections

Textual can't detect mutations (list append, dict update):

```python
class MyWidget(Widget):
    names = reactive([])
    
    def add_name(self, name: str) -> None:
        self.names.append(name)  # NOT detected!
        # Must explicitly notify:
        self.mutate_reactive(MyWidget.names)
```

### 6.9 Recompose

Replace all child widgets when reactive changes:

```python
class Clock(Widget):
    time = reactive(datetime.now(), recompose=True)
    
    def compose(self) -> ComposeResult:
        # Called fresh each time time changes
        yield Digits(self.time.strftime("%H:%M:%S"))
```

**Trade-offs:**
- Recomposes ALL children (expensive for large trees)
- Simpler code (no manual updates)
- Child state lost on recompose
- Less efficient than refresh for rapid changes

### 6.10 Computed Attributes

Cache computed values that depend on other reactives:

```python
class ColorMixer(Widget):
    red = reactive(0)
    green = reactive(0)
    blue = reactive(0)
    
    # Computed & cached; recalculated when any input changes
    color: reactive[Color] = reactive(Color())
    
    def compute_color(self) -> Color:
        return Color(f"rgb({self.red},{self.green},{self.blue})")
    
    def watch_color(self, new_color: Color) -> None:
        # Fires when compute_color result changes
        self.styles.background = new_color
```

**Execution order:**
1. `compute_color()` — calculate value
2. `validate_color()` — validate/transform
3. `watch_color()` — side effects

### 6.11 Dynamic Watchers

Add watchers programmatically:

```python
class MyApp(App):
    def on_mount(self) -> None:
        counter = self.query_one(Counter)
        
        # Add custom watcher to existing reactive
        counter.watch(
            Counter.count,
            self.on_counter_changed,
        )
    
    def on_counter_changed(self, new_count: int) -> None:
        self.log(f"Counter is now {new_count}")
```

### 6.12 Data Binding

Bind parent reactive to child reactives (one-way):

```python
class WorldClock(Widget):
    time = reactive(datetime.now())


class App(App):
    time = reactive(datetime.now())
    
    def compose(self) -> ComposeResult:
        london = WorldClock()
        paris = WorldClock()
        
        # Bind parent time to children
        london.data_bind(App.time)
        paris.data_bind(App.time)
        
        yield london
        yield paris
    
    async def on_mount(self) -> None:
        # Update parent; children auto-update
        while True:
            self.time = datetime.now()
            await asyncio.sleep(1)
```

**Binding with rename:**

```python
class Clock(Widget):
    clock_time = reactive(datetime.now())


class App(App):
    time = reactive(datetime.now())
    
    def compose(self) -> ComposeResult:
        clock = Clock()
        # Use keyword to bind different names
        clock.data_bind(clock_time=App.time)
        yield clock
```

**Key constraint:** Data binding is one-way (parent → child only).

### 6.13 Always Update

```python
class MyWidget(Widget):
    # Normally: same value → no update
    # With always_update=True: always fire watcher
    value = reactive(0, always_update=True)
    
    def watch_value(self, new: int) -> None:
        # Called even if set to same value
        self.log(f"Value is {new}")

self.value = 5
self.value = 5  # Still fires watch_value (with always_update=True)
```

---

## 7. Set Interval & Animation

**Source:** `vendor/textual/docs/guide/animation.md`

### 7.1 Animate CSS Properties

```python
from textual.app import App, ComposeResult
from textual.widgets import Static

class FadeOut(App):
    def compose(self) -> ComposeResult:
        yield Static("This will fade out")
    
    def on_mount(self) -> None:
        box = self.query_one(Static)
        # Animate opacity to 0 over 2 seconds
        box.styles.animate("opacity", value=0.0, duration=2.0)
```

### 7.2 Animate Method Signature

```python
def animate(
    self,
    attribute: str,
    value: float,
    *,
    duration: float | None = None,
    speed: float | None = None,
    easing: str = "in_out_cubic",
    on_complete: Callable[[], None] | None = None,
    delay: float = 0.0,
) -> None:
    """Animate a style attribute.
    
    Args:
        attribute: CSS property name (e.g., "opacity", "offset", "tint")
        value: Target value (float or convertible)
        duration: Animation duration in seconds (default 1.0)
        speed: Alternative: units per second (overrides duration)
        easing: Easing function name (default "in_out_cubic")
        on_complete: Callback when animation finishes
        delay: Delay before animation starts (seconds)
    """
```

### 7.3 Duration vs. Speed

```python
# Duration: total time in seconds
box.styles.animate("offset", value=(10, 5), duration=2.0)
# Offset (0, 0) → (10, 5) over 2 seconds

# Speed: units per second
box.styles.animate("offset", value=(10, 5), speed=5.0)
# Offset (0, 0) → (10, 5) at 5 units/sec = 2 seconds
```

### 7.4 Easing Functions

Common easing functions (from easings.net):

```python
# Linear
box.styles.animate("opacity", value=0.0, easing="linear")

# Cubic (default)
box.styles.animate("opacity", value=0.0, easing="in_out_cubic")

# Quad
box.styles.animate("opacity", value=0.0, easing="in_quad")
box.styles.animate("opacity", value=0.0, easing="out_quad")
box.styles.animate("opacity", value=0.0, easing="in_out_quad")

# Quart
box.styles.animate("opacity", value=0.0, easing="in_quart")

# Quint
box.styles.animate("opacity", value=0.0, easing="in_quint")

# Sine
box.styles.animate("opacity", value=0.0, easing="in_sine")

# Expo
box.styles.animate("opacity", value=0.0, easing="in_expo")

# Circ
box.styles.animate("opacity", value=0.0, easing="in_circ")

# Back
box.styles.animate("opacity", value=0.0, easing="in_back")

# Elastic
box.styles.animate("opacity", value=0.0, easing="out_elastic")

# Bounce
box.styles.animate("opacity", value=0.0, easing="out_bounce")
```

**Preview all easing functions:**
```bash
textual easing
```

### 7.5 Completion Callbacks

```python
def on_animation_complete(self) -> None:
    self.log("Animation finished!")

box.styles.animate(
    "opacity",
    value=0.0,
    duration=2.0,
    on_complete=on_animation_complete,
)
```

### 7.6 Delayed Animations

```python
# Wait 5 seconds, then animate over 2 seconds
box.styles.animate(
    "opacity",
    value=0.0,
    duration=2.0,
    delay=5.0,
)
# Total time: 7 seconds
```

### 7.7 Common Animatable Properties

```python
# Opacity (fade in/out)
widget.styles.animate("opacity", value=1.0, duration=1.0)

# Offset (move)
widget.styles.animate("offset", value=(10, 5), duration=1.0)

# Tint (color overlay)
widget.styles.animate("tint", value="red 50%", duration=1.0)

# Background (color change)
widget.styles.animate("background", value="blue", duration=1.0)

# Blur (if supported)
widget.styles.animate("blur", value=5, duration=1.0)
```

### 7.8 Set Interval (Reactive Pattern)

Textual doesn't have a built-in `set_interval`; use `asyncio.create_task` + sleep:

```python
import asyncio
from textual.widget import Widget

class Clock(Widget):
    def on_mount(self) -> None:
        # Create background task for periodic updates
        self.app.set_interval(self.update_time, interval=1.0)
    
    async def update_time(self) -> None:
        # Called every 1.0 seconds
        self.log(f"Time: {datetime.now()}")
```

**Alternative with reactive:**

```python
import asyncio
from textual.reactive import reactive

class Clock(Widget):
    time = reactive(datetime.now())
    
    async def on_mount(self) -> None:
        while True:
            self.time = datetime.now()
            await asyncio.sleep(1.0)
```

---

## 8. Testing & Headless Mode

**Source:** `vendor/textual/docs/guide/testing.md`

### 8.1 Test Setup

```bash
pip install pytest pytest-asyncio
```

**pytest.ini:**
```ini
[pytest]
asyncio_mode = auto
```

### 8.2 Basic Test Pattern

```python
import pytest
from textual.app import ComposeResult
from textual.widgets import Button, Static
from textual.app import App


class RGBApp(App):
    """Simple color picker app."""
    
    def compose(self) -> ComposeResult:
        yield Button("Red", id="red")
        yield Button("Green", id="green")
        yield Button("Blue", id="blue")
    
    def on_button_pressed(self, event: Button.Pressed) -> None:
        button_id = event.button.id
        colors = {"red": "red", "green": "green", "blue": "blue"}
        self.styles.background = colors.get(button_id)


@pytest.mark.asyncio
async def test_button_click():
    """Test button click changes background."""
    app = RGBApp()
    async with app.run_test() as pilot:
        # Simulate click
        await pilot.click("#red")
        
        # Assert result
        assert app.styles.background == Color.parse("red")


@pytest.mark.asyncio
async def test_key_press():
    """Test key press."""
    app = RGBApp()
    async with app.run_test() as pilot:
        # Simulate key
        await pilot.press("r")
        
        # Assert
        assert app.styles.background == Color.parse("red")
```

### 8.3 Pilot Methods

```python
# Key presses
await pilot.press("enter")
await pilot.press("h", "e", "l", "l", "o")  # Type "hello"
await pilot.press("ctrl+c")

# Mouse clicks
await pilot.click()  # Click at (0, 0)
await pilot.click("#button")  # Click button by selector
await pilot.click("#button", offset=(2, 1))  # Offset relative
await pilot.click("#button", times=2)  # Double-click
await pilot.click("#button", control=True)  # Ctrl+click
await pilot.click("#button", shift=True)  # Shift+click
await pilot.click("#button", meta=True)  # Cmd+click

# Hovering
await pilot.hover("#widget")

# Pause
await pilot.pause()  # Wait for pending messages
await pilot.pause(delay=0.5)  # Delay then wait
```

### 8.4 App.run_test() Context Manager

```python
async def test_with_custom_size():
    """Test with specific terminal size."""
    app = MyApp()
    # Default size: (80, 24)
    async with app.run_test(size=(100, 50)) as pilot:
        # Test code here
        await pilot.pause()
        assert app.size == (100, 50)
```

### 8.5 Message Timing

```python
async def test_with_timing():
    """Messages may be async; pause before assert."""
    app = MyApp()
    async with app.run_test() as pilot:
        # Post a message
        app.post_message(CustomMessage())
        
        # Wait for all pending messages to process
        await pilot.pause()
        
        # Now assert
        assert app.state_reflects_message
```

### 8.6 Snapshot Testing

Install pytest plugin:

```bash
pip install pytest-textual-snapshot
```

**Create snapshot test:**

```python
def test_calculator(snap_compare):
    """Snapshot of calculator app."""
    assert snap_compare("path/to/calculator.py")
```

**First run:**

```bash
pytest path/to/test.py
```

Generates SVG screenshot; test fails (expected). Review in browser link.

**Accept snapshots:**

```bash
pytest --snapshot-update
```

**Future runs:**

```bash
pytest
```

Compares against saved snapshot; fails on visual changes.

**Snapshot with key presses:**

```python
def test_calculator_with_input(snap_compare):
    """Snapshot after typing."""
    assert snap_compare(
        "path/to/calculator.py",
        press=["3", ".", "1", "4", "1", "5", "9", "2"],
    )
```

**Snapshot with terminal size:**

```python
def test_calculator_fullscreen(snap_compare):
    assert snap_compare(
        "path/to/calculator.py",
        terminal_size=(120, 40),
    )
```

**Snapshot with setup code:**

```python
def test_calculator_with_setup(snap_compare):
    async def run_before(pilot) -> None:
        await pilot.hover("#number-5")
    
    assert snap_compare(
        "path/to/calculator.py",
        run_before=run_before,
    )
```

### 8.7 Testing Best Practices

**1. Test user interactions:**
```python
async def test_user_workflow():
    app = MyApp()
    async with app.run_test() as pilot:
        # Simulate realistic user actions
        await pilot.click("#input")
        await pilot.press("t", "e", "s", "t")
        await pilot.press("enter")
        await pilot.pause()
        
        # Check result
        assert app.submitted_text == "test"
```

**2. Use snapshots for visual regression:**
```python
# Ensures UI styling doesn't regress
def test_visual_layout(snap_compare):
    assert snap_compare("my_app.py")
```

**3. Test messages and state:**
```python
async def test_message_handling():
    app = MyApp()
    async with app.run_test() as pilot:
        app.post_message(CustomEvent(value=42))
        await pilot.pause()
        
        assert app.processed_value == 42
```

**4. Test error cases:**
```python
async def test_invalid_input():
    app = MyApp()
    async with app.run_test() as pilot:
        await pilot.click("#input")
        await pilot.press("i", "n", "v", "a", "l", "i", "d")
        await pilot.pause()
        
        # Widget should reject invalid input
        assert not app.has_error
```

---

## Summary: Key Patterns

### Layout
- **Vertical/Horizontal:** Simple 1D flows
- **Grid:** Complex 2D with row/column sizing, gutter, spanning
- **Dock:** Sticky headers/footers
- **Layers:** Z-order control

### Widgets
- **Markdown:** Full document rendering with TOC, streaming, links
- **Digits:** Large ASCII numerics (3x3 grid)
- **DataTable:** Virtual scrolling, cell caching, multi-cursor
- **TextArea:** Syntax highlighting via tree-sitter, multi-language

### Reactivity
- **Reactive:** Auto-refresh on change, validation, watchers, data binding
- **Var:** Non-refreshing reactive attribute
- **Compute:** Cached computed reactives
- **Watch:** Side-effect methods on change

### Animation
- **animate():** Smooth transitions (opacity, offset, tint)
- **Easing:** 30+ functions from easings.net
- **Delay/Complete:** Deferred start, completion callbacks

### Testing
- **run_test():** Headless async testing
- **Pilot:** Simulate keys, clicks, hover
- **Snapshots:** Visual regression testing
- **Pause:** Wait for async messages

---

## Additional Resources

- **Textual Docs:** `/vendor/textual/docs/`
- **Widget Gallery:** `/vendor/textual/docs/widgets/`
- **Examples:** `/vendor/textual/docs/examples/`
- **CSS Reference:** `/vendor/textual/docs/guide/styles.md`
- **Events:** `/vendor/textual/docs/guide/events.md`
- **Containers:** `/vendor/textual/docs/widgets/containers.md`

---

*This reference compiled from Textual source (vendor/textual/) and official documentation. Examples are minimal extracts; see source files for complete implementations.*
