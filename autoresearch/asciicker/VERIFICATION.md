# Verification Strategy — Agent-Driven Visual Renderer

## The Problem
An agent building a visual renderer can't eyeball the output like a human.
We need verification methods that are rigorous enough for an agent to
self-assess at each phase without human visual inspection.

## Tools Available

### 1. PNG screenshots (visual comparison)
- `scripts/capture-tui-png.sh --display N` captures the full TUI as PNG
- Agent can READ PNG files — Claude vision sees the rendered output
- Reference frames: `autoresearch/asciicker/reference-frames/` (15 PNGs)
- Checkpoint shots: `autoresearch/asciicker/shots/`

**Usage pattern**: after each phase, capture a PNG, read it, compare against
the reference frame that most closely matches the camera angle/terrain.

### 2. Text captures (structural analysis)
- `curl http://127.0.0.1:8099/screenshot/text?id=N` gets ANSI text
- Agent can grep/analyse the text for structural properties
- Useful for: gap detection, colour diversity, glyph distribution

### 3. Programmatic checks (autoresearch.checks.sh)
- Runs after each experiment
- Can verify measurable properties of the output
- Fast feedback without LLM scoring

## Phase-Specific Verification

### Phase 0: Architecture split
Verification: EASY — pure refactor
- `bun run typecheck` passes
- Game plays identically (same text capture output)
- File count increased, no file > 300 lines
- Score should be >= baseline (9.3)

### Phase 1: Triangle rasterizer
Verification: CRITICAL — this is where visual correctness matters most

**Gap test** (programmatic):
```bash
# Count "empty" cells in the terrain area of text capture
# v1 has gaps (sky colour bleeding through)
# v2 should have zero gaps in the terrain footprint
```

**Coverage test** (programmatic):
- Capture text frame
- Count cells that are NOT the sky/background colour
- v2 terrain coverage should be >= v1 coverage (more filled pixels)

**PNG comparison** (visual):
- Capture screenshot after Phase 1
- Read it alongside reference frame-00
- Check: does the terrain form a continuous filled surface?
- Check: are there visible depth differences (higher terrain = higher on screen)?
- Check: is the isometric angle approximately 30° (matching reference)?

**Projection sanity** (programmatic):
- Place a known point at world centre, verify it projects to screen centre
- Rotate yaw 90°, verify the terrain rotates visually
- Zoom in/out, verify terrain scales

**Performance gate**:
- Measure frame time: must be < 125ms (8fps)
- Log to describeState so scorer sees it

### Phase 2: auto_mat + 2x2 + cliffs
Verification: VISUAL — this is where it should start looking like asciicker

**Colour diversity test** (programmatic):
- Count unique ANSI colour codes in text capture
- v1: ~20-40 unique colours
- v2 with auto_mat: should be 80+ unique colours (the dithering effect)

**Glyph diversity test** (programmatic):
- Count unique non-space glyphs in terrain area
- v1: ~15 glyph types
- v2 with auto_mat ramp: should include .:% characters from the ramp

**PNG comparison** (visual):
- Capture screenshot
- Compare against reference frames
- Check: do colour gradients look smooth (not blocky biome boundaries)?
- Check: are cliff edges visible where height drops?
- Check: does it look more like the reference than v1?

**A/B comparison**:
- Keep v1 screenshot as `shots/v1-baseline.png`
- Capture v2 as `shots/v2-phase2.png`
- Read both side by side — agent can assess which looks closer to reference

### Phase 3: Water + reflections
**Water detection** (programmatic):
- Text capture should contain water-specific glyphs (≈ ~ etc.)
- Water area should show dimmed/shifted colours (reflection)

**PNG comparison**:
- Reference frame-00 shows water in lower half
- Our screenshot should show similar water area with visible reflections

### Phase 4-5: Real data + sprites/meshes
**Format validation** (programmatic):
- .a3d: assert patch count > 0, heights in valid range
- .xp: assert width/height > 0, layer count >= 3
- .akm: assert vertex count > 0, face count > 0

**Visual validation**:
- PNG comparison: loaded map terrain should look recognisably like reference
- Sprites should be visible on terrain (not floating, not underground)

