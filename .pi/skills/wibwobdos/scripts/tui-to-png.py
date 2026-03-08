#!/usr/bin/env python3
"""
tui-to-png.py — render WibWob-DOS terminal text to a styled PNG image.

Works on macOS (Menlo), Linux/VPS (DejaVuSansMono), and any machine
with PIL's built-in bitmap font as a fallback.

Usage:
    python3 tui-to-png.py --api http://127.0.0.1:8099 --out /tmp/out.png
    python3 tui-to-png.py --api http://127.0.0.1:8099 --window-id 3 --out /tmp/win.png
    python3 tui-to-png.py --text-file /tmp/captured.txt --out /tmp/out.png

Requires: pip install Pillow
"""
import argparse, os, re, sys, urllib.request

def strip_ansi(text: str) -> str:
    return re.sub(r'\x1b\[[0-9;?]*[mGKHJABCDFfnrihlsu]', '', text)

def find_font(size: int):
    from PIL import ImageFont
    candidates = [
        # macOS
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Monaco.dfont",
        # Linux/Debian/Ubuntu
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf",
        "/usr/share/fonts/truetype/noto/NotoMono-Regular.ttf",
        # Linux/RHEL/Fedora
        "/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono.ttf",
        "/usr/share/fonts/liberation-mono/LiberationMono-Regular.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()  # PIL built-in bitmap

def render(text: str, out_path: str, title: str = "WibWob-DOS") -> None:
    from PIL import Image, ImageDraw

    # Palette — WibWob-DOS dark theme
    BG          = (10,  10,  14)   # near-black background
    FG          = (185, 185, 195)  # light grey text
    TITLE_BG    = (18,  20,  40)   # dark navy title bar
    TITLE_FG    = (100, 160, 255)  # blue-ish title text
    BORDER      = (40,  45,  70)   # dim border

    FONT_SIZE   = 13
    PAD         = 12
    LINE_GAP    = 2

    lines = strip_ansi(text).rstrip().split("\n")
    if not lines:
        lines = ["(empty)"]

    font = find_font(FONT_SIZE)

    # Measure monospace cell size
    probe = Image.new("RGB", (1, 1))
    d     = ImageDraw.Draw(probe)
    bb    = d.textbbox((0, 0), "M", font=font)
    CHAR_W = bb[2] - bb[0]
    CHAR_H = bb[3] - bb[1] + LINE_GAP

    max_cols = max(len(l) for l in lines) if lines else 1
    W = max_cols * CHAR_W + PAD * 2
    H = len(lines) * CHAR_H + PAD * 2 + CHAR_H + 6  # title bar height

    img  = Image.new("RGB", (W, H), color=BG)
    draw = ImageDraw.Draw(img)

    # Outer border
    draw.rectangle([0, 0, W - 1, H - 1], outline=BORDER)

    # Title bar
    title_h = CHAR_H + PAD
    draw.rectangle([1, 1, W - 2, title_h], fill=TITLE_BG)
    draw.text((PAD, PAD // 2), title, fill=TITLE_FG, font=font)

    # Body lines
    y = title_h + 4
    for line in lines:
        draw.text((PAD, y), line, fill=FG, font=font)
        y += CHAR_H

    img.save(out_path)
    print(f"png: {out_path}  ({W}x{H}px, {len(lines)} lines)")

def fetch_text(api: str, window_id=None) -> str:
    if window_id is not None:
        url = f"{api}/windows/text?id={window_id}"
    else:
        url = f"{api}/screenshot/text"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"error fetching {url}: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api",       default="http://127.0.0.1:8099")
    ap.add_argument("--out",       default="/tmp/wibwob-tui.png")
    ap.add_argument("--window-id", default=None, type=int)
    ap.add_argument("--title",     default="WibWob-DOS")
    ap.add_argument("--text-file", default=None,
                    help="render from a text file instead of fetching the API")
    args = ap.parse_args()

    if args.text_file:
        with open(args.text_file, encoding="utf-8", errors="replace") as f:
            text = f.read()
    else:
        text = fetch_text(args.api, args.window_id)

    render(text, args.out, title=args.title)

if __name__ == "__main__":
    main()
