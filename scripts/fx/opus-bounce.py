#!/usr/bin/env python3
"""
opus-bounce.py — Words bounce independently, each in their own direction.

Each word from the source text becomes a free-flying entity.
They bounce off the canvas walls. After 3 bounces they freeze.
Per-word colour shifts through the smooth spectrum by bounce count —
words that have bounced more are further along the spectrum.

Usage:
  python3 scripts/fx/opus-bounce.py --canvas-w 240 --canvas-h 60 \
    --steps 300 --fps 12 --bounce-count 3

Options:
  --canvas-w N        canvas width (default: 240)
  --canvas-h N        canvas height (default: 60)
  --steps N            animation frames (default: 300)
  --fps N             frames per second (default: 12)
  --bounce-count N    bounces before word freezes (default: 3)
  --color-mode MODE   colour by: bounce | frame | x | y  (default: bounce)
  --speed N           pixels per frame (default: 2)
"""

import argparse
import math
import random
import subprocess
import sys
import time
import urllib.request
import json
from pathlib import Path

API_BASE = "http://127.0.0.1:8100"


# ── API helpers ────────────────────────────────────────────────────────────────

def api_get(path):
    with urllib.request.urlopen(f"{API_BASE}{path}", timeout=4) as r:
        return json.loads(r.read())

def api_post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}", data=data,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=6) as r:
        return json.loads(r.read())

def get_desktop():
    h = api_get("/health")
    return int(h["screen"]["width"]), int(h["screen"]["height"])

def find_latest_notepad():
    state = api_get("/state")
    notepads = [
        w for w in state.get("windows", [])
        if (w.get("details") or {}).get("appType") == "wibwob.notepad"
    ]
    return notepads[-1]["id"] if notepads else None


