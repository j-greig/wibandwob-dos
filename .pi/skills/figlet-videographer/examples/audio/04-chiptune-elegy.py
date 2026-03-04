# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v4: CHIPTUNE ELEGY
E minor pentatonic melody. Slow, deliberate. The crow's song is mournful.
Light enters as arpeggiated chords. The machine is a broken music box.
"""
import sys, numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-studio/scripts")
from bricks import osc, fx, theory, canvas, patterns

SR = 22050
DUR = 22.0

c = canvas.make(DUR)

# Gentle sub pad throughout
pad = osc.triangle(theory.note_freq("E2"), DUR)
pad = fx.lowpass(pad, 200)
pad = fx.env(pad, a=3.0, d=1.0, s=0.6, r=4.0)
c = canvas.place(c, pad, 0.0, vol=0.12)

# Frame 1: crow melody — descending E minor pentatonic
crow_notes = ["E4", "D4", "B3", "A3", "E3"]
for i, note in enumerate(crow_notes):
    t = 0.3 + i * 1.2
    tone = osc.sawtooth(theory.note_freq(note), 0.8)
    tone = fx.bitcrush(tone, depth=6)
    tone = fx.lowpass(tone, 1200)
    tone = fx.env(tone, a=0.02, d=0.4, s=0.3, r=0.3)
    tone = fx.reverb(tone, decay=0.3)
    c = canvas.place(c, tone, t, vol=0.18)

# Frame 2: light arpeggio — Em7 broken chord, ascending
light_notes = ["E3", "G3", "B3", "D4", "E4"]
for i, note in enumerate(light_notes):
    t = 7.2 + i * 1.0
    freq = theory.note_freq(note)
    tone = osc.triangle(freq, 0.9)
    tone = fx.env(tone, a=0.05, d=0.5, s=0.2, r=0.3)
    tone = fx.reverb(tone, decay=0.5)
    # Ghost octave above
    ghost = osc.triangle(freq * 2, 0.9)
    ghost = fx.env(ghost, a=0.1, d=0.5, s=0.1, r=0.3)
    c = canvas.place(c, tone, t, vol=0.15)
    c = canvas.place(c, ghost, t, vol=0.04)

# Frame 3: broken music box — machine trying to play the melody back wrong
machine_notes = ["E4", "Eb4", "B3", "Bb3"]  # chromatic corruption
for i, note in enumerate(machine_notes):
    t = 13.3 + i * 1.3
    freq = theory.note_freq(note)
    tone = osc.square(freq, 0.5)
    tone = fx.bitcrush(tone, depth=4)
    tone = fx.env(tone, a=0.001, d=0.2, s=0.4, r=0.2)
    tone2 = osc.square(freq * 0.98, 0.5)
    tone2 = fx.bitcrush(tone2, depth=4)
    tone2 = fx.env(tone2, a=0.001, d=0.2, s=0.4, r=0.2)
    c = canvas.place(c, tone, t, vol=0.15)
    c = canvas.place(c, tone2, t, vol=0.1)

# Resolve on low E
resolve = osc.triangle(theory.note_freq("E3"), 2.0)
resolve = fx.env(resolve, a=0.1, d=0.5, s=0.5, r=1.2)
resolve = fx.reverb(resolve, decay=0.6)
c = canvas.place(c, resolve, 19.0, vol=0.2)

c = canvas.normalize(c)
c = fx.fade_in(c, 1.5)
c = fx.fade_out(c, 3.0)

canvas.save_wav(c, "/tmp/crow-audio/04-chiptune-elegy.wav")
print("Done: 04-chiptune-elegy.wav")
