# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v6: CHIPTUNE LULLABY
Waltz time (3/4 at 72bpm). The crow at dusk. Light fading through holes.
The machine powers down. G major — gentle, tired, kind.
"""
import sys, numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-studio/scripts")
from bricks import osc, fx, theory, canvas, patterns

SR = 22050
DUR = 22.0
BPM = 72
beat = 60.0 / BPM

c = canvas.make(DUR)

# Waltz bass — alternating G and Em
for bar in range(int(DUR / (beat * 3))):
    t_bar = bar * beat * 3
    note = "G2" if bar % 4 < 2 else "E2"
    if t_bar < DUR - 1:
        b = osc.triangle(theory.note_freq(note), beat * 2)
        b = fx.lowpass(b, 300)
        b = fx.env(b, a=0.02, d=0.3, s=0.5, r=0.5)
        c = canvas.place(c, b, t_bar, vol=0.15)

# Frame 1: crow melody — gentle descending, like a bird settling
crow_melody = ["D5", "B4", "G4", "E4", "D4"]
for i, note in enumerate(crow_melody):
    t = 0.3 + i * beat * 1.5
    tone = osc.triangle(theory.note_freq(note), beat * 2)
    tone = fx.env(tone, a=0.05, d=0.5, s=0.3, r=0.5)
    tone = fx.reverb(tone, decay=0.4)
    c = canvas.place(c, tone, t, vol=0.18)

# Frame 2: light through holes — high bell-like tones
light_notes = ["G5", "B5", "D6", "G5", "E5"]
for i, note in enumerate(light_notes):
    t = 7.2 + i * 1.0
    freq = theory.note_freq(note)
    bell = osc.sine(freq, 0.8)
    bell = fx.env(bell, a=0.001, d=0.5, s=0.1, r=0.3)
    bell = fx.reverb(bell, decay=0.6)
    h2 = osc.sine(freq * 2, 0.8)
    h2 = fx.env(h2, a=0.01, d=0.3, s=0.0, r=0.2)
    c = canvas.place(c, bell, t, vol=0.12)
    c = canvas.place(c, h2, t, vol=0.03)

# Frame 3: machine powering down — descending, slowing
machine_notes = ["E4", "D4", "C4", "G3"]
machine_delays = [1.3, 1.5, 1.8, 2.2]
t_acc = 13.3
for i, note in enumerate(machine_notes):
    tone = osc.square(theory.note_freq(note), 0.6)
    tone = fx.bitcrush(tone, depth=7 - i)
    tone = fx.env(tone, a=0.01, d=0.3, s=0.2, r=0.3)
    tone = fx.lowpass(tone, 800 - i * 100)
    c = canvas.place(c, tone, t_acc, vol=0.12)
    t_acc += machine_delays[i]

# Final resolve — G major chord, very quiet
for note in ["G3", "B3", "D4"]:
    res = osc.triangle(theory.note_freq(note), 3.0)
    res = fx.env(res, a=0.3, d=1.0, s=0.3, r=1.5)
    res = fx.reverb(res, decay=0.5)
    c = canvas.place(c, res, 19.0, vol=0.08)

c = canvas.normalize(c)
c = fx.fade_in(c, 2.0)
c = fx.fade_out(c, 4.0)

canvas.save_wav(c, "/tmp/crow-audio/06-chiptune-lullaby.wav")
print("Done: 06-chiptune-lullaby.wav")
