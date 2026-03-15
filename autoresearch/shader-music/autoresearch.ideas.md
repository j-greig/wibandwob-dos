# Shader-Music Ideas

## High Priority
- **Seed the RNG**: pass a fixed seed uniform to shaders so results are deterministic across runs. Currently ghostty shaders vary because time offsets hit different animation phases.
- **Audio dynamics fix**: the persistent weak metric. Try: dramatic mid-piece dropout (kill 2 tracks for 2 bars, bring back), longer fade-in (3-4s), or explicit "breakdown" section driven by shader uniform.
- **8-track version**: render to 32x1 texture instead of 16x16, use 8 channels (split RGBA across two time samples). More tracks = more compositional depth.

## Shader Ideas
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

## Architecture
- **Real-time mode**: render shader + synth in real-time, play as stream. Need ~10ms latency budget.
- **Feedback loop**: FFT the output audio, feed spectral centroid/energy back as shader uniforms. Song reacts to itself.
- **Visual score output**: render the shader to a video file synced with the audio — see what the music "looks like"
- **MIDI export**: emit MIDI from the brightness values so you can load in a DAW and use real VSTs
