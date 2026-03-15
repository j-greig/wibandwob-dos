# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts", "moderngl"]
# ///
"""
GLSL Shader → Chiptune Synthesizer

Runs a starfield shader headlessly on the GPU. Reads back pixel data
at beat rate. Maps pixel brightness per layer to musical parameters.
Synthesizes a 4-track chiptune piece via the bricks toolkit.

Architecture:
  GLSL shader (4 layers → RGBA channels)
    ↓ render to 16x16 texture at each beat step
    ↓ reduce each channel to single brightness value
    ↓
  Python maps brightness → pitch, volume, waveform, FX
    ↓
  bricks toolkit synthesizes audio per track
    ↓
  Mix down to stereo WAV
"""

import sys, os, time, json
import numpy as np

REPO_ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, os.path.join(REPO_ROOT, ".pi/skills/chiptune-studio/scripts"))

from bricks import *

# ── Configuration ──────────────────────────────────────────────
BPM = 110
DURATION_SECS = 16        # total piece length
STEPS_PER_BEAT = 2        # shader samples per beat
TEX_SIZE = 16             # render texture dimensions
SHADER_PATH = os.path.join(os.path.dirname(__file__), "starfield-superlite.glsl")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "output.wav")

# Musical scales — rotate through chord changes over time
# Each scale covers 2+ octaves for wide pitch variety
CHORD_SCALES = [
    ["C3", "E3", "G3", "B3", "C4", "E4", "G4", "B4", "C5"],      # Cmaj7
    ["A2", "C3", "E3", "A3", "C4", "E4", "A4", "C5", "E5"],      # Am
    ["F2", "A2", "C3", "F3", "A3", "C4", "F4", "A4", "C5"],      # F
    ["G2", "B2", "D3", "G3", "B3", "D4", "G4", "B4", "D5"],      # G
]
BARS_PER_CHORD = 2  # each chord lasts 2 bars

# Track configs: waveform, octave offset, volume range
# Wider volume ranges for more dynamic contrast
TRACK_CONFIG = [
    {"wave": square,    "octave": 0,  "vol": (0.05, 0.6),  "duty": 0.5,  "name": "lead"},
    {"wave": triangle,  "octave": -1, "vol": (0.03, 0.45),  "duty": None, "name": "harmony"},
    {"wave": sawtooth,  "octave": -2, "vol": (0.05, 0.4),   "duty": None, "name": "bass"},
    {"wave": noise,     "octave": 0,  "vol": (0.0, 0.2),   "duty": None, "name": "perc"},
]


def load_shader_source(path):
    """Load GLSL and wrap in moderngl-compatible fragment shader."""
    with open(path) as f:
        glsl = f.read()

    # Convert Shadertoy conventions to moderngl
    return """
    #version 330
    uniform vec2 iResolution;
    uniform float iTime;
    out vec4 fragColor;

    """ + glsl.replace("void mainImage(out vec4 fragColor, in vec2 fragCoord)",
                        "void mainImage_inner(out vec4 fc, in vec2 fragCoord)") + """

    void main() {
        vec4 fc;
        mainImage_inner(fc, gl_FragCoord.xy);
        fragColor = fc;
    }
    """


def render_shader_frame(ctx, prog, fbo, vao, t):
    """Render one frame at time t, return RGBA pixel array."""
    prog['iTime'].value = t
    fbo.use()
    vao.render()
    raw = fbo.read(components=4)
    pixels = np.frombuffer(raw, dtype=np.uint8).reshape(TEX_SIZE, TEX_SIZE, 4)
    return pixels


def extract_track_values(pixels):
    """Reduce 16x16 RGBA texture to 4 track control values (0-1).
    
    Each track reads a different spatial region crossed with a different 
    channel combination, then applies a unique transfer curve.
    """
    h, w = pixels.shape[:2]
    half_h, half_w = h // 2, w // 2
    fp = pixels.astype(np.float64) / 255.0
    
    # Track 0 (lead): top-left R + bottom-right G — diagonal cross
    v0 = (np.mean(fp[:half_h, :half_w, 0]) + np.mean(fp[half_h:, half_w:, 1])) / 2.0
    
    # Track 1 (harmony): top-right B + bottom-left R — other diagonal  
    v1 = (np.mean(fp[:half_h, half_w:, 2]) + np.mean(fp[half_h:, :half_w, 0])) / 2.0
    
    # Track 2 (bass): left half G + right half B — vertical split
    v2 = (np.mean(fp[:, :half_w, 1]) + np.mean(fp[:, half_w:, 2])) / 2.0
    
    # Track 3 (perc): top R + bottom G — horizontal split
    v3 = (np.mean(fp[:half_h, :, 0]) + np.mean(fp[half_h:, :, 1])) / 2.0
    
    # Different transfer curves for further decorrelation
    v0 = v0 ** 0.7                              # lead: boost low values
    v1 = 3.0 * v1**2 - 2.0 * v1**3             # harmony: S-curve
    v2 = np.clip((v2 - 0.03) * 1.8, 0.0, 1.0)  # bass: threshold + amplify
    v3 = v3 ** 1.4                               # perc: compress dynamics
    
    return [float(v0), float(v1), float(v2), float(v3)]


