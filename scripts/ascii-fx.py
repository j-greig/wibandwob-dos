#!/usr/bin/env python3
"""
ascii-fx — ASCII art transition and effect engine.

Effects:
  stretch        pixel-stretch: original left, col X repeated rightward (Photoshop style)
  shear          each row shifted by row*skew cols — diagonal smear
  glitch         rows randomly offset/duplicated
  bloom          entropy bloom: high-density chars spread then decay each frame
  dissolve       braille dissolve: chars replaced by nearest Braille glyph at wipe edge
  collapse       character class collapse: chars simplify toward skeleton then blank
  scanline       CRT scanline roll: rows scroll at different phase offsets per frame
  stretch-south  horizontal stretch then turns 90° south — L-shape smear
  diagonal       45° diagonal wipe from bottom-left to top-right
  frames         generate N pixel-stretch frames as a wipe animation

Usage:
  python3 scripts/ascii-fx.py <input.txt> --fx stretch --col 40 [--out out.txt]
  python3 scripts/ascii-fx.py <input.txt> --fx shear   --skew 3
  python3 scripts/ascii-fx.py <input.txt> --fx glitch  --seed 7 --intensity 0.4
  python3 scripts/ascii-fx.py <input.txt> --fx bloom   --frame 3 --seeds 20
  python3 scripts/ascii-fx.py <input.txt> --fx dissolve --col 80
  python3 scripts/ascii-fx.py <input.txt> --fx collapse --frame 4
  python3 scripts/ascii-fx.py <input.txt> --fx scanline --frame 2 --skew 3
  python3 scripts/ascii-fx.py <input.txt> --fx frames  --steps 8 --outdir /tmp/frames/
"""

import argparse, random, unicodedata
from pathlib import Path

# ── helpers ───────────────────────────────────────────────────────────────────

DENSITY_RAMP = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$█▓▒░'

def density(ch: str) -> int:
    for i, c in enumerate(DENSITY_RAMP):
        if c == ch:
            return i
    return 0

def load(path: str):
    lines = Path(path).read_text().splitlines()
    w = max((len(l) for l in lines), default=0)
    return [l.ljust(w) for l in lines], w, len(lines)

def pad(line: str, width: int) -> str:
    return (line + " " * width)[:width]

