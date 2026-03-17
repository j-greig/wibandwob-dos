// OBVIOUS TEST SHADER — red border + green tint + heavy scanlines
// If you can't see this, Ghostty isn't loading the shader at all.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = texture(iChannel0, uv).rgb;

    // Heavy green tint
    col.g += 0.15;
    col.r *= 0.8;
    col.b *= 0.8;

    // Fat scanlines
    float scan = step(0.5, fract(fragCoord.y / 4.0));
    col *= 0.7 + 0.3 * scan;

    // Red border (20px)
    float border = 20.0;
    if (fragCoord.x < border || fragCoord.x > iResolution.x - border ||
        fragCoord.y < border || fragCoord.y > iResolution.y - border) {
        col = vec3(1.0, 0.0, 0.0);
    }

    fragColor = vec4(col, 1.0);
}
