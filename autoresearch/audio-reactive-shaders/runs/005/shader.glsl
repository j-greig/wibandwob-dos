// Audio-reactive terminal overlay v7 — Noir Geometry
//
// Minimal. Black space. Thin white lines that breathe.
// Bass: a single horizontal line splits and reforms.
// Mids: rotating wireframe geometry fades in/out.
// Treble: pinpoint stars bloom and die.
// Everything white on black. No color until energy peaks.

float bandEnergy(float bandPos) {
    vec2 uv = vec2(bandPos, 1.0 - 0.5 / iResolution.y);
    return dot(texture(iChannel0, uv).rgb, vec3(0.333));
}

float bass()   { return (bandEnergy(0.05) + bandEnergy(0.10) + bandEnergy(0.15)) / 3.0; }
float mid()    { return (bandEnergy(0.35) + bandEnergy(0.45) + bandEnergy(0.55)) / 3.0; }
float treble() { return (bandEnergy(0.75) + bandEnergy(0.85) + bandEnergy(0.95)) / 3.0; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Signed distance to a line segment
float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// Thin line with glow
float line(vec2 p, vec2 a, vec2 b, float w) {
    float d = sdSegment(p, a, b);
    return smoothstep(w + 0.003, w, d);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 c = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    vec4 term = texture(iChannel0, uv);
    float textLum = dot(term.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    float b = bass(), m = mid(), t = treble();
    float total = (b + m + t) / 3.0;
    
    float shape = 0.0;
    vec3 shapeColor = vec3(1.0); // default white
    
    // ── Bass: the horizon line ──
    // One perfect horizontal line. Splits on bass hits.
    float split = b * 0.15;
    shape += line(c, vec2(-0.8, split), vec2(0.8, split), 0.001);
    shape += line(c, vec2(-0.8, -split), vec2(0.8, -split), 0.001);
    // Vertical ticks at bass energy
    for (int i = 0; i < 5; i++) {
        float x = -0.6 + float(i) * 0.3;
        float tickH = b * 0.05 * (1.0 + float(i) * 0.3);
        shape += line(c, vec2(x, -tickH), vec2(x, tickH), 0.0008) * 0.5;
    }
    
    // ── Mids: rotating geometry ──
    // Wireframe polygon that rotates and scales with mid energy
    float sides = 6.0; // hexagon
    float rot = iTime * 0.3 + m * 3.0;
    float radius = 0.1 + m * 0.25;
    
    for (int i = 0; i < 6; i++) {
        float a1 = rot + float(i) * 6.2832 / sides;
        float a2 = rot + float(i + 1) * 6.2832 / sides;
        vec2 p1 = vec2(cos(a1), sin(a1)) * radius;
        vec2 p2 = vec2(cos(a2), sin(a2)) * radius;
        shape += line(c, p1, p2, 0.0012) * m * 2.0;
    }
    
    // Second polygon, counter-rotating, smaller
    float radius2 = 0.05 + m * 0.15;
    float rot2 = -iTime * 0.5 + m * 2.0;
    for (int i = 0; i < 6; i++) {
        float a1 = rot2 + float(i) * 6.2832 / sides;
        float a2 = rot2 + float(i + 1) * 6.2832 / sides;
        vec2 p1 = vec2(cos(a1), sin(a1)) * radius2;
        vec2 p2 = vec2(cos(a2), sin(a2)) * radius2;
        shape += line(c, p1, p2, 0.0008) * m * 1.5;
    }
    
    // Connecting lines between inner and outer
    if (m > 0.2) {
        for (int i = 0; i < 6; i++) {
            float a1 = rot + float(i) * 6.2832 / sides;
            float a2 = rot2 + float(i) * 6.2832 / sides;
            vec2 p1 = vec2(cos(a1), sin(a1)) * radius;
            vec2 p2 = vec2(cos(a2), sin(a2)) * radius2;
            shape += line(c, p1, p2, 0.0006) * m * 0.8;
        }
    }
    
    // ── Treble: star field ──
    // Bright points that appear and fade
    float stars = 0.0;
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 starPos = vec2(
            hash(vec2(fi, floor(iTime * 2.0))) * 1.6 - 0.8,
            hash(vec2(fi + 50.0, floor(iTime * 2.0))) * 0.8 - 0.4
        );
        float d = length(c - starPos);
        float starBright = smoothstep(0.015, 0.0, d) * t * 3.0;
        // Cross flare
        float flareX = smoothstep(0.002, 0.0, abs(c.y - starPos.y)) * smoothstep(0.06, 0.0, abs(c.x - starPos.x));
        float flareY = smoothstep(0.002, 0.0, abs(c.x - starPos.x)) * smoothstep(0.06, 0.0, abs(c.y - starPos.y));
        stars += (starBright + (flareX + flareY) * t * 0.5);
    }
    shape += stars;
    
    // ── Color only on energy peaks ──
    // Below 0.3 total: pure white
    // Above 0.3: bleed in accent color
    if (total > 0.3) {
        float colorAmount = smoothstep(0.3, 0.7, total);
        // Hot accent: from white → rose gold → electric blue at peak
        shapeColor = mix(
            vec3(1.0),
            mix(vec3(1.0, 0.7, 0.5), vec3(0.4, 0.6, 1.0), smoothstep(0.4, 0.8, total)),
            colorAmount * 0.7
        );
    }
    
    // ── Soft glow around all geometry ──
    // Sample nearby for bloom
    float glow = 0.0;
    for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
            vec2 offset = vec2(float(i), float(j)) * 3.0 / iResolution.xy;
            float sampleLum = dot(texture(iChannel0, clamp(uv + offset, 0.0, 1.0)).rgb, vec3(0.333));
            glow += sampleLum;
        }
    }
    glow /= 9.0;
    glow *= total * 0.3;
    
    // ── Composite ──
    vec3 viz = shapeColor * min(shape, 1.5);
    
    // Text: keep it clean, slightly dimmed, with subtle glow
    float textMask = smoothstep(0.02, 0.15, textLum);
    vec3 tintedText = term.rgb * (0.85 + glow);
    
    vec3 result = mix(viz * 0.7, tintedText, textMask * 0.92);
    
    // Breathing ambient — very faint
    result += vec3(0.01) * total;
    
    fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
