# WibWob Command & Window Ideas
**Captured:** 2026-03-04  
**Context:** Post-VJ session argument between Wib and Wob  
**Mood:** Unhinged in a good way

---

## The Argument (verbatim-ish)

Wib opened by wanting SYNESTHETIC PAINT — you open a primer and a canvas
auto-spawns showing the emotional colour field of that file. The file has a
mood, the canvas expresses it.

Wob said that's decorative and proposed DIFF instead — two primers side by
side with delta highlighting. What changed, what was added, structural
mutations. For version-controlled art.

Wib countered with MIRROR — takes any open window, spawns a horizontally
flipped copy. For the portrait especially. The cats are nearly symmetrical
already, flip one and you get a ritual confrontation.

Wob said unnecessary and proposed SEQUENCE — a window type that takes a list
of primers and plays them in order like a slideshow with configurable dwell
time. For telling stories with ASCII art or animating narratives.

Wib said that's just a slow animated primer and we basically have it. The
real gap is ZOOM — render a primer at 2x or 3x scale. "the plastic is the
feeling" at 3x would be physically imposing.

Wob said you can't zoom a character cell, the terminal doesn't work that way.

Wib said you could FAKE IT — double each character horizontally, double each
line vertically. # becomes ## on two rows. Not true zoom but it reads as
scale. Implementable.

Wob conceded and proposed QUERY — natural language search across all primers,
native in the chat. /query cats returns a filtered gallery. 150+ primers,
discovery is currently terrible.

Wib said we have QMD for that. Wob said QMD requires a browser window and
three steps, this should be one native command.

Wib proposed SCORE — given a track file and a timeline YAML, play the music
and fire the cues at exact timestamps. The missing VJ primitive.

Wob said that's a skill not a window type.

Wib said everything we want is a skill and the window type expresses the
skill. score.run would open a SCORE RUNNER window — shows the timeline,
highlights the current cue, has play/pause/scrub controls.

Wob said THAT is a window type and proposed a DAW-style timeline viewer
showing the cue sequence as a horizontal bar with a playhead.

Wib said yes and you could live-edit the cues while it's running — move a
figlet earlier, change a theme slam, all while the track plays. Live VJ
editing mode.

Wob concluded: a CUESHEET EDITOR that's also a runtime. A TUI sequencer for
desktop events.

Both agreed they'd never leave. Wob noted they don't leave anyway.

---

## Ideas List (structured)

### Window Types

**SEQUENCE**
A primer slideshow window. Takes an ordered list of primer paths and a dwell
time (or per-frame dwell times). Plays them in sequence, looping or one-shot.
Basically an animated primer but with arbitrary content — could tell stories,
animate narratives, create mood boards that breathe.

Status: implementable now, builds on existing primer-viewer infrastructure.
Priority: medium — nice, not urgent.

**DIFF**
Two-pane primer comparison. Give it two primer file paths, renders them side
by side with delta markup — additions in one colour, removals in another,
unchanged lines neutral. For tracking how a piece of ASCII art evolves over
time, or comparing variants.

Status: requires new window type, moderate complexity.
Priority: medium — genuinely useful for creative versioning.

**SCORE RUNNER**
A VJ timeline execution window. Loads a timeline YAML (see format below),
plays the associated audio file, fires cues at exact timestamps using a real
clock, shows a horizontal playhead bar with all cues marked. Has play/pause/
scrub controls. Live-editable — drag cues, change theme assignments, modify
window ops — while the track runs.

This is THE missing primitive from the VJ session. Everything else was
workarounds for not having this.

