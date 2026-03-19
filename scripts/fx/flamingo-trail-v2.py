#!/usr/bin/env python3
"""
flamingo-trail-v2.py — ANSI-colour flamingo trail.

- Pink background in notepad
- Flamingo glyphs start white and drift pinker over time
- DVD-style bounce on by default
- Stops adding chars after bounce-count (window stays open)

Example:
  WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/flamingo-trail-v2.py \
    --source flamingo-0000-2.txt \
    --window-w 120 --window-h 60 \
    --canvas-w 120 --canvas-h 60 \
    --fps 10 --bounce-count 5 --steps 120
"""

import argparse
import json
import os
import random
import sys
import time
import urllib.request
from pathlib import Path

API_BASE = os.environ.get("WIBWOB_API", os.environ.get("WW_API", "http://127.0.0.1:8100"))
JGS_DIR = Path("/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples")


def api_get(path: str):
    try:
        with urllib.request.urlopen(f"{API_BASE}{path}", timeout=4) as r:
            return json.loads(r.read())
    except Exception:
        return None


def api_post(path: str, body: dict):
    try:
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{API_BASE}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=6) as r:
            return json.loads(r.read())
    except Exception:
        return None


def get_screen_size():
    h = api_get("/health")
    if h and isinstance(h.get("screen"), dict):
        return int(h["screen"].get("width", 120)), int(h["screen"].get("height", 60))
    return 120, 60


def find_latest_notepad_id():
    s = api_get("/state")
    if not s:
        return None
    ids = []
    for w in s.get("windows", []):
        if (w.get("details") or {}).get("appType") == "wibwob.notepad":
            ids.append(w["id"])
    return ids[-1] if ids else None


def open_notepad_sized(win_w: int, win_h: int):
    r = api_post("/commands/run", {"id": "microapp.wibwob.notepad.open", "args": {}})
    if not r or not r.get("ok"):
        return None
    time.sleep(0.35)
    wid = find_latest_notepad_id()
    if wid is None:
        return None
    api_post("/windows/batch", {"ops": [{"id": wid, "left": 0, "top": 0, "width": win_w, "height": win_h}]})
    return wid


def write_notepad(wid: int, text: str):
    return api_post("/commands/run", {
        "id": "microapp.wibwob.notepad.write",
        "args": {"windowId": wid, "text": text},
    }) is not None


def pick_source(source_arg: str):
    if source_arg:
        p = Path(source_arg)
        if p.exists():
            return p
        p2 = JGS_DIR / source_arg
        if p2.exists():
            return p2
        p3 = JGS_DIR / f"{source_arg}.txt"
        if p3.exists():
            return p3
        return None
    # default flamingo
    p = JGS_DIR / "flamingo-0000-2.txt"
    if p.exists():
        return p
    cands = [c for c in JGS_DIR.glob("*flamingo*.txt")]
    if cands:
        return random.choice(cands)
    cands = [c for c in JGS_DIR.glob("*.txt") if c.stat().st_size > 40]
    return random.choice(cands) if cands else None


def load_art(path: Path):
    lines = [ln.rstrip("\n\r") for ln in path.read_text().splitlines()]
    lines = [ln for ln in lines if ln and not ln.startswith("#")]
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def overlay(canvas, colour_idx, art, x, y, cw, ch, current_idx, add_chars=True):
    """Stamp art. New chars get current colour index; old chars keep their previous colour."""
    for r, line in enumerate(art):
        rr = y + r
        if rr < 0 or rr >= ch:
            continue
        row = canvas[rr]
        crow = colour_idx[rr]
        for c, ch2 in enumerate(line):
            cc = x + c
            if 0 <= cc < cw and ch2 not in (" ", "\t") and add_chars:
                row[cc] = ch2
                crow[cc] = current_idx


def bounce_step(x, y, dx, dy, cw, ch, aw, ah):
    nx = x + dx
    ny = y + dy
    bounced = False

    if nx < 0:
        nx = 0
        dx = abs(dx)
        bounced = True
    elif nx + aw > cw:
        nx = max(0, cw - aw)
        dx = -abs(dx)
        bounced = True

    if ny < 0:
        ny = 0
        dy = abs(dy)
        bounced = True
    elif ny + ah > ch:
        ny = max(0, ch - ah)
        dy = -abs(dy)
        bounced = True

    return nx, ny, dx, dy, bounced


def lerp(a, b, t):
    return int(a + (b - a) * t)


