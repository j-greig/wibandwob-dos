---
name: img-to-ascii
description: Convert images to plain-text ASCII art primers for the TUI. Covers sourcing images, tuning conversion parameters, and opening the result as a primer window in the running app.
---

# img-to-ascii

Convert any image to a plain-text `.txt` primer suitable for use in WibWob-DOS.

## Primary tool: chafa

```
brew install chafa        # macOS
sudo apt install chafa    # Ubuntu
```

Version 1.14+ recommended. The key flags for primers:

| Flag | Value | Notes |
|------|-------|-------|
| `-f symbols` | — | Character art mode (not pixel/sixels) |
| `--symbols ascii` | — | Plain ASCII only — safe for .txt primers |
| `-c none` | — | No ANSI colour codes — required for plain .txt output |
| `-s WxH` | e.g. `130x60` | Max output dimensions in cols × rows |
| `--invert` | — | Swap fg/bg — use for light-on-dark paintings |
| `--font-ratio W/H` | `1/2` | Default and correct for WibWob-DOS (cells are 2× taller than wide) |
| `--work N` | `1-9` | CPU effort, default 5. 9 = slower but better quality |

## Basic usage

```bash
chafa -f symbols --symbols ascii -c none -s 130x60 source.jpg > primers/myfile.txt
```

## Size guidance

| Use | Width | Height | Notes |
|-----|-------|--------|-------|
| Small accent | 52 | 20 | Standard small primer window |
| Medium | 80-100 | 35-50 | Good for portraits |
| Large / hero | 120-140 | 55-70 | Full-canvas art piece |
| Wide panoramic | 180-200 | 40-50 | Landscapes, Nighthawks-style |

## Invert guidance

- To invert an image → add `--invert` (use sparingly)
- Already dark image (night scene, dark background) → no flag needed

## Known good conversions

| File | Source | Flags | Notes |
|------|--------|-------|-------|
| `nighthawks.txt` | Hopper, Nighthawks 1942 | `-s 200x50` | No invert — diner silhouette already dark |
| `pearl-earring.txt` | Vermeer, 1665 | `-s 130x60 --invert` | Face shape and eyes legible |
| `the-scream.txt` | Munch, 1893 | — | ❌ Swirling forms merge — unreadable at any width |
| `mona-lisa.txt` | da Vinci | — | Already in primer library |

## Sourcing images

Wikimedia Commons rate-limits thumbnails (429). Use full-res URLs with a User-Agent:

```bash
# Good: full-res URL, User-Agent header
curl -sL -A "Mozilla/5.0" "https://upload.wikimedia.org/wikipedia/commons/PATH/FILE.jpg" -o /tmp/img.jpg

# Bad: thumbnail URL (gets 429)
curl -sL "https://upload.wikimedia.org/.../800px-FILE.jpg"
```

Large images (>89MP) trigger a PIL DecompressionBombWarning if you ever fall back to the Python script — harmless.

## Teleporting into the TUI

```bash
# Open as primer window (appears instantly)
curl -s -X POST http://127.0.0.1:8099/view/primer/open \
  -H "Content-Type: application/json" \
  -d '{"filePath":"/absolute/path/to/file.txt"}'

# Get the new window ID
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json; s=json.load(sys.stdin)
ws=[w for w in s['windows'] if w.get('appType')!='wibwob-agent']
print(ws[-1]['id'])
"

# Position it
curl -s -X POST http://127.0.0.1:8099/windows/batch \
  -H "Content-Type: application/json" \
  -d '{"ops":[{"id": ID, "x":2, "y":2, "w":134, "h":74}]}'
```

## Full workflow example

```bash
# 1. Download
curl -sL -A "Mozilla/5.0" "https://upload.wikimedia.org/wikipedia/commons/PATH/FILE.jpg" -o /tmp/source.jpg

# 2. Convert
chafa -f symbols --symbols ascii -c none -s 130x60 --invert /tmp/source.jpg > primers/myart.txt

# 3. Open in TUI
curl -s -X POST http://127.0.0.1:8099/view/primer/open \
  -H "Content-Type: application/json" \
  -d '{"filePath":"/Users/james/Repos/wibandwob-dos/primers/myart.txt"}'

# 4. Screenshot to check
./scripts/screenshot-window.sh myart
```

## Tuning iteration loop

```bash
# Tweak flags and re-open — TUI reloads from disk, no restart needed
chafa -f symbols --symbols ascii -c none -s 140x65 --invert --work 9 /tmp/source.jpg > /tmp/test.txt
curl -s -X POST http://127.0.0.1:8099/view/primer/open \
  -H "Content-Type: application/json" -d '{"filePath":"/tmp/test.txt"}'
./scripts/screenshot-window.sh test
```

Typical iteration: try default flags → check screenshot → bump `--work` or adjust `-s` → repeat. Usually 2-3 passes.

---

## Fallback: Python script (no chafa)

If chafa is unavailable, use `scripts/img-to-ascii.py` (requires `pip3 install Pillow`):

```bash
python3 scripts/img-to-ascii.py <image> --width 130 --out primers/myfile.txt
```

| Flag | Default | Notes |
|------|---------|-------|
| `--width` | 80 | Output columns |
| `--contrast` | 1.4 | Boost to 1.6-2.2 for flat-midtone photos |
| `--invert` | off | For light-on-dark paintings |
| `--ramp` | dense | `dense`, `simple`, or `block` |
| `--out` | stdout | Write to file and print dimensions |

Prefer chafa. The Python script produces coarser output and handles fewer image formats.
