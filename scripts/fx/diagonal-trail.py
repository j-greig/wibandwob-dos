#!/usr/bin/env python3
"""
diagonal-trail.py — DVD ghost trail, never clears, diagonal accumulation.

The art stamps itself at diagonal offsets each frame, overlaid on the
persistent canvas. Characters accumulate — nothing is ever erased.
The form drifts and multiplies, leaving ghosted diagonal echoes.

Usage:
  python3 scripts/fx/diagonal-trail.py [options]

Options:
  --source FILE     ASCII art source (default: random jgs)
  --window ID       TUI window id to write into (default: 5)
  --dx N            horizontal step per frame (default: 3)
  --dy N            vertical step per frame (default: 1)
  --steps N         frames to run (default: 0 = infinite)
  --delay SECS      sleep between frames (default: 0.08)
  --canvas-w N      canvas width (default: 110)
  --canvas-h N      canvas height (default: 60)
  --wrap            wrap position when it exits canvas (default: True)
  --no-wrap         don't wrap — stop at edge
"""
import argparse, subprocess, sys, time, random
from pathlib import Path

def load_art(path):
    lines = [l for l in Path(path).read_text().splitlines() if not l.startswith('#')]
    # strip trailing empty lines
    while lines and not lines[-1].strip():
        lines.pop()
    return lines

def overlay(canvas, art, cx, cy, cw, ch):
    """Stamp art onto canvas at (cx,cy). Spaces are transparent."""
    for r, line in enumerate(art):
        cr = cy + r
        if 0 <= cr < ch:
            row = canvas[cr]
            for col, ch_char in enumerate(line):
                wcol = cx + col
                if 0 <= wcol < cw and ch_char != ' ':
                    row[wcol] = ch_char

def emit(canvas, ch):
    """Render canvas as string, cropped to ch rows."""
    return '\n'.join(''.join(row).rstrip() for row in canvas[:ch])

def write_to_window(text, win_id):
    proc = subprocess.run(
        ['bun', 'run', 'src/cli/wibwob.ts', 'write', str(win_id)],
        input=text.encode(),
        capture_output=True,
        cwd='/Users/james/Repos/wibandwob-dos'
    )
    return proc.returncode == 0

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', default='')
    p.add_argument('--window', type=int, default=5)
    p.add_argument('--dx', type=int, default=3)
    p.add_argument('--dy', type=int, default=1)
    p.add_argument('--steps', type=int, default=0)
    p.add_argument('--delay', type=float, default=0.08)
    p.add_argument('--canvas-w', type=int, default=110)
    p.add_argument('--canvas-h', type=int, default=55)
    p.add_argument('--wrap', action='store_true', default=True)
    p.add_argument('--no-wrap', dest='wrap', action='store_false')
    args = p.parse_args()

    JGS_DIR = Path('/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples')

    # Pick source
    if args.source:
        src = Path(args.source)
    else:
        candidates = list(JGS_DIR.glob('*.txt'))
        src = random.choice(candidates)

    art = load_art(src)
    art_h = len(art)
    art_w = max(len(l) for l in art) if art else 0

    CW, CH = args.canvas_w, args.canvas_h
    canvas = [[' '] * CW for _ in range(CH)]

    print(f"=== DIAGONAL TRAIL ===", file=sys.stderr)
    print(f"  source: {src.name}  {art_w}x{art_h}", file=sys.stderr)
    print(f"  canvas: {CW}x{CH}  dx={args.dx} dy={args.dy}  steps={args.steps or '∞'}", file=sys.stderr)
    print(f"  window: {args.window}", file=sys.stderr)

    cx, cy = 0, 0
    frame = 0
    infinite = args.steps == 0

    try:
        while True:
            # Stamp at current position (with wrap)
            if args.wrap:
                stamp_x = cx % CW
                stamp_y = cy % CH
            else:
                stamp_x = cx
                stamp_y = cy

            overlay(canvas, art, stamp_x, stamp_y, CW, CH)

            text = emit(canvas, CH)
            write_to_window(text, args.window)

            time.sleep(args.delay)

            cx += args.dx
            cy += args.dy
            frame += 1

            if not infinite and frame >= args.steps:
                break

            # Stop if no-wrap and both axes have exited
            if not args.wrap and (stamp_x >= CW or stamp_y >= CH):
                break

    except KeyboardInterrupt:
        pass

    print(f"=== done. {frame} frames ===", file=sys.stderr)

if __name__ == '__main__':
    main()
