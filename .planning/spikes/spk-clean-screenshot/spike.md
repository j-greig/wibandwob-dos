---
title: "Clean text screenshot endpoint"
status: in-progress
branch: spike/clean-screenshot
worktree: ../wibandwob-dos-spike-clean-screenshot
---

# Spike: Clean text screenshot endpoint

## Question

Can `/screenshot/text` default to clean readable output and offer a
`/screenshot/ansi` variant for the raw dump?

## Current state

Two text capture paths exist:

1. `screen.screenshot()` — blessed raw dump. Full of ANSI escapes, multi-byte
   Unicode block chars (box-drawing, shading), blessed internal rendering chars.
   This is what `/screenshot/text` currently returns.

2. `WindowRecord.captureText()` — semantic text per window. Already clean for
   most window types: editor returns file text, browser returns markdown,
   primer returns content, agent chat returns transcript. Exposed via
   `/windows/text?id=N` (returns JSON) and used by agent tools.

The existing per-window crop in `/screenshot/text?id=N` tries to strip ANSI
from the blessed dump with a weak regex — but `captureText()` already gives
clean text for free. The full-screen mode does NO stripping at all.

## Proposed API shape

| Endpoint | Returns | Content-Type |
|----------|---------|-------------|
| `GET /screenshot/text` | Clean text. Full screen: strip ANSI + Unicode crud. Per-window (`?id=N`): use `captureText()` if available, fall back to stripped blessed crop. | text/plain |
| `GET /screenshot/ansi` | Raw `screen.screenshot()`. Useful for ANSI-aware renderers, terminal replay, colour-preserving tools. Per-window crop with `?id=N`. | text/plain |

Default = clean. Append `/ansi` for the raw version.

No `?clean=1` param — cleaner to just have two endpoints.

## Implementation plan

- [ ] Add `stripAnsi()` utility — comprehensive regex covering SGR, CSI, OSC,
      cursor movement, 256-colour, truecolour, and stray control chars
- [ ] Add `stripBlessedChrome()` — replace common blessed Unicode block/box
      chars with ASCII equivalents or spaces
- [ ] Refactor `/screenshot/text` handler:
      - per-window: prefer `captureText()`, fall back to stripped crop
      - full-screen: apply stripAnsi + stripBlessedChrome to screenshot()
- [ ] Add `/screenshot/ansi` — current raw behaviour, preserved
- [ ] Update `/help` route description text
- [ ] Update `.agents/control-api.md` if it references the endpoint

## Files to touch (in worktree)

- `src/services/control-api.ts` — endpoint handlers (~line 347), help table (~line 91)
- New: `src/services/strip-ansi.ts` or inline util
- `.agents/control-api.md` — API docs

## Out of scope

- Changing captureText() on any window type
- Image/pixel screenshot
- New window types

## Key finding

For single-window reads, `captureText()` is the RIGHT source. The blessed
screen crop approach was always a hack. The full-screen case is the only one
that needs actual stripping — and that is a lossy best-effort (animated
windows, overlaps, etc. won't have clean semantic text).
