#!/usr/bin/env python3
"""
pixelstretch — take a vertical slice of an ASCII primer and repeat it rightward.
Exactly like Photoshop pixel stretch: original left of col X, then col X char
repeated to fill the rest of the canvas width.

Usage:
  python3 scripts/pixelstretch.py <input.txt> --col 40 [--slice 1] [--width 200] [--out out.txt]
  python3 scripts/pixelstretch.py <input.txt> --frames 10 --width 200 [--outdir /tmp/frames/]

--col     column to sample (default: middle)
--slice   how many chars wide the repeated tile is (default: 1)
--width   total output width (default: source width)
--frames  generate N evenly-spaced frames from col 0 to col max (for wipe animation)
--outdir  output dir for frames
"""

import argparse, sys
from pathlib import Path

def stretch(lines: list[str], col: int, slice_w: int, out_width: int) -> list[str]:
    result = []
    for line in lines:
        # pad line so we always get a char at col
        padded = line + " " * max(0, col + slice_w - len(line))
        left   = padded[:col]
        tile   = padded[col : col + slice_w]
        if not tile.strip():
            tile = tile or " "
        right_len = out_width - col
        # repeat tile to fill right side — no rstrip
        right = (tile * (right_len // len(tile) + 2))[:right_len]
        row = (left + right)
        # pad to exact output width
        row = row + " " * max(0, out_width - len(row))
        result.append(row[:out_width])
    return result

def write(lines: list[str], path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    text = "\n".join(lines)
    Path(path).write_text(text)
    w = max(len(l) for l in lines) if lines else 0
    print(f"→ {path}  ({w}w x {len(lines)}h)")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("--col",    type=int,   default=None)
    p.add_argument("--slice",  type=int,   default=1)
    p.add_argument("--width",  type=int,   default=None)
    p.add_argument("--frames", type=int,   default=None, help="generate N wipe frames")
    p.add_argument("--outdir", default="/tmp/frames")
    p.add_argument("--out",    default=None)
    args = p.parse_args()

    raw   = Path(args.input).read_text().splitlines()
    src_w = max(len(l) for l in raw) if raw else 80
    out_w = args.width or src_w
    stem  = Path(args.input).stem

    if args.frames:
        # evenly spaced from col 1 to col src_w-1
        cols = [max(1, int(i * src_w / (args.frames - 1))) for i in range(args.frames)]
        for i, col in enumerate(cols):
            result = stretch(raw, col, args.slice, out_w)
            write(result, f"{args.outdir}/{stem}-f{i:02d}-col{col:03d}.txt")
    else:
        col = args.col if args.col is not None else src_w // 2
        result = stretch(raw, col, args.slice, out_w)
        out = args.out or f"/tmp/{stem}-stretch-col{col}.txt"
        write(result, out)
