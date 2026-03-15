// Space Jazz — smooth orbital patterns for jazz harmony
// Miles Davis "In a Silent Way" meets Sun Ra's Arkestra
//
// R: walking bass — slow sinusoidal walk, stepwise motion
// G: rhodes — medium complexity, warm interference
// B: brush — subtle fast texture, soft noise
// A: horn — melodic line, expressive curves

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = uv - 0.5;

    // R: Walking bass — slow orbital motion, quantized feel
    // Like a bassist walking through changes
    float angle = atan(c.y, c.x);
    float radius = length(c);
    float walk = sin(angle * 3.0 + iTime * 0.6) * cos(radius * 8.0 - iTime * 0.3);
    walk = walk * 0.5 + 0.5;
    walk = smoothstep(0.2, 0.8, walk);
    walk *= 0.5 + 0.5 * sin(iTime * 0.2);

    // G: Rhodes — warm interference, two wave systems
    float r1 = sin(c.x * 12.0 + iTime * 0.8 + sin(c.y * 4.0 + iTime * 0.3));
    float r2 = sin(c.y * 10.0 - iTime * 0.5 + cos(c.x * 5.0 - iTime * 0.4));
    float rhodes = (r1 * r2) * 0.5 + 0.5;
    rhodes = pow(rhodes, 1.5);
    rhodes *= 0.6 + 0.4 * sin(iTime * 0.3 + 0.7);

    // B: Brush — subtle fast texture
    float brush = noise(uv * 15.0 + iTime * 2.0);
    brush = smoothstep(0.55, 0.7, brush);
    // Swish pattern — comes and goes
    brush *= 0.3 + 0.7 * abs(sin(iTime * 0.7));

    // A: Horn — melodic curve, smooth and expressive
    float horn = sin(c.x * 5.0 + sin(iTime * 0.4) * 3.0) *
                 cos(c.y * 4.0 + cos(iTime * 0.3) * 2.0);
    horn = horn * 0.5 + 0.5;
    horn = smoothstep(0.3, 0.7, horn);
    // Melodic phrasing — notes with space between them
    float phrase = max(0.0, sin(iTime * 0.5) * sin(iTime * 0.8));
    horn *= phrase;

    fragColor = vec4(
        clamp(walk, 0.0, 1.0),
        clamp(rhodes, 0.0, 1.0),
        clamp(brush, 0.0, 1.0),
        clamp(horn, 0.0, 1.0)
    );
}
