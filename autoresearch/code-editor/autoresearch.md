# Autoresearch — Code Editor (slap-editor)

## Objective
Transform the bare-bones code editor into a polished VSCode-like editing experience.
Files in scope: `modules/slap-editor/index.ts` (~388 lines), `modules/slap-editor/editor-engine.ts` (~478 lines).

## Current State (baseline)
- Gutter: plain line numbers, no current-line highlight
- Text area: monochrome, no syntax highlighting, no current-line highlight
- Status bar: "untitled | Ln 1, Col 1 | 1 lines" — minimal
- Empty state: completely blank with just "1" line number — no welcome content
- No header/breadcrumb bar
- No language detection
- No scroll position indicator

## Target Features (VSCode-inspired)
1. Welcome screen when no file loaded (keyboard shortcuts, logo, tips)
2. Rich status bar: language, encoding, indent style, scroll %, dirty indicator
3. Current line highlight (subtle background change on active line)
4. Better gutter: active line number highlighted in accent colour
5. Header bar showing file path / breadcrumb
6. Syntax-aware file type detection (by extension)

## Rubric
5-axis: LAYOUT, READABILITY, AESTHETIC, COHERENCE, CHARACTER — each 1-10, averaged.

## Constraints
- Only modify files in `modules/slap-editor/`
- Must pass `bun run typecheck`
- Module reload (not full restart) should suffice: POST /commands/run {"id":"modules.reload"}
- Use host.theme() for colours, never hardcode
- ANSI escape codes work via blessed tags: true on textBox
