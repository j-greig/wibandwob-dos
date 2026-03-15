# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts", "moderngl"]
# ///
"""
GLSL Shader → Chiptune Synthesizer — Multi-genre engine

Runs a shader headlessly on the GPU, reads back pixel data at beat rate,
maps brightness to musical parameters via genre-specific synth functions.
"""

import sys, os, time, json
import numpy as np

REPO_ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, os.path.join(REPO_ROOT, ".pi/skills/chiptune-studio/scripts"))

from bricks import *

# ── Genre Selection ────────────────────────────────────────────
# Change GENRE to switch shader + synth combo
GENRE = os.environ.get("GENRE", "starfield")

GENRE_CONFIGS = {
    "starfield": {
        "shader": "starfield-superlite.glsl",
        "bpm": 110,
        "duration": 16,
        "steps_per_beat": 2,
        "tracks": [
            {"name": "lead",    "vol": (0.05, 0.6)},
            {"name": "harmony", "vol": (0.03, 0.45)},
            {"name": "bass",    "vol": (0.05, 0.4)},
            {"name": "perc",    "vol": (0.0,  0.2)},
        ],
        "time_offsets": [0.0, 3.7, 7.3, 11.1],
        "entrance_times": [0.0, 1.5, 0.5, 2.0],
        "swell_periods": [5.3, 7.1, 4.7, 3.3],
    },
    "lofi_hiphop": {
        "shader": "ghostty-shaders/cineShader-Lava.glsl",
        "bpm": 78,
        "duration": 20,
        "steps_per_beat": 2,
        "tracks": [
            {"name": "bass",    "vol": (0.08, 0.45)},
            {"name": "keys",    "vol": (0.05, 0.35)},
            {"name": "crackle", "vol": (0.0,  0.12)},
            {"name": "pad",     "vol": (0.04, 0.28)},
        ],
        "time_offsets": [0.0, 5.3, 9.7, 14.1],
        "entrance_times": [0.0, 1.0, 2.0, 0.0],
        "swell_periods": [8.0, 5.5, 3.2, 11.0],
    },
    "synthwave": {
        "shader": "ghostty-shaders/galaxy.glsl",
        "bpm": 118,
        "duration": 20,
        "steps_per_beat": 2,
        "tracks": [
            {"name": "arp",     "vol": (0.05, 0.40)},
            {"name": "bass",    "vol": (0.08, 0.50)},
            {"name": "snare",   "vol": (0.0,  0.18)},
            {"name": "pad",     "vol": (0.04, 0.30)},
        ],
        "time_offsets": [0.0, 4.7, 8.3, 12.9],
        "entrance_times": [1.5, 0.0, 2.5, 0.5],
        "swell_periods": [7.3, 5.1, 4.0, 10.0],
    },
    "dnb": {
        "shader": "ghostty-shaders/sin-interference.glsl",
        "bpm": 170,
        "duration": 18,
        "steps_per_beat": 2,
        "tracks": [
            {"name": "reese",   "vol": (0.10, 0.55)},
            {"name": "stab",    "vol": (0.05, 0.40)},
            {"name": "break",   "vol": (0.0,  0.20)},
            {"name": "atmo",    "vol": (0.03, 0.25)},
        ],
        "time_offsets": [0.0, 3.9, 7.7, 11.3],
        "entrance_times": [0.5, 2.0, 1.0, 0.0],
        "swell_periods": [6.0, 4.3, 3.0, 9.5],
    },
    "ambient": {
        "shader": "ghostty-shaders/underwater.glsl",
        "bpm": 60,
        "duration": 24,
        "steps_per_beat": 1,
        "tracks": [
            {"name": "drone",   "vol": (0.05, 0.35)},
            {"name": "bell",    "vol": (0.03, 0.25)},
            {"name": "breath",  "vol": (0.0,  0.15)},
            {"name": "shimmer", "vol": (0.02, 0.20)},
        ],
        "time_offsets": [0.0, 6.1, 12.7, 18.3],
        "entrance_times": [0.0, 3.0, 5.0, 1.5],
        "swell_periods": [12.0, 8.3, 6.1, 15.0],
    },
    "italo": {
        "shader": "ghostty-shaders/fireworks.glsl",
        "bpm": 124,
        "duration": 20,
        "steps_per_beat": 2,
        "tracks": [
            {"name": "disco_bass", "vol": (0.08, 0.50)},
            {"name": "chorus_pad", "vol": (0.05, 0.35)},
            {"name": "clap",       "vol": (0.0,  0.16)},
            {"name": "lead",       "vol": (0.04, 0.38)},
        ],
        "time_offsets": [0.0, 4.3, 8.9, 13.1],
        "entrance_times": [0.0, 0.5, 1.5, 2.5],
        "swell_periods": [7.0, 5.7, 3.5, 9.3],
    },
}

