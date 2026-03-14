// WibWob-DOS CRT shader for Ghostty
// Subtle retro CRT effect: scanlines, slight curvature, phosphor glow,
// chromatic aberration. Tuned to be usable for real work — not a toy.
//
// Uniforms provided by Ghostty's ShaderToy compat layer:
//   iResolution, iTime, iChannel0 (terminal texture), iPalette, etc.

// ── Tunables ─────────────────────────────────────────────────
const float CURVATURE       = 0.015;   // barrel distortion strength (0 = flat)
const float SCANLINE_WEIGHT = 0.06;    // scanline darkness (0 = none)
const float SCANLINE_SPEED  = 0.0;     // vertical scroll speed (0 = static)
const float CHROMA_SHIFT    = 0.4;     // chromatic aberration in pixels
const float VIGNETTE_AMOUNT = 0.25;    // edge darkening (0 = none)
const float BLOOM_AMOUNT    = 0.08;    // glow bleed from bright pixels
const float NOISE_AMOUNT    = 0.015;   // film grain intensity
const float BRIGHTNESS      = 1.05;    // overall brightness boost
const float FLICKER_AMOUNT  = 0.005;   // subtle CRT brightness flicker

// ── Helpers ──────────────────────────────────────────────────

// Barrel distortion for CRT curvature
vec2 curveUV(vec2 uv) {
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    uv = uv + c * r2 * CURVATURE;
    return uv;
}

// Pseudo-random for film grain
float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

// Simple box blur for bloom (5-tap cross)
vec3 bloom(vec2 uv, vec2 px) {
    vec3 sum = vec3(0.0);
    sum += texture(iChannel0, uv + vec2(-px.x, 0.0)).rgb;
    sum += texture(iChannel0, uv + vec2( px.x, 0.0)).rgb;
    sum += texture(iChannel0, uv + vec2(0.0, -px.y)).rgb;
    sum += texture(iChannel0, uv + vec2(0.0,  px.y)).rgb;
    sum += texture(iChannel0, uv + vec2(-px.x, -px.y)).rgb * 0.5;
    sum += texture(iChannel0, uv + vec2( px.x, -px.y)).rgb * 0.5;
    sum += texture(iChannel0, uv + vec2(-px.x,  px.y)).rgb * 0.5;
    sum += texture(iChannel0, uv + vec2( px.x,  px.y)).rgb * 0.5;
    return sum / 6.0;
}

// ── Main ─────────────────────────────────────────────────────

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 px = 1.0 / iResolution.xy;

    // Apply CRT barrel curvature
    vec2 curved = curveUV(uv);

    // Black outside the curved viewport
    if (curved.x < 0.0 || curved.x > 1.0 || curved.y < 0.0 || curved.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Chromatic aberration — shift R and B channels slightly
    float shift = CHROMA_SHIFT * px.x;
    float r = texture(iChannel0, vec2(curved.x + shift, curved.y)).r;
    float g = texture(iChannel0, curved).g;
    float b = texture(iChannel0, vec2(curved.x - shift, curved.y)).b;
    vec3 col = vec3(r, g, b);

    // Bloom glow
    vec3 glow = bloom(curved, px * 2.0);
    col += glow * BLOOM_AMOUNT;

    // Scanlines
    float scanline = sin((curved.y + SCANLINE_SPEED * iTime) * iResolution.y * 3.14159) * 0.5 + 0.5;
    col *= 1.0 - SCANLINE_WEIGHT * (1.0 - scanline);

    // Vignette
    vec2 vig = curved * (1.0 - curved);
    float vigFactor = pow(vig.x * vig.y * 15.0, VIGNETTE_AMOUNT);
    col *= vigFactor;

    // Film grain
    float grain = rand(curved + fract(iTime)) * 2.0 - 1.0;
    col += grain * NOISE_AMOUNT;

    // CRT flicker
    col *= 1.0 + FLICKER_AMOUNT * sin(iTime * 60.0);

    // Brightness
    col *= BRIGHTNESS;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
