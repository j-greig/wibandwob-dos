# WibMux Ideas Backlog

## Stretch Goals

### Shader automation via WibMux CLI

Ghostty supports custom GLSL shaders (`custom-shader` config key) that run in the
GPU compositor over the terminal output. We already have:
- 11+ shaders from the shader-music autoresearch (`autoresearch/shader-music/`)
- A shader hot-swap recipe: `sed` rewrite config → `perform action "reload_config"`
- Audio-reactive shader discussion: https://github.com/ghostty-org/ghostty/discussions/10201

**v1:** `wibmux shader <name>` — swap Ghostty shader by name, reload config instantly.
No restart, no flicker. Agents can set the visual mood from CLI.
Existing prior art: `/Users/james/Repos/wibandwob-dos/scripts/ghostty-shader.sh`
(already does on/off/status/list — but uses fragile Cmd+Shift+, keystroke hack
for config reload. WibMux replaces that with `perform action "reload_config"`).

**v2:** `wibmux shader --reactive` — activate audio-reactive shader mode. Combine with
chiptune-studio SFX pipeline for live visual scoring.

**v3:** WibWob-DOS TUI command `ghostty.shader --name <shader>` — control Ghostty's
visual layer from inside the desktop. The TUI controls its own container's appearance.
Meta as fuck.

### Shader integration with cinema pipeline

The cinema pipeline (`wibwobdos-cinema` skill) currently captures via `/screenshot/ansi`
which only gets the blessed text layer. If we had shader control via WibMux, a show
script could:
1. Set shader per scene (`wibmux shader cathedral` for death scene)
2. Capture via macOS `screencapture` (gets shader + text composited)
3. Mix with SFX audio as before

This would produce videos where the Ghostty shader is part of the visual design,
not just a background effect.

### TUI shader picker

A WibWob-DOS microapp that lists available shaders, previews them (by swapping live),
and lets you pick one. Like the theme switcher but for the GPU layer.
