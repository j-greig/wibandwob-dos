#!/usr/bin/env python3
"""
workspace_snapshot.py — capture current WibWobDOS workspace as JSON + SVG.

Usage:
    python scripts/workspace_snapshot.py [--port 8089] [--out logs/snapshots]

Outputs (timestamped):
    logs/snapshots/YYYYMMDD_HHMMSS.json   — raw window state
    logs/snapshots/YYYYMMDD_HHMMSS.svg    — scaled canvas diagram

SVG design:
  • Outer black border = full TUI canvas (e.g. 320×77 cells)
  • Grey band at top = menu bar (1 cell tall)
  • Each window = black outline rect with:
      – primer/title name centred
      – "x=N y=N" label top-left inside
      – "WxH" label bottom-right inside
  • Scale: 1 char cell = CELL_W × CELL_H px  (default 9 × 15)
  • Aspect ratio approximates a standard terminal font (~1:1.6)
"""

import argparse
import json
import os
import sys
from datetime import datetime

import requests  # pip install requests (already in api_server venv)

# ── Config ────────────────────────────────────────────────────────────────────

CELL_W = 10   # px per character column  (measured from iTerm2: 1595px / 157cols)
CELL_H = 21   # px per character row    (measured from iTerm2: 1273px / 60rows)
PADDING = 4   # px inside each window rect before text

# Turbo Vision shadow + status bar (must match constants in main.py)
SHADOW_W = 2
SHADOW_H = 1
CANVAS_BOTTOM_EXTRA = 1  # status bar row at canvas bottom


# ── Colours ───────────────────────────────────────────────────────────────────

COL_BG          = "#f5f5f5"
COL_CANVAS_FILL = "#ffffff"
COL_MENU_FILL   = "#e0e0e0"
COL_WIN_FILL    = "#ffffff"
COL_WIN_STROKE  = "#222222"
COL_WIN_TITLE   = "#111111"
COL_WIN_META    = "#888888"
COL_BORDER      = "#111111"
COL_OVERLAP     = "#ff4444"
COL_SHADOW      = "#00000033"   # semi-transparent black — TV drop shadow
COL_SHADOW_CLIP = "#ff000055"   # red tint — shadow clipped by canvas edge


def fetch_state(port: int) -> dict:
    url = f"http://127.0.0.1:{port}/state"
    try:
        r = requests.get(url, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"ERROR: could not reach API at {url}: {e}", file=sys.stderr)
        sys.exit(1)


def build_json(state: dict) -> dict:
    canvas = state.get("canvas", {})
    windows_raw = state.get("windows", [])

    windows = []
    for w in windows_raw:
        rect = w.get("rect", {})
        props = w.get("props", {})
        filename = os.path.basename(props.get("path", "")) if props.get("path") else ""
        primer = filename.replace(".txt", "") if filename else (w.get("title") or w.get("id", "?"))
        windows.append({
            "id":       w.get("id", "?"),
            "primer":   primer,
            "filename": filename or "?",
            "type":     w.get("type", "?"),
            "x":        rect.get("x", 0),
            "y":        rect.get("y", 0),
            "w":        rect.get("w", 0),
            "h":        rect.get("h", 0),
        })

    return {
        "captured_at": datetime.now().isoformat(timespec="seconds"),
        "canvas": {
            "w": canvas.get("width",  320),
            "h": canvas.get("height",  77),
        },
        "window_count": len(windows),
        "windows": windows,
    }


def detect_overlaps(windows: list[dict]) -> set[str]:
    """Return set of window IDs that overlap any other window."""
    overlapping = set()
    for i, a in enumerate(windows):
        for j, b in enumerate(windows):
            if i >= j:
                continue
            # AABB overlap test
            if (a["x"] < b["x"] + b["w"] and a["x"] + a["w"] > b["x"] and
                    a["y"] < b["y"] + b["h"] and a["y"] + a["h"] > b["y"]):
                overlapping.add(a["id"])
                overlapping.add(b["id"])
    return overlapping


