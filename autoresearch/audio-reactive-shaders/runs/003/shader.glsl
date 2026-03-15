// Audio-reactive terminal overlay v4 — Synthwave CRT
//
// Retro CRT aesthetic: scanlines pulse with bass, phosphor glow from mids,
// chromatic aberration from treble. Color palette: hot pink, cyan, purple.
// Better text readability — effects enhance text rather than obscure it.

float bandEnergy(float bandPos) {
    vec2 uv = vec2(bandPos, 1.0 - 0.5 / iResolution.y);
    return dot(texture(iChannel0, uv).rgb, vec3(0.333));
}

float bass()   { return (bandEnergy(0.05) + bandEnergy(0.10) + bandEnergy(0.15)) / 3.0; }
float mid()    { return (bandEnergy(0.35) + bandEnergy(0.45) + bandEnergy(0.55)) / 3.0; }
float treble() { return (bandEnergy(0.75) + bandEnergy(0.85) + bandEnergy(0.95)) / 3.0; }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = uv * 2.0 - 1.0;
    
    float b = bass(), m = mid(), t = treble();
    float total = (b + m + t) / 3.0;
    
    // ── CRT barrel distortion ──
    // Subtle curvature that increases with bass
    vec2 cuv = c;
    float barrel = 0.02 + b * 0.04;
    cuv *= 1.0 + dot(cuv, cuv) * barrel;
    vec2 screenUV = cuv * 0.5 + 0.5;
    
    // Clamp to screen bounds (show black border)
    bool inBounds = screenUV.x > 0.0 && screenUV.x < 1.0 && screenUV.y > 0.0 && screenUV.y < 1.0;
    
    // ── Chromatic aberration (treble-driven) ──
    float aberration = t * 0.006 + 0.001;
    vec2 rUV = screenUV + vec2(aberration, 0.0);
    vec2 gUV = screenUV;
    vec2 bUV = screenUV - vec2(aberration, 0.0);
    
    float rr = inBounds ? texture(iChannel0, clamp(rUV, 0.0, 1.0)).r : 0.0;
    float gg = inBounds ? texture(iChannel0, clamp(gUV, 0.0, 1.0)).g : 0.0;
    float bb = inBounds ? texture(iChannel0, clamp(bUV, 0.0, 1.0)).b : 0.0;
    vec3 termColor = vec3(rr, gg, bb);
    float textLum = dot(termColor, vec3(0.2126, 0.7152, 0.0722));
    
    // ── Scanlines (bass-driven intensity) ──
    float scanFreq = 3.0; // scanlines per pixel pair
    float scan = sin(fragCoord.y * scanFreq) * 0.5 + 0.5;
    float scanIntensity = 0.15 + b * 0.35; // stronger scanlines on bass
    scan = 1.0 - scan * scanIntensity;
    
    // ── Phosphor glow (mid-driven) ──
    // Text gets a colored glow halo when mids are active
    float glow = 0.0;
    for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
            if (i == 0 && j == 0) continue;
            vec2 offset = vec2(float(i), float(j)) / iResolution.xy * (2.0 + m * 4.0);
            float sample_lum = dot(texture(iChannel0, clamp(screenUV + offset, 0.0, 1.0)).rgb, vec3(0.333));
            glow += sample_lum;
        }
    }
    glow /= 24.0;
    glow *= m * 2.5;
    
    // Phosphor color: synthwave pink/cyan mix
    vec3 glowColor = mix(
        vec3(1.0, 0.2, 0.6),  // hot pink
        vec3(0.2, 0.9, 1.0),  // cyan
        sin(iTime * 0.5) * 0.5 + 0.5
    ) * glow;
    
    // ── Horizontal noise bars (treble-driven) ──
    float noiseBar = 0.0;
    if (t > 0.2) {
        float lineHash = fract(sin(floor(fragCoord.y * 0.5) + floor(iTime * 15.0)) * 43758.5);
        noiseBar = step(1.0 - t * 0.08, lineHash) * 0.3;
    }
    
    // ── VHS tracking jitter (bass hits) ──
    float jitter = 0.0;
    if (b > 0.4) {
        float jitterLine = step(0.97, fract(sin(floor(fragCoord.y * 0.3) + iTime * 3.0) * 12345.6));
        jitter = jitterLine * b * 0.015;
    }
    vec2 jitterUV = screenUV + vec2(jitter, 0.0);
    if (jitter > 0.0 && inBounds) {
        termColor = texture(iChannel0, clamp(jitterUV, 0.0, 1.0)).rgb;
    }
    
    // ── Bottom gradient (synthwave horizon) ──
    float horizon = smoothstep(0.9, 1.0, uv.y);
    vec3 horizonColor = mix(
        vec3(0.6, 0.1, 0.8),  // purple
        vec3(1.0, 0.3, 0.5),  // pink
        uv.x
    ) * horizon * (0.3 + total * 0.7);
    
    // ── Grid lines at bottom (synthwave floor) ──
    float gridY = uv.y - 0.85;
    float grid = 0.0;
    if (gridY > 0.0) {
        float perspective = gridY * 20.0;
        float gridLineX = smoothstep(0.02, 0.0, abs(fract(c.x * 3.0 / (gridY + 0.1)) - 0.5) - 0.48);
        float gridLineY = smoothstep(0.02, 0.0, abs(fract(perspective) - 0.5) - 0.48);
        grid = max(gridLineX, gridLineY) * gridY * 3.0 * (0.5 + total);
    }
    vec3 gridColor = vec3(0.8, 0.2, 1.0) * grid;
    
    // ── Composite ──
    vec3 result = termColor * scan;
    result += glowColor;
    result += noiseBar * vec3(0.8, 0.8, 0.9);
    result += horizonColor;
    result += gridColor;
    
    // Subtle color tint based on frequency balance
    result *= vec3(
        1.0 + b * 0.15,       // warm on bass
        1.0,
        1.0 + t * 0.1         // cool on treble
    );
    
    // CRT vignette
    float vignette = 1.0 - dot(c * 0.6, c * 0.6);
    result *= clamp(vignette, 0.0, 1.0);
    
    // Border glow
    if (!inBounds) result = vec3(0.0);
    
    fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
