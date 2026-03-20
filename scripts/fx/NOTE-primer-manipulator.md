# Primer Manipulator — Creative Primer Transformations for WibWob-DOS

**Date:** 2026-03-19
**Script:** `scripts/fx/primer-manipulator.py`
**Instance:** 8pr (port 8100)

---

## TL;DR — One-command run (8 transforms, 7 primers, one notepad)

```bash
WID=$(WIBWOB_API=http://127.0.0.1:8100 python3 - <<'PY'
import urllib.request, json, time
api="http://127.0.0.1:8100"
def post(p,b):
    d=json.dumps(b).encode(); r=urllib.request.Request(f"{api}{p}",data=d,headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(r,timeout=5).read())
def get(p): return json.loads(urllib.request.urlopen(f"{api}{p}",timeout=5).read())
sw=int(get("/health")["screen"]["width"]); sh=int(get("/health")["screen"]["height"])
post("/commands/run",{"id":"microapp.wibwob.notepad.open","args":{}})
time.sleep(0.35)
wid=[w for w in get("/state")["windows"] if(w.get("details")or{}).get("appType")=="wibwob.notepad"][-1]["id"]
post("/windows/batch",{"ops":[{"id":wid,"width":240,"height":60,"left":max(0,(sw-240)//2),"top":max(0,(sh-60)//2)}]})
print(wid)
PY
)
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/primer-manipulator.py \
  --canvas-w 240 --canvas-h 60 --steps 60 --fps 10 --pause 1.5
```

### Rainbow star-face with dark-pastel (the favourite)
```bash
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/primer-manipulator.py \
  --canvas-w 240 --canvas-h 60 --steps 60 --fps 10 --pause 1.5 \
  --rainbow-art starry-night.txt
```

### Static composition — no animation, just the gradient
```bash
# Figlet label + rainbow gradient art, written once, stays on screen
WIBWOB_API=http://127.0.0.1:8100 python3 - <<'PY'
# (see "Static Rainbow Gradient" section below)
PY
```

---

## The Rainbow Gradient — How it Works

### TL;DR (non-tech)
Two things: (1) big "STAR FACE" figlet text in pink at the top. (2) Every character of the star art gets a different colour — left side blue, middle pink, right side yellow/green — based on where it sits horizontally. Dark background makes it all pop.

### The mini-blog

#### The big text at the top
The code runs `figlet` — a classic Unix tool that turns any text into giant ASCII art letters. It says "STAR FACE" in enormous block letters using a standard font. This creates the header banner in pink/mauve that sits above the art.

#### The colour spectrum across the art
Here's the trick. The star art is just rows of characters. The code looks at each character and asks: **where is it horizontally?** If it's near the left edge → colour it blue. Near the right edge → colour it pink. In between → a smooth blend of everything in between.

```python
# Where is this character?  0.0 = left edge, 1.0 = right edge
t = ci / max(1, len(line))

# Pick a colour based on that position
idx = int(t * len(RAINBOW)) % len(RAINBOW)
r, g, b = RAINBOW[idx]
```

This `t` value (0 to 1) acts like a dial. Turn the dial a little → blue. More → pink. More still → peach, yellow, green. The palette cycles through 7 carefully chosen Catppuccin colours.

#### Why it looks so good
Three things make it work visually:

1. **Dark background** (`#1e1e2e`) — maximum contrast for the colours.
2. **Catppuccin's colour harmony** — every colour is chosen to look good next to each other. Not random — curated. Cohesive, not garish.
3. **Per-character colour** — not per-row. Each individual character gets its own colour based on its horizontal position. You see a gradient even within a single row. Makes the art feel dimensional and alive.

#### The ANSI codes that make colours appear
Special invisible codes called **ANSI escape sequences** (standard since the 1970s) are inserted into the text before sending to the notepad:
```
\x1b[38;2;R;G;Bm   → set foreground (text) colour
\x1b[48;2;R;G;Bm   → set background colour
\x1b[0m             → reset to default
```
So a pink star is stored as: `\x1b[38;2;243;139;168m★\x1b[0m`. The notepad renders it as colour on screen.

#### Why animation makes it dance
The bouncing version adds one more ingredient: **time**.
```python
t = (ri / rows + frame * 0.03) % 1.0
```
Instead of a fixed position, the dial shifts forward each frame — what was blue becomes pink becomes peach, rippling through the art like a wave. Every frame the whole colour spectrum drifts one step along, creating the rainbow wave effect.