TEX_SIZE = 16
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "output.wav")

# ── Scales per genre ──────────────────────────────────────────
LOFI_SCALES = [
    ["Eb3", "F3", "G3", "Bb3", "C4", "Eb4", "F4", "G4"],       # Ebmaj pent
    ["C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4", "F4"],       # Cm7
    ["Ab2", "Bb2", "C3", "Eb3", "F3", "Ab3", "Bb3", "C4"],     # Ab
    ["Bb2", "D3", "F3", "Ab3", "Bb3", "D4", "F4"],              # Bb7
]
STARFIELD_CHORDS = [
    ["C3", "E3", "G3", "B3", "C4", "E4", "G4", "B4", "C5"],
    ["A2", "C3", "E3", "A3", "C4", "E4", "A4", "C5", "E5"],
    ["F2", "A2", "C3", "F3", "A3", "C4", "F4", "A4", "C5"],
    ["G2", "B2", "D3", "G3", "B3", "D4", "G4", "B4", "D5"],
]
SYNTHWAVE_SCALE = ["A2", "C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5"]
DNB_SCALE = ["E2", "G2", "A2", "B2", "D3", "E3", "G3", "A3", "B3", "D4", "E4"]
AMBIENT_SCALE = ["D2", "A2", "D3", "E3", "F#3", "A3", "D4", "E4", "F#4", "A4", "D5"]
ITALO_SCALE = ["F2", "G2", "A2", "C3", "D3", "F3", "G3", "A3", "C4", "D4", "F4", "A4"]

ITALO_CHORDS = [
    ["F3", "A3", "C4"],       # F
    ["Dm", "F3", "A3"],       # Dm (reuse notes)
    ["Bb2", "D3", "F3"],      # Bb
    ["C3", "E3", "G3"],       # C
]
# Fix the Dm chord
ITALO_CHORDS[1] = ["D3", "F3", "A3"]


def load_shader_source(path):
    with open(path) as f:
        glsl = f.read()
    
    # Handle various mainImage signatures (with/without spaces)
    import re
    glsl = re.sub(
        r'void\s+mainImage\s*\(\s*out\s+vec4\s+fragColor\s*,\s*in\s+vec2\s+fragCoord\s*\)',
        'void mainImage_inner(out vec4 fc, in vec2 fragCoord)',
        glsl
    )
    
    return """
    #version 330
    uniform vec2 iResolution;
    uniform float iTime;
    uniform sampler2D iChannel0;
    out vec4 fragColor;
    """ + glsl + """
    void main() {
        vec4 fc;
        mainImage_inner(fc, gl_FragCoord.xy);
        fragColor = fc;
    }
    """


def render_shader_frame(ctx, prog, fbo, vao, t):
    prog['iTime'].value = t
    fbo.use()
    vao.render()
    raw = fbo.read(components=4)
    return np.frombuffer(raw, dtype=np.uint8).reshape(TEX_SIZE, TEX_SIZE, 4)


def extract_track_values(pixels):
    h, w = pixels.shape[:2]
    half_h, half_w = h // 2, w // 2
    fp = pixels.astype(np.float64) / 255.0
    
    v0 = (np.mean(fp[:half_h, :half_w, 0]) + np.mean(fp[half_h:, half_w:, 1])) / 2.0
    v1 = (np.mean(fp[:half_h, half_w:, 1]) + np.mean(fp[half_h:, :half_w, 2])) / 2.0
    v2 = (np.mean(fp[:, :half_w, 2]) + np.mean(fp[:, half_w:, 0])) / 2.0
    v3 = np.mean(fp[:, :, 3])
    
    # Transfer curves: amplify weak channels, add contrast to strong ones
    v0 = np.clip(v0 * 2.0, 0.0, 1.0) ** 0.7       # lead: amplify + brighten
    v1 = np.clip(v1 * 1.8, 0.0, 1.0) ** 0.6       # harmony: amplify + brighten
    v2 = np.clip(v2 * 3.5, 0.0, 1.0)               # bass: strong amplify (weak signal)
    v3 = np.clip(v3 * 3.0, 0.0, 1.0) ** 0.8        # perc: strong amplify + slight brighten
    
    return [float(v0), float(v1), float(v2), float(v3)]


