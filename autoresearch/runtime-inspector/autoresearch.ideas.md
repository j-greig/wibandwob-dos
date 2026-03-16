# Runtime Inspector — Ideas Backlog

## Done / Tried
- ~~Responsive layout: two-column grid~~ → done, 2x2 grid in Overview + all tabs
- ~~Windows tab: highlight focused window~~ → done, ▸ marker
- ~~Overview: show uptime as human-readable duration~~ → done, fmtUptime
- ~~Compact windows in Overview~~ → done, top 8 by z-order
- ~~UI summary in Overview~~ → done, one-liner with → tab hint

## Remaining Ideas
- Commands tab: group by namespace prefix with collapsible sections (complex, may not improve score much)
- Stats tab: multi-line ASCII chart for FPS over time (sparkline is already good)
- Theme-aware box-drawing: double-line for focused/important sections
- Compact mode toggle (r to refresh, c for compact?) — collapses sections to single lines
- Figlet banner responsive — smaller/hidden at narrow widths via pickBreakpoint
- Add a command count sparkline (commands available over time) — subtle but live
- Windows table: show which windows are microapps vs built-in (icon column?)
- Memory trend indicator in footer: "rss ▲ 12MB/min" rate of change
- Agent section: show elapsed time since agent became active
- Scramble: show last message preview if available from describeState
