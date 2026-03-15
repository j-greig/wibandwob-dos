// Audio-reactive terminal overlay
//
// Reads frequency band data from the bottom row of the terminal (iChannel0).
// The FFT datastrip renders colored blocks there — this shader reads those
// pixel brightnesses as frequency band energies and uses them to drive
// visual effects across the whole screen.
//
// Pair with: python3 fft-datastrip.py <wav> --both
// The --both flag renders bars (human-visible) + datastrip (shader-readable)

// Read energy from the datastrip (bottom row of terminal)
float bandEnergy(float bandPos) {
    // Sample from the bottom row of the terminal texture
    // bandPos: 0.0 = leftmost band (bass), 1.0 = rightmost (treble)
    vec2 uv = vec2(bandPos, 1.0 - 0.5 / iResolution.y);  // bottom pixel row
    vec4 pixel = texture(iChannel0, uv);
    return dot(pixel.rgb, vec3(0.333));  // average brightness = energy
}

// Get bass/mid/treble energy
float bass()   { return (bandEnergy(0.05) + bandEnergy(0.10) + bandEnergy(0.15)) / 3.0; }
float mid()    { return (bandEnergy(0.40) + bandEnergy(0.50) + bandEnergy(0.60)) / 3.0; }
float treble() { return (bandEnergy(0.80) + bandEnergy(0.85) + bandEnergy(0.90)) / 3.0; }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 centered = uv * 2.0 - 1.0;
    centered.x *= iResolution.x / iResolution.y;
    
    // Terminal text
    vec4 term = texture(iChannel0, uv);
    float textLum = dot(term.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    // Read frequency energies
    float b = bass();
    float m = mid();
    float t = treble();
    float total = (b + m + t) / 3.0;
    
    // ── Effect 1: Radial pulse from bass ──
    float dist = length(centered);
    float bassPulse = smoothstep(0.8 + b * 0.5, 0.0, dist) * b * 0.4;
    
    // ── Effect 2: Horizontal wave from mids ──
    float wave = sin(centered.y * 10.0 + iTime * 2.0 + m * 6.28) * m * 0.15;
    
    // ── Effect 3: Sparkle from treble ──
    float sparkle = 0.0;
    if (t > 0.3) {
        float noise = fract(sin(dot(fragCoord, vec2(12.9898, 78.233)) + iTime * 3.0) * 43758.5453);
        sparkle = step(1.0 - t * 0.3, noise) * t * 0.5;
    }
    
    // ── Effect 4: Color tint from frequency balance ──
    vec3 tint = vec3(
        b * 0.6,                    // bass = red
        m * 0.4,                    // mids = green  
        t * 0.5                     // treble = blue
    );
    
    // ── Effect 5: Edge glow that breathes with total energy ──
    float edge = smoothstep(0.3, 1.0, max(abs(centered.x), abs(centered.y)));
    float edgeGlow = edge * total * 0.3;
    
    // Combine effects
    vec3 viz = tint * (bassPulse + wave + 0.1) + sparkle + edgeGlow * vec3(0.3, 0.2, 0.5);
    
    // Blend: preserve text, show viz in dark areas
    float textMask = smoothstep(0.05, 0.3, textLum);
    vec3 result = mix(term.rgb + viz * 0.8, term.rgb, textMask);
    
    // Subtle overall energy modulation
    result += total * 0.05;
    
    fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
