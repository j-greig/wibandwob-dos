# Shader-Music Ideas

## The Plan (see ghostty-shader-music-viz/PLAN.md)

Full build plan exists with 5 phases, confirmed AppleScript API, and working
shader hot-swap recipe. Summary:

- **P0** `make-overlay.py` — wrap any music shader as Ghostty terminal overlay (blend viz with text)
- **P1** `shader-music.play` command — single shot playback (lookup manifest → activate shader → play WAV → cleanup)
- **P2** Shader cue type in timeline-service — `{ "at": {"t": 30}, "shader": "breakcore" }`
- **P3** DJ set timeline generator — concatenate WAVs with crossfades, auto-generate timeline JSON
- **P4** Desktop choreography — TUI windows react to genre (theme, layout, primer art per mood)

### Confirmed Infrastructure
- AppleScript `perform action "reload_config"` works on Ghostty 1.3+ (tested)
- Multi-shader pipelines supported (music-viz + CRT layered)
- Fuzzy shader name resolution pattern from community `shader.sh`
- 29 WAVs in `shots/` with manifest.jsonl linking each to source shader

## High Priority
- **Seed the RNG**: pass a fixed seed uniform to shaders so results are deterministic across runs. Currently ghostty shaders vary because time offsets hit different animation phases.
- **Audio dynamics fix**: the persistent weak metric. Try: dramatic mid-piece dropout (kill 2 tracks for 2 bars, bring back), longer fade-in (3-4s), or explicit "breakdown" section driven by shader uniform.
- **8-track version**: render to 32x1 texture instead of 16x16, use 8 channels (split RGBA across two time samples). More tracks = more compositional depth.
- **Terminal overlay wrapper template**: blend shader visuals with terminal text using luminance mask — text stays readable, dark areas show viz pattern.

## Shader → Genre Mappings
- **Ghostty gears-and-belts** → industrial/EBM genre (mechanical, repetitive)
- **Ghostty matrix-hallway** → cyberpunk/darksynth
- **Ghostty smoke-and-ghost** → witch house / dark ambient
- **Custom reaction-diffusion** shader → generative / process music (Eno-style)
- **Mandelbrot zoom** → progressive trance (slowly evolving, building)

## Genre Ideas
- **Chiptune covers**: use shader to modulate a known melody rather than generate from scratch
- **Breakcore**: very fast shader (high step rate), heavy bitcrush, chaotic
- **Dub techno**: heavy reverb/delay, minimal notes, lots of space
- **Vaporwave**: slowed-down samples, heavy chorus, detuned everything

## Desktop Choreography Per Genre
- **Cathedral:** dark theme, single large primer (gothic ASCII art), slow figlet fade
- **Breakcore:** hot theme, 4 small windows tiled chaotically, rapid figlet cycling
- **Space Jazz:** nord theme, hero-center primer (stars), gentle sway
- **Witch House:** inverted theme, one dim primer, text barely visible

## Architecture
- **Real-time mode**: render shader + synth in real-time, play as stream. Need ~10ms latency budget.
- **Feedback loop**: FFT the output audio, feed spectral centroid/energy back as shader uniforms. Song reacts to itself.
- **Visual score output**: render the shader to a video file synced with the audio — see what the music "looks like"
- **MIDI export**: emit MIDI from brightness values so you can load in a DAW and use real VSTs
- **iTime sync**: Ghostty's iTime counts from shader load, not audio start. Accept phase drift for now (generative patterns, not frame-locked). Future: external uniform injection if Ghostty adds custom uniform API.
- **Multi-shader layering**: stack music viz overlay + CRT filter + terminal text as a 3-layer pipeline

## Scoring & Quality
- Score music script (`score_music.py`) measures: pitch variety, rhythmic variety, dynamic range, track independence, silence usage
- Current scoring rubric may be too forgiving — same scores for different quality levels
- Consider A/B blind listening tests vs automated scoring
- Per-genre scoring profiles — breakcore should score high on chaos, cathedral on atmosphere
