// Breakcore — chaotic fast-switching patterns for chopped breaks
// Venetian Snares meets Aphex Twin territory
//
// R: amen chop — fast quantized blocks, hard switches
// G: bass stab — mid-speed cells, aggressive
// B: snare roll — very fast noise bursts
// A: pad drone — slow contrast layer, the eye of the storm

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // R: Amen chop — fast time quantization, hard-edged blocks
    // Quantize time to 16th notes at ~165bpm = ~11Hz
    float q16 = floor(iTime * 11.0);
    float chop = hash(vec2(q16, floor(uv.y * 4.0)));
    // Irregular pattern — some hits, some silence
    chop = step(0.35, chop) * hash(vec2(q16 * 1.3, floor(uv.x * 3.0)));
    chop = clamp(chop * 2.0, 0.0, 1.0);

    // G: Bass stab — slower, heavier blocks
    float q8 = floor(iTime * 5.5);  // 8th notes
    float bass = noise(uv * 3.0 + q8 * 2.1);
    bass = smoothstep(0.4, 0.7, bass);
    bass *= step(0.3, sin(iTime * 1.7));

    // B: Snare roll — very fast, percussive
    float q32 = floor(iTime * 22.0);  // 32nd notes
    float snare = hash(vec2(q32 * 0.7, uv.x * 5.0 + uv.y * 7.0));
    snare = step(0.75, snare);  // sparse hits
    // Rolls happen in bursts
    float rollGate = smoothstep(0.7, 1.0, sin(iTime * 0.6));
    snare *= rollGate;

    // A: Pad — the calm center, slow smooth
    float pad = noise(uv * 2.0 + iTime * 0.05);
    pad = pad * pad;
    pad *= 0.6 + 0.4 * sin(iTime * 0.15);

    fragColor = vec4(chop, bass, snare, pad);
}
