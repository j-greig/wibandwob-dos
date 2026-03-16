# WibWob-DOS Cinema — How the Recording Pipeline Works

## Overview

Record a choreographed WibWob-DOS show as a retina-quality GIF/MP4 with synced SFX audio.
The pipeline captures frames from the app's own render buffer (no tmux, no ACS garbling)
and composites with a mixed audio track.

## The Pipeline

### 1. Automation Script (the "show")

`scratch/cli-experiments/creature-word-bomb-sfx.sh` is the reference choreography.
It drives WibWob-DOS via CLI/API — opening primers, figlet text, changing themes, playing SFX.

Key conventions inside a show script:
```bash
wibwob primer.open --filePath "path.txt" --x 5 --y 3
wibwob figlet.open --text "HELLO" --font doom
wibwob cmd desktop.clear-all
wibwob theme.set --name wibwob-phosphor
sfx "path.wav"              # fire-and-forget SFX
sfx "path.wav" && sleep N   # SFX + pause for timing
```

### 2. Recording Wrapper — `scripts/wibwob-record.sh run`

```bash
bash scripts/wibwob-record.sh run scratch/cli-experiments/creature-word-bomb-sfx.sh --cols 101 --rows 73
```

What it does:
- Writes an **asciicast v2 header** (JSONL `.cast` file)
- Starts a **background capture loop** polling `GET /screenshot/ansi` at **10fps**
  — blessed's own clean render buffer, no tmux capture-pane, no ACS garbling
- Exports `WIBWOB_RECORD_START_MS` so the show script's `cues.tsv` timestamps align
- Runs the choreography script
- On script exit, stops capture → `scratch/recordings/rec-<epoch>.cast`
- Auto-mixes SFX from `cues.tsv` → `scratch/recordings/rec-<epoch>-audio.mp3`

### 3. GIF Render — `agg` (asciinema GIF generator)

```bash
agg rec-<epoch>.cast output.gif --font-size 32 --line-height 1.1 --theme github-dark
```

| Setting | Value | Why |
|---------|-------|-----|
| `--font-size` | 32 | 2× retina quality |
| `--line-height` | 1.1 | Closest to real terminal cell proportions |
| `--theme` | github-dark | Best match for wibwob-dark-nord |

Or use the built-in export subcommand (does GIF + optional MP4):
```bash
bash scripts/wibwob-record.sh export rec-<epoch>.cast --audio rec-<epoch>-audio.mp3
```

### 4. MP4 Composite — ffmpeg

```bash
ffmpeg -y -ignore_loop 0 -i output.gif -i rec-<epoch>-audio.mp3 \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -pix_fmt yuv420p -shortest -movflags +faststart \
  output-retina.mp4
```

The `scale=trunc(iw/2)*2:trunc(ih/2)*2` ensures even pixel dimensions (required by libx264).

## Quick Start — Full Recording

```bash
# 1. Ensure WibWob-DOS is running
bash scripts/ensure-running.sh

# 2. Record the show (captures frames + mixes audio automatically)
bash scripts/wibwob-record.sh run scratch/cli-experiments/creature-word-bomb-sfx.sh

# 3. Export to GIF + MP4
bash scripts/wibwob-record.sh export scratch/recordings/rec-<epoch>.cast \
  --audio scratch/recordings/rec-<epoch>-audio.mp3

# 4. For retina MP4 from a separately-rendered GIF:
ffmpeg -y -ignore_loop 0 -i my-retina.gif -i rec-<epoch>-audio.mp3 \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -pix_fmt yuv420p -shortest -movflags +faststart \
  output-retina.mp4
```

## Audio Mixing

SFX cues are logged during the show to a `cues.tsv` file (timestamp + wav path).
The mixer script reads these and composites them into a single MP3:

```bash
uv run scratch/cli-experiments/mix-sfx-track.py path/to/cues.tsv output.mp3
```

`wibwob-record.sh run` does this automatically if it finds a `cues.tsv` in the
latest capture directory.

## The Missing Piece: Voice Sync

AppleScript `say` voices (Samantha, Zarvox, etc.) were attempted but the two-clock
problem (visual capture vs audio render running independently) causes drift.

The proposed solution is the `.scpt.md` single-timeline format (documented in
`RECORDING.md`) which renders audio FIRST, then replays visuals against audio
timecodes. Status: not yet implemented.

## Key Files

| File | Role |
|------|------|
| `../scripts/wibwob-record.sh` | Recording + export pipeline (canonical: `scripts/wibwob-record.sh` in repo) |
| `../scripts/example-choreography.sh` | Reference choreography script (source: `scratch/cli-experiments/creature-word-bomb-sfx.sh`) |
| `../scripts/mix-sfx-track.py` | Cue-based SFX audio mixing (source: `scratch/cli-experiments/mix-sfx-track.py`) |
| `scratch/cli-experiments/gen-sfx.py` | Chiptune SFX generator (repo root) |
| `RECORDING.md` | Full architecture docs + history (repo root) |

## Dependencies

- `agg` — asciinema GIF generator (`brew install agg` or cargo install)
- `ffmpeg` — video compositing
- `asciinema` — optional, for uploading `.cast` files to asciinema.org
- `uv` + `pydub` — for `mix-sfx-track.py`
- WibWob-DOS running with API on port 8099
