# Autoresearch Ideas

## Completed Apps
- LLM Orch Studio: 3.6 → 8.0
- Antopolis: 5.4 → 9.0+
- File Manager: 4.4 → 10.0
- Terrain Lab: 4.8 → 8.0
- Plasma: 5.4 → 8.0
- Code Editor: 4.4 → 9.2 (syntax highlighting, welcome screen, toolbar, relative line numbers)

## Paused Apps
- Music Player: 4.2 → 7.4 (4 viz modes, idle animations)
- TR-808: 5.4 → 6.4 (ANSI colours, preset loading fixed)
- Primer Gallery: 6.4 → 7.4 (tab counts, divider, header bar, status bar)

## Active: Spore Clock
- Baseline: 5.6 (GROWTH:5 TIME:6 BEAUTY:6 SURPRISE:3 CRAFT:8)
- Target: 8.0+ across all axes
- File: `modules/spore-clock/index.ts` (single file, ~415 lines)
- Dream features: `modules/spore-clock/DREAM-FEATURES.md`

## Proven Patterns
### ANSI Sidebar (for art+sidebar layouts)
Works for: Terrain Lab, Plasma, any createTextBlock sidebar
Recipe: A.cyn/yel/gry constants, setContent() bypass, section headers, active lists, bars

### Syntax Highlight Reuse (for code/text views)
Works for: Code Editor, could extend to Document Reader, Markdown viewer
Key: import highlightCode from syntax-highlight.ts, textBox tags:false, raw ANSI

### Structural Chrome (for any window)
Works for: File Manager, Code Editor, Primer Gallery
Recipe: header bar, vertical divider, rich status bar, toolbar buttons with hover

### Welcome Screen (for empty states)
Works for: Code Editor
Recipe: branded box-drawing title, keyboard shortcuts, navigation reference, italic hints

### Cellular Automaton Animation (for Spore Clock)
Works for: any living/breathing display module
Recipe: number[][] grid, neighbour-sum CA rules, particle overlay (Spore[]),
brownian drift, density→glyph mapping, contextual box-drawing (read neighbours
to pick junction chars), pulsing nodes via sin-wave. 8fps timer. Key insight:
organic feel comes from randomised growth thresholds, not deterministic rules.

## Rubric (active — Spore Clock)
GROWTH, TIME, BEAUTY, SURPRISE, CRAFT (5 axes, each 1-10, averaged)
- GROWTH = organic quality, asymmetry, life-like mycelial behaviour
- TIME = temporal encoding clarity, can you read the clock?
- BEAUTY = visual richness, glyph variety, colour, composition
- SURPRISE = emergent behaviour, unexpected patterns, self-organisation
- CRAFT = code quality, performance, lifecycle correctness, no leaks

## Rubric (paused — general UI apps)
LAYOUT, READABILITY, COHERENCE, STYLE, FUNCTIONALITY (5 axes, each 1-10, averaged)

## Next Targets
- Spore Clock 5.6→8+: substrate memory, colour blending, wild colonies, decay
- Code Editor 9.2→10: indent guides, bracket matching, scroll position minimap
- Contour Studio: gorgeous art, minimal chrome — status bar could be richer
- Music Player 7.4→8+: resume with more viz polish
- Backrooms Log Browser: list colouring, preview improvements
