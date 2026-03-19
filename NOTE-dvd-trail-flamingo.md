# DVD Flamingo Trail — Dev Note

**Date:** 2026-03-19
**Session:** zine-moodboard / mwg instance (port 8100)
**What happened:** A flamingo ASCII art stamp bounced DVD-style inside a notepad window, leaving a ghost-trail of itself on a persistent canvas. After 4 bounces the canvas froze, the window stayed open. Beautiful.

---

## TL;DR

One command, 60s:

```bash
cd ~/Repos/wibwob-zine-moodboard
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/diagonal-trail.py \
  --source flamingo-0000-2.txt \
  --fps 10 \
  --bounce-count 5 \
  --steps 120
```

Or 8fps, infinite loop, Ctrl+C to freeze and leave window open:

```bash
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/diagonal-trail.py \
  --source flamingo-0000-2.txt \
  --fps 8 \
  --bounce \
  --bounce-count 0
```

---

## The Art

`/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples/flamingo-0000-2.txt`

```
# Title: Flamingo
# Artist: jgs (Joan G. Stark)
# Source: https://github.com/oldcompcz/jgs/blob/master/joan_stark/birds.html

              _.....
          .-'` ^    `'.
        .'^   ^  ,_.   \
       // , ^ _.-'-.    |
      // /.--' '-       |
     /;/``--.___._      ;
     |/`    | /\ |`)   /
     `     //`  || |  /
          //    || | ;
         ((     || | |
          `:.   || \ \
            ':. (|  `\\
              /;||    ||
              ||||    ;|
        ~  ~  |/||   /` |   ~
     ~          || ~ \-p/
                ||   | |
        jgs   .~||~./_/
             `~ -  ~`
```

Size: 18 rows × ~23 cols. Compact enough to bounce inside a 110×55 canvas without immediately exiting.

---

## The Script

**File:** `scripts/fx/diagonal-trail.py`
**Runtime:** Python 3, no dependencies beyond stdlib + urllib
**Instance targeting:** `WIBWOB_API=http://127.0.0.1:8100` env var

```python
#!/usr/bin/env python3
"""
diagonal-trail.py — Persistent canvas accumulation with DVD-style bouncing.

Art stamps itself at offsets each frame. Characters accumulate — nothing erased.
BOUNCE mode: ricochets off canvas edges instead of wrapping.
BOUNCE_COUNT: after N bounces, stops adding chars and freezes the window open.

Usage:
  python3 scripts/fx/diagonal-trail.py [options]

Options:
  --source FILE     ASCII art source (default: random jgs from JGS_DIR)
  --window-id N     TUI window id (default: open a new notepad)
  --dx N --dy N    step per frame (default: 3, 2)
  --steps N         frames (0=infinite, default: 0)
  --fps N           frames per second (default: 12)
  --delay SECS      sleep between frames (overrides --fps)
  --canvas-w N --canvas-h N   canvas size in chars (default: 110x55)
  --bounce          bounce off edges instead of wrapping (default: True)
  --no-bounce       wrap at edges (alias: --wrap)
  --bounce-count N  stop accumulating after N bounces (default: 3, 0=never stop)
  --freeze-after N   alias for --bounce-count
  --seed N          random seed for source selection
  --x N --y N       starting position (default: 0,0)
  --speed-multi N    multiply dx/dy by this (default: 1.0)

API: uses WIBWOB_API env var (default: http://127.0.0.1:8100)
"""
import argparse, subprocess, sys, time, random, os, json, urllib.request, urllib.error
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
API_BASE = os.environ.get('WIBWOB_API', os.environ.get('WW_API', 'http://127.0.0.1:8100'))


# ── API helpers ─────────────────────────────────────────────────────────

def api_get(path):
    try:
        with urllib.request.urlopen(f'{API_BASE}{path}', timeout=2) as r:
            return json.loads(r.read())
    except Exception:
        return None


def api_post(path, body):
    try:
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            f'{API_BASE}{path}',
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except Exception:
        return None


def open_notepad():
    """Open a notepad window sized to the canvas and return its id."""
    r = api_post('/commands/run', {
        'id': 'microapp.wibwob.notepad.open',
        'args': {}
    })
    if r and r.get('ok'):
        time.sleep(0.6)
        state = api_get('/state')
        if state:
            for w in state.get('windows', []):
                if w.get('details', {}).get('appType') == 'wibwob.notepad':
                    wid = w['id']
                    # Size to fill canvas
                    api_post('/windows/batch', {
                        'ops': [{'id': wid, 'left': 0, 'top': 0, 'width': 110, 'height': 55}]
                    })
                    return wid
    return None


def write_to_window(text, win_id):
    if win_id is None:
        return False
    return api_post('/commands/run', {
        'id': 'microapp.wibwob.notepad.write',
        'args': {'text': text, 'windowId': win_id}
    }) is not None


# ── Art loading ──────────────────────────────────────────────────────────

def load_art(path):
    lines = [l.rstrip('\n\r') for l in Path(path).read_text().splitlines()]
    lines = [l for l in lines if l and not l.startswith('#')]
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


def pick_source(preference):
    JGS_DIR = Path('/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples')
    if preference:
        p = Path(preference)
        if p.exists():
            return p
        p = JGS_DIR / preference
        if p.exists():
            return p
        p = JGS_DIR / (preference + '.txt')
        if p.exists():
            return p
    candidates = [f for f in JGS_DIR.glob('*.txt') if f.stat().st_size > 50]
    if candidates:
        return random.choice(candidates)
    return None


# ── Canvas ─────────────────────────────────────────────────────────────

def overlay(canvas, art, sx, sy, cw, ch, add_char):
    """Stamp art onto canvas at (sx,sy). Spaces transparent.
    add_char=False freezes the canvas — stamps are skipped but the window stays open."""
    for r, line in enumerate(art):
        cr = sy + r
        if 0 <= cr < ch:
            row = canvas[cr]
            for col, ch2 in enumerate(line):
                cc = sx + col
                if 0 <= cc < cw and ch2 not in ' \t':
                    row[cc] = ch2 if add_char else row[cc]


def emit(canvas):
    return '\n'.join(''.join(row) for row in canvas)


# ── Bounce physics ─────────────────────────────────────────────────────

def bounce_pos(x, y, dx, dy, cw, ch, art_w, art_h):
    """Compute next position + velocity, handle wall bounces. Returns (nx, ny, ndx, ndy, bounced)."""
    nx = x + dx
    ny = y + dy
    bounced = False

    art_right  = nx + art_w - 1
    art_bottom = ny + art_h - 1

    if nx < 0:
        nx = 0
        dx = abs(dx)
        bounced = True
    elif art_right >= cw:
        nx = cw - art_w
        dx = -abs(dx)
        bounced = True

    if ny < 0:
        ny = 0
        dy = abs(dy)
        bounced = True
    elif art_bottom >= ch:
        ny = ch - art_h
        dy = -abs(dy)
        bounced = True

    return nx, ny, dx, dy, bounced


# ── Main ───────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source',         default='')
    p.add_argument('--window-id',      type=int,  default=None)
    p.add_argument('--dx',             type=int,  default=3)
    p.add_argument('--dy',            type=int,  default=2)
    p.add_argument('--steps',         type=int,  default=0)
    p.add_argument('--fps',           type=int,  default=12)
    p.add_argument('--delay',          type=float, default=None)
    p.add_argument('--canvas-w',       type=int,  default=110)
    p.add_argument('--canvas-h',       type=int,  default=55)
    p.add_argument('--bounce',                        action='store_true',  default=True)
    p.add_argument('--no-bounce',                     action='store_false', dest='bounce')
    p.add_argument('--wrap',                           action='store_false', dest='bounce')
    p.add_argument('--bounce-count',  type=int,  default=3)
    p.add_argument('--freeze-after',  type=int,  default=None)
    p.add_argument('--seed',         type=int,  default=None)
    p.add_argument('--x',            type=int,  default=0)
    p.add_argument('--y',            type=int,  default=0)
    p.add_argument('--speed-multi',   type=float, default=1.0)
    args = p.parse_args()

    # --freeze-after overrides --bounce-count
    if getattr(args, 'freeze_after', None) is not None:
        args.bounce_count = args.freeze_after

    if args.seed is not None:
        random.seed(args.seed)

    delay = args.delay or (1.0 / args.fps)

    src = pick_source(args.source)
    if not src or not src.exists():
        print(f'No source. Check --source or JGS_DIR', file=sys.stderr)
        sys.exit(1)

    art = load_art(src)
    art_h = len(art)
    art_w = max((len(l) for l in art), default=0)

    CW, CH = args.canvas_w, args.canvas_h
    canvas = [[' '] * CW for _ in range(CH)]

    # Open or reuse window
    wid = args.window_id
    if wid is None:
        wid = open_notepad()
        if wid:
            print(f'Opened notepad WID={wid}', file=sys.stderr)
        else:
            print('Could not open notepad', file=sys.stderr)
            sys.exit(1)

    print(f'=== DIAGONAL TRAIL ===', file=sys.stderr)
    print(f'  source : {src.name}  {art_w}x{art_h}', file=sys.stderr)
    print(f'  canvas : {CW}x{CH}  dx={args.dx} dy={args.dy}', file=sys.stderr)
    print(f'  mode   : {"BOUNCE" if args.bounce else "WRAP"}  bounce_count={args.bounce_count}', file=sys.stderr)
    print(f'  delay  : {delay:.3f}s  steps={args.steps or chr(8734)}  WID={wid}', file=sys.stderr)

    x, y  = args.x, args.y
    dx, dy = args.dx * args.speed_multi, args.dy * args.speed_multi
    dx = max(1, int(dx)); dy = max(1, int(dy))

    bounce_count       = 0
    frozen            = False
    frame             = 0
    infinite          = args.steps == 0
    stop_after_bounces = args.bounce_count > 0

    try:
        while True:
            overlay(canvas, art, x, y, CW, CH, add_char=not frozen)
            text = emit(canvas)
            write_to_window(text, wid)

            time.sleep(delay)
            frame += 1

            if not frozen:
                if args.bounce:
                    x, y, dx, dy, bounced = bounce_pos(x, y, dx, dy, CW, CH, art_w, art_h)
                    if bounced:
                        bounce_count += 1
                        if stop_after_bounces and bounce_count >= args.bounce_count:
                            frozen = True
                            print(f'  *** BOUNCE {bounce_count}/{args.bounce_count} -- canvas frozen, window open ***', file=sys.stderr)
                else:
                    x = x % CW
                    y = y % CH

            if not infinite and frame >= args.steps:
                break

    except KeyboardInterrupt:
        pass

    # Write final frozen state
    write_to_window(emit(canvas), wid)
    print(f'=== done. {frame} frames  bounces={bounce_count}  frozen={frozen} ===', file=sys.stderr)


if __name__ == '__main__':
    main()
```

---

## How It Works

### 1. The Canvas
A 2D list of space characters, size 110×55. No rendering engine, no blessed — just a text buffer written directly to a notepad window.

```python
CW, CH = 110, 55
canvas = [[' '] * CW for _ in range(CH)]
```

### 2. Stamp / Overlay
Each frame, the art is stamped onto the canvas at the current position. Spaces are transparent — the canvas accumulates non-space characters only.

```python
def overlay(canvas, art, sx, sy, cw, ch, add_char):
    for r, line in enumerate(art):
        cr = sy + r
        if 0 <= cr < ch:
            row = canvas[cr]
            for col, ch2 in enumerate(line):
                cc = sx + col
                if 0 <= cc < cw and ch2 not in ' \t':
                    row[cc] = ch2 if add_char else row[cc]
```

### 3. Bounce Physics
DVD-style ricochet — when any edge of the art hits the canvas edge, that axis reverses. Both axes bounce independently, so diagonal paths emerge naturally.

```python
def bounce_pos(x, y, dx, dy, cw, ch, art_w, art_h):
    nx = x + dx; ny = y + dy; bounced = False
    art_right = nx + art_w - 1; art_bottom = ny + art_h - 1
    if nx < 0:      nx = 0;       dx = abs(dx);  bounced = True
    elif art_right >= cw:  nx = cw - art_w;  dx = -abs(dx); bounced = True
    if ny < 0:      ny = 0;       dy = abs(dy);  bounced = True
    elif art_bottom >= ch: ny = ch - art_h;  dy = -abs(dy); bounced = True
    return nx, ny, dx, dy, bounced
```

### 4. Freeze on Bounce Count
When `bounce_count >= bounce_count`, set `frozen = True`. From then on `add_char=False` — the position keeps updating (art ricochets invisibly) but nothing is added to the canvas. The window stays open and live with the frozen art inside.

```python
if bounced:
    bounce_count += 1
    if stop_after_bounces and bounce_count >= args.bounce_count:
        frozen = True
```

### 5. Notepad as Canvas Display
The notepad is just a writable text surface. We size it to 110×55 to match the canvas, then push the whole canvas as text on every frame.

```python
api_post('/commands/run', {
    'id': 'microapp.wibwob.notepad.open', 'args': {}
})
# → size to 110x55
api_post('/windows/batch', {
    'ops': [{'id': wid, 'left': 0, 'top': 0, 'width': 110, 'height': 55}]
})
# → push canvas each frame
api_post('/commands/run', {
    'id': 'microapp.wibwob.notepad.write',
    'args': {'text': emit(canvas), 'windowId': wid}
})
```

---

## Variant Ideas

| Variant | Command |
|---------|---------|
| Flamingo, 8fps, infinite bounces, freeze at 4 | `--source flamingo-0000-2.txt --fps 8 --bounce-count 4` |
| Flamingo, wrap mode (no bounce, just drift) | `--source flamingo-0000-2.txt --no-bounce --fps 10` |
| Random jgs art, bounce, 120 frames | `--fps 12 --bounce-count 5 --steps 120` |
| Kayak art, slow drift | `--source kayak-0000.txt --dx 2 --dy 1 --fps 8 --bounce-count 6` |
| Speed multiplier | `--speed-multi 2.0 --source flamingo-0000-2.txt --fps 10 --bounce-count 4` |
| Specific seed for reproducible art choice | `--seed 42 --fps 10 --bounce-count 5` |

---

## Replicate

```bash
cd ~/Repos/wibwob-zine-moodboard

# Flamingo, 120 frames, 5 bounces, freeze, 10fps
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/diagonal-trail.py \
  --source flamingo-0000-2.txt \
  --fps 10 \
  --bounce-count 5 \
  --steps 120

# Same art, infinite bounces, Ctrl+C to freeze
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/diagonal-trail.py \
  --source flamingo-0000-2.txt \
  --fps 8 \
  --bounce-count 0
```
