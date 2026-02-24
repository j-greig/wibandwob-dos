---
name: wibwobdos
description: Build, run, and operate WibWobDOS (C++ tvision TUI + FastAPI) in Docker. Screenshots, cross-platform C++ debugging, ARM64 Linux builds, container health.
---

# WibWobDOS Operations

C++ Turbo Vision TUI app + Python FastAPI server, running headless in Docker on ARM64 Linux.

## Screenshot

```bash
scripts/screenshot.sh                  # stdout (pipeable)
scripts/screenshot.sh -o file.txt      # save to file
scripts/screenshot.sh -f ansi          # ANSI color output
scripts/screenshot.sh -f ansi | convert # pipe to renderer
```

## Build & run

```bash
make up-real                          # real C++ backend
make up                               # mock (default)
make up-real && make provision && make deploy && make test   # full gate
```

## ⚠️ API response envelope — always double-parse /menu/command

`POST /menu/command` wraps the C++ IPC result in an outer Python envelope.
The **inner** result is a JSON string nested inside `outer["result"]`.

```
POST /menu/command {"command":"get_chat_history"}
→ {"ok":true, "result": "{\"messages\":[...]}" }   ← result is a STRING
                           ↑ parse this too
```

**Correct pattern:**
```python
outer = json.loads(raw)
inner = json.loads(outer["result"])   # double-parse
msgs  = inner["messages"]             # ✅
```

**Wrong pattern (silent empty results):**
```python
obj  = json.loads(raw)
msgs = obj.get("messages", [])        # ❌ always []
```

Applies to: `get_chat_history`, `frame_capture`, `paint_export`, any command
returning structured JSON. Commands returning plain strings (`"ok"`, `"ok queued"`)
don't need the inner parse — wrap in `try/except json.JSONDecodeError`.

## Quick health check

```bash
docker compose exec substrate bash -c 'curl -sf $WIBWOBDOS_URL/health'
docker compose logs wibwobdos         # startup log
```

## C++ edit rules

**Always build after editing C++ files.** Do not report success without a clean build.

```bash
cmake --build ./build --target test_pattern 2>&1 | tail -5
```

If there are errors, fix them before proceeding. Most common issues:
- Wrong `TMenuItem` constructor overload (submenu vs command)
- `TGroup::current` is a member, not a method
- Never forward-declare tvision types inside your own namespace
- Frame Z-order: `insertBefore(frame, nullptr)` = append as last/top child (matches TWindow ctor). `insert(frame)` = front = wrong.
- Frameless windows: if a child view covers 100% of the window, it must include parent chrome commands (Show Frame, Shadow, etc.) in its own right-click menu — otherwise those commands become unreachable.

## Turbo Vision responsive layout

### growMode flags (from tvision/views.h)

| Flag | Meaning |
|------|---------|
| `gfGrowLoX` | left edge tracks owner's right (moves right on grow) |
| `gfGrowHiX` | right edge tracks owner's right |
| `gfGrowLoY` | top edge tracks owner's bottom (moves down on grow) |
| `gfGrowHiY` | bottom edge tracks owner's bottom |
| `gfGrowAll` | all four — full stretch both axes |
| `gfGrowRel` | proportional rather than absolute delta |

Additive delta model: each flag adds `delta.x`/`delta.y` to the corresponding edge. No flag = edge stays fixed relative to owner's top-left.

### Common layout: 3-col + status bar

| Panel | growMode | Rationale |
|-------|----------|-----------|
| tools (left, fixed-width) | `gfGrowHiY` | fixed left/width, stretches down |
| canvas (centre, stretchy) | `gfGrowHiX \| gfGrowHiY` | left edge fixed, right/bottom track owner |
| palette (right, fixed-width) | `gfGrowLoX \| gfGrowHiX \| gfGrowHiY` | right-anchored fixed width, stretches down |
| status (bottom, full-width) | `gfGrowHiX \| gfGrowLoY \| gfGrowHiY` | full width, bottom-anchored, fixed height |

`gfGrowLoX | gfGrowHiX` = both edges track owner's right → constant width, slides right. Correct for right-anchored fixed-width panels.

### Gotcha: partial draw garbage

When `size.y` increases on resize, `draw()` must cover ALL rows up to `size.y`. If you only write fixed rows, garbage from previous content persists below. Fix: always blank-fill remaining rows.

### Better approach: changeBounds() override

For complex layouts, override `changeBounds()` in TWindow and manually compute child bounds:

```cpp
void MyWindow::changeBounds(const TRect& bounds) {
    TWindow::changeBounds(bounds);
    TRect client = getExtent();
    client.grow(-1, -1);
    int toolsW = 16, palW = 20;
    toolPanel->changeBounds(TRect(client.a.x, client.a.y,
        std::min(client.a.x + toolsW, client.b.x), client.b.y - 1));
    // ... etc for each child
}
```

Requires keeping pointers to child views. More code, guaranteed correct. Use when growMode flags aren't enough.

### Canvas buffer vs view size

Canvas buffer is allocated at construction. On resize, `size` grows but buffer stays fixed. `draw()` must handle `size > buffer` with fill. For true resize, reallocate buffer in `changeBounds()` and copy existing cells.

## References

- [Cross-platform C++ build guide](references/cross-platform-cpp.md) — Linux deps, transitive include gotchas, CMake linking
- [Docker operations](references/docker-ops.md) — startup sequence, SIGWINCH fix, troubleshooting table
- [Screenshot workflows](references/screenshots.md) — piping patterns, formats, full open-windows-and-capture workflow
- [Integrating vendor views](references/integrating-vendor-views.md) — 14-surface checklist, CMake gotchas, tvterm lessons learned

## Key files

| File | Purpose |
|---|---|
| `scripts/screenshot.sh` | Host-side screenshot capture (in skill dir) |
| `scripts/start-wibwobdos.sh` | Container entrypoint (build + TUI + API) |
| `Dockerfile.wibwobdos` | Real mode image |
| `docker-compose.real.yml` | Real mode override |
| `skills/wibwobdos-api/SKILL.md` | Symbient-facing API skill (separate) |
