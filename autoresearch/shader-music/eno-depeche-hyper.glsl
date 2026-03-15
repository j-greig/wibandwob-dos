// Eno × Depeche Mode × Hyperpop
// Slow generative drift punctuated by dark pulses and chaos spikes
//
// R: ambient drift — very slow fbm, Eno territory
// G: dark pulse — sine wave modulated grid, Depeche industrial throb
// B: hyperpop glitch — fast noise bursts that spike unpredictably
// A: harmonic field — interference of all three, the crossover zone

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1, 0)), f.x),
        mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
        f.y
    );
}

float fbm(vec2 p, int oct) {
    float sum = 0.0, amp = 1.0, freq = 1.0, total = 0.0;
    for (int i = 0; i < oct; i++) {
        sum += noise(p * freq) * amp;
        total += amp;
        freq *= 2.3;
        amp *= 0.45;
    }
    return sum / total;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // ── R: Eno drift ──────────────────────────
    // Glacially slow fbm, 2 octaves, barely moving
    // Like watching clouds from an airport window
    float eno = fbm(uv * 1.5 + vec2(iTime * 0.03, sin(iTime * 0.02) * 0.5), 2);
    eno = smoothstep(0.3, 0.7, eno);
    // Subtle breathing
    eno *= 0.7 + 0.3 * sin(iTime * 0.15);

    // ── G: Depeche pulse ──────────────────────
    // Dark industrial throb — sine-modulated grid creates pulsing cells
    vec2 dp = uv * 6.0;
    float pulse = sin(dp.x * 3.14159 + iTime * 1.8) * sin(dp.y * 3.14159 + iTime * 1.2);
    pulse = pulse * 0.5 + 0.5;
    // Gate it — only the peaks survive, creating rhythmic hits
    pulse = smoothstep(0.6, 0.9, pulse);
    // Slow envelope over the pulse field
    pulse *= 0.5 + 0.5 * sin(iTime * 0.4);

    // ── B: Hyperpop glitch ────────────────────
    // Fast chaotic noise — spikes appear and vanish
    float glitch = noise(uv * 20.0 + iTime * 4.0);
    // Hard threshold — creates staccato bursts
    glitch = step(0.78, glitch);
    // Modulate intensity — sometimes silent, sometimes full chaos
    float chaos_envelope = max(0.0, sin(iTime * 0.7) * sin(iTime * 1.3));
    glitch *= chaos_envelope;

    // ── A: Harmonic field ─────────────────────
    // Where all three worlds meet — interference pattern
    float field = eno * 0.4 + pulse * 0.3 + glitch * 0.3;
    // Add its own slow wander
    field += 0.2 * fbm(uv * 3.0 + vec2(iTime * 0.08, iTime * 0.05), 3);
    field = clamp(field, 0.0, 1.0);
    // Dreamy S-curve
    field = field * field * (3.0 - 2.0 * field);

    fragColor = vec4(eno, pulse, glitch, field);
}