def render_ansi(canvas, colour_idx, palette, bg_rgb):
    """Render with solid pink background + per-cell foreground colours."""
    br, bg, bb = bg_rgb
    bg_code = f"\x1b[48;2;{br};{bg};{bb}m"
    reset = "\x1b[0m"

    out_lines = []
    for r, row in enumerate(canvas):
        idx_row = colour_idx[r]
        parts = [bg_code]
        last_idx = None
        for c, ch in enumerate(row):
            if ch == " ":
                parts.append(" ")
                continue
            idx = idx_row[c]
            if idx != last_idx:
                fr, fg, fb = palette[idx]
                parts.append(f"\x1b[38;2;{fr};{fg};{fb}m")
                last_idx = idx
            parts.append(ch)
        parts.append(reset)
        out_lines.append("".join(parts))
    return "\n".join(out_lines)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", default="")
    p.add_argument("--window-id", type=int, default=None)
    p.add_argument("--new-window", action="store_true", default=False, help="force opening a new notepad instead of reusing latest")
    p.add_argument("--dx", type=int, default=3)
    p.add_argument("--dy", type=int, default=2)
    p.add_argument("--x", type=int, default=0)
    p.add_argument("--y", type=int, default=0)
    p.add_argument("--steps", type=int, default=120)
    p.add_argument("--fps", type=float, default=10)
    p.add_argument("--delay", type=float, default=None)
    p.add_argument("--canvas-w", type=int, default=120)
    p.add_argument("--canvas-h", type=int, default=60)
    p.add_argument("--window-w", type=int, default=120)
    p.add_argument("--window-h", type=int, default=60)
    p.add_argument("--bounce", dest="bounce", action="store_true", default=True)
    p.add_argument("--no-bounce", dest="bounce", action="store_false")
    p.add_argument("--bounce-count", type=int, default=5)
    p.add_argument("--freeze-after", type=int, default=None)
    p.add_argument("--seed", type=int, default=None)
    args = p.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
    if args.freeze_after is not None:
        args.bounce_count = args.freeze_after

    delay = args.delay if args.delay is not None else (1.0 / args.fps)

    src = pick_source(args.source)
    if not src:
        print("No source art found", file=sys.stderr)
        sys.exit(1)

    art = load_art(src)
    if not art:
        print("Source art empty after filtering", file=sys.stderr)
        sys.exit(1)

    aw = max(len(l) for l in art)
    ah = len(art)

    sw, sh = get_screen_size()
    win_w = args.window_w or sw
    win_h = args.window_h or max(10, sh - 2)
    cw = args.canvas_w
    ch = args.canvas_h

    wid = args.window_id
    if wid is None:
        if args.new_window:
            wid = open_notepad_sized(win_w, win_h)
        else:
            wid = find_latest_notepad_id()
            if wid is not None:
                api_post("/windows/batch", {"ops": [{"id": wid, "left": 0, "top": 0, "width": win_w, "height": win_h}]})
            else:
                wid = open_notepad_sized(win_w, win_h)
        if wid is None:
            print("Could not open/reuse notepad window", file=sys.stderr)
            sys.exit(1)
    else:
        api_post("/windows/batch", {"ops": [{"id": wid, "left": 0, "top": 0, "width": win_w, "height": win_h}]})

    # Clear contents once before starting so colour transitions are visible in one doc
    write_notepad(wid, "")

    print("=== FLAMINGO TRAIL V2 ===", file=sys.stderr)
    print(f"  API   : {API_BASE}", file=sys.stderr)
    print(f"  source: {src.name}  {aw}x{ah}", file=sys.stderr)
    print(f"  window: {wid}  size={win_w}x{win_h}  (reuse={'no' if args.new_window else 'yes'})", file=sys.stderr)
    print(f"  canvas: {cw}x{ch}  dx={args.dx} dy={args.dy}", file=sys.stderr)
    print(f"  mode  : {'BOUNCE' if args.bounce else 'WRAP'}  bounce_count={args.bounce_count}", file=sys.stderr)

    # Pink background + bounce-step foreground palette (white -> black)
    bg_rgb = (204, 146, 154)
    fg_start = (255, 255, 255)
    fg_end = (0, 0, 0)

    target_bounces = args.bounce_count if args.bounce_count > 0 else 10
    palette = []
    for i in range(target_bounces + 1):
        t = i / max(1, target_bounces)
        palette.append((
            lerp(fg_start[0], fg_end[0], t),
            lerp(fg_start[1], fg_end[1], t),
            lerp(fg_start[2], fg_end[2], t),
        ))

    canvas = [[" "] * cw for _ in range(ch)]
    colour_idx = [[0] * cw for _ in range(ch)]  # colour index per cell
    x, y = args.x, args.y
    dx, dy = args.dx, args.dy

    frame = 0
    bounces = 0
    frozen = False
    freeze_logged = False

    try:
        while True:
            # New stamped chars get colour for current bounce bucket.
            current_idx = min(bounces, target_bounces)

            overlay(canvas, colour_idx, art, x, y, cw, ch, current_idx, add_chars=(not frozen))
            write_notepad(wid, render_ansi(canvas, colour_idx, palette, bg_rgb))

            time.sleep(delay)
            frame += 1

            if not frozen:
                if args.bounce:
                    x, y, dx, dy, hit = bounce_step(x, y, dx, dy, cw, ch, aw, ah)
                    if hit:
                        bounces += 1
                        idx_dbg = min(bounces, target_bounces)
                        v = palette[idx_dbg][0]
                        print(f"  bounce {bounces} -> new-stamp fg rgb=({v},{v},{v})", file=sys.stderr)
                        if args.bounce_count > 0 and bounces >= args.bounce_count:
                            frozen = True
                            if not freeze_logged:
                                print(f"  *** BOUNCE {bounces}/{args.bounce_count} reached — freezing canvas, window left open ***", file=sys.stderr)
                                freeze_logged = True
                else:
                    x = (x + dx) % max(1, cw)
                    y = (y + dy) % max(1, ch)

            if args.steps > 0 and frame >= args.steps:
                break

    except KeyboardInterrupt:
        pass

    write_notepad(wid, render_ansi(canvas, colour_idx, palette, bg_rgb))
    print(f"=== done. {frame} frames  bounces={bounces}  frozen={frozen} ===", file=sys.stderr)


if __name__ == "__main__":
    main()
