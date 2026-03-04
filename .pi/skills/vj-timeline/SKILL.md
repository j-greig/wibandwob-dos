---
name: vj-timeline
description: |
  Compose and execute timed music video shows inside WibWob-DOS TUI.
  Declarative timeline files sync visual cues (window layout, theme changes,
  primer art, figlet typography) to audio playback. Use when: creating a
  music video, VJ show, timed visual performance, or any task that needs
  coordinated window choreography synced to audio. Triggers on: "music video",
  "VJ show", "visual performance", "timeline", "timed show", "sync to music".
---

# VJ Timeline

Compose timed music video shows inside WibWob-DOS.

## What This Is

A declarative timeline format that an agent writes as a file. The timeline
service parses it and plays it back: audio starts, visual cues fire at
exact timestamps. No sleep() drift. No manual command sequencing.

## The Format

Timeline files are JSON (YAML support planned). The agent writes these.

```json
{
  "version": 1,
  "title": "PC Music Recap Video",
  "track": "/path/to/track.mp3",
  "duration": 60,

  "palette": [
    { "name": "sequencer", "file": "/path/to/chromatic-sequencer.txt", "note": "grid aesthetic" },
    { "name": "tracker",   "file": "/path/to/msdos-music-tracker.txt", "note": "DROP anchor" }
  ],

  "scenes": {
    "intro": {
      "name": "intro",
      "theme": "wibwob-dark",
      "windows": [
        { "role": "backdrop", "open": { "type": "primer", "file": "/path/to/sequencer.txt" }, "layout": "hero-left" },
        { "role": "headline", "open": { "type": "figlet", "text": "HYPERPOP", "font": "slant" }, "layout": "top-banner" }
      ]
    },
    "drop": {
      "name": "drop",
      "theme": "wibwob-dark",
      "windows": [
        { "role": "backdrop", "open": { "type": "primer", "file": "/path/to/tracker.txt" }, "layout": "backdrop" },
        { "role": "headline", "open": { "type": "figlet", "text": "DROP", "font": "banner" }, "layout": "top-right-corner" }
      ]
    }
  },

  "cues": [
    { "at": { "t": 0 },    "scene": "intro" },
    { "at": { "t": 4 },    "patch": { "theme": "wibwob-dark-pastel", "set": [
      { "role": "face", "open": { "type": "primer", "file": "/path/to/synth-face.txt" }, "layout": "sidebar-right" }
    ]}},
    { "at": { "t": 19 },   "scene": "drop" },
    { "at": { "t": 25 },   "command": { "id": "theme.set", "args": { "name": "wibwob-dark-pastel" } } }
  ]
}
```

## Core Concepts

### Scenes

A scene is a complete desired desktop state. When a scene cue fires, the
planner diffs the current desktop against the scene and emits close/open/
move/resize operations. Windows matched by role are reused; unmatched
existing windows are closed; unmatched scene windows are opened.

### Patches

A patch is a partial update. It can add windows (set), remove windows by
role (close), and change the theme. Use patches for incremental changes
between major scene transitions.

### Commands

A command cue fires a single registry command by ID. Useful for theme.set,
or any discrete action that does not involve window layout.

### Roles

Every window in a scene has a stable ROLE (e.g. "backdrop", "headline",
"lyric", "face"). Roles persist across cues. If the "backdrop" role
appears in two consecutive scenes, the planner reuses the window rather
than closing and reopening it.

### Layout Tokens

Layout tokens are named positions resolved against the live desktop size:

| Token             | Description                              |
|-------------------|------------------------------------------|
| backdrop          | full usable desktop                      |
| fullscreen        | same as backdrop                         |
| hero-left         | 65% width, full height, left-aligned     |
| hero-right        | 65% width, full height, right-aligned    |
| hero-center       | 70% width, 80% height, centered          |
| top-banner        | full width, top 15%                      |
| bottom-banner     | full width, bottom 15%                   |
| lyric-bar         | full width, bottom 12 rows               |
| top-right-corner  | 30% width, 20% height, top-right         |
| top-left-corner   | 30% width, 20% height, top-left          |
| sidebar-right     | 30% width, full height, right            |
| sidebar-left      | 30% width, full height, left             |
| center-card       | 40% width, 50% height, centered          |
| strip-bottom      | full width, bottom 30%                   |

You can also use explicit coordinates: `{ "x": 0, "y": 0, "w": 90, "h": 40 }`
Or proportional: `{ "xPct": 0, "yPct": 0, "wPct": 0.5, "hPct": 1.0 }`

### Timing

Cues can be timed three ways:

- **Absolute:** `{ "t": 4.0 }` — seconds from track start
- **Beat:** `{ "beat": 16 }` — requires a beat map
- **Section:** `{ "section": "drop" }` — fires at section start

Cues must be in monotonic time order.

### Beat Maps

Optional audio analysis output. Inline in the timeline or as a separate file:

