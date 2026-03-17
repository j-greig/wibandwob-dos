// WibWob-DOS Nord Tint shader for Ghostty
// Applies a cool blue-tinted color grade matching the Nord palette,
// with very subtle bloom. Pairs with wibwob-dark-nord theme.

const float TINT_STRENGTH = 0.08;   // how much nord blue to mix in
const float CONTRAST      = 1.05;   // slight contrast bump
const float SATURATION    = 0.95;   // slightly desaturated for that icy feel

// Nord Polar Night blue: #2E3440 → normalized
const vec3 NORD_TINT = vec3(0.18, 0.204, 0.251);
// Nord Frost accent: #88C0D0
const vec3 NORD_FROST = vec3(0.533, 0.753, 0.816);

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    vec3 col = texture(iChannel0, uv).rgb;

    // Luminance for desaturation
    float lum = dot(col, vec3(0.299, 0.587, 0.114));

    // Desaturate slightly
    col = mix(vec3(lum), col, SATURATION);

    // Tint towards nord blue (more in darks, less in highlights)
    float shadow = 1.0 - smoothstep(0.0, 0.5, lum);
    col = mix(col, NORD_TINT, TINT_STRENGTH * shadow);

    // Subtle frost tint on bright text
    float highlight = smoothstep(0.6, 1.0, lum);
    col = mix(col, NORD_FROST, 0.03 * highlight);

    // Contrast
    col = (col - 0.5) * CONTRAST + 0.5;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
