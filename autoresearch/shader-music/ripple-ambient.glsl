// Ripple Ambient — wave interference patterns for ambient music
// R: slow concentric ripples (drone), G: interference peaks (bells),
// B: foam noise (breath), A: standing wave (shimmer)

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = uv - 0.5;
    
    // Multiple ripple sources at different positions
    vec2 src1 = vec2(0.3, 0.3) + 0.1 * vec2(sin(iTime * 0.13), cos(iTime * 0.17));
    vec2 src2 = vec2(0.7, 0.6) + 0.1 * vec2(cos(iTime * 0.11), sin(iTime * 0.19));
    vec2 src3 = vec2(0.5, 0.2) + 0.08 * vec2(sin(iTime * 0.23), cos(iTime * 0.07));
    
    float d1 = length(uv - src1);
    float d2 = length(uv - src2);
    float d3 = length(uv - src3);
    
    // R: Drone — slow expanding rings from source 1
    float wave1 = sin(d1 * 20.0 - iTime * 0.8) * 0.5 + 0.5;
    wave1 *= exp(-d1 * 2.0);  // fade with distance
    float drone = wave1;
    
    // G: Bells — interference peaks where waves cross
    float w1 = sin(d1 * 30.0 - iTime * 1.2);
    float w2 = sin(d2 * 25.0 - iTime * 0.9);
    float interference = w1 * w2;  // product creates nodes
    float bell = smoothstep(0.5, 1.0, interference);
    
    // B: Breath — foam-like noise at wave crests
    float w3 = sin(d3 * 15.0 - iTime * 0.6) * 0.5 + 0.5;
    float foam = w3 * w3 * w3;  // cubic = sharp peaks
    foam *= exp(-d3 * 3.0);
    
    // A: Shimmer — standing wave pattern (sum of all sources)
    float standing = sin(d1 * 12.0) * sin(d2 * 12.0) * sin(d3 * 12.0);
    float shimmer = standing * 0.5 + 0.5;
    shimmer *= 0.5 + 0.5 * sin(iTime * 0.2);  // slow breathe
    
    fragColor = vec4(drone, bell, foam, shimmer);
}
