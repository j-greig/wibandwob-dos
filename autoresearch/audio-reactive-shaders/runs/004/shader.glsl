// Audio-reactive terminal overlay v5 — Deep Ocean Bioluminescence
//
// Bass creates deep pressure waves, mids drive bioluminescent plankton
// blooms, treble triggers jellyfish-like electric pulses. Dark palette
// with vivid accents — like a deep sea dive synced to music.

float bandEnergy(float bandPos) {
    vec2 uv = vec2(bandPos, 1.0 - 0.5 / iResolution.y);
    return dot(texture(iChannel0, uv).rgb, vec3(0.333));
}

float bass()   { return (bandEnergy(0.05) + bandEnergy(0.10) + bandEnergy(0.15)) / 3.0; }
float mid()    { return (bandEnergy(0.35) + bandEnergy(0.45) + bandEnergy(0.55)) / 3.0; }
float treble() { return (bandEnergy(0.75) + bandEnergy(0.85) + bandEnergy(0.95)) / 3.0; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float snoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1, 0)), f.x),
        mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = uv * 2.0 - 1.0;
    c.x *= iResolution.x / iResolution.y;
    
    vec4 term = texture(iChannel0, uv);
    float textLum = dot(term.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    float b = bass(), m = mid(), t = treble();
    float total = (b + m + t) / 3.0;
    
    // ── Deep pressure waves (bass) ──
    // Slow undulating distortion like underwater current
    float pressure = sin(c.y * 3.0 + iTime * 0.4 + b * 8.0) * b * 0.5;
    pressure += sin(c.x * 2.0 + iTime * 0.3) * b * 0.3;
    
    // Warped UV — text sways like underwater
    vec2 wuv = uv;
    wuv.x += sin(uv.y * 8.0 + iTime * 0.6) * b * 0.012;
    wuv.y += sin(uv.x * 6.0 + iTime * 0.4) * b * 0.008;
    vec3 termColor = texture(iChannel0, clamp(wuv, 0.0, 1.0)).rgb;
    
    // ── Bioluminescent plankton bloom (mids) ──
    // Scattered glowing particles that drift and pulse
    float bloom = 0.0;
    vec3 bloomColor = vec3(0.0);
    
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec2 driftUV = c * (1.5 + fi * 0.3);
        driftUV.x += iTime * (0.1 + fi * 0.05) + fi * 2.3;
        driftUV.y += sin(iTime * 0.3 + fi) * 0.5;
        
        float n = snoise(driftUV * 2.0);
        float particle = smoothstep(0.65 - m * 0.2, 0.7, n) * m;
        
        // Each cluster has a slightly different color
        vec3 pCol = mix(
            vec3(0.1, 0.8, 0.6),   // teal
            vec3(0.3, 0.5, 1.0),   // blue
            fract(fi * 0.618)
        );
        // Some are green-gold
        if (i > 3) pCol = mix(pCol, vec3(0.4, 0.9, 0.2), 0.6);
        
        bloomColor += pCol * particle;
        bloom += particle;
    }
    bloomColor *= 1.5;
    
    // ── Jellyfish pulses (treble) ──
    // Radial electric pulses from random points
    float jelly = 0.0;
    vec3 jellyColor = vec3(0.0);
    
    if (t > 0.1) {
        for (int i = 0; i < 3; i++) {
            float fi = float(i);
            // Pulse centers drift slowly
            vec2 center = vec2(
                sin(iTime * 0.3 + fi * 2.1) * 0.6,
                cos(iTime * 0.2 + fi * 3.7) * 0.5
            );
            float d = length(c - center);
            // Expanding ring
            float ring = smoothstep(0.03, 0.0, abs(d - fract(iTime * 0.8 + fi * 0.33) * 0.8));
            ring *= t * 2.0;
            // Inner glow
            float core = smoothstep(0.15, 0.0, d) * t * 0.8;
            
            vec3 jCol = mix(
                vec3(0.8, 0.2, 1.0),  // purple
                vec3(1.0, 0.4, 0.7),  // pink
                fi / 3.0
            );
            jellyColor += jCol * (ring + core);
            jelly += ring + core;
        }
    }
    
    // ── Caustic light pattern on text (total energy) ──
    float caustic1 = snoise(c * 4.0 + iTime * vec2(0.3, 0.2));
    float caustic2 = snoise(c * 5.0 - iTime * vec2(0.2, 0.3) + 5.0);
    float caustic = smoothstep(0.4, 0.6, caustic1 * caustic2 + 0.5) * total * 0.6;
    vec3 causticColor = vec3(0.15, 0.4, 0.5) * caustic;
    
    // ── Depth gradient ──
    // Darker at top (deeper), slightly lighter at bottom
    float depthGrad = mix(0.02, 0.08, uv.y);
    vec3 deepColor = vec3(0.01, 0.03, 0.08) + depthGrad;
    
    // ── Composite ──
    vec3 viz = deepColor + bloomColor + jellyColor + causticColor;
    viz += pressure * vec3(0.02, 0.05, 0.08);
    
    // Text blend — tint text with underwater color, preserve readability
    float textMask = smoothstep(0.03, 0.22, textLum);
    
    // Tint text blue-green (underwater feel)
    vec3 tintedText = termColor * vec3(0.7, 0.95, 1.0);
    // Add caustic shimmer to text itself
    tintedText += causticColor * textLum * 0.5;
    
    vec3 result = mix(viz, tintedText, textMask * 0.9);
    
    // Subtle particle overlay even on text areas
    result += bloomColor * 0.1;
    result += jellyColor * 0.08;
    
    fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
