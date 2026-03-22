---
name: desktop-arrange
description: >
  Arrange open WibWob-DOS windows into named layout presets: golden, magazine,
  cinema, triptych, diagonal, spotlight, asymmetric. Use when: "arrange windows",
  "lay out the desktop", "golden ratio layout", "magazine layout", "cinema mode",
  "triptych", "diagonal cascade", "spotlight hero window", "asymmetric layout",
  "Swiss grid", "arrange like a magazine", "make it look nice", "layout preset".
  Ports the arrange.py presets from wibandwob-dos-tvision. Each preset is a pure
  math function over window positions — no blessed, no SDK, just batch move/resize.
---

# desktop-arrange

Arrange open WibWob-DOS windows into a named layout preset using `POST /windows/batch`.

## Quick start

```bash
# List available presets and current windows
bash .pi/skills/desktop-arrange/scripts/arrange.sh --list

# Apply a preset (uses canonical wibwob instance)
bash .pi/skills/desktop-arrange/scripts/arrange.sh golden
bash .pi/skills/desktop-arrange/scripts/arrange.sh cinema --hero 3
bash .pi/skills/desktop-arrange/scripts/arrange.sh magazine --hero 7

# Verify result visually (screenshot via Ghostty AppleScript)
bash .pi/skills/desktop-arrange/scripts/arrange.sh triptych && \
  screencapture -x -D 1 /tmp/arrange-$(date +%s).png
```

## Presets

| Preset | Description |
|--------|-------------|
| `golden` | Hero 61.8% (φ) left, remaining windows stacked right |
| `magazine` | Feature 65%×65% top-left, sidebar right, footer strip bottom |
| `cinema` | Hero 16:9 centred, supporting windows fill 4 margins |
| `triptych` | 3 equal columns, overflow as footer row |
| `diagonal` | Cascade growing larger bottom-right |
| `spotlight` | Hero 60% centred, others orbit the edges |
| `asymmetric` | Alternating 70/30 and 30/70 rows (Swiss grid) |

## How it works

1. `wibwob health` → get port
2. `wibwob state` → get windows + desktop size
3. Apply preset math → compute `[{id, left, top, width, height}]`
4. `POST /windows/batch` → move+resize all in one call
5. `screencapture` → visual verification

## Verification loop

After applying a preset:
```bash
# Text verification — check windows moved
wibwob windows | jq -r '.[] | "\(.id) \(.title) \(.left),\(.top) \(.width)×\(.height)"'

# Visual verification — screenshot the TUI
screencapture -x -D 1 /tmp/arrange-check.png
# Or via Ghostty AppleScript (see ghostty-control skill)
bash .pi/skills/ghostty-control/scripts/ghostty-windows.sh
```

## Done criteria

- Windows are repositioned (positions changed from before)
- No window has negative or zero width/height
- Screenshot shows non-overlapping or intentionally overlapping layout
- `wibwob windows | jq '.[].width' | sort -n | head -1` > 0

## Gotchas

**Arrange with 0 or 1 windows does nothing.**
Check `wibwob windows | jq length` before calling. Presets need ≥ 2 windows.

**Hero ID not found — falls back to first window.**
If `--hero N` refers to a closed window, the first open window becomes hero silently.
Verify with `wibwob windows | jq -r '.[] | "\(.id) \(.title)"'` first.

**Windows snap back after arrange.**
Some microapps call `autoSizeWindow()` on resize. Open figlet banners may resize themselves.
Workaround: arrange first, then open content-aware windows.

**Desktop size wrong — windows overflow.**
`wibwob health` reports screen cols×rows. Preset math uses these as dw/dh.
If the TUI window was recently resized, health may be stale by one render frame.
Add `sleep 0.3` after resize before arranging.

## References

- Source presets: `~/Repos/wibandwob-dos-tvision/tools/arrange.py`
- Plan: `.planning/epics/e055-tui-applescript-control/arrange-presets-plan.md`
- Visual verification: `.pi/skills/ghostty-control/SKILL.md`
- Batch API: `POST /windows/batch` — `[{id, left?, top?, width?, height?, close?}]`
