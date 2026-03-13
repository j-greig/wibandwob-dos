# Autoresearch — Code Editor (slap-editor)

## Objective
Transform the bare-bones code editor into a polished VSCode-like editing experience.
Files in scope: `modules/slap-editor/index.ts`, `modules/slap-editor/editor-engine.ts`.

## Reusable Components from Codebase
- `src/services/syntax-highlight.ts` — ANSI syntax highlighting for TS/JS/Python/Bash.
  Uses `highlightCode(code, lang)` returning ANSI-styled lines. Already battle-tested.
- `src/windows/browser-windows.ts` File Manager patterns:
  - `fileIcon()` — icon per file extension (ts, js, py, md, json, etc.)
  - Toolbar with path label + right-aligned action buttons with hover effects
  - `createSelectableList` for file tree sidebar
  - Breadcrumb builder from path
  - Vertical divider between panes
- `src/core/ui-parts.ts` — createHeaderBar, createStatusBar, createRow, createStack, createRule

## Target Features (priority order)
1. SYNTAX HIGHLIGHTING — import highlightCode, render ANSI lines with tags:false
2. CURRENT LINE HIGHLIGHT — accent gutter number, subtle bg on active line
3. RICH STATUS BAR — language, encoding, indent, Ln:Col, scroll %, dirty marker
4. HEADER/BREADCRUMB BAR — file path with folder structure
5. FILE TREE SIDEBAR — left pane with createSelectableList, Space to open in Finder
6. TOOLBAR — action buttons like File Manager (Save, Find, Go-to-line)
7. VIM/NANO KEYBINDINGS — hjkl nav, gg/G jump, w/b word, dd delete line, :w save

## Rendering Strategy
- textBox: tags:false, use raw ANSI from syntax-highlight.ts
- gutterBox: tags:false, ANSI for current-line number accent
- Cursor/selection: overlay ANSI escape codes on highlighted output
- This matches the proven pattern from Terrain Lab, Plasma, TR-808

## Rubric
5-axis: LAYOUT, READABILITY, AESTHETIC, COHERENCE, CHARACTER — each 1-10, averaged.

## Constraints
- Only modify files in `modules/slap-editor/`
- Can import from `src/services/syntax-highlight.ts` (existing, tested)
- Must pass `bun run typecheck`
- RESTART required after changes (src/services import change)
