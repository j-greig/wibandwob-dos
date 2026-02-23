from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .controller import Controller
from .events import EventHub
from .models import Rect, WindowType

# MCP Integration
try:
    from fastapi_mcp import FastApiMCP
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False

from .schemas import (
    AppStateModel,
    BatchLayoutRequest,
    BatchLayoutResponse,
    BatchPrimersRequest,
    BatchPrimersResponse,
    BrowserClipReq,
    BrowserCopyReq,
    BrowserFetchReq,
    BrowserFindReq,
    BrowserGetContentReq,
    BrowserOpenReq,
    BrowserRenderReq,
    BrowserSetModeReq,
    BrowserWindowReq,
    BrowserFetchRequest,
    CanvasInfo,
    Capabilities,
    GalleryArrangeRequest,
    GalleryArrangeResponse,
    GalleryArrangement,
    MenuCommand,
    MonodrawLoadRequest,
    MonodrawParseRequest,
    PaintCellRequest,
    PaintClearRequest,
    PaintLineRequest,
    PaintRectRequest,
    PatternMode,
    ThemeMode,
    ThemeVariant,
    PrimerInfo,
    PrimerMetadata,
    PrimersListResponse,
    RenderBundle,
    ScreenshotReq,
    SendTextReq,
    SendFigletReq,
    SendMultiFigletReq,
    StateExportReq,
    StateImportReq,
    WindowCreate,
    WindowMoveResize,
    WindowPropsUpdate,
    WindowState,
    WorkspaceOpen,
    WorkspaceSave,
    RectModel,
)
from .browser import BrowserSession, fetch_and_convert
from pydantic import BaseModel


# ─── Gallery constants ──────────────────────────────────────────────────────

# Turbo Vision window drop shadow dimensions (fixed by the TV widget toolkit)
SHADOW_W = 2   # chars — shadow extends this many cols to the RIGHT of the window
SHADOW_H = 1   # chars — shadow extends this many rows BELOW the window

# The TV status bar occupies the last row of the canvas as reported by /state.
# Add 1 extra row of clearance at the bottom so windows don't sit on top of it.
CANVAS_BOTTOM_EXTRA = 1

# Default margin: 1 char gap between the shadow edge and the canvas edge.
# Aligns left edges with the 'F' of the 'File' menu item (col 2 in TV).
# Pass margin= to gallery/arrange to override (0 = flush, 2 = spacious, etc.)
DEFAULT_MARGIN = 1

# ─── Gallery helpers ────────────────────────────────────────────────────────

def _measure_primer(path: str) -> dict:
    """Read a primer file and return OUTER window dimensions (content + 2 for frame).

    Turbo Vision TWindow always adds a 1-cell border on each side, so:
        outer_width  = content_width  + 2
        outer_height = content_height + 2

    This matches what C++ calculateWindowBounds() produces, so values returned
    here can be passed directly to open_primer / resize_window without adjustment.

    Uses wcwidth.wcswidth() for display-accurate column counting — handles
    wide Unicode chars (emoji, some box-drawing) that occupy 2 terminal columns.
    Falls back to len() if wcswidth returns -1 (non-printable / control chars).

    Stops at the first '----' frame delimiter (measures the first frame only).
    Strips trailing CR so Windows line endings don't inflate widths.
    """
    try:
        from wcwidth import wcswidth as _wcswidth
    except ImportError:
        _wcswidth = None  # type: ignore

    def _line_width(s: str) -> int:
        if _wcswidth is not None:
            w = _wcswidth(s)
            if w >= 0:
                return w
        return len(s)  # fallback: code-point count

    try:
        content_w = content_h = 0
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.rstrip("\r\n")
                if line == "----":
                    break
                content_h += 1
                content_w = max(content_w, _line_width(line))
        outer_w = content_w + 2
        outer_h = content_h + 2
        aspect  = round(outer_w / outer_h, 3) if outer_h else 0.0
        return {
            "width":         outer_w,
            "height":        outer_h,
            "content_width": content_w,
            "content_height":content_h,
            "max_line_width":content_w,
            "line_count":    content_h,
            "aspect_ratio":  aspect,
        }
    except Exception:
        return {"width": 2, "height": 2, "content_width": 0, "content_height": 0,
                "max_line_width": 0, "line_count": 0, "aspect_ratio": 0.0}


# Simple LRU-style cache (filename → metadata dict)
# Values are OUTER window dimensions (content + 2 for frame) — see _measure_primer.
_primer_meta_cache: dict = {}


def _get_primer_metadata(path: str) -> dict:
    if path not in _primer_meta_cache:
        _primer_meta_cache[path] = _measure_primer(path)
    return _primer_meta_cache[path]


# ─── Layout helpers ─────────────────────────────────────────────────────────

def _usable(canvas_w: int, canvas_h: int, margin: int) -> tuple[int, int, int, int]:
    """Return (x, y, w, h) of the usable canvas area, inset for margin + shadow + status bar."""
    ux = margin
    uy = margin
    uw = canvas_w - SHADOW_W - margin * 2
    uh = canvas_h - SHADOW_H - CANVAS_BOTTOM_EXTRA - margin * 2
    return ux, uy, uw, uh


def _prep_pieces(primers: list[dict], uw: int, uh: int) -> list[dict]:
    """Clamp primer dimensions to the usable area; preserve filename."""
    return [
        {
            "filename": p["filename"],
            "width":    min(p["width"]  or 40, uw),
            "height":   min(p["height"] or 20, uh),
        }
        for p in primers
    ]


# ─── Layout algorithms ───────────────────────────────────────────────────────

def _layout_masonry(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 2,
    margin: int = 1,
    n_cols: int | None = None,
    clamp: bool = False,
) -> list[dict]:
    """Vertical masonry: N fixed columns, items drop into the shortest column.

    clamp=False (default): columns sized to widest item — fewer columns, every
      item rendered at full natural width. Best for readability.
    clamp=True: columns sized to median width — more columns, items wider than
      their slot are cropped at the boundary. Best for dense layouts.
    Pass options={"clamp": true} via the API to toggle.
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    pieces = _prep_pieces(primers, uw, uh)
    if not pieces:
        return []

    if n_cols is None:
        if clamp:
            ref_w = sorted(p["width"] for p in pieces)[len(pieces) // 2]
        else:
            ref_w = max(p["width"] for p in pieces)
        n_cols = max(2, min(6, uw // (ref_w + padding)))

    slot_w = (uw - padding * (n_cols + 1)) // n_cols
    col_x  = [ux + padding + i * (slot_w + padding) for i in range(n_cols)]
    col_h  = [0] * n_cols

    pieces.sort(key=lambda p: p["width"] * p["height"], reverse=True)

    placements: list[dict] = []
    for piece in pieces:
        pw = min(piece["width"], slot_w) if clamp else piece["width"]
        ph = piece["height"]
        i   = col_h.index(min(col_h))
        gap = padding if col_h[i] > 0 else 0
        y   = uy + col_h[i] + gap
        if y >= uy + uh:
            continue
        visible_h = min(ph, uy + uh - y)
        placements.append({"filename": piece["filename"], "x": col_x[i], "y": y,
                           "width": pw, "height": visible_h})
        col_h[i] = (y - uy) + visible_h
    return placements


def _layout_fit_rows(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 2,
    margin: int = 1,
) -> list[dict]:
    """Horizontal row packing: items placed L→R; wrap to next row when full.

    Row height = tallest item in that row. Items sorted tallest-first so each
    row's height is anchored by its biggest piece.
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    pieces = _prep_pieces(primers, uw, uh)
    if not pieces:
        return []

    pieces.sort(key=lambda p: p["height"], reverse=True)

    placements: list[dict] = []
    x = ux + padding
    y = uy + padding
    row_h = 0

    for piece in pieces:
        pw, ph = piece["width"], piece["height"]
        # Wrap if this item doesn't fit on the current row
        if x + pw > ux + uw and row_h > 0:
            y += row_h + padding
            x = ux + padding
            row_h = 0
        if y + ph > uy + uh:
            break
        visible_h = min(ph, uy + uh - y)
        placements.append({"filename": piece["filename"], "x": x, "y": y,
                           "width": pw, "height": visible_h})
        x += pw + padding
        row_h = max(row_h, ph)
    return placements


