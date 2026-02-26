# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v9: CONCRETE LULLABY
Slow. 75 BPM. Bb minor. A lullaby sung by machines to other machines.
Pad drones that swell and recede. Mechanical clicks as percussion —
not drum hits, RELAY CLICKS. Solenoids. Circuit breakers.
One lonely melody line, very high, very thin, very crushed.
The tenderness of surveillance equipment left running overnight.
"""
import sys, os
import numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-bricks/scripts")
from bricks import osc, fx, theory, canvas, patterns, pipeline

SR = 22050
DUR = 28.0
BPM = 75

c = canvas.make(DUR)

# ── PAD DRONE — Bb minor, two voices breathing ──
pad = patterns.drone(
    "Bb2", DUR, wave_fn=osc.sawtooth,
    second_note="Db3", blend=0.55,
    cutoff=250, crush=6,
    trem_rate=0.07, trem_depth=0.5,
    vol=0.18, fade=(4.0, 5.0)
)
c = canvas.place(c, pad, 0.0)

# Second pad — 5th above, thinner, delayed entry
pad2 = patterns.drone(
    "F3", DUR - 4, wave_fn=osc.triangle,
    second_note=None, blend=0.5,
    cutoff=400, crush=7,
    trem_rate=0.12, trem_depth=0.3,
    vol=0.08, fade=(3.0, 4.0)
)
c = canvas.place(c, pad2, 4.0)

# ── RELAY CLICKS — mechanical, irregular, organic ──
# Not quantised to grid — deliberately wobbly timing
import random
random.seed(77)
click_times = sorted([random.uniform(0.5, 26.5) for _ in range(35)])
for t in click_times:
    # Alternate between two click types
    if random.random() > 0.5:
        # Sharp relay click
        click = osc.noise(0.008)
        click = fx.highpass(click, 4000)
        click = fx.env(click, a=0.001, d=0.005, s=0.0, r=0.002)
        vol = random.uniform(0.15, 0.3)
    else:
        # Softer solenoid thunk
        click = osc.square(theory.note_freq("Bb6"), 0.012, duty=0.2)
        click = fx.env(click, a=0.001, d=0.008, s=0.0, r=0.003)
        vol = random.uniform(0.08, 0.15)
    c = canvas.place(c, click, t, vol=vol)

# ── LONELY MELODY — high, thin, single notes with space ──
# Bb minor: Bb Db Eb F Gb Ab
melody_score = [
    (2.0, "Bb5"), (3.5, "Db6"), (5.5, "F5"),
    (9.0, "Eb6"), (11.0, "Db6"), (13.5, "Bb5"),
    (16.0, "Ab5"), (18.5, "Gb5"), (20.0, "F5"),
    (23.0, "Db6"), (25.5, "Bb5"),
]
for t, note in melody_score:
    tone = osc.square(theory.note_freq(note), 1.2, duty=0.15)
    tone = fx.bitcrush(tone, depth=5)
    tone = fx.env(tone, a=0.05, d=0.3, s=0.3, r=0.6)
    tone = fx.reverb(tone, decay=0.25, delay_ms=120)
    c = canvas.place(c, tone, t, vol=0.07)

# ── GHOST — octave-down echo of melody, barely there ──
ghost = patterns.ghost_echo(
    ["Bb4", "Db5", "F4", "Eb5", "Db5", "Bb4", "Ab4", "Gb4", "F4", "Db5", "Bb4"],
    DUR, bpm=BPM,
    octave_shift=-1, time_offset=0.5,
    wave_fn=osc.sine, crush=7, vol=0.03, sparsity=2
)
c = canvas.place(c, ghost, 2.0)

# ── SUB — barely perceptible weight ──
sub = patterns.sub_rumble("Bb0", DUR, trem_rate=0.04, trem_depth=0.5, vol=0.06)
c = canvas.place(c, sub, 0.0)

# ── NOISE BREATH — machine exhaling ──
breaths = patterns.noise_breath(
    DUR, n_breaths=4, dur_range=(1.5, 3.0),
    cutoff=500, vol=0.03, seed=42
)
c = canvas.place(c, breaths, 0.0)

# ── MIX ──
c = canvas.normalize(c, peak_db=-3.0)
c = fx.fade_in(c, 1.5)
c = fx.fade_out(c, 3.5)

out_dir = os.path.dirname(os.path.abspath(__file__))
pipeline.render(c, "09-concrete-lullaby", out_dir, fade_in_s=0, fade_out_s=0, peak_db=-3.0)
