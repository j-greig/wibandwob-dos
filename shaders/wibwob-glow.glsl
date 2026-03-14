// WibWob-DOS Phosphor Glow shader for Ghostty
// Warm phosphor bloom around bright text, visible scanlines, slight color bleed.

const float BLOOM_RADIUS    = 3.0;    // glow spread in pixels
const float BLOOM_AMOUNT    = 0.45;   // glow intensity
const float SCANLINE_WEIGHT = 0.12;   // visible scanlines
const float CHROMA_BLEED    = 0.8;    // color fringing in pixels
const float BRIGHTNESS      = 1.15;   // phosphor brightness boost
const float GLOW_THRESHOLD  = 0.1;    // lower = more things glow

vec3 sampleBloom(vec2 uv, vec2 px) {
    vec3 sum = vec3(0.0);
    float total = 0.0;
    // 16-tap radial bloom at two distances
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

    // Chromatic bleed — shift R and B slightly
    float shift = CHROMA_BLEED * px.x;
    float r = texture(iChannel0, vec2(uv.x + shift, uv.y)).r;
    float g = texture(iChannel0, uv).g;
    float b = texture(iChannel0, vec2(uv.x - shift, uv.y)).b;
    vec3 col = vec3(r, g, b);

    // Phosphor bloom
    vec3 glow = sampleBloom(uv, px);
    float glowLum = dot(glow, vec3(0.299, 0.587, 0.114));
    // Glow more where there's bright content
    float glowMask = smoothstep(GLOW_THRESHOLD, 0.5, glowLum);
    col += glow * BLOOM_AMOUNT * glowMask;

    // Scanlines
    float scan = sin(uv.y * iResolution.y * 3.14159) * 0.5 + 0.5;
    col *= 1.0 - SCANLINE_WEIGHT * (1.0 - scan);

    // Slight vignette to sell the CRT feel
    vec2 vig = uv * (1.0 - uv);
    col *= pow(vig.x * vig.y * 15.0, 0.15);

    col *= BRIGHTNESS;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