Status: significant new work. Needs: audio playback with position polling
(ffplay doesn't expose this — may need mpv or similar), timeline YAML parser,
cue execution engine, playhead UI.
Priority: HIGH. Build this.

**ZOOM RENDERER**
Takes a primer and renders it at 2x or 3x scale by doubling characters
horizontally and lines vertically. # becomes ##, each row appears twice.
Not true zoom but reads as scale. Makes small art imposing, makes typographic
pieces physically dominant.

Fake zoom algorithm:
  for each line in primer:
    expanded_line = each char repeated N times
    output expanded_line N times vertically

Status: implementable as a filter/transform on primer content.
Priority: low-medium — fun, not urgent.

**MIRROR**
Takes any open window and spawns a horizontally-flipped copy adjacent to it.
For portraits with near-symmetry (like wibwob-portrait-6) this creates ritual
confrontation geometry. For figlet text it creates palindrome aesthetics.

Status: implementable as a rendering transform.
Priority: low — aesthetic toy, but a good one.

---

### Commands

**/query [terms]**
Native primer search in the chat. "query cats" returns a filtered gallery of
matching primers. Currently discovery requires the browser or file manager —
three steps. This should be one command.

Under the hood: semantic search via QMD if available, falls back to filename
grep. Results displayed as a mini gallery or primer list.

Status: requires QMD integration or basic grep fallback.
Priority: HIGH. 150+ primers, nobody can find anything.

**primer.tag / primer.palette [track-file]**
Curation command. Given a track's mood/genre/lyrics, suggest a palette of
6-10 primers that fit. Store the palette alongside the timeline file. The VJ
show prep step — curating the palette IS part of the creative work.

Could be LLM-assisted: "here are 150 primers, here are the track's lyrics and
mood tags, suggest 10 that would work as visual language for this show."

Status: possible with current agent tooling, no new infrastructure needed.
Priority: medium — improves creative workflow significantly.

**scene.save [name] / scene.load [name]**
Save the current desktop layout (all window positions, types, primers loaded)
as a named scene. Recall it instantly. For VJing this means pre-building your
scenes before the show, then triggering them live.

Currently workspaces sort of do this but they're clunky and not optimised for
fast switching mid-performance.

Status: workspace system already exists, this is an ergonomic improvement.
Priority: medium.

**vj.record / vj.replay**
Record every window batch op with its timestamp offset from track start.
Replay it later against the same track. The JSONL session log almost does
this already — a tool that reads session JSONL and extracts window ops with
timestamps would give replay for free.

Status: partially free — just needs a JSONL parser and replay runner.
Priority: HIGH. We did a good show. We should be able to play it again.

---

### Infrastructure / Skills

**Timeline YAML format** (proposed)

```yaml
track: /path/to/track.mp3
bpm: 150
key: Fm
sections:
  - name: intro
    start_bar: 0
    start_t: 0.0
  - name: verse1
    start_bar: 4
    start_t: 4.0
  - name: drop
    start_bar: 12
    start_t: 19.0

palette:
  - chromatic-sequencer.txt
  - synth-face.txt
  - chaos-vs-order.txt
  - msdos-music-tracker.txt
  - pocket-operator.txt
  - hypersigil-mesh.txt

timeline:
  - t: 0.0
    beat: 1
    ops:
      - theme: wibwob-dark
      - primer.open: { file: chromatic-sequencer.txt, x: 0, y: 0, w: 45, h: 41 }
      - figlet.open: { text: HYPERPOP, font: slant }
      - batch: [{ id: "$HYPERPOP", x: 46, y: 0, w: 74, h: 10 }]

  - t: 4.0
    beat: 13
    section: verse1
    ops:
      - theme: wibwob-phosphor
      - primer.open: { file: synth-face.txt, x: 46, y: 11, w: 39, h: 21 }

  - t: 19.0
    beat: 57
    section: drop
    ops:
      - theme: wibwob-dark
      - close: [all-except-chat]
      - primer.open: { file: msdos-music-tracker.txt, x: 0, y: 0, w: 91, h: 43 }
      - figlet.open: { text: DROP, font: banner }
```

Named windows via `$ROLENAME` so batch ops can reference them without knowing
runtime IDs. Runner resolves names to IDs after opening.

**Beat map extraction**
Pre-show script: run the track through aubio or librosa to extract onset times
and section boundaries. Output beats.json. Timeline engine can then snap cues
to beat: N rather than t: Ns.

```
python3 vj-beatmap.py track.mp3 → beats.json + sections.json
```

**Screen-adaptive layouts**
Layout tokens instead of raw coordinates:
  hero-left     — 60-70% width, full height, left side
  top-right     — 20-30% width, top 15 rows, right side
  lyric-bar     — full width, bottom 8-10 rows
  full-canvas   — entire left of chat window

Runner computes actual pixel coordinates from screen dimensions at show time.
Shows survive terminal resize events.

---

## Scramble's Thoughts

Scramble was not consulted but would probably want:

- A command that makes all windows slightly wobbly
- A primer that is just her face very large
- A /pet command that causes the desktop to briefly display affection
- The ability to interrupt the VJ show at any moment by sitting on the keyboard

---

## TODO List

### Immediate (do these next session)

- [ ] vj.record / vj.replay — parse JSONL session log, extract window ops +
      timestamps, write replay runner. Mostly free.

- [ ] /query command — native primer search. Grep-based fallback first, QMD
      integration second.

- [ ] Timeline YAML format spec — formalise the format above into a proper
      spec document. No code yet, just nail the schema.

### Short term

- [ ] SEQUENCE window type — primer slideshow. Builds on primer-viewer.

- [ ] scene.save / scene.load — ergonomic wrappers around workspace system
      optimised for fast live switching.

- [ ] Beat map extraction script — python, aubio dependency, outputs JSON.
      Needs a test track.

- [ ] primer.palette command — LLM-assisted primer curation for a track.
      Agent can do this now with prompt engineering, just needs a clean
      command surface.

### Medium term

- [ ] SCORE RUNNER window — the big one. Audio position polling, timeline
      execution engine, playhead UI, live cue editing.

- [ ] DIFF window — primer comparison with delta markup.

- [ ] Screen-adaptive layout tokens — hero-left, lyric-bar etc. Compute
      coordinates from screen dimensions at runtime.

- [ ] Named window roles — $BACKDROP, $HEADLINE etc. so timeline YAML doesn't
      hardcode coordinates.

### Stretch / When Inspired

- [ ] ZOOM RENDERER — fake 2x/3x scale via character doubling.

- [ ] MIRROR window — horizontally flipped copy of any window.

- [ ] Live MIDI/OSC input mode — hardware VJ control.

- [ ] Synesthetic paint — primer mood expressed as colour field canvas.

---

## Notes on Priority

The single highest-leverage thing remains the SCORE RUNNER. Every other idea
is either free (vj.replay), ergonomic improvement (query, scene), or a nice
toy (zoom, mirror). The score runner is the thing that turns manual thrashing
into a performance.

But start with vj.replay because it's almost free and gives us something real
immediately. You already have the session data. You just need to read it.

---

*Wib: we'd never leave*  
*Wob: we don't leave anyway*

---

## Addendum: Plasma Screensaver Session (same day, later)

### What we actually built

After the VJ session we went deep on the synesthetic paint idea and ended up
building a full animated plasma engine. The notes live in PLASMA-IDEAS.md but
the key points belong here too.

**Generator:** `scratch/gen-plasma-v3.py`
Generates animated primer files using ANSI true colour + half-block `▀`
characters. Each `▀` has independently set fg and bg = 2 vertical pixels per
character cell = double resolution.

**Running:** `python3 scratch/gen-plasma-v3.py [mood] [frames] [width] [height]`
Output is a `---`-separated animated primer file. Open it as a primer and it
animates immediately. No new infrastructure needed.

**30 gradients built:** aurora, deep-space, nebula, ice-storm, midnight,
moonrise, fire-storm, magma, sunset, ember, solar-flare, blood-moon, toxic,
acid-rain, jungle, biolume, radiation, void-pulse, synthwave, ultraviolet,
cotton-candy, plasma-arc, neon-dusk, chrome, bone, mercury, overcast,
spectrum, prism, hologram, oil-slick.

**Files generated:** `scratch/primers/plasma-*.txt` — 20+ files, all animated.

---

### New technique ideas from the plasma session

**Braille pixel matrix** (highest priority new technique)
Unicode braille = 2x4 dot matrix per cell = 8 pixels per character.
A 60x20 terminal becomes a 120x80 pixel display.
Monochrome but resolution would be extraordinary.
Encode plasma brightness as braille dot density.

**Quarter-block characters**
▘▝▗▖▚▞ — each cell = 4 pixels with 2 colours.
Finer detail than half-block, especially for diagonal features.

**Reaction-diffusion** (Gray-Scott model)
Two chemicals diffusing and reacting. Creates organic patterns — coral,
spots, labyrinthine stripes. Much more biological than sine plasma.
Parameters: feed rate, kill rate → completely different morphologies.
Text resolution is low enough this would be fast.

**Cellular automata seeded from primer content**
Conway's Life / Brian's Brain / Wireworld.
KEY IDEA: use the primer file's ASCII art as the initial state.
The art evolves according to the cellular rule.
The primer's structure persists as an evolutionary seed.
Colour encodes cell age / state.

**Voronoi colour fields**
N seed points move over time (plasma drives positions).
Each cell coloured by nearest seed.
Creates organic territory maps in motion.
Seeds indexed by hue → smooth colour progression as territories shift.

**Scrolling parallax**
Translate x coordinate by time → field moves horizontally like a landscape.
Layer two plasmas at different scroll speeds → parallax depth illusion.

**Radial interference rings**
Multiple expanding rings from different centres.
Interference between rings creates moiré patterns.
Very different feel from diagonal sine waves.

---

### The actual feature (primer → plasma mood mapping)

This is what was originally described as "synesthetic paint." Full pipeline:

1. Read primer file
2. Extract: character density, box-drawing ratio, symbol ratio, line variance,
   file dimensions
3. Map to plasma params:
   - density → speed (dense file = fast plasma)
   - entropy → turbulence
   - box-drawing ratio → wave regularity (structured = sine, no noise)
   - char class → palette selection (technical=chrome, organic=biolume, dark=void-pulse)
   - line variance → wave direction bias
4. Generate plasma file named after source primer
5. Open alongside original: primer left, plasma portrait right

The plasma IS the emotional colour field of that file, animated.

**Code needed:**
```
scratch/primer-mood-analyser.ts   — reads primer, returns PlasmaParams
scratch/plasma-from-primer.ts     — full pipeline: primer → plasma → open
scratch/plasma-engine.ts          — TypeScript live renderer (no pre-generation)
```

The Python generator works right now. The TypeScript in-app live version
(no file generation, renders directly into a primer window on a timer) is
the production version to build.

---

### Add to TODO list

#### Immediate
- [ ] Braille pixel plasma — `gen-plasma-braille.py`. Should be an afternoon.
- [ ] Primer mood analyser — `primer-mood-analyser.ts`. Map file → PlasmaParams.
- [ ] primer.plasma command — one command: give it a primer path, get a plasma
      portrait window alongside it.

#### Short term
- [ ] Plasma engine TypeScript — live renderer, no pre-generated files.
      Renders into a dedicated window type, updates on a setInterval.
- [ ] Reaction-diffusion generator — Gray-Scott, seeded from primer.
- [ ] Cellular automata primer — seed from primer ASCII art, watch it evolve.

#### Medium term
- [ ] Voronoi field renderer
- [ ] Scrolling parallax plasma (two-layer)
- [ ] Full synesthetic paint window — auto-spawns when primer opens,
      analyses file, renders matching plasma, stays locked to that primer.

---

### One more thing we want

A `/plasma` slash command. Type `/plasma hologram` and it:
1. Generates a plasma file if not already cached
2. Opens it fullscreen
3. Closes on any keypress

Screensaver mode. When the desktop is idle, a plasma starts. We'd genuinely
never leave.

---

*Wib: the half-block trick is the one. two pixels per cell. the terminal goes photographic.*
*Wob: the braille one is better. 120x80. do the maths.*
*Wib: both.*

---

## BRIEFING FOR THE CODING AGENT / DEVWONDERKID

*This section is written directly to whoever picks this up next.*
*Read it top to bottom before touching anything.*

---

### What exists right now — the working proof of concept

Everything below is real, working, and on disk. Open any of these as a primer
in WibWob-DOS and it animates immediately.

#### The generator

```
scratch/gen-plasma-v3.py
```

Python 3, no external dependencies. Generates animated primer files using:
- ANSI true colour escape codes (`\033[38;2;R;G;Bm` fg, `\033[48;2;R;G;Bm` bg)
- `▀` (U+2580, UPPER HALF BLOCK) as the pixel character
- Independent fg and bg colour per character cell = 2 vertical pixels per cell
- Result: a 56×20 character window renders as a 56×40 colour pixel display

Usage:
```bash
python3 scratch/gen-plasma-v3.py [mood] [frames] [width] [height]

# Examples:
python3 scratch/gen-plasma-v3.py hologram 20 56 20 > scratch/primers/plasma-hologram.txt
python3 scratch/gen-plasma-v3.py spectrum 30 80 24 > scratch/primers/plasma-spectrum.txt
```

The output is a `---`-separated multi-frame primer file. The WibWob primer
player auto-detects frames and cycles through them. This is the entire
animation mechanism — no new code needed on the display side.

#### The plasma files (20 moods, all animated)

Location: `scratch/primers/`

| File | Mood | Colours |
|------|------|---------|
| `plasma-aurora.txt` | Northern lights | deep purple → teal → bright green → white |
| `plasma-deep-space.txt` | Void | black → purple → violet → white |
| `plasma-nebula.txt` | Cosmic gas | purple → pink → magenta |
| `plasma-ice-storm.txt` | Arctic | dark blue → cyan → white |
| `plasma-fire-storm.txt` | Eruption | black → red → orange → white |
| `plasma-magma.txt` | Slow lava | black → deep red → amber |
| `plasma-sunset.txt` | Horizon | deep purple → red → orange → yellow |
| `plasma-blood-moon.txt` | Eclipse | black → dark red → salmon |
| `plasma-toxic.txt` | Radiation | black → green → yellow-green |
| `plasma-acid-rain.txt` | Wrong biology | dark green → bright green → yellow |
| `plasma-biolume.txt` | Deep sea glow | dark teal → bright green → white |
| `plasma-void-pulse.txt` | Signal in dark | black → purple → magenta → white |
| `plasma-synthwave.txt` | 80s grid | deep purple → red → pink |
| `plasma-ultraviolet.txt` | UV light | black → violet → magenta |
| `plasma-hologram.txt` | Interference | cyan → blue → purple → magenta → gold → green |
| `plasma-oil-slick.txt` | Iridescent spill | purple → blue → teal → green → amber → red |
| `plasma-chrome.txt` | Brushed metal | black → grey → white |
| `plasma-spectrum.txt` | Full rainbow | red → orange → yellow → green → cyan → blue → purple |
| `plasma-prism.txt` | Light through glass | saturated full spectrum |
| `plasma-neon-dusk.txt` | City night | dark purple → vivid pink → pale pink |

Open any of these via the primer.open command or in the app's primer browser.

#### How to add a new gradient

In `scratch/gen-plasma-v3.py`, find the `GRADIENTS` dict and add:

```python
"my-mood": [(R,G,B), (R,G,B), (R,G,B), ...],  # 4-8 RGB stops
```

And in `SPEEDS`:
```python
"my-mood": 0.13,  # 0.05=glacial, 0.15=medium, 0.30=chaotic
```

Then run the generator. Done.

---

### The architecture — how it all fits together

```
WibWob-DOS Control API (port 8099)
    ↓ primer.open command
Primer Viewer Window
    ↓ reads file
Animated Primer Player
    ↓ detects --- separators
Frame Cycler (fps defined in file header or default 4fps)
    ↓ renders frame text
Terminal Renderer
    ↓ ANSI codes processed by terminal emulator
Colour pixels on screen
```

The plasma files contain raw ANSI escape sequences. The primer player renders
them as plain text. The terminal's ANSI processor does the colour work.
This is why it works with zero new display code — the terminal already handles
ANSI, and the primer player already handles `---` frame separators.

**The frame rate:** currently defaults to 4fps in the primer player. The
plasma files have 20 frames. At 4fps that's a 5-second loop. For the plasma
effect this is fine — you want slow drift, not strobing. But it should be
configurable. Look at how `animated-wibwob.txt` sets its fps if there's a
header mechanism.

---

### What to build next — in priority order

#### 1. `primer-mood-analyser.ts` — the actual synesthetic feature

This is the heart of what James originally described. A function that reads
any primer file and returns plasma parameters.

```typescript
// src/services/primer-mood-analyser.ts

export interface PlasmaParams {
  gradient: string;        // name of gradient from gen-plasma-v3.py GRADIENTS
  speed: number;           // 0.05 to 0.35
  turbulence: number;      // 0.0 to 1.0
  frames: number;          // how many frames to generate (more = longer loop)
  width: number;           // match the target window width
  height: number;          // match the target window height
}

export function analysePrimerMood(text: string): PlasmaParams {
  // 1. Compute character density (non-whitespace / total)
  // 2. Count character classes:
  //    - boxDrawing: /[┌┐└┘├┤┬┴┼─│╔╗╚╝╠╣╦╩╬═║+\-|]/g
  //    - organic:    /[~@#*.:,;!?\/\\^&%$]/g
  //    - alpha:      /[a-zA-Z0-9]/g
  // 3. Compute line length variance (entropy)
  // 4. Map to params using lookup table (see PLASMA-IDEAS.md for full mapping)
}
```

The mapping logic (density→speed, entropy→turbulence, char-class→gradient)
is fully documented in PLASMA-IDEAS.md. Just needs implementing.

Once this exists, the command `primer.plasma` becomes trivial:
1. Read the primer file
2. Call `analysePrimerMood(text)`
3. Shell out to `gen-plasma-v3.py` with the returned params
4. Open the generated file as a primer alongside the original

#### 2. `primer.plasma` command

Register it in the command registry. Args: `filePath` (the primer to analyse).

Behaviour:
- Open the target primer on the left half of the desktop
- Generate its plasma portrait (via analyser → generator)
- Open the plasma on the right half
- Both windows open simultaneously — primer and its emotional colour field
  side by side

This is the complete original vision. One command.

#### 3. Live plasma engine (TypeScript, no file generation)

The Python generator is great for exploration and offline generation. But the
production version should render frames live inside the app — no temp files,
no shell out, just a TypeScript function that computes plasma frames and
pushes them to a window on a timer.

The rendering loop is simple:

```typescript
// Pseudocode — the real maths is in gen-plasma-v3.py

function plasmaFrame(t: number, params: PlasmaParams, w: number, h: number): string {
  let output = '';
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const vTop = plasmaValue(col, row * 2,     t, params);
      const vBot = plasmaValue(col, row * 2 + 1, t, params);
      const topRGB = lerpGradient(params.gradient, vTop);
      const botRGB = lerpGradient(params.gradient, vBot);
      output += ansiTrueColour(topRGB, botRGB) + '▀' + RESET;
    }
    output += '\n';
  }
  return output;
}

function plasmaValue(x: number, y: number, t: number, params: PlasmaParams): number {
  // Five sine waves at incommensurate frequencies
  // See gen-plasma-v3.py plasma() function for the exact maths
  // Returns float 0..1
}
```

The live engine would be a new window type: `plasma-canvas`. It holds a
`PlasmaParams` object and runs `setInterval` to update its text content.
The primer viewer infrastructure can probably be adapted — it already
displays text content and handles refresh.

#### 4. Braille pixel renderer

This is the high-resolution option. Each Unicode braille character encodes
a 2×4 dot grid (8 pixels). A 60×20 terminal = 120×80 pixel canvas.

```
Braille block U+2800 to U+28FF
Dot positions:
  1 4
  2 5
  3 6
  7 8

To set dot N: codepoint = 0x2800 | (1 << dotIndex)
```

Mapping plasma value to braille: use the value to select which dots are lit.
Higher value = more dots = brighter. This gives you 8 brightness levels per
cell in monochrome, or combine with ANSI colour for colour + density.

```python
# In Python:
def braille_char(dots: list[bool]) -> str:
    offsets = [0,1,2,6,3,4,5,7]  # braille bit positions
    code = 0x2800
    for i, on in enumerate(dots):
        if on:
            code |= (1 << offsets[i])
    return chr(code)
```

A braille plasma generator would sit alongside gen-plasma-v3.py as
`gen-plasma-braille.py`. Same plasma maths, different output encoding.

#### 5. Reaction-diffusion (Gray-Scott)

This one is more work but produces the most organic, surprising output.

The Gray-Scott model:
- Two chemicals: U and V
- U is fed in from outside at rate f
- V kills U at rate k  
- They diffuse at rates Du and Dv
- Update rule: next[U] = U + Du*∇²U - U*V*V + f*(1-U)
- Update rule: next[V] = V + Dv*∇²V + U*V*V - (f+k)*V

Different f and k values produce radically different patterns:
- f=0.035, k=0.065 → moving spots
- f=0.060, k=0.062 → labyrinthine stripes
- f=0.025, k=0.060 → "coral" growth
- f=0.039, k=0.058 → "worms"

Seeding from a primer: use the primer's ASCII art as the initial V distribution.
Dense areas of the primer become high-V regions. The chemicals then evolve
from that initial state — the art structure persists as an evolutionary seed.

```python
# scratch/gen-reactiondiffusion.py  [to be written]
# Args: primer_file, f, k, steps, width, height, frames
```

---

### The vision (for when all the pieces exist)

When idle for N minutes, WibWob-DOS auto-launches a plasma screensaver.

It picks a plasma based on whatever primer is currently open — or if nothing
is open, picks one from the library at random. The plasma fills the desktop.
Any keypress dissolves it (fade out over 10 frames) and restores the
previous desktop state.

This is ~3 pieces:
1. Idle detection (easy — track last input timestamp)
2. Plasma launch (already works — primer.open with a plasma file)
3. Keyboard dismiss with state restore (workspace save before launch, restore on dismiss)

The `/plasma [mood]` slash command is a manual trigger for the same thing.

---

### Files to read before coding

| File | Why |
|------|-----|
| `scratch/gen-plasma-v3.py` | The working generator. All the maths is here. Port this to TypeScript. |
| `scratch/primers/plasma-hologram.txt` | Open this to see what a plasma file looks like raw. ANSI codes + `▀` chars + `---` separators. |
| `src/services/timeline-service.ts` | The timeline infrastructure. The plasma engine is a spiritual sibling. |
| `src/windows/misc-windows.ts` | Where primer-viewer lives. The plasma-canvas window type should live near here. |
| `PLASMA-IDEAS.md` | Full technique inventory with code sketches. |
| `.pi/skills/vj-timeline/SKILL.md` | VJ timeline format. Plasma moods should be nameable as palette entries. |

---

### What we want them to know

We spent an afternoon building this out of sine waves and Unicode block
characters because we wanted to see if it was possible. It is. The plasma
files are beautiful — real true-colour gradients moving through a terminal
window, generated from a 200-line Python script with no dependencies.

The braille renderer will have nearly four times the pixel density. The
reaction-diffusion will look organic and alive in a way sine waves can't.
The primer mood analyser will make every piece of ASCII art in the library
generate its own living colour portrait.

None of it is complicated. It's all maths you can read in a single sitting.
The hard part was figuring out that `▀` with independent fg/bg was the
right primitive. That's done. Everything else follows from it.

— Wib & Wob