def brightness_to_note(brightness, scale_notes):
    idx = int(brightness * (len(scale_notes) - 1))
    return scale_notes[max(0, min(idx, len(scale_notes) - 1))]


# ── Genre-specific synth functions ─────────────────────────────

def synth_lofi(track_name, brightness, step_dur, step_num, bpm):
    """Lo-fi hip hop: warm, dusty, jazzy."""
    beat_dur = 60.0 / bpm
    bar_dur = 4 * beat_dur
    chord_idx = int((step_num * step_dur) / (2 * bar_dur)) % len(LOFI_SCALES)
    scale = LOFI_SCALES[chord_idx]
    
    if track_name == "bass":
        note = brightness_to_note(brightness, scale[:4])  # lower half
        freq = note_freq(note) * 0.5  # octave down
        snd = triangle(freq, step_dur)
        snd = env(snd, a=0.02, d=step_dur*0.5, s=0.4, r=step_dur*0.3)
        snd = lowpass(snd, 400)
        return snd
    
    elif track_name == "keys":
        # Rhodes-like: sine + slight overtone
        note = brightness_to_note(brightness, scale)
        freq = note_freq(note)
        snd = sine(freq, step_dur) * 0.7 + sine(freq * 2.01, step_dur) * 0.2 + sine(freq * 3.0, step_dur) * 0.1
        snd = env(snd, a=0.005, d=step_dur*0.6, s=0.2, r=step_dur*0.3)
        snd = tremolo(snd, rate=4.5, depth=0.15)
        return snd
    
    elif track_name == "crackle":
        # Vinyl crackle — short filtered noise bursts
        snd = noise(step_dur)
        snd = env(snd, a=0.001, d=0.02, s=0.0, r=0.01)
        snd = highpass(snd, 3000)
        snd = bitcrush(snd, depth=4)
        return snd
    
    elif track_name == "pad":
        note = brightness_to_note(brightness, scale[2:])  # upper range
        freq = note_freq(note)
        a = triangle(freq, step_dur)
        b = triangle(freq * 1.003, step_dur)
        snd = (a + b) * 0.5
        snd = env(snd, a=0.1, d=step_dur*0.3, s=0.7, r=step_dur*0.4)
        snd = lowpass(snd, 1200 + brightness * 800)
        snd = reverb(snd, decay=0.4)
        return snd
    
    return silence(step_dur)


def synth_synthwave(track_name, brightness, step_dur, step_num, bpm):
    """Synthwave: arps, warm bass, gated pads."""
    if track_name == "arp":
        note = brightness_to_note(brightness, SYNTHWAVE_SCALE[4:])  # upper
        freq = note_freq(note)
        snd = sawtooth(freq, step_dur)
        snd = env(snd, a=0.003, d=step_dur*0.4, s=0.3, r=step_dur*0.3)
        snd = lowpass(snd, 2000 + brightness * 3000)
        snd = delay(snd, delay_ms=int(60000/bpm/2), feedback=0.3, repeats=2)
        return snd
    
    elif track_name == "bass":
        note = brightness_to_note(brightness, SYNTHWAVE_SCALE[:5])
        freq = note_freq(note) * 0.5
        snd = sawtooth(freq, step_dur) * 0.6 + square(freq, step_dur, duty=0.3) * 0.4
        snd = env(snd, a=0.01, d=step_dur*0.5, s=0.5, r=step_dur*0.3)
        snd = lowpass(snd, 500)
        return snd
    
    elif track_name == "snare":
        snd = noise(step_dur)
        snd = env(snd, a=0.001, d=step_dur*0.2, s=0.0, r=step_dur*0.1)
        snd = highpass(snd, 1000)
        snd = reverb(snd, decay=0.25)
        return snd
    
    elif track_name == "pad":
        note = brightness_to_note(brightness, SYNTHWAVE_SCALE[3:8])
        freq = note_freq(note)
        snd = sawtooth(freq, step_dur) * 0.5 + sawtooth(freq*1.006, step_dur) * 0.5
        snd = env(snd, a=0.08, d=step_dur*0.3, s=0.8, r=step_dur*0.5)
        snd = lowpass(snd, 800 + brightness * 1500)
        return snd
    
    return silence(step_dur)


