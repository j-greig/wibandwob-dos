---
name: img-to-ascii
description: Convert images to plain-text ASCII art primers for the TUI. Covers sourcing images, tuning conversion parameters, and opening the result as a primer window in the running app.
---

# img-to-ascii

Convert any image to a plain-text `.txt` primer suitable for use in WibWob-DOS.

## Script

```
scripts/img-to-ascii.py
```

Requires: `pip3 install Pillow` (Pillow only — no numpy needed)

## Basic usage

```bash
python3 scripts/img-to-ascii.py <image> --width 130 --out primers/myfile.txt
```

## Parameters

| Flag | Default | Notes |
|------|---------|-------|
| `--width` | 80 | Output columns. 70–80 for small, 120–140 for medium, 200+ for wide/panoramic |
| `--contrast` | 1.4 | 1.6–2.2 usually needed. Bump high for photos with flat midtones |
| `--invert` | off | Invert brightness — use for light-on-dark paintings (pearl earring, scream) |
| `--ramp` | dense | `dense` (default), `simple`, `block` |
| `--out` | stdout | Write to file and print dimensions |

## What works well

- Strong silhouettes with dark/light separation (Nighthawks, The Scream)
- Faces with high contrast and dark backgrounds (Girl with a Pearl Earring)
- Paintings > photographs — more graphic, fewer gradients
- Landscapes with clear horizon lines

## What doesn't work

- Low-contrast photos — boost `--contrast` to 2.0+
- Very small widths for complex images — face needs 100+ cols to read
- Light paintings without `--invert` — they render as solid noise

## Known good conversions

| File | Source | Width | Contrast | Invert | Notes |
|------|--------|-------|----------|--------|-------|
| `nighthawks.txt` | Hopper, Nighthawks 1942 | 200 | 2.0 | no | Diner/street silhouette, very readable |
| `pearl-earring.txt` | Vermeer, 1665 | 130 | 2.2 | yes | Eyes legible, face shape clear |
| `the-scream.txt` | Munch, 1893 | 130 | 2.0 | yes | ❌ Doesn't work — swirling sky and figure merge into noise, shape unreadable at any width tested |
| `mona-lisa.txt` | da Vinci (hand-made) | — | — | — | In primer library already |

## Sourcing images

Wikimedia Commons rate-limits thumbnails (429). Use full-res URLs:

```bash
# Good: full-res URL, User-Agent header
curl -sL -A "Mozilla/5.0" "https://upload.wikimedia.org/wikipedia/commons/PATH/FILE.jpg" -o /tmp/img.jpg

# Bad: thumbnail URL (gets 429)
curl -sL "https://upload.wikimedia.org/.../800px-FILE.jpg"
```

Large images (>89MP) trigger a PIL DecompressionBombWarning — harmless, just a warning.

## Teleporting into the TUI

Once the `.txt` file exists, open it as a primer in the running app:

```bash
# One-liner — open and it appears instantly
curl -s -X POST http://127.0.0.1:8099/view/primer/open \
  -H "Content-Type: application/json" \
  -d '{"filePath":"/absolute/path/to/file.txt"}'

# Then position it (get ID from /state first)
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json; s=json.load(sys.stdin)
ws=[w for w in s['windows'] if w.get('appType')!='wibwob-agent']
print(ws[-1]['id'])  # latest window
"

curl -s -X POST http://127.0.0.1:8099/windows/batch \
  -H "Content-Type: application/json" \
  -d '{"ops":[{"id": ID, "x":2, "y":2, "w":134, "h":74}]}'
```

Or use `preview-scene` if it's wired into a timeline scene already.

## Full workflow example

```bash
# 1. Download
curl -sL -A "Mozilla/5.0" "https://..." -o /tmp/source.jpg

# 2. Convert
python3 scripts/img-to-ascii.py /tmp/source.jpg \
  --width 130 --contrast 2.0 --invert \
  --out scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/myart.txt

# 3. Open in TUI
curl -s -X POST http://127.0.0.1:8099/view/primer/open \
  -H "Content-Type: application/json" \
  -d '{"filePath":"/Users/james/Repos/wibandwob-dos/scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/myart.txt"}'

# 4. Screenshot to check
screencapture -x -D 2 /tmp/check.png
```

## Tuning iteration loop

```bash
# Tweak and re-open — TUI reloads from disk on open, no restart needed
python3 scripts/img-to-ascii.py /tmp/source.jpg --width 140 --contrast 2.4 --invert --out /tmp/test.txt
curl -s -X POST http://127.0.0.1:8099/view/primer/open -H "Content-Type: application/json" \
  -d '{"filePath":"/tmp/test.txt"}'
screencapture -x -D 2 /tmp/iter.png
```

Iterate width/contrast/invert until the shape reads. Usually 2–3 passes.
