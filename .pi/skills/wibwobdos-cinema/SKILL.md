---
name: wibwobdos-cinema
description: >
  Record choreographed WibWob-DOS TUI sessions as retina GIF/MP4 with synced
  chiptune SFX audio. Use when recording a demo, making a show reel, capturing
  a choreographed sequence, exporting video from the TUI, or producing any
  polished visual artifact of the running desktop. Also use when the user asks
  to "record this", "make a video", "export a GIF", "capture a reel", or
  mentions "cinema", "wibwob-record", or "make an MP4".
---

# WibWob-DOS Cinema

Four-stage pipeline: choreography script → asciicast capture → retina GIF → MP4 with audio.

## Pipeline

### 1. Write or reuse a choreography script

The show script drives WibWob-DOS via CLI. See `scripts/example-choreography.sh` for the
reference. Key patterns:

```bash
wibwob primer.open --filePath "path.txt" --x 5 --y 3
wibwob figlet.open --text "HELLO" --font doom
wibwob cmd desktop.clear-all
wibwob theme.set --name wibwob-phosphor
sfx "path.wav"              # fire-and-forget SFX
sfx "path.wav" && sleep N   # SFX + pause for timing
```

### 2. Record

```bash
bash scripts/wibwob-record.sh run <script.sh> [--cols 101 --rows 73]
```

- Captures frames via `GET /screenshot/ansi` at 10fps (blessed's clean render buffer)
- Exports `WIBWOB_RECORD_START_MS` so cues.tsv timestamps align with cast
- Auto-mixes SFX from `cues.tsv` → `rec-<epoch>-audio.mp3`
- Output: `scratch/recordings/rec-<epoch>.cast` + `.mp3`

### 3. Export GIF

```bash
bash scripts/wibwob-record.sh export rec-<epoch>.cast --audio rec-<epoch>-audio.mp3
```

Or render the GIF manually with custom settings:

```bash
agg rec-<epoch>.cast output.gif --font-size 32 --line-height 1.1 --theme github-dark
```

### 4. Composite MP4

The export subcommand produces an MP4 automatically when `--audio` is given.
For a separate retina composite:

```bash
ffmpeg -y -ignore_loop 0 -i output.gif -i rec-<epoch>-audio.mp3 \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -pix_fmt yuv420p -shortest -movflags +faststart \
  output-retina.mp4
```

## Key Settings

| Setting | Value | Why |
|---------|-------|-----|
| Capture source | `GET /screenshot/ansi` | Clean ANSI, no ACS garbling |
| Capture rate | 10fps (100ms) | Quality vs file size |
| agg `--font-size` | 32 | 2× retina |
| agg `--line-height` | 1.1 | Matches terminal cell proportions |
| agg `--theme` | github-dark | Best match for wibwob-dark-nord |

## Known Limitation: Voice Sync

AppleScript `say` voices drift because visual capture and audio render are two
independent clocks. The proposed fix is the `.scpt.md` single-timeline format
(renders audio first, then replays visuals against timecodes). Not yet implemented.
See [references/HOWTO.md](references/HOWTO.md) for full details.

## References

- [references/HOWTO.md](references/HOWTO.md) — full pipeline walkthrough, history, and architecture
- [RECORDING.md](../../RECORDING.md) (repo root) — original recording architecture doc

## Dependencies

- `agg` — asciinema GIF generator
- `ffmpeg` — video compositing
- `uv` + `pydub` — for `scripts/mix-sfx-track.py`
- WibWob-DOS running with API on port 8099
