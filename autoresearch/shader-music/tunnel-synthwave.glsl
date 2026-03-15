// Tunnel Synthwave — radial tunnel with neon grid lines
// R: tunnel depth pulse (arp), G: radial angle (bass), B: grid flash (snare), A: glow (pad)

float hash(float n) { return fract(sin(n) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = uv - 0.5;
    
    // Polar coords
    float angle = atan(c.y, c.x);
    float radius = length(c);
    
    // Tunnel effect — depth scrolls with time
    float depth = 0.3 / (radius + 0.01) + iTime * 1.5;
    
    // R: Arp — tunnel ring pulses, rhythmic
    float rings = sin(depth * 6.0) * 0.5 + 0.5;
    rings *= smoothstep(0.0, 0.1, radius);  // fade at center
    float arp = rings * (0.5 + 0.5 * sin(iTime * 3.0));
    
    // G: Bass — slow radial rotation, low frequency
    float bass = sin(angle * 2.0 + iTime * 0.5) * 0.5 + 0.5;
    bass *= smoothstep(0.5, 0.1, radius);  // stronger near center
    bass = bass * bass;  // square for more contrast
    
    // B: Snare — grid intersection flashes
    float gridX = abs(sin(depth * 12.0));
    float gridY = abs(sin(angle * 8.0));
    float grid = gridX * gridY;
    float snare = step(0.92, grid) * (0.5 + 0.5 * sin(iTime * 5.0));
    
    // A: Pad — smooth glow, breathing
    float glow = exp(-radius * 3.0);
    float pad = glow * (0.6 + 0.4 * sin(iTime * 0.3 + angle));
    
    fragColor = vec4(arp, bass, snare, pad);
}
