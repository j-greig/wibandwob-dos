"""gallery.py — WibWobDOS gallery layout engine.

All layout algorithms, constants, helpers, and the pixel-font stamp system live
here. `main.py` imports what it needs and stays focused on routing / API plumbing.

Adding a new layout algorithm:
  1. Write `_layout_<name>(primers, canvas_w, canvas_h, padding, margin, **opts)`.
  2. Add it to `ALGO_MAP` at the bottom of this file.
  3. Update `GalleryArrangeRequest.algorithm` description in schemas.py.
  4. Verify with a screenshot — zero overlaps, zero oob required.

Constants:
  SHADOW_W / SHADOW_H        — Turbo Vision drop shadow (fixed by TV widget toolkit)
  CANVAS_BOTTOM_EXTRA        — status bar clearance (1 row)
  DEFAULT_MARGIN             — default gap from canvas edge (1 char)
"""
from __future__ import annotations

import math

# ─── Gallery constants ────────────────────────────────────────────────────────

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

# ─── Measurement helpers ──────────────────────────────────────────────────────

def _measure_primer(path: str) -> dict:
    """Read a primer file and return OUTER window dimensions (content + 2 for frame).

    Turbo Vision TWindow always adds a 1-cell border on each side, so:
        outer_width  = content_width  + 2
        outer_height = content_height + 2

    Uses wcwidth.wcswidth() for display-accurate column counting — handles
    wide Unicode chars (emoji, box-drawing) that occupy 2 terminal columns.
    Falls back to len() if wcswidth returns -1 (non-printable / control chars).

    Stops at the first '----' frame delimiter (measures the first frame only).
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
        return len(s)

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


_primer_meta_cache: dict = {}

def _get_primer_metadata(path: str) -> dict:
    if path not in _primer_meta_cache:
        _primer_meta_cache[path] = _measure_primer(path)
    return _primer_meta_cache[path]


# ─── Layout helpers ───────────────────────────────────────────────────────────

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


# ─── Layout algorithms ────────────────────────────────────────────────────────

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

    clamp=False (default): columns sized to widest item — natural widths.
    clamp=True: columns sized to median width — denser, items cropped if wider.
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
    """Horizontal row packing: items L→R, wrap when row full.

    Row height = tallest item in that row. Items sorted tallest-first.
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
        if x + pw > ux + uw and row_h > 0:
            y += row_h + padding
            x  = ux + padding
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

    Masonry rotated 90°.
    clamp=False: rows sized to tallest item.
    clamp=True: rows sized to median height — more rows, items cropped if taller.
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
        if clamp:
            ph = min(ph, slot_h)
        i   = row_w.index(min(row_w))
        gap = padding if row_w[i] > 0 else 0
        x   = ux + row_w[i] + gap
        if x >= ux + uw:
            continue
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

    Maintains a live list of free rectangles. For each item (largest-area first):
      1. Find the best-fit free rect (smallest area that still fits).
      2. Place item at top-left of that rect.
      3. Guillotine-cut remainder into right strip + bottom strip.
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    pieces = _prep_pieces(primers, uw, uh)
    if not pieces:
        return []

    pieces.sort(key=lambda p: p["width"] * p["height"], reverse=True)
    free: list[tuple[int, int, int, int]] = [(ux, uy, uw, uh)]

    placements: list[dict] = []
    for piece in pieces:
        pw, ph = piece["width"], piece["height"]
        pw_p, ph_p = pw + padding, ph + padding

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


