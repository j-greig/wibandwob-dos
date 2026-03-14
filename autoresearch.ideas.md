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
- Tab switching input↔log, mouse click, focus indicator [WRITE]/[LOG]
- Query command (peer/kind/tag/text search, structured JSON)
- Summarize command (stats, breakdowns, recent entries)

## USABILITY 5→6 (remaining 1 point)
- Mouse scroll in logBox (blessed scrollable + mouse:true)
- Arrow keys up/down as alternative to j/k in log mode
- Enter in log mode → no-op or expand entry (don't submit empty)
- Status bar key hints update per focus mode (WRITE hints vs LOG hints)

## AGENT_XP 6→7 (remaining 1 point)
- describeState: include available commands list so agent knows what it can do
- describeState: include current filter state, focus mode, scroll position
- describeState: list visible entries (not just stats) so agent can read the journal
- Add `journal.list-commands` or expose via describeState.commands[]

## DEFERRED / FUTURE
- Agent Devlog pivot: file path detection + clickable refs → editor.open
- Section grouping from devlog headings (collapsible groups)
- Color-code entries by kind (subtle bg tint per kind)
- Animated cursor/pulse on input line
- Empty state: ASCII art + "start writing" message
- Responsive breakpoint: narrow mode collapses metadata columns
