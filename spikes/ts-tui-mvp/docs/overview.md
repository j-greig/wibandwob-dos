# WibWob-DOS Feature Parcels — TypeScript Rebuild Reference

Reverse-engineered from the C++/Python codebase. Each parcel is a bundle
of tightly-coupled features that should migrate together.

## Parcels

### P1 — Content Measurement
**Files**: `primer_utils.h`, `gallery.py:_measure_primer`, `frame_file_player_view.h`
**Intent**: Know how big content is before opening a window.

The app has TWO parallel measurement systems:
- C++ `measurePrimer()` using tvision's `strwidth()` for display columns
- Python `_measure_primer()` using `wcwidth.wcswidth()`

Both skip `#` comment lines, detect frame delimiters, compute max width.
Both add +2 for chrome independently. This is a DRY violation.

Figlet text has its own inline measurement in `wwdos_app.cpp:5028-5042`
that counts rendered lines and max width — same pattern, not shared.

**TS rebuild**: One `measureContent(source)` function that handles
text files, figlet output, and any future content type. Returns
`{lines, columns, hasFrames, animated}`. Chrome offset applied by
the window system, not the measurer.

**See**: [001-primer-dimensions-and-agent-sizing.md](001-primer-dimensions-and-agent-sizing.md)

---

### P2 — Chrome & Window Geometry
**Files**: `notitle_frame.h`, `gallery.py:39-44`, `wwdos_app.cpp:5047`, `figlet_text_view.cpp:309`
**Intent**: Translate content size to window size.

Currently ad-hoc per window type:
- Standard TWindow: content + 2 (1px border each side)
- Figlet: content + 6w / +3h (border + padding)
- Ghost frame: content + 0 (frameless mode)
- Scramble: varies by size ("smol" vs "tall")

The +2 constant appears in at least 4 places independently.

**TS rebuild**: `WindowChrome` enum/config per window type. Single
`contentToWindowSize(content, chromeMode)` function. Never hardcode
+2 in layout code.

---

### P3 — Desktop Geometry & Cell Aspect
**Files**: `wwdos_app.cpp:3253`, `api_ipc.cpp:552`, `models.py:84`, `command_registry.cpp:801`
**Intent**: Know the canvas you're painting on.

Desktop reports `{w, h, cell_aspect}` where cell_aspect=2.0 (terminal
chars are ~2:1 height:width). Used by aspect-ratio resize, cinema
layout, and agent state hook.

Hardcoded `2.0` in at least 3 places. Should be measured or
configurable (varies by terminal font/size).

**TS rebuild**: `Desktop.geometry` singleton, measured on startup
and resize. `cellAspect` derived from actual terminal metrics if
possible, else configurable default.

---

### P4 — Agent State Awareness
**Files**: `.claude/hooks/desktop-state.sh`, `main.py:/state`, `wwdos_app.cpp:get_state`, `mcp_tools.js`
**Intent**: Agents know what's on screen without asking.

Three parallel systems:
1. Claude Code hook (shell script, fires per prompt)
2. REST API `/state` endpoint
3. In-app LLM tools (`list_windows`, `get_canvas_size`)

Wib&Wob chat has NO state injection (planned, not built).
Pi agent must query manually.

State includes: window rects, z-order, focus, type, title, and
type-specific props (content_lines/width for frame_player, text/font
for figlet, gradient type, etc). But most window types report NO
content props — only frame_player and figlet do.

**Gap**: browser, terminal, paint, game windows report no content
dimensions. An agent can't know a terminal is 80x24 or a paint
canvas is 60x30 without opening it.

**TS rebuild**: Every window type implements `contentMetadata()`:
`{contentWidth, contentHeight, animated?, scrollable?, interactive?}`.
State injection is a core service, not a per-agent-type hack.

---

### P5 — Layout & Composition
**Files**: `gallery.py` (8 algos), `arrange.py` (7 presets), `controller.py:batch_layout`, `snap_window.py`
**Intent**: Place windows on the desktop artistically.

