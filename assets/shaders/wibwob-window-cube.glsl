// wibwob-window-cube.glsl — TUI window cube projection mapping
// A cube sits exactly in the Terrain Lab window slot, drawn as a TUI window.
// Pops out, grows, rotates to show another face, shrinks back into place.

const float COLS = 142.0;
const float ROWS = 81.0;

// Window: left=29 top=13 w=74 h=29 in a 142×81 grid
const vec2 WIN_UV0 = vec2(29.0 / 142.0, 13.0 / 81.0);
const vec2 WIN_UV1 = vec2(103.0 / 142.0, 42.0 / 81.0);

// Animation
const float CYCLE     = 6.0;
const float SCALE_MAX = 1.6;    // how much bigger when popped out
const float POP_DEPTH = 0.5;

// wibwob-dark-pastel theme (Catppuccin Mocha)
const vec3 BASE       = vec3(0.118, 0.118, 0.180);  // #1e1e2e  desktop/body bg
const vec3 SURFACE0   = vec3(0.192, 0.196, 0.267);  // #313244  menu/status bg
const vec3 SURFACE2   = vec3(0.345, 0.357, 0.439);  // #585b70  unfocused border
const vec3 MAUVE      = vec3(0.796, 0.651, 0.969);  // #cba6f7  focused border/title bg
const vec3 TEXT       = vec3(0.804, 0.839, 0.957);  // #cdd6f4  text
const vec3 RED        = vec3(0.953, 0.545, 0.659);  // #f38ba8  close button
const vec3 BLUE       = vec3(0.537, 0.706, 0.980);  // #89b4fa  accent

mat3 rotY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,0,s, 0,1,0, -s,0,c);
}

// Animation curves — smooth rise/fall
float popCurve(float t) {
    float p = mod(t, CYCLE) / CYCLE;
    return sin(p * 3.14159265);
}

float spinCurve(float t) {
    float p = mod(t, CYCLE) / CYCLE;
    return smoothstep(0.15, 0.85, p) * 3.14159265 * 0.5;
}

// Draw a TUI window face on UV coordinates (0..1 × 0..1)
// Returns the colour for that pixel
vec3 drawWindow(vec2 fuv, vec3 borderCol, vec3 titleText) {
    // Cell-based proportions
    float borderW = 0.015;   // border thickness
    float titleH  = 0.07;    // title bar height

    // Outside → border
    bool onBorder = fuv.x < borderW || fuv.x > 1.0 - borderW ||
                    fuv.y < borderW || fuv.y > 1.0 - borderW;
    if (onBorder) return borderCol;

    // Title bar (top strip inside border)
    if (fuv.y < borderW + titleH) {
        // Close button (right side of title bar)
        if (fuv.x > 1.0 - borderW - 0.04) return RED;
        return MAUVE;
    }

    // Content area: dark with faint horizontal "text" lines
    float lineY = fract(fuv.y * 20.0);
    float lineX = fuv.x - borderW;
    float textLine = step(0.3, lineY) * step(lineY, 0.6);  // middle band of each row

    // Vary line lengths to look like text
    float seed = floor(fuv.y * 20.0);
    float lineLen = 0.3 + 0.5 * fract(sin(seed * 127.1) * 43758.5);
    textLine *= step(lineX, lineLen) * step(borderW + 0.02, fuv.x);

    vec3 content = mix(BASE, SURFACE0, textLine * 0.4);
    return content;
}

vec2 boxHit(vec3 ro, vec3 rd, vec3 hs, out vec3 n) {
    vec3 t1 = (-hs - ro) / rd;
    vec3 t2 = ( hs - ro) / rd;
    vec3 mn = min(t1, t2), mx = max(t1, t2);
    float tN = max(max(mn.x, mn.y), mn.z);
    float tF = min(min(mx.x, mx.y), mx.z);
    if (tN > tF || tF < 0.0) return vec2(-1.0);
    n = -sign(rd) * step(mn.zxy, mn.xyz) * step(mn.yzx, mn.xyz);
    return vec2(tN, tF);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;

    float pop = popCurve(iTime);
    float spin = spinCurve(iTime);

    // Pure passthrough when idle
    if (pop < 0.001) {
        fragColor = texture(iChannel0, uv);
        return;
    }

    vec4 col = texture(iChannel0, uv);

    // Window centre and half-size in UV
    vec2 winCenter = (WIN_UV0 + WIN_UV1) * 0.5;
    vec2 winHalf   = (WIN_UV1 - WIN_UV0) * 0.5;

    // Black out the window slot (exact window rectangle)
    bool inSlot = all(greaterThanEqual(uv, WIN_UV0)) && all(lessThanEqual(uv, WIN_UV1));
    if (inSlot) col.rgb *= 1.0 - pop;

    // Convert window geometry to NDC (aspect-corrected, Y-flipped)
    vec2 centerNDC = (winCenter - 0.5) * 2.0 * vec2(aspect, -1.0);
    vec2 halfNDC   = winHalf * vec2(aspect, 1.0);

    // Cube half-size: starts matching window, grows with pop
    // Use full window rectangle (not forced square) — cube depth = shorter side
    float scale = 1.0 + pop * (SCALE_MAX - 1.0);
    float depth = min(halfNDC.x, halfNDC.y);
    vec3 boxHalfSize = vec3(halfNDC * scale, depth * scale);

    // Camera
    float camDist = 2.2;
    vec2 ndc = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    vec3 ro = vec3(0.0, 0.0, -camDist);
    vec3 rd = normalize(vec3(ndc, camDist));

    // Cube position: pops toward camera
    vec3 boxPos = vec3(centerNDC, -pop * POP_DEPTH);

    // Ray in rotated box space
    mat3 rot = rotY(spin);
    vec3 lro = rot * (ro - boxPos);
    vec3 lrd = rot * rd;

    vec3 n;
    vec2 t = boxHit(lro, lrd, boxHalfSize, n);

    if (t.x > 0.0) {
        vec3 hp = lro + lrd * t.x;

        if (abs(n.z) > 0.5) {
            // Front/back face — draw TUI window
            vec2 fuv = hp.xy / boxHalfSize.xy * 0.5 + 0.5;
            fuv.y = 1.0 - fuv.y;
            vec3 borderCol = (n.z < 0.0) ? MAUVE : BLUE;  // front=mauve, back=blue
            col = vec4(drawWindow(fuv, borderCol, TEXT), 1.0);
        } else if (abs(n.x) > 0.5) {
            // Left/right side
            vec2 fuv = hp.zy / boxHalfSize.zy * 0.5 + 0.5;
            fuv.y = 1.0 - fuv.y;
            col = vec4(drawWindow(fuv, SURFACE2, TEXT), 1.0);
        } else {
            // Top/bottom — solid surface
            col = vec4(SURFACE0, 1.0);
        }

        // Simple directional lighting
        float light = max(dot(n, normalize(vec3(0.3, 0.5, -0.8))), 0.3);
        col.rgb *= light;
    }

    fragColor = col;
}
