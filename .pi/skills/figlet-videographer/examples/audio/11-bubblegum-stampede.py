# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v11: BUBBLEGUM STAMPEDE
90% glitch stampede, 10% bubblegum shrapnel.
Base: 10-glitch-stampede verbatim structure (200 BPM, D minor, breakcore arc).
Sprinkled: short music-box phrases that poke through the chaos then vanish.
Like finding a toy piano in a demolition site.
"""
import sys, os, random
import numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-bricks/scripts")
from bricks import osc, fx, theory, canvas, patterns, pipeline

SR = 22050
DUR = 28.0
BPM = 200

c = canvas.make(DUR)

# ═══════════════════════════════════════════════════════
# SECTION 1 (0-9s): FRACTURED — from glitch stampede
# ═══════════════════════════════════════════════════════

break1 = patterns.drums_from_string(
    "K..K.S..K..K.S..",
    9.0, bpm=BPM, crush=3,
    drop_fn=lambda i, p: random.Random(i).random() < 0.3
)
c = canvas.place(c, break1, 0.0, vol=0.2)

for t in [0.0, 1.2, 2.8, 4.5, 6.0, 7.8]:
    stab = osc.square(theory.note_freq("D2"), 0.08, duty=0.7)
    stab = fx.bitcrush(stab, depth=3)
    stab = fx.env(stab, a=0.001, d=0.03, s=0.2, r=0.04)
    c = canvas.place(c, stab, t, vol=0.3)

random.seed(99)
for _ in range(15):
    t = random.uniform(0.5, 8.5)
    grain = osc.noise(random.uniform(0.02, 0.06))
    grain = grain[::-1]
    grain = fx.bitcrush(grain, depth=2)
    grain = fx.env(grain, a=0.001, d=0.02, s=0.0, r=0.01)
    c = canvas.place(c, grain, t, vol=0.15)

# ★ BUBBLEGUM SPRINKLE 1: music box peeks through at 3s
# Just 4 notes, D minor pent, then gone
box_notes = ["D5", "F5", "A5", "C6"]
box_peek1 = patterns.arp(
    box_notes, 0.8, bpm=int(BPM * 1.5),
    wave_fn=osc.triangle, note_frac=0.4,
    crush=5, vol=0.09
)
c = canvas.place(c, box_peek1, 3.0)

# ═══════════════════════════════════════════════════════
# SECTION 2 (9-20s): STAMPEDE — from glitch stampede
# ═══════════════════════════════════════════════════════

break2 = patterns.drums_from_string(
    "KSKSKSKS|HHHHHHHH",
    11.0, bpm=BPM, crush=2
)
c = canvas.place(c, break2, 9.0, vol=0.22)

bass_notes = ["D1", "F1", "A1", "D1", "Bb1", "D1"]
for i, note in enumerate(bass_notes):
    t = 9.0 + i * 1.8
    if t > 19.5:
        break
    bass = osc.sawtooth(theory.note_freq(note), 1.6)
    bass = fx.lowpass(bass, 200)
    bass = fx.bitcrush(bass, depth=3)
    bass = fx.env(bass, a=0.01, d=0.2, s=0.7, r=0.3)
    c = canvas.place(c, bass, t, vol=0.25)

scream_notes = ["D5", "F5", "A5", "D6", "A5", "F5"]
scream = patterns.arp(
    scream_notes, 11.0, bpm=BPM * 2,
    wave_fn=osc.sawtooth, note_frac=0.6,
    crush=3, vol=0.07
)
c = canvas.place(c, scream, 9.0)

# Rising noise wall
wall = osc.noise(10.0)
n = len(wall)
for seg_i in range(10):
    start = int(seg_i * n / 10)
    end = int((seg_i + 1) * n / 10)
    cutoff = 200 + seg_i * 300
    seg = wall[start:end]
    if len(seg) > 20:
        seg = fx.lowpass(seg, cutoff)
    wall[start:end] = seg[:end - start]
wall = fx.bitcrush(wall, depth=2)
wall = fx.env(wall, a=3.0, d=1.0, s=0.8, r=0.5)
c = canvas.place(c, wall, 9.5, vol=0.1)

# ★ BUBBLEGUM SPRINKLE 2: music box fights through the stampede
# Two short bursts — 12s and 16s — like a signal breaking through
box_full = ["D5", "F5", "A5", "C6", "D6", "C6", "A5", "F5"]
for burst_t in [12.0, 16.5]:
    burst = patterns.arp(
        box_full, 1.0, bpm=int(BPM * 1.5),
        wave_fn=osc.triangle, note_frac=0.35,
        crush=5, vol=0.07
    )
    c = canvas.place(c, burst, burst_t)

# ★ BUBBLEGUM SPRINKLE 3: single 808 sub drop with pitch bend at 14s
n_sub = int(0.6 * SR)
bend = np.linspace(1.0, 0.5, n_sub)
phase = 2 * np.pi * np.cumsum(theory.note_freq("D1") * bend) / SR
sub808 = np.sin(phase)
sub808 = fx.env(sub808, a=0.001, d=0.1, s=0.6, r=0.3)
c = canvas.place(c, sub808, 14.0, vol=0.25)

# ═══════════════════════════════════════════════════════
# SECTION 3 (20-28s): SILENCE + RESOLVE — from glitch stampede
# ═══════════════════════════════════════════════════════

# Lock tone
lock = osc.square(theory.note_freq("D3"), 0.8, duty=0.5)
lock = fx.bitcrush(lock, depth=4)
lock = fx.env(lock, a=0.001, d=0.2, s=0.4, r=0.4)
lock = fx.reverb(lock, decay=0.3, delay_ms=100)
c = canvas.place(c, lock, 21.5, vol=0.2)

# Targeting clicks
for t in [22.5, 23.0, 23.3, 23.5, 23.65, 23.75, 23.82, 23.87, 23.91]:
    click = osc.noise(0.01)
    click = fx.highpass(click, 5000)
    click = fx.env(click, a=0.001, d=0.007, s=0.0, r=0.002)
    c = canvas.place(c, click, t, vol=0.3)

# ★ BUBBLEGUM SPRINKLE 4: ghost of the music box in the silence
# 3 notes, very quiet, crushed harder — like a dying toy
ghost_notes = ["D6", "A5", "F5"]
ghost_box = patterns.arp(
    ghost_notes, 0.6, bpm=90,
    wave_fn=osc.triangle, note_frac=0.5,
    crush=4, vol=0.05
)
c = canvas.place(c, ghost_box, 20.5)

# Resolve — clean D4
resolve = patterns.resolve(
    "D4", dur=3.5, start_t=24.0,
    wave_fn=osc.triangle, vol=0.18,
    reverb_decay=0.2, total_dur=DUR
)
c = canvas.place(c, resolve, 0.0)

# ═══════════════════════════════════════════════════════
# MIX
# ═══════════════════════════════════════════════════════
c = canvas.normalize(c, peak_db=-2.0)
c = fx.fade_in(c, 0.1)
c = fx.fade_out(c, 2.0)

out_dir = os.path.dirname(os.path.abspath(__file__))
pipeline.render(c, "11-bubblegum-stampede", out_dir, fade_in_s=0, fade_out_s=0, peak_db=-2.0)