def _layout_masonry_horizontal(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 2,
    margin: int = 1,
    n_rows: int | None = None,
    clamp: bool = False,
) -> list[dict]:
    """Horizontal masonry: N fixed rows, items drop into the shortest row (by width).

    Masonry rotated 90°. Symmetric with _layout_masonry:
    clamp=False (default): rows sized to tallest item — fewer rows, every item
      rendered at full natural height, gaps always even.
    clamp=True: rows sized to median height — more rows, items taller than their
      slot are cropped. Pass options={"clamp": true} via the API.
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    pieces = _prep_pieces(primers, uw, uh)
    if not pieces:
        return []

    if n_rows is None:
        if clamp:
            ref_h = sorted(p["height"] for p in pieces)[len(pieces) // 2]
        else:
            ref_h = max(p["height"] for p in pieces)
        n_rows = max(2, min(6, uh // (ref_h + padding)))

    slot_h = (uh - padding * (n_rows + 1)) // n_rows
    row_y  = [uy + padding + i * (slot_h + padding) for i in range(n_rows)]
    row_w  = [0] * n_rows

    pieces.sort(key=lambda p: p["width"] * p["height"], reverse=True)

    placements: list[dict] = []
    for piece in pieces:
        pw, ph = piece["width"], piece["height"]
        # Clamp height to slot so rows below never get squeezed
        if clamp:
            ph = min(ph, slot_h)
        i   = row_w.index(min(row_w))
        gap = padding if row_w[i] > 0 else 0
        x   = ux + row_w[i] + gap
        if x >= ux + uw:
            continue
        # Safety clip to canvas right + bottom
        visible_w = min(pw, ux + uw - x)
        visible_h = min(ph, uy + uh - row_y[i])
        placements.append({"filename": piece["filename"], "x": x, "y": row_y[i],
                           "width": visible_w, "height": visible_h})
        row_w[i] = (x - ux) + visible_w
    return placements


def _layout_packery(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 2,
    margin: int = 1,
) -> list[dict]:
    """2D guillotine bin-pack (Packery / Jake Gordon style).

    Maintains a live list of free rectangles covering the usable canvas.
    For each item (largest-area first):
      1. Find the best-fit free rect (smallest area that still fits).
      2. Place item at top-left of that rect.
      3. Guillotine-cut the remainder into a right strip + a bottom strip.
      4. Sort free list top-left first for natural reading order.

    Items are NOT snapped to fixed column rails — they fill real 2D space.
    A narrow item can appear right-of a wide item; small items fill gaps.
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    pieces = _prep_pieces(primers, uw, uh)
    if not pieces:
        return []

    pieces.sort(key=lambda p: p["width"] * p["height"], reverse=True)

    # Free rects: list of (x, y, w, h)
    free: list[tuple[int, int, int, int]] = [(ux, uy, uw, uh)]

    placements: list[dict] = []
    for piece in pieces:
        pw, ph = piece["width"], piece["height"]
        pw_p   = pw + padding   # space reserved (item + gap)
        ph_p   = ph + padding

        # Best-fit: smallest free rect that fits pw_p × ph_p
        best: tuple[int, int, int, int] | None = None
        best_area = float("inf")
        for rect in free:
            rx, ry, rw, rh = rect
            if rw >= pw_p and rh >= ph_p:
                area = rw * rh
                if area < best_area:
                    best_area = area
                    best = rect

        if best is None:
            continue  # doesn't fit anywhere — skip

        rx, ry, rw, rh = best
        placements.append({"filename": piece["filename"], "x": rx, "y": ry,
                           "width": pw, "height": ph})

        # Guillotine cut: remove best, add right strip + bottom strip
        free.remove(best)
        right_w = rw - pw_p
        if right_w > 0:
            free.append((rx + pw_p, ry, right_w, ph_p))  # right of item
        below_h = rh - ph_p
        if below_h > 0:
            free.append((rx, ry + ph_p, rw, below_h))    # below item

        # Keep free list sorted top-left first (y first, then x)
        free.sort(key=lambda r: (r[1], r[0]))

    return placements


