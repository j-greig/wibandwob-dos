# Autoresearch Ideas — Shader Music Viz

## Done
- P0: `make-overlay.py` — wraps any GLSL as Ghostty terminal overlay with luminance blend
- P0: `--all` generates 12 music shader overlays + 39 ghostty-shader overlays
- P0: 4 blend modes (luminance, additive, multiply, screen)
- P0: `play-shot.sh` — lookup manifest, activate overlay, play WAV, deactivate
- P0: `play-shot.sh --list` shows all 29 shots with genre + shader info

## Live Ideas

### P1 — shader-music.play command
- Register in command-catalog.ts as `shader-music.play { shot: "cathedral" }`
- Fuzzy matching on shot ID, genre, or shader name
- Auto-generate overlay if missing
- Cleanup on window close / app exit

### P2 — Timeline shader cues
- Add `shader?: string` to CuePatch in timeline-types.ts
- In executeCue: if patch.shader, spawn `ghostty-shader.sh on <name>`
- Fire shader cue 300ms before desired visual beat (reload latency)
- `shader: "off"` to deactivate mid-show

### P3 — DJ set generator
- Concatenate WAVs with ffmpeg crossfades
- Record cumulative timestamps
- Auto-generate timeline JSON from manifest.jsonl
- Genre-aware crossfade lengths (ambient=long, breakcore=short)

### P4 — Desktop choreography per genre
- Cathedral: dark theme, single large primer (gothic ASCII), slow figlet
- Breakcore: hot theme, 4 chaotic tiled windows, rapid figlet cycling
- Space Jazz: nord theme, hero-center primer (stars), gentle sway
- Witch House: inverted theme, one dim primer, barely visible text

### Polish
- Benchmark overlay blend readability (text legibility through shader)
- Per-genre blend mode selection (witch house=multiply, cathedral=luminance)
- CRT + music overlay stacking (two custom-shader lines)
- Scope `--all` to music shaders only (skip community ghostty-shaders)