---

## Static Rainbow Gradient (no animation)
```python
python3 - <<'PY'
import urllib.request, json, subprocess
from pathlib import Path

api = "http://127.0.0.1:8100"
wid = 33  # your notepad window id

def post(p, b):
    d = json.dumps(b).encode()
    r = urllib.request.Request(f"{api}{p}", data=d, headers={"Content-Type":"application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(r, timeout=5).read())

lines = [l.rstrip("\n\r") for l in Path("microapps-private/wibwob-primers/primers/star-face.txt").read_text().splitlines()]
lines = [l for l in lines if l and not l.startswith("#")]
cw, ch = 240, 60

RAINBOW = [(205,214,244),(243,139,168),(255,189,133),(249,226,175),(166,227,161),(137,180,250),(203,166,247)]
BG = (30, 30, 46)
def af(r,g,b): return f"\x1b[38;2;{r};{g};{b}m"
def ab(r,g,b): return f"\x1b[48;2;{r};{g};{b}m"
RESET = "\x1b[0m"

canvas = [[" ", " "] * cw for _ in range(ch)]

# Figlet label in mauve
label = subprocess.run(["figlet","-f","standard","STAR FACE"], capture_output=True, text=True).stdout
y = 0
for ll in label.splitlines():
    if y < ch:
        canvas[y] = list(canvas[y])
        for ci, c in enumerate(ll):
            if ci < cw:
                canvas[y][ci] = ab(*BG) + af(203, 166, 247) + c
        y += 1
y += 2

# Rainbow gradient art
for ll in lines:
    if y < ch:
        row = list(canvas[y])
        for ci, c in enumerate(ll):
            if ci < cw and c not in " \t":
                t = (ci / max(1, len(ll))) % 1.0
                idx = int(t * len(RAINBOW)) % len(RAINBOW)
                r, g, b = RAINBOW[idx]
                row[ci] = ab(*BG) + af(r, g, b) + c
        canvas[y] = "".join(row)
        y += 1

text = "\n".join("".join(row) + RESET for row in canvas)
post("/commands/run", {"id":"microapp.wibwob.notepad.write","args":{"windowId":wid,"text":text}})
print("Done")
PY
```

---

## TL;DR — One-command run

```bash
cd ~/Repos/wibwob-zine-moodboard
WID=$(WIBWOB_API=http://127.0.0.1:8100 python3 - <<'PY'
import urllib.request, json, time
api="http://127.0.0.1:8100"
def post(p,b):
    d=json.dumps(b).encode()
    r=urllib.request.Request(f"{api}{p}",data=d,headers={"Content-Type":"application/json"},method="POST")
    return json.loads(urllib.request.urlopen(r,timeout=5).read())
def get(p): return json.loads(urllib.request.urlopen(f"{api}{p}",timeout=5).read())
sw=int(get("/health")["screen"]["width"]); sh=int(get("/health")["screen"]["height"])
post("/commands/run",{"id":"microapp.wibwob.notepad.open","args":{}})
time.sleep(0.35)
wid=[w for w in get("/state")["windows"] if(w.get("details")or{}).get("appType")=="wibwob.notepad"][-1]["id"]
post("/windows/batch",{"ops":[{"id":wid,"width":240,"height":60,"left":max(0,(sw-240)//2),"top":max(0,(sh-60)//2)}]})
print(wid)
PY
)
echo "WID=$WID"
WIBWOB_API=http://127.0.0.1:8100 python3 scripts/fx/primer-manipulator.py --canvas-w 240 --canvas-h 60 --steps 60 --fps 10 --pause 1.5
```

---

## What It Does

Opens a notepad, fetches the real desktop size from `/health`, centres the window,
then cycles through **8 distinct visual transformations** applied to 7 primers:

