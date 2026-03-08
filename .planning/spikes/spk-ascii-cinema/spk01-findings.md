# SPK: ASCII Cinema Pipeline — Findings & Improvements

## Status
Status: in-progress
Created: 2026-03-08

## Context

Across 3+ sessions (Feb–Mar 2026) we produced 4 short films: 3 folk-punk reels and 1 Shrigley-style hyperpop film. The Shrigley film alone took ~4 hours of iteration across 2 sessions to reach v4. Most of that time was spent on problems that should have been solved once and reused.

This spike captures what went wrong, what patterns emerged, and how to make the next film take 20 minutes instead of 4 hours.

---

## The Pipeline (What Exists Today)

```
 1. WRITE FRAMES    hand-craft .txt files (ASCII art + captions)
 2. COMPOSE MUSIC   chiptune-studio bricks → .wav/.mp3
 3. NORMALIZE       pad chapter frames to identical dimensions
 4. RENDER PNG      ansi2portrait.py → 1080×1920 PNGs
 5. TIMECODES       manually write cumulative timestamps
 6. COMPILE         compile_reel.py → MP4
 7. REVIEW          open in Finder, watch, give feedback
 8. ITERATE         goto 1-6, repeat 4-8 times
```

### Tools Involved

| Tool | Location | Role | Maturity |
|------|----------|------|----------|
| `ansi2portrait.py` | `scratch/compositions/tools/` | .txt → portrait PNG | Production (6 iterations) |
| `normalize_chapters.py` | ad-hoc per project | Pad frames to same size | Ad-hoc (needs generalizing) |
| `compile_reel.py` | `~/.claude/skills/reel/scripts/` | PNGs + MP3 → MP4 | Production |
| `shrigley_hyperpop.py` | project-specific | Music composition | One-off |
| `/compose` skill | `~/.claude/skills/compose/` | Creative music composition | Available but unused here |
| `/microfilm` skill | `~/.claude/skills/microfilm/` | Full orchestrator | Available but unused here |
| `/figlet-frame` skill | `~/.claude/skills/figlet-frame/` | Title card PNGs | Available but unused here |
| `/gallery` skill | `~/.claude/skills/gallery/` | ASCII → PNG + GIF | Available but unused here |

---

## What Went Wrong (Iteration Archaeology)

### 1. Background colour mismatch (2 iterations wasted)
**Problem:** `DEFAULT_BG` was Catppuccin blue `(0x1e, 0x1e, 0x2e)` but `DESKTOP_BG` was black. Content cells had purple halos.
**Fix:** Set both to `(0,0,0)`.
**Prevention:** Renderer should have ONE background colour, not two independent ones. Defaults should match.

### 2. Content not filling portrait canvas (6 iterations)
**Problem:** ASCII art designed for landscape terminals (~60 cols × 15 rows) doesn't fill a 9:16 portrait frame. Multiple attempts: different font sizes, different scaling modes, different padding strategies.
**Fix:** Render at 96px font, scale with LANCZOS to fit, bounding-box trim for centering.
**Prevention:** The renderer now handles this well. But the REAL fix is: design frames FOR portrait from the start. Shrigley-style small graphics (20-30 cols) fill portrait much better than wide landscape art.

### 3. Text jiggling between chapter frames (3 iterations)
**Problem:** Each frame in a chapter (e.g. ghost-1, ghost-2, ghost-3) had different content dimensions. The renderer's bounding-box trim scaled each differently, so text jumped position between frames.
**Fix:** `normalize_chapters.py` pads all frames in a chapter to identical width×height. `--fixed-size WxH` flag added to renderer to skip trimming.
**Prevention:** This should be built into the pipeline. A "chapter" concept where frames share dimensions needs to be a first-class thing.

### 4. Pacing: art vs text reading time (4 iterations of timecodes)
**Problem:** Initially all frames got equal time. Then text frames were too short to read. Then the human asked for art to animate WHILE text stays visible — a fundamentally different frame structure.
**Fix:** Redesigned all chapters so text appears on EVERY frame while art builds progressively above it. Combined with chapter normalization for stable positioning.
**Prevention:** The "animated chapter" pattern (text persistent, art evolving) should be a documented template, not something discovered mid-session.

### 5. Timecode authoring (3 iterations of wrong counts)
**Problem:** Manually counting frames and writing cumulative timestamps is error-prone. Off-by-one between frame count and timecode count happened repeatedly. Also: music duration (36s) vs desired video duration (42s) mismatch required audio padding.
**Fix:** Trial and error until counts matched. Padded audio with ffmpeg silence.
**Prevention:** Timecodes should be generated from a higher-level description (see proposed storyboard format below).

### 6. Glob only matched .ansi (1 iteration)
**Problem:** Batch renderer only globbed `*.ansi` but frames were `.txt`.
**Fix:** Added `.txt` glob.
**Prevention:** Already fixed in the tool.

---

## Friction Map

| Step | Human effort | Agent effort | Friction |
|------|-------------|--------------|----------|
| Write frames | HIGH (creative) | LOW | Acceptable — this IS the creative work |
| Compose music | LOW (describe mood) | HIGH | Good — agent does the heavy lifting |
| Normalize chapters | ZERO | MEDIUM | **Should be automatic** |
| Render PNGs | ZERO | LOW | Smooth — one command |
| Write timecodes | HIGH (manual math) | HIGH (manual math) | **Worst friction point** |
| Compile video | ZERO | LOW | Smooth — one command |
| Review | HIGH (watch, think) | ZERO | Acceptable — human judgment |
| Iterate | HIGH (re-explain) | HIGH (redo work) | **Second worst friction point** |

---

## Proposed Improvements