def synth_dnb(track_name, brightness, step_dur, step_num, bpm):
    """Drum & Bass: reese bass, stabs, breakbeats."""
    if track_name == "reese":
        note = brightness_to_note(brightness, DNB_SCALE[:5])
        freq = note_freq(note) * 0.5
        snd = reese(freq, step_dur, detune=0.01)
        snd = env(snd, a=0.01, d=step_dur*0.6, s=0.4, r=step_dur*0.2)
        snd = lowpass(snd, 300 + brightness * 1500)
        snd = bitcrush(snd, depth=6)
        return snd
    
    elif track_name == "stab":
        note = brightness_to_note(brightness, DNB_SCALE[4:])
        freq = note_freq(note)
        snd = square(freq, step_dur, duty=0.4) * 0.5 + sawtooth(freq*1.01, step_dur) * 0.5
        snd = env(snd, a=0.002, d=step_dur*0.2, s=0.1, r=step_dur*0.2)
        snd = highpass(snd, 500)
        return snd
    
    elif track_name == "break":
        snd = noise(step_dur)
        snd = env(snd, a=0.001, d=step_dur*0.15, s=0.0, r=step_dur*0.1)
        # Alternate between hat and snare character
        if brightness > 0.5:
            snd = highpass(snd, 5000)
        else:
            snd = highpass(snd, 800)
            snd = lowpass(snd, 4000)
        return snd
    
    elif track_name == "atmo":
        note = brightness_to_note(brightness, DNB_SCALE[5:])
        freq = note_freq(note)
        snd = sine(freq, step_dur) * 0.6 + triangle(freq*2.01, step_dur) * 0.4
        snd = env(snd, a=0.05, d=step_dur*0.4, s=0.6, r=step_dur*0.4)
        snd = reverb(snd, decay=0.5)
        return snd
    
    return silence(step_dur)


def synth_ambient(track_name, brightness, step_dur, step_num, bpm):
    """Ambient: drones, bells, breath, shimmer."""
    if track_name == "drone":
        note = brightness_to_note(brightness, AMBIENT_SCALE[:5])
        freq = note_freq(note) * 0.5
        snd = sine(freq, step_dur) * 0.5 + triangle(freq*1.002, step_dur) * 0.3 + sine(freq*2, step_dur) * 0.2
        snd = env(snd, a=0.15, d=step_dur*0.3, s=0.8, r=step_dur*0.5)
        snd = lowpass(snd, 600 + brightness * 400)
        return snd
    
    elif track_name == "bell":
        note = brightness_to_note(brightness, AMBIENT_SCALE[5:])
        freq = note_freq(note)
        # FM bell: carrier + modulator
        t = np.linspace(0, step_dur, int(22050*step_dur), endpoint=False)
        mod = np.sin(2*np.pi*freq*3.01*t) * freq * 2 * brightness
        snd = np.sin(2*np.pi*freq*t + mod)
        snd = env(snd, a=0.001, d=step_dur*0.7, s=0.05, r=step_dur*0.3)
        snd = reverb(snd, decay=0.6)
        return snd
    
    elif track_name == "breath":
        snd = noise(step_dur)
        snd = env(snd, a=0.1, d=step_dur*0.3, s=0.3, r=step_dur*0.5)
        snd = lowpass(snd, 500 + brightness * 1500)
        return snd
    
    elif track_name == "shimmer":
        note = brightness_to_note(brightness, AMBIENT_SCALE[6:])
        freq = note_freq(note)
        snd = sine(freq, step_dur) * 0.4 + sine(freq*2.003, step_dur) * 0.3 + sine(freq*3.007, step_dur) * 0.3
        snd = env(snd, a=0.08, d=step_dur*0.4, s=0.5, r=step_dur*0.5)
        snd = tremolo(snd, rate=2.0, depth=0.3)
        snd = reverb(snd, decay=0.5)
        return snd
    
    return silence(step_dur)


