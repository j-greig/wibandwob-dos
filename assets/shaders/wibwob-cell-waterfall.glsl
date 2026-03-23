// wibwob-cell-waterfall.glsl — cell grid with split-flap cascade transition
// Forked from wibwob-cell-grid.glsl
// Terminal at generation time: 142×81 (re-run scripts/cell-shader.sh to update)
//
// Grid blocks cascade from one gradient palette to the next like a station
// departures board — a diagonal wave front sweeps top-left → bottom-right,
// each cell flips with a random stagger and a brief fold-flash at the midpoint.

const float COLS = 142.0;
const float ROWS = 81.0;

// ── Grid ─────────────────────────────────────────
const float GRID_OPACITY  = 0.20;
const vec3  GRID_COLOR    = vec3(1.0);

// ── Gradient ─────────────────────────────────────
const float GRAD_OPACITY  = 0.28;        // blend strength over terminal
const float GRAD_ANGLE    = 0.0;         // 0°=N→S, 90°=W→E

// ── Cascade timing ───────────────────────────────
const float CYCLE_TIME    = 8.0;         // seconds between cascades
const float WAVE_DURATION = 3.0;         // seconds for wave to cross the screen
const float CELL_JITTER   = 0.25;        // random per-cell time offset (0..1 of wave)
const float FLIP_TIME     = 0.35;        // each cell's flip duration in seconds

// ── Palette: 4 gradient states to cycle through ──
// Each state is a start→end colour pair along the gradient axis.
//   0: mauve → blue      (original wibwob-dark)
//   1: peach → sage
//   2: gold  → rose
//   3: teal  → lavender

// Fetch gradient colour for a given palette state and position along axis.
// t ∈ [0,1] is the position along GRAD_ANGLE (0 = start, 1 = end).
vec3 palette(int state, float t) {
    // dim factor matches original (* 0.6)
    if (state == 0) return mix(vec3(0.796, 0.651, 0.969), vec3(0.537, 0.706, 0.980), t) * 0.6;
    if (state == 1) return mix(vec3(0.980, 0.545, 0.463), vec3(0.600, 0.808, 0.580), t) * 0.6;
    if (state == 2) return mix(vec3(0.976, 0.843, 0.537), vec3(0.914, 0.545, 0.663), t) * 0.6;
    /* state 3 */   return mix(vec3(0.506, 0.839, 0.804), vec3(0.710, 0.635, 0.965), t) * 0.6;
}

// ── Deterministic per-cell random ────────────────
float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 cellSz = round(iResolution.xy / vec2(COLS, ROWS));
    vec2 uv     = fragCoord / iResolution.xy;
    vec2 cpos   = mod(fragCoord, cellSz) / cellSz;   // position within cell [0,1]
    vec2 cellId = floor(fragCoord / cellSz);           // integer cell coords

    // ── Normalised cell position (0,0)=top-left, (1,1)=bottom-right ──
    float normRow = 1.0 - cellId.y / ROWS;            // y=0 is bottom in GL
    float normCol = cellId.x / COLS;

    // ── Which transition are we in? ──
    float totalCycle = CYCLE_TIME + WAVE_DURATION;
    float phase      = mod(iTime, totalCycle * 4.0);   // full loop through 4 palettes
    float transIdx   = floor(phase / totalCycle);
    float localTime  = mod(phase, totalCycle);

    int stateFrom = int(mod(transIdx, 4.0));
    int stateTo   = int(mod(transIdx + 1.0, 4.0));

    // ── Wave front: diagonal sweep top-left → bottom-right ──
    float waveFront = (localTime - CYCLE_TIME) / WAVE_DURATION;  // -ve during hold, 0→1 during cascade

    // Each cell triggers at a position along the diagonal + jitter
    float rnd = hash21(cellId);
    float cellTrigger = normRow * 0.65 + normCol * 0.35;   // diagonal bias
    cellTrigger += (rnd - 0.5) * CELL_JITTER;              // jitter both ways
    cellTrigger = clamp(cellTrigger, 0.0, 1.0);

    // How far through its flip is this cell? [0 = old state, 1 = new state]
    float flipNorm = FLIP_TIME / WAVE_DURATION;
    float flipProgress = clamp((waveFront - cellTrigger) / flipNorm, 0.0, 1.0);
    flipProgress = smoothstep(0.0, 1.0, flipProgress);     // ease in-out

    // ── Gradient position along axis ──
    float rad = GRAD_ANGLE * 3.14159265 / 180.0;
    vec2  dir = vec2(sin(rad), cos(rad));
    float gt  = clamp(dot(uv - 0.5, dir) + 0.5, 0.0, 1.0);

    // ── Blend the two palette states ──
    vec3 gradFrom = palette(stateFrom, gt);
    vec3 gradTo   = palette(stateTo,   gt);
    vec3 grad     = mix(gradFrom, gradTo, flipProgress);

    // ── Composite over terminal ──
    vec4 col = texture(iChannel0, uv);

    // Background mask — only affect pixels that are (near-)black
    // Terminal "black" is rarely true zero — dark themes sit around luma 0.05–0.15,
    // so we use a wide smoothstep window to catch them without touching text/UI.
    // Raise the upper bound if your theme's background is brighter than ~#303030.
    float luma   = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    float bgMask = 1.0 - smoothstep(0.04, 0.17, luma);   // 1=background, 0=content

    // Full gradient on background — don't double-dim with GRAD_OPACITY here
    col.rgb = mix(col.rgb, grad, bgMask);

    // ── Split-flap fold flash (background only) ──
    float isFlipping = step(0.01, flipProgress) * step(flipProgress, 0.99);
    float flipMid    = 1.0 - abs(flipProgress * 2.0 - 1.0);  // peaks at 0.5

    // Brightness flash
    col.rgb += flipMid * isFlipping * 0.10 * bgMask;

    // Horizontal fold line — thin dark band at vertical centre of cell
    float foldLine = smoothstep(0.46, 0.50, cpos.y) * smoothstep(0.54, 0.50, cpos.y);
    col.rgb -= foldLine * isFlipping * flipMid * 0.25 * bgMask;

    // ── Grid lines: 1px at right + bottom edge ──
    float gx = step(1.0 - 1.0 / cellSz.x, cpos.x);
    float gy = step(1.0 - 1.0 / cellSz.y, cpos.y);
    col.rgb *= 1.0 - max(gx, gy) * GRID_OPACITY;

    fragColor = col;
}