MENU_ROWS   = 1   # menu bar rows above the desktop (screen row 0)
# STATUS_ROWS = 0 intentionally — the TV status bar is canvas row 59,
# already inside canvas.height=60. deskTop->getBounds() includes it.
# Total screen rows = MENU_ROWS + canvas.height = 1 + 60 = 61 = tmux pane height. ✓


def build_svg(snapshot: dict) -> str:
    cw = snapshot["canvas"]["w"]
    ch = snapshot["canvas"]["h"]
    wins = snapshot["windows"]
    overlapping = detect_overlaps(wins)

    # SVG total = menu bar + canvas (canvas already includes TV status bar row)
    svg_w = cw * CELL_W
    svg_h = (MENU_ROWS + ch) * CELL_H

    # Y offset for the desktop area within the SVG
    desk_y0 = MENU_ROWS * CELL_H

    lines = []

    # ── Header ─────────────────────────────────────────────────────────────
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" '
                 f'width="{svg_w}" height="{svg_h}" '
                 f'viewBox="0 0 {svg_w} {svg_h}" '
                 f'font-family="monospace" font-size="11">')

    # Background
    lines.append(f'  <rect width="{svg_w}" height="{svg_h}" fill="{COL_BG}"/>')

    # Desktop area
    lines.append(f'  <!-- Desktop: {cw}×{ch} cells -->')
    lines.append(f'  <rect x="0" y="{desk_y0}" width="{svg_w}" height="{ch * CELL_H}" '
                 f'fill="{COL_CANVAS_FILL}" stroke="{COL_BORDER}" stroke-width="2"/>')

    # Menu bar (above desktop)
    lines.append(f'  <!-- Menu bar -->')
    lines.append(f'  <rect x="0" y="0" width="{svg_w}" height="{desk_y0}" '
                 f'fill="{COL_MENU_FILL}"/>')
    lines.append(f'  <text x="4" y="{desk_y0 - 3}" fill="{COL_WIN_META}" font-size="9">'
                 f'  File  Edit  View  Window  Tools  Help</text>')

    # Note: TV status bar is canvas row 59 — already inside the canvas rect above.

    # Canvas dimension label (top-right)
    lines.append(f'  <text x="{svg_w - 4}" y="{desk_y0 + 12}" text-anchor="end" '
                 f'fill="{COL_WIN_META}" font-size="10" font-weight="bold">'
                 f'{cw}×{ch} desktop cells</text>')

    # Timestamp
    ts = snapshot["captured_at"]
    lines.append(f'  <text x="4" y="{desk_y0 + 12}" fill="{COL_WIN_META}" font-size="9">'
                 f'captured {ts}</text>')

    # ── Windows (shadows drawn first so windows render on top) ────────────
    lines.append(f'  <!-- {len(wins)} windows -->')

    # Pass 1: shadows
    for w in wins:
        px = w["x"] * CELL_W
        py = desk_y0 + w["y"] * CELL_H   # offset by menu bar
        pw = w["w"] * CELL_W
        ph = w["h"] * CELL_H

        # Shadow rect offset by TV shadow dimensions
        sx = px + SHADOW_W * CELL_W
        sy = py + SHADOW_H * CELL_H

        # Clip detection: does shadow extend beyond safe canvas area?
        shadow_right_char  = w["x"] + w["w"] + SHADOW_W
        shadow_bottom_char = w["y"] + w["h"] + SHADOW_H + CANVAS_BOTTOM_EXTRA
        clipped = shadow_right_char > cw or shadow_bottom_char > ch
        sfill = COL_SHADOW_CLIP if clipped else COL_SHADOW

        lines.append(f'  <!-- shadow: {w["id"]} clipped={clipped} -->')
        lines.append(f'  <rect x="{sx}" y="{sy}" width="{pw}" height="{ph}" '
                     f'fill="{sfill}" rx="2"/>')
        if clipped:
            scx = sx + pw // 2
            scy = sy + ph // 2
            lines.append(f'  <text x="{scx}" y="{scy}" text-anchor="middle" '
                         f'dominant-baseline="middle" fill="#cc0000" '
                         f'font-size="9" font-weight="bold">shadow clipped</text>')

    # Pass 2: window frames
    for w in wins:
        px = w["x"] * CELL_W
        py = desk_y0 + w["y"] * CELL_H   # offset by menu bar
        pw = w["w"] * CELL_W
        ph = w["h"] * CELL_H

        is_overlap = w["id"] in overlapping
        stroke = COL_OVERLAP if is_overlap else COL_WIN_STROKE
        fill   = "#fff0f0"   if is_overlap else COL_WIN_FILL
        sw     = 2.5         if is_overlap else 1.5

        # Rect
        lines.append(f'  <rect x="{px}" y="{py}" width="{pw}" height="{ph}" '
                     f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
                     f'rx="2"/>')

        # Top-left: "x=N y=N" position label
        lines.append(f'  <text x="{px + PADDING}" y="{py + 11}" '
                     f'fill="{COL_WIN_META}" font-size="9">'
                     f'x={w["x"]} y={w["y"]}</text>')

        # Centre: primer name  (clip if window is tiny)
        cx = px + pw // 2
        cy = py + ph // 2
        name = w["primer"] or w["id"]
        max_chars = max(4, pw // 7)
        if len(name) > max_chars:
            name = name[:max_chars - 1] + "…"
        lines.append(f'  <text x="{cx}" y="{cy}" text-anchor="middle" '
                     f'dominant-baseline="middle" fill="{COL_WIN_TITLE}" '
                     f'font-size="11" font-weight="bold">{_escape(name)}</text>')

        # Bottom-right: "WxH" size label
        lines.append(f'  <text x="{px + pw - PADDING}" y="{py + ph - 3}" '
                     f'text-anchor="end" fill="{COL_WIN_META}" font-size="9">'
                     f'{w["w"]}×{w["h"]}</text>')

        # Overlap warning
        if is_overlap:
            lines.append(f'  <text x="{cx}" y="{cy + 14}" text-anchor="middle" '
                         f'fill="{COL_OVERLAP}" font-size="9" font-weight="bold">'
                         f'⚠ OVERLAP</text>')

    lines.append('</svg>')
    return "\n".join(lines)


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main():
    ap = argparse.ArgumentParser(description="WibWobDOS workspace snapshot (JSON + SVG)")
    ap.add_argument("--port", type=int, default=8089)
    ap.add_argument("--out",  default="logs/snapshots")
    ap.add_argument("--name", default=None, help="Override filename stem (default: timestamp)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    stem = args.name or datetime.now().strftime("%Y%m%d_%H%M%S")

    print(f"Querying API at port {args.port}...")
    state    = fetch_state(args.port)
    snapshot = build_json(state)
    svg      = build_svg(snapshot)

    json_path = os.path.join(args.out, f"{stem}.json")
    svg_path  = os.path.join(args.out, f"{stem}.svg")

    with open(json_path, "w") as f:
        json.dump(snapshot, f, indent=2)
    with open(svg_path, "w") as f:
        f.write(svg)

    print(f"JSON → {json_path}")
    print(f"SVG  → {svg_path}")
    print(f"Canvas: {snapshot['canvas']['w']}×{snapshot['canvas']['h']}")
    print(f"Windows: {snapshot['window_count']}")
    for w in snapshot["windows"]:
        print(f"  {w['id']:>4}  {w['primer']:<28}  x={w['x']:>3} y={w['y']:>3}  {w['w']}×{w['h']}")

    # Don't auto-open — user clicks the link


if __name__ == "__main__":
    main()