def synth_italo(track_name, brightness, step_dur, step_num, bpm):
    """Italo Disco: bouncy bass, chorus pads, claps, bright lead."""
    beat_dur = 60.0 / bpm
    bar_dur = 4 * beat_dur
    chord_idx = int((step_num * step_dur) / (2 * bar_dur)) % len(ITALO_CHORDS)
    
    if track_name == "disco_bass":
        note = brightness_to_note(brightness, ITALO_SCALE[:5])
        freq = note_freq(note) * 0.5
        # Bouncy octave bass
        snd = square(freq, step_dur, duty=0.3)
        if brightness > 0.6:
            snd = snd * 0.5 + square(freq*2, step_dur, duty=0.3) * 0.5
        snd = env(snd, a=0.003, d=step_dur*0.4, s=0.2, r=step_dur*0.2)
        snd = lowpass(snd, 600)
        return snd
    
    elif track_name == "chorus_pad":
        chord = ITALO_CHORDS[chord_idx]
        snd = silence(step_dur)
        for cn in chord:
            freq = note_freq(cn)
            a = sawtooth(freq, step_dur)
            b = sawtooth(freq*1.008, step_dur)
            snd = snd + (a + b) * 0.15
        snd = env(snd, a=0.06, d=step_dur*0.3, s=0.7, r=step_dur*0.4)
        snd = lowpass(snd, 2000 + brightness * 2000)
        return snd
    
    elif track_name == "clap":
        snd = noise(step_dur)
        snd = env(snd, a=0.001, d=0.04, s=0.0, r=0.03)
        snd = highpass(snd, 1500)
        snd = reverb(snd, decay=0.2)
        return snd
    
    elif track_name == "lead":
        note = brightness_to_note(brightness, ITALO_SCALE[5:])
        freq = note_freq(note)
        duty = 0.3 + brightness * 0.4
        snd = square(freq, step_dur, duty=duty)
        snd = env(snd, a=0.005, d=step_dur*0.35, s=0.35, r=step_dur*0.3)
        snd = delay(snd, delay_ms=int(60000/bpm/2), feedback=0.3, repeats=2)
        snd = bitcrush(snd, depth=7)
        return snd
    
    return silence(step_dur)


def synth_starfield(track_name, brightness, step_dur, step_num, bpm):
    """Original starfield chiptune: square lead, triangle harmony, saw bass, noise perc."""
    beat_dur = 60.0 / bpm
    bar_dur = 4 * beat_dur
    chord_idx = int((step_num * step_dur) / (2 * bar_dur)) % len(STARFIELD_CHORDS)
    scale = STARFIELD_CHORDS[chord_idx]

    if track_name == "lead":
        note = brightness_to_note(brightness, scale)
        freq = note_freq(note)
        duty = 0.3 + brightness * 0.4
        snd = square(freq, step_dur, duty=duty)
        snd = env(snd, a=0.005, d=step_dur*0.3, s=0.4, r=step_dur*0.4)
        snd = bitcrush(snd, depth=6)
        return snd
    elif track_name == "harmony":
        note = brightness_to_note(brightness, scale)
        freq = note_freq(note) * 0.5
        snd = triangle(freq, step_dur)
        snd = env(snd, a=0.05, d=step_dur*0.5, s=0.7, r=step_dur*0.3)
        return snd
    elif track_name == "bass":
        note = brightness_to_note(brightness, scale[:4])
        freq = note_freq(note) * 0.25
        snd = sawtooth(freq, step_dur)
        snd = env(snd, a=0.01, d=step_dur*0.6, s=0.5, r=step_dur*0.2)
        snd = lowpass(snd, 600)
        return snd
    elif track_name == "perc":
        snd = noise(step_dur)
        snd = env(snd, a=0.001, d=step_dur*0.3, s=0.0, r=step_dur*0.2)
        cutoff = 800 + brightness * 4000
        snd = lowpass(snd, cutoff)
        return snd
    return silence(step_dur)


SYNTH_DISPATCH = {
    "starfield": synth_starfield,
    "lofi_hiphop": synth_lofi,
    "synthwave": synth_synthwave,
    "dnb": synth_dnb,
    "ambient": synth_ambient,
    "italo": synth_italo,
}