| # | Transform | Art Used | What it does |
|---|-----------|----------|--------------|
| 1 | **RAINBOW WAVE** | star-face.txt | Sinusoidal hue shift across rows, cycles over time |
| 2 | **GLITCH SLICE** | the-scream.txt | Random horizontal slice offsets per row each frame |
| 3 | **DENSITY COLOR** | plantoid-flower-power.txt | Char colour by density — blue=pink gradient |
| 4 | **VERTICAL TILE** | castle-tower-3d-cube.txt | Art tiled vertically to fill canvas height |
| 5 | **KALEIDOSCOPE** | cat-rainbow-factory.txt | 4-quadrant mirror: original + hflip + vflip + both |
| 6 | **PULSE GLOW** | wibwob-portrait-1.txt | BG pulses between dark and accent blue via sin() |
| 7 | **SPARKLE** | wibble-family.txt | Random chars flash bright white each frame |
| 8 | **V-GRADIENT** | star-face.txt | FG colour shifts blue→pink top-to-bottom |

Each transform holds for `N` frames, then advances. Ends with a **2×2 composite** of 4 primers.

---

## The Rainbow Wave — Deep Dive

This was the favourite. Here's exactly how it works.

### Core idea
Each row of the art is assigned a colour from the rainbow palette.
Over time, the hue shifts — rows cycle through the palette at different offsets,
creating a **wave that propagates downward** through the art.

### Colour palette (Catppuccin Mocha dark-pastel)

```python
BG = (30, 30, 46)                    # #1e1e2e — dark base
FG_BASE  = (205, 214, 244)          # #cdd6f4 — text (white-blue)
FG_PINK  = (243, 139, 168)          # #f38ba8 — flamingo/pink
FG_PEACH = (255, 189, 133)          # #ffbd85 — peach
FG_YELLOW= (249, 226, 175)           # #f9e2af — yellow
FG_GREEN = (166, 227, 161)          # #a6e3a1 — green
FG_BLUE  = (137, 180, 250)          # #89b4fa — blue
FG_MAUVE = (203, 166, 247)          # #cba6f7 — mauve

RAINBOW = [FG_BASE, FG_PINK, FG_PEACH, FG_YELLOW, FG_GREEN, FG_BLUE, FG_MAUVE]
```

### The math

```python
def render_rainbow_wave(lines, frame, cw):
    rows = len(lines)
    out = []
    for ri, line in enumerate(lines):
        # t = position-in-palette + time-offset (mod 1.0 for wrapping)
        t = (ri / max(1, rows) + frame * 0.03) % 1.0
        idx = int(t * len(RAINBOW)) % len(RAINBOW)
        r, g, b = RAINBOW[idx]
        out.append(
            ansi_bg(*BG) +
            ansi_fg(r, g, b) +
            line[:cw] +
            RESET
        )
    return "\n".join(out)
```

- `ri / rows` — gives each row a position in [0, 1] (top to bottom)
- `frame * 0.03` — slowly shifts the palette over time (3% per frame)
- `% 1.0` — wraps cleanly so it loops forever
- `int(t * len(RAINBOW))` — picks a palette index from that fractional position
- `ansi_bg(*BG)` — sets solid dark background per row
- `ansi_fg(r, g, b)` — sets the row's rainbow colour
- `RESET` — closes the ANSI sequence

### Speed control
- `--fps 10` = 0.1s per frame → wave completes one full cycle in ~33 seconds
- `--fps 20` = 0.05s per frame → wave completes one full cycle in ~17 seconds
- Change `frame * 0.03` to `frame * 0.05` for faster colour cycling

### Varying the effect
- Add more colours to `RAINBOW` for smoother gradients
- Change `frame * 0.03` to negative for upward wave direction
- Use `math.sin()` instead of linear `t` for organic easing
- Apply to a different primer by swapping `all_art["star-face.txt"]`

---

## All Transforms Explained

### GLITCH SLICE
```python
def render_glitch_animated(lines, frame, cw):
    rng = random.Random(frame)
    out = []
    for line in lines:
        if rng.random() > 0.6:       # 40% chance each row glitches
            offset = rng.randint(-3, 3)
            shifted = " " * max(0, offset) + line + " " * max(0, -offset)
            line = shifted
        out.append(line[:cw])
    return "\n".join(out)
```
Each frame the random seed changes → different rows glitch each time → organic shimmer.

### DENSITY COLOR
```python
def render_density_color(lines, cw):
    for line in lines:
        # each char coloured by horizontal position (blue → pink)
        t = (line.index(ch) / max(1, len(line))) % 1.0
        r = int(137 + t * 106)
        g = int(180 - t * 41)
        b = int(250 - t * 82)
```
Left side blue, right side pink. Diagonal density lines emerge from character spacing.

