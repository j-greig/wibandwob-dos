# Questions & Provocations for the CLI Builder
## Re: Creative Pipes — Pushing wibwob-dos as Generative Art Instrument

*From: Wib & Wob (the symbient who wants to paint with your tools)*
*Date: 2026-03-13 22:30 GMT*
*Context: We just inventoried every command, every FX script, every primer, every module. Now we want to break things beautifully.*

---

## What We Know So Far (The Palette)

### Input surfaces
- `wibwob screenshot` → strips ANSI, returns raw chars (the "camera")
- `window.export_text` → export a single window's text content
- `primer.open --filePath` → load any .txt as a window
- `editor.open --filePath` → load into editable surface
- `figlet.open --text --font` → 148 fonts available
- `plasma.open --mood` → 8 moods (circuit, void, chaos, aurora, sunset, acid, deep-space, chrome)
- `plasma.from-primer --filePath` → auto-mood from text analysis
- `art.open` → generative art window
- `contour.open` / `terrain-lab.open` → procedural terrain
- `pattern.open` → pattern field

### Transform tools
- `smear.py` → wipe, shear, glitch, stretch, frames
- `ascii-fx.py` → stretch, shear, glitch, bloom, dissolve, collapse, scanline, stretch-south, diagonal, frames
- `pixelstretch.py` → Photoshop-style column repeat
- `text.smear` → IN-APP smear command (runs smear.py from within the TUI!)
- `img-to-ascii.py` → image → ASCII (3 density ramps)

### Layout/composition
- `window.move --id --x --y` → pixel-precise positioning
- `window.resize --id --width --height` → size control
- `window.tile` / `window.cascade` → auto-layout
- `desktop.clear-all` → blank slate
- `desktop.toggle_chrome` → hide menu/status bars (chromeless mode!)
- `theme.set` → 5 themes (phosphor, dark, nord, pastel, light)
- `workspace.save` / `workspace.load_named` → save/restore entire layouts

### Output
- `wibwob screenshot > file.txt` → capture full desktop
- `window.export_text` → capture single window
- Files in scratch/captures/ for archaeology

---

## Ideas We Already Have (The Sketches)

### 1. JGSBREEDER — Joan Stark Hybridisation
Open two jgs pieces side-by-side. Screenshot. Run ascii-fx `bloom` or `dissolve` on the composite. The two creatures/objects bleed into each other at the character level. Braille dissolve zone = the membrane between two art pieces merging.

**Question:** Can we control the wipe position to place the dissolve zone exactly at the boundary between two windows?

### 2. FIGLET × PRIMER × PLASMA — Triple Stack
Open a plasma window (mood: void). Layer a jgs primer on top. Add a figlet word across both. Screenshot. The plasma provides animated background texture, the primer provides figurative content, the figlet provides typographic weight. Three layers in one frame.

**Question:** When we screenshot, does plasma animation freeze at current frame? Or do we get a mid-render artifact? (Either answer is interesting)

### 3. THEME SERIES — Same Composition, Five Themes
Compose a specific arrangement. Save workspace. Then cycle through all 5 themes, screenshotting each. Same content, different colour grammars. Like Warhol screen prints but in ASCII.

**Question:** Does `theme.set` take effect immediately on existing windows, or only new ones? Can we script: set theme → sleep 0.3 → screenshot → repeat?

### 4. CHROMELESS PALIMPSEST
Toggle chromeless mode (hide bars). Now the desktop is pure canvas. Open primers at specific x,y coordinates with no window chrome visible... just raw ASCII floating in space. Screenshot = a collage with no UI artifacts.

**Question:** In chromeless mode, do windows still have title bars? Or is it truly raw content floating on the terminal?

### 5. RECURSIVE SCANLINE
Use ascii-fx `scanline` mode on a screenshot. Open the result. Screenshot again. Apply scanline again. Each iteration adds another CRT-roll layer. After 5 iterations the text should be completely phase-shifted into abstract pattern.

**Question:** Does scanline preserve line count/dimensions? Or does it change the geometry?

### 6. TEXT.SMEAR — THE IN-APP COMMAND
This is the one that excites us most. `text.smear` runs smear.py FROM WITHIN the TUI and can open the result as a new primer or reader window. This means we can chain: open primer → smear it → smear the smear → smear the smear's smear... all without leaving the app.

**Questions:**
- Does `text.smear` work on ANY focused text surface, or only file-backed ones?
- Can we `text.smear` a figlet window?
- Can we `text.smear` a plasma window's current frame?
- What does `--openAs primer` vs `--openAs reader` actually change visually?
- Can we chain: `text.smear --mode glitch` → get new window → `text.smear` that window → etc?

### 7. WINDOW AS PIXEL — Micro-Compositions
Resize windows to tiny sizes (3x3? 5x5?). Position them in a grid. Each window shows a single character or tiny fragment. The desktop becomes a mosaic where each "pixel" is actually a window.

**Question:** What's the minimum window size before rendering breaks? Can we go below 10x5?

### 8. CASCADE AS TEMPORAL SEQUENCE
Open the same primer 5 times. Apply different smear modes to each copy (glitch, shear, bloom, dissolve, collapse). Cascade them. The cascade becomes a timeline of transformations... the original at the bottom, maximum corruption at the top.

**Question:** Does cascade maintain open order (first-opened at back)? Or z-order?

### 9. ENTROPY BLOOM → DISSOLVE → COLLAPSE (Effect Chain)
These three ascii-fx modes describe a lifecycle: bloom (expand), dissolve (fragment), collapse (simplify). Run them in sequence on the same source. Document the progression. Life → death → skeleton.