def _layout_cells_by_row(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 2,
    margin: int = 1,
) -> list[dict]:
    """Uniform grid: all cells the same size (max_w × max_h), items centred within.

    Clean, rigid, predictable. Good for comparing items of similar scale.
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    pieces = _prep_pieces(primers, uw, uh)
    if not pieces:
        return []

    cell_w = max(p["width"]  for p in pieces) + padding
    cell_h = max(p["height"] for p in pieces) + padding
    cols   = max(1, uw // cell_w)
    rows   = max(1, uh // cell_h)

    placements: list[dict] = []
    for idx, piece in enumerate(pieces):
        col = idx % cols
        row = idx // cols
        if row >= rows:
            break
        cx = ux + col * cell_w + (cell_w - piece["width"])  // 2
        cy = uy + row * cell_h + (cell_h - piece["height"]) // 2
        placements.append({"filename": piece["filename"], "x": cx, "y": cy,
                           "width": piece["width"], "height": piece["height"]})
    return placements


def _layout_poetry(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 2,
    margin: int = 1,
) -> list[dict]:
    """Organic gallery: packery bin-pack with deliberate breathing room.

    Builds on _layout_packery but adds:
    - Extra padding between items (padding * 2) for open-gallery feel.
    - Sorts by aspect ratio alternating wide/tall to break visual monotony.
    """
    # Alternate wide/tall items for visual rhythm
    pieces_raw = _prep_pieces(primers, *_usable(canvas_w, canvas_h, margin)[2:])
    wide  = sorted([p for p in pieces_raw if p["width"] >= p["height"]],
                   key=lambda p: p["width"] * p["height"], reverse=True)
    tall  = sorted([p for p in pieces_raw if p["width"] < p["height"]],
                   key=lambda p: p["width"] * p["height"], reverse=True)
    # Interleave: wide, tall, wide, tall ...
    interleaved: list[dict] = []
    for a, b in zip(wide, tall):
        interleaved.extend([a, b])
    interleaved.extend(wide[len(tall):])
    interleaved.extend(tall[len(wide):])

    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    poetry_pad = padding * 2
    pw_offset  = poetry_pad
    ph_offset  = poetry_pad

    free: list[tuple[int, int, int, int]] = [(ux, uy, uw, uh)]
    placements: list[dict] = []

    for piece in interleaved:
        pw, ph = piece["width"], piece["height"]
        pw_p   = pw + pw_offset
        ph_p   = ph + ph_offset

        best: tuple[int, int, int, int] | None = None
        best_area = float("inf")
        for rect in free:
            rx, ry, rw, rh = rect
            if rw >= pw_p and rh >= ph_p:
                area = rw * rh
                if area < best_area:
                    best_area = area
                    best = rect

        if best is None:
            continue

        rx, ry, rw, rh = best
        placements.append({"filename": piece["filename"], "x": rx, "y": ry,
                           "width": pw, "height": ph})
        free.remove(best)
        right_w = rw - pw_p
        if right_w > 0:
            free.append((rx + pw_p, ry, right_w, ph_p))
        below_h = rh - ph_p
        if below_h > 0:
            free.append((rx, ry + ph_p, rw, below_h))
        free.sort(key=lambda r: (r[1], r[0]))

    return placements


# ─── Stamp / pixel-font layout ───────────────────────────────────────────────

# 3×5 pixel font — each char is 5 rows of 3-bit strings
_PIXEL_FONT: dict[str, list[str]] = {
    ' ': ["000","000","000","000","000"],
    'A': ["010","101","111","101","101"],
    'B': ["110","101","110","101","110"],
    'C': ["011","100","100","100","011"],
    'D': ["110","101","101","101","110"],
    'E': ["111","100","110","100","111"],
    'F': ["111","100","110","100","100"],
    'G': ["011","100","101","101","011"],
    'H': ["101","101","111","101","101"],
    'I': ["111","010","010","010","111"],
    'J': ["001","001","001","101","010"],
    'K': ["101","110","100","110","101"],
    'L': ["100","100","100","100","111"],
    'M': ["101","111","101","101","101"],
    'N': ["101","110","101","101","101"],
    'O': ["010","101","101","101","010"],
    'P': ["110","101","110","100","100"],
    'Q': ["010","101","101","011","001"],
    'R': ["110","101","110","101","101"],
    'S': ["011","100","010","001","110"],
    'T': ["111","010","010","010","010"],
    'U': ["101","101","101","101","010"],
    'V': ["101","101","101","010","010"],
    'W': ["101","101","101","111","010"],
    'X': ["101","101","010","101","101"],
    'Y': ["101","101","010","010","010"],
    'Z': ["111","001","010","100","111"],
    '0': ["010","101","101","101","010"],
    '1': ["010","110","010","010","111"],
    '2': ["110","001","010","100","111"],
    '3': ["110","001","010","001","110"],
    '4': ["101","101","111","001","001"],
    '5': ["111","100","110","001","110"],
    '6': ["011","100","110","101","010"],
    '7': ["111","001","010","010","010"],
    '8': ["010","101","010","101","010"],
    '9': ["010","101","011","001","110"],
    '!': ["010","010","010","000","010"],
    '?': ["110","001","010","000","010"],
    '&': ["010","101","010","101","011"],
    '#': ["101","111","101","111","101"],
    '+': ["000","010","111","010","000"],
    '-': ["000","000","111","000","000"],
    '.': ["000","000","000","000","010"],
    '*': ["101","010","111","010","101"],
    ':': ["000","010","000","010","000"],
}

def _text_to_pixel_positions(text: str) -> list[tuple[int, int]]:
    """Return list of (col, row) pixel positions for rendering `text` in 3×5 font.

    Supports multi-line via '|' separator — each line stacked with a 2-row gap.
    Characters placed left-to-right, one column gap between them.
    Unknown chars rendered as space.
    """
    positions: list[tuple[int, int]] = []
    line_height = 5 + 2   # 5 pixel rows + 2-row gap between lines
    for line_idx, line in enumerate(text.upper().split('|')):
        cursor_x = 0
        y_offset  = line_idx * line_height
        for ch in line:
            rows = _PIXEL_FONT.get(ch, _PIXEL_FONT[' '])
            for row_idx, row in enumerate(rows):
                for col_idx, bit in enumerate(row):
                    if bit == '1':
                        positions.append((cursor_x + col_idx, y_offset + row_idx))
            cursor_x += 4   # 3 pixel cols + 1 gap between letters
    return positions


def _layout_stamp(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 1,
    margin: int = 4,
    pattern: str = "text",
    text: str = "WIB",
    cols: int = 8,
    rows: int = 4,
    turns: float = 3.0,
    anchor: str = "center",
) -> list[dict]:
    """Stamp layout — use primers as repeating stamps on a pattern.

    The same primer (or cycling set) is stamped at every position defined by
    the pattern. Think: Illustrator stamp tool, but the brush is an ASCII window.

    patterns:
      text      — render `text` using 3×5 pixel font; each 'on' pixel = one stamp
      grid      — uniform cols×rows grid of stamps
      wave      — stamps along a sine wave
      diagonal  — stamps along a diagonal line
      cross     — horizontal + vertical centre lines
      border    — stamps around the canvas edge

    options (via options={}):
      pattern   str   "text" | "grid" | "wave" | "diagonal" | "cross" | "border"
      text      str   text to render (pattern=text only)
      cols      int   grid columns (pattern=grid)
      rows      int   grid rows (pattern=grid)
      anchor    str   same as cluster — where to place the stamped pattern
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    if not primers:
        return []

    stamp = primers[0]   # first primer is the stamp
    sw = stamp["width"]
    sh = stamp["height"]
    step_x = sw + padding
    step_y = sh + padding

    # ── Generate pixel positions ──────────────────────────────────────────────
    if pattern == "text":
        pixel_positions = _text_to_pixel_positions(text or "WIB")

    elif pattern == "grid":
        pixel_positions = [(c, r) for r in range(rows) for c in range(cols)]

    elif pattern == "wave":
        import math
        amplitude = max(1, (uh // step_y) // 3)
        wave_len   = max(1, cols)
        pixel_positions = []
        for c in range(wave_len):
            r_center = (uh // step_y) // 2
            r = r_center + int(amplitude * math.sin(2 * math.pi * c / max(wave_len, 1) * 2))
            pixel_positions.append((c, r))

    elif pattern == "spiral":
        import math
        # Archimedean spiral — stamps placed at increasing angle + radius
        max_r_px  = min(uw, uh * 2) // 2          # max spiral radius in canvas chars
        # turns is a param — Archimedean spiral density
        n_stamps  = cols                            # reuse cols param as stamp count
        positions_raw: list[tuple[int,int]] = []
        for i in range(n_stamps):
            t     = i / max(n_stamps - 1, 1)
            angle = t * turns * 2 * math.pi
            r_px  = t * max_r_px
            cx_px = (uw // step_x) // 2
            cy_px = (uh // step_y) // 2
            col   = cx_px + int(r_px / step_x * math.cos(angle))
            row   = cy_px + int(r_px / step_y * math.sin(angle))
            positions_raw.append((col, row))
        # deduplicate while preserving order
        seen: set[tuple[int,int]] = set()
        pixel_positions = []
        for pos in positions_raw:
            if pos not in seen:
                seen.add(pos)
                pixel_positions.append(pos)

    elif pattern == "diagonal":
        n = min(uw // step_x, uh // step_y)
        pixel_positions = [(i, i) for i in range(n)]

    elif pattern == "cross":
        max_c = uw // step_x
        max_r = uh // step_y
        mid_r = max_r // 2
        mid_c = max_c // 2
        pixel_positions  = [(c, mid_r) for c in range(max_c)]   # horizontal
        pixel_positions += [(mid_c, r) for r in range(max_r) if r != mid_r]  # vertical

    elif pattern == "border":
        max_c = uw // step_x
        max_r = uh // step_y
        top    = [(c, 0)         for c in range(max_c)]
        bottom = [(c, max_r - 1) for c in range(max_c)]
        left   = [(0, r)         for r in range(1, max_r - 1)]
        right  = [(max_c - 1, r) for r in range(1, max_r - 1)]
        pixel_positions = top + bottom + left + right

    else:
        pixel_positions = _text_to_pixel_positions(text or "WIB")

    if not pixel_positions:
        return []

    # ── Convert pixel positions → canvas coordinates ──────────────────────────
    raw = [(col * step_x, row * step_y) for col, row in pixel_positions]

    # Compute bounding box, apply anchor (same logic as cluster)
    min_x = min(x for x, _ in raw)
    min_y = min(y for _, y in raw)
    bbox_w = max(x + sw for x, _ in raw) - min_x
    bbox_h = max(y + sh for _, y in raw) - min_y

    ax, ay  = _cluster_anchor(anchor)
    slack_x = max(0, uw - bbox_w)
    slack_y = max(0, uh - bbox_h)
    ox = ux + int(slack_x * ax) - min_x
    oy = uy + int(slack_y * ay) - min_y

    # Cycle through provided primers as stamps (allows variety: ["cat.txt","cat.txt",...])
    n_primers = max(1, len(primers))
    placements = []
    for i, (x, y) in enumerate(raw):
        px, py = x + ox, y + oy
        # bounds check — skip stamps that would go off canvas
        if (px < 0 or py < 0
                or px + sw + SHADOW_W > canvas_w
                or py + sh + SHADOW_H + CANVAS_BOTTOM_EXTRA > canvas_h):
            continue
        p = primers[i % n_primers]
        placements.append({"filename": p["filename"], "x": px, "y": py,
                           "width": sw, "height": sh})
    return placements


def _cluster_anchor(anchor: str) -> tuple[float, float]:
    """Map anchor name → (ax, ay) weights in [0.0, 1.0].

    ax=0.0 = left edge,  ax=0.5 = centre,  ax=1.0 = right edge
    ay=0.0 = top edge,   ay=0.5 = centre,  ay=1.0 = bottom edge
    """
    _map: dict[str, tuple[float, float]] = {
        # corners
        "tl": (0.0, 0.0), "top-left":     (0.0, 0.0), "nw": (0.0, 0.0),
        "tr": (1.0, 0.0), "top-right":    (1.0, 0.0), "ne": (1.0, 0.0),
        "bl": (0.0, 1.0), "bottom-left":  (0.0, 1.0), "sw": (0.0, 1.0),
        "br": (1.0, 1.0), "bottom-right": (1.0, 1.0), "se": (1.0, 1.0),
        # edges
        "top":    (0.5, 0.0), "tc": (0.5, 0.0), "n": (0.5, 0.0),
        "bottom": (0.5, 1.0), "bc": (0.5, 1.0), "s": (0.5, 1.0),
        "left":   (0.0, 0.5), "cl": (0.0, 0.5), "w": (0.0, 0.5),
        "right":  (1.0, 0.5), "cr": (1.0, 0.5), "e": (1.0, 0.5),
        # centre (default)
        "center": (0.5, 0.5), "centre": (0.5, 0.5), "c": (0.5, 0.5),
    }
    return _map.get(anchor.lower(), (0.5, 0.5))


def _layout_cluster(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 1,
    margin: int = 8,
    inner_algo: str = "maxrects_bssf",
    anchor: str = "center",
) -> list[dict]:
    """Gallery-wall cluster: rectpack MaxRects → position on canvas.

    No fixed rows or column rails at all. Items placed at any (x, y) using
    the best-fit free rectangle — organic, dense, real gallery-wall feel.

    Steps:
      1. Pack into usable bin (canvas − margin on all sides) via rectpack.
      2. Flip y-axis (rectpack bottom-up → TV top-down).
      3. Compute bounding box of placed cluster.
      4. Position bbox on canvas using `anchor` (default: centred).

    API options (pass via options={}):
      padding     (int, default 1)  gutter between frames — tight like a real wall
      margin      (int, default 8)  breathing room slider: 0=flush, 8=default, 20=airy
      anchor      (str, default "center")  where to sit on canvas:
                    center / c                    — default, balanced
                    tl / tr / bl / br             — corners
                    top / bottom / left / right   — edge-centred
                    nw / ne / sw / se             — compass aliases
      inner_algo  (str, default "maxrects_bssf")  packing shape:
                    maxrects_bssf  densest, most compact
                    maxrects_bl    bottom-left bias, slightly more regular
                    skyline_bl     skyline algorithm, jagged organic perimeter
                    guillotine     faster, less dense
    """
    try:
        from rectpack import newPacker, PackingMode, SORT_AREA
        from rectpack.maxrects import MaxRectsBssf, MaxRectsBl
        from rectpack.skyline import SkylineBl
        from rectpack.guillotine import GuillotineBssfSas
    except ImportError:
        return _layout_packery(primers, canvas_w, canvas_h, padding, margin)

    _algo_lookup = {
        "maxrects_bssf": MaxRectsBssf,
        "maxrects_bl":   MaxRectsBl,
        "skyline_bl":    SkylineBl,
        "guillotine":    GuillotineBssfSas,
    }
    pack_algo = _algo_lookup.get(inner_algo, MaxRectsBssf)

    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    pieces = _prep_pieces(primers, uw, uh)
    if not pieces:
        return []

    id_map = {i: p for i, p in enumerate(pieces)}

    packer = newPacker(
        mode=PackingMode.Offline,
        pack_algo=pack_algo,
        sort_algo=SORT_AREA,
        rotation=False,
    )
    for i, piece in enumerate(pieces):
        pw = piece["width"]  + padding
        ph = piece["height"] + padding
        if pw <= uw and ph <= uh:
            packer.add_rect(pw, ph, rid=i)

    packer.add_bin(uw, uh)
    packer.pack()

    packed = packer.rect_list()
    if not packed:
        return _layout_packery(primers, canvas_w, canvas_h, padding, margin)

    # Flip y: rectpack y=0 is bottom-left; TV y=0 is top-left
    flipped = []
    for _b, rx, ry, rw, rh, rid in packed:
        tv_y = uh - ry - rh
        piece = id_map[rid]
        flipped.append({
            "filename": piece["filename"],
            "x": rx,
            "y": tv_y,
            "width":  rw - padding,
            "height": rh - padding,
        })

    # Bounding box of placed cluster
    min_x = min(p["x"] for p in flipped)
    min_y = min(p["y"] for p in flipped)
    bbox_w = max(p["x"] + p["width"]  for p in flipped) - min_x
    bbox_h = max(p["y"] + p["height"] for p in flipped) - min_y

    # Anchor: translate bbox within usable area
    ax, ay   = _cluster_anchor(anchor)
    slack_x  = max(0, uw - bbox_w)
    slack_y  = max(0, uh - bbox_h)
    offset_x = ux + int(slack_x * ax) - min_x
    offset_y = uy + int(slack_y * ay) - min_y

    return [
        {**p, "x": p["x"] + offset_x, "y": p["y"] + offset_y}
        for p in flipped
    ]


# ─── Back-compat aliases (tests / external callers) ─────────────────────────
def _masonry_layout(primers, canvas_w, canvas_h, padding=2, margin=1, n_cols=None, clamp=False):
    return _layout_masonry(primers, canvas_w, canvas_h, padding, margin, n_cols, clamp)

def _poetry_layout(primers, canvas_w, canvas_h, padding=2):
    return _layout_poetry(primers, canvas_w, canvas_h, padding)


# ─────────────────────────────────────────────────────────────────────────────


def make_app() -> FastAPI:
    app = FastAPI(title="Test Pattern Control API", version="v1")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost", "http://127.0.0.1", "*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    events = EventHub()
    ctl = Controller(events)

    # ----- Helpers -----
    def to_state_model() -> AppStateModel:
        st = asyncio.get_event_loop().run_until_complete(ctl.get_state())
        return AppStateModel(
            pattern_mode=st.pattern_mode,
            theme_mode=st.theme_mode,
            theme_variant=st.theme_variant,
            windows=[
                WindowState(
                    id=w.id,
                    type=w.type.value,
                    title=w.title,
                    rect=RectModel(x=w.rect.x, y=w.rect.y, w=w.rect.w, h=w.rect.h),
                    z=w.z,
                    focused=w.focused,
                    zoomed=w.zoomed,
                    props=w.props,
                )
                for w in st.windows
            ],
            last_workspace=st.last_workspace,
            last_screenshot=st.last_screenshot,
            uptime_sec=time.time() - st.started_at,
        )

    # ----- Routes -----
    @app.get("/health")
    async def health() -> Dict[str, Any]:
        return {"ok": True}

    @app.get("/capabilities", response_model=Capabilities)
    async def capabilities() -> Capabilities:
        caps = await ctl.get_capabilities()
        return Capabilities(
            version=str(caps.get("version", "v1")),
            window_types=list(caps.get("window_types", [t.value for t in WindowType])),
            commands=list(caps.get("commands", [])),
            properties=dict(caps.get("properties", {})),
        )

    @app.get("/commands",
             summary="List all available commands with descriptions and parameter hints",
             description="Returns the full command registry from the C++ TUI app. "
                         "Each command has a name, description, and whether it requires parameters. "
                         "Use POST /menu/command to execute any command by name.")
    async def list_commands() -> Dict[str, Any]:
        """Agent-friendly command discovery endpoint.

        Returns the full command manifest so agents can discover what
        actions are available without hardcoding command names."""
        registry = await ctl.get_registry_capabilities()
        commands = registry.get("commands", [])
        return {
            "count": len(commands),
            "commands": commands,
            "execute_via": "POST /menu/command {command: '<name>', args: {key: value}}",
        }

    @app.get("/state", response_model=AppStateModel)
    async def state() -> AppStateModel:
        st = await ctl.get_state()
        return AppStateModel(
            pattern_mode=st.pattern_mode,
            theme_mode=st.theme_mode,
            theme_variant=st.theme_variant,
            windows=[
                WindowState(
                    id=w.id,
                    type=w.type.value,
                    title=w.title,
                    rect=RectModel(x=w.rect.x, y=w.rect.y, w=w.rect.w, h=w.rect.h),
                    z=w.z,
                    focused=w.focused,
                    zoomed=w.zoomed,
                    props=w.props,
                )
                for w in st.windows
            ],
            canvas=CanvasInfo(
                width=st.canvas_width,
                height=st.canvas_height,
                cols=st.canvas_width,
                rows=st.canvas_height
            ),
            last_workspace=st.last_workspace,
            last_screenshot=st.last_screenshot,
            uptime_sec=time.time() - st.started_at,
        )

    @app.post("/windows", response_model=WindowState)
    async def create_window(payload: WindowCreate) -> WindowState:
        try:
            wtype = WindowType(payload.type)
        except ValueError:
            raise HTTPException(status_code=400, detail="unknown window type")
        rect = Rect(**payload.rect.model_dump()) if payload.rect else None
        win = await ctl.create_window(wtype, title=payload.title, rect=rect, props=payload.props)
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/move", response_model=WindowState)
    async def move(win_id: str, payload: WindowMoveResize) -> WindowState:
        try:
            win = await ctl.move_resize(win_id, x=payload.x, y=payload.y, w=payload.w, h=payload.h)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/focus", response_model=WindowState)
    async def focus(win_id: str) -> WindowState:
        try:
            win = await ctl.focus(win_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/clone", response_model=WindowState)
    async def clone(win_id: str) -> WindowState:
        try:
            win = await ctl.clone(win_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/close")
    async def close(win_id: str) -> Dict[str, Any]:
        await ctl.close(win_id)
        return {"ok": True}

    @app.post("/windows/{win_id}/send_text")
    async def send_text(win_id: str, payload: SendTextReq) -> Dict[str, Any]:
        res = await ctl.send_text(win_id, payload.content, payload.mode, payload.position)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_text_failed"))
        return res

    @app.post("/text_editor/send_text")
    async def send_text_auto(payload: SendTextReq) -> Dict[str, Any]:
        """Send text to any text editor window, creating one if none exists"""
        res = await ctl.send_text("auto", payload.content, payload.mode, payload.position)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_text_failed"))
        return res

    @app.post("/windows/{win_id}/send_figlet")
    async def send_figlet(win_id: str, payload: SendFigletReq) -> Dict[str, Any]:
        res = await ctl.send_figlet(win_id, payload.text, payload.font, payload.width or 0, payload.mode)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_figlet_failed"))
        return res

    @app.post("/text_editor/send_figlet")
    async def send_figlet_auto(payload: SendFigletReq) -> Dict[str, Any]:
        """Send figlet ASCII art to any text editor window, creating one if none exists"""
        res = await ctl.send_figlet("auto", payload.text, payload.font, payload.width or 0, payload.mode)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_figlet_failed"))
        return res

    @app.post("/windows/{win_id}/send_multi_figlet")
    async def send_multi_figlet(win_id: str, payload: SendMultiFigletReq) -> Dict[str, Any]:
        """Send multiple figlet segments with different fonts"""
        # For now, concatenate all segments - can be enhanced later for true multi-segment support
        combined_text = ""
        for segment in payload.segments:
            combined_text += f"[Font: {segment.font}] {segment.text}{payload.separator}"
        
        # Use the first font as default for the combined text
        first_font = payload.segments[0].font if payload.segments else "standard"
        return await ctl.send_figlet(win_id, combined_text, first_font, 0, payload.mode)

    @app.post("/windows/cascade")
    async def cascade() -> Dict[str, Any]:
        await ctl.cascade()
        return {"ok": True}

    @app.post("/windows/tile")
    async def tile(payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        cols = (payload or {}).get("cols", 2)
        await ctl.tile(cols)
        return {"ok": True}

    @app.post("/windows/close_all")
    async def close_all() -> Dict[str, Any]:
        await ctl.close_all()
        return {"ok": True}

    @app.post("/props/{win_id}")
    async def set_props(win_id: str, payload: WindowPropsUpdate) -> Dict[str, Any]:
        try:
            await ctl.set_props(win_id, payload.props)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return {"ok": True}

    @app.post("/menu/command")
    async def menu_command(payload: MenuCommand) -> Dict[str, Any]:
        res = await ctl.exec_command(payload.command, payload.args, actor=payload.actor or "api")
        if not res.get("ok"):
            import logging
            logging.warning(f"[menu/command] {payload.command} failed: {res}")
            raise HTTPException(status_code=400, detail=res.get("error", "command_failed"))
        return res

    @app.post("/pattern_mode")
    async def pattern_mode(payload: PatternMode) -> Dict[str, Any]:
        await ctl.set_pattern_mode(payload.mode)
        return {"ok": True}

    @app.post("/theme/mode")
    async def theme_mode(payload: ThemeMode) -> Dict[str, Any]:
        result = await ctl.set_theme_mode(payload.mode)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error", "set_theme_mode_failed"))
        return result

    @app.post("/theme/variant")
    async def theme_variant(payload: ThemeVariant) -> Dict[str, Any]:
        result = await ctl.set_theme_variant(payload.variant)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error", "set_theme_variant_failed"))
        return result

    @app.post("/theme/reset")
    async def theme_reset() -> Dict[str, Any]:
        result = await ctl.reset_theme()
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error", "reset_theme_failed"))
        return result

    @app.post("/workspace/save")
    async def workspace_save(payload: WorkspaceSave) -> Dict[str, Any]:
        res = await ctl.save_workspace(payload.path)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "workspace_save_failed"))
        return res

    @app.post("/workspace/open")
    async def workspace_open(payload: WorkspaceOpen) -> Dict[str, Any]:
        res = await ctl.open_workspace(payload.path)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "workspace_open_failed"))
        return res

    @app.post("/state/export")
    async def state_export(payload: StateExportReq) -> Dict[str, Any]:
        res = await ctl.export_state(payload.path, payload.format)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "export_failed"))
        return res

    @app.post("/state/import")
    async def state_import(payload: StateImportReq) -> Dict[str, Any]:
        res = await ctl.import_state(payload.path, payload.mode)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "import_failed"))
        return res

    @app.post("/paint/cell")
    async def paint_cell(payload: PaintCellRequest) -> Dict[str, Any]:
        resp = await ctl.paint_cell(payload.win_id, payload.x, payload.y, payload.fg, payload.bg)
        if isinstance(resp, str) and resp.lower().startswith("err"):
            raise HTTPException(status_code=422, detail=resp)
        return {"ok": True}

    @app.post("/paint/line")
    async def paint_line(payload: PaintLineRequest) -> Dict[str, Any]:
        resp = await ctl.paint_line(payload.win_id, payload.x0, payload.y0, payload.x1, payload.y1, payload.fg, payload.bg)
        if isinstance(resp, str) and resp.lower().startswith("err"):
            raise HTTPException(status_code=422, detail=resp)
        return {"ok": True}

    @app.post("/paint/rect")
    async def paint_rect(payload: PaintRectRequest) -> Dict[str, Any]:
        resp = await ctl.paint_rect(payload.win_id, payload.x0, payload.y0, payload.x1, payload.y1, payload.fg, payload.bg, payload.fill)
        if isinstance(resp, str) and resp.lower().startswith("err"):
            raise HTTPException(status_code=422, detail=resp)
        return {"ok": True}

    @app.post("/paint/clear")
    async def paint_clear(payload: PaintClearRequest) -> Dict[str, Any]:
        resp = await ctl.paint_clear(payload.win_id)
        if isinstance(resp, str) and resp.lower().startswith("err"):
            raise HTTPException(status_code=422, detail=resp)
        return {"ok": True}

    @app.get("/paint/export/{win_id}")
    async def paint_export(win_id: str) -> Dict[str, Any]:
        resp = await ctl.paint_export(win_id)
        if isinstance(resp, str) and resp.lower().startswith("err"):
            raise HTTPException(status_code=422, detail=resp)
        return dict(resp)

    @app.post("/browser/open")
    async def browser_open(payload: BrowserOpenReq) -> Dict[str, Any]:
        res = await ctl.browser_open(payload.url, payload.window_id, payload.mode)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_open_failed"))
        return res

    @app.post("/browser/{window_id}/back")
    async def browser_back(window_id: str) -> Dict[str, Any]:
        res = await ctl.browser_back(window_id)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_back_failed"))
        return res

    @app.post("/browser/{window_id}/forward")
    async def browser_forward(window_id: str) -> Dict[str, Any]:
        res = await ctl.browser_forward(window_id)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_forward_failed"))
        return res

    @app.post("/browser/{window_id}/refresh")
    async def browser_refresh(window_id: str) -> Dict[str, Any]:
        res = await ctl.browser_refresh(window_id)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_refresh_failed"))
        return res

    @app.post("/browser/{window_id}/find")
    async def browser_find(window_id: str, payload: BrowserFindReq) -> Dict[str, Any]:
        res = await ctl.browser_find(window_id, payload.query, payload.direction)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_find_failed"))
        return res

    @app.post("/browser/{window_id}/set_mode")
    async def browser_set_mode(window_id: str, payload: BrowserSetModeReq) -> Dict[str, Any]:
        res = await ctl.browser_set_mode(window_id, payload.headings, payload.images)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_set_mode_failed"))
        return res

    @app.post("/browser/fetch_ext")
    async def browser_fetch_ext(payload: BrowserFetchReq) -> Dict[str, Any]:
        res = await ctl.browser_fetch(
            payload.url,
            payload.reader,
            payload.format,
            payload.images or "none",
            payload.width or 80,
        )
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_fetch_failed"))
        return res

    @app.post("/browser/render")
    async def browser_render(payload: BrowserRenderReq) -> Dict[str, Any]:
        res = await ctl.browser_render(payload.markdown, payload.headings or "plain", payload.images or "none", payload.width or 80)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_render_failed"))
        return res

    @app.post("/browser/get_content")
    async def browser_get_content(payload: BrowserGetContentReq) -> Dict[str, Any]:
        res = await ctl.browser_get_content(payload.window_id, payload.format)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_get_content_failed"))
        return res

    @app.post("/browser/{window_id}/summarise")
    async def browser_summarise(window_id: str) -> Dict[str, Any]:
        res = await ctl.browser_summarise(window_id, target="new_window")
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_summarise_failed"))
        return res

    @app.post("/browser/{window_id}/extract_links")
    async def browser_extract_links(window_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        pattern = (payload or {}).get("filter")
        res = await ctl.browser_extract_links(window_id, pattern=pattern)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_extract_links_failed"))
        return res

    @app.post("/browser/{window_id}/clip")
    async def browser_clip(window_id: str, payload: Optional[BrowserClipReq] = None) -> Dict[str, Any]:
        p = payload.path if payload else None
        include_images = payload.include_images if payload else False
        res = await ctl.browser_clip(window_id, path=p, include_images=include_images)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_clip_failed"))
        return res

    @app.post("/browser/{window_id}/copy")
    async def browser_copy(window_id: str, payload: Optional[BrowserCopyReq] = None) -> Dict[str, Any]:
        p = payload or BrowserCopyReq()
        res = await ctl.browser_copy(
            window_id,
            fmt=p.format,
            include_image_urls=p.include_image_urls,
            image_url_mode=p.image_url_mode,
        )
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_copy_failed"))
        return res

    @app.post("/browser/{window_id}/gallery")
    async def browser_gallery(window_id: str) -> Dict[str, Any]:
        res = await ctl.browser_toggle_gallery(window_id)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "browser_gallery_failed"))
        return res

    @app.get("/terminal/{window_id}/output")
    async def terminal_output(window_id: str) -> Dict[str, Any]:
        """Read the visible text content of a terminal window.

        Use 'active' as window_id to target the first open terminal.
        """
        params: Dict[str, Any] = {}
        if window_id and window_id != "active":
            params["window_id"] = window_id
        res = await ctl.exec_command("terminal_read", params, actor="api")
        if not res.get("ok"):
            raise HTTPException(status_code=404, detail=res.get("error", "no terminal window"))
        text = res.get("result", "").replace("\x00", "")
        return {"window_id": window_id, "text": text}

    @app.post("/screenshot")
    async def screenshot(payload: Optional[ScreenshotReq] = None) -> Dict[str, Any]:
        res = await ctl.screenshot((payload or ScreenshotReq()).path)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "screenshot_failed"))
        return res

    @app.post("/windows/batch_layout", response_model=BatchLayoutResponse)
    async def windows_batch_layout(payload: BatchLayoutRequest) -> BatchLayoutResponse:
        return await ctl.batch_layout(payload)

    @app.post("/primers/batch", response_model=BatchPrimersResponse)
    async def batch_primers(payload: BatchPrimersRequest) -> BatchPrimersResponse:
        """Spawn up to 20 primer windows at specified positions"""
        windows = []
        skipped = []
        
        for primer_spec in payload.primers:
            try:
                # Create text_view window with primer path
                # Let text_view auto-size by only specifying position, not dimensions
                win = await ctl.create_window(
                    WindowType.text_view,
                    title=primer_spec.title or primer_spec.primer_path.split('/')[-1].replace('.txt', ''),
                    rect=Rect(x=primer_spec.x, y=primer_spec.y, w=-1, h=-1),  # -1 = auto-size
                    props={"path": primer_spec.primer_path}
                )
                windows.append(WindowState(
                    id=win.id,
                    type=win.type.value,
                    title=win.title,
                    rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
                    z=win.z,
                    focused=win.focused,
                    zoomed=win.zoomed,
                    props=win.props,
                ))
            except Exception as e:
                skipped.append(f"{primer_spec.primer_path}: {str(e)}")
                
        return BatchPrimersResponse(windows=windows, skipped=skipped)

    @app.get("/primers/list", response_model=PrimersListResponse)
    async def list_primers() -> PrimersListResponse:
        """List all available primer files across module directories"""
        import os
        import glob

        primers = []
        seen = set()

        # Scan module dirs: modules-private/*/primers/ then modules/*/primers/
        # Also check legacy app/primers/ as fallback
        search_bases = ["modules-private", "modules"]
        for base in search_bases:
            if not os.path.isdir(base):
                continue
            for module_name in sorted(os.listdir(base)):
                primers_dir = os.path.join(base, module_name, "primers")
                if not os.path.isdir(primers_dir):
                    continue
                for primer_path in sorted(glob.glob(os.path.join(primers_dir, "*.txt"))):
                    try:
                        basename = os.path.basename(primer_path)
                        if basename in seen:
                            continue
                        seen.add(basename)
                        stat = os.stat(primer_path)
                        name = basename.replace('.txt', '')
                        meta = _get_primer_metadata(primer_path)
                        primers.append(PrimerInfo(
                            name=name,
                            path=primer_path,
                            size_kb=round(stat.st_size / 1024, 1),
                            width=meta["width"],
                            height=meta["height"],
                            aspect_ratio=meta["aspect_ratio"],
                        ))
                    except Exception:
                        continue

        # Legacy fallback
        for legacy_dir in ["app/primers"]:
            if not os.path.isdir(legacy_dir):
                continue
            for primer_path in sorted(glob.glob(os.path.join(legacy_dir, "*.txt"))):
                try:
                    basename = os.path.basename(primer_path)
                    if basename in seen:
                        continue
                    seen.add(basename)
                    stat = os.stat(primer_path)
                    name = basename.replace('.txt', '')
                    meta = _get_primer_metadata(primer_path)
                    primers.append(PrimerInfo(
                        name=name,
                        path=primer_path,
                        size_kb=round(stat.st_size / 1024, 1),
                        width=meta["width"],
                        height=meta["height"],
                        aspect_ratio=meta["aspect_ratio"],
                    ))
                except Exception:
                    continue

        return PrimersListResponse(primers=primers, count=len(primers))

    @app.get("/primers/{filename}/metadata", response_model=PrimerMetadata,
             summary="Get intrinsic dimensions of a single primer file",
             description="Returns width (max line length), height (line count of first frame), "
                         "and aspect_ratio. Cached after first read. Filename is the basename, e.g. 'foo.txt'.")
    async def primer_metadata(filename: str) -> PrimerMetadata:
        """Dimension lookup for a single primer — foundation for smart_gallery_arrange."""
        import os, glob

        # Find the primer across module dirs
        found_path: str | None = None
        for base in ["modules-private", "modules"]:
            if not os.path.isdir(base):
                continue
            for module in sorted(os.listdir(base)):
                candidate = os.path.join(base, module, "primers", filename)
                if os.path.isfile(candidate):
                    found_path = candidate
                    break
            if found_path:
                break
        if not found_path:
            legacy = os.path.join("app", "primers", filename)
            if os.path.isfile(legacy):
                found_path = legacy
        if not found_path:
            raise HTTPException(status_code=404, detail=f"primer not found: {filename}")

        meta = _get_primer_metadata(found_path)
        size_kb = round(os.path.getsize(found_path) / 1024, 1)
        return PrimerMetadata(
            filename=filename,
            width=meta["width"],
            height=meta["height"],
            aspect_ratio=meta["aspect_ratio"],
            line_count=meta["line_count"],
            max_line_width=meta["max_line_width"],
            size_kb=size_kb,
        )

    @app.post("/gallery/arrange", response_model=GalleryArrangeResponse,
              summary="Arrange open primer windows using a layout algorithm",
              description="Fetches primer metadata, runs the chosen layout algorithm (masonry or poetry), "
                          "then applies window positions via tui_move_window. "
                          "Pass preview=true to get the plan without applying it.")
    async def gallery_arrange(payload: GalleryArrangeRequest) -> GalleryArrangeResponse:
        """Smart gallery arrangement — E012 core feature.

        1. Resolve each filename to a full path and measure its dimensions.
        2. Run the requested layout algorithm.
        3. Apply via tui_move_window (unless preview=true).
        4. Return the arrangement plan + utilisation stats.
        """
        import os

        # 1. Resolve canvas dimensions
        canvas_w = payload.canvas_width
        canvas_h = payload.canvas_height
        if canvas_w == 0 or canvas_h == 0:
            state = await ctl.get_state()
            canvas_w = canvas_w or state.canvas_width or 320
            canvas_h = canvas_h or state.canvas_height or 78

        # 2. Gather metadata for each requested filename
        primers_meta: list[dict] = []
        for filename in payload.filenames:
            found: str | None = None
            for base in ["modules-private", "modules"]:
                if not os.path.isdir(base):
                    continue
                for module in sorted(os.listdir(base)):
                    candidate = os.path.join(base, module, "primers", filename)
                    if os.path.isfile(candidate):
                        found = candidate
                        break
                if found:
                    break
            if not found:
                legacy = os.path.join("app", "primers", filename)
                if os.path.isfile(legacy):
                    found = legacy
            if found:
                meta = _get_primer_metadata(found)
                primers_meta.append({
                    "filename": filename,
                    "path": found,
                    "width": meta["width"] or 80,
                    "height": meta["height"] or 24,
                })
            # Silently skip missing primers (caller can check count vs input)

        # 3. Run layout algorithm
        algo    = payload.algorithm.lower()
        padding = payload.padding
        margin  = payload.margin

        opts = payload.options or {}
        _algo_map = {
            "masonry":            lambda: _layout_masonry(primers_meta, canvas_w, canvas_h, padding, margin,
                                                          n_cols=opts.get("n_cols"), clamp=opts.get("clamp", False)),
            "fit_rows":           lambda: _layout_fit_rows(primers_meta, canvas_w, canvas_h, padding, margin),
            "masonry_horizontal": lambda: _layout_masonry_horizontal(primers_meta, canvas_w, canvas_h, padding, margin,
                                                                      n_rows=opts.get("n_rows"), clamp=opts.get("clamp", False)),
            "packery":            lambda: _layout_packery(primers_meta, canvas_w, canvas_h, padding, margin),
            "cells_by_row":       lambda: _layout_cells_by_row(primers_meta, canvas_w, canvas_h, padding, margin),
            "poetry":             lambda: _layout_poetry(primers_meta, canvas_w, canvas_h, padding, margin),
            "stamp":              lambda: _layout_stamp(primers_meta, canvas_w, canvas_h,
                                                         padding=opts.get("padding", padding),
                                                         margin=opts.get("margin", margin),
                                                         pattern=opts.get("pattern", "text"),
                                                         text=opts.get("text", "WIB"),
                                                         cols=opts.get("cols", 8),
                                                         rows=opts.get("rows", 4),
                                                         turns=float(opts.get("turns", 3.0)),
                                                         anchor=opts.get("anchor", "center")),
            "cluster":            lambda: _layout_cluster(primers_meta, canvas_w, canvas_h,
                                                          padding=opts.get("padding", padding),
                                                          margin=opts.get("margin", margin),
                                                          inner_algo=opts.get("inner_algo", "maxrects_bssf"),
                                                          anchor=opts.get("anchor", "center")),
        }
        if algo not in _algo_map:
            algo = "masonry"
        raw_placements = _algo_map[algo]()

        # 4. Build arrangement objects + compute stats
        arrangement = [GalleryArrangement(**p) for p in raw_placements]

        total_area = sum(a.width * a.height for a in arrangement)
        canvas_area = canvas_w * canvas_h
        utilization = round(total_area / canvas_area, 3) if canvas_area > 0 else 0.0

        # Overlap detection
        overlaps = 0
        rects = [(a.x, a.y, a.x + a.width, a.y + a.height) for a in arrangement]
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                ax1, ay1, ax2, ay2 = rects[i]
                bx1, by1, bx2, by2 = rects[j]
                if ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1:
                    overlaps += 1

        # Bounds check — window + shadow must stay within canvas
        out_of_bounds = 0
        for a in arrangement:
            if (a.x < 0 or a.y < 0
                    or a.x + a.width  + SHADOW_W > canvas_w
                    or a.y + a.height + SHADOW_H + CANVAS_BOTTOM_EXTRA > canvas_h):
                out_of_bounds += 1
                import logging
                logging.warning(
                    "OOB %s: x=%d y=%d w=%d h=%d shadow_right=%d shadow_bottom=%d canvas=%dx%d",
                    a.filename, a.x, a.y, a.width, a.height,
                    a.x + a.width + SHADOW_W, a.y + a.height + SHADOW_H + CANVAS_BOTTOM_EXTRA,
                    canvas_w, canvas_h,
                )

        # 5. Apply (unless preview)
        applied = False
        if not payload.preview:
            # Detect duplicate filenames → open-fresh mode (stamp, text-pixel art, etc.)
            all_fnames = [a.filename for a in arrangement]
            has_dupes  = len(all_fnames) != len(set(all_fnames))

            # Build map: basename-without-ext → window id  (unique-filename mode only)
            win_map: dict[str, str] = {}
            if not has_dupes:
                state = await ctl.get_state()
                for w in state.windows:
                    if w.props and "path" in w.props:
                        basename = os.path.basename(w.props["path"]).replace(".txt", "").lower()
                        win_map[basename] = w.id
                    title_key = (w.title or "").lower().replace(".txt", "").split(" - ")[0].strip()
                    if title_key and w.id not in win_map.values():
                        win_map[title_key] = w.id

            # Track used window IDs so duplicates don't reuse the same one
            used_ids: set[str] = set()

            for place in arrangement:
                key     = place.filename.replace(".txt", "").lower()
                win_id  = None

                if not has_dupes:
                    candidate = win_map.get(key)
                    if candidate and candidate not in used_ids:
                        win_id = candidate

                if not win_id:
                    # Open a fresh window for this placement
                    primer_path = next(
                        (p["path"] for p in primers_meta if p["filename"] == place.filename),
                        None
                    )
                    if primer_path:
                        open_args: dict = {
                            "path": primer_path,
                            "x": place.x, "y": place.y,
                            "w": place.width, "h": place.height,
                        }
                        if payload.frameless:
                            open_args["frameless"] = "true"
                        res = await ctl.exec_command("open_primer", open_args, actor="gallery_arrange")
                        if res.get("ok"):
                            new_state = await ctl.get_state()
                            for nw in new_state.windows:
                                if nw.props and "path" in nw.props:
                                    nb = os.path.basename(nw.props["path"]).replace(".txt", "").lower()
                                    if nb == key and nw.id not in used_ids:
                                        win_id = nw.id
                                        place.window_id = nw.id
                                        break

                if win_id:
                    try:
                        await ctl.move_resize(win_id, x=place.x, y=place.y, w=place.width, h=place.height)
                        place.window_id = win_id
                        used_ids.add(win_id)
                    except Exception:
                        pass
            applied = True

        return GalleryArrangeResponse(
            ok=True,
            algorithm=algo,
            arrangement=arrangement,
            canvas_width=canvas_w,
            canvas_height=canvas_h,
            canvas_utilization=utilization,
            overlaps=overlaps,
            out_of_bounds=out_of_bounds,
            applied=applied,
            preview=payload.preview,
        )

    @app.post("/timeline/cancel")
    async def timeline_cancel(body: Dict[str, Any]) -> Dict[str, Any]:
        gid = str((body or {}).get("group_id", ""))
        if not gid:
            raise HTTPException(status_code=400, detail="missing group_id")
        return await ctl.cancel_timeline(gid)

    @app.get("/timeline/status")
    async def timeline_status(group_id: str) -> Dict[str, Any]:
        return await ctl.get_timeline_status(group_id)

    # ----- Monodraw Integration -----

    @app.post("/monodraw/load")
    async def monodraw_load(payload: MonodrawLoadRequest) -> Dict[str, Any]:
        """Load Monodraw JSON file and spawn windows OR import to text editor."""
        return await ctl.load_monodraw_file(
            file_path=payload.file_path,
            scale=payload.scale,
            offset_x=payload.offset_x,
            offset_y=payload.offset_y,
            window_types=payload.window_types,
            target=payload.target,
            layers_filter=payload.layers,
            mode=payload.mode,
            flatten=payload.flatten,
            insert_position=payload.insert_position,
            insert_header=payload.insert_header
        )

    @app.post("/monodraw/parse")
    async def monodraw_parse(payload: MonodrawParseRequest) -> Dict[str, Any]:
        """Parse Monodraw file without creating windows (preview mode)."""
        return await ctl.parse_monodraw_file(payload.file_path)

    # ----- Browser -----

    browser_session = BrowserSession()

    @app.post("/browser/fetch", response_model=RenderBundle)
    async def browser_fetch(payload: BrowserFetchRequest) -> RenderBundle:
        """Fetch a URL, extract readable content, return RenderBundle."""
        try:
            bundle = await asyncio.to_thread(fetch_and_convert, payload.url)
        except Exception as e:
            raise HTTPException(status_code=502, detail=str(e))
        browser_session.navigate(bundle)
        return RenderBundle(**bundle)

    @app.post("/browser/back", response_model=RenderBundle)
    async def browser_back() -> RenderBundle:
        """Navigate back in browser session history."""
        bundle = browser_session.back()
        if bundle is None:
            raise HTTPException(status_code=404, detail="no previous page in history")
        return RenderBundle(**bundle)

    @app.post("/browser/forward", response_model=RenderBundle)
    async def browser_forward() -> RenderBundle:
        """Navigate forward in browser session history."""
        bundle = browser_session.forward()
        if bundle is None:
            raise HTTPException(status_code=404, detail="no next page in history")
        return RenderBundle(**bundle)

    @app.websocket("/ws")
    async def ws(websocket: WebSocket) -> None:
        await websocket.accept()
        await events.add(websocket)
        try:
            while True:
                # Keep connection alive; ignore client messages for now
                await websocket.receive_text()
        except WebSocketDisconnect:
            await events.remove(websocket)

    # MCP Integration
    if MCP_AVAILABLE:
        mcp = FastApiMCP(app)
        mcp.mount_http()  # Mounts MCP server at /mcp with HTTP transport
        print("✅ MCP server mounted at /mcp")
        print("🔗 MCP URL: http://127.0.0.1:8089/mcp")
    else:
        print("⚠️  MCP not available - install 'fastapi-mcp' for MCP support")

    return app


app = make_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8089, log_level="info")
