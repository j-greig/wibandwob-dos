#!/usr/bin/env python3
"""
star-spectrum.py — Smooth true-spectrum gradient on any art + figlet header.

Two things rendered into a notepad window:
  1. Figlet header — the whole text block gets ONE continuous rainbow gradient
     across its full width (blue left → pink right), as one object.
  2. Art body below — each character gets its own colour based on horizontal
     position, via the same smooth sine-wave spectrum.

Colour: true smooth ROYGBIV via 3-channel offset sine waves.
  r_s = sin(t * 2π)
  g_s = sin(t + 1/3 * 2π)
  b_s = sin(t + 2/3 * 2π)
No discrete palette — continuous interpolation, no visible steps.

Usage:
  python3 scripts/fx/star-spectrum.py \
    --source primers/star-face.txt \
    --header "STAR FACE" \
    --canvas-w 168 --canvas-h 80 \
    --window-id 38

Options:
  --source        path to ASCII art file (default: star-face.txt)
  --header        figlet text above the art (default: STAR FACE)
  --canvas-w      canvas width in chars (default: 168)
  --canvas-h      canvas height in rows (default: 80)
  --window-id     reuse existing notepad by id (opens fresh if omitted)
  --figlet-font   figlet font name (default: standard)
"""

import argparse
import math
import subprocess
import time
import urllib.request
import json
from pathlib import Path

API_BASE = "http://127.0.0.1:8100"
BG = (30, 30, 46)  # Catppuccin dark-pastel base


# ── API helpers ────────────────────────────────────────────────────────────────

def api_get(path):
    with urllib.request.urlopen(f"{API_BASE}{path}", timeout=4) as r:
        return json.loads(r.read())

def api_post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}", data=data,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=6) as r:
        return json.loads(r.read())

def get_desktop():
    h = api_get("/health")
    return int(h["screen"]["width"]), int(h["screen"]["height"])

def open_or_reuse_notepad(wid, win_w, win_h):
    sw, sh = get_desktop()
    cx = max(0, (sw - win_w) // 2)
    cy = max(0, (sh - win_h) // 2)
    if wid is not None:
        api_post("/windows/batch", {
            "ops": [{"id": wid, "left": cx, "top": cy, "width": win_w, "height": win_h}]
        })
        return wid
    r = api_post("/commands/run", {"id": "microapp.wibwob.notepad.open", "args": {}})
    if not r.get("ok"):
        return None
    time.sleep(0.35)
    state = api_get("/state")
    for w in state.get("windows", []):
        if (w.get("details") or {}).get("appType") == "wibwob.notepad":
            wid = w["id"]
            api_post("/windows/batch", {
                "ops": [{"id": wid, "left": cx, "top": cy, "width": win_w, "height": win_h}]
            })
            return wid
    return None

def write_text(wid, text):
    api_post("/commands/run", {
        "id": "microapp.wibwob.notepad.write",
        "args": {"windowId": wid, "text": text}
    })


# ── Colour ───────────────────────────────────────────────────────────────────

def af(r, g, b):
    return f"\x1b[38;2;{int(r)};{int(g)};{int(b)}m"

def ab(r, g, b):
    return f"\x1b[48;2;{int(r)};{int(g)};{int(b)}m"

RESET = "\x1b[0m"


def spectrum(t):
    """Smooth continuous ROYGBIV via 3-channel offset sine waves.
    r peaks at 0 and 1, g peaks at 1/3, b peaks at 2/3.
    Result: seamless rainbow with no visible discrete steps."""
    t = t % 1.0
    r_s = math.sin(t * 2 * math.pi) * 0.5 + 0.5
    g_s = math.sin((t + 1 / 3) * 2 * math.pi) * 0.5 + 0.5
    b_s = math.sin((t + 2 / 3) * 2 * math.pi) * 0.5 + 0.5
    # Lift from pure black to vivid range
    return 50 + r_s * 205, 50 + g_s * 205, 80 + b_s * 175


def spectrum_pastel(t):
    """Softer version — lower saturation, good for dark backgrounds."""
    t = t % 1.0
    r_s = math.sin(t * 2 * math.pi) * 0.5 + 0.5
    g_s = math.sin((t + 1 / 3) * 2 * math.pi) * 0.5 + 0.5
    b_s = math.sin((t + 2 / 3) * 2 * math.pi) * 0.5 + 0.5
    return 100 + r_s * 155, 100 + g_s * 155, 120 + b_s * 135


# ── Renderer ──────────────────────────────────────────────────────────────────

def render_canvas(cw, ch, art_lines, header_text, header_font):
    """Build the full canvas: figlet header + art, both with smooth spectrum."""
    canvas = [[" ", " "] * cw for _ in range(ch)]

    # ── Figlet header: whole block gets ONE gradient across its full width
    header_raw = subprocess.run(
        ["figlet", "-f", header_font, header_text],
        capture_output=True, text=True
    ).stdout
    header_lines = header_raw.splitlines()
    header_w = max(len(l) for l in header_lines) if header_lines else 0
    header_h = len(header_lines)

    y = 0
    for ll in header_lines:
        llen = len(ll)
        for ci, c in enumerate(ll):
            if ci < cw:
                # ONE gradient across the whole figlet block (left→right)
                t = (ci / max(1, header_w)) % 1.0
                r, g, b = spectrum(t)
                canvas[y][ci] = ab(*BG) + af(r, g, b) + c
        y += 1
    y += 2  # gap after header

    # ── Art body: each character coloured by its own horizontal position
    for ll in art_lines:
        if y >= ch:
            break
        row = list(canvas[y])
        llen = len(ll)
        for ci, c in enumerate(ll):
            if ci < cw and c not in " \t":
                t = (ci / max(1, llen)) % 1.0
                r, g, b = spectrum(t)
                row[ci] = ab(*BG) + af(r, g, b) + c
        canvas[y] = "".join(row)
        y += 1

    return "\n".join("".join(row) + RESET for row in canvas)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source", default="microapps-private/wibwob-primers/primers/star-face.txt")
    p.add_argument("--header", default="STAR FACE")
    p.add_argument("--canvas-w", type=int, default=168)
    p.add_argument("--canvas-h", type=int, default=80)
    p.add_argument("--window-id", type=int, default=None)
    p.add_argument("--figlet-font", default="standard")
    args = p.parse_args()

    # Resolve art path relative to repo root
    src = Path(args.source)
    if not src.exists():
        src = Path.home() / "Repos/wibwob-zine-moodboard" / args.source
    if not src.exists():
        print(f"Source not found: {args.source}", file=sys.stderr)
        sys.exit(1)

    art_lines = [
        l.rstrip("\n\r")
        for l in src.read_text().splitlines()
        if l.strip() and not l.startswith("#")
    ]

    wid = open_or_reuse_notepad(args.window_id, args.canvas_w, args.canvas_h)
    if wid is None:
        print("Failed to open notepad", file=sys.stderr)
        sys.exit(1)

    text = render_canvas(
        args.canvas_w, args.canvas_h,
        art_lines,
        args.header,
        args.figlet_font
    )

    write_text(wid, text)
    print(f"Written {len(text)} chars to window {wid}", file=sys.stderr)


if __name__ == "__main__":
    import sys
    main()
