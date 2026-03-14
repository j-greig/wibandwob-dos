// cursor_smooth_transition.glsl
// Smooth cursor transition shader — animates position and size over time
// Uses an ease-out cubic for a snappy but smooth feel

// --- Dependencies: keep these from your existing file ---
float getSdfRectangle(in vec2 p, in vec2 xy, in vec2 b) {
    vec2 d = abs(p - xy) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec2 norm(vec2 value, float isPosition) {
    return (value * 2.0 - (iResolution.xy * isPosition)) / iResolution.y;
}

float antialising(float distance) {
    return 1. - smoothstep(0., norm(vec2(2., 2.), 0.).x, distance);
}

vec4 saturate(vec4 color, float factor) {
    float gray = dot(color, vec4(0.299, 0.587, 0.114, 0.));
    return mix(vec4(gray), color, factor);
}

// --- Parameters ---
const float OPACITY = 1;
const float DURATION = 0.2; // seconds, adjust to taste

// --- Snappy ease-out cubic ---
float easeOut(float x) {
    return 1.0 - pow(1.0 - x, 3.0);
}

// --- Main shader ---
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec4 baseColor = texture(iChannel0, fragCoord / iResolution.xy);
    vec2 uv = norm(fragCoord, 1.);

    // Normalize cursor positions
    vec4 current = vec4(norm(iCurrentCursor.xy, 1.), norm(iCurrentCursor.zw, 0.));
    vec4 previous = vec4(norm(iPreviousCursor.xy, 1.), norm(iPreviousCursor.zw, 0.));

    // Progress of the transition
    float t = clamp((iTime - iTimeCursorChange) / DURATION, 0.0, 1.0);
    float eased = easeOut(t);

    // Interpolate position and size
    vec2 pos = mix(previous.xy, current.xy, eased);
    vec2 size = mix(previous.zw, current.zw, eased);

    // Compute SDF for cursor rectangle
    vec2 offsetFactor = vec2(-0.5, 0.5);
    float sdf = getSdfRectangle(uv, pos - (size * offsetFactor), size * 0.5);

    // Prepare color
    vec4 cursorColor = saturate(iCurrentCursorColor, 2.5);
    vec4 blended = mix(baseColor, cursorColor, antialising(sdf));

    // Mix cursor opacity into base
    fragColor = mix(baseColor, blended, OPACITY);
}
