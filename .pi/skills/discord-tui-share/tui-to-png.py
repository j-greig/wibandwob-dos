#!/usr/bin/env python3
"""
tui-to-png.py — render WibWob-DOS TUI text screenshot to a styled PNG.

Usage:
    python3 tui-to-png.py [--api http://127.0.0.1:8099] [--out /tmp/wibwob.png]
                          [--window-id N]

Fetches /screenshot/text (or /windows/text?id=N for a single window) from the
control API, renders it as a terminal-styled image, and saves to --out.

Requires: Pillow  (pip install Pillow)
"""
import argparse, os, sys, re
import urllib.request
from pathlib import Path

def strip_ansi(text: str) -> str:
    return re.sub(r'\x1b\[[0-9;]*[mGKHJABCDFfnrihl]', '', text)

def find_font(size: int = 14):
    """Find best monospace font available on this system."""
    from PIL import ImageFont
    candidates = [
        # macOS
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Monaco.dfont",
        # Linux/VPS
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoMono-Regular.ttf",
        "/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    # Fallback: PIL built-in bitmap font (no size control, ugly but works)
    return ImageFont.load_default()

def render(text: str, out_path: str, title: str = "WibWob-DOS") -> None:
    from PIL import Image, ImageDraw

    lines = text.rstrip().split("\n")
    if not lines:
        lines = ["(empty)"]

    FONT_SIZE  = 13
    PAD        = 12
    LINE_GAP   = 2
    BG         = (10, 10, 10)
    FG         = (180, 180, 180)
    TITLE_FG   = (100, 180, 255)
    BORDER     = (40, 40, 60)

    font = find_font(FONT_SIZE)

    # Measure char cell using the font
    tmp = Image.new("RGB", (1, 1))
    d   = ImageDraw.Draw(tmp)
    bb  = d.textbbox((0, 0), "M", font=font)
    CHAR_W = bb[2] - bb[0]
    CHAR_H = bb[3] - bb[1] + LINE_GAP

    max_cols = max((len(l) for l in lines), default=1)
    W = max_cols * CHAR_W + PAD * 2
    H = len(lines) * CHAR_H + PAD * 2 + CHAR_H + 4  # +title bar

    img  = Image.new("RGB", (W, H), color=BG)
    draw = ImageDraw.Draw(img)

    # Border
    draw.rectangle([0, 0, W-1, H-1], outline=BORDER)

    # Title bar
    draw.rectangle([1, 1, W-2, CHAR_H + PAD], fill=(20, 20, 35))
    draw.text((PAD, PAD // 2), title, fill=TITLE_FG, font=font)

    # Body text
    y_off = CHAR_H + PAD + 4
    for line in lines:
        clean = strip_ansi(line)
        draw.text((PAD, y_off), clean, fill=FG, font=font)
        y_off += CHAR_H

    img.save(out_path)
    print(f"saved: {out_path}  ({W}x{H}px, {len(lines)} lines)")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api",       default="http://127.0.0.1:8099")
    ap.add_argument("--out",       default="/tmp/wibwob-tui.png")
    ap.add_argument("--window-id", default=None, type=int,
                    help="render a single window (uses /windows/text?id=N)")
    ap.add_argument("--title",     default="WibWob-DOS")
    args = ap.parse_args()

    if args.window_id is not None:
        url = f"{args.api}/windows/text?id={args.window_id}"
    else:
        url = f"{args.api}/screenshot/text"

    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            text = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"error: could not reach {url}: {e}", file=sys.stderr)
        sys.exit(1)

    render(text, args.out, title=args.title)

if __name__ == "__main__":
    main()
