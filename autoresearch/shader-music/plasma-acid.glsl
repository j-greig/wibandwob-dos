// Plasma Acid — 4-channel fbm noise, each channel moves differently
// Designed for acid techno: slow-moving bass, mid-tempo acid line,
// fast hi-hat triggers, and a slowly drifting pad

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);  // smoothstep
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, int octaves, float lacunarity, float gain) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    float maxAmp = 0.0;
    
    for (int i = 0; i < octaves; i++) {
        sum += noise(p * freq) * amp;
        maxAmp += amp;
        freq *= lacunarity;
        amp *= gain;
    }
    return sum / maxAmp;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // R: Acid bass — slow, large-scale movement, 2 octaves fbm
    //    Wanders slowly, creates long sustained notes
    float bass = fbm(uv * 2.0 + vec2(iTime * 0.15, iTime * 0.08), 2, 2.0, 0.5);
    bass = smoothstep(0.3, 0.7, bass);  // threshold to create on/off regions
    
    // G: Acid lead — medium speed, 3 octaves, more detail
    //    Wobbles create the classic acid squelch pattern
    float acid = fbm(uv * 4.0 + vec2(sin(iTime * 0.7) * 2.0, iTime * 0.4), 3, 2.5, 0.45);
    acid = pow(acid, 1.5);  // contrast boost
    
    // B: Hi-hat/perc — fast, high-frequency noise, 4 octaves
    //    Rapid changes = rhythmic triggering
    float hat = fbm(uv * 8.0 + vec2(iTime * 1.8, iTime * 1.2), 4, 3.0, 0.4);
    hat = step(0.55, hat);  // hard threshold = staccato triggers
    
    // A: Pad/atmosphere — very slow drift, smooth, 2 octaves
    //    Creates evolving harmonic bed
    float pad = fbm(uv * 1.5 + vec2(iTime * 0.05, sin(iTime * 0.1) * 0.5), 2, 2.0, 0.6);
    pad = pad * pad;  // gentle curve
    
    fragColor = vec4(bass, acid, hat, pad);
}
