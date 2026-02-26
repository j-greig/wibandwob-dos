# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v10: GLITCH STAMPEDE
200 BPM breakcore energy. D minor. Amen-break DNA.
Chopped drums that stutter and reverse. Gabber bass stabs.
Bitcrushed to absolute destruction (depth 2-3).
Builds from fractured intro to wall of noise to sudden silence + resolve.
The crow is being chased. The machine is gaining.
"""
import sys, os, random
import numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-bricks/scripts")
from bricks import osc, fx, theory, canvas, patterns, pipeline

SR = 22050
DUR = 28.0
BPM = 200

c = canvas.make(DUR)

# ── SECTION 1 (0-9s): FRACTURED — sparse, glitchy, broken ──

# Amen-style break but with dropout
break1 = patterns.drums_from_string(
    "K..K.S..K..K.S..",
    9.0, bpm=BPM, crush=3,
    drop_fn=lambda i, p: random.Random(i).random() < 0.3  # 30% dropout
)
c = canvas.place(c, break1, 0.0, vol=0.2)

# Staccato bass stabs — D2, single hits
for t in [0.0, 1.2, 2.8, 4.5, 6.0, 7.8]:
    stab = osc.square(theory.note_freq("D2"), 0.08, duty=0.7)
    stab = fx.bitcrush(stab, depth=3)
    stab = fx.env(stab, a=0.001, d=0.03, s=0.2, r=0.04)
    c = canvas.place(c, stab, t, vol=0.3)

# Glitch texture — tiny reversed noise grains
random.seed(99)
for _ in range(15):
    t = random.uniform(0.5, 8.5)
    grain = osc.noise(random.uniform(0.02, 0.06))
    grain = grain[::-1]  # reverse
    grain = fx.bitcrush(grain, depth=2)
    grain = fx.env(grain, a=0.001, d=0.02, s=0.0, r=0.01)
    c = canvas.place(c, grain, t, vol=0.15)

# ── SECTION 2 (9-20s): STAMPEDE — full throttle ──

# Double-time break — relentless
break2 = patterns.drums_from_string(
    "KSKSKSKS|HHHHHHHH",
    11.0, bpm=BPM, crush=2
)
c = canvas.place(c, break2, 9.0, vol=0.22)

# Gabber bass — sustained, distorted, moving
bass_notes = ["D1", "F1", "A1", "D1", "C1", "D1"]
beat_s = 60.0 / BPM
for i, note in enumerate(bass_notes):
    t = 9.0 + i * 1.8
    dur = 1.6
    bass = osc.sawtooth(theory.note_freq(note), dur)
    bass = fx.lowpass(bass, 200)
    bass = fx.bitcrush(bass, depth=3)
    bass = fx.env(bass, a=0.01, d=0.2, s=0.7, r=0.3)
    c = canvas.place(c, bass, t, vol=0.25)

# Screaming arp — D minor, frantic, crushed to hell
scream_notes = ["D5", "F5", "A5", "D6", "A5", "F5"]
scream = patterns.arp(
    scream_notes, 11.0, bpm=BPM * 2,
    wave_fn=osc.sawtooth, note_frac=0.6,
    crush=3, vol=0.07
)
c = canvas.place(c, scream, 9.0)

# Rising noise wall — builds over entire section
wall_dur = 10.0
wall = osc.noise(wall_dur)
# Progressive filter opening
n = len(wall)
for seg_i in range(10):
    start = int(seg_i * n / 10)
    end = int((seg_i + 1) * n / 10)
    cutoff = 200 + seg_i * 300  # 200 -> 3200 Hz
    seg = wall[start:end]
    if len(seg) > 20:
        seg = fx.lowpass(seg, cutoff)
    wall[start:end] = seg[:end-start]
wall = fx.bitcrush(wall, depth=2)
wall = fx.env(wall, a=3.0, d=1.0, s=0.8, r=0.5)
c = canvas.place(c, wall, 9.5, vol=0.1)

# ── SECTION 3 (20-28s): SILENCE THEN RESOLVE ──

# Hard stop at 20s — 1.5s of nothing. The machine locks on.

# Single menacing tone at 21.5s
lock = osc.square(theory.note_freq("D3"), 0.8, duty=0.5)
lock = fx.bitcrush(lock, depth=4)
lock = fx.env(lock, a=0.001, d=0.2, s=0.4, r=0.4)
lock = fx.reverb(lock, decay=0.3, delay_ms=100)
c = canvas.place(c, lock, 21.5, vol=0.2)

# Sparse clicks — targeting
for t in [22.5, 23.0, 23.3, 23.5, 23.65, 23.75, 23.82, 23.87, 23.91]:
    click = osc.noise(0.01)
    click = fx.highpass(click, 5000)
    click = fx.env(click, a=0.001, d=0.007, s=0.0, r=0.002)
    c = canvas.place(c, click, t, vol=0.3)

# Final resolve — clean D4, the aftermath
resolve = patterns.resolve(
    "D4", dur=3.5, start_t=24.0,
    wave_fn=osc.triangle, vol=0.18,
    reverb_decay=0.2, total_dur=DUR
)
c = canvas.place(c, resolve, 0.0)

# ── MIX ──
c = canvas.normalize(c, peak_db=-2.0)
c = fx.fade_in(c, 0.1)
c = fx.fade_out(c, 2.0)

out_dir = os.path.dirname(os.path.abspath(__file__))
pipeline.render(c, "10-glitch-stampede", out_dir, fade_in_s=0, fade_out_s=0, peak_db=-2.0)
