# RECORDING.md — How to record WibWob-DOS sessions

## Quick Start

```bash
# Record a script (captures TUI via /screenshot/ansi API at 10fps)
bash scripts/wibwob-record.sh run scratch/cli-experiments/creature-word-bomb-sfx.sh

# Export to GIF + MP4 with audio
bash scripts/wibwob-record.sh export scratch/recordings/rec-XXXX.cast \
  --audio scratch/recordings/rec-XXXX-audio.mp3
```

## Final Settings

| Setting | Value | Why |
|---------|-------|-----|
| Capture source | `/screenshot/ansi` API endpoint | Clean ANSI, no ACS issues |
| Cast format | asciicast v2 with `\x1b[{row};1H` cursor positioning | Prevents staircase misalignment |
| agg font-size | 32 | 2x retina quality |
| agg line-height | 1.1 | Closest to actual terminal cell proportions |
| agg theme | github-dark | Best match for wibwob-dark-nord appearance |
| Capture rate | 10fps (100ms sleep between frames) | Balances quality vs file size |
| Audio mix | `mix-sfx-track.py` from `cues.tsv` | All SFX hits at correct timestamps |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────┐     ┌──────────┐
│ WibWob-DOS  │────▶│ /screenshot/ │────▶│  .cast  │────▶│ agg      │──▶ .gif
│ (blessed)   │     │ ansi API     │     │ (JSONL) │     │ renderer │
└─────────────┘     └──────────────┘     └─────────┘     └──────────┘
                                                                │
┌─────────────┐     ┌──────────────┐                     ┌──────┴─────┐
│ sfx() calls │────▶│  cues.tsv    │────▶ mix-sfx-track ─│  ffmpeg    │──▶ .mp4
│ (ffplay)    │     │  (timestamps)│     .py → .mp3      │  composite │
└─────────────┘     └──────────────┘                     └────────────┘
```

## How We Got Here

### Problem: tmux capture-pane produces garbled output

Blessed (the TUI library) uses the VT100 **Alternate Character Set** (ACS)
for box-drawing. It sends `\x0e` (Shift Out) to enter ACS mode, then uses
ASCII letters as box-drawing: `a`=fill, `q`=horizontal, `x`=vertical,
`l`=top-left, etc. `\x0f` (Shift In) returns to normal.

`tmux capture-pane -e` preserves these raw ACS bytes. agg (the asciicast
GIF renderer) doesn't understand ACS, so it renders literal `a`, `q`, `x`
characters instead of `░`, `─`, `│`.

### Attempt 1: ACS translation script

Wrote `scripts/acs-translate.py` to convert ACS bytes to Unicode box-drawing.
This worked for the chrome but had edge cases:
- `a` → `░` was wrong (blessed uses `a` as blank fill, should be space)
- ACS bytes inside ANSI escape sequences got translated incorrectly
- Column alignment broke because multi-byte UTF-8 chars changed line lengths

Fixed `a` → space and added ANSI escape sequence tracking. Translation
became correct but the pipeline was fragile.

### Attempt 2: /screenshot/ansi API endpoint

Discovered WibWob-DOS already has `GET /screenshot/ansi` which returns
blessed's screen dump with proper ANSI colour codes and **no ACS issues**.
Blessed internally resolves ACS to the correct characters before the API
returns them.

This eliminated all ACS problems. The capture loop now polls this endpoint
at 10fps instead of using tmux capture-pane.

### Aspect ratio

agg renders terminal cells taller than wide (~0.76:1 ratio) regardless of
font size. Real Ghostty renders cells wider than tall on a landscape monitor.
This means agg output is always portrait-ish.

Tested line-height values from 0.8 to 1.4 — cell proportions stay the same,
only overall height changes. font-size 16 + line-height 1.1 gave the best
balance at 1x. Doubling to font-size 32 gives 2x retina at the same ratio.

The user accepted the portrait-ish ratio from github-dark theme as "decent".
For exact landscape matching, ffmpeg post-scale would be needed:
```bash
ffmpeg -i input.gif -vf "scale=iw*2:ih,scale=1920:-2" output.mp4
```

### Cast format

asciicast v2 is JSONL. Each frame is `[timestamp, "o", "terminal_data"]`.
The terminal data must include cursor positioning — bare `\n` causes
staircase rendering. Each line is prefixed with `\x1b[{row};1H` to
position the cursor, preceded by `\x1b[2J\x1b[H` to clear and home.

## Files

| File | Role |
|------|------|
| `scripts/wibwob-record.sh` | Recording + export pipeline |
| `scripts/acs-translate.py` | ACS → Unicode translator (kept for tmux fallback) |
| `scratch/cli-experiments/mix-sfx-track.py` | Cue-based audio mixing |
| `scratch/cli-experiments/gen-sfx.py` | Chiptune SFX generator |
| `scratch/cli-experiments/gen-explosions.py` | Explosion SFX generator |
| `scratch/cli-experiments/gen-arrange.py` | Tile-snap SFX generator |
| `scratch/cli-experiments/gen-fin-melody.py` | Fin micromelody generator |

## Uploading to asciinema.org

```bash
asciinema upload scratch/recordings/rec-XXXX.cast
```

Note: asciinema.org plays back terminal-only (no audio). The MP4 has synced audio.
