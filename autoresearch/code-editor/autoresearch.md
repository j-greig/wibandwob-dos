# Autoresearch — Spore Clock Enhancement

## Objective
Enhance the Spore Clock (`modules/spore-clock/index.ts`) from a working mycelial
timepiece into something alive, surprising, and beautiful. The clock already grows,
sporulates, and recolonises on a minute cycle. Make it deeper.

## Current State
Working module: cellular automaton mycelial growth, brownian spore drift,
time-encoded colony colours (12 palettes), contextual box-drawing tendrils,
pulsing node glyphs, status bar with fungal time readout. ~415 lines.

Score baseline: functional but visually uniform. Growth radiates symmetrically,
minute reset is abrupt, colour transitions are hard-cut, no memory between cycles.

## Architecture
- `modules/spore-clock/index.ts` — single file, all logic self-contained (~415 lines)
- Uses: blessed, microapp-sdk (createTimer, clearTimers)
- Cellular automaton grid (number[][]), HyphalNode[], Spore[] particle system
- 8fps render loop, minute-cycle field reset, 2-hour colour rotation

## Key File to Modify
- `modules/spore-clock/index.ts` — the only file. Everything lives here.

## Dream Features (pick and implement, or invent better ones)
See `modules/spore-clock/DREAM-FEATURES.md` for the full wishlist. Highlights:

### High Impact, Low Complexity
1. **Substrate Memory** — don't fully reset each minute. Leave 10% ghost residue.
   Old growth shapes new growth. Time leaves rings like tree stumps.
2. **Circadian Colour Blending** — HSL lerp between adjacent colony palettes over
   10-15 mins instead of hard-switching every 2 hours.
3. **Spore Trails** — spores leave fading `·` trails behind them. Wind visible.

### High Impact, Medium Complexity
4. **Spore Collision → Wild Colonies** — spores landing far from nodes seed new
   growth centres. Emergent colonies. Track count as `wild:N` in status.
5. **Decay & Competition** — max-density cells decay after random interval. Dead
   cells become nutrients. Two colonies meeting compete at boundary.
6. **Minute Transition Sporulation** — instead of instant reset, old field mass-
   sporulates for 3-5 seconds. Density drops as spores flood out. New seeds
   emerge from the cloud. Death feeds birth.

### Stretch / Creative Freedom
7. **Nutrient Zones** — invisible substrate richness map. Growth asymmetric.
8. **Fibonacci Seed Spacing** — golden angle (137.508°) instead of even radial.
9. **No-Digit Mode** — hide status bar, time told purely by topology.
10. **Colony Names** — procedural mycological names in describeState.

### YOUR IDEAS
The autoloop is free to invent features not on this list. If you see something
that would make the clock more alive, more surprising, more beautiful — do it.
The dream list is a starting point, not a constraint. Jam with it.

## Scoring
After each enhancement round, score the module on 5 axes (each 1-10, averaged):

- **GROWTH** — does the mycelial growth look organic, asymmetric, alive?
- **TIME** — can you tell the time? Does the temporal encoding feel natural?
- **BEAUTY** — visual richness, glyph variety, colour, composition
- **SURPRISE** — does the clock do unexpected things? Emergent behaviour?
- **CRAFT** — code quality, performance, clean lifecycle, no timer leaks

Current baseline estimate: GROWTH:5 TIME:6 BEAUTY:6 SURPRISE:3 CRAFT:8 = **5.6**

## Constraints
- Modify ONLY: `modules/spore-clock/index.ts`
- Must pass `bun run typecheck`
- Module reload after changes (no restart needed — it's a module)
- Keep fps at 8 or below (125ms+ interval) — blessed can't handle faster
- Don't import from `src/core/` — use `src/services/microapp-sdk.js` only
- Keep the file self-contained (no splitting into sub-modules)
- Preserve all 4 lifecycle hooks: describeState, captureText, onRestyle, onCleanup
- Status bar can evolve but keep showing actual time somewhere
- Colony colour system (12 palettes) is load-bearing — extend, don't remove

## Reload Pattern
After modifying `modules/spore-clock/index.ts`:
```bash
# Close existing window, reload modules, reopen
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.spore-clock':
        print(w['id'])
" | while read id; do
  curl -s -X POST http://127.0.0.1:8099/windows/close -H 'Content-Type: application/json' -d "{\"id\":$id}"
done
# Reopen (module code is re-evaluated on window creation)
curl -s -X POST http://127.0.0.1:8099/commands/run -H 'Content-Type: application/json' -d '{"id":"microapp.wibwob.spore-clock.open"}'
```

## Visual Verification
```bash
# Screenshot the spore clock window
curl -s "http://127.0.0.1:8099/screenshot/text?id=$(
  curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.spore-clock':
        print(w['id']); break
"
)"
```
