# Autoresearch Ideas — Symbient Journal

## DONE ✓
- Figlet header JRNL (slant/small responsive)
- Muted timestamps, bright entry text
- Peer-colored prefix: human=▸, agent=▹, system=·
- Day dividers ━━━ 2026-03-14 ━━━
- Status bar with entry count, peer breakdown, key hints
- Kind icons: ◊ observation, ░ note, ★ discovery, ■ decision, ? question
- Line numbers in muted gutter
- Dynamic mood indicator (curious/exploring/decisive/productive)
- Symbient/human-led/agent-led ratio in tagline
- Import-devlog command (parses agentic-devlog.md → 578 entries)
- Removed session-resumed noise

## AGENT DEVLOG PIVOT (next priority)
- Auto-detect file paths in entry text (src/, microapps/, .agents/) → render highlighted
- On Enter when focused on a file reference → open via host.runGlobalCommand("editor.open")
- Or open .md files via markdown.open
- Section grouping from devlog headings (collapsible groups)
- Agent attribution from import metadata

## UI Push to 95+
- Responsive breakpoint: narrow mode collapses metadata columns
- Color-code entries by kind (not just icon — subtle bg tint)
- Tags actually rendering in accent color (investigate blessed tag format)
- Animated cursor/pulse on input line for liveliness
- Empty state: ASCII art + "start writing" message instead of blank space
- Add subtle separator dots between spaced entries
