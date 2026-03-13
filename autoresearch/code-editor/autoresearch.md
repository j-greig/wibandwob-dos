# Autoresearch — Asciicker (ASCII 3D World)

## Objective
Build a 3D ASCII world renderer as a WibWob-DOS microapp, inspired by
the asciicker project (github.com/msokalski/asciicker). Not a direct port —
a TypeScript reimplementation of the core rendering concept: heightmap
terrain rendered as ASCII characters with colour in a blessed window.

## Current State
Working 3D renderer at 8.1 quality score. Proper depth buffer, back-to-front
column rendering, per-cell ANSI 256-colour, directional lighting, 8 biomes,
WASD movement, yaw rotation, smooth camera follow.

## Architecture
- `modules/asciicker/index.ts` — single file, all logic self-contained
- Uses: blessed, microapp-sdk (createTimer, clearTimers)
- Reference: `/tmp/asciicker/` — cloned C++ codebase for study
- Key reference files:
  - `render.cpp` / `render.h` — the CPU scene renderer into AnsiCell buffer
  - `terrain.h` — heightmap patch structure
  - `game_app.cpp` lines 347-460 — the Print() function that outputs ANSI
  - `sprite.h` — sprite rendering system
  - Original uses AnsiCell = {fg, bk, gl, spare} per cell (256-colour palette + CP437 glyph)

## Key Rendering Concepts from Original
1. **AnsiCell buffer**: flat array of {fg, bg, glyph} — rendered back-to-front
2. **Heightmap terrain**: patches of height values, each cell has material
3. **Isometric projection**: camera yaw rotatable, position movable
4. **CP437 glyphs**: 256-char set mapped to Unicode for terminal output
5. **Material system**: each material has shade[4][16] = 4 light levels × 16 angle-dependent glyphs
6. **Depth buffer**: cells rendered back-to-front with height offset creating 3D parallax

## Dream Features
See `modules/asciicker/DREAM-FEATURES.md` for the full wishlist.

## Scoring
After each enhancement round, score the module on 5 axes (each 1-10, averaged):

- **RENDER** — does the 3D effect work? Depth, occlusion, parallax?
- **WORLD** — is there interesting terrain? Biomes, features, variety?
- **CONTROLS** — can you move around? Camera, player, responsiveness?
- **BEAUTY** — visual richness, glyph variety, colour, composition?
- **CRAFT** — code quality, performance, clean lifecycle, no leaks?

Current: RENDER:8.4 WORLD:7.8 CONTROLS:8.1 BEAUTY:7.6 CRAFT:8.8 = **8.1**

## Constraints
- Modify ONLY: `modules/asciicker/index.ts`
- Must pass `bun run typecheck`
- Module reload after changes (no restart needed — it's a module)
- Keep fps at 8 or below (125ms+ interval) — blessed can't handle faster
- Don't import from `src/core/` — use `src/services/microapp-sdk.js` only
- Keep the file self-contained (no splitting into sub-modules)
- Preserve all 4 lifecycle hooks: describeState, captureText, onRestyle, onCleanup
- The vendor asciicker repo at /tmp/asciicker/ is reference only — reimplement in TS

## Reload Pattern
After modifying `modules/asciicker/index.ts`:
```bash
# Close existing window, reload modules, reopen
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        print(w['id'])
" | while read id; do
  curl -s -X POST http://127.0.0.1:8099/windows/close -H 'Content-Type: application/json' -d "{\"id\":$id}"
done
# Reopen (module code is re-evaluated on window creation)
curl -s -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' -d '{"id":"microapp.wibwob.asciicker.open"}'
```

## Visual Verification
```bash
# Screenshot the asciicker window
curl -s "http://127.0.0.1:8099/screenshot/text?id=$(
  curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        print(w['id']); break
"
)"
```