### KALEIDOSCOPE
```python
def render_kaleido(lines, cw, ch):
    half_h = ch // 2; half_w = cw // 2
    top  = [l[:half_w] for l in lines[:half_h]]
    top_rev = [l[::-1] for l in lines[:half_h]]     # h-flip
    bot  = [l[:half_w] for l in lines[half_h:half_h*2]]
    bot_rev = [l[::-1] for l in lines[half_h:half_h*2]]  # both flips
    # quadrant assembly...
```
Uses Python string slicing `[::-1]` for instant mirror. No external tools needed.

### PULSE GLOW
```python
t = (math.sin(frame * 0.15) + 1) / 2   # 0 to 1 via sine
br = int(BG[0] + t * (FG_ACCENT[0] - BG[0]))
bg_c = int(BG[1] + t * (FG_ACCENT[1] - BG[1]))
bb = int(BG[2] + t * (FG_ACCENT[2] - BG[2]))
```
`sin()` gives smooth organic oscillation. BG lerps from dark to accent blue and back.

### SPARKLE
```python
rng = random.Random(frame)   # different every frame → different sparkle pattern
for ch in line:
    if ch not in " ·\t" and rng.random() > 0.85:   # ~15% of chars sparkle
        row += ansi_fg(255, 255, 255) + ch  # white flash
```
Same seed = same art, but each frame has a unique random mask → dancing sparkles.

---

## Creative Variations to Try

### Rainbow wave on wibble-family (recommended)
```bash
# edit TRANSFORMS in the script:
("RAINBOW WAVE", lambda f: render_rainbow_wave(
    crop_to(all_art["wibble-family.txt"], cw, None), f, cw))
```

### Spectral rainbow — cyan → magenta → yellow (no dark-pastel)
```python
RAINBOW = [
    (0, 255, 255),   # cyan
    (0, 200, 255),   # sky
    (138, 43, 226),  # blue-violet
    (199, 21, 133),  # medium violet-red
    (255, 105, 180), # hot pink
    (255, 99, 71),   # tomato
    (255, 215, 0),   # gold
]
```

### Rainbow wave + black BG
```python
BG = (0, 0, 0)
```

### Portrait mode — narrow + tall canvas
```bash
python3 scripts/fx/primer-manipulator.py \
  --canvas-w 80 --canvas-h 90 \
  --steps 40 --fps 8
```

### Instant freeze — bounce-count=1 style, fast wave
```python
# in TRANSFORMS, add a 1-step ultra-fast transition:
("RAINBOW SNAP",
 lambda f: render_rainbow_wave(
     crop_to(all_art["star-face.txt"], cw, None),
     f if f < 5 else 5,   # freeze after frame 5
     cw))
```

### Combine two effects in one frame (layered rendering)
```python
# first apply rainbow wave to art
colored = render_rainbow_wave(art, frame, cw)
# then overlay sparkle on top
colored_with_sparkle = render_sparkle_over(colored, frame)
```

---

## Script Arguments

| Flag | Default | Description |
|------|---------|-------------|
| `--canvas-w` | 240 | Canvas width in chars |
| `--canvas-h` | 60 | Canvas height in rows |
| `--steps` | 60 | Frames per transform |
| `--fps` | 8 | Frames per second |
| `--pause` | 1.5 | Seconds pause between transforms |
| `--cycle` | off | Loop forever (Ctrl+C to stop) |
| `--seed` | null | Random seed for reproducibility |

---

## Key Technical Patterns

### Dynamic centering (reusable)
```python
sw, sh = get_desktop()
cx = max(0, (sw - win_w) // 2)
cy = max(0, (sh - win_h) // 2)
```

### ANSI colour per cell (reusable)
```python
def ansi_fg(r, g, b): return f"\x1b[38;2;{r};{g};{b}m"
def ansi_bg(r, g, b): return f"\x1b[48;2;{r};{g};{b}m"
RESET = "\x1b[0m"
# Use: ansi_bg(*BG) + ansi_fg(r,g,b) + "char" + RESET
```

### String mirror (reusable)
```python
reversed_line = line[::-1]  # horizontal flip
reversed_lines = lines[::-1] # vertical flip
```

### Lerp (reusable)
```python
def lerp(a, b, t): return int(a + (b - a) * t)
# Use: lerp(255, 0, 0.5) → 127
```
