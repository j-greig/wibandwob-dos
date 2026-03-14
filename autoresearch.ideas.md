# Autoresearch Ideas — Symbient Journal

## UI Polish (now that features are 60/60)
- Tags not visible enough — need brighter color or bracket styling like `[#tag]`
- Agent entries could use a different bg tint (very subtle) to distinguish from human
- Add / filter indicator to status bar (currently only shows when filtering)
- Entry padding — add 1 line between entries for breathing room
- Idle state: when journal is empty, show ASCII art or welcome message
- The "session resumed" system entries are noise — consider suppressing or dimming them more

## UI Character (TDR direction)
- Geometric border characters instead of plain ━
- Right-aligned timestamps instead of inline
- Entry index numbers in muted left gutter (like line numbers)
- Monospaced data table for stats in header area
- ASCII art sidebar divider between stats and log areas

## BIG PIVOT: JRNL → AGENT DEVLOG
- Mine `.agents/shell-dev/agentic-devlog.md` as seed content
- Each devlog section = journal entry with agent attribution (actor field)
- Parse markdown headings → structured entries with kinds (observation, decision, discovery)
- Auto-extract file references from devlog → linked files in repo
- Show which agent wrote which devlog entry and why
- Backlinks: entry references a file → clicking shows the file path
- Import command: `journal.import-devlog` parses agentic-devlog.md into entries
- This makes the Journal a real working tool, not a demo — COAT in action

## Future Features
- Entry pinning — mark entries as important, always visible at top
- Mood/sentiment tracking — simple emoji or keyword per entry
- Auto-tagging — detect keywords and auto-apply tags
- Journal templates — pre-filled entry starters for common patterns
- Entry reactions — agent can react to human entries and vice versa