## The Checkpoint Protocol

After EVERY significant change:

1. `bun run typecheck` — must pass
2. Restart app
3. Capture PNG: `scripts/capture-tui-png.sh --display N --out autoresearch/asciicker/shots/PHASE-STEP.png`
4. READ the PNG — agent visually inspects
5. Compare against most relevant reference frame
6. Run programmatic checks if applicable
7. Run autoresearch scorer
8. Log result with keep/discard

## Reference Frame Index

| Frame | Time | Shows | Use for comparing |
|-------|------|-------|-------------------|
| frame-00 | 0.0s | Player on grass near water, trees, path | General terrain + water |
| frame-04 | 7.0s | Similar angle, player moved | Movement verification |
| frame-07 | 12.2s | Different terrain area | Biome variety |
| frame-10 | 17.4s | Rotated view | Yaw rotation check |
| frame-14 | 22.8s | Final frame | Overall quality |

## Visual Checkpoints

Each phase has a checkpoint: capture a PNG, compare against a reference
frame, answer specific yes/no questions. The script `visual-checkpoint.sh`
automates the structural checks and frames the visual questions.

```bash
bash autoresearch/asciicker/visual-checkpoint.sh phase1
bash autoresearch/asciicker/visual-checkpoint.sh phase2
bash autoresearch/asciicker/visual-checkpoint.sh phase3
```

The agent then reads the captured PNG alongside the reference and answers
the visual questions honestly. This is the visual unit test.

### Checkpoint targets (what each phase should look like)

| Phase | Target visual | Reference frame | Key property |
|-------|--------------|-----------------|--------------|
| 0 | Identical to v1 | shots/v1-baseline.png | No visual change |
| 1 | Gap-free terrain, visible depth | frame-00 | Continuous surface, no sky bleed |
| 2 | Colour-rich dithered terrain, cliff edges | frame-00 | Smooth gradients, ledge glyphs |
| 3 | Water with reflections | frame-00 (lower half) | Blue area with mirrored terrain |
| 4 | Recognisable loaded map | frame-00 (full) | Actual game terrain, not procedural |
| 5 | Sprites + meshes on terrain | frame-04 (player + trees) | 3D objects correctly occluded |

### Structural gates (programmatic, no LLM needed)

| Phase | Metric | v1 value | v2 target | How to measure |
|-------|--------|----------|-----------|----------------|
| 1 | Terrain coverage (lines with content) | ~30 | >= 30 | grep non-empty in text capture |
| 1 | Gap pixels (sky colour in terrain area) | many | zero | count background-coloured cells in terrain bounds |
| 2 | Unique fg colours | ~30 | >= 60 | count unique ANSI colour codes |
| 2 | Unique glyphs | ~15 | >= 20 | count unique non-space chars |
| 2 | Dither chars present | 0 | > 0 | grep for .:% characters |
| 3 | Water glyph count | some | >= 10 | grep for ≈~∼ chars |

These run automatically in visual-checkpoint.sh. They catch gross failures
(blank screen, missing terrain, no colours) without LLM cost.

## What "Looks Right" Means (for an agent)

Since the agent reads PNG images through vision, here are the specific
visual properties to check at each comparison:

1. **No gaps**: terrain should be a continuous filled surface, no background
   colour bleeding through between cells
2. **Depth**: higher terrain should appear higher on screen, creating a
   visible 3D surface (not a flat colour grid)
3. **Colour richness**: the reference shows many shades of green, brown,
   blue — not just 8 flat biome colours
4. **Cliff edges**: where terrain drops, there should be visible edges
   (darker lines, different glyphs)
5. **Water**: lower areas filled with blue, with subtle variation
6. **Objects**: trees/bushes/rocks visible as distinct coloured shapes
7. **Isometric angle**: the camera angle should match the reference
   (~30° elevation, diamond-shaped terrain footprint)

## The Honest Assessment Rule

After each PNG comparison, the agent must write a brief honest assessment:
- "This looks closer to the reference than v1 because [specific reason]"
- "This looks worse because [specific reason]"
- "I can't tell the difference because [reason]"

Never claim visual improvement without citing a specific visible property
that changed. The reference frames are ground truth.