def _layout_cells_by_row(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 2,
    margin: int = 1,
) -> list[dict]:
    """Uniform grid: all cells the same size (max_w × max_h), items centred within."""
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
    """Organic gallery: packery + extra breathing room + wide/tall interleave."""
    pieces_raw = _prep_pieces(primers, *_usable(canvas_w, canvas_h, margin)[2:])
    wide  = sorted([p for p in pieces_raw if p["width"] >= p["height"]],
                   key=lambda p: p["width"] * p["height"], reverse=True)
    tall  = sorted([p for p in pieces_raw if p["width"] < p["height"]],
                   key=lambda p: p["width"] * p["height"], reverse=True)
    interleaved: list[dict] = []
    for a, b in zip(wide, tall):
        interleaved.extend([a, b])
    interleaved.extend(wide[len(tall):])
    interleaved.extend(tall[len(wide):])

    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    poetry_pad = padding * 2
    free: list[tuple[int, int, int, int]] = [(ux, uy, uw, uh)]
    placements: list[dict] = []

    for piece in interleaved:
        pw, ph   = piece["width"], piece["height"]
        pw_p, ph_p = pw + poetry_pad, ph + poetry_pad

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
        if (rw - pw_p) > 0:
            free.append((rx + pw_p, ry, rw - pw_p, ph_p))
        if (rh - ph_p) > 0:
            free.append((rx, ry + ph_p, rw, rh - ph_p))
        free.sort(key=lambda r: (r[1], r[0]))

    return placements


# ─── Stamp / pixel-font layout ────────────────────────────────────────────────

# 3×5 pixel font — each char is 5 rows of 3-bit strings.
# Multi-line text via '|' separator.
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
    'U': ["101","101","101","101","011"],
    'V': ["101","101","101","010","010"],
    'W': ["101","101","111","111","101"],
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


def _text_to_pixel_positions(text: str, dot_size: int = 1) -> list[tuple[int, int]]:
    """Return (col, row) pixel positions for `text` in 3×5 font.

    Multi-line via '|' separator, 2-row gap between lines.
    Unknown chars → space.
    scale: each dot becomes a scale×scale block of positions.
    """
    positions: list[tuple[int, int]] = []
    char_w   = 3 * dot_size
    gap      = max(1, dot_size)        # gap between chars scales too
    line_gap = max(2, dot_size * 2)    # gap between lines
    line_height = 5 * dot_size + line_gap
    for line_idx, line in enumerate(text.upper().split('|')):
        cursor_x = 0
        y_offset  = line_idx * line_height
        for ch in line:
            rows = _PIXEL_FONT.get(ch, _PIXEL_FONT[' '])
            for row_idx, row in enumerate(rows):
                for col_idx, bit in enumerate(row):
                    if bit == '1':
                        # expand each font pixel into dot_size×dot_size primer windows
                        bx = cursor_x + col_idx * dot_size
                        by = y_offset + row_idx * dot_size
                        for dy in range(dot_size):
                            for dx in range(dot_size):
                                positions.append((bx + dx, by + dy))
            cursor_x += char_w + gap
    return positions


