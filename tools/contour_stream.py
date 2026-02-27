#!/usr/bin/env python3
"""
Contour map stream mode — pipe-friendly output for WibWob-DOS TUI.

Usage:
  python3 contour_stream.py --width 80 --height 30 [options]

Options:
  --seed N          Random seed (default: random)
  --terrain NAME    Terrain type (default: meadow)
  --levels N        Contour levels (default: 5)
  --grow            Animated grow mode (frames separated by \\x1E)
  --triptych        Three panels side by side
  --list-terrains   Print terrain names and exit

Static mode:  prints lines to stdout, exits.
Grow mode:    prints frames separated by \\x1E (record separator), exits when done.
"""

import sys
import os
import time
import random
import argparse

# Import engine from scratch/contour_tui.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scratch'))
from contour_tui import (
    TERRAINS, generate, generate_triptych, GrowState,
    TICK_INTERVAL, render_from_hills,
    generate_ordered, generate_hybrid
)

RS = '\x1E'  # ASCII record separator — frame delimiter


def find_terrain_idx(name: str) -> int:
    name_lower = name.lower().replace('-', ' ').replace('_', ' ')
    for i, (tname, _) in enumerate(TERRAINS):
        if tname.lower() == name_lower:
            return i
    # partial match
    for i, (tname, _) in enumerate(TERRAINS):
        if name_lower in tname.lower():
            return i
    return 5  # meadow fallback


def stream_static(width, height, seed, terrain_idx, levels, triptych,
                   mode='chaos', order_ratio=0.5):
    """Generate and dump a single frame."""
    tname = TERRAINS[terrain_idx][0].upper()

    if mode in ('order', 'order-spread'):
        lines = generate_ordered(width, height, seed, terrain_idx)
        label = f"ORDER:{tname}" if mode == 'order' else f"ORDER+:{tname}"
    elif mode == 'hybrid':
        lines = generate_hybrid(width, height, levels, seed, terrain_idx, order_ratio)
        label = f"HYBRID:{tname} {int(order_ratio*100)}%"
    elif triptych:
        lines = generate_triptych(width, height, levels, seed, terrain_idx)
        label = tname
    else:
        lines = generate(width, height, levels, seed, terrain_idx)
        label = tname

    # Header line for status bar parsing
    print(f"STATUS:{label}|seed:{seed}|levels:{levels}|STATIC")
    for ln in lines:
        print(ln)
    sys.stdout.flush()


def stream_grow(width, height, seed, terrain_idx, levels,
                mode='chaos', order_ratio=0.5):
    """Stream grow animation frames separated by RS."""
    gs = GrowState(width, height, levels, seed, terrain_idx,
                   mode=mode, order_ratio=order_ratio)
    tname = TERRAINS[terrain_idx][0].upper()
    mode_label = {'chaos': '', 'order': 'ORDER:', 'hybrid': f'HYBRID:{int(order_ratio*100)}% '}

    frame_count = 0
    while not gs.done:
        changed = gs.step()
        if changed:
            frame_count += 1
            lines = gs.get_lines()
            # Status line
            status = gs.status_text()
            prefix = mode_label.get(mode, '')
            print(f"STATUS:{prefix}{tname}|seed:{seed}|levels:{levels}|{status}")
            for ln in lines:
                print(ln)
            sys.stdout.flush()
            # Frame separator
            sys.stdout.write(RS)
            sys.stdout.flush()
            time.sleep(TICK_INTERVAL)

    # Final frame (no trailing RS — signals done)
    lines = gs.get_lines()
    status = gs.status_text()
    prefix = mode_label.get(mode, '')
    print(f"STATUS:{prefix}{tname}|seed:{seed}|levels:{levels}|{status}")
    for ln in lines:
        print(ln)
    sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(description='Contour map stream for WibWob-DOS')
    parser.add_argument('--width', type=int, default=80)
    parser.add_argument('--height', type=int, default=30)
    parser.add_argument('--seed', type=int, default=None)
    parser.add_argument('--terrain', type=str, default='meadow')
    parser.add_argument('--levels', type=int, default=5)
    parser.add_argument('--grow', action='store_true')
    parser.add_argument('--triptych', action='store_true')
    parser.add_argument('--mode', choices=['chaos', 'order', 'order-spread', 'hybrid'], default='chaos')
    parser.add_argument('--order-ratio', type=float, default=0.5,
                        help='Hybrid mode: 0.0=all contours, 1.0=all grids')
    parser.add_argument('--list-terrains', action='store_true')
    args = parser.parse_args()

    if args.list_terrains:
        for name, _ in TERRAINS:
            print(name)
        return

    seed = args.seed if args.seed is not None else random.randint(0, 99999)
    terrain_idx = find_terrain_idx(args.terrain)

    if args.grow:
        stream_grow(args.width, args.height, seed, terrain_idx, args.levels,
                    args.mode, args.order_ratio)
    else:
        stream_static(args.width, args.height, seed, terrain_idx, args.levels,
                       args.triptych, args.mode, args.order_ratio)


if __name__ == '__main__':
    main()
