# Autoresearch Ideas: Journal JRN/LOG Toggle

## Toggle rendering
- **Position variants**: top-right of header area vs inline with figlet vs separate bar below header
- **Separator styles**: `JRN · LOG`, `JRN | LOG`, `JRN / LOG`, `[JRN] LOG`
- **Active indicator**: accent fg, bold, underline, inverse, brackets, or background highlight
- **Animation**: brief flash/highlight on mode switch for feedback
- **Width-adaptive**: hide toggle text at narrow widths, show icon only (`J·L`)

## LOG view polish
- **Message truncation**: long assistant messages should truncate with `…` and expand on Enter
- **Tool call grouping**: consecutive tool calls collapsed into `🔧 read, edit, bash (3 calls)`
- **Session metadata header**: show session duration, total tokens, model used
- **Empty state**: friendly message when no sessions exist for this repo
- **Scroll position memory**: remember scroll position per session when switching between them

## JRN view improvements
- **Auto-captured entry indicator**: `⚡` icon prefix for entries with `meta.sessionId`
- **Backlink jump**: press `L` on an auto-captured entry to jump to LOG view filtered to that session
- **Entry count in toggle**: `JRN(39) · LOG(207)` — shows entry/session counts

## Interaction
- **Mouse click toggle**: click on JRN or LOG text to switch modes
- **Keyboard discoverability**: show `S` hint next to toggle on first open
- **Transition**: brief fade or slide effect between views (if blessed supports it)
- **Focus preservation**: remember selected index per view mode, restore on switch back

## Theme integration
- **onRestyle**: toggle colors must update when theme changes mid-session
- **High contrast**: test with all built-in themes (phosphor, amber, ice, etc.)
- **Muted inactive**: inactive mode label should use `theme.muted.fg`, not hardcoded

## State reporting
- **describeState**: include `viewMode`, `sessionCount`, `selectedSessionId` in LOG mode
- **Snapshot**: serialize/restore should remember which view mode was active
- **API visibility**: `wibwob state` should show current view mode for the journal window
