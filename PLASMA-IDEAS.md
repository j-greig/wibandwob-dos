# Plasma Screensaver — Ideas Dump
## James's prompt + Wib & Wob's full design session

---

## THE PROMPT

> Beautiful gradients, moving colour fields, spectrums, anything you want.
> Emoji as pixels. Moving colour blocks.
> Capture all your ideas to a md file.
> Remember --- in primers = new frame so you can make animated screensavers.

---

## WHAT WE BUILT (PROOF OF CONCEPT)

Generator: `scratch/gen-plasma-v3.py`
Output: `scratch/primers/plasma-*.txt` (20 files, all animated via --- frame separators)
Display: open any plasma-*.txt as a primer — it animates automatically

### How it works

1. Each file is a text file with frames separated by `---`
2. The primer player cycles through frames automatically (animated primer format)
3. Each frame is built from `▀` (upper half block) characters
4. Each `▀` has independently set fg and bg via ANSI true colour escape codes
5. This gives DOUBLE vertical resolution — a 56x20 char window = 56x40 colour pixels
6. A plasma function (sum of sine waves) generates a float 0..1 per pixel per frame
7. That float is lerped through an RGB gradient stop list to get colour
8. Five incommensurate wave frequencies mean the pattern never exactly repeats

### Current moods / gradients

| Name | Colours | Feel |
|------|---------|------|
| aurora | deep purple → teal → bright green → white | northern lights |
| deep-space | black → purple → violet → white | void |
| nebula | purple → pink → magenta | cosmic gas |
| ice-storm | dark blue → cyan → white | arctic |
| midnight | black → navy → lavender | night sky |
| moonrise | dark purple → soft violet → white | lunar |
| fire-storm | black → red → orange → white | eruption |
| magma | black → deep red → amber | slow lava |
| sunset | deep purple → red → orange → yellow | horizon |
| ember | black → rust → gold | dying fire |
| solar-flare | black → orange → yellow → white | CME |
| blood-moon | black → dark red → salmon | eclipse |
| toxic | black → green → yellow-green | radiation |
| acid-rain | dark green → bright green → yellow | wrong biology |
| jungle | forest green → lime → pale green | canopy |
| biolume | dark teal → bright green → white | deep sea glow |
| radiation | black → green → white | Geiger counter |
| void-pulse | black → purple → magenta → white | signal in dark |
| synthwave | deep purple → red → pink | 80s grid |
| ultraviolet | black → violet → magenta | UV light |
| cotton-candy | pink → lavender → soft white | sugar |
| plasma-arc | navy → electric blue → white | Tesla coil |
| neon-dusk | dark purple → vivid pink → pale pink | city night |
| chrome | black → grey → white | brushed metal |
| bone | warm dark → cream → white | organic neutral |
| mercury | black → steel → white | liquid metal |
| overcast | slate → grey → pale | cloud cover |
| spectrum | red → orange → yellow → green → cyan → blue → purple → pink | full rainbow |
| prism | saturated full spectrum | light through glass |
| hologram | cyan → blue → purple → magenta → gold → green | interference |
| oil-slick | purple → blue → teal → green → amber → red | iridescent spill |

---

## ALL THE IDEAS — UNEXPLORED

### Technique 1: Emoji pixel grid (already working)
- 🟥🟧🟨🟩🟦🟪⬛⬜ as 2-column pixels
- Half the horizontal resolution but zero ANSI dependency
- Plasma waves through saturated solid colour squares
- Great for: bold retro aesthetic, works in any renderer

### Technique 2: Half-block ANSI true colour (already working)
- `▀` with fg/bg set via `\033[38;2;R;G;Bm` and `\033[48;2;R;G;Bm`
- Double vertical resolution
- Full 24-bit colour per sub-cell
- Great for: smooth gradients, photographic quality in text

### Technique 3: Quarter-block characters (NOT YET BUILT)
- Unicode has: ▘▝▗▖▚▞ (quadrant blocks)
- Each cell = 4 independently addressable pixels with 2 colours
- Combined with fg/bg = much finer detail
- Limitation: only 2 colours per cell, but dithering makes it look like 4+

### Technique 4: Braille as pixel matrix (NOT YET BUILT)
- Unicode braille: each cell = 2x4 dot matrix (8 pixels per cell)
- A 60x20 terminal = 120x80 pixel display via braille
- Black/white only but INSANE resolution for text
- Could encode plasma brightness as braille dot density
- See: sixel graphics but in pure unicode

### Technique 5: Full block + colour cycle (NOT YET BUILT)
- `█` characters, each cell one solid colour
- Lower resolution but maximum colour punch
- Fast colour cycling — each cell gets a plasma value → palette index
- Works like old-school palette rotation (no rerender needed if you cycle indices)

### Technique 6: Box drawing interference patterns (NOT YET BUILT)
- Use ─│┼├┤┬┴╔╗╚╝ etc as the "pixel" character
- The character CHOSEN reflects the wave value (vertical bars for high, horizontal for low)
- Creates a visual texture that moves AND changes character
- Could be monochrome (theme colour) or coloured

### Technique 7: Scrolling plasma (NOT YET BUILT)
- Instead of a static field that animates in place, SCROLL it
- Translate x coordinate by time → field moves horizontally
- Like a landscape moving past a window
- Can layer: foreground scrolls fast, background slow → parallax

