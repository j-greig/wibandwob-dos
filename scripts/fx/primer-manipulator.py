#!/usr/bin/env python3
"""
primer-manipulator.py — Creative primer transformations for WibWob-DOS.

Opens a notepad and applies 6 distinct transformations to a set of primers,
each shown with different colour/animation treatments.

Transformations:
  1. RAINBOW WAVE    — sinusoidal hue shift across rows, cycles over time
  2. GLITCH SLICE    — random horizontal slice offsets per row
  3. DITHER DOWN     — reduce art to block chars by density threshold
  4. VERTICAL STRETCH — tile vertically to fill canvas height
  5. MIRROR KALEIDO  — tile art left/right and top/bottom (4 quadrants)
  6. TYPEWRITER REVEAL — progressive line-by-line reveal
  7. PULSE GLOW      — background pulses between dark and theme colour

Each transformation gets a figlet label + 2 blank lines after plain text.

Usage:
  python3 scripts/fx/primer-manipulator.py [canvas_w] [canvas_h] [steps_per_transform]

Examples:
  python3 scripts/fx/primer-manipulator.py 240 60 60    # 240x60, 6s per transform
  python3 scripts/fx/primer-manipulator.py 200 50 40    # smaller, faster
"""

import argparse
import math
import random
import subprocess
import sys
import time
import urllib.request
import json as _json
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

PRIMER_DIR = Path.home() / "Repos/wibwob-zine-moodboard/microapps-private/wibwob-primers/primers"

PRIMERS = [
    "star-face.txt",
    "the-scream.txt",
    "plantoid-flower-power.txt",
    "castle-tower-3d-cube.txt",
    "cat-rainbow-factory.txt",
    "wibwob-portrait-1.txt",
    "wibble-family.txt",
]

# Dark pastel palette
BG = (30, 30, 46)
FG_BASE = (205, 214, 244)
FG_ACCENT = (137, 180, 250)  # blue
FG_PINK = (243, 139, 168)
FG_GREEN = (166, 227, 161)
FG_YELLOW = (249, 226, 175)
FG_MAUVE = (203, 166, 247)
FG_PEACH = (255, 189, 133)

RAINBOW = [FG_BASE, FG_PINK, FG_PEACH, FG_YELLOW, FG_GREEN, FG_BLUE := FG_ACCENT, FG_MAUVE]

API_BASE = "http://127.0.0.1:8100"


# ── API helpers ───────────────────────────────────────────────────────────────

def api_get(path):
    with urllib.request.urlopen(f"{API_BASE}{path}", timeout=4) as r:
        return _json.loads(r.read())

def api_post(path, body):
    data = _json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}", data=data,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=6) as r:
        return _json.loads(r.read())

def get_desktop():
    h = api_get("/health")
    return int(h["screen"]["width"]), int(h["screen"]["height"])

def open_notepad():
    r = api_post("/commands/run", {"id": "microapp.wibwob.notepad.open", "args": {}})
    if not r.get("ok"):
        return None
    time.sleep(0.35)
    state = api_get("/state")
    for w in state.get("windows", []):
        if (w.get("details") or {}).get("appType") == "wibwob.notepad":
            return w["id"]
    return None

