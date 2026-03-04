# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v2: CONCRETE PERCUSSION
No melody. Just impacts and textures. Like field recordings from inside the ledge.
"""
import sys, numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-studio/scripts")
from bricks import osc, fx, theory, canvas, patterns

SR = 22050
DUR = 22.0

c = canvas.make(DUR)

# Subsonic rumble throughout
rumble = osc.sine(theory.note_freq("B0"), DUR)
rumble = fx.lowpass(rumble, 60)
c = canvas.place(c, rumble, 0.0, vol=0.08)

# Frame 1: metallic scrapes — crow pulling metal from stone
for i, t in enumerate([0.3, 1.5, 2.7, 3.9, 5.1]):
    scrape = osc.noise(0.2)
    scrape = fx.highpass(scrape, 1200 + i * 300)
    scrape = fx.lowpass(scrape, 3000 + i * 500)
    scrape = fx.bitcrush(scrape, depth=4)
    scrape = fx.env(scrape, a=0.01, d=0.15, s=0.1, r=0.05)
    c = canvas.place(c, scrape, t, vol=0.2)

# Frame 2: resonant pings — light hitting surfaces
note_names = ["E4", "B4", "E5", "G#4", "D5"]
for i, t in enumerate([7.2, 8.2, 9.2, 10.2, 11.2]):
    freq = theory.note_freq(note_names[i])
    p1 = osc.triangle(freq, 0.5)
    p2 = osc.triangle(freq * 1.008, 0.5)  # slight detune
    ping = p1 + p2
    ping = fx.env(ping, a=0.001, d=0.3, s=0.0, r=0.2)
    ping = fx.reverb(ping, decay=0.6)
    c = canvas.place(c, ping, t, vol=0.1)

# Frame 3: machine noise — degrading signal
for i, t in enumerate([13.3, 14.6, 15.9, 17.2]):
    depth = 5 - i  # 5, 4, 3, 2
    tone = osc.square(theory.note_freq("E2"), 0.3)
    tone = fx.bitcrush(tone, depth=max(depth, 2))
    tone = fx.env(tone, a=0.005, d=0.2, s=0.3, r=0.1)
    c = canvas.place(c, tone, t, vol=0.25)

# Final low thud
thud = osc.sine(theory.note_freq("E1"), 0.4)
thud = fx.env(thud, a=0.001, d=0.3, s=0.0, r=0.1)
c = canvas.place(c, thud, 18.5, vol=0.4)

c = canvas.normalize(c)
c = fx.fade_in(c, 1.0)
c = fx.fade_out(c, 3.0)

canvas.save_wav(c, "/tmp/crow-audio/02-concrete-percussion.wav")
print("Done: 02-concrete-percussion.wav")
