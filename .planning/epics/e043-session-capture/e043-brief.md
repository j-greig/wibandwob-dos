---
id: E043
title: "Session Capture & Playback: Record, Export, and Replay TUI Sessions"
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E043 — Session Capture & Playback

## The Problem

WibWob-DOS produces ephemeral visual art — creative pipe scripts, agent-driven
compositions, VJ timelines — that vanish the moment the terminal clears. There
is no first-class way to capture, export, or replay what happened on the desktop.

Current workarounds:
- QuickTime screen recording (external, requires Loopback Audio for SFX, manual
  start/stop, large files, no terminal-native replay)
- `wibwob screenshot` captures a single text frame (no motion, no audio)
- `asciinema` can wrap a shell command but can't attach to a running session
- Creative scripts log `cues.tsv` for offline audio mixing, but this is ad-hoc
  plumbing in each script, not a platform capability

The user should be able to press Record in WibWob-DOS itself, run whatever they
want, press Stop, and get a replayable session with audio — without leaving the
TUI or touching external tools.

## The Vision

```
┌─ View ──────────────────┐
│ ...                     │
│ ● Start Recording  ⌘R  │   ← menu entry, also API/CLI
│ ...                     │
└─────────────────────────┘

Recording...
┌────────────────────────────────────────── wibwob-dark ─── ● REC ── ↻ ─┐
│                                                                        │
│   [... whatever the user/agent does ...]                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────-┘
                                                             ▲
                                                        blinking red dot
                                                        click to stop

Export:
  .cast   → terminal-native replay (asciinema play / agg)
  .mp3    → mixed SFX audio track from cue log
  .mp4    → composited video (cast→gif + audio)
  .wibwob → full session replay (cast + cues + workspace snapshots)
```

## Architecture

### One owner: RecordingService

`src/services/recording-service.ts` — owns all recording state and logic.

```typescript
interface RecordingState {
  status: 'idle' | 'recording' | 'exporting';
  startedAt?: number;
  outputDir?: string;
  castFile?: string;
  cueLog: Array<{ offsetMs: number; file: string; vol?: number }>;
}
```

**No recording logic in CLI, API handlers, or menu callbacks.** Those are thin
adapters that call the service.

### Command catalog entries

| Command ID | Menu | API | CLI | Description |
|------------|------|-----|-----|-------------|
| `recording.start` | View → Start Recording | POST /commands/run | `wibwob recording.start` | Begin capture |
| `recording.stop` | View → Stop Recording | POST /commands/run | `wibwob recording.stop` | End capture |
| `recording.status` | — | POST /commands/run | `wibwob recording.status` | Current state |
| `recording.export` | View → Export Recording | POST /commands/run | `wibwob recording.export` | Render outputs |
| `recording.cue` | — | POST /commands/run | `wibwob recording.cue --file hit.wav` | Log an SFX cue |

All surfaces use the same command path. CLI stays a pure HTTP client.

### Chrome indicator

- Top-right, next to the kaomoji / reload button area
- `● REC` in red, blinking on a timer (toggles every 800ms)
- Clickable — click stops recording (fires `recording.stop`)
- Only visible when `status === 'recording'`
- Implemented in `window-chrome.ts` reading state from RecordingService

### Capture mechanism — the fork

**Option A: Built-in terminal buffer capture (preferred)**
- Service reads the terminal buffer on a timer (e.g. every 100ms)
- Writes `.cast` format directly (asciicast v2 is just JSONL: `[time, "o", "data"]`)
- No external dependency on asciinema
- Works mid-session — can start/stop without restarting the app
- Buffer access: blessed's `screen.screenshot()` or direct TTY read

**Option B: asciinema wrapper**
- Requires wrapping the entire app process in `asciinema rec`
- Cannot start mid-session — must be configured at launch
- External dependency
- Simpler implementation if buffer capture proves hard

**Recommendation:** Start with Option A. The `.cast` format is trivial:
```json
{"version": 2, "width": 180, "height": 51, "timestamp": 1234567890}
[0.0, "o", "frame data here"]
[0.1, "o", "next frame data"]
```
We already have `screen.screenshot()` — just dump it on a timer and diff.

### SFX cue integration

Creative pipe scripts currently do:
```bash
sfx() { ffplay -nodisp -autoexit "$1" 2>/dev/null & }
```

With recording active, scripts can also POST cues to the API:
```bash
sfx() {
  ffplay -nodisp -autoexit "$1" 2>/dev/null &
  wibwob recording.cue --file "$1" 2>/dev/null  # logged if recording, no-op if not
}
```

Or: the service watches for audio events on the system (stretch goal).

The cue log enables offline audio mixing via `mix-sfx-track.py` — same pipeline
that already works in the creative pipe scripts.

