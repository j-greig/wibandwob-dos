// Starfield Superlite — 4 layers, sparse stars
// Output: each layer's brightness drives one chiptune track

// 4 layers = 4 audio tracks
const float layers = 4.0;
const float repeats = 8.0;  // fewer grid cells = fewer stars

float N21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

vec2 N22(vec2 p) {
    float n = N21(p);
    return vec2(n, N21(p + n));
}

// Returns per-layer brightness (0-1 range, clamped)
float starLayer(vec2 uv, float offset, float time) {
    float timeScale = -(time + offset) / layers;
    float trans = fract(timeScale);
    float newRnd = floor(timeScale);

    uv -= 0.5;
    uv *= trans;  // zoom
    uv += 0.5;
    uv *= repeats;

    vec2 ipos = floor(uv);
    uv = fract(uv);

    vec2 rndXY = N22(newRnd + ipos * (offset + 1.0)) * 0.9 + 0.05;
    float rndSize = N21(ipos) * 80.0 + 120.0;

    vec2 j = (rndXY - uv) * rndSize;
    float sparkle = 1.0 / dot(j, j);

    sparkle *= smoothstep(1.0, 0.8, trans);
    return clamp(sparkle, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Each channel = one layer's total brightness
    float r = starLayer(uv, 0.0, iTime);
    float g = starLayer(uv, 1.0, iTime);
    float b = starLayer(uv, 2.0, iTime);
    float a = starLayer(uv, 3.0, iTime);

    fragColor = vec4(r, g, b, a);
}
