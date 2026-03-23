// wibwob-cell-evolving.glsl
// Cell-aligned shade patterns using ░▒▓█ bitmaps baked as bit-packed constants.
// 5 patterns of increasing complexity, cycling every PATTERN_DURATION seconds.

// ── Grid ─────────────────────────────────────────────────────
const float COLS             = 142.0;
const float ROWS             = 81.0;
const float GRID_OPACITY     = 0.10;

// ── Timing ───────────────────────────────────────────────────
const float PATTERN_DURATION = 15.0;   // seconds per pattern
const float CROSSFADE        = 2.0;    // blend duration between patterns
const int   PATTERN_COUNT    = 5;

// ── Shade overlay ────────────────────────────────────────────
const float BG_DIM           = 0.60;   // dim terminal content underneath
const float SHADE_OPACITY    = 0.11;   // how strongly shade overlays bg

// ── Gradient ─────────────────────────────────────────────────
const bool  GRAD_ON          = true;
const float GRAD_OPACITY     = 0.15;
const float GRAD_ANGLE       = 0.0;    // 0=N→S  90=W→E  45=diagonal
const vec3  C_A = vec3(0.796, 0.651, 0.969) * 0.5;  // mauve  top
const vec3  C_B = vec3(0.537, 0.706, 0.980) * 0.5;  // blue   bottom

// ── Per-pattern accent colours (Catppuccin Mocha) ─────────────
const vec3 PAT_COLORS[5] = vec3[5](
    vec3(0.796, 0.651, 0.969),   // mauve   — sine bands
    vec3(0.537, 0.706, 0.980),   // blue    — radial ripple
    vec3(0.953, 0.545, 0.659),   // pink    — diagonal interference
    vec3(0.651, 0.890, 0.631),   // green   — smooth noise
    vec3(0.976, 0.886, 0.686)    // yellow  — multi-source
);

// ── Shade char bitmaps (8×8, LSB = leftmost pixel) ────────────
// ░ light  (~25%): sparse dots every other row
// ▒ medium (~50%): checkerboard
// ▓ dark   (~75%): dense, inverse of light
// █ full   (100%): solid
//
// SHADE_BITS layout: [char_index * 8 + row] = 8-bit row mask
const uint SHADE_BITS[32] = uint[32](
    // ░  light shade
    0x55u, 0x00u, 0xAAu, 0x00u, 0x55u, 0x00u, 0xAAu, 0x00u,
    // ▒  medium shade (checkerboard)
    0x55u, 0xAAu, 0x55u, 0xAAu, 0x55u, 0xAAu, 0x55u, 0xAAu,
    // ▓  dark shade
    0xAAu, 0xFFu, 0x55u, 0xFFu, 0xAAu, 0xFFu, 0x55u, 0xFFu,
    // █  full block
    0xFFu, 0xFFu, 0xFFu, 0xFFu, 0xFFu, 0xFFu, 0xFFu, 0xFFu
);

// ── Helpers ───────────────────────────────────────────────────
float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Smooth noise: bilinear interpolation over hash grid
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i),           hash2(i + vec2(1,0)), u.x),
               mix(hash2(i + vec2(0,1)), hash2(i + vec2(1,1)), u.x), u.y);
}

// Lookup shade bitmap bit for a given char level (1-4) and sub-pixel pos
bool shadeBit(int level, vec2 cpos) {
    if (level <= 0) return false;
    int lv = min(level, 4) - 1;
    ivec2 sub = ivec2(clamp(floor(cpos * 8.0), vec2(0.0), vec2(7.0)));
    uint row = SHADE_BITS[lv * 8 + sub.y];
    return ((row >> uint(sub.x)) & 1u) == 1u;
}

// Density (0..1) → shade level 0-4
int densityToLevel(float d) {
    if (d < 0.15) return 0;
    if (d < 0.35) return 1;
    if (d < 0.60) return 2;
    if (d < 0.82) return 3;
    return 4;
}

// ── 5 Patterns ────────────────────────────────────────────────
// All return density 0..1 for a given cell + local time

// 1. Sine bands — horizontal waves scrolling
float pattern1(vec2 c, float t) {
    return sin(c.y * 0.25 + t * 0.6) * 0.5 + 0.5;
}

