#!/usr/bin/env python3
"""
smear — vector smear transitions on ASCII primer grids.

Each smear op samples a slice from the source, then drags it in a compass
direction for a given length. Ops chain: the endpoint of one becomes the
startpoint of the next unless overridden.

Usage:
  python3 scripts/smear.py <input.txt> --ops "OP OP OP ..." [--out file.txt]

Op syntax:  [col,row:]DIR:LEN[:SLICE]
  col,row   = start position (default: middle of image, or previous endpoint)
  DIR       = E W N S
  LEN       = how many chars/rows to drag
  SLICE     = sample width (E/W) or height (N/S) in chars (default: 2)

Examples:
  # drag col 55 eastward 80 chars, then turn south to bottom
  --ops "55,20:E:80:2 S:999:2"

  # smear from left edge eastward, then flip south
  --ops "0,10:E:160:1 S:60:1"

  # three-way: right, down, right again
  --ops "40,5:E:60:3 S:30:3 E:100:3"
"""

import argparse, sys, re
from pathlib import Path
from copy import deepcopy

def parse_grid(text):
    lines = text.splitlines()
    w = max((len(l) for l in lines), default=0)
    return [list(l.ljust(w)) for l in lines], w, len(lines)

def grid_to_text(grid):
    return "\n".join("".join(row).rstrip() for row in grid)

def smear_op(grid, col, row, direction, length, slicesize):
    rows = len(grid)
    cols = len(grid[0]) if grid else 0

    if direction == "E":
        sample = [grid[row][max(0,col):col+slicesize] if row < rows else [" "]*slicesize]
        for i in range(length):
            c = col + i
            if c + slicesize > cols:
                for r2 in range(rows):
                    while len(grid[r2]) < c + slicesize:
                        grid[r2].append(" ")
                cols = len(grid[0])
            for r2 in range(rows):
                src = sample[0] if r2 < rows else [" "]*slicesize
                for k in range(slicesize):
                    if c+k < len(grid[r2]):
                        grid[r2][c+k] = src[k % len(src)] if src else " "
        return col + length, row

    elif direction == "W":
        sample = [grid[row][col:col+slicesize] if row < rows else [" "]*slicesize]
        for i in range(length):
            c = col - i
            if c < 0: break
            for r2 in range(rows):
                src = sample[0]
                for k in range(slicesize):
                    if c+k < len(grid[r2]):
                        grid[r2][c+k] = src[k % len(src)] if src else " "
        return col - length, row

    elif direction == "S":
        sample = []
        for r2 in range(rows):
            if r2 == row:
                sample = grid[r2][col:col+slicesize]
                break
        if not sample:
            sample = [" "] * slicesize
        end_row = min(rows - 1, row + length)
        for r2 in range(row, end_row + 1):
            while len(grid[r2]) < col + slicesize:
                grid[r2].append(" ")
            for k in range(slicesize):
                grid[r2][col+k] = sample[k % len(sample)]
        return col, end_row

    elif direction == "N":
        sample = grid[row][col:col+slicesize] if row < rows else [" "]*slicesize
        end_row = max(0, row - length)
        for r2 in range(end_row, row + 1):
            while len(grid[r2]) < col + slicesize:
                grid[r2].append(" ")
            for k in range(slicesize):
                grid[r2][col+k] = sample[k % len(sample)]
        return col, end_row

    return col, row


def parse_ops(ops_str):
    ops = []
    for token in ops_str.strip().split():
        # formats: col,row:DIR:LEN:SLICE  or  DIR:LEN:SLICE  or  DIR:LEN
        m = re.match(r'^(?:(\d+),(\d+):)?([EWNS]):(\d+)(?::(\d+))?$', token, re.I)
        if not m:
            print(f"⚠ Skipping unrecognised op: {token}", file=sys.stderr)
            continue
        col  = int(m.group(1)) if m.group(1) else None
        row  = int(m.group(2)) if m.group(2) else None
        dire = m.group(3).upper()
        leng = int(m.group(4))
        slc  = int(m.group(5)) if m.group(5) else 2
        ops.append((col, row, dire, leng, slc))
    return ops


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("--ops",  required=True, help="space-separated smear ops")
    p.add_argument("--out",  default=None)
    args = p.parse_args()

    text = Path(args.input).read_text()
    grid, w, h = parse_grid(text)

    # cursor starts at middle
    cur_col, cur_row = w // 2, h // 2

    for (col, row, dire, leng, slc) in parse_ops(args.ops):
        if col is not None: cur_col = col
        if row is not None: cur_row = row
        cur_col, cur_row = smear_op(grid, cur_col, cur_row, dire, leng, slc)

    out = grid_to_text(grid)
    if args.out:
        Path(args.out).write_text(out)
        lines = out.splitlines()
        actual_w = max((len(l) for l in lines), default=0)
        print(f"→ {args.out}  ({actual_w}w x {len(lines)}h)")
    else:
        print(out)
