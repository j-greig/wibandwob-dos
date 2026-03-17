// WibWob-DOS Phosphor Glow shader for Ghostty
// Warm phosphor bloom, visible scanlines, chromatic bleed,
// film fuzz, moiré pattern, corner darkening.

const float GLOW_SPREAD        = 3.0;    // how far bloom bleeds in pixels
const float GLOW_INTENSITY     = 0.45;   // how bright the glow is
const float SCANLINE_DARKNESS  = 0.156;  // how dark the horizontal lines are
const float COLOR_FRINGING     = 1.04;   // RGB split / chromatic aberration in px
const float OVERALL_BRIGHTNESS = 1.15;   // master brightness
const float GLOW_MIN_BRIGHT    = 0.07;   // minimum brightness before glow kicks in
const float FILM_GRAIN         = 0.06;   // static fuzz / noise
const float MOIRE_PATTERN      = 0.12;   // diagonal interference shimmer
const float CORNER_DARKNESS    = 0.18;   // how dark the corners get
const float CORNER_REACH       = 0.88;   // how far corner darkening extends inward

// Pseudo-random
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 sampleBloom(vec2 uv, vec2 px) {
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (float a = 0.0; a < 6.28318; a += 0.3927) {
        vec2 off1 = vec2(cos(a), sin(a)) * px * GLOW_SPREAD;
        vec2 off2 = vec2(cos(a), sin(a)) * px * GLOW_SPREAD * 2.0;
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
    float shift = COLOR_FRINGING * px.x;
    float r = texture(iChannel0, vec2(uv.x + shift, uv.y)).r;
    float g = texture(iChannel0, uv).g;
    float b = texture(iChannel0, vec2(uv.x - shift, uv.y)).b;
    vec3 col = vec3(r, g, b);

    // Phosphor bloom
    vec3 glow = sampleBloom(uv, px);
    float glowLum = dot(glow, vec3(0.299, 0.587, 0.114));
    float glowMask = smoothstep(GLOW_MIN_BRIGHT, 0.5, glowLum);
    col += glow * GLOW_INTENSITY * glowMask;

    // Scanlines
    float scan = sin(uv.y * iResolution.y * 3.14159) * 0.5 + 0.5;
    col *= 1.0 - SCANLINE_DARKNESS * (1.0 - scan);

    // Moiré interference — diagonal cross-hatch that shimmers
    float moire1 = sin((fragCoord.x + fragCoord.y) * 0.8 + iTime * 0.3);
    float moire2 = sin((fragCoord.x - fragCoord.y) * 0.6 + iTime * -0.2);
    float moire = moire1 * moire2;
    col *= 1.0 - MOIRE_PATTERN * (moire * 0.5 + 0.5);

    // Film fuzz / static grain
    float grain = hash(fragCoord + fract(iTime * 100.0)) * 2.0 - 1.0;
    col += grain * FILM_GRAIN;

    // Corner vignette
    vec2 c = uv - 0.5;
    float dist = length(c) / 0.7071;
    float vig = 1.0 - smoothstep(CORNER_REACH - 0.3, CORNER_REACH + 0.2, dist);
    vig = pow(vig, CORNER_DARKNESS);
    float cornerDist = length(max(abs(c) - 0.3, 0.0));
    float cornerDark = 1.0 - smoothstep(0.0, 0.25, cornerDist) * 0.13;
    col *= vig * cornerDark;

    col *= OVERALL_BRIGHTNESS;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
