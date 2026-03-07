---
name: figlet-videographer
description: Create typographic video sequences using figlet text animations in WibWob-DOS. Use when composing figlet-based title cards, animated text sequences, or typographic VJ elements synced to music.
---
# Figlet Typographic Videographer

Create stop-frame typographic animations using figlet word arrangements as keyframes in WibWob-DOS.

## When to Use

- Composing visual/concrete poetry in the TUI
- Creating typographic title sequences or splash screens
- Building animated text art with multiple fonts and positions
- Arranging figlet words as a spatial composition on the desktop

## Prerequisites

- WibWob-DOS TUI running with IPC socket at `/tmp/wwdos.sock`
- API server running on port 8099
- `figlet` installed (`brew install figlet` / `apt install figlet`)

## Available Commands

All commands go through `POST /menu/command`:

| Command | Args | Description |
|---------|------|-------------|
| `open_figlet_text` | `text`, `font` | Open auto-sized figlet window |
| `move_window` | `id`, `x`, `y` | Move window to position |
| `resize_window` | `id`, `w`, `h` | Resize window |
| `figlet_set_color` | `id`, `fg`, `bg` | Set colours (hex `#RRGGBB`) |
| `figlet_set_font` | `id`, `font` | Change font |
| `figlet_set_text` | `id`, `text` | Change text |
| `window_shadow` | `id`, `on` | Toggle shadow (`true`/`false`) |
| `close_window` | `id` | Close specific window |
| `close_all` | — | Clear canvas |
| `desktop_gallery` | `on` | Hide/show menu & status bars |
| `desktop_color` | `fg`, `bg` | Set desktop background (0-15) |
| `desktop_texture` | `char` | Set desktop fill character |
| `preview_figlet` | `text`, `font`, `width`, `info` | Preview render (add `info=true` for JSON metadata) |
| `list_figlet_fonts` | — | List available font names |
| `screenshot` | — | Capture TUI framebuffer |

## Available Fonts

Common figlet fonts and their character:

- **mini** — tiny 2-line, good for whispered words
- **small** — compact 4-line, readable at small size
- **standard** — default 6-line, clean and balanced
- **big** — tall 8-line, bold presence
- **banner** — blocky hash-mark style, loud and heavy

Use `list_figlet_fonts` to see all installed fonts.

## Workflow

### 1. Plan the composition

Sketch word positions on a grid. Canvas is typically 156×37 (menu bar takes row 0, status bar takes last row). Use `desktop_gallery` mode for full canvas.

### 2. Preview fonts

```bash
curl -X POST http://127.0.0.1:8099/menu/command \
  -H "Content-Type: application/json" \
  -d '{"command":"preview_figlet","args":{"text":"hello","font":"big"}}'
```

### 3. Place words

```bash
# Open
curl -X POST http://127.0.0.1:8099/menu/command \
  -d '{"command":"open_figlet_text","args":{"text":"drift","font":"banner"}}'

# Get window ID from /state
# Move to position
curl -X POST http://127.0.0.1:8099/menu/command \
  -d '{"command":"move_window","args":{"id":"w3","x":"25","y":"4"}}'
```

### 4. Save as timeline

Capture `/state`, extract window positions into a `timeline.json` (see examples/).

### 5. Play back

```bash
python3 examples/play.py examples/01-drift-poem.json
```

## Timeline Format

```json
{
  "meta": {
    "title": "poem title",
    "canvas": {"width": 156, "height": 37},
    "bg": {"fg": 0, "bg": 0, "texture": " "},
    "gallery_mode": true
  },
  "frames": [
    {
      "t": 0,
      "hold": 5,
      "transition": "cut",
      "words": [
        {"text": "drift", "font": "banner", "x": 25, "y": 4, "fg": "#CCCCCC", "bg": "#000000"},
        {"text": "we", "font": "mini", "x": 5, "y": 2, "fg": "#CCCCCC", "bg": "#000000"}
      ]
    }
  ]
}
```

### Transitions

- `cut` — instant swap between frames (default)
- `typewriter` — words appear one at a time with `typewriter_delay` seconds between

## Examples

- `examples/01-drift-poem.json` — "we drift through static" — 15 words across canvas
- `examples/play.py` — Timeline playback engine

## Wrap Detection

Before placing a word, check if the font wraps it onto multiple lines:

```bash
curl -X POST http://127.0.0.1:8099/menu/command \
  -d '{"command":"preview_figlet","args":{"text":"symbient","font":"isometric1","width":"0","info":"true"}}'
```

Returns JSON with layout metadata:
```json
{
  "text": "symbient", "font": "isometric1",
  "font_height": 11, "total_lines": 22, "max_width": 68,
  "rows": 2, "wrapped": true,
  "window_width": 74, "window_height": 14
}
```