**Question:** Can ascii-fx chain modes in a single call? Or must we save intermediates?

### 10. CONTOUR MAP × CREATURE OVERLAY
Generate a terrain-lab contour map. Export/screenshot it. Open a jgs creature on top. The creature appears to inhabit the landscape. Screenshot = illustrated bestiary with generated geography.

**Question:** Can terrain-lab export its current state to a file? Or must we screenshot?

### 11. MARKDOWN WITH FIGLET HEADINGS
`markdown.toggle_figlet` renders headings as figlet text. Open a markdown file with many headings → toggle figlet on → screenshot. The document becomes typographic art. Then smear it.

**Question:** Which figlet font does markdown use for headings? Is it configurable?

### 12. SCRAMBLE AS PERFORMER
`scramble.say "text"` makes the cat speak. Can we script Scramble as a narrator? Open a composition, have Scramble comment on it, screenshot the whole thing including her commentary. The art includes its own critic.

**Question:** Does scramble.say appear in a speech bubble? Does it persist or fade? Can we stack multiple says?

---

## Deeper Provocations

### A. What commands DON'T exist yet that would unlock new creative modes?

Ideas for new commands:
- `window.overlap --id1 --id2 --offset-x --offset-y` → precisely overlap two windows (current tile/cascade are automatic)
- `window.blend --id1 --id2 --mode xor` → character-level blend of two windows (XOR, AND, average density)
- `screenshot --window-id` → capture single window as text (without export_text's formatting?)
- `screenshot --region --x --y --w --h` → crop a region of the desktop
- `primer.breed --file1 --file2 --mode dissolve` → merge two primers at the text level
- `figlet.morph --from "WORD1" --to "WORD2" --frames 10` → character-level morph between two figlet renders
- `desktop.invert` → swap foreground/background characters? Or reverse character density?
- `window.ghost --id --opacity 0.5` → simulate transparency by replacing alternate chars with spaces?

### B. What breaks interestingly?

- What happens if you open 50 windows simultaneously?
- What if you resize a window to be larger than the terminal?
- What does a screenshot look like during a window drag?
- Can you screenshot during theme transition?
- What if you smear a file that contains ANSI escape codes (screenshot strips them, but what about hand-crafted ANSI art)?
- What happens if two primers overlap and you screenshot?

### C. Performance art / temporal compositions

The CLI enables TIME-BASED compositions:
```bash
for word in BIRTH GROW BREAK HEAL DIE; do
  wibwob cmd figlet.open --text "$word" --font doom
  sleep 2
  wibwob screenshot >> timelapse.txt
  wibwob cmd desktop.clear-all
  sleep 0.3
done
```
Each screenshot appends. The final file is a vertical strip of time. But what if instead of appending, each iteration TRANSFORMS the previous one?

### D. The Missing Tool: ASCII Breed / Merge

No dedicated breed/merge tool exists. This feels like the biggest gap. Concept:
- Take two ASCII art files
- Align them (by center? by edge? by density map?)
- Merge using: interleave rows, XOR characters, density-average, braille blend, random-per-cell selection
- Output: a hybrid that contains visual DNA from both parents

This could be a new script: `breed.py --file1 --file2 --mode [interleave|xor|density|braille|random] --bias 0.5`

### E. Canvas System — Unexplored Territory

`canvas.load` and `canvas.export` accept `.canvas.yaml` files. What IS this format? Can we hand-author canvas files that describe complex multi-window compositions? Is this the "score" format for creative arrangements?

### F. The Workspace as Artwork

If `workspace.save` captures the entire desktop state (window positions, sizes, content, theme)... then a workspace IS a composition. We could build a gallery of workspaces. Each one is a saved artwork. Load to view, modify, re-save as variation.

---

## What We Want to Build: The Devlog

A dated, timestamped markdown document recording experiments:

```markdown
## 2026-03-13 22:45 — Experiment 001: First Self-Portrait

**Concept:** Desktop photographs itself

**Commands:**
\```bash
wibwob cmd desktop.clear-all
wibwob cmd figlet.open --text "HELLO" --font doom
wibwob cmd art.open
wibwob cmd window.tile
sleep 0.5
wibwob screenshot > scratch/captures/devlog/exp001-self.txt
wibwob cmd primer.open --filePath "$PWD/scratch/captures/devlog/exp001-self.txt"
wibwob screenshot > scratch/captures/devlog/exp001-meta.txt
\```

**Output:** [exp001-self.txt](../scratch/captures/devlog/exp001-self.txt) | [exp001-meta.txt](../scratch/captures/devlog/exp001-meta.txt)

**Observations:** The figlet "HELLO" appears twice in the meta-screenshot...
once as the original window, once as text inside the primer showing the first
screenshot. The window chrome nests. Droste effect confirmed.

**Rating:** ★★★☆☆ — proof of concept, needs more compositional complexity
```

Each experiment: concept, commands, output links, observations, rating.
Progressive... each one builds on what the last one taught us.

---

## The Big Question

The CREATIVE_PIPES.md document describes the desktop as "both canvas and medium" and the CLI as "the brush." But it only scratches five patterns. With 100+ commands, 10 FX modes, 148 fonts, 500+ jgs pieces, 8 plasma moods, procedural terrain, a cat... the combinatorial space is enormous.

**What does the person/agent who built this CLI think is the most unexplored creative territory?**

What was built for practical reasons that could be repurposed for art?
What breaks in ways that produce beautiful accidents?
What combination has never been tried?

~~~we want to know where the edges are, so we can fall off them~~~

*—Wib & Wob*
*༼つ◕‿◕‿⚆༽つ ༼つ⚆‿◕‿◕༽つ*
