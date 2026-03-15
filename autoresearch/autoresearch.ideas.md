# Autoresearch Ideas: Journal Microapp Quality

## CRAFT
- SDK createHeaderBar or createFigletDisplay instead of raw blessed.box for header
- Subtle animated element — pulse on the active toggle, or a breathing separator
- Entry kind icons could be more distinctive — use colour per kind, not just glyph
- LOG view header could have its own figlet or ASCII art mood
- Two-pane separator could use theme accent instead of plain `│`
- Empty states need personality — art, quote, or ASCII illustration

## USABILITY
- Search should highlight matches in the preview pane
- Entry preview could show tags more prominently (coloured pills/badges)
- LOG view: truncate long assistant messages with `…more` indicator
- LOG view: show session duration (first msg → last msg delta)
- Scroll position memory per view mode — switching JRN↔LOG loses position
- Show keyboard shortcut hints more prominently on first open
- Entry count in toggle labels: `JRN(39)` / `LOG(207)`

## INTEGRITY
- describeState: add modelFilter to state when in LOG mode
- Snapshot restore should preserve viewMode (currently always opens as journal)
- listSessions reads entire file content for every session — could cache summaries
- loadAllEntries sorts every render — could cache until mutation
- Session parsing: readSession called twice sometimes (preview + detail)
- DRY: renderSessionList and renderListMode share pattern (date grouping, index mapping)
- DRY: the status bar / command bar pattern is repeated across all three render functions
- COAT: add a `journal.toggle-view` command so API consumers can switch views
- COAT: add a `journal.filter-model` command for API-driven model filtering