Two completely separate systems:
- **Gallery engine** (`gallery.py`): content-measured, 8 algorithms
  (masonry, fit-rows, packery, poetry, stamp, cluster...). Knows
  actual primer dimensions. Used by `/gallery/arrange` endpoint.
- **Arrange presets** (`arrange.py`): desktop-proportional, 7 named
  layouts (golden, magazine, cinema, triptych...). Does NOT use
  content dimensions — just divides desktop space.

Plus: `batch_layout` for programmatic grid macros, `snap_window`
for zone-based placement, and the prompt instructions telling agents
to compose layouts "like a Swiss modernist poster designer."

**DRY issue**: Gallery engine and arrange presets share no code.
Both need desktop geometry, both clamp to desktop, both handle
shadows/margins. Gallery measures content; arrange doesn't.

**TS rebuild**: Unified `LayoutEngine` that takes
`{desktop, pieces[], algorithm, constraints}`. Pieces carry their
own measured dimensions. Algorithms are pluggable strategies.
Content-aware and desktop-proportional are just different piece
sources, not different systems.

---

### P6 — Resize & Aspect Ratio
**Files**: `command_registry.cpp:790-845`, `snap_window.py`, `animated_ascii_view.cpp:287`
**Intent**: Resize windows while preserving visual proportions.

Named aspect ratios (16:9, 4:3, golden, A4, portrait) with cell
aspect correction. `snap_window` does zone-based grid placement.
All animated views override `changeBounds()` to redraw on resize.

Browser view reflows content on resize. Frame player marks dirty.
But there's no universal "content reflow on resize" protocol.

**TS rebuild**: `Resizable` interface with `onResize(newBounds)`.
Aspect ratio as a window property, not just a resize command param.

---

### P7 — Pre-open Sizing Workflow
**Files**: `command_registry.cpp:primer_info`, `gallery_list`, prompt docs
**Intent**: Agents measure before they open.

The workflow: `gallery_list` → pick primers → use `recommended_w/h` →
`open_primer` with explicit x,y,w,h. Or: `primer_info` for a single
file. Documented in agent prompts (APPEND_SYSTEM.md, wibandwob.prompt.md).

This workflow only exists for primers. Figlet has no `figlet_info`
equivalent. Browser has no `page_info`. Games have no size hint.

**TS rebuild**: Every openable content type has a `typeInfo` command
that returns dimensions and recommended size. Universal pattern,
not primer-specific.

---

## Critique of 001-primer-dimensions-and-agent-sizing.md

The 001 doc conflates three distinct concerns into one capsule:

1. **Content measurement** (strwidth, # skipping, measurePrimer)
2. **Agent state injection** (desktop-state hook, state props)
3. **Sizing workflow** (gallery_list enrichment, primer_info, prompt docs)

These should arguably be separate capsules because:
- Measurement is a C++ core concern, useful without any agent
- State injection is an agent-infra concern, applies to ALL window types
- The sizing workflow is a UX/prompt concern, specific to how agents compose

The doc also doesn't mention:
- The DUPLICATE Python measurer in `gallery.py`
- Figlet's parallel measurement code
- The chrome offset being hardcoded in multiple places
- That only 2 of 35 window types report content dimensions
- The gallery layout engine that consumes these measurements

**Recommendation**: Keep 001 as-is for immediate handover context, but
the TS rebuild should treat these as three separate modules:
- `core/content-measurement.ts` (P1)
- `core/agent-state.ts` (P4)
- `core/sizing-workflow.ts` (P7)

Each with its own tests and contracts.

---

## Missing from C++ that the TS rebuild should have from day one

1. **Universal content metadata** — every window type reports dimensions
2. **Single measurement function** — no C++/Python duplication
3. **Chrome as config** — not magic numbers scattered through code
4. **State injection as core** — not per-agent-type hooks
5. **typeInfo for everything** — not just primers
6. **Desktop geometry as observable** — resize events propagate
7. **Layout engine unity** — one system, pluggable algorithms
8. **Cell aspect measured** — not hardcoded 2.0
