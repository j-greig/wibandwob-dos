// ASCII Shader Overlay for Ghostty
// Ported from BouncingElf10/ASCII-Shader (Minecraft shader pack)
// Adapted: single-pass, reads terminal texture from iChannel0,
// renders ASCII bitmap characters based on luminance.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Block size in pixels — each ASCII "character" is an 8x8 block
    float blockPx = 8.0;
    vec2 pixelSize = blockPx / iResolution.xy;

    // Block origin (top-left of the 8x8 cell)
    vec2 blockCoords = floor(uv / pixelSize) * pixelSize;

    // Average luminance of the 8x8 block from terminal texture
    float luminanceSum = 0.0;
    for (int x = 0; x < 8; x++) {
        for (int y = 0; y < 8; y++) {
            vec2 offset = vec2(float(x), float(y)) * pixelSize / 8.0;
            vec3 col = texture(iChannel0, blockCoords + offset).rgb;
            luminanceSum += dot(col, vec3(0.299, 0.587, 0.114));
        }
    }
    float avgLum = luminanceSum / 64.0;

    // Sobel edge detection on luminance for directional characters
    float samples[9];
    vec2 texelSize = 1.0 / iResolution.xy;
    int idx = 0;
    for (int dy = 1; dy >= -1; dy--) {
        for (int dx = -1; dx <= 1; dx++) {
            vec2 sc = blockCoords + vec2(float(dx), float(dy)) * pixelSize;
            float ls = 0.0;
            for (int bx = 0; bx < 4; bx++) {
                for (int by = 0; by < 4; by++) {
                    vec2 off = vec2(float(bx), float(by)) * pixelSize / 4.0;
                    ls += dot(texture(iChannel0, sc + off).rgb, vec3(0.299, 0.587, 0.114));
                }
            }
            samples[idx] = ls / 16.0;
            idx++;
        }
    }

    float gx = -samples[0] + samples[2] - 2.0*samples[3] + 2.0*samples[5] - samples[6] + samples[8];
    float gy = -samples[0] - 2.0*samples[1] - samples[2] + samples[6] + 2.0*samples[7] + samples[8];
    float magnitude = length(vec2(gx, gy));
    float angle = atan(gy, gx);
    if (angle < 0.0) angle += 6.2831853;

    // Bitmap font patterns (5-bit wide, 8 rows) — from BouncingElf10
    // Pattern selection: edges get directional chars, flat areas get density chars
    int pattern[8];

    if (magnitude > 0.08) {
        // Directional edge characters
        float na = mod(angle, 6.2831853);
        if (na < 0.3927 || na > 5.8905) {
            // | vertical
            pattern[0]=0x20; pattern[1]=0x20; pattern[2]=0x20; pattern[3]=0x20;
            pattern[4]=0x20; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (na < 1.1781) {
            // / diagonal
            pattern[0]=0x80; pattern[1]=0x40; pattern[2]=0x20; pattern[3]=0x10;
            pattern[4]=0x08; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (na < 1.9635) {
            // - horizontal
            pattern[0]=0x00; pattern[1]=0x00; pattern[2]=0xF8; pattern[3]=0x00;
            pattern[4]=0x00; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (na < 2.7489) {
            // \ diagonal
            pattern[0]=0x08; pattern[1]=0x10; pattern[2]=0x20; pattern[3]=0x40;
            pattern[4]=0x80; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (na < 3.5343) {
            pattern[0]=0x20; pattern[1]=0x20; pattern[2]=0x20; pattern[3]=0x20;
            pattern[4]=0x20; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (na < 4.3197) {
            pattern[0]=0x80; pattern[1]=0x40; pattern[2]=0x20; pattern[3]=0x10;
            pattern[4]=0x08; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (na < 5.1051) {
            pattern[0]=0x00; pattern[1]=0x00; pattern[2]=0xF8; pattern[3]=0x00;
            pattern[4]=0x00; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else {
            pattern[0]=0x08; pattern[1]=0x10; pattern[2]=0x20; pattern[3]=0x40;
            pattern[4]=0x80; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        }
    } else {
        // Density-based ASCII characters
        if (avgLum > 0.9) {
            // █ full block
            pattern[0]=0xF8; pattern[1]=0xF8; pattern[2]=0xF8; pattern[3]=0xF8;
            pattern[4]=0xF8; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.8) {
            // @
            pattern[0]=0x70; pattern[1]=0x90; pattern[2]=0x60; pattern[3]=0xB8;
            pattern[4]=0x88; pattern[5]=0x70; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.7) {
            // #
            pattern[0]=0x50; pattern[1]=0xF8; pattern[2]=0x50; pattern[3]=0xF8;
            pattern[4]=0x50; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.6) {
            // O
            pattern[0]=0xF0; pattern[1]=0x90; pattern[2]=0x90; pattern[3]=0x90;
            pattern[4]=0xF0; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.5) {
            // P
            pattern[0]=0x80; pattern[1]=0x80; pattern[2]=0xF0; pattern[3]=0x90;
            pattern[4]=0xF0; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.4) {
            // o
            pattern[0]=0x70; pattern[1]=0x50; pattern[2]=0x70; pattern[3]=0x00;
            pattern[4]=0x00; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.3) {
            // c
            pattern[0]=0x70; pattern[1]=0x40; pattern[2]=0x70; pattern[3]=0x00;
            pattern[4]=0x00; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.2) {
            // i
            pattern[0]=0x20; pattern[1]=0x20; pattern[2]=0x00; pattern[3]=0x20;
            pattern[4]=0x00; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else if (avgLum > 0.1) {
            // .
            pattern[0]=0x20; pattern[1]=0x00; pattern[2]=0x00; pattern[3]=0x00;
            pattern[4]=0x00; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        } else {
            // empty
            pattern[0]=0x00; pattern[1]=0x00; pattern[2]=0x00; pattern[3]=0x00;
            pattern[4]=0x00; pattern[5]=0x00; pattern[6]=0x00; pattern[7]=0x00;
        }
    }

    // Position within the 8x8 block
    vec2 blockPos = mod(uv / pixelSize, vec2(1.0));
    ivec2 px = ivec2(floor(blockPos * 8.0));

    // Check bitmap: is this pixel "lit" in the character pattern?
    bool lit = (pattern[px.y] & (1 << (7 - px.x))) != 0;

    // Kill very dark areas
    if (avgLum < 0.05) lit = false;

    // Color: use the original terminal color tinted by luminance
    vec3 termColor = texture(iChannel0, blockCoords + vec2(0.5) * pixelSize).rgb;

    if (lit) {
        // Blend between green tint and original terminal color
        vec3 asciiColor = mix(vec3(0.0, 0.9, 0.3), termColor, 0.6);
        asciiColor *= (0.5 + 0.5 * avgLum); // luminance modulation
        fragColor = vec4(asciiColor, 1.0);
    } else {
        // Dark background — mostly transparent to show a dim terminal
        vec3 bg = termColor * 0.05;
        fragColor = vec4(bg, 1.0);
    }
}