- `rows` = `total_lines / font_height` — how many rows of text figlet produced
- `wrapped: true` = the text didn't fit on one line — pick a smaller font or shorter text
- `window_width` / `window_height` = recommended window size (includes chrome)

Font heights (from catalogue): mini=4, small=5, standard=6, big=8, banner=7, banner3-D=8, block=8, doom=8, gothic=9, larry3d=9, isometric1=11, 3-d=8.

## Audio-Synced VJ Mode (Future)

The videographer can sync to audio from the wibandwob-heartbeat chiptune library (221 mp3s across 20+ categories). Think ASCII VJing — words and primers appear/move/change in time with music.

### Audio source

`/Users/james/Repos/wibandwob-heartbeat/output/` — chiptunes, stingers, voiceovers, mixed tracks. Key folders:
- `reels/` — 36 tracks (short loops, good for ambient/cycling)
- `audio/` — 29 standalone tracks
- `swarm-fossil-aquarium/` — 17 atmospheric pieces
- `wibwobwinamp/` — 10 winamp-era chiptunes
- `scramble-microfilm-v2/interstitials/` — short stingers (2-5s, good for word reveals)
- `memory-architecture-*` — thematically perfect for the symbient poem

### Timeline with audio cues

```json
{
  "meta": {
    "title": "symbient live",
    "audio": "/path/to/track.mp3"
  },
  "frames": [
    {"t": 0.0, "hold": 2, "transition": "typewriter", "words": [...]},
    {"t": 4.5, "audio_cue": "stinger.mp3", "words": [...]},
    {"t": 8.0, "primer": "minds-meet-architecture.txt", "x": 100, "y": 5}
  ]
}
```

### Playback (working MVP)

`play.py` handles it all — run with:

```bash
python3 .pi/skills/figlet-videographer/examples/play.py timeline.json [--mute] [--loop] [--dry-run]
```

1. `afplay` (macOS) plays the backing track as a background process
2. Timeline frames trigger at their `t` timestamps relative to audio start
3. Stingers (`afplay &`) layer over the backing track on word reveals
4. Primers (ASCII art) appear alongside figlet words as visual illustrations
5. All audio child processes are cleaned up on exit / Ctrl-C

### Speech (macOS `say`)

Words can speak themselves as they appear. Add `say` to any word:

```json
{ "text": "garden", "font": "big", "x": 55, "y": 27,
  "say": { "voice": "Wobble", "rate": 60 } }
```

Set default voice in `meta.speech`:
```json
"speech": { "enabled": true, "default_voice": "Wobble", "default_rate": 130 }
```

Best voices for wibwob: **Wobble** (warm), **Cellos** (deep/slow), **Whisper** (quiet connective words like "the", "in the"). Keep palette small — 2-3 voices per poem. Fun accents: Trinoids, Zarvox, Bells, Bubbles, Bad News.

### Spawn-at-position

`open_figlet_text` now accepts `x`, `y` args — window appears directly at the target position (no centre→move jump). `play.py` uses this automatically when words have `x`/`y` set.

## Recording

`record.sh` captures a performance as .cast / .gif / .mp4 with speech + music:

```bash
# Run from a REAL terminal (not pi/codex) — asciinema needs TTY
./examples/record.sh examples/03-garden-poem-av.json --gif --mp4
```

Pipeline: asciinema (tmux attach read-only) → `.cast` → `agg --font-size 28` → `.gif` → ffmpeg (mix speech .aiff + backing .mp3) → `.mp4`

- Canvas cleared before recording starts (no stale windows from previous runs)
- Speech pre-rendered to .aiff files, mixed at correct timestamps into final audio
- `stty` forces TTY to canvas size so tmux shows full pane
- `pad` filter handles odd dimensions for libx264

Requirements: `asciinema`, `agg` (`brew install agg`), `ffmpeg`.

## Agent Guide

See **[AGENT-GUIDE.md](AGENT-GUIDE.md)** for detailed guidance on:
- Layout planning workflow (measure → plan → check → place)
- Font cheat sheet with exact sizes
- Small primer list (safe sizes)
- Common mistakes and fixes
- Audio source guide (backing tracks, stingers)
- Recording checklist
- Iteration pattern for when compositions need tightening

## Known Issues

- Duplicate word titles (e.g. two "we" windows) — second `place_word` may move the first
- Primer windows reuse gallery viewer — each new primer replaces the last
- `afplay` / `say` are macOS-only — swap for `mpv --no-video` / `espeak` on Linux
- Large primers (>45w or >22h) overwhelm compositions — use small ones only

## Tips

- **mini** for connective words (and, the, but, in the, through the)
- **doom** or **larry3d** for key verbs/nouns — they carry visual weight
- **standard** for everything else — clean and balanced
- Always measure with `preview_figlet info=true` before placing
- Gallery mode + black desktop = clean presentation canvas
- Merge connective words ("through the" as one) to save horizontal space
- Keep voice palette to 2-3 (Wobble, Cellos, Whisper)
