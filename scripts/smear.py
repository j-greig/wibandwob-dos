#!/usr/bin/env python3
"""
smear — ASCII wipe/smear transition frames.

Modes:
  wipe      — progressive reveal: source left of wipe line, smear column tiled right
  shear     — each row samples a different column (diagonal stretch effect)
  glitch    — rows randomly offset/repeated to simulate glitch frame
  stretch   — source image horizontally stretched/compressed into target width
  frame     — generate N wipe frames at column positions start..end (for animation)

Usage:
  python3 scripts/smear.py <input.txt> --mode wipe   --at 50  [--out file.txt]
  python3 scripts/smear.py <input.txt> --mode shear  --skew 3 [--out file.txt]
  python3 scripts/smear.py <input.txt> --mode glitch --seed 42 [--out file.txt]
  python3 scripts/smear.py <input.txt> --mode stretch --width 200 [--out file.txt]
  python3 scripts/smear.py <input.txt> --mode frames --from 0 --to 200 --steps 8 --outdir /tmp/
"""

import argparse, sys, random
from pathlib import Path

def load(path):
    lines = Path(path).read_text().splitlines()
    w = max((len(l) for l in lines), default=0)
    return [l.ljust(w) for l in lines], w, len(lines)

def char_at(lines, col, row):
    if row >= len(lines): return " "
    l = lines[row]
    return l[col] if col < len(l) else " "

# ── WIPE ─────────────────────────────────────────────────────────────────────
# Left of `at`: original. Right: the column at `at` tiled across.
def mode_wipe(lines, w, h, at, tile_width=2, out_width=None):
    out_w = out_width or w
    result = []
    for row in range(h):
        left  = lines[row][:at] if at <= len(lines[row]) else lines[row].ljust(at)
        tile  = lines[row][at:at+tile_width] if at < len(lines[row]) else " " * tile_width
        tile  = tile or " "
        right_len = out_w - at
        right = (tile * ((right_len // len(tile)) + 2))[:right_len]
        result.append((left + right)[:out_w])
    return result

# ── SHEAR ────────────────────────────────────────────────────────────────────
# Row N samples from column N*skew in the source — diagonal stretch.
def mode_shear(lines, w, h, skew=2, out_width=None):
    out_w = out_width or w
    result = []
    for row in range(h):
        offset = int(row * skew) % w
        # shift the row left by offset (wrapping)
        src = lines[row]
        shifted = (src[offset:] + src[:offset]).ljust(out_w)[:out_w]
        result.append(shifted)
    return result

# ── GLITCH ────────────────────────────────────────────────────────────────────
# Random row duplication/skipping + column offset per row.
def mode_glitch(lines, w, h, seed=0, intensity=0.3, out_width=None):
    rng = random.Random(seed)
    out_w = out_width or w
    pool = list(range(h))
    result = []
    i = 0
    while len(result) < h:
        src_row = pool[i % len(pool)]
        # random chance to repeat a row or skip
        if rng.random() < intensity:
            src_row = rng.choice(pool)
        offset = rng.randint(-8, 8) if rng.random() < intensity else 0
        src = lines[src_row]
        if offset > 0:
            shifted = (" " * offset + src)[:out_w]
        elif offset < 0:
            shifted = (src[-offset:] + " " * abs(offset))[:out_w]
        else:
            shifted = src[:out_w].ljust(out_w)
        result.append(shifted)
        i += 1
    return result[:h]

# ── STRETCH ───────────────────────────────────────────────────────────────────
# Horizontally resample source into out_width columns.
def mode_stretch(lines, w, h, out_width=200):
    result = []
    for row in lines:
        if not row.strip():
            result.append(" " * out_width)
            continue
        out = []
        for x in range(out_width):
            src_x = int(x / out_width * w)
            out.append(row[src_x] if src_x < len(row) else " ")
        result.append("".join(out))
    return result

# ── OUTPUT ────────────────────────────────────────────────────────────────────
def write(result, out_path):
    text = "\n".join(r.rstrip() for r in result)
    Path(out_path).write_text(text)
    actual_w = max((len(l) for l in result), default=0)
    print(f"→ {out_path}  ({actual_w}w x {len(result)}h)")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("--mode",    choices=["wipe","shear","glitch","stretch","frames"], default="wipe")
    p.add_argument("--at",      type=int, default=None,  help="wipe: column position")
    p.add_argument("--tile",    type=int, default=2,     help="wipe: tile slice width")
    p.add_argument("--skew",    type=float, default=2.0, help="shear: pixels per row")
    p.add_argument("--seed",    type=int, default=0,     help="glitch: rng seed")
    p.add_argument("--intensity",type=float,default=0.3, help="glitch: chaos 0-1")
    p.add_argument("--width",   type=int, default=None,  help="output width")
    p.add_argument("--from",    dest="from_col", type=int, default=0)
    p.add_argument("--to",      dest="to_col",   type=int, default=None)
    p.add_argument("--steps",   type=int, default=8)
    p.add_argument("--outdir",  default="/tmp")
    p.add_argument("--out",     default=None)
    args = p.parse_args()

    lines, w, h = load(args.input)
    stem = Path(args.input).stem

    if args.mode == "wipe":
        at = args.at if args.at is not None else w // 2
        result = mode_wipe(lines, w, h, at, args.tile, args.width)
        out = args.out or f"/tmp/{stem}-wipe{at}.txt"
        write(result, out)

    elif args.mode == "shear":
        result = mode_shear(lines, w, h, args.skew, args.width)
        out = args.out or f"/tmp/{stem}-shear{int(args.skew)}.txt"
        write(result, out)

    elif args.mode == "glitch":
        result = mode_glitch(lines, w, h, args.seed, args.intensity, args.width)
        out = args.out or f"/tmp/{stem}-glitch{args.seed}.txt"
        write(result, out)

    elif args.mode == "stretch":
        result = mode_stretch(lines, w, h, args.width or 200)
        out = args.out or f"/tmp/{stem}-stretch{args.width or 200}.txt"
        write(result, out)

    elif args.mode == "frames":
        to_col = args.to_col or w
        cols = [int(args.from_col + i * (to_col - args.from_col) / (args.steps - 1))
                for i in range(args.steps)]
        for i, col in enumerate(cols):
            result = mode_wipe(lines, w, h, col, args.tile, args.width)
            out = f"{args.outdir}/{stem}-wipe-{i:02d}-col{col:03d}.txt"
            write(result, out)
