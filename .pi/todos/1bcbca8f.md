{
  "id": "1bcbca8f",
  "title": "BUG: Backrooms submission crashes TUI — blessed textbox event error",
  "tags": [
    "bug",
    "crash",
    "backrooms",
    "blessed"
  ],
  "status": "done",
  "created_at": "2026-03-07T10:25:16.165Z"
}

Fixed in commit e0fca87.

Root cause: closePicker() destroyed the frame while searchBox was still in blessed's readInput() state. Next keypress from the overlay prompt that opens after confirmation fired into the orphaned textbox → crash at textbox.js:40 (_done called on destroyed widget).

Fix: closePicker() now calls `(searchBox as any).cancel()` to exit readInput state before closing, plus `pickerClosed` boolean guard on both `keypress` and `submit` handlers so any stale events are silently dropped.