def centre_and_resize(wid, win_w, win_h):
    sw, sh = get_desktop()
    cx = max(0, (sw - win_w) // 2)
    cy = max(0, (sh - win_h) // 2)
    api_post("/windows/batch", {
        "ops": [{"id": wid, "left": cx, "top": cy, "width": win_w, "height": win_h}]
    })

def write_text(wid, text):
    api_post("/commands/run", {
        "id": "microapp.wibwob.notepad.write",
        "args": {"windowId": wid, "text": text}
    })

def figlet(text, font="standard", width=0):
    args = ["figlet", "-f", font]
    if width > 0:
        args += ["-w", str(width)]
    args.append(text)
    r = subprocess.run(args, capture_output=True, text=True)
    return r.stdout


# ── Art loading ───────────────────────────────────────────────────────────────

def load_art(name):
    path = PRIMER_DIR / name
    if not path.exists():
        return []
    lines = [l.rstrip("\n\r") for l in path.read_text().splitlines()]
    lines = [l for l in lines if l and not l.startswith("#")]
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def crop_to(lines, max_w, max_h=None):
    """Crop art to fit within max_w columns and max_h rows."""
    lines = [l[:max_w] for l in lines]
    if max_h:
        lines = lines[:max_h]
    return lines


def tile_h(lines, target_w):
    """Tile art horizontally to fill target_w."""
    if not lines:
        return lines
    art_w = max(len(l) for l in lines)
    repeats = (target_w // art_w) + 2
    return [l * repeats for l in lines]


# ── ANSI rendering helpers ────────────────────────────────────────────────────

def ansi_fg(r, g, b):
    return f"\x1b[38;2;{r};{g};{b}m"

def ansi_bg(r, g, b):
    return f"\x1b[48;2;{r};{g};{b}m"

RESET = "\x1b[0m"


def render_plain(lines, cw):
    """Plain text, cropped to cw."""
    return "\n".join(l[:cw] for l in lines)

def render_bg(lines, bg_rgb, cw):
    """Solid background, art chars in fg_base."""
    br, bg, bb = bg_rgb
    fr, fg, fb = FG_BASE
    out = [ansi_bg(br, bg, bb) + ansi_fg(fr, fg, fb) + l[:cw] + RESET for l in lines]
    return "\n".join(out)

def render_rainbow_wave(lines, frame, cw):
    """Rainbow hue shifts across rows over time."""
    rows = len(lines)
    out = []
    for ri, line in enumerate(lines):
        # Hue cycles per row, shifts over time
        t = (ri / max(1, rows) + frame * 0.03) % 1.0
        idx = int(t * len(RAINBOW)) % len(RAINBOW)
        r, g, b = RAINBOW[idx]
        out.append(ansi_bg(*BG) + ansi_fg(r, g, b) + line[:cw] + RESET)
    return "\n".join(out)

def render_glitch_slice(lines, seed, cw):
    """Rows randomly offset horizontally — each row at a different shift."""
    rng = random.Random(seed)
    out = []
    for line in lines:
        offset = rng.randint(-4, 4)
        shifted = " " * max(0, offset) + line + " " * max(0, -offset)
        out.append(shifted[:cw])
    return "\n".join(out)

def render_glitch_animated(lines, frame, cw):
    """Glitch effect that changes each frame."""
    rng = random.Random(frame)
    out = []
    for line in lines:
        if rng.random() > 0.6:
            offset = rng.randint(-3, 3)
            shifted = " " * max(0, offset) + line + " " * max(0, -offset)
            line = shifted
        out.append(line[:cw])
    return "\n".join(out)

def render_dither(lines, threshold, cw):
    """Reduce art to density: '#' for dense, '@' medium, '+' light, '·' sparse."""
    chars = " ·+@#"
    out = []
    for line in lines:
        row = ""
        for ch in line[:cw]:
            density = sum(1 for c in line if c not in " ·\t")
            filled = ch not in " ·\t"
            if not filled:
                idx = 1
            else:
                idx = min(4, 1 + int((density / max(1, len(line))) * 3))
            row += ansi_bg(*BG) + ansi_fg(*FG_BASE) + chars[idx]
        out.append(row + RESET)
    return "\n".join(out)

def render_density_color(lines, cw):
    """Each char coloured by density — darker chars = deeper blue, sparse = pink."""
    out = []
    for line in lines:
        row = ""
        for ch in line[:cw]:
            filled = ch not in " ·\t"
            if not filled:
                row += ansi_bg(*BG) + ansi_fg(*FG_BASE) + " "
            else:
                # Vary from blue to pink based on position
                t = (line.index(ch) / max(1, len(line))) % 1.0
                r = int(137 + t * 106)
                g = int(180 - t * 41)
                b = int(250 - t * 82)
                row += ansi_bg(*BG) + ansi_fg(r, g, b) + ch
        out.append(row + RESET)
    return "\n".join(out)

def render_vertical_tile(lines, target_h, cw):
    """Tile art vertically to fill target_h rows."""
    if not lines:
        return ""
    art_h = len(lines)
    repeats = (target_h // art_h) + 2
    tiled = (lines * repeats)[:target_h]
    return "\n".join(l[:cw] for l in tiled)

def render_kaleido(lines, cw, ch):
    """4-quadrant kaleidoscope: original + h-flip + v-flip + both."""
    if not lines:
        return ""
    half_h = ch // 2
    half_w = cw // 2
    top = [l[:half_w] for l in lines[:half_h]]
    top_rev = [l[:half_w][::-1] for l in lines[:half_h]]
    bot = [l[:half_w] for l in lines[half_h:half_h*2] if l]
    bot_rev = [l[:half_w][::-1] for l in lines[half_h:half_h*2] if l]

    def pad_row(row, w):
        return (row + " " * w)[:w]

    out = []
    for t, tr in zip(top, top_rev):
        out.append(pad_row(t, half_w) + pad_row(tr, half_w))
    for b, br in zip(bot, bot_rev):
        out.append(pad_row(b, half_w) + pad_row(br, half_w))
    return "\n".join(out)

def render_typewriter(lines, reveal_count, cw):
    """Reveal lines one by one, dimming what's not yet revealed."""
    shown = lines[:reveal_count]
    hidden = lines[reveal_count:]
    out = []
    for line in shown:
        out.append(line[:cw])
    for line in hidden:
        dim = "".join("·" if c not in " ·\t" else " " for c in line[:cw])
        out.append(dim)
    return "\n".join(out)

def render_pulse_bg(lines, frame, cw):
    """Background pulses between dark and accent, text stays bright."""
    t = (math.sin(frame * 0.15) + 1) / 2  # 0-1
    br = int(BG[0] + t * (FG_ACCENT[0] - BG[0]))
    bg_c = int(BG[1] + t * (FG_ACCENT[1] - BG[1]))
    bb = int(BG[2] + t * (FG_ACCENT[2] - BG[2]))
    out = [ansi_bg(br, bg_c, bb) + ansi_fg(*FG_BASE) + l[:cw] + RESET for l in lines]
    return "\n".join(out)

def render_vertical_gradient(lines, cw):
    """Foreground colour shifts from blue to pink top-to-bottom."""
    rows = len(lines)
    out = []
    for ri, line in enumerate(lines):
        t = ri / max(1, rows - 1)
        r = int(FG_BASE[0] + t * (FG_PINK[0] - FG_BASE[0]))
        g = int(FG_BASE[1] + t * (FG_PINK[1] - FG_BASE[1]))
        b = int(FG_BASE[2] + t * (FG_PINK[2] - FG_BASE[2]))
        out.append(ansi_bg(*BG) + ansi_fg(r, g, b) + line[:cw] + RESET)
    return "\n".join(out)

def render_sparkle(lines, frame, cw):
    """Random chars sparkle bright white each frame."""
    rng = random.Random(frame)
    out = []
    for line in lines:
        row = ""
        for ch in line[:cw]:
            if ch not in " ·\t" and rng.random() > 0.85:
                row += ansi_bg(*BG) + ansi_fg(255, 255, 255) + ch
            else:
                row += ansi_bg(*BG) + ansi_fg(*FG_BASE) + ch
        out.append(row + RESET)
    return "\n".join(out)


# ── Section builder ──────────────────────────────────────────────────────────

def section(title, render_fn, cw, ch, **kwargs):
    """Build a labelled section: figlet label + 2 blanks + rendered art."""
    label = figlet(title, font="smslant", width=cw)
    art = render_fn(**kwargs)
    return f"\n{label}\n\n{art}"


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--canvas-w", type=int, default=240)
    p.add_argument("--canvas-h", type=int, default=60)
    p.add_argument("--steps", type=int, default=60, help="frames per transform")
    p.add_argument("--fps", type=float, default=8)
    p.add_argument("--pause", type=float, default=1.5, help="seconds between transforms")
    p.add_argument("--cycle", action="store_true", default=False, help="loop forever")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--rainbow-art", default=None, help="override art for RAINBOW WAVE (e.g. starry-night.txt)")
    args = p.parse_args()

    cw, ch = args.canvas_w, args.canvas_h
    delay = 1.0 / args.fps

    if args.seed is not None:
        random.seed(args.seed)

    # Open and size notepad
    print("Opening notepad...", file=sys.stderr)
    wid = open_notepad()
    if wid is None:
        print("Failed to open notepad", file=sys.stderr)
        sys.exit(1)
    centre_and_resize(wid, cw, ch)
    time.sleep(0.3)

    print(f"Canvas: {cw}x{ch}  {args.steps} steps x {args.fps}fps", file=sys.stderr)
    print(f"Primers: {PRIMERS}", file=sys.stderr)

    # Collect all art
    all_art = {name: crop_to(load_art(name), cw, None) for name in PRIMERS}

    # ── Transform definitions ────────────────────────────────────────────────
    rainbow_art = args.rainbow_art or "star-face.txt"
    rainbow_lines = crop_to(all_art.get(rainbow_art, all_art["star-face.txt"]), cw, None)

    TRANSFORMS = [
        ("RAINBOW WAVE",
         lambda f, rl=rainbow_lines: render_rainbow_wave(rl, f, cw)),
        ("GLITCH SLICE",
         lambda f: render_glitch_animated(
             crop_to(all_art["the-scream.txt"], cw, None), f, cw)),
        ("DENSITY COLOR",
         lambda f: render_density_color(
             crop_to(all_art["plantoid-flower-power.txt"], cw, None), cw)),
        ("VERTICAL TILE",
         lambda f: render_vertical_tile(
             crop_to(all_art["castle-tower-3d-cube.txt"], cw, None), ch, cw)),
        ("KALEIDOSCOPE",
         lambda f: render_kaleido(
             crop_to(all_art["cat-rainbow-factory.txt"], cw//2, ch//2), cw, ch)),
        ("PULSE GLOW",
         lambda f: render_pulse_bg(
             crop_to(all_art["wibwob-portrait-1.txt"], cw, None), f, cw)),
        ("SPARKLE",
         lambda f: render_sparkle(
             crop_to(all_art["wibble-family.txt"], cw, None), f, cw)),
        ("V-GRADIENT",
         lambda f: render_vertical_gradient(
             crop_to(all_art["star-face.txt"], cw, None), cw)),
    ]

    def build_page(title, art_text):
        """Compose a full canvas: dark-pastel bg, figlet label, art below."""
        label_raw = figlet(title, font="standard", width=cw)
        label_block = [
            ansi_bg(*BG) + ansi_fg(*FG_PINK) + l.ljust(cw)[:cw] + RESET
            for l in label_raw.splitlines()
        ]
        canvas = [" " * cw for _ in range(ch)]
        y = 0
        for l in label_block:
            if y < ch:
                canvas[y] = l
                y += 1
        y += 1  # blank gap after label
        for l in art_text.split("\n"):
            if y < ch:
                canvas[y] = l.ljust(cw)[:cw]
                y += 1
        return "\n".join(canvas)

    frame = 0
    epochs = 1 if not args.cycle else 9999

    try:
        for epoch in range(epochs):
            for title, renderer in TRANSFORMS:
                write_text(wid, build_page(title, renderer(frame)))

                for step in range(args.steps):
                    frame += 1
                    write_text(wid, build_page(title, renderer(frame)))
                    time.sleep(delay)

                time.sleep(args.pause)

    except KeyboardInterrupt:
        pass

    # Final: 2x2 composite of 4 primers
    print(f"\nFinal composition ({frame} frames)...", file=sys.stderr)
    half_w = cw // 2
    half_h = ch // 2
    canvas = [[" ", " "] * half_w for _ in range(ch)]
    for pi, name in enumerate(PRIMERS[:4]):
        x_off = (pi % 2) * half_w
        y_off = (pi // 2) * half_h
        art = crop_to(all_art[name], half_w, half_h)
        for ri, line in enumerate(art):
            y = y_off + ri
            if y < ch:
                row = list(canvas[y])
                for ci, c in enumerate(line):
                    x = x_off + ci
                    if x < cw:
                        row[x] = c
                canvas[y] = "".join(row)
    write_text(wid, "\n".join("".join(row) for row in canvas))
    print(f"Done. frame={frame}", file=sys.stderr)


if __name__ == "__main__":
    main()
