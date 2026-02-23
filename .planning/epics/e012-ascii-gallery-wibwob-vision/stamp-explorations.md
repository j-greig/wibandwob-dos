---
title: Stamp Mode Explorations
epic: e012
updated: 2026-02-23
---

# Stamp Mode — Gallery/Arrange Explorations

Logging every working `stamp` command for reproducibility.  
Patterns: `text` (pixel-font words), `grid`, `wave`, `diagonal`, `cross`, `border`.  
Pixel font: 3×5 dot-matrix, characters A–Z, 0–9, `!?&#+*:-.`

**API endpoint:** `POST http://127.0.0.1:8089/gallery/arrange`  
**Canvas:** 362×96 (27" Cinema Display, small font, full-screen tmux)

---

## How it works

```
algorithm: "stamp"
filenames: ["<primer>.txt"]     ← the stamp (repeated as many times as needed)
options:
  pattern:  text | grid | wave | diagonal | cross | border
  text:     "WIB WOB"          ← for pattern=text only
  cols:     N                  ← columns (grid / wave)
  rows:     N                  ← rows (grid)
  anchor:   center|tl|tr|bl|br|top|bottom|left|right
padding:    N                  ← gutter between stamps (0 = touching)
margin:     N                  ← breathing room from canvas edge
```

The same primer file is opened once per "on pixel" / grid cell / wave point.  
No fixed rows or columns — pure position maths per pattern type.

---

## Exploration Log

### 1 — WIB in cats  
**29 stamps, 0 overlaps, 0 OOB**  
`cat-cat-simple.txt` (17×12) as pixel, padding=1, margin=4, anchor=center  
Snap: `logs/screenshots/tui_20260223_140014.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["cat-cat-simple.txt"],"algorithm":"stamp","padding":1,"margin":4,
       "options":{"pattern":"text","text":"WIB","anchor":"center"}}'
```

---

### 2 — WOB in paradox  
**28 stamps, 0 overlaps, 0 OOB**  
`paradox.txt` (13×7) micro-stamps, padding=0 (touching), margin=2  
Snap: `logs/screenshots/tui_20260223_140023.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["paradox.txt"],"algorithm":"stamp","padding":0,"margin":2,
       "options":{"pattern":"text","text":"WOB","anchor":"center"}}'
```

---

### 3 — WIB WOB in micro time-shaman stamps  
**57 stamps, 0 overlaps, 0 OOB**  
`time-shaman.txt` (9×3) — the tiniest primer, padding=1, margin=6  
Full phrase "WIB WOB" across full canvas width  
Snap: `logs/screenshots/tui_20260223_140035.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["time-shaman.txt"],"algorithm":"stamp","padding":1,"margin":6,
       "options":{"pattern":"text","text":"WIB WOB","anchor":"center"}}'
```

---

### 4 — Grid of jellyfish  
**36 stamps (9×4), 0 overlaps, 0 OOB**  
`jellyfish.txt` (33×19), padding=1, margin=4  
Snap: `logs/screenshots/tui_20260223_140045.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["jellyfish.txt"],"algorithm":"stamp","padding":1,"margin":4,
       "options":{"pattern":"grid","cols":9,"rows":4,"anchor":"center"}}'
```

---

### 5 — Wave of chaos  
**16 stamps along sine wave, 0 overlaps, 0 OOB**  
`chaos.txt` (19×12), wave pattern, cols=16, padding=2, margin=4  
Snap: `logs/screenshots/tui_20260223_140051.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["chaos.txt"],"algorithm":"stamp","padding":2,"margin":4,
       "options":{"pattern":"wave","cols":16,"anchor":"center"}}'
```

---

### 6 — Cross of iso-cubes  
**28 stamps in + cross, 0 overlaps, 0 OOB**  
`iso-cube-cornered.txt` (15×11), cross pattern, padding=1, margin=2  
Snap: `logs/screenshots/tui_20260223_140100.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["iso-cube-cornered.txt"],"algorithm":"stamp","padding":1,"margin":2,
       "options":{"pattern":"cross","anchor":"center"}}'
```

---

### 7 — Border ring of mini-herbivores  
**52 stamps ringing canvas edge, 0 overlaps, 0 OOB**  
`mini-herbivore.txt` (19×9), border pattern, padding=0, margin=2  
Snap: `logs/screenshots/tui_20260223_140111.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["mini-herbivore.txt"],"algorithm":"stamp","padding":0,"margin":2,
       "options":{"pattern":"border","anchor":"center"}}'
```

---

### 8 — Diagonal of reality-dreams  
**3 stamps along diagonal, 0 overlaps, 0 OOB**  
`reality-dreams.txt` (26×24) — tall primer limits diagonal depth to 3 steps  
Snap: `logs/screenshots/tui_20260223_140114.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["reality-dreams.txt"],"algorithm":"stamp","padding":2,"margin":4,
       "options":{"pattern":"diagonal","anchor":"center"}}'
```

> Note: diagonal depth = min(uw/step_x, uh/step_y) — use small primers for longer diagonals.

---

### 9 — "?" in recursive-disco-cats  
**4 stamps, 0 overlaps, 0 OOB**  
`recursive-disco-cat.txt` (22×19), large stamp makes sparse "?" glyph  
Snap: `logs/screenshots/tui_20260223_140116.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H "Content-Type: application/json" \
  -d '{"filenames":["recursive-disco-cat.txt"],"algorithm":"stamp","padding":2,"margin":8,
       "options":{"pattern":"text","text":"?","anchor":"center"}}'
```

---

### 10 — 20 cats (LOL grid)  
_see below_

### 11 — "AI" in monster stamps  
_see below_

### 12 — Diagonal of chaos (tiny stamp = long line)  
_see below_

---

## Stamp Size vs Pattern Notes

| primer          | w×h  | step(p=1) | best patterns           |
|-----------------|------|-----------|-------------------------|
| time-shaman     | 9×3  | 10×4      | text (long phrases), border |
| cosmic-horror   | 11×3 | 12×4      | text, wave              |
| paradox         | 13×7 | 14×8      | text, grid              |
| iso-cube        | 15×11| 16×12     | cross, grid, text       |
| cat-cat-simple  | 17×12| 18×13     | text (short), grid      |
| mini-herbivore  | 19×9 | 20×10     | border, wave, grid      |
| chaos           | 19×12| 20×13     | wave, diagonal, cross   |
| recursive-disco | 22×19| 23×20     | text (single char), grid|
| jellyfish       | 33×19| 34×20     | grid (dense fills)      |
| reality-dreams  | 26×24| 27×25     | diagonal (sparse)       |

## Session 2 — Wild 20

### 01-wibwob-jelly
**21 stamps · overlaps=0 · oob=0 · util=0.379**  
Primer: `jellyfish.txt` · pad=1 · margin=4  
Opts: `{"pattern": "text", "text": "WIB|WOB", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140614.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["jellyfish.txt"], "algorithm": "stamp", "padding": 1, "margin": 4, "options": {"pattern": "text", "text": "WIB|WOB", "anchor": "center"}}'
```

---

### 02-spiral-discocat
**15 stamps · overlaps=0 · oob=0 · util=0.18**  
Primer: `recursive-disco-cat.txt` · pad=1 · margin=2  
Opts: `{"pattern": "spiral", "cols": 32, "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140619.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["recursive-disco-cat.txt"], "algorithm": "stamp", "padding": 1, "margin": 2, "options": {"pattern": "spiral", "cols": 32, "anchor": "center"}}'
```

---

### 03-symbient-chaos
**37 stamps · overlaps=0 · oob=0 · util=0.243**  
Primer: `chaos.txt` · pad=1 · margin=3  
Opts: `{"pattern": "text", "text": "SYMBIENT", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140629.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["chaos.txt"], "algorithm": "stamp", "padding": 1, "margin": 3, "options": {"pattern": "text", "text": "SYMBIENT", "anchor": "center"}}'
```

---

### 04-border-jelly
**24 stamps · overlaps=0 · oob=0 · util=0.433**  
Primer: `jellyfish.txt` · pad=0 · margin=1  
Opts: `{"pattern": "border", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140637.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["jellyfish.txt"], "algorithm": "stamp", "padding": 0, "margin": 1, "options": {"pattern": "border", "anchor": "center"}}'
```

---

### 05-wave-monster
**7 stamps · overlaps=0 · oob=0 · util=0.474**  
Primer: `monster-bone-eye.txt` · pad=2 · margin=2  
Opts: `{"pattern": "wave", "cols": 7, "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140641.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["monster-bone-eye.txt"], "algorithm": "stamp", "padding": 2, "margin": 2, "options": {"pattern": "wave", "cols": 7, "anchor": "center"}}'
```

---

### 06-cross-kaomoji
**7 stamps · overlaps=0 · oob=0 · util=0.338**  
Primer: `wibwob-kaomoji.txt` · pad=1 · margin=2  
Opts: `{"pattern": "cross", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140644.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["wibwob-kaomoji.txt"], "algorithm": "stamp", "padding": 1, "margin": 2, "options": {"pattern": "cross", "anchor": "center"}}'
```

---

### 07-grid-rainbow
**112 stamps · overlaps=0 · oob=0 · util=0.145**  
Primer: `rainbow-horror.txt` · pad=1 · margin=3  
Opts: `{"pattern": "grid", "cols": 14, "rows": 8, "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140659.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["rainbow-horror.txt"], "algorithm": "stamp", "padding": 1, "margin": 3, "options": {"pattern": "grid", "cols": 14, "rows": 8, "anchor": "center"}}'
```

---

### 08-diag-chaos
**6 stamps · overlaps=0 · oob=0 · util=0.039**  
Primer: `chaos.txt` · pad=1 · margin=2  
Opts: `{"pattern": "diagonal", "anchor": "tl"}`  
Snap: `logs/screenshots/tui_20260223_140702.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["chaos.txt"], "algorithm": "stamp", "padding": 1, "margin": 2, "options": {"pattern": "diagonal", "anchor": "tl"}}'
```

---

### 09-ai-herbivore
**19 stamps · overlaps=0 · oob=0 · util=0.093**  
Primer: `mini-herbivore.txt` · pad=1 · margin=6  
Opts: `{"pattern": "text", "text": "AI", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140709.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["mini-herbivore.txt"], "algorithm": "stamp", "padding": 1, "margin": 6, "options": {"pattern": "text", "text": "AI", "anchor": "center"}}'
```

---

### 10-wave-dreams-bot
**12 stamps · overlaps=0 · oob=0 · util=0.215**  
Primer: `reality-dreams.txt` · pad=2 · margin=2  
Opts: `{"pattern": "wave", "cols": 12, "anchor": "bottom"}`  
Snap: `logs/screenshots/tui_20260223_140713.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["reality-dreams.txt"], "algorithm": "stamp", "padding": 2, "margin": 2, "options": {"pattern": "wave", "cols": 12, "anchor": "bottom"}}'
```

---

### 11-grid-chaos-wall
**40 stamps · overlaps=0 · oob=0 · util=0.262**  
Primer: `chaos.txt` · pad=1 · margin=4  
Opts: `{"pattern": "grid", "cols": 10, "rows": 4, "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140723.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["chaos.txt"], "algorithm": "stamp", "padding": 1, "margin": 4, "options": {"pattern": "grid", "cols": 10, "rows": 4, "anchor": "center"}}'
```

---

### 12-wibwob-iso
**29 stamps · overlaps=0 · oob=0 · util=0.138**  
Primer: `iso-cube-cornered.txt` · pad=1 · margin=6  
Opts: `{"pattern": "text", "text": "WIB|WOB", "anchor": "center"}`  
Snap: `logs/screenshots/?`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["iso-cube-cornered.txt"], "algorithm": "stamp", "padding": 1, "margin": 6, "options": {"pattern": "text", "text": "WIB|WOB", "anchor": "center"}}'
```

---

### 13-spiral-iso
**19 stamps · overlaps=0 · oob=0 · util=0.09**  
Primer: `iso-cube-cornered.txt` · pad=0 · margin=3  
Opts: `{"pattern": "spiral", "cols": 40, "turns": 5, "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140738.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["iso-cube-cornered.txt"], "algorithm": "stamp", "padding": 0, "margin": 3, "options": {"pattern": "spiral", "cols": 40, "turns": 5, "anchor": "center"}}'
```

---

### 14-border-rainbow
**86 stamps · overlaps=0 · oob=0 · util=0.111**  
Primer: `rainbow-horror.txt` · pad=1 · margin=1  
Opts: `{"pattern": "border", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140751.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["rainbow-horror.txt"], "algorithm": "stamp", "padding": 1, "margin": 1, "options": {"pattern": "border", "anchor": "center"}}'
```

---

### 15-helloworld-cats
**43 stamps · overlaps=0 · oob=0 · util=0.252**  
Primer: `cat-cat-simple.txt` · pad=1 · margin=2  
Opts: `{"pattern": "text", "text": "HELLO|WORLD", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140802.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["cat-cat-simple.txt"], "algorithm": "stamp", "padding": 1, "margin": 2, "options": {"pattern": "text", "text": "HELLO|WORLD", "anchor": "center"}}'
```

---

### 16-cross-jelly
**13 stamps · overlaps=0 · oob=0 · util=0.235**  
Primer: `jellyfish.txt` · pad=1 · margin=2  
Opts: `{"pattern": "cross", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140807.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["jellyfish.txt"], "algorithm": "stamp", "padding": 1, "margin": 2, "options": {"pattern": "cross", "anchor": "center"}}'
```

---

### 17-wibwobdos-paradox
**57 stamps · overlaps=0 · oob=0 · util=0.149**  
Primer: `paradox.txt` · pad=0 · margin=4  
Opts: `{"pattern": "text", "text": "WIB|WOB|DOS", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140818.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["paradox.txt"], "algorithm": "stamp", "padding": 0, "margin": 4, "options": {"pattern": "text", "text": "WIB|WOB|DOS", "anchor": "center"}}'
```

---

### 18-wave-herb
**17 stamps · overlaps=0 · oob=0 · util=0.084**  
Primer: `mini-herbivore.txt` · pad=1 · margin=3  
Opts: `{"pattern": "wave", "cols": 20, "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140824.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["mini-herbivore.txt"], "algorithm": "stamp", "padding": 1, "margin": 3, "options": {"pattern": "wave", "cols": 20, "anchor": "center"}}'
```

---

### 19-question-jelly
**4 stamps · overlaps=0 · oob=0 · util=0.072**  
Primer: `jellyfish.txt` · pad=2 · margin=8  
Opts: `{"pattern": "text", "text": "?", "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140827.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["jellyfish.txt"], "algorithm": "stamp", "padding": 2, "margin": 8, "options": {"pattern": "text", "text": "?", "anchor": "center"}}'
```

---

### 20-spiral-40cats
**19 stamps · overlaps=0 · oob=0 · util=0.112**  
Primer: `cat-cat-simple.txt` · pad=1 · margin=2  
Opts: `{"pattern": "spiral", "cols": 40, "turns": 4, "anchor": "center"}`  
Snap: `logs/screenshots/tui_20260223_140833.txt`

```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["cat-cat-simple.txt"], "algorithm": "stamp", "padding": 1, "margin": 2, "options": {"pattern": "spiral", "cols": 40, "turns": 4, "anchor": "center"}}'
```

---
