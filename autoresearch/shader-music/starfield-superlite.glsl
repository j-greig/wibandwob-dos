// Starfield Superlite — 4 layers, each with unique density + speed
// Output: each layer's brightness drives one chiptune track

const float layers = 4.0;

float N21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
}

vec2 N22(vec2 p) {
    float n = N21(p);
    return vec2(n, N21(p + n));
}

// Per-layer grid density and time speed for decorrelation
float starLayer(vec2 uv, float offset, float time, float gridSize, float speed) {
    float timeScale = -(time * speed + offset) / layers;
    float trans = fract(timeScale);
    float newRnd = floor(timeScale);

    uv -= 0.5;
    uv *= trans;  // zoom
    uv += 0.5;
    uv *= gridSize;

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

    // Each layer: different grid density + time speed
    // Lead:    sparse grid (6), fast — melodic, active
    // Harmony: medium grid (10), slow — sustained, smooth
    // Bass:    very sparse (4), very slow — ponderous, low
    // Perc:    dense grid (14), fast — busy, staccato
    float r = starLayer(uv, 0.0, iTime, 6.0,  1.2);
    float g = starLayer(uv, 1.0, iTime, 10.0, 0.6);
    float b = starLayer(uv, 2.0, iTime, 4.0,  0.4);
    float a = starLayer(uv, 3.0, iTime, 14.0, 1.5);

    fragColor = vec4(r, g, b, a);
}
