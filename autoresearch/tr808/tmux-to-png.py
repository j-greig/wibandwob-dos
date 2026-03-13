#!/usr/bin/env python3
"""Render tmux ANSI capture to a PNG image with proper colours."""
import sys, re, subprocess
from PIL import Image, ImageDraw, ImageFont

# 256-colour xterm palette (first 16 match standard ANSI)
PALETTE_16 = [
    (0,0,0), (187,0,0), (0,187,0), (187,187,0),
    (0,0,187), (187,0,187), (0,187,187), (187,187,187),
    (85,85,85), (255,85,85), (85,255,85), (255,255,85),
    (85,85,255), (255,85,255), (85,255,255), (255,255,255),
]

def xterm_256(n):
    if n < 16: return PALETTE_16[n]
    if n < 232:
        n -= 16
        r = (n // 36) * 51
        g = ((n % 36) // 6) * 51
        b = (n % 6) * 51
        return (r, g, b)
    g = 8 + (n - 232) * 10
    return (g, g, g)

def parse_sgr(codes, fg, bg, bold):
    i = 0
    while i < len(codes):
        c = codes[i]
        if c == 0: fg, bg, bold = (187,187,187), (43,43,43), False
        elif c == 1: bold = True
        elif c == 2: bold = False
        elif c in (30,31,32,33,34,35,36,37):
            fg = PALETTE_16[c - 30 + (8 if bold else 0)]
        elif c in (90,91,92,93,94,95,96,97):
            fg = PALETTE_16[c - 90 + 8]
        elif c in (40,41,42,43,44,45,46,47):
            bg = PALETTE_16[c - 40]
        elif c == 38 and i+1 < len(codes) and codes[i+1] == 5:
            fg = xterm_256(codes[min(i+2, len(codes)-1)])
            i += 2
        elif c == 48 and i+1 < len(codes) and codes[i+1] == 5:
            bg = xterm_256(codes[min(i+2, len(codes)-1)])
            i += 2
        i += 1
    return fg, bg, bold

# Capture tmux with escapes
raw = subprocess.check_output(
    ["tmux", "capture-pane", "-t", "wibwob:0", "-e", "-p"],
    text=True
)
lines = raw.split("\n")

# Font
try:
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 14)
except:
    font = ImageFont.load_default()

cw, ch = 8, 16  # char cell
try:
    bbox = font.getbbox("M")
    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1] + 4
except:
    pass

cols = 211
rows = min(len(lines), 56)
img = Image.new("RGB", (cols * cw, rows * ch), (43, 43, 43))
draw = ImageDraw.Draw(img)

ESC_RE = re.compile(r'\x1b\[([0-9;]*)m')

for row, line in enumerate(lines[:rows]):
    fg = (187, 187, 187)
    bg = (43, 43, 43)
    bold = False
    col = 0
    pos = 0
    while pos < len(line):
        m = ESC_RE.match(line, pos)
        if m:
            codes = [int(x) for x in m.group(1).split(";") if x] if m.group(1) else [0]
            fg, bg, bold = parse_sgr(codes, fg, bg, bold)
            pos = m.end()
        else:
            char = line[pos]
            x = col * cw
            y = row * ch
            if bg != (43, 43, 43):
                draw.rectangle([x, y, x + cw - 1, y + ch - 1], fill=bg)
            draw.text((x, y), char, fill=fg, font=font)
            col += 1
            pos += 1

import sys as _sys
outpath = _sys.argv[1] if len(_sys.argv) > 1 else "/tmp/tmux-render.png"
img.save(outpath)
print(f"Rendered {cols}x{rows} to {outpath}")
