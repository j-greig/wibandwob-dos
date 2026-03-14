// WibWob-DOS Phosphor Glow shader for Ghostty
// Minimal effect: just bloom/glow around bright text + subtle scanlines.
// Good for daily use — less aggressive than the full CRT shader.

const float BLOOM_RADIUS  = 1.5;   // glow spread in pixels
const float BLOOM_AMOUNT  = 0.12;  // glow intensity
const float SCANLINE_WEIGHT = 0.03; // very subtle scanlines
const float BRIGHTNESS    = 1.02;

vec3 bloom(vec2 uv, vec2 px) {
    vec3 sum = vec3(0.0);
    float r = BLOOM_RADIUS;
    // 8-tap radial sample
    for (float a = 0.0; a < 6.28318; a += 0.7854) {
        sum += texture(iChannel0, uv + vec2(cos(a), sin(a)) * px * r).rgb;
    }
    return sum / 8.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 px = 1.0 / iResolution.xy;

    vec3 col = texture(iChannel0, uv).rgb;

    // Soft glow from surrounding bright pixels
    vec3 glow = bloom(uv, px);
    // Only add glow where there's actual brightness
    vec3 glowDelta = max(glow - col * 0.5, vec3(0.0));
    col += glowDelta * BLOOM_AMOUNT;

    // Very subtle scanlines
    float scan = sin(uv.y * iResolution.y * 3.14159) * 0.5 + 0.5;
    col *= 1.0 - SCANLINE_WEIGHT * (1.0 - scan);

    col *= BRIGHTNESS;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