def open_and_center_notepad(win_w, win_h, wid=None):
    sw, sh = get_desktop()
    cx = max(0, (sw - win_w) // 2)
    cy = max(0, (sh - win_h) // 2)
    if wid is not None:
        api_post("/windows/batch", {
            "ops": [{"id": wid, "left": cx, "top": cy, "width": win_w, "height": win_h}]
        })
        return wid
    r = api_post("/commands/run", {"id": "microapp.wibwob.notepad.open", "args": {}})
    if not r.get("ok"):
        return None
    time.sleep(0.35)
    wid = find_latest_notepad()
    if wid is not None:
        api_post("/windows/batch", {
            "ops": [{"id": wid, "left": cx, "top": cy, "width": win_w, "height": win_h}]
        })
    return wid

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


# ── Colour: smooth true-spectrum ─────────────────────────────────────────────

BG = (30, 30, 46)
FG_BASE = (205, 214, 244)

def af(r, g, b):
    return f"\x1b[38;2;{int(r)};{int(g)};{int(b)}m"

def ab(r, g, b):
    return f"\x1b[48;2;{int(r)};{int(g)};{int(b)}m"

RESET = "\x1b[0m"


def spectrum(t):
    """Smooth continuous ROYGBIV via offset sine waves."""
    t = t % 1.0
    r_s = math.sin(t * 2 * math.pi) * 0.5 + 0.5
    g_s = math.sin((t + 1 / 3) * 2 * math.pi) * 0.5 + 0.5
    b_s = math.sin((t + 2 / 3) * 2 * math.pi) * 0.5 + 0.5
    return 50 + r_s * 205, 50 + g_s * 205, 80 + b_s * 175


def spectrum_pastel(t):
    """Softer pastel version."""
    t = t % 1.0
    r_s = math.sin(t * 2 * math.pi) * 0.5 + 0.5
    g_s = math.sin((t + 1 / 3) * 2 * math.pi) * 0.5 + 0.5
    b_s = math.sin((t + 2 / 3) * 2 * math.pi) * 0.5 + 0.5
    return 100 + r_s * 155, 100 + g_s * 155, 120 + b_s * 135


# ── Word entity ────────────────────────────────────────────────────────────────

class Word:
    def __init__(self, text, x, y, dx, dy, w, h):
        self.text = text
        self.x = x      # top-left x
        self.y = y      # top-left y
        self.dx = dx    # velocity x
        self.dy = dy    # velocity y
        self.w = w      # char width
        self.h = h      # char height
        self.bounces = 0
        self.frozen = False

    def step(self, cw, ch, max_bounces):
        if self.frozen:
            return False
        nx = self.x + self.dx
        ny = self.y + self.dy
        hit = False
        if nx < 0:
            nx = 0; self.dx = abs(self.dx); hit = True
        elif nx + self.w > cw:
            nx = cw - self.w; self.dx = -abs(self.dx); hit = True
        if ny < 0:
            ny = 0; self.dy = abs(self.dy); hit = True
        elif ny + self.h > ch:
            ny = ch - self.h; self.dy = -abs(self.dy); hit = True
        if hit:
            self.bounces += 1
            if self.bounces >= max_bounces:
                self.frozen = True
        self.x = nx
        self.y = ny
        return hit

    def colour(self, mode, frame, cw, ch, max_bounces):
        """Pick spectrum t based on colour mode — all modes use smooth continuous t."""
        if mode == "bounce":
            # Blend bounce count with fractional frame progress — smooth rainbow shift per bounce
            if self.frozen:
                t = self.bounces / max(1, max_bounces)  # locked once frozen
            else:
                t = (self.bounces + (frame % 30) / 30.0) / max(1, max_bounces)
        elif mode == "frame":
            t = (frame * 0.015) % 1.0  # continuous, ~67 frames per full cycle
        elif mode == "x":
            t = self.x / max(1, cw)
        elif mode == "y":
            t = self.y / max(1, ch)
        else:
            t = self.bounces / max(1, max_bounces)
        return spectrum(t)


# ── Canvas renderer ────────────────────────────────────────────────────────────

def render_canvas(words, cw, ch, frame, color_mode, max_bounces):
    """Render all words onto a canvas array with ANSI colours."""
    canvas = [[" " for _ in range(cw)] for _ in range(ch)]
    colour_map = [[None for _ in range(cw)] for _ in range(ch)]

    for w in words:
        r, g, b = w.colour(color_mode, frame, cw, ch, max_bounces)
        fg_code = af(r, g, b)
        for ry, line in enumerate(w.text.splitlines()):
            py = w.y + ry
            if 0 <= py < ch:
                for cx, ch2 in enumerate(line):
                    px = w.x + cx
                    if 0 <= px < cw and ch2 != " ":
                        canvas[py][px] = ch2
                        colour_map[py][px] = fg_code

    # Build output string — bg per char, fg only when colour changes
    out_lines = []
    bg_code = ab(*BG)
    for ry in range(ch):
        row_codes = colour_map[ry]
        row_chars = canvas[ry]
        parts = [bg_code]
        last_code = bg_code  # start with bg as "current"
        for cx in range(cw):
            code = row_codes[cx]
            ch2 = row_chars[cx]
            if code is not None and code != last_code:
                parts.append(code)
                last_code = code
            elif code is None and last_code != bg_code:
                parts.append(bg_code)
                last_code = bg_code
            parts.append(ch2)
        parts.append(RESET)
        out_lines.append("".join(parts))
    return "\n".join(out_lines)


# ── Load source text into words ───────────────────────────────────────────────

def load_words(source_path, cw, ch, speed, rng):
    """Parse source file into Word entities, each flying in a random direction."""
    raw = Path(source_path).read_text()
    # Extract non-empty, non-comment lines
    lines = [
        l.rstrip("\n\r")
        for l in raw.splitlines()
        if l.strip() and not l.startswith("#")
    ]

    # Flatten into individual words (keep line structure)
    words = []
    for line in lines:
        # Split into word chunks (preserve some spacing info)
        tokens = line.split()
        y = rng.randint(0, max(0, ch - 3))
        x = rng.randint(0, max(0, cw - 10))

        # Give each word a random angle + speed
        angle = rng.uniform(0, 2 * math.pi)
        dx = int(math.cos(angle) * speed)
        dy = int(math.sin(angle) * speed)
        if dx == 0 and dy == 0:
            dy = speed  # ensure it moves

        w = len(tokens[0]) if tokens else 5
        words.append(Word(tokens[0] if tokens else line[:5], x, y, dx, dy, w, 1))

        # Extra words per line for density
        for tok in tokens[1:]:
            x2 = rng.randint(0, max(0, cw - len(tok)))
            y2 = rng.randint(0, max(0, ch - 1))
            angle = rng.uniform(0, 2 * math.pi)
            dx = int(math.cos(angle) * speed)
            dy = int(math.sin(angle) * speed)
            if dx == 0 and dy == 0:
                dy = speed
            words.append(Word(tok, x2, y2, dx, dy, len(tok), 1))

    return words


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--canvas-w", type=int, default=240)
    p.add_argument("--canvas-h", type=int, default=60)
    p.add_argument("--steps", type=int, default=300)
    p.add_argument("--fps", type=float, default=12)
    p.add_argument("--bounce-count", type=int, default=3)
    p.add_argument("--speed", type=float, default=2.0)
    p.add_argument("--source",
        default="scripts/fx/opus-pulse.txt",
        help="source text file")
    p.add_argument("--color-mode",
        default="bounce",
        choices=["bounce", "frame", "x", "y"],
        help="bounce=colour by bounces, frame=colours shift over time, x=col left-to-right, y=col top-to-bottom")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--window-id", type=int, default=None, help="reuse existing notepad window by id")
    args = p.parse_args()

    cw, ch = args.canvas_w, args.canvas_h
    delay = 1.0 / args.fps
    rng = random.Random(args.seed or 42)

    # Open or reuse notepad
    print("Opening notepad...", file=sys.stderr)
    wid = open_and_center_notepad(cw, ch, args.window_id)
    if wid is None:
        print("Failed to open notepad", file=sys.stderr)
        sys.exit(1)
    time.sleep(0.3)
    print(f"Canvas: {cw}x{ch}  words=auto  bounces={args.bounce_count}  color={args.color_mode}", file=sys.stderr)

    # Load words
    words = load_words(args.source, cw, ch, args.speed, rng)
    print(f"Words: {len(words)}", file=sys.stderr)

    # Write initial header
    label = figlet("OPUS BOUNCE", font="standard", width=cw)
    header_lines = label.splitlines()
    header_canvas = []
    for ry in range(ch):
        if ry < len(header_lines):
            line = header_lines[ry].ljust(cw)[:cw]
        else:
            line = " " * cw
        header_canvas.append(line)

    frame = 0
    try:
        for frame in range(1, args.steps + 1):
            # Move + bounce words
            for w in words:
                w.step(cw, ch, args.bounce_count)

            # Render
            text = render_canvas(words, cw, ch, frame, args.color_mode, args.bounce_count)
            write_text(wid, text)
            time.sleep(delay)

    except KeyboardInterrupt:
        pass

    # Final render
    frozen_count = sum(1 for w in words if w.frozen)
    print(f"Done. frame={frame}  frozen={frozen_count}/{len(words)}", file=sys.stderr)
    write_text(wid, render_canvas(words, cw, ch, frame, args.color_mode, args.bounce_count))


if __name__ == "__main__":
    main()
