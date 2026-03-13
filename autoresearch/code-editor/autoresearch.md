# Autoresearch — Wiretext (ASCII Diagramming)

## Objective
Build a Wiretext module for WibWob-DOS — an ASCII art diagramming tool inspired by
https://github.com/mualat/wiretext. Visual wireframing with box-drawing characters,
lines, arrows, text, and UI components directly in the terminal.

Reference image: autoresearch/wiretext/wiretext.png
Wiretext source (cloned for reference): /tmp/wiretext/

## Architecture
The wiretext boxDrawing.ts contains 1200 lines of pure grid-based rendering logic
(no DOM/React dependencies) that can be adapted directly:
- Grid = string[][] (2D character array)
- CanvasObject model with position, size, type, style
- renderObjectsToGrid() renders all objects to the grid
- Box drawing chars: single/double/rounded/heavy styles
- Bresenham line algorithm for diagonals
- Hit testing, bounding boxes, resize handles
- 30+ UI component types (button, input, table, modal, etc.)

## Reusable Components from Codebase
- `src/core/ui-parts.ts` — createHeaderBar, createStatusBar
- `src/services/syntax-highlight.ts` — not needed here but ANSI pattern reusable
- Proven ANSI rendering pattern from Code Editor, Terrain Lab, Plasma

## Target Features (priority order)
1. CANVAS — grid rendered via blessed box, tags:false, ANSI for cursor/selection
2. TOOL SIDEBAR — Select, Box, Text, Line, Arrow, Connector, Pencil, Eraser
3. DRAWING — mouse click-drag to create boxes, lines, arrows on canvas
4. SELECTION — click to select, move objects, resize handles
5. HEADER BAR — title + Export/Clear/Undo/Redo buttons
6. STATUS BAR — tool name, cursor col/row, object count, box style
7. KEYBOARD SHORTCUTS — V/B/T/L/A/C/N/E for tools, Ctrl+Z undo, Ctrl+C copy
8. BOX STYLES — single/double/rounded/heavy border toggle
9. COMPONENTS — UI component palette (button, input, table, modal, etc.)
10. EXPORT — copy grid to clipboard as plain text
11. IMPORT — load ASCII art from primer files or paste text (stretch goal)

## Rendering Strategy
- Canvas: blessed box with tags:false, raw ANSI escape codes
- Grid: adapted from wiretext's Grid type (string[][])
- Cursor: ANSI reverse video on current cell
- Selected objects: ANSI highlight on border/content cells
- Tool sidebar: ANSI-styled list with active tool highlighted
- Status bar: ANSI-styled segments like Code Editor

## Rubric
5-axis: LAYOUT, READABILITY, COHERENCE, STYLE, FUNCTIONALITY — each 1-10, averaged.

- LAYOUT: spatial arrangement, chrome structure, use of space
- READABILITY: can you parse the content easily, contrast, typography
- COHERENCE: do elements work together as a unified system
- STYLE: visual polish + WibWob personality/brand identity
- FUNCTIONALITY: does the app have expected features, feel complete, actually useful

## Constraints
- Only modify files in `modules/wiretext/`
- Can import shared utilities from src/ (ui-parts, etc.)
- Must pass `bun run typecheck`
- RESTART required after changes