### Export pipeline

Triggered by `recording.export` after stopping:

1. `.cast` file already written during recording
2. Mix `cues.tsv` → `soundtrack.mp3` (via mix-sfx-track.py or built-in)
3. Render `.cast` → `.gif` (via agg, or built-in renderer)
4. Composite `.gif` + `.mp3` → `.mp4` (via ffmpeg)
5. All outputs in `scratch/recordings/<timestamp>/`

Export is a background job — service updates `status: 'exporting'` → `'idle'`.

## User Stories

### F1: Core Recording

**S1: Recording service and state**
- [ ] Create `RecordingService` with idle/recording/exporting state machine
- [ ] Register in AppController, wire to state-service for inspection
- [ ] `describeState()` exposes recording status

**S2: Terminal buffer capture**
- [ ] Timer-based screen capture (blessed `screen.screenshot()` or equivalent)
- [ ] Write asciicast v2 JSONL format
- [ ] Delta-only frames (skip if identical to previous)
- [ ] Configurable capture rate (default 10fps, max 30fps)

**S3: Command catalog entries**
- [ ] `recording.start` — begins capture, creates output dir
- [ ] `recording.stop` — ends capture, finalises .cast
- [ ] `recording.status` — returns current state
- [ ] Menu entries in View menu
- [ ] Keyboard shortcut (⌘R / Ctrl+R when not in dev mode)

**S4: Chrome indicator**
- [ ] Blinking `● REC` in top-right chrome area
- [ ] Click-to-stop handler
- [ ] Only visible during recording
- [ ] Timer-based blink (800ms toggle)

### F2: SFX Cue Logging

**S5: Cue command**
- [ ] `recording.cue --file <path>` logs a cue with timestamp offset
- [ ] No-op when not recording (no error, silent ignore)
- [ ] Cue log written to `cues.tsv` in output dir

**S6: Script integration**
- [ ] Update `~/.wibwob` sfx() helper to optionally POST cues
- [ ] Document pattern for creative pipe scripts

### F3: Export Pipeline

**S7: Audio mix**
- [ ] Mix cues.tsv → soundtrack.mp3 (reuse existing mix-sfx-track.py or port to TS)
- [ ] Triggered by `recording.export` or automatically on stop

**S8: Video export**
- [ ] .cast → .gif (via agg or built-in)
- [ ] .gif + .mp3 → .mp4 (via ffmpeg)
- [ ] Background job with progress in recording status

### F4: Playback (stretch)

**S9: Session replay**
- [ ] `recording.play --file <cast>` replays a .cast in a window
- [ ] Playback speed control (1x, 2x, 0.5x)
- [ ] Audio playback synced to visual frames

## Open Questions

1. **Buffer access:** Can we get raw terminal bytes from blessed, or only the
   parsed screen content? Raw bytes = smaller .cast files and exact reproduction.
   Parsed content = may lose colours/attributes.

2. **Capture rate vs file size:** 10fps at 180×51 = ~18KB/frame uncompressed.
   30 seconds = ~5.4MB. Delta encoding helps. What's the sweet spot?

3. **Multi-instance:** If two WibWob instances are running, each has its own
   RecordingService. No cross-instance concerns.

4. **Keyboard shortcut conflict:** ⌘R is used for reload in dev mode. Use
   Ctrl+Shift+R for recording? Or only expose via menu + API?

5. **Export dependencies:** agg and ffmpeg are external. Should export fail
   gracefully with "install agg/ffmpeg" message, or should we bundle alternatives?

## Non-Goals

- Streaming / live broadcast (future, not this epic)
- Audio input capture (mic recording — out of scope)
- Full video capture (pixel-perfect PNG frames — use QuickTime for that)
- Editing recorded sessions (trim, cut — use external tools)

## Prior Art

- `scripts/wibwob-record.sh` — standalone shell script (current workaround)
- `scratch/cli-experiments/mix-sfx-track.py` — cue-based audio mixing
- `scratch/cli-experiments/gen-sfx.py` + `gen-explosions.py` etc — SFX generators
- Creative pipe scripts (`creature-word-bomb-sfx.sh`) — the use case that drove this
- asciinema — terminal recording standard, asciicast v2 format
- agg — asciinema-to-gif renderer

## Success Criteria

1. User presses View → Start Recording, does stuff, presses Stop
2. `● REC` blinks in chrome during recording
3. `.cast` file plays back in `asciinema play`
4. Creative pipe script SFX cues auto-logged during recording
5. `recording.export` produces .mp4 with synced audio
6. Zero recording logic in CLI — pure HTTP client calls command IDs
7. Agent can start/stop recording via API (`wibwob recording.start`)
