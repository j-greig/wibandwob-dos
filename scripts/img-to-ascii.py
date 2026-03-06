#!/usr/bin/env python3
"""
img-to-ascii — convert an image to a plain-text ASCII primer.

Usage:
  python3 scripts/img-to-ascii.py <image> [--width 80] [--out output.txt] [--invert]

Writes to stdout or --out file. Width defaults to 80. Height auto-scales
for cell aspect ratio (chars are ~2.2x taller than wide).
"""

import sys
import argparse
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    print("pip3 install Pillow", file=sys.stderr)
    sys.exit(1)

# Ramps — from dark to light
RAMP_DENSE  = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
RAMP_SIMPLE = ' .:-=+*#%@'
RAMP_BLOCK  = ' ░▒▓█'

def to_ascii(img_path: str, width: int = 80, ramp: str = RAMP_DENSE,
             invert: bool = False, contrast: float = 1.4, brightness: float = 1.0) -> str:
    img = Image.open(img_path).convert('L')

    # Enhance contrast
    img = ImageEnhance.Contrast(img).enhance(contrast)
    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)

    # Scale to target width, compensating for cell aspect (chars ~2.1x taller than wide)
    aspect = img.height / img.width
    height = int(width * aspect * 0.45)
    img = img.resize((width, height), Image.LANCZOS)

    if invert:
        from PIL import ImageOps
        img = ImageOps.invert(img)

    pixels = img.load()
    lines = []
    for y in range(height):
        row = ''
        for x in range(width):
            v = pixels[x, y]
            idx = int(v / 255 * (len(ramp) - 1))
            row += ramp[idx]
        lines.append(row.rstrip())

    return '\n'.join(lines)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('image')
    p.add_argument('--width', type=int, default=80)
    p.add_argument('--out', type=str, default=None)
    p.add_argument('--invert', action='store_true')
    p.add_argument('--ramp', choices=['dense', 'simple', 'block'], default='dense')
    p.add_argument('--contrast', type=float, default=1.4)
    p.add_argument('--brightness', type=float, default=1.0)
    args = p.parse_args()

    ramp = {'dense': RAMP_DENSE, 'simple': RAMP_SIMPLE, 'block': RAMP_BLOCK}[args.ramp]
    result = to_ascii(args.image, args.width, ramp, args.invert, args.contrast, args.brightness)

    if args.out:
        Path(args.out).write_text(result)
        print(f"→ {args.out}  ({args.width}w x {result.count(chr(10))+1}h)")
    else:
        print(result)
