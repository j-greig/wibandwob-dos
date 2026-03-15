// Cathedral — harmonic interference patterns for multi-voice composition
//
// Four channels are four "voices" made of overlapping sine waves at
// musical frequency ratios. They evolve independently but share the
// same harmonic field, so they're related but never identical.
// Think: pipe organ + bell choir + choir + glass harmonics
//
// R: 5ths — waves at 3:2 ratio, slow rotation (organ)
// G: 3rds — waves at 5:4 ratio, medium drift (bells)
// B: 7ths — waves at 7:4 ratio, fast shimmer (glass)
// A: unison — waves at near-unison detune, very slow (choir)

float wave(vec2 uv, float freq, float angle, float phase) {
    // Directional wave — travels at 'angle' radians
    vec2 dir = vec2(cos(angle), sin(angle));
    return sin(dot(uv, dir) * freq + phase);
}

float voicePattern(vec2 uv, float time, float baseFreq, float ratio,
                   float speed, float rotSpeed, int numWaves) {
    float sum = 0.0;
    float amp = 1.0;
    float totalAmp = 0.0;
    
    for (int i = 0; i < numWaves; i++) {
        float fi = float(i);
        float freq = baseFreq * pow(ratio, fi);
        float angle = fi * 2.39996 + time * rotSpeed * (0.5 + fi * 0.3);  // golden angle + rotation
        float phase = time * speed * (1.0 + fi * 0.2);
        
        sum += wave(uv, freq, angle, phase) * amp;
        totalAmp += amp;
        amp *= 0.65;  // each harmonic quieter
    }
    return (sum / totalAmp) * 0.5 + 0.5;  // normalize to 0-1
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = uv * 2.0 - 1.0;  // center
    uv.x *= iResolution.x / iResolution.y;  // aspect
    
    // ── R: Organ — 5ths (3:2), slow, deep, 5 harmonics ──
    float organ = voicePattern(uv, iTime, 4.0, 1.5, 0.2, 0.05, 5);
    // Add slow breathing
    organ *= 0.6 + 0.4 * sin(iTime * 0.12 + 1.0);
    
    // ── G: Bells — 3rds (5:4), medium, bright, 4 harmonics ──
    float bells = voicePattern(uv + 0.3, iTime, 6.0, 1.25, 0.5, 0.12, 4);
    // Sharper peaks — bell-like attack
    bells = bells * bells;
    bells *= 0.5 + 0.5 * sin(iTime * 0.25 + 2.5);
    
    // ── B: Glass — 7ths (7:4), fast shimmer, 3 harmonics ──
    float glass = voicePattern(uv + 0.7, iTime, 10.0, 1.75, 1.2, 0.2, 3);
    // Threshold for sparkle effect
    glass = smoothstep(0.5, 0.8, glass);
    glass *= 0.4 + 0.6 * sin(iTime * 0.4 + 4.0);
    
    // ── A: Choir — near-unison (1.01:1), very slow, 6 harmonics ──
    float choir = voicePattern(uv + 1.1, iTime, 3.0, 1.01, 0.08, 0.02, 6);
    // Warm, smooth — no sharp edges
    choir = choir * 0.8 + 0.1;
    choir *= 0.7 + 0.3 * sin(iTime * 0.08);
    
    fragColor = vec4(
        clamp(organ, 0.0, 1.0),
        clamp(bells, 0.0, 1.0),
        clamp(glass, 0.0, 1.0),
        clamp(choir, 0.0, 1.0)
    );
}