def _cluster_anchor(anchor: str) -> tuple[float, float]:
    """Map anchor name → (ax, ay) in [0.0, 1.0].

    ax: 0.0=left, 0.5=centre, 1.0=right
    ay: 0.0=top,  0.5=centre, 1.0=bottom
    """
    _map: dict[str, tuple[float, float]] = {
        "tl": (0.0, 0.0), "top-left":     (0.0, 0.0), "nw": (0.0, 0.0),
        "tr": (1.0, 0.0), "top-right":    (1.0, 0.0), "ne": (1.0, 0.0),
        "bl": (0.0, 1.0), "bottom-left":  (0.0, 1.0), "sw": (0.0, 1.0),
        "br": (1.0, 1.0), "bottom-right": (1.0, 1.0), "se": (1.0, 1.0),
        "top":    (0.5, 0.0), "tc": (0.5, 0.0), "n": (0.5, 0.0),
        "bottom": (0.5, 1.0), "bc": (0.5, 1.0), "s": (0.5, 1.0),
        "left":   (0.0, 0.5), "cl": (0.0, 0.5), "w": (0.0, 0.5),
        "right":  (1.0, 0.5), "cr": (1.0, 0.5), "e": (1.0, 0.5),
        "center": (0.5, 0.5), "centre": (0.5, 0.5), "c": (0.5, 0.5),
    }
    return _map.get(anchor.lower(), (0.5, 0.5))


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
    dot_size: int = 1,
) -> list[dict]:
    """Stamp layout — primers as repeating stamps on a pattern.

    patterns: text | grid | wave | diagonal | cross | border | spiral
    options (via options={}):
      pattern, text, cols, rows, turns, anchor
    See stamp-explorations.md for documented examples.
    """
    ux, uy, uw, uh = _usable(canvas_w, canvas_h, margin)
    if not primers:
        return []

    stamp  = primers[0]
    sw, sh = stamp["width"], stamp["height"]
    step_x = sw + padding
    step_y = sh + padding

    if pattern == "text":
        pixel_positions = _text_to_pixel_positions(text or "WIB", dot_size=dot_size)

    elif pattern == "grid":
        pixel_positions = [(c, r) for r in range(rows) for c in range(cols)]

    elif pattern == "wave":
        amplitude = max(1, (uh // step_y) // 3)
        pixel_positions = []
        for c in range(cols):
            r_center = (uh // step_y) // 2
            r = r_center + int(amplitude * math.sin(2 * math.pi * c / max(cols, 1) * 2))
            pixel_positions.append((c, r))

    elif pattern == "spiral":
        max_r_px = min(uw, uh * 2) // 2
        positions_raw: list[tuple[int, int]] = []
        for i in range(cols):
            t     = i / max(cols - 1, 1)
            angle = t * turns * 2 * math.pi
            r_px  = t * max_r_px
            cx_px = (uw // step_x) // 2
            cy_px = (uh // step_y) // 2
            col   = cx_px + int(r_px / step_x * math.cos(angle))
            row   = cy_px + int(r_px / step_y * math.sin(angle))
            positions_raw.append((col, row))
        seen: set[tuple[int, int]] = set()
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
        mid_r, mid_c = max_r // 2, max_c // 2
        pixel_positions  = [(c, mid_r) for c in range(max_c)]
        pixel_positions += [(mid_c, r) for r in range(max_r) if r != mid_r]

    elif pattern == "border":
        max_c = uw // step_x
        max_r = uh // step_y
        pixel_positions  = [(c, 0)         for c in range(max_c)]
        pixel_positions += [(c, max_r - 1) for c in range(max_c)]
        pixel_positions += [(0, r)         for r in range(1, max_r - 1)]
        pixel_positions += [(max_c - 1, r) for r in range(1, max_r - 1)]

    else:
        pixel_positions = _text_to_pixel_positions(text or "WIB", dot_size=dot_size)

    if not pixel_positions:
        return []

    raw    = [(c * step_x, r * step_y) for c, r in pixel_positions]
    min_x  = min(x for x, _ in raw)
    min_y  = min(y for _, y in raw)
    bbox_w = max(x + sw for x, _ in raw) - min_x
    bbox_h = max(y + sh for _, y in raw) - min_y

    ax, ay  = _cluster_anchor(anchor)
    ox = ux + int(max(0, uw - bbox_w) * ax) - min_x
    oy = uy + int(max(0, uh - bbox_h) * ay) - min_y

    n_primers = max(1, len(primers))
    placements = []
    for i, (x, y) in enumerate(raw):
        px, py = x + ox, y + oy
        if (px < 0 or py < 0
                or px + sw + SHADOW_W > canvas_w
                or py + sh + SHADOW_H + CANVAS_BOTTOM_EXTRA > canvas_h):
            continue
        p = primers[i % n_primers]
        placements.append({"filename": p["filename"], "x": px, "y": py,
                           "width": sw, "height": sh})
    return placements


def _layout_cluster(
    primers: list[dict],
    canvas_w: int,
    canvas_h: int,
    padding: int = 1,
    margin: int = 8,
    inner_algo: str = "maxrects_bssf",
    anchor: str = "center",
) -> list[dict]:
    """Gallery-wall cluster: rectpack MaxRects true-2D pack → centred on canvas.

    No fixed rows or column rails — organic, dense, real gallery-wall feel.
    Falls back to _layout_packery if rectpack is not installed.

    options (via options={}):
      padding     gutter between frames (default 1)
      margin      breathing room slider: 0=flush, 8=default, 20=airy
      anchor      9-position canvas anchor (center/tl/tr/bl/br/top/bottom/left/right)
      inner_algo  maxrects_bssf | maxrects_bl | skyline_bl | guillotine
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
        tv_y  = uh - ry - rh
        piece = id_map[rid]
        flipped.append({
            "filename": piece["filename"],
            "x": rx,
            "y": tv_y,
            "width":  rw - padding,
            "height": rh - padding,
        })

    min_x  = min(p["x"] for p in flipped)
    min_y  = min(p["y"] for p in flipped)
    bbox_w = max(p["x"] + p["width"]  for p in flipped) - min_x
    bbox_h = max(p["y"] + p["height"] for p in flipped) - min_y

    ax, ay   = _cluster_anchor(anchor)
    offset_x = ux + int(max(0, uw - bbox_w) * ax) - min_x
    offset_y = uy + int(max(0, uh - bbox_h) * ay) - min_y

    return [
        {**p, "x": p["x"] + offset_x, "y": p["y"] + offset_y}
        for p in flipped
    ]


# ─── Back-compat aliases ──────────────────────────────────────────────────────

def _masonry_layout(primers, canvas_w, canvas_h, padding=2, margin=1, n_cols=None, clamp=False):
    return _layout_masonry(primers, canvas_w, canvas_h, padding, margin, n_cols, clamp)

def _poetry_layout(primers, canvas_w, canvas_h, padding=2):
    return _layout_poetry(primers, canvas_w, canvas_h, padding)


# ─── Algorithm dispatch map ───────────────────────────────────────────────────
# Used by the /gallery/arrange route handler in main.py.
# Returns a dict of algo_name → zero-arg lambda (caller must bind all params).

def build_algo_map(primers_meta, canvas_w, canvas_h, padding, margin, opts) -> dict:
    """Return the algo → callable dispatch map for gallery/arrange.

    Caller passes bound locals; each lambda captures them via closure.
    """
    return {
        "masonry":            lambda: _layout_masonry(
                                  primers_meta, canvas_w, canvas_h, padding, margin,
                                  n_cols=opts.get("n_cols"), clamp=opts.get("clamp", False)),
        "fit_rows":           lambda: _layout_fit_rows(
                                  primers_meta, canvas_w, canvas_h, padding, margin),
        "masonry_horizontal": lambda: _layout_masonry_horizontal(
                                  primers_meta, canvas_w, canvas_h, padding, margin,
                                  n_rows=opts.get("n_rows"), clamp=opts.get("clamp", False)),
        "packery":            lambda: _layout_packery(
                                  primers_meta, canvas_w, canvas_h, padding, margin),
        "cells_by_row":       lambda: _layout_cells_by_row(
                                  primers_meta, canvas_w, canvas_h, padding, margin),
        "poetry":             lambda: _layout_poetry(
                                  primers_meta, canvas_w, canvas_h, padding, margin),
        "stamp":              lambda: _layout_stamp(
                                  primers_meta, canvas_w, canvas_h,
                                  padding=opts.get("padding", padding),
                                  margin=opts.get("margin", margin),
                                  pattern=opts.get("pattern", "text"),
                                  text=opts.get("text", "WIB"),
                                  cols=opts.get("cols", 8),
                                  rows=opts.get("rows", 4),
                                  turns=float(opts.get("turns", 3.0)),
                                  anchor=opts.get("anchor", "center"),
                                  dot_size=int(opts.get("dot_size", 1))),
        "cluster":            lambda: _layout_cluster(
                                  primers_meta, canvas_w, canvas_h,
                                  padding=opts.get("padding", padding),
                                  margin=opts.get("margin", margin),
                                  inner_algo=opts.get("inner_algo", "maxrects_bssf"),
                                  anchor=opts.get("anchor", "center")),
    }
