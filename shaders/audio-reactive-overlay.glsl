// Audio-reactive terminal overlay v8 — Moiré Interference
//
// Overlapping circular wave patterns create moiré interference.
// Bass controls wave frequency, mids shift wave centers,
// treble modulates line thickness. Hypnotic, mathematical,
// like looking through layered screens of fine mesh.
// Monochrome with spectral color bleeding at intersections.

float bandEnergy(float bandPos) {
    vec2 uv = vec2(bandPos, 1.0 - 0.5 / iResolution.y);
    return dot(texture(iChannel0, uv).rgb, vec3(0.333));
}

float bass()   { return (bandEnergy(0.05) + bandEnergy(0.10) + bandEnergy(0.15)) / 3.0; }
float mid()    { return (bandEnergy(0.35) + bandEnergy(0.45) + bandEnergy(0.55)) / 3.0; }
float treble() { return (bandEnergy(0.75) + bandEnergy(0.85) + bandEnergy(0.95)) / 3.0; }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    vec4 term = texture(iChannel0, uv);
    float textLum = dot(term.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    float b = bass(), m = mid(), t = treble();
    float total = (b + m + t) / 3.0;
    
    // Wave frequency controlled by bass
    float freq = 30.0 + b * 60.0;
    // Line thickness controlled by treble
    float thickness = 0.4 + t * 0.3;
    
    // ── Wave pattern 1: centered ──
    float d1 = length(c);
    float wave1 = sin(d1 * freq + iTime * 2.0) * 0.5 + 0.5;
    wave1 = smoothstep(0.5 - thickness * 0.15, 0.5, wave1);
    
    // ── Wave pattern 2: offset by mids ──
    vec2 center2 = vec2(sin(iTime * 0.4) * m * 0.5, cos(iTime * 0.3) * m * 0.3);
    float d2 = length(c - center2);
    float wave2 = sin(d2 * freq * 0.9 - iTime * 1.5) * 0.5 + 0.5;
    wave2 = smoothstep(0.5 - thickness * 0.15, 0.5, wave2);
    
    // ── Wave pattern 3: opposite offset ──
    vec2 center3 = vec2(-sin(iTime * 0.5) * m * 0.4, sin(iTime * 0.35) * m * 0.35);
    float d3 = length(c - center3);
    float wave3 = sin(d3 * freq * 1.1 + iTime * 1.8) * 0.5 + 0.5;
    wave3 = smoothstep(0.5 - thickness * 0.15, 0.5, wave3);
    
    // ── Linear wave pattern (bass-reactive) ──
    float angle = iTime * 0.2 + b * 1.5;
    vec2 dir = vec2(cos(angle), sin(angle));
    float linearWave = sin(dot(c, dir) * freq * 0.7 + iTime * 3.0) * 0.5 + 0.5;
    linearWave = smoothstep(0.5 - thickness * 0.12, 0.5, linearWave);
    
    // ── Moiré interference ──
    // The magic: multiplying overlapping wave patterns creates interference
    float moire = wave1 * wave2 * wave3;
    float moireLinear = wave1 * linearWave;
    
    // Combine patterns
    float pattern = moire * 0.7 + moireLinear * 0.3;
    
    // ── Spectral color at interference peaks ──
    // Where patterns constructively interfere, bleed in rainbow
    vec3 moireColor = vec3(pattern);
    
    if (total > 0.15) {
        // Thin spectral decomposition at bright interference zones
        float colorShift = total * 0.5;
        vec3 spectral = vec3(
            sin(pattern * 6.28 + 0.0 + iTime) * 0.5 + 0.5,
            sin(pattern * 6.28 + 2.09 + iTime * 0.7) * 0.5 + 0.5,
            sin(pattern * 6.28 + 4.19 + iTime * 1.3) * 0.5 + 0.5
        );
        moireColor = mix(moireColor, spectral, colorShift * pattern);
    }
    
    // ── Breathing: pattern intensity pulses with bass ──
    moireColor *= 0.3 + b * 0.8 + total * 0.4;
    
    // ── Radial fade — pattern fades at edges ──
    float fade = 1.0 - smoothstep(0.3, 0.8, length(c));
    moireColor *= fade * 0.8 + 0.2;
    
    // ── Composite with terminal ──
    float textMask = smoothstep(0.03, 0.18, textLum);
    vec3 result = mix(moireColor * 0.6, term.rgb, textMask * 0.88);
    
    fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