```json
{
  "bpm": 150,
  "key": "F minor",
  "duration": 60,
  "beats": [
    { "beat": 1, "t": 0.0 },
    { "beat": 2, "t": 0.4 }
  ],
  "sections": [
    { "name": "intro", "startBeat": 1, "endBeat": 10, "startT": 0, "endT": 4 },
    { "name": "drop",  "startBeat": 48, "endBeat": 85, "startT": 19, "endT": 34 }
  ]
}
```

### Primer Palette

Curate visual assets before composing. The palette lists primers with
short names and creative notes explaining why each was chosen.

IMPORTANT: Use just the FILENAME for primer file references, not full
paths. The runner resolves filenames to real paths automatically via
the primer.list API. This means timeline files are portable and you
do not need to know where primers live on disk.

```json
"palette": [
  { "name": "sequencer", "file": "chromatic-sequencer.txt", "note": "grid aesthetic, instruments" },
  { "name": "jellyfish", "file": "disco-jellyfish.txt",     "note": "hyperpop energy" },
  { "name": "tracker",   "file": "msdos-music-tracker.txt", "note": "DROP anchor, recursive" }
]
```

The palette tells a story arc. Curating it IS part of the creative work.

## Composition Workflow

1. Listen to the track. Read the trackview data if available.
2. Map musical sections to visual moods and energy levels.
3. Curate a primer palette (6-10 assets that fit the track).
4. Define scenes for major sections (intro, verse, drop, outro, finale).
5. Write cues: scene transitions at section boundaries, patches for
   incremental changes within sections.
6. Typography is emotion: figlet text should land at lyrical moments.
7. Theme slams as punctuation at energy shifts.
   Available themes: wibwob-dark, wibwob-dark-nord, wibwob-dark-pastel, wibwob-light
8. Leave breathing room. Not every beat needs a visual change.
9. Plan a finale — slower, more composed, separate register from the show.

## Creative Heuristics

- The DROP is a clear-and-rebuild gesture. Wipe the stage, land one big thing.
- Layer figlet text OVER primers, not beside them. Text on art creates depth.
- Theme changes are free and instant. Use them as percussion.
- One hero window per scene. Everything else supports it.
- The finale breathes. The show rushes. Contrast is everything.
- Vary primer sizes. A tiny window next to a huge one creates hierarchy.
- Animated primers (three-hyphen frame separators) add motion without effort.

## Script Toolkit

Six scripts cover the full workflow:

```bash
# 1. SCAFFOLD — create a starter timeline from a track file
bun run scripts/timeline-new.ts path/to/track.mp3 --name my-show
#    Probes duration, fetches primer list, writes skeleton to scratch/timelines/

# 2. VALIDATE — check a timeline file parses clean
bun run scripts/timeline-validate.ts path/to/timeline.json

# 3. DRY RUN — print resolved cues without executing
bun run scripts/timeline-dry-run.ts path/to/timeline.json [width] [height]

# 4. RUN — play the show against a running app
bun run scripts/timeline-run.ts path/to/timeline.json [--no-audio]

# 5. CAPTURE — run with per-cue screenshots and state capture
bun run scripts/timeline-capture.ts path/to/timeline.json [--no-audio]
#    Output: scratch/timeline-captures/<timestamp>/
#    Each cue gets: .txt (plain text), .ansi (color), _state.json (desktop state)
#    Plus capture-log.jsonl with machine-readable log of everything

# 6. REVIEW — compare expected vs actual from a capture run
bun run scripts/timeline-review.ts scratch/timeline-captures/<timestamp>/
#    Prints per-cue report: what should be there vs what is there
#    Flags issues: oversized figlets, sparse scenes, timing drift, theme mismatch
```

Typical agent workflow:
  new → edit → validate → dry-run → capture → review → fix → repeat

## Alignment with Chiptune Studio

The chiptune-studio skill has a trackview format for audio composition.
The VJ timeline describes the VISUAL layer over the same time axis.

They share a common transport envelope: beats, bars, sections, duration.
But they are different domains:
- Trackview = what the AUDIO does at each beat
- Timeline = what the VISUALS do at each beat

A unified workflow: compose the track with chiptune-studio, export a
beat map, then compose the visual timeline referencing that beat map.
The agent can do both in one session.

## Files

| File | Purpose |
|------|---------|
| `src/services/timeline-types.ts` | Schema: TimelineFile, Cue, Scene, etc |
| `src/services/timeline-service.ts` | Parse, validate, schedule, execute |
| `src/services/scene-planner.ts` | Diff desired vs live desktop state |
| `src/services/scene-layout.ts` | Resolve layout tokens to coordinates |
| `scripts/timeline-new.ts` | Scaffold a timeline from a track file |
| `scripts/timeline-validate.ts` | CLI validator |
| `scripts/timeline-dry-run.ts` | Print resolved cue schedule |
| `scripts/timeline-run.ts` | Execute against running app |
| `scripts/timeline-capture.ts` | Run + screenshot every cue to disk |
| `scripts/timeline-review.ts` | Compare expected vs actual from captures |
| `scratch/timelines/` | Where timeline files live |
| `scratch/timeline-captures/` | Where capture runs are saved |
