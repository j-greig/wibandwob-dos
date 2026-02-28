## F01 — Backrooms TV View

Status: not-started
GitHub issue: #103
PR: —

### Summary

C++ TView subclass (`TBackroomsTvView`) that displays streaming text in a scrollable ring buffer. Timer-driven: reads from a file descriptor (pipe from subprocess) on each tick, appends lines, redraws. The view itself has no knowledge of the generator — it just reads from an fd and displays text.

### Type

`animation-like` — uses `TTimerId` pattern from `animated_blocks_view`.

### Stories

- [ ] **S01**: Scaffold `backrooms_tv_view.h/.cpp` with ring buffer, `draw()`, timer tick, `handleEvent()`
- [ ] **S02**: Implement fd-reading logic in timer handler (non-blocking `read()` from pipe fd)
- [ ] **S03**: Auto-scroll behaviour — new text always visible at bottom, manual scroll-back pauses auto-scroll
- [ ] **S04**: Colour support — detect ANSI colour codes in stream, render with TV attributes (or strip if too complex for v1)

### Acceptance Criteria

AC-F01-1: View renders text from an fd into a scrolling buffer.
Test: Create view with a pipe fd that has known content, verify `draw()` output matches.

AC-F01-2: Timer fires at ~50ms, reads available bytes, redraws.
Test: Feed data into pipe, verify view updates within 100ms.

AC-F01-3: Ring buffer caps at configured max lines (default 200), oldest lines discarded.
Test: Feed 300 lines, verify buffer contains only latest 200.

AC-F01-4: View is resizable — `changeBounds()` works correctly.
Test: Resize window via API, verify no crash and content reflows.