def get_scale_for_step(step, step_dur):
    """Get the current chord's scale based on time position."""
    beats_per_bar = 4
    beat_dur = 60.0 / BPM
    bar_dur = beats_per_bar * beat_dur
    chord_dur = BARS_PER_CHORD * bar_dur
    t = step * step_dur
    chord_idx = int(t / chord_dur) % len(CHORD_SCALES)
    return CHORD_SCALES[chord_idx]


def brightness_to_note(brightness, scale_notes):
    """Map 0-1 brightness to a note from the scale."""
    idx = int(brightness * (len(scale_notes) - 1))
    idx = max(0, min(idx, len(scale_notes) - 1))
    return scale_notes[idx]


def synthesize_step(track_idx, brightness, step_dur, step_num):
    """Synthesize one step of audio for a track based on shader brightness."""
    cfg = TRACK_CONFIG[track_idx]
    vol_min, vol_max = cfg["vol"]
    volume = vol_min + brightness * (vol_max - vol_min)

    # Below threshold = silence
    if brightness < 0.05:
        return silence(step_dur) * 0.0

    current_scale = get_scale_for_step(step_num, step_dur)

    if cfg["name"] == "perc":
        # Noise track — brightness controls volume and filter
        snd = noise(step_dur)
        snd = env(snd, a=0.001, d=step_dur * 0.3, s=0.0, r=step_dur * 0.2)
        cutoff = 800 + brightness * 4000
        snd = lowpass(snd, cutoff)
        return snd * volume
    else:
        note_name = brightness_to_note(brightness, current_scale)
        freq = note_freq(note_name)

        # Apply octave offset
        if cfg["octave"] != 0:
            freq *= 2.0 ** cfg["octave"]

        # Generate waveform
        wave_fn = cfg["wave"]
        if cfg["duty"] is not None and wave_fn == square:
            # Duty cycle varies with brightness
            duty = 0.3 + brightness * 0.4
            snd = wave_fn(freq, step_dur, duty=duty)
        else:
            snd = wave_fn(freq, step_dur)

        # Shape with envelope
        snd = env(snd, a=0.01, d=step_dur * 0.4, s=0.6, r=step_dur * 0.3)

        # Light bitcrush on lead for character
        if cfg["name"] == "lead":
            snd = bitcrush(snd, depth=6)
        elif cfg["name"] == "bass":
            snd = lowpass(snd, 600)

        return snd * volume


