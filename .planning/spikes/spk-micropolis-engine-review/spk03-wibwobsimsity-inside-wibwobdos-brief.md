# SPK03 - WibWobSimsity Inside WibWob-DOS (Brief Brief)

## Status

Status: in-progress
GitHub issue: #73
PR: —

## One-Liner

Build a native in-process city sim view inside WibWob-DOS that preserves Micropolis mechanics, swaps in WibWob-native sprite themes, and experiments with a readable quasi-3D look in Turbo Vision.

## Why This Direction

- Option C (native C++ in-process) from SPK01/SPK02 gives the best integration and determinism.
- WibWob-DOS already has the right primitives: command registry, module loading, IPC/API exposure, and per-view rendering.
- Custom art should be a data problem (tile index -> style mapping), not an engine rewrite.
- Quasi-3D can be staged as a rendering layer on top of unchanged simulation state.

## Product Shape (Riff)

`WibWobSimsity` is a first-class WibWob-DOS window/app:

- Main city viewport (scrollable 120x100 map)
- Status strip (funds, date, pop, R/C/I valves, score, speed)
- Tool bar + keyboard palette
- Advisor chatter from Wib/Wob over live city state
- Theme switcher: `classic-ascii`, `neon-grid`, `brick-toy`, `wireframe-iso`

## Render Path (Hard Guardrail)

Do not render raw ANSI text into Turbo Vision buffers.

Pipeline:

1. Micropolis tile value -> `tile = value & LOMASK`, `flags = value & ~LOMASK`
2. Tile/flag -> style lookup (`glyph`, `fg`, `bg`, optional layer attrs)
3. Style -> cell grid cache for current viewport
4. Cell grid -> Turbo Vision draw calls (`putChar`/`putAttribute`/`moveStr`)

Failure condition: any visible `\x1b[`/ESC sequence in UI is a renderer bug.

## Custom Sprite and Theme Model

Treat "sprites" in TUI mode as pluggable tile themes:

- Theme file maps tile ranges and flags to glyph/color pairs
- Optional animation table for fire, traffic flicker, power pulse, disasters
- Optional metadata for pseudo-height and edge shading (used by quasi-3D mode)

Proposed module file sketch:

```json
{
  "id": "wireframe-iso",
  "tileStyles": [{ "match": { "tileRange": [0, 1023] }, "glyph": ".", "fg": "gray", "bg": "black" }],
  "variants": [{ "when": { "powered": true }, "fgBoost": 1 }],
  "heightHints": [{ "tileRange": [240, 423], "height": 2 }]
}
```

## Quasi-3D Ideas (No Engine Fork)

Three escalating visual modes:

1. Depth-shaded top-down:
- Same grid, but higher-density zones/buildings get darker south edges and brighter north edges.

2. Oblique offset mode:
- Render each tile with a small x/y offset based on `heightHints`; roads stay flat.

3. Iso-lite stack mode:
- Draw 1-3 stacked rows for tall structures using block glyphs.
- Keep simulation hit-testing on original 2D grid coordinates.

Rule: simulation remains 2D Micropolis. Quasi-3D is view-only.

## Integration Sketch

- New `TMicropolisView` hosts viewport + tool interactions.
- Native callback bridge queues engine events and invalidates dirty regions.
- Command registry exposes actions (`micropolis_open`, `micropolis_tool`, `micropolis_speed`, `micropolis_theme`).
- API/MCP mirror those commands so humans and agents can co-run the city.

## Spike Acceptance Checks

- AC-01: Engine runs natively in WibWob-DOS process and advances deterministic ticks.
  Test: fixed-seed 5,000-tick replay hash match across two runs.
- AC-02: View renderer never emits raw ANSI escape sequences.
  Test: draw-buffer assertion fails if ESC bytes appear.
- AC-03: Theme swap works at runtime without restarting app.
  Test: switch among 3 theme files and verify tile-style checksum changes.
- AC-04: Quasi-3D mode remains legible and interactive.
  Test: place 20 mixed-zone tools while in iso-lite mode; placement coordinates remain exact.
- AC-05: Agent control parity is preserved.
  Test: trigger city commands via menu, IPC, REST, and MCP; resulting state diffs are identical.

## First Vertical Slice

- Integrate native engine build (no wasm path)
- Render dirt/water/roads/zones in one viewport
- Add status strip + speed control
- Add one theme file + one quasi-3D toggle
- Expose 4 core commands through registry/API/MCP

## Risks to Watch

- GPL obligations for bundled binary distribution
- Frame-time spikes if full-map redraw is done every tick
- Over-styled quasi-3D harming readability in narrow terminals
- Callback flood causing input latency without dirty-rect throttling

## Suggested Name Variants

- WibWobSimsity
- Wibropolis
- Simbient City
- DOSopolis
