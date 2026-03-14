// WibWob-DOS Phosphor Glow shader for Ghostty
// Warm phosphor bloom, visible scanlines, chromatic bleed,
// film fuzz, moiré pattern, heavy corner darkening.

const float BLOOM_RADIUS    = 3.0;
const float BLOOM_AMOUNT    = 0.45;
const float SCANLINE_WEIGHT = 0.12;
const float CHROMA_BLEED    = 0.8;
const float BRIGHTNESS      = 1.15;
const float GLOW_THRESHOLD  = 0.1;
const float FUZZ_AMOUNT     = 0.03;    // film grain / static fuzz
const float MOIRE_STRENGTH  = 0.06;    // moiré interference pattern
const float VIGNETTE_POWER  = 0.55;    // heavy corner darkening (higher = darker)
const float VIGNETTE_RADIUS = 0.75;    // how far vignette reaches inward

// Pseudo-random
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 sampleBloom(vec2 uv, vec2 px) {
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (float a = 0.0; a < 6.28318; a += 0.3927) {
        vec2 off1 = vec2(cos(a), sin(a)) * px * BLOOM_RADIUS;
        vec2 off2 = vec2(cos(a), sin(a)) * px * BLOOM_RADIUS * 2.0;
        sum += texture(iChannel0, uv + off1).rgb * 1.0;
        sum += texture(iChannel0, uv + off2).rgb * 0.5;
        total += 1.5;
    }
    return sum / total;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 px = 1.0 / iResolution.xy;

    // Chromatic bleed
    float shift = CHROMA_BLEED * px.x;
    float r = texture(iChannel0, vec2(uv.x + shift, uv.y)).r;
    float g = texture(iChannel0, uv).g;
    float b = texture(iChannel0, vec2(uv.x - shift, uv.y)).b;
    vec3 col = vec3(r, g, b);

    // Phosphor bloom
    vec3 glow = sampleBloom(uv, px);
    float glowLum = dot(glow, vec3(0.299, 0.587, 0.114));
    float glowMask = smoothstep(GLOW_THRESHOLD, 0.5, glowLum);
    col += glow * BLOOM_AMOUNT * glowMask;

    // Scanlines
    float scan = sin(uv.y * iResolution.y * 3.14159) * 0.5 + 0.5;
    col *= 1.0 - SCANLINE_WEIGHT * (1.0 - scan);

    // Moiré interference — diagonal cross-hatch that shimmers
    float moire1 = sin((fragCoord.x + fragCoord.y) * 0.8 + iTime * 0.3);
    float moire2 = sin((fragCoord.x - fragCoord.y) * 0.6 + iTime * -0.2);
    float moire = moire1 * moire2;
    col *= 1.0 - MOIRE_STRENGTH * (moire * 0.5 + 0.5);

    // Film fuzz / static grain
    float grain = hash(fragCoord + fract(iTime * 100.0)) * 2.0 - 1.0;
    col += grain * FUZZ_AMOUNT;

    // Heavy corner vignette
    vec2 c = uv - 0.5;
    float dist = length(c) / 0.7071; // normalize diagonal to 1.0
    float vig = 1.0 - smoothstep(VIGNETTE_RADIUS - 0.3, VIGNETTE_RADIUS + 0.2, dist);
    vig = pow(vig, VIGNETTE_POWER);
    // Extra corner crush — darken more aggressively in the very corners
    float cornerDist = length(max(abs(c) - 0.3, 0.0));
    float cornerDark = 1.0 - smoothstep(0.0, 0.25, cornerDist) * 0.4;
    col *= vig * cornerDark;

    col *= BRIGHTNESS;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
