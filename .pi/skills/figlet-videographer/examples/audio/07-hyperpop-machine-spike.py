# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v7: HYPERPOP MACHINE SPIKE
Hyperpop + industrial + kawaii-cute symbient energy.
Fast, bright, crushed, glitchy. Cute melodies over industrial percussion.
Spikes of noise. Machine rhythms. Sweet arps that bite.
"""
import sys, os, random
import numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-bricks/scripts")
from bricks import osc, fx, theory, canvas, patterns, pipeline

SR = 22050
DUR = 28.0  # enough for 3 frames + tail
BPM = 165   # hyperpop tempo — fast, urgent

c = canvas.make(DUR)

# ═══════════════════════════════════════════════════════
# LAYER 1: Industrial kick pattern — distorted, relentless
# ═══════════════════════════════════════════════════════
# Kick pattern: four-on-floor but glitchy — some ghost hits
kick_pattern = "K..kK..kK.KkK..K"
kicks = patterns.drums_from_string(kick_pattern, DUR, bpm=BPM, crush=3)
c = canvas.place(c, kicks, 0.0, vol=0.25)

# Hi-hat layer — rapid, metallic, hyperpop shimmer
hat_pattern = "hHhHhHhH|....H..H....H.HH"
hats = patterns.drums_from_string(hat_pattern, DUR, bpm=BPM, crush=4)
c = canvas.place(c, hats, 0.0, vol=0.12)

# Snare hits on 2 and 4, with fills
snare_pattern = "..S...S...S...S.|....S..S..S.SSSS"
snares = patterns.drums_from_string(snare_pattern, DUR, bpm=BPM, crush=3)
c = canvas.place(c, snares, 0.0, vol=0.18)

# ═══════════════════════════════════════════════════════
# LAYER 2: Kawaii melody arp — bright, detuned, crushed cute
# ═══════════════════════════════════════════════════════
# Ab major — sweet but unsettling at this tempo
kawaii_notes = ["Ab4", "C5", "Eb5", "F5", "Ab5", "F5", "Eb5", "C5"]
kawaii_arp = patterns.arp(
    kawaii_notes, DUR, bpm=BPM * 2,  # double-time = frantic cute
    wave_fn=osc.square, note_frac=0.5,
    crush=5, vol=0.1,
    skip_fn=lambda i: i % 8 == 7  # breath every 8th
)
c = canvas.place(c, kawaii_arp, 0.3)

# Ghost echo of the melody — pitched up, sparse, glitchy
ghost = patterns.ghost_echo(
    kawaii_notes, DUR, bpm=BPM * 2,
    octave_shift=1, time_offset=0.25,
    wave_fn=osc.sine, crush=4, vol=0.04, sparsity=3
)
c = canvas.place(c, ghost, 0.3)

# ═══════════════════════════════════════════════════════
# LAYER 3: Machine bass — reese, heavy, industrial
# ═══════════════════════════════════════════════════════
# Bass follows the stanza rhythm
# Frame 1 (0-8s): Ab1 — grounding
bass_f1 = osc.reese(theory.note_freq("Ab1"), 7.5, detune=0.012)
bass_f1 = fx.lowpass(bass_f1, 180)
bass_f1 = fx.bitcrush(bass_f1, depth=4)
bass_f1 = fx.env(bass_f1, a=0.5, d=1.0, s=0.7, r=1.5)
c = canvas.place(c, bass_f1, 0.5, vol=0.2)

# Frame 2 (8-15s): Eb1 — tension up a 5th
bass_f2 = osc.reese(theory.note_freq("Eb1"), 6.5, detune=0.015)
bass_f2 = fx.lowpass(bass_f2, 220)
bass_f2 = fx.bitcrush(bass_f2, depth=3)
bass_f2 = fx.env(bass_f2, a=0.3, d=0.5, s=0.8, r=1.5)
c = canvas.place(c, bass_f2, 8.0, vol=0.22)

# Frame 3 (15-22s): F1 — machine lock, rising
bass_f3 = osc.reese(theory.note_freq("F1"), 7.0, detune=0.02)
bass_f3 = fx.lowpass(bass_f3, 250)
bass_f3 = fx.bitcrush(bass_f3, depth=3)
bass_f3 = fx.env(bass_f3, a=0.2, d=0.5, s=0.9, r=2.0)
c = canvas.place(c, bass_f3, 15.0, vol=0.25)

# ═══════════════════════════════════════════════════════
# LAYER 4: Spike stingers — noise bursts at frame transitions
# ═══════════════════════════════════════════════════════
# Frame 1→2 transition spike
spike1 = osc.noise(0.15)
spike1 = fx.highpass(spike1, 2000)
spike1 = fx.bitcrush(spike1, depth=2)
spike1 = fx.env(spike1, a=0.001, d=0.05, s=0.3, r=0.1)
c = canvas.place(c, spike1, 7.5, vol=0.35)

# Frame 2→3 transition spike — bigger
spike2 = osc.noise(0.25)
spike2 = fx.highpass(spike2, 1500)
spike2 = fx.bitcrush(spike2, depth=2)
spike2 = fx.env(spike2, a=0.001, d=0.08, s=0.5, r=0.15)
c = canvas.place(c, spike2, 14.5, vol=0.4)

# Final spike — the machine sees targets
spike3 = osc.noise(0.4)
spike3 = fx.bitcrush(spike3, depth=2)
spike3 = fx.env(spike3, a=0.001, d=0.15, s=0.6, r=0.2)
c = canvas.place(c, spike3, 21.0, vol=0.45)

# ═══════════════════════════════════════════════════════
# LAYER 5: Sparkle texture — periodic shimmer, NOT word-synced
# ═══════════════════════════════════════════════════════
# Even spacing — decorative texture, independent of timeline
sparkle_notes_pool = ["Ab5", "C6", "Eb6", "F6", "Ab6"]
for i in range(7):
    t = 1.5 + i * 3.2  # every ~3.2s, no relation to words
    random.seed(i * 37)
    snotes = random.sample(sparkle_notes_pool, 3)
    sp = patterns.sparkle(
        snotes, t, dur=0.35,
        spacing=0.07, note_dur=0.07,
        wave_fn=osc.sine, crush=6,
        peak_vol=0.06, curve="bell"
    )
    c = canvas.place(c, sp, 0.0)

# ═══════════════════════════════════════════════════════
# LAYER 6: Sub rumble — felt not heard
# ═══════════════════════════════════════════════════════
sub = patterns.sub_rumble("Ab0", DUR, trem_rate=0.08, trem_depth=0.6, vol=0.08)
c = canvas.place(c, sub, 0.0)

# ═══════════════════════════════════════════════════════
# LAYER 7: Resolve — one clean note at the end
# ═══════════════════════════════════════════════════════
resolve = patterns.resolve(
    "Ab4", dur=3.0, start_t=22.0,
    wave_fn=osc.triangle, vol=0.15,
    reverb_decay=0.2, total_dur=DUR
)
c = canvas.place(c, resolve, 0.0)

# ═══════════════════════════════════════════════════════
# MIX + EXPORT
# ═══════════════════════════════════════════════════════
c = canvas.normalize(c, peak_db=-2.0)
c = fx.fade_in(c, 0.3)
c = fx.fade_out(c, 2.5)

out_dir = os.path.dirname(os.path.abspath(__file__))
pipeline.render(c, "07-hyperpop-machine-spike", out_dir, fade_in_s=0, fade_out_s=0, peak_db=-2.0)
print("Done: 07-hyperpop-machine-spike")
