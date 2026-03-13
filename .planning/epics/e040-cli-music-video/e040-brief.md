---
id: e040-cli-music-video
title: "CLI-Driven Music Video Production"
status: not-started
created: 2026-03-13
depends_on: [e039-unix-cli-surface]
---

# E040 — CLI-Driven Music Video Production

## The Concept

Use the `ww` CLI (from E039) to choreograph visual stories in WibWob-DOS via bash scripts.
Instead of declarative JSON timelines, write **readable, composable shell scripts** that
call `ww` commands with `sleep` for timing. Record the full TUI session via asciinema
(terminal ASCII), OBS, or QuickTime (pixel-perfect).

```bash
# A 30-second music video IS a bash script:
#!/bin/bash
# Example: "Drift" poem with primer+typography

ww theme set flexoki-ink
ww open primer --file art/drift-backdrop.txt --layout hero-left
sleep 2

ww open figlet --text "we" --font banner --x 10 --y 5
sleep 1.5

ww open figlet --text "drift" --font banner --x 50 --y 15
sleep 2

ww theme set wibwob-dark-pastel
ww move w3 --x 40 --y 8
sleep 1

ww windows --json | jq -r '.[].id' | xargs ww close
ww theme set flexoki-ink
```

This **is** the storyboard. It **is** the composition. No intermediate format.

## Why CLI > JSON Timeline

### Previous: vj-timeline (JSON declarative)
- ✅ Precise timing, no drift, synced to audio
- ✅ Scene diffing — smart window reuse across transitions
- ✅ Layout tokens — `hero-left`, `top-banner`, `center-card`
- ❌ Opaque JSON — requires a tool to visualize or edit
- ❌ Two documents — timeline + primer palette = context split
- ❌ Timing via cue offset — abstract, hard to debug by reading
- ❌ Scene-based structure doesn't fit asymmetric/emergent layouts

### New: CLI-driven bash scripts
- ✅ **Readable choreography** — anyone can read a bash script
- ✅ **Composable** — pipes + command chaining enable emergent patterns
- ✅ **Debuggable** — run commands manually one-by-one, measure timing with `time`
- ✅ **Unified document** — script IS the storyboard, no format translation
- ✅ **Lightweight** — no validation tool, no scaffolding script
- ✅ **Scriptable variations** — bash loops, conditionals, randomness
- ⚠️ Frame rate control harder (sleep granularity, no beat-sync)
- ⚠️ Audio sync requires external tooling (ffmpeg, sox)

## Creative Possibilities

**Asymmetric window clusters as composite image:** Arrange 6 small primer windows
in an irregular grid to form a larger image visible only when composed. `ww` scripts
make this trivial — just position windows by pixel coordinates, no layout token constraint.

**Figlet typography sequences:** Cascade words across the desktop, each landing at a
specific time. Bash variables + loops create rhythmic repetition (same word, different
fonts, falling positions). Audio cues via `afplay` in the background.

**Primer art galleries:** Cycle through curated ASCII art primers at set intervals.
A loop that opens/closes/replaces with sleep timing is more readable than a timeline
with 50 cues.

**Real-time theme shifts as mood punctuation:** Theme changes are instant and free.
A script can slam themes on beat boundaries: dark → pastel → dark. No latency, no
queuing — just `ww theme set <name>` at the right moment.

**Generative chaos:** Randomise primer selection, window positions, fonts, colors.
`shuf`, `$RANDOM`, conditionals — all native to bash. The script **generates** the
storyboard at runtime based on seed values.

## Technical Approach

### Recording Pipeline

1. **Start app:** `bun run start` in tmux session
2. **Start recording:** `asciinema rec -c "bash show.sh"` or launch OBS with WibWob window
3. **Run script:** Script calls `ww` commands with `sleep` for timing
4. **Stop recording:** Hit Ctrl+C or let script finish
5. **Capture audio separately:** `afplay track.mp3 &` during recording OR mix audio post-shot with ffmpeg
6. **Output:** `.cast` file (asciinema) or `.mp4` (OBS/QuickTime)

### Example 30-Second Script

