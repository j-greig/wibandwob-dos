---
title: "Clean text screenshot endpoint"
status: done
branch: spike/clean-screenshot
worktree: ../wibandwob-dos-spike-clean-screenshot
---

# Spike: Clean text screenshot endpoint

## Question

Can `/screenshot/text` default to clean readable output and offer a
`/screenshot/ansi` variant for the raw dump?

## Answer: YES

Works well. Full-screen drops from 20KB raw to 9KB clean and is fully
readable — you can see window titles, content, spatial layout, ASCII art.
Per-window mode uses semantic `captureText()` when available (editor gives
full file contents, browser gives markdown). Falls back to stripped blessed
crop for windows without captureText (pattern, primer).

## API shape

| Endpoint | Returns | Content-Type |
|----------|---------|-------------|
| `GET /screenshot/text` | Clean text. Full screen: strip ANSI + Unicode chrome. Per-window (`?id=N`): `captureText()` with ANSI stripped, or stripped blessed crop fallback. | text/plain |
| `GET /screenshot/ansi` | Raw `screen.screenshot()`. Per-window crop with `?id=N`. | text/plain |

Default = clean. Append `/ansi` for the raw version.

## What was built (worktree)

### New file: `src/services/strip-ansi.ts`

Two functions:
- `stripAnsi(text)` — comprehensive regex removing CSI, OSC, ESC sequences,
  stray control chars. Covers SGR, cursor, 256-colour, truecolour.
- `stripBlessedChrome(text)` — calls stripAnsi then replaces Unicode
  box-drawing (U+2500–U+256C + arcs/diagonals), block elements (U+2580–259F),
  braille (U+2800–28FF), and PUA (U+E000–F8FF) with ASCII equivalents.

### Changed: `src/services/control-api.ts`

- `/screenshot/text` rewritten: per-window uses `captureText()` + `stripAnsi()`,
  full-screen uses `stripBlessedChrome()` on blessed dump.
- `/screenshot/ansi` added: raw blessed dump preserved for ANSI-aware consumers.
- Help table updated with both endpoints.

## Test results

See `test-captures/` directory:

| File | Size | Notes |
|------|------|-------|
| fullscreen-raw.txt | 22KB | Blessed dump — unreadable ANSI soup |
| fullscreen-strip-ansi.txt | 11KB | ANSI stripped, Unicode chrome remains |
| fullscreen-clean.txt | 9KB | Fully readable — windows, content, layout visible |
| window-5-captureText.txt | 93KB | Semantic editor content (full file, has ANSI styling) |
| window-5-editor-clean.txt | 3KB | Blessed crop, stripped — readable but spatially cropped |

Key finding: `captureText()` output can contain ANSI (syntax highlighting in
editor). The endpoint now strips that too.

## Remaining work

- [ ] Merge to main (after review)
- [ ] Verify pattern/primer windows — they lack captureText(), fallback works
      but could add captureText() to those window types for better output
- [ ] Consider adding captureText() to more window types (pattern, primer)

## Files changed (in worktree only)

- `src/services/strip-ansi.ts` (NEW)
- `src/services/control-api.ts` (CHANGED — endpoints + help table + import)
