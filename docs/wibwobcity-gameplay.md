---
title: WibWobCity — Gameplay Reference
status: active
last-updated: 2026-02-20 (speed + save/load added)
---

# WibWobCity

A Micropolis (open-source SimCity) engine running inside WibWobDOS as an ASCII city-builder.
Opened via the `open_micropolis_ascii` command or the Tools menu.

## Controls

### Cursor movement

| Key | Action |
|-----|--------|
| `← ↑ ↓ →` | Move cursor one tile |
| `PgUp` / `PgDn` | Jump cursor 8 rows up / down |
| `Home` | Recenter cursor to world midpoint (60, 50) |

Camera auto-pans when the cursor comes within 2 tiles of any viewport edge.

### Tool selection

| Key | Tool | Engine constant |
|-----|------|-----------------|
| `1` | Query (inspect, no cost) | `TOOL_QUERY = 5` |
| `2` | Bulldoze | `TOOL_BULLDOZER = 7` |
| `3` | Road | `TOOL_ROAD = 9` |
| `4` | Wire | `TOOL_WIRE = 6` |
| `5` | Residential zone | `TOOL_RESIDENTIAL = 0` |
| `6` | Commercial zone | `TOOL_COMMERCIAL = 1` |
| `7` | Industrial zone | `TOOL_INDUSTRIAL = 2` |

### Placement

| Key | Action |
|-----|--------|
| `Enter` or `Space` | Place active tool at cursor |
| `Esc` or `q` | Cancel — returns to Query mode |

Result feedback appears briefly in the bottom bar: `OK`, `No funds`, `Bulldoze first`, `Failed`.

### Speed

| Key | Action |
|-----|--------|
| `p` | Pause / resume |
| `-` | Slower |
| `+` or `=` | Faster |

Speeds: `PAUSE` → `1-SLOW` (1 tick) → `2-MED` (4t) → `3-FAST` (16t) → `4-ULTRA` (64t per 120ms pulse). Current speed shown in top bar.

### Save / Load

| Key | Action |
|-----|--------|
| `F2` | Save city to current slot |
| `F3` | Load city from current slot |
| `Tab` | Cycle save slot (1 → 2 → 3) |

Files: `saves/slot1.city`, `saves/slot2.city`, `saves/slot3.city` — standard SimCity binary format, compatible with other Micropolis ports.

### HUD

- **Top bar** — `$<funds>  <Month> <Year>  Pop:<n>  Score:<n>  R:<±n> C:<±n> I:<±n>  [2-MED] -/+  Slot:1  F2:save F3:load`
- **Bottom bar** — active tool + key hints + last result flash
- **Right palette** — SimCity-style tool panel: funds/date/pop, tool list with costs, save slot hints

## Tile glyph legend

| Glyph | Meaning |
|-------|---------|
| `r.` | Empty residential zone |
| `r1` `r2` `r3` | Residential — low / mid / high density |
| `c.` | Empty commercial zone |
| `c1` `c2` `c3` | Commercial — low / mid / high density |
| `i.` | Empty industrial zone |
| `i1` `i2` `i3` | Industrial — low / mid / high density |
| `H ` | Hospital |
| `P ` | Police station |
| `F ` | Fire station |
| `* ` | Power plant / fire |
| `- ` `\| ` `+ ` | Road (horizontal / vertical / intersection) |
| `# ` | Rail |
| `w ` | Wire |
| `~ ` | Water |
| `" ` | Woods |
| `. ` | Empty land |
| `: ` | Rubble |

## Code map

| File | Role |
|------|------|
| `app/micropolis_ascii_view.h` | `TMicropolisAsciiView` class — cursor, camera, tool state |
| `app/micropolis_ascii_view.cpp` | `draw()`, `handleEvent()`, HUD, cursor overlay, auto-pan |
| `app/micropolis/micropolis_bridge.h` | `MicropolisBridge` + `MicropolisSnapshot` + `ToolApplyResult` |
| `app/micropolis/micropolis_bridge.cpp` | Bridge impl — `tick()`, `apply_tool()`, `snapshot()`, glyph funcs |
| `app/micropolis/compat/emscripten.h` | Emscripten shim — lets native C++ compile MicropolisCore unchanged |
| `vendor/MicropolisCore/MicropolisEngine/src/` | Upstream Micropolis engine (git submodule) |

Key engine types (from `vendor/MicropolisCore/MicropolisEngine/src/`):

```
EditingTool  — tool enum (tool.h)
ToolResult   — TOOLRESULT_OK / FAILED / NEED_BULLDOZE / NO_MONEY (tool.h)
Micropolis   — main sim class; doTool(), totalFunds, totalPop, cityScore (micropolis.h)
WORLD_W=120, WORLD_H=100
```

## Tests

```bash
ctest --test-dir build -R "micropolis_(determinism|no_ansi)"
```

- `micropolis_determinism` — same seed → same map hash after N ticks
- `micropolis_no_ansi` — no raw ESC/CSI sequences appear in any `draw()` output

Both must stay green. No ANSI bytes in `TDrawBuffer` — ever.

## Skill reference

`.pi/skills/micropolis-engine/SKILL.md` — deeper engine archaeology notes (tile ranges,
zone tier formulae, tool API details, bridge design decisions, open questions).

## Planning

`.planning/spikes/spk-micropolis-engine-review/spk04-wibwobsimsity-barebones-playable-plan.md`
— full stage breakdown (A–F). Stages A–D done. E (budget/speed controls) and F (workspace
persistence) are next.

GitHub issue: [#73](https://github.com/j-greig/wibandwob-dos/issues/73)
