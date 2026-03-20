# Autoresearch Ideas — WibWobWorld 3D frame rate

## Remaining promising paths (ranked by estimated impact × safety)

### 1. Incremental wx/wxI in sky loop (safe, ~5-10% gain)
Currently `const wx = skyXOff + col` + `Math.floor(wx)` per sky pixel.
Move to row scope: `let wx = skyXOff; let wxI = Math.floor(skyXOff);` 
then `wx++; wxI++` in for-loop third expression. Eliminates 1 float-add +
1 Math.floor per sky pixel. 100% quality-safe.

### 2. Hash-based sky noise (medium impact, verify quality)
Replace noise2d (3-5 trig calls) with smoothstep hash (4 integer hashes +
lerp, zero trig). ~13k trig calls per frame eliminated. Visual appearance
differs but is equally smooth/natural — may actually look better (no
trig-frequency artifacts). Needs side-by-side quality check.

### 3. Reduce STEPS from 1000 → 500 (verify quality)
Active-col early exit means many frames already exit at ~200-400 effective
steps. Reducing STEPS to 500 costs nothing for those frames, and for
open scenes with thin/distant features might miss 1-2 far cells. Need to
test with terrain featuring thin ridgelines at distance.

### 4. Flat 1D canvas array (medium impact, many edits)
Replace `canvas[r]![col]` (2 pointer chases) with `canvas[r*SW+col]` (1).
Requires touching every canvas access in the function (~40 sites).
Could save ~0.5ms per frame via cache locality improvement.

### 5. Precompute per-row noise seed components (medium complexity)
noise2d(wx, r, sx, sy) has r-dependent terms that are constant across a row.
Extract those as row-constants, reduce per-pixel trig calls.
Moderate complexity, ~10-15% sky rendering speedup.

### 6. Reuse canvas buffer between frames (minor GC win)
Array.from({length:SH}, ...) allocates 4800 slots per frame. Module-level
reuse + fill(" ") reset could reduce GC pressure. Minor but free.
