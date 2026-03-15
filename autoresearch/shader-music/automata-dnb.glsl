// Cellular Automata DnB — pseudo-automata patterns for drum & bass
// R: large cells (reese), G: small cells (stabs), B: edge noise (breaks), A: smooth field (atmo)

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float cellNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1, 0));
    float c = hash(i + vec2(0, 1));
    float d = hash(i + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Pseudo cellular automaton — thresholded noise that evolves in steps
float automaton(vec2 uv, float time, float scale, float stepRate) {
    float t = floor(time * stepRate);  // discrete time steps
    vec2 p = uv * scale;
    
    // Sample neighborhood (simplified CA-like behavior)
    float center = cellNoise(p + t * 0.1);
    float north  = cellNoise(p + vec2(0, 1.0/scale) + t * 0.1);
    float east   = cellNoise(p + vec2(1.0/scale, 0) + t * 0.1);
    
    // Rule: alive if neighbors differ enough (edge detection)
    float alive = step(0.3, abs(center - north) + abs(center - east));
    return alive * center;  // modulate by original value for gradients
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // R: Reese bass — large cells, slow evolution
    float reese = automaton(uv, iTime, 3.0, 2.0);
    reese = smoothstep(0.1, 0.6, reese);
    
    // G: Stabs — small cells, medium speed
    float stab = automaton(uv + 0.37, iTime, 7.0, 4.0);
    stab = pow(stab, 0.8);
    
    // B: Breaks — tiny cells, fast, very rhythmic
    float brk = automaton(uv + 0.71, iTime, 12.0, 8.0);
    brk = step(0.4, brk);  // hard trigger
    
    // A: Atmosphere — smooth blend, slow
    float atmo = cellNoise(uv * 2.0 + iTime * 0.1);
    atmo = atmo * atmo;
    
    fragColor = vec4(reese, stab, brk, atmo);
}
