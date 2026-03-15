// Witch House — slow dark fog with sudden bright stabs
// Inspired by: ▲ △ ▽ ▼ — screwed tempos, chopped samples, occult vibes
//
// R: dark fog — slow fbm, creates the dread foundation
// G: chopped stabs — quantized noise that appears/disappears in blocks
// B: screwed texture — time-stretched warping, very slow
// A: ritual pulse — slow sine throb that modulates everything

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p, int oct) {
    float s = 0.0, a = 1.0, f = 1.0, t = 0.0;
    for (int i = 0; i < oct; i++) {
        s += noise(p * f) * a; t += a;
        f *= 2.1; a *= 0.5;
    }
    return s / t;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // R: Dark fog — glacial, menacing
    float fog = fbm(uv * 2.0 + vec2(iTime * 0.04, iTime * 0.02), 4);
    fog = pow(fog, 2.0);  // darken — only peaks survive
    fog *= 0.5 + 0.5 * sin(iTime * 0.1);

    // G: Chopped stabs — quantized time creates rhythmic blocks
    float qTime = floor(iTime * 2.0) * 0.5;  // half-second quantize
    float stab = noise(uv * 8.0 + qTime * 3.7);
    stab = step(0.7, stab);  // hard chop
    // Gate: only active in bursts
    float gate = step(0.6, sin(iTime * 0.8) * sin(iTime * 0.3));
    stab *= gate;

    // B: Screwed texture — time-stretched warp
    vec2 warp = uv + 0.1 * vec2(sin(iTime * 0.06 + uv.y * 3.0),
                                  cos(iTime * 0.04 + uv.x * 2.0));
    float screwed = fbm(warp * 3.0, 3);
    screwed = smoothstep(0.3, 0.6, screwed);
    screwed *= 0.4 + 0.6 * sin(iTime * 0.07 + 1.5);

    // A: Ritual pulse — slow heartbeat
    float pulse = sin(iTime * 0.5) * 0.5 + 0.5;
    pulse = pulse * pulse;  // sharper peaks
    pulse *= 0.3 + 0.7 * fbm(uv * 1.5 + iTime * 0.03, 2);

    fragColor = vec4(fog, stab, screwed, pulse);
}
