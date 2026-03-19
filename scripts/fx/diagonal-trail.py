#!/usr/bin/env python3
"""
diagonal-trail.py — Persistent ASCII trail with optional DVD-style bounce.

Default behaviour:
- Opens a notepad window
- Resizes it to full screen (instance screen size)
- Stamps ASCII art onto a persistent text canvas
- BOUNCE is ON by default
- After BOUNCE COUNT is reached, stops adding chars but leaves window open

Examples:
  WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/diagonal-trail.py \
    --source flamingo-0000-2.txt --fps 10 --bounce-count 5 --steps 120

  # Infinite run, freeze after 4 bounces, keep window open
  WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/diagonal-trail.py \
    --source flamingo-0000-2.txt --fps 8 --bounce-count 4 --steps 0
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
        sw = int(h["screen"].get("width", 110))
        sh = int(h["screen"].get("height", 55))
        return sw, sh
    return 110, 55


def open_notepad_sized(win_w: int, win_h: int):
    r = api_post("/commands/run", {"id": "microapp.wibwob.notepad.open", "args": {}})
    if not r or not r.get("ok"):
        return None
    time.sleep(0.35)
    s = api_get("/state")
    if not s:
        return None
    wid = None
    for w in s.get("windows", []):
        if (w.get("details") or {}).get("appType") == "wibwob.notepad":
            wid = w["id"]
    if wid is None:
        return None
    api_post("/windows/batch", {
        "ops": [{"id": wid, "left": 0, "top": 0, "width": win_w, "height": win_h}]
    })
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

    cands = list(JGS_DIR.glob("*.txt"))
    cands = [c for c in cands if c.stat().st_size > 40]
    return random.choice(cands) if cands else None


def load_art(path: Path):
    lines = [ln.rstrip("\n\r") for ln in path.read_text().splitlines()]
    lines = [ln for ln in lines if ln and not ln.startswith("#")]
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def overlay(canvas, art, x, y, cw, ch, add_chars=True):
    for r, line in enumerate(art):
        rr = y + r
        if rr < 0 or rr >= ch:
            continue
        row = canvas[rr]
        for c, ch2 in enumerate(line):
            cc = x + c
            if 0 <= cc < cw and ch2 not in (" ", "\t") and add_chars:
                row[cc] = ch2


def render(canvas):
    return "\n".join("".join(r) for r in canvas)


def bounce_step(x, y, dx, dy, cw, ch, aw, ah):
    nx = x + dx
    ny = y + dy
    bounced = False

    # horizontal
    if nx < 0:
        nx = 0
        dx = abs(dx)
        bounced = True
    elif nx + aw > cw:
        nx = max(0, cw - aw)
        dx = -abs(dx)
        bounced = True

    # vertical
    if ny < 0:
        ny = 0
        dy = abs(dy)
        bounced = True
    elif ny + ah > ch:
        ny = max(0, ch - ah)
        dy = -abs(dy)
        bounced = True

    return nx, ny, dx, dy, bounced


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", default="")
    p.add_argument("--window-id", type=int, default=None)
    p.add_argument("--dx", type=int, default=3)
    p.add_argument("--dy", type=int, default=2)
    p.add_argument("--x", type=int, default=0)
    p.add_argument("--y", type=int, default=0)
    p.add_argument("--steps", type=int, default=0, help="0 = infinite")
    p.add_argument("--fps", type=float, default=12)
    p.add_argument("--delay", type=float, default=None)
    p.add_argument("--canvas-w", type=int, default=None)
    p.add_argument("--canvas-h", type=int, default=None)
    p.add_argument("--window-w", type=int, default=None, help="window width (chars). Default: screen width")
    p.add_argument("--window-h", type=int, default=None, help="window height (rows). Default: screen height-2")
    p.add_argument("--bounce", dest="bounce", action="store_true", default=True)
    p.add_argument("--no-bounce", dest="bounce", action="store_false")
    p.add_argument("--bounce-count", type=int, default=3, help="0 = never freeze")
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
    win_w = args.window_w if args.window_w is not None else sw
    # leave a little room for chrome/status if no explicit size was requested
    win_h = args.window_h if args.window_h is not None else max(10, sh - 2)

    cw = args.canvas_w if args.canvas_w is not None else win_w
    ch = args.canvas_h if args.canvas_h is not None else win_h

    # Open/resolve window id and size it
    wid = args.window_id
    if wid is None:
        wid = open_notepad_sized(win_w, win_h)
        if wid is None:
            print("Could not open notepad window", file=sys.stderr)
            sys.exit(1)
    else:
        api_post("/windows/batch", {
            "ops": [{"id": wid, "left": 0, "top": 0, "width": win_w, "height": win_h}]
        })

    print("=== DIAGONAL TRAIL ===", file=sys.stderr)
    print(f"  API   : {API_BASE}", file=sys.stderr)
    print(f"  source: {src.name}  {aw}x{ah}", file=sys.stderr)
    print(f"  window: {wid}  size={win_w}x{win_h} (screen={sw}x{sh})", file=sys.stderr)
    print(f"  canvas: {cw}x{ch}  dx={args.dx} dy={args.dy}", file=sys.stderr)
    print(f"  mode  : {'BOUNCE' if args.bounce else 'WRAP'}  bounce_count={args.bounce_count}", file=sys.stderr)
    print(f"  steps : {args.steps if args.steps else '∞'}  delay={delay:.3f}s", file=sys.stderr)

    canvas = [[" "] * cw for _ in range(ch)]

    x, y = args.x, args.y
    dx, dy = args.dx, args.dy
    frame = 0
    bounces = 0
    frozen = False
    freeze_logged = False

    try:
        while True:
            # Draw current frame; when frozen, add_char=False so canvas no longer changes
            overlay(canvas, art, x, y, cw, ch, add_chars=(not frozen))
            write_notepad(wid, render(canvas))

            time.sleep(delay)
            frame += 1

            if not frozen:
                if args.bounce:
                    x, y, dx, dy, hit = bounce_step(x, y, dx, dy, cw, ch, aw, ah)
                    if hit:
                        bounces += 1
                        if args.bounce_count > 0 and bounces >= args.bounce_count:
                            frozen = True
                            if not freeze_logged:
                                print(f"  *** BOUNCE {bounces}/{args.bounce_count} reached — freezing canvas, window left open ***", file=sys.stderr)
                                freeze_logged = True
                else:
                    # Wrap mode
                    x = (x + dx) % max(1, cw)
                    y = (y + dy) % max(1, ch)

            if args.steps > 0 and frame >= args.steps:
                break

    except KeyboardInterrupt:
        pass

    # Final push
    write_notepad(wid, render(canvas))
    print(f"=== done. {frame} frames  bounces={bounces}  frozen={frozen} ===", file=sys.stderr)


if __name__ == "__main__":
    main()