### A. Storyboard Format (kills timecode friction)

Replace manual timecodes with a declarative storyboard YAML:

```yaml
# shrigley.storyboard.yaml
audio: shrigley-hyperpop.mp3
audio_pad: 6  # seconds of silence after audio ends
resolution: 1080x1920

chapters:
  - name: intro
    frames: [a01a-cover.txt]
    duration: 2.0

  - name: title
    frames: [a01b-title-appear.txt, a01c-title-full.txt]
    duration: 3.0  # split evenly across frames

  - name: ghost
    frames: [b02a-ghost.txt, b02b-ghost.txt, b02c-ghost.txt]
    duration: 2.5
    normalize: true  # auto-pad to same dimensions

  - name: duck
    frames: [b03a-duck.txt, b03b-duck.txt, b03c-duck.txt]
    duration: 2.3
    normalize: true
    pacing: ease-out  # first frame shorter, last frame longer

# Special frames
  - name: error-figlet
    figlet: "ERROR 404"  # auto-generate via figlet-frame
    font: big
    duration: 0.6
```

A `storyboard_compile.py` script would:
1. Read the YAML
2. Auto-normalize chapter groups
3. Auto-generate figlet frames
4. Calculate cumulative timecodes from durations
5. Render all PNGs with correct `--fixed-size` per chapter
6. Pad audio if total duration > audio length
7. Call `compile_reel.py`

**One command. One file to edit. No manual timecodes.**

### B. Chapter Normalizer as a Reusable Tool

Move `normalize_chapters.py` from project-specific to `scratch/compositions/tools/` and make it filename-pattern-based:

```bash
# Auto-detect chapters from filename prefixes (b02a, b02b, b02c → chapter "b02")
uv run normalize_chapters.py frames_dir/
```

Detection rule: files sharing a prefix up to the last letter before the extension are a chapter group. `b02a-ghost.txt`, `b02b-ghost.txt`, `b02c-ghost.txt` → chapter `b02`.

### C. Animated Chapter Template

Document the "persistent text, evolving art" pattern as a reusable template:

```
CHAPTER TEMPLATE: Animated Reveal
==================================

Frame 1 (0.3-0.5s):  Art sketch/hint     + FULL TEXT
Frame 2 (0.6-0.8s):  Art half-built      + FULL TEXT
Frame 3 (1.2-1.8s):  Art complete         + FULL TEXT

Rules:
- Text occupies the same lines on ALL frames
- Art grows downward from the top
- Blank lines above art in early frames = space for art to grow into
- All frames same width × height (use normalizer)
- Text at bottom, art at top = natural reading order
```

### D. Portrait-First Frame Design Guide

Frames work best in 9:16 when:
- Width: 15-35 chars (sweet spot for scaling)
- Height: 15-25 lines
- Art above, text below, clear separation
- Shrigley-style small sketchy graphics > elaborate wide ASCII art
- Joan Stark art: pick pieces that are TALL not WIDE

### E. Skill Integration (Use What We Already Have)

Skills we HAVE but DIDN'T USE this session:

| Skill | Could have helped with | Why we didn't use it |
|-------|----------------------|---------------------|
| `/microfilm` | Full orchestration pipeline | Didn't know it handled this use case |
| `/figlet-frame` | The 3 figlet subtitle cards | Hand-crafted them instead |
| `/compose` | Music composition | Used raw chiptune-studio directly |
| `/gallery` | PNG rendering + contact sheets | Used ansi2portrait directly |
| `/subtitle` | Karaoke-style text treatments | Didn't know it existed mid-flow |
| `/interstitial` | Figlet punch cards with audio stingers | Hand-crafted instead |

**Action:** Next film session, START with `/microfilm` as orchestrator. It already knows the pipeline.

### F. Review Loop Acceleration

The human review → feedback → re-render cycle is the slowest part. Ideas:
- **Contact sheet preview:** Render a single image showing all frames as thumbnails with timecodes annotated. Quick visual check before compiling video.
- **Frame diff overlay:** When re-rendering after changes, show which frames changed.
- **Auto-open:** After compile, auto-open the MP4 (already doing this).

---

## Proposed File Structure for Next Film

```
scratch/grime-video/project-name/
├── project-name.storyboard.yaml    ← THE source of truth
├── frames/                          ← all .txt frame files
│   ├── 01-intro/                    ← grouped by chapter
│   │   ├── a-cover.txt
│   │   └── b-title.txt
│   ├── 02-ghost/
│   │   ├── a-sketch.txt
│   │   ├── b-building.txt
│   │   └── c-complete.txt
│   └── ...
├── png/                             ← rendered PNGs (gitignored)
├── audio/
│   ├── music.mp3
│   └── music-padded.mp3
├── output/
│   └── project-name.mp4
└── notes.md                         ← creative diary
```

---

## Immediate Next Steps

1. [ ] Build `storyboard_compile.py` — the one-command orchestrator
2. [ ] Generalize `normalize_chapters.py` with auto-detection
3. [ ] Add `--fixed-size` auto-detection to `ansi2portrait.py` batch mode (detect groups, normalize, render)
4. [ ] Document the "animated chapter" frame template
5. [ ] Test the full pipeline on a NEW short film (validation)
6. [ ] Consider promoting to epic if this becomes a recurring creative format

---

## Key Lesson

The creative work (writing frames, choosing art, composing music, deciding pacing) is genuinely hard and should take time. The MECHANICAL work (normalizing dimensions, counting timecodes, re-rendering, padding audio) should be zero-friction. This session spent ~70% of time on mechanical problems that a storyboard-driven pipeline would eliminate.

**Design frames. Describe pacing. One command. Watch film.**

That's the target.