def run_shader_to_music():
    """Main pipeline: shader → pixel readback → chiptune synthesis."""
    import moderngl

    print(f"[shader-music] Loading shader: {SHADER_PATH}")
    frag_src = load_shader_source(SHADER_PATH)

    # Headless GL context
    ctx = moderngl.create_standalone_context()

    prog = ctx.program(
        vertex_shader="""
        #version 330
        in vec2 in_vert;
        void main() { gl_Position = vec4(in_vert, 0.0, 1.0); }
        """,
        fragment_shader=frag_src,
    )

    prog['iResolution'].value = (float(TEX_SIZE), float(TEX_SIZE))

    # Fullscreen quad
    verts = np.array([-1, -1, 1, -1, -1, 1, 1, 1], dtype='f4')
    vbo = ctx.buffer(verts)
    vao = ctx.vertex_array(prog, [(vbo, '2f', 'in_vert')])

    # Framebuffer
    tex = ctx.texture((TEX_SIZE, TEX_SIZE), 4)
    fbo = ctx.framebuffer(color_attachments=[tex])

    # Calculate timing
    beat_dur = 60.0 / BPM
    step_dur = beat_dur / STEPS_PER_BEAT
    total_steps = int(DURATION_SECS / step_dur)

    print(f"[shader-music] BPM={BPM}, steps={total_steps}, step_dur={step_dur:.3f}s")
    print(f"[shader-music] Duration={DURATION_SECS}s, tracks=4")

    # Collect shader data — each track samples at a different time offset
    # This fundamentally decorrelates the tracks since they see different
    # moments of the starfield evolution
    TRACK_TIME_OFFSETS = [0.0, 3.7, 7.3, 11.1]  # prime-ish offsets
    all_track_values = []  # [step][track] = brightness
    shader_times = []

    t0 = time.time()
    for step in range(total_steps):
        base_t = step * step_dur
        shader_times.append(base_t)
        
        track_vals = []
        for track_idx in range(4):
            t = base_t + TRACK_TIME_OFFSETS[track_idx]
            pixels = render_shader_frame(ctx, prog, fbo, vao, t)
            # Extract just this track's value from the full extraction
            all_vals = extract_track_values(pixels)
            track_vals.append(all_vals[track_idx])
        
        all_track_values.append(track_vals)

    gpu_time = time.time() - t0
    print(f"[shader-music] GPU render: {gpu_time:.3f}s ({total_steps * 4} frames, 4 time offsets)")

    # Log track values for analysis
    log_data = {
        "bpm": BPM,
        "duration": DURATION_SECS,
        "steps": total_steps,
        "gpu_render_time": round(gpu_time, 4),
        "track_brightness": {
            cfg["name"]: [round(all_track_values[s][i], 4) for s in range(total_steps)]
            for i, cfg in enumerate(TRACK_CONFIG)
        }
    }

    log_path = os.path.join(os.path.dirname(__file__), "shader_data.json")
    with open(log_path, 'w') as f:
        json.dump(log_data, f, indent=2)
    print(f"[shader-music] Shader data saved: {log_path}")

    # Synthesize audio
    t0 = time.time()
    track_canvases = []

    for track_idx in range(4):
        cfg = TRACK_CONFIG[track_idx]
        print(f"[shader-music] Synthesizing track {track_idx}: {cfg['name']}")

        track_audio = make(DURATION_SECS)
        for step in range(total_steps):
            brightness = all_track_values[step][track_idx]
            step_audio = synthesize_step(track_idx, brightness, step_dur, step)

            offset_secs = step * step_dur
            track_audio = place(track_audio, step_audio, offset_secs)

        track_canvases.append(track_audio)

    # Apply structural dynamics per track — staggered entrances, macro swell
    print("[shader-music] Applying structural dynamics...")
    sr = 22050
    n_samples = len(track_canvases[0])
    
    # Track entrance offsets (in seconds) — staggered for build-up
    entrance_times = [0.0, 1.5, 0.5, 2.0]  # bass enters early, perc last
    
    for i, tc in enumerate(track_canvases):
        # Fade in at track entrance
        entrance_sample = int(entrance_times[i] * sr)
        fade_len = int(1.0 * sr)  # 1 second fade in
        if entrance_sample > 0:
            tc[:entrance_sample] *= 0.0
        end = min(entrance_sample + fade_len, n_samples)
        actual_fade = end - entrance_sample
        if actual_fade > 0:
            tc[entrance_sample:end] *= np.linspace(0, 1, actual_fade)
        
        # Macro swell: gentle sine-wave volume modulation (different period per track)
        periods = [5.3, 7.1, 4.7, 3.3]  # seconds per swell cycle
        t = np.linspace(0, DURATION_SECS, n_samples)
        swell = 0.6 + 0.4 * np.sin(2 * np.pi * t / periods[i])
        tc *= swell

    # Mix all tracks
    print("[shader-music] Mixing tracks...")
    mixed = make(DURATION_SECS)
    for tc in track_canvases:
        mixed = mixed + tc

    mixed = normalize(mixed)

    # Gentle fade in/out
    mixed[:int(0.2 * sr)] *= np.linspace(0, 1, int(0.2 * sr))
    mixed[-int(0.5 * sr):] *= np.linspace(1, 0, int(0.5 * sr))

    synth_time = time.time() - t0
    print(f"[shader-music] Synthesis: {synth_time:.3f}s")

    save_wav(mixed, OUTPUT_PATH)
    print(f"[shader-music] Output: {OUTPUT_PATH}")

    # Summary stats
    total_time = gpu_time + synth_time
    print(f"\n[shader-music] === RESULTS ===")
    print(f"  GPU render:  {gpu_time:.3f}s")
    print(f"  Synthesis:   {synth_time:.3f}s")
    print(f"  Total:       {total_time:.3f}s")
    print(f"  Output:      {OUTPUT_PATH}")
    print(f"  Duration:    {DURATION_SECS}s")
    print(f"  Tracks:      4 (lead, harmony, bass, perc)")

    # Print brightness summary per track
    print(f"\n[shader-music] Track brightness ranges:")
    for i, cfg in enumerate(TRACK_CONFIG):
        vals = [all_track_values[s][i] for s in range(total_steps)]
        print(f"  {cfg['name']:>8}: min={min(vals):.4f}  max={max(vals):.4f}  avg={np.mean(vals):.4f}")

    return total_time


if __name__ == "__main__":
    run_shader_to_music()
