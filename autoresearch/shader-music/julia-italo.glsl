// Julia Set Italo — animated Julia fractal for Italo Disco
// R: escape speed (disco bass), G: orbit trap (chorus pad),
// B: edge glow (claps), A: smooth potential (lead melody)

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Map to complex plane
    vec2 z = (uv - 0.5) * 3.0;
    
    // Animated Julia constant — traces a lissajous curve
    vec2 c = vec2(
        0.38 * sin(iTime * 0.3) - 0.2,
        0.38 * cos(iTime * 0.23) + 0.1
    );
    
    float escapeSpeed = 0.0;
    float orbitTrap = 1e10;
    float smoothEscape = 0.0;
    
    const int maxIter = 32;
    
    for (int i = 0; i < maxIter; i++) {
        // z = z^2 + c
        z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
        
        float d = dot(z, z);
        
        // Orbit trap — minimum distance to origin
        orbitTrap = min(orbitTrap, length(z - vec2(0.0, 0.0)));
        
        if (d > 4.0) {
            escapeSpeed = float(i) / float(maxIter);
            // Smooth escape count
            smoothEscape = (float(i) - log2(log2(d))) / float(maxIter);
            break;
        }
    }
    
    // R: Disco bass — escape speed, inverted (inside set = louder)
    float bass = 1.0 - escapeSpeed;
    bass = bass * bass;  // squared for more contrast
    
    // G: Chorus pad — orbit trap distance, creates tendrils
    float pad = exp(-orbitTrap * 3.0);
    pad = clamp(pad, 0.0, 1.0);
    
    // B: Claps — edge detection (thin boundary of set)
    float edge = smoothstep(0.0, 0.1, escapeSpeed) * smoothstep(0.3, 0.1, escapeSpeed);
    float clap = edge;
    
    // A: Lead — smooth potential field, full range
    float lead = smoothEscape;
    lead = lead * (0.7 + 0.3 * sin(iTime * 0.7 + smoothEscape * 6.28));
    
    fragColor = vec4(bass, pad, clap, lead);
}