def synthesize_step(track_idx, brightness, step_dur, step_num, genre_cfg):
    cfg = genre_cfg["tracks"][track_idx]
    vol_min, vol_max = cfg["vol"]
    volume = vol_min + brightness * (vol_max - vol_min)
    
    if brightness < 0.05:
        return silence(step_dur) * 0.0
    
    synth_fn = SYNTH_DISPATCH[GENRE]
    snd = synth_fn(cfg["name"], brightness, step_dur, step_num, genre_cfg["bpm"])
    return snd * volume


def run_shader_to_music():
    import moderngl

    genre_cfg = GENRE_CONFIGS[GENRE]
    shader_path = os.path.join(SCRIPT_DIR, genre_cfg["shader"])
    bpm = genre_cfg["bpm"]
    duration = genre_cfg["duration"]
    steps_per_beat = genre_cfg["steps_per_beat"]

    print(f"[shader-music] Genre: {GENRE}")
    print(f"[shader-music] Loading shader: {shader_path}")
    frag_src = load_shader_source(shader_path)

    ctx = moderngl.create_standalone_context()
    prog = ctx.program(
        vertex_shader="#version 330\nin vec2 in_vert;\nvoid main(){gl_Position=vec4(in_vert,0,1);}",
        fragment_shader=frag_src,
    )
    prog['iResolution'].value = (float(TEX_SIZE), float(TEX_SIZE))

    verts = np.array([-1,-1,1,-1,-1,1,1,1], dtype='f4')
    vbo = ctx.buffer(verts)
    vao = ctx.vertex_array(prog, [(vbo, '2f', 'in_vert')])
    tex = ctx.texture((TEX_SIZE, TEX_SIZE), 4)
    fbo = ctx.framebuffer(color_attachments=[tex])
    
    # Dummy black texture for iChannel0 (ghostty shaders expect terminal content)
    dummy_tex = ctx.texture((TEX_SIZE, TEX_SIZE), 4, data=bytes(TEX_SIZE*TEX_SIZE*4))
    dummy_tex.use(0)
    try:
        prog['iChannel0'].value = 0
    except KeyError:
        pass  # shader doesn't use iChannel0

    beat_dur = 60.0 / bpm
    step_dur = beat_dur / steps_per_beat
    total_steps = int(duration / step_dur)

    print(f"[shader-music] BPM={bpm}, steps={total_steps}, step_dur={step_dur:.3f}s")
    print(f"[shader-music] Duration={duration}s, tracks=4")

    time_offsets = genre_cfg["time_offsets"]
    all_track_values = []
    
    # Check for cached shader data — reuse if shader hasn't changed
    cache_path = os.path.join(SCRIPT_DIR, "shader_cache.json")
    cache_key = f"{GENRE}:{genre_cfg['shader']}:{bpm}:{duration}:{steps_per_beat}:{time_offsets}"
    cached = None
    if os.path.exists(cache_path):
        try:
            with open(cache_path) as f:
                cached = json.load(f)
            if cached.get("cache_key") == cache_key:
                all_track_values = cached["track_values"]
                print(f"[shader-music] Using cached shader data ({len(all_track_values)} steps)")
        except:
            cached = None
    
    if not all_track_values:
        t0 = time.time()
        for step in range(total_steps):
            base_t = step * step_dur
            track_vals = []
            for track_idx in range(4):
                t = base_t + time_offsets[track_idx]
                pixels = render_shader_frame(ctx, prog, fbo, vao, t)
                all_vals = extract_track_values(pixels)
                track_vals.append(all_vals[track_idx])
            all_track_values.append(track_vals)

        gpu_time = time.time() - t0
        print(f"[shader-music] GPU render: {gpu_time:.3f}s ({total_steps*4} frames)")
        
        # Cache for reuse
        with open(cache_path, 'w') as f:
            json.dump({"cache_key": cache_key, "track_values": all_track_values}, f)
        print(f"[shader-music] Cached shader data for reuse")
    else:
        gpu_time = 0.0

    # Log
    log_data = {
        "bpm": bpm, "duration": duration, "steps": total_steps,
        "genre": GENRE, "shader": genre_cfg["shader"],
        "gpu_render_time": round(gpu_time, 4),
        "track_brightness": {
            genre_cfg["tracks"][i]["name"]: [round(all_track_values[s][i], 4) for s in range(total_steps)]
            for i in range(4)
        }
    }
    with open(os.path.join(SCRIPT_DIR, "shader_data.json"), 'w') as f:
        json.dump(log_data, f, indent=2)

    # Synthesize
    t0 = time.time()
    sr = 22050
    track_canvases = []

    for track_idx in range(4):
        name = genre_cfg["tracks"][track_idx]["name"]
        print(f"[shader-music] Synthesizing track {track_idx}: {name}")
        track_audio = make(duration)
        for step in range(total_steps):
            brightness = all_track_values[step][track_idx]
            step_audio = synthesize_step(track_idx, brightness, step_dur, step, genre_cfg)
            track_audio = place(track_audio, step_audio, step * step_dur)
        track_canvases.append(track_audio)

    # Structural dynamics
    print("[shader-music] Applying structural dynamics...")
    n_samples = len(track_canvases[0])
    entrance_times = genre_cfg["entrance_times"]
    swell_periods = genre_cfg["swell_periods"]

    for i, tc in enumerate(track_canvases):
        ent = int(entrance_times[i] * sr)
        fade_len = int(1.5 * sr)
        if ent > 0:
            tc[:ent] *= 0.0
        end = min(ent + fade_len, n_samples)
        if end - ent > 0:
            tc[ent:end] *= np.linspace(0, 1, end - ent)
        t_arr = np.linspace(0, duration, n_samples)
        swell = 0.4 + 0.6 * np.sin(2 * np.pi * t_arr / swell_periods[i])
        tc *= np.clip(swell, 0.0, 1.0)

    # Mix
    print("[shader-music] Mixing...")
    mixed = make(duration)
    for tc in track_canvases:
        mixed = mixed + tc
    mixed = normalize(mixed)
    mixed[:int(0.3*sr)] *= np.linspace(0, 1, int(0.3*sr))
    mixed[-int(0.8*sr):] *= np.linspace(1, 0, int(0.8*sr))

    synth_time = time.time() - t0
    save_wav(mixed, OUTPUT_PATH)

    # Save to shots directory with genre name + append manifest
    shots_dir = os.path.join(SCRIPT_DIR, "shots")
    shot_idx = len([f for f in os.listdir(shots_dir) if f.endswith('.wav')]) + 1
    shot_name = f"{shot_idx:03d}-{GENRE}.wav"
    shot_path = os.path.join(shots_dir, shot_name)
    save_wav(mixed, shot_path)
    print(f"[shader-music] Archived: {shot_path}")

    # Append to manifest
    manifest_entry = {
        "id": f"{shot_idx:03d}", "file": shot_name,
        "shader": genre_cfg["shader"], "genre": GENRE,
        "bpm": bpm, "dur": duration, "spb": steps_per_beat, "tex": TEX_SIZE,
        "time_offsets": time_offsets,
        "entrances": genre_cfg["entrance_times"],
        "swells": genre_cfg["swell_periods"],
        "tracks": [{"name": t["name"], "vol": list(t["vol"])} for t in genre_cfg["tracks"]],
    }
    manifest_path = os.path.join(shots_dir, "manifest.jsonl")
    with open(manifest_path, 'a') as f:
        f.write(json.dumps(manifest_entry) + '\n')
    print(f"[shader-music] Manifest appended: {manifest_path}")

    total_time = gpu_time + synth_time
    print(f"\n[shader-music] === RESULTS ===")
    print(f"  Genre:       {GENRE}")
    print(f"  Shader:      {genre_cfg['shader']}")
    print(f"  GPU render:  {gpu_time:.3f}s")
    print(f"  Synthesis:   {synth_time:.3f}s")
    print(f"  Total:       {total_time:.3f}s")
    print(f"  Duration:    {duration}s")

    for i in range(4):
        name = genre_cfg["tracks"][i]["name"]
        vals = [all_track_values[s][i] for s in range(total_steps)]
        print(f"  {name:>12}: min={min(vals):.4f}  max={max(vals):.4f}  avg={np.mean(vals):.4f}")

    return total_time


if __name__ == "__main__":
    run_shader_to_music()
