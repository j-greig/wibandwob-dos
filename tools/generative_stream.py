#!/usr/bin/env python3
"""
Generative Lab stream — pipe-friendly output for WibWob-DOS TUI.

Usage:
  python3 generative_stream.py --width 80 --height 30 [options]

Options:
  --seed N          Random seed (default: random)
  --preset NAME     Preset name (default: game-of-life)
  --list-presets    Print preset names and exit
  --max-ticks N     Stop after N ticks (default: 2000)
  --snapshot FILE   Save snapshot YAML to file on completion

Streams frames separated by \\x1E (record separator).
Each frame starts with a STATUS: header line.
"""

import sys
import os
import time
import random
import json
import argparse

sys.path.insert(0, os.path.dirname(__file__))
from generative_engine import (
    Engine, PRESETS, PRESET_LIST, random_preset
)

RS = '\x1E'


def parse_stamp_arg(s: str) -> dict:
    """Parse stamp arg: PATH:X:Y[:locked|seeded] or @TEXTFILE:X:Y[:locked|seeded]"""
    parts = s.split(':')
    if len(parts) < 3:
        print(f"Bad stamp format: {s} (need PATH:X:Y[:locked|seeded])", file=sys.stderr)
        sys.exit(1)
    path = parts[0]
    x, y = int(parts[1]), int(parts[2])
    locked = True
    if len(parts) >= 4 and parts[3] == 'seeded':
        locked = False
    return {'path': path, 'x': x, 'y': y, 'locked': locked}


def stream(width, height, seed, preset_name, max_ticks, snapshot_file,
           stamps=None, stamp_stdin=False):
    if preset_name == 'random':
        preset = random_preset(random.Random(seed))
    else:
        preset = PRESETS.get(preset_name)
        if not preset:
            print(f"Unknown preset: {preset_name}", file=sys.stderr)
            print(f"Available: {', '.join(PRESET_LIST)}", file=sys.stderr)
            sys.exit(1)

    stamp_list = stamps or []

    # Read stamps from stdin if requested (JSON array)
    if stamp_stdin and not sys.stdin.isatty():
        try:
            data = sys.stdin.read()
            if data.strip():
                stamp_list.extend(json.loads(data))
        except json.JSONDecodeError as e:
            print(f"Bad stamp JSON on stdin: {e}", file=sys.stderr)

    engine = Engine(width, height, seed, preset, stamps=stamp_list)
    tick_s = preset.tick_ms / 1000.0

    frame_count = 0
    while not engine.done and engine.tick < max_ticks:
        changed = engine.step()
        if changed:
            frame_count += 1
            lines = engine.render()
            status = engine.status_text()
            print(f"STATUS:{preset.name}|seed:{seed}|{status}")
            for ln in lines:
                print(ln)
            sys.stdout.flush()
            sys.stdout.write(RS)
            sys.stdout.flush()
            time.sleep(tick_s)

    # Final frame
    lines = engine.render()
    status = engine.status_text()
    print(f"STATUS:{preset.name}|seed:{seed}|{status}")
    for ln in lines:
        print(ln)
    sys.stdout.flush()

    # Save snapshot
    if snapshot_file:
        snap = engine.snapshot()
        snap['output_lines'] = len(lines)
        import yaml
        os.makedirs(os.path.dirname(snapshot_file) or '.', exist_ok=True)
        with open(snapshot_file, 'w') as f:
            yaml.dump(snap, f, default_flow_style=False, sort_keys=False)
            f.write('\n# ── rendered output ──\noutput: |\n')
            for ln in lines:
                f.write(f'  {ln}\n')
        print(f"SNAPSHOT:{snapshot_file}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description='Generative Lab stream')
    parser.add_argument('--width', type=int, default=80)
    parser.add_argument('--height', type=int, default=30)
    parser.add_argument('--seed', type=int, default=None)
    parser.add_argument('--preset', type=str, default='game-of-life')
    parser.add_argument('--max-ticks', type=int, default=2000)
    parser.add_argument('--snapshot', type=str, default=None)
    parser.add_argument('--stamp', type=str, action='append', default=[],
                        help='Stamp: PATH:X:Y[:locked|seeded] (repeatable)')
    parser.add_argument('--stamp-stdin', action='store_true',
                        help='Read stamps as JSON array from stdin')
    parser.add_argument('--list-presets', action='store_true')
    args = parser.parse_args()

    if args.list_presets:
        for name in PRESET_LIST:
            p = PRESETS[name]
            print(f"  {name:20s}  {p.substrate:10s}  {p.name}")
        print(f"  {'random':20s}  {'???':10s}  New rules every run")
        return

    seed = args.seed if args.seed is not None else random.randint(0, 99999)
    stamps = [parse_stamp_arg(s) for s in args.stamp]
    stream(args.width, args.height, seed, args.preset, args.max_ticks,
           args.snapshot, stamps=stamps, stamp_stdin=args.stamp_stdin)


if __name__ == '__main__':
    main()
