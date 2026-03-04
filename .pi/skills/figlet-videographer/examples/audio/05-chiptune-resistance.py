# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v5: CHIPTUNE RESISTANCE
Garage-influenced tempo (138bpm). The crow has swagger. Light pulses.
The machine tries to keep up but stutters. E Phrygian for that dark edge.
"""
import sys, numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-studio/scripts")
from bricks import osc, fx, theory, canvas, patterns

SR = 22050
DUR = 22.0
BPM = 138
beat = 60.0 / BPM

c = canvas.make(DUR)

# Kick pattern — sparse, garage two-step feel
for bar in range(int(DUR / (beat * 4))):
    t_bar = bar * beat * 4
    for hit_offset in [0, beat * 2.5]:
        t = t_bar + hit_offset
        if t < DUR - 0.5:
            kick = osc.noise(0.06)
            kick = fx.lowpass(kick, 150)
            kick = fx.env(kick, a=0.002, d=0.04, s=0.1, r=0.02)
            c = canvas.place(c, kick, t, vol=0.3)

# Hat — offbeat, ticking clock
for bar in range(int(DUR / (beat * 4))):
    t_bar = bar * beat * 4
    for i in range(8):
        t = t_bar + i * beat * 0.5 + beat * 0.25
        if t < DUR - 0.2:
            hat = osc.noise(0.03)
            hat = fx.highpass(hat, 3000)
            hat = fx.env(hat, a=0.001, d=0.02, s=0.0, r=0.01)
            c = canvas.place(c, hat, t, vol=0.08)

# Bass — E Phrygian riff, syncopated
bass_pattern = [("E2", 0), ("F2", 1.5), ("E2", 2), ("G2", 3)]
for bar in range(int(DUR / (beat * 4))):
    t_bar = bar * beat * 4
    for note, offset_beats in bass_pattern:
        t = t_bar + offset_beats * beat
        if t < DUR - 0.5:
            b = osc.square(theory.note_freq(note), beat * 0.8)
            b = fx.lowpass(b, 500)
            b = fx.bitcrush(b, depth=6)
            b = fx.env(b, a=0.005, d=0.1, s=0.5, r=0.1)
            c = canvas.place(c, b, t, vol=0.2)

# Frame 1 melody — crow's defiant call
crow_riff = ["E4", "F4", "E4", "D4", "E4"]
for i, note in enumerate(crow_riff):
    t = 0.3 + i * 1.2
    mel = osc.sawtooth(theory.note_freq(note), 0.4)
    mel = fx.bitcrush(mel, depth=5)
    mel = fx.env(mel, a=0.01, d=0.2, s=0.3, r=0.15)
    mel = fx.delay(mel, repeats=2, delay_ms=int(beat * 750), feedback=0.3)
    c = canvas.place(c, mel, t, vol=0.15)

# Frame 2 — light sparkles over the beat
for i, t in enumerate([7.2, 8.2, 9.2, 10.2, 11.2]):
    sp = patterns.sparkle(["E5", "B5", "G5"], t, DUR, spacing=0.08, note_dur=0.1)
    sp = fx.reverb(sp, decay=0.3)
    c = canvas.place(c, sp, 0.0, vol=0.08)

# Frame 3 — machine stutters, beat fragments
for i, t in enumerate([13.3, 14.6, 15.9, 17.2]):
    glitch = osc.square(theory.note_freq("E4"), 0.1)
    glitch = fx.bitcrush(glitch, depth=3)
    glitch = fx.env(glitch, a=0.001, d=0.05, s=0.2, r=0.05)
    for rep in range(3):
        c = canvas.place(c, glitch, t + rep * 0.08, vol=0.2)

c = canvas.normalize(c)
c = fx.fade_in(c, 0.5)
c = fx.fade_out(c, 2.5)

canvas.save_wav(c, "/tmp/crow-audio/05-chiptune-resistance.wav")
print("Done: 05-chiptune-resistance.wav")
