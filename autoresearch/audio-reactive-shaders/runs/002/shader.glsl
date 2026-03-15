// Audio-reactive terminal overlay v3 — Plasma Aurora
//
// Bass drives a warm plasma field, mids create flowing aurora curtains,
// treble adds electric sparks. Color palette shifts with frequency balance.

float bandEnergy(float bandPos) {
    vec2 uv = vec2(bandPos, 1.0 - 0.5 / iResolution.y);
    return dot(texture(iChannel0, uv).rgb, vec3(0.333));
}

float bass()   { return (bandEnergy(0.05) + bandEnergy(0.10) + bandEnergy(0.15)) / 3.0; }
float mid()    { return (bandEnergy(0.35) + bandEnergy(0.45) + bandEnergy(0.55)) / 3.0; }
float treble() { return (bandEnergy(0.75) + bandEnergy(0.85) + bandEnergy(0.95)) / 3.0; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Smooth noise
float snoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1, 0)), f.x),
        mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// Fractal noise
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * snoise(p);
        p *= 2.1;
        a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = uv * 2.0 - 1.0;
    c.x *= iResolution.x / iResolution.y;
    
    vec4 term = texture(iChannel0, uv);
    float textLum = dot(term.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    float b = bass(), m = mid(), t = treble();
    float total = (b + m + t) / 3.0;
    
    // ── Plasma field (bass-driven) ──
    // Temperature and turbulence from bass energy
    float plasma = 0.0;
    vec2 plasmaUV = c * (2.0 + b * 3.0);
    plasma += sin(plasmaUV.x * 3.0 + iTime * 0.8 + b * 6.0);
    plasma += sin(plasmaUV.y * 2.5 + iTime * 0.6);
    plasma += sin((plasmaUV.x + plasmaUV.y) * 2.0 + iTime * 1.2);
    plasma += sin(length(plasmaUV) * 3.0 - iTime * 0.9);
    plasma = plasma * 0.25 + 0.5; // normalize 0-1
    plasma *= b * 1.5 + 0.1; // bass intensity
    
    // Plasma color: warm reds/oranges when bass heavy
    vec3 plasmaCol = vec3(
        plasma * 1.2,
        plasma * 0.4 * (1.0 - b * 0.5),
        plasma * 0.15
    );
    
    // ── Aurora curtains (mid-driven) ──
    // Flowing vertical curtains that wave horizontally
    float curtainX = c.x + sin(c.y * 4.0 + iTime * 1.5) * m * 0.6;
    float curtain = fbm(vec2(curtainX * 2.0, c.y * 1.5 + iTime * 0.3));
    curtain = smoothstep(0.3, 0.7, curtain) * m * 1.8;
    
    // Aurora color: greens and cyans
    vec3 auroraCol = vec3(
        curtain * 0.2,
        curtain * 0.9,
        curtain * 0.6 + m * 0.3
    );
    
    // Second aurora layer (purple, slower)
    float curtain2X = c.x + sin(c.y * 3.0 + iTime * 0.8) * m * 0.4;
    float curtain2 = fbm(vec2(curtain2X * 1.5 + 5.0, c.y * 2.0 + iTime * 0.2));
    curtain2 = smoothstep(0.4, 0.8, curtain2) * m * 1.2;
    auroraCol += vec3(curtain2 * 0.5, curtain2 * 0.1, curtain2 * 0.7);
    
    // ── Electric sparks (treble-driven) ──
    float spark = 0.0;
    if (t > 0.1) {
        // Fast-moving bright dots
        float n1 = hash(floor(fragCoord * 0.15) + floor(iTime * 8.0));
        spark += step(1.0 - t * 0.5, n1) * 1.2;
        // Finer grain
        float n2 = hash(floor(fragCoord * 0.4) + floor(iTime * 12.0));
        spark += step(1.0 - t * 0.25, n2) * 0.6;
        spark *= t;
    }
    vec3 sparkCol = vec3(0.7, 0.8, 1.0) * spark;
    
    // ── Edge energy border ──
    float dist = length(c);
    float edgeGlow = smoothstep(0.5, 1.3, dist) * total * 0.5;
    vec3 edgeCol = mix(
        vec3(0.8, 0.2, 0.1),  // warm edge when bass
        vec3(0.2, 0.5, 0.9),  // cool edge when treble
        t / max(b + t, 0.01)
    ) * edgeGlow;
    
    // ── Composite viz ──
    vec3 viz = plasmaCol + auroraCol + sparkCol + edgeCol;
    
    // ── Text blend ──
    // Warped text when energy is high
    vec2 wuv = uv;
    wuv.x += sin(uv.y * 25.0 + iTime * 2.0) * total * 0.006;
    wuv.y += cos(uv.x * 20.0 + iTime * 1.5) * total * 0.004;
    vec3 termCol = texture(iChannel0, clamp(wuv, 0.0, 1.0)).rgb;
    
    float textMask = smoothstep(0.04, 0.2, textLum);
    vec3 result = mix(viz * 0.9, termCol + viz * 0.15, textMask * 0.8);
    
    // Vignette breathing with bass
    result *= 1.0 - smoothstep(0.3, 1.4, dist) * b * 0.4;
    
    fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