// 2. Radial ripple — rings expanding from a slow-drifting centre
float pattern2(vec2 c, float t) {
    vec2 centre = vec2(COLS, ROWS) * 0.5 + vec2(sin(t * 0.2), cos(t * 0.15)) * 20.0;
    float d = length(c - centre) * 0.18;
    return sin(d - t * 1.8) * 0.5 + 0.5;
}

// 3. Diagonal interference — two wave directions create moiré
float pattern3(vec2 c, float t) {
    float w1 = sin(c.x * 0.22 + t * 0.7);
    float w2 = sin(c.y * 0.22 + t * 0.5);
    return w1 * w2 * 0.5 + 0.5;
}

// 4. Smooth noise field — organic, slow evolution
float pattern4(vec2 c, float t) {
    vec2 p = c * 0.04 + vec2(t * 0.07, t * 0.05);
    float n  = noise(p);
    float n2 = noise(p * 2.1 + 5.2);
    return n * 0.6 + n2 * 0.4;
}

// 5. Multi-source interference — 4 wave origins, complex moiré
float pattern5(vec2 c, float t) {
    float w1 = sin(length(c - vec2(COLS * 0.2, ROWS * 0.3)) * 0.20 - t * 1.2);
    float w2 = sin(length(c - vec2(COLS * 0.8, ROWS * 0.7)) * 0.17 - t * 0.9);
    float w3 = sin(length(c - vec2(COLS * 0.5, ROWS * 0.1)) * 0.22 - t * 1.5);
    float w4 = sin((c.x * 0.12 + c.y * 0.08) - t * 0.4);
    return (w1 + w2 + w3 + w4) * 0.125 + 0.5;
}

float evalPattern(int idx, vec2 c, float t) {
    if (idx == 0) return pattern1(c, t);
    if (idx == 1) return pattern2(c, t);
    if (idx == 2) return pattern3(c, t);
    if (idx == 3) return pattern4(c, t);
    return pattern5(c, t);
}

vec3 patColor(int idx) {
    if (idx == 0) return PAT_COLORS[0];
    if (idx == 1) return PAT_COLORS[1];
    if (idx == 2) return PAT_COLORS[2];
    if (idx == 3) return PAT_COLORS[3];
    return PAT_COLORS[4];
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 cell   = round(iResolution.xy / vec2(COLS, ROWS));
    vec2 uv     = fragCoord / iResolution.xy;
    vec2 cpos   = mod(fragCoord, cell) / cell;
    vec2 cellXY = floor(fragCoord / cell);

    // ── Cycle + crossfade ─────────────────────────────────────
    float cycle  = mod(iTime, PATTERN_DURATION * float(PATTERN_COUNT));
    int   curIdx = int(cycle / PATTERN_DURATION);
    int   nxtIdx = int(mod(float(curIdx + 1), float(PATTERN_COUNT)));
    float phaseT = mod(cycle, PATTERN_DURATION) / PATTERN_DURATION;
    float blend  = smoothstep(1.0 - CROSSFADE / PATTERN_DURATION, 1.0, phaseT);

    float dCur = evalPattern(curIdx, cellXY, iTime);
    float dNxt = evalPattern(nxtIdx, cellXY, iTime);
    float density = mix(dCur, dNxt, blend);
    vec3  color   = mix(patColor(curIdx), patColor(nxtIdx), blend);

    // ── Render ────────────────────────────────────────────────
    vec4 col = texture(iChannel0, uv);
    col.rgb *= BG_DIM;

    // Gradient
    if (GRAD_ON) {
        float rad  = GRAD_ANGLE * 3.14159265 / 180.0;
        vec2  dir  = vec2(sin(rad), cos(rad));
        float gt   = dot(uv - 0.5, dir) + 0.5;
        col.rgb    = mix(col.rgb, mix(C_A, C_B, clamp(gt, 0.0, 1.0)), GRAD_OPACITY);
    }

    // Shade bitmap lookup
    int level = densityToLevel(density);
    if (shadeBit(level, cpos)) {
        col.rgb = mix(col.rgb, color, SHADE_OPACITY);
    }

    // Grid lines
    float gx = step(1.0 - 1.0 / cell.x, cpos.x);
    float gy = step(1.0 - 1.0 / cell.y, cpos.y);
    col.rgb *= 1.0 - max(gx, gy) * GRID_OPACITY;

    fragColor = col;
}