def write(lines: list[str], path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("\n".join(lines))
    w = max(len(l) for l in lines) if lines else 0
    print(f"→ {path}  ({w}w x {len(lines)}h)")

# ── STRETCH ───────────────────────────────────────────────────────────────────

def fx_stretch(lines, w, h, col, slice_w=1, out_w=None):
    out_w = out_w or w
    result = []
    for line in lines:
        p = pad(line, col + slice_w)
        left = p[:col]
        tile = p[col:col + slice_w] or " "
        right_len = out_w - col
        right = (tile * (right_len // max(len(tile), 1) + 2))[:right_len]
        result.append(pad(left + right, out_w))
    return result

# ── SHEAR ─────────────────────────────────────────────────────────────────────

def fx_shear(lines, w, h, skew=2.0, out_w=None):
    out_w = out_w or w
    result = []
    for i, line in enumerate(lines):
        offset = int(i * skew) % max(w, 1)
        shifted = pad(line[offset:] + line[:offset], out_w)
        result.append(shifted)
    return result

# ── GLITCH ────────────────────────────────────────────────────────────────────

def fx_glitch(lines, w, h, seed=0, intensity=0.3, out_w=None):
    rng = random.Random(seed)
    out_w = out_w or w
    result = []
    for i in range(h):
        src = i
        if rng.random() < intensity:
            src = rng.randint(0, h - 1)
        offset = rng.randint(-12, 12) if rng.random() < intensity * 0.5 else 0
        line = lines[src]
        if offset > 0:
            shifted = " " * offset + line
        elif offset < 0:
            shifted = line[abs(offset):]
        else:
            shifted = line
        result.append(pad(shifted, out_w))
    return result

# ── ENTROPY BLOOM ─────────────────────────────────────────────────────────────
# frame 0: source. Each frame: N new bloom seeds spawn at high-density source chars.
# Bloomed cells step UP ramp each frame; decayed cells step DOWN. Source bleeds through decay.

def fx_bloom(lines, w, h, frame=1, seeds=15, seed=42, out_w=None):
    out_w = out_w or w
    rng = random.Random(seed)

    # build density grid from source
    src = [pad(l, out_w) for l in lines]

    # find high-density anchor positions from source
    anchors = []
    for r, line in enumerate(src):
        for c, ch in enumerate(line):
            if density(ch) > len(DENSITY_RAMP) * 0.5:
                anchors.append((r, c))
    if not anchors:
        anchors = [(h // 2, out_w // 2)]

    # bloom state: dict of (row,col) → bloom_level (0=source, >0=bloomed, <0=decayed/gone)
    state = {}

    for f in range(frame):
        # spawn new blooms at random anchors
        for _ in range(seeds):
            r, c = rng.choice(anchors)
            # scatter slightly
            r = max(0, min(h - 1, r + rng.randint(-2, 2)))
            c = max(0, min(out_w - 1, c + rng.randint(-3, 3)))
            if (r, c) not in state:
                state[(r, c)] = len(DENSITY_RAMP) - 1  # max bloom
        # spread bloom to neighbours
        new_state = {}
        for (r, c), level in state.items():
            new_state[(r, c)] = level
            if level > len(DENSITY_RAMP) * 0.6:
                for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
                    nr, nc = r+dr, c+dc
                    if 0 <= nr < h and 0 <= nc < out_w:
                        if (nr, nc) not in new_state:
                            new_state[(nr, nc)] = level - 3
        # decay all
        decayed = {}
        for (r, c), level in new_state.items():
            nl = level - 4
            if nl > 0:
                decayed[(r, c)] = nl
        state = decayed

    # render: bloomed cells override source
    result = []
    for r, line in enumerate(src):
        row = list(pad(line, out_w))
        for c in range(out_w):
            if (r, c) in state:
                level = min(state[(r, c)], len(DENSITY_RAMP) - 1)
                row[c] = DENSITY_RAMP[level]
        result.append("".join(row))
    return result

# ── BRAILLE DISSOLVE ──────────────────────────────────────────────────────────
# At the wipe column, replace chars with nearest Braille char (U+2800–U+28FF).
# Creates cellular noise zone between source and void.

BRAILLE_BASE = 0x2800
BRAILLE_CHARS = [chr(BRAILLE_BASE + i) for i in range(256)]

def to_braille(ch: str, rng: random.Random) -> str:
    d = density(ch)
    # map density to braille dot count (0-8 dots)
    dots = int(d / len(DENSITY_RAMP) * 8)
    # pick a braille char with approximately that many dots
    candidates = [c for c in BRAILLE_CHARS
                  if bin(ord(c) - BRAILLE_BASE).count('1') == dots]
    return rng.choice(candidates) if candidates else BRAILLE_CHARS[rng.randint(0, 255)]

def fx_dissolve(lines, w, h, col, zone=20, seed=42, out_w=None):
    out_w = out_w or w
    rng = random.Random(seed)
    result = []
    for line in lines:
        p = pad(line, out_w)
        row = list(p)
        for c in range(max(0, col - zone), min(out_w, col + zone)):
            dist = abs(c - col)
            prob = 1.0 - (dist / zone)
            if rng.random() < prob:
                row[c] = to_braille(row[c], rng)
        result.append("".join(row))
    return result

# ── CHARACTER CLASS COLLAPSE ──────────────────────────────────────────────────
# frame 0: source. Each frame, chars simplify toward representative per class.
# Classes: alpha→▓, punct→│, digit→█, space→space, other→░
# After N frames: near-blank skeleton.

CLASS_MAP = [
    (str.isalpha,  "▓"),
    (str.isdigit,  "█"),
    (lambda c: c in r'|/\─│┤├┼┬┴┐└┘┌', "│"),
    (lambda c: c in '.,;:!?', "·"),
    (lambda c: c in '()[]{}', "▒"),
    (lambda c: c == " ",      " "),
]

def collapse_char(ch: str, frame: int, rng: random.Random) -> str:
    if frame == 0 or rng.random() > (frame * 0.25):
        return ch
    for test, rep in CLASS_MAP:
        try:
            if test(ch):
                return rep
        except Exception:
            pass
    return "░"

def fx_collapse(lines, w, h, frame=2, seed=42, out_w=None):
    rng = random.Random(seed)
    out_w = out_w or w
    result = []
    for line in lines:
        p = pad(line, out_w)
        row = "".join(collapse_char(ch, frame, rng) for ch in p)
        result.append(row)
    return result

# ── SCANLINE ROLL ─────────────────────────────────────────────────────────────
# Each row scrolls at a different phase. frame N: row R shifts by (R * skew + frame) % w.
# Like a CRT with bad vertical sync — image rolls continuously.

def fx_scanline(lines, w, h, frame=0, skew=2, out_w=None):
    out_w = out_w or w
    result = []
    for i, line in enumerate(lines):
        phase = (i * skew + frame) % max(out_w, 1)
        p = pad(line, out_w)
        shifted = p[phase:] + p[:phase]
        result.append(pad(shifted, out_w))
    return result

# ── STRETCH-SOUTH ─────────────────────────────────────────────────────────────
# Horizontal stretch to col X for rows 0..turn_row, then turns 90° south:
# rows turn_row..end are filled entirely with the smear tile.

def fx_stretch_south(lines, w, h, col, turn_row=None, slice_w=1, out_w=None):
    out_w = out_w or w
    turn_row = turn_row if turn_row is not None else h // 2
    # sample tile from the turn row at col
    src_line = lines[min(turn_row, h-1)]
    p = pad(src_line, col + slice_w)
    tile = p[col:col + slice_w] or " "
    full_tile = (tile * (out_w // max(len(tile),1) + 2))[:out_w]
    result = []
    for i, line in enumerate(lines):
        if i < turn_row:
            result.append(fx_stretch(lines, w, h, col, slice_w, out_w)[i])
        else:
            result.append(full_tile)
    return result

# ── DIAGONAL ─────────────────────────────────────────────────────────────────
# 45° wipe from bottom-left to top-right.
# Row 0 (top): wipe col = out_w (all original). Row h-1 (bottom): wipe col = 0 (all smear).
# Cell aspect 2:1 — chars are 2x taller so true 45° needs col_per_row = out_w/h*2.

def fx_diagonal(lines, w, h, col, slice_w=1, out_w=None):
    out_w = out_w or w
    result = []
    for i, line in enumerate(lines):
        # wipe position moves left as we go down — bottom-left is all smear
        wipe_col = int(out_w - (i / max(h - 1, 1)) * out_w)
        wipe_col = max(0, min(out_w, wipe_col))
        result.append(fx_stretch([line], w, 1, wipe_col, slice_w, out_w)[0])
    return result

# ── FRAMES ────────────────────────────────────────────────────────────────────

def fx_frames(lines, w, h, steps=8, slice_w=1, out_w=None, outdir="/tmp/frames", stem="frame"):
    out_w = out_w or w
    for i in range(steps):
        col = max(1, int(i * w / max(steps - 1, 1)))
        result = fx_stretch(lines, w, h, col, slice_w, out_w)
        write(result, f"{outdir}/{stem}-f{i:02d}-col{col:03d}.txt")

# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("--fx",        default="stretch",
                   choices=["stretch","stretch-south","diagonal","shear","glitch","bloom","dissolve","collapse","scanline","frames"])
    p.add_argument("--col",       type=int,   default=None)
    p.add_argument("--slice",     type=int,   default=1)
    p.add_argument("--width",     type=int,   default=None)
    p.add_argument("--skew",      type=float, default=2.0)
    p.add_argument("--seed",      type=int,   default=42)
    p.add_argument("--intensity", type=float, default=0.3)
    p.add_argument("--frame",     type=int,   default=1)
    p.add_argument("--seeds",     type=int,   default=15,  help="bloom: new seeds per frame")
    p.add_argument("--zone",      type=int,   default=20,  help="dissolve: transition zone width")
    p.add_argument("--steps",     type=int,   default=8,   help="frames: how many frames")
    p.add_argument("--outdir",    default="/tmp/frames")
    p.add_argument("--out",       default=None)
    p.add_argument("--row",       type=int,   default=None, help="stretch-south: row where smear turns south")
    args = p.parse_args()

    lines, w, h = load(args.input)
    stem = Path(args.input).stem
    out_w = args.width

    match args.fx:
        case "stretch":
            col = args.col if args.col is not None else w // 2
            r = fx_stretch(lines, w, h, col, args.slice, out_w)
            write(r, args.out or f"/tmp/{stem}-stretch-c{col}.txt")
        case "shear":
            r = fx_shear(lines, w, h, args.skew, out_w)
            write(r, args.out or f"/tmp/{stem}-shear{args.skew}.txt")
        case "glitch":
            r = fx_glitch(lines, w, h, args.seed, args.intensity, out_w)
            write(r, args.out or f"/tmp/{stem}-glitch.txt")
        case "bloom":
            r = fx_bloom(lines, w, h, args.frame, args.seeds, args.seed, out_w)
            write(r, args.out or f"/tmp/{stem}-bloom-f{args.frame}.txt")
        case "dissolve":
            col = args.col if args.col is not None else w // 2
            r = fx_dissolve(lines, w, h, col, args.zone, args.seed, out_w)
            write(r, args.out or f"/tmp/{stem}-dissolve-c{col}.txt")
        case "collapse":
            r = fx_collapse(lines, w, h, args.frame, args.seed, out_w)
            write(r, args.out or f"/tmp/{stem}-collapse-f{args.frame}.txt")
        case "scanline":
            r = fx_scanline(lines, w, h, args.frame, int(args.skew), out_w)
            write(r, args.out or f"/tmp/{stem}-scanline-f{args.frame}.txt")
        case "stretch-south":
            col = args.col if args.col is not None else w // 2
            r = fx_stretch_south(lines, w, h, col, getattr(args,'row',None), args.slice, out_w)
            write(r, args.out or f"/tmp/{stem}-stretch-south-c{col}.txt")
        case "diagonal":
            col = args.col if args.col is not None else w // 2
            r = fx_diagonal(lines, w, h, col, args.slice, out_w)
            write(r, args.out or f"/tmp/{stem}-diagonal-c{col}.txt")
        case "frames":
            fx_frames(lines, w, h, args.steps, args.slice, out_w, args.outdir, stem)