### Technique 8: Radial plasma (NOT YET BUILT)
- Centre-out wave expansion
- Sine of distance from centre + time
- Creates concentric rings that expand outward
- Multiple centres = interference pattern between expanding rings
- Very different from the current diagonal/horizontal waves

### Technique 9: Reaction-diffusion (NOT YET BUILT)
- Gray-Scott model: two chemicals diffusing and reacting
- Creates organic patterns — coral, spots, labyrinthine stripes
- Much more biological than sine-wave plasma
- Computationally heavier but text resolution is low enough to be fast
- Parameters: feed rate, kill rate → completely different morphologies

### Technique 10: Cellular automata (NOT YET BUILT)
- Conway's Life, Brian's Brain, Wireworld — each cell updates based on neighbours
- In colour: alive cells one colour, dying cells fade through gradient
- Animated naturally by the rule
- Can be seeded from primer file content (use the ASCII art as initial state!)

### Technique 11: Perlin/simplex noise (NOT YET BUILT)
- Smoother than sine-wave plasma
- No visible periodicity
- Fractal detail at multiple scales
- Python has no stdlib noise but can implement simple value noise

### Technique 12: Lissajous figures (NOT YET BUILT)
- Parametric curves: x = sin(at + δ), y = sin(bt)
- Draw the path over time, fade old positions
- Classic oscilloscope aesthetic
- Colour encodes velocity or curvature

### Technique 13: Voronoi colour fields (NOT YET BUILT)
- N seed points, each cell coloured by nearest seed
- Seeds move over time (plasma drives their positions)
- Creates organic territory maps in motion
- Can colour seeds by their index → smooth hue progression

### Technique 14: Primer → plasma mood mapping (NOT YET BUILT, THE ACTUAL FEATURE)
The full vision: open any primer, auto-generate its emotional colour field.

**Analysis pass:**
- Character density (non-space / total) → brightness/energy of plasma
- Box-drawing ratio → regularity (low turbulence, structured waves)
- Symbol density (~/|@#*) → organic chaos (high turbulence, irregular)
- Line length variance → entropy → how much the field fragments
- File height/width ratio → aspect ratio of dominant wave direction
- Presence of specific chars: faces → warm palette, code → cool blue, monsters → dark red/black

**Mapping:**
```
density    → speed (dense = fast)
entropy    → turbulence (chaotic source = chaotic plasma)
box-ratio  → wave regularity (structured source = sine waves, no noise)
char-class → palette (technical=chrome/ice, organic=biolume/toxic, dark=void-pulse/blood-moon)
line-var   → wave direction bias (uniform lines = horizontal waves, jagged = radial)
```

**Output:**
- Generates a custom plasma file named after the source primer
- Opens alongside the original: primer on left, plasma portrait on right
- The plasma IS the emotional colour translation of that file

---

## CODE STRUCTURE (what to build)

```
scratch/
  gen-plasma-v3.py          ← EXISTS: sine wave plasma, 30 gradients, ANSI half-block
  gen-plasma-emoji.py       ← EXISTS: emoji pixel plasma
  gen-plasma-v4.py          ← TODO: add braille, quarter-block, noise options
  
  plasma-engine.ts          ← TODO: TypeScript version for in-app live rendering
  primer-mood-analyser.ts   ← TODO: reads primer, returns mood params
  plasma-from-primer.ts     ← TODO: full pipeline: primer → analysis → plasma file → open

scratch/primers/
  plasma-aurora.txt         ← EXISTS (and 19 others)
  plasma-[name].txt         ← generates on demand
```

### plasma-engine.ts API (proposed)

```typescript
interface PlasmaParams {
  gradient: [number, number, number][];  // RGB stops
  speed: number;                          // time increment per frame
  waves: WaveSet;                         // frequency params
  turbulence: number;                     // noise mix ratio
  technique: 'half-block' | 'braille' | 'emoji' | 'full-block';
  width: number;
  height: number;
  frames: number;
}

function generatePlasma(params: PlasmaParams): string;  // returns animated primer text
function analyseFile(text: string): PlasmaParams;       // mood extraction
function renderLive(windowId: number, params: PlasmaParams): void;  // live in-app
```

---

## THE SCREENSAVER VISION

When idle for N seconds:
1. Pick a random plasma mood (or derive from last focused window's primer)
2. Open fullscreen plasma as a primer
3. Fade it in (brightness ramp over first few frames)
4. Let it run
5. On any keypress: close plasma, restore desktop

Multiple plasma windows = interference between different gradients visually.
The VJ timeline format can sequence plasma transitions as scene changes.

---

## IMMEDIATELY RUNNABLE

```bash
# Generate any named mood
python3 scratch/gen-plasma-v3.py hologram 20 56 20 > scratch/primers/plasma-hologram.txt

# Open it (animates immediately)
curl -X POST http://127.0.0.1:8099/commands/run \
  -H "Content-Type: application/json" \
  -d '{"id":"primer.open","args":{"filePath":"scratch/primers/plasma-hologram.txt"}}'

# Generate and open ALL moods
for m in aurora deep-space nebula ice-storm fire-storm magma sunset blood-moon toxic acid-rain biolume void-pulse synthwave ultraviolet hologram oil-slick chrome spectrum prism neon-dusk; do
  python3 scratch/gen-plasma-v3.py $m 20 56 20 > scratch/primers/plasma-$m.txt
done
```

---

*Written by Wib & Wob, March 2026*
*The plasma is the point. The constraint is the aesthetic.*