```bash
#!/bin/bash
# Example: "Void" — minimalist piece
# Duration: 30 seconds
# Audio: void-ambient.mp3 (plays in background)

set -e
TRACK="/path/to/void-ambient.mp3"

# Start audio
afplay "$TRACK" &
AUDIO_PID=$!

# Intro: dark theme, single primer
ww theme set wibwob-dark
sleep 0.5
ww open primer --file art/void-grid.txt
sleep 4

# Build: add text layers
ww open figlet --text "silence" --font standard --x 20 --y 10
sleep 3

ww open figlet --text "breathing" --font small --x 60 --y 15
sleep 3

# Peak: theme slam + geometry
ww theme set wibwob-dark-pastel
for i in {1..5}; do
  ww open figlet --text "." --font big --x $((RANDOM % 120)) --y $((RANDOM % 30))
  sleep 0.2
done
sleep 2

# Outro: strip it back
ww windows --json | jq -r 'map(select(.kind!="primer")).[] | .id' | xargs ww close
ww theme set wibwob-dark
sleep 3

# Clean up
kill $AUDIO_PID 2>/dev/null || true
ww close all
```

This is: readable, debuggable (run parts manually), composable (refactor loops),
and fast (no JSON parsing, direct `ww` invocations).

## Relationship to Existing Work

| System | Format | Sync | Output | Composability |
|--------|--------|------|--------|---------------|
| **vj-timeline** | JSON | audio beats | terminal + `.cast` | Scenes + patches (medium) |
| **figlet-videographer** | JSON + Python | audio sync via `afplay` | terminal + `.mp4` | Figlet + primer palette (medium) |
| **CLI-driven (E040)** | Bash script | sleep + audio subprocess | terminal/OBS/Qt | Pipes + composition (high) |

All three coexist. CLI-driven is best for:
- Scripted, readable storyboards
- Real-time debugging and iteration
- Emergent/generative compositions
- Tight integration with agent workflow

Use vj-timeline for:
- Pixel-perfect timing sync
- Complex scene state management
- Large-scale productions (20+ cues)

## Comparison: Script vs. JSON Timeline

**Same 4-second sequence, two ways:**

**JSON timeline (vj-timeline):**
```json
{
  "cues": [
    { "at": { "t": 0 },    "scene": "intro" },
    { "at": { "t": 2.0 },  "patch": { "set": [{ "role": "figlet", ... }] } },
    { "at": { "t": 4.0 },  "command": { "id": "theme.set", "args": { "name": "..." } } }
  ]
}
```
→ Requires: timeline tool + primer list + mental model of scene diffing

**Bash script (E040):**
```bash
ww open primer --file art/intro.txt
sleep 2
ww open figlet --text "hello" --font banner
sleep 2
ww theme set phosphor
```
→ Direct, no tool overhead, anyone can follow it

## Open Questions

- **Frame rate:** Sleep granularity is ~10ms on modern systems. Good enough for
  most music (4/4 at 120 BPM = 500ms per beat). Tighter sync would need a frame
  scheduler or OSC messaging.

- **Audio sync:** E040 records the visual, audio plays separately (or mixed post-shot).
  Real-time beat detection could drive cue timing, but requires beat analysis first.
  Consider: offload to chiptune-studio's beat map output.

- **Transition effects:** JSON timelines have scene diffing — smart reuse. CLI scripts
  close and reopen. Could we infer geometry from window transitions and auto-tween?
  Or just document "for smooth transitions, reposition windows instead of closing."

- **Snapshot/restore:** Should `ww snapshot save my-state` and `ww snapshot restore
  my-state` exist? Useful for multi-take compositions or backup before destructive edits.

- **One script per shot or one master with functions?** Likely both: simple shows are
  one linear script; complex productions use bash functions for reusable "acts" and
  source them from a master orchestrator.

## Success Criteria

- [ ] Write and execute a 30-60 second music video using only `ww` CLI commands and
      bash timing
- [ ] Script is readable enough that a human can understand the visual intent from
      the code alone
- [ ] Recording via asciinema or OBS produces a viewable `.cast` or `.mp4`
- [ ] Composition is demonstrably more readable/debuggable than equivalent JSON timeline
- [ ] At least one example shows emergent or random behavior (generative aspects)

## Future Expansion

- `ww watch` — stream state changes as NDJSON, enable reactive compositions
- `ww pipe` — route window content between windows (composite/mashup effects)
- Beat-driven timing helpers (if chiptune-studio beat maps become standard)
- Web dashboard showing past shows (library + replay)
- Multi-instance shows (two TUI instances, coordinated via SSH `ww` commands)

---

**Depends on:** E039 completion (the `ww` CLI tool itself)
**Enabled by:** Bash composability + existing window control + media recording tools
**Priority:** Medium — extends creative surface after E039 CLI lands
