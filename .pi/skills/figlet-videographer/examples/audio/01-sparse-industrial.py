# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v1: SPARSE INDUSTRIAL
Low drone bed. Metallic noise hits on word reveals. Silence between.
Key: atonal / E pedal. The machine hums. The crow interrupts.
"""
import sys, numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-studio/scripts")
from bricks import osc, fx, theory, canvas, patterns

SR = 22050
DUR = 22.0

c = canvas.make(DUR)

# Low E drone — the machine's hum, barely audible
drone = osc.triangle(theory.note_freq("E1"), DUR)
drone = fx.lowpass(drone, 120)
drone = fx.env(drone, a=4.0, d=0.5, s=0.7, r=4.0)
c = canvas.place(c, drone, 0.0, vol=0.15)

# Frame 1 hits (t=0, 1.2, 2.4, 3.6, 4.8) — crow pulling spikes
for i, t in enumerate([0.2, 1.4, 2.6, 3.8, 5.0]):
    hit = osc.noise(0.08)
    hit = fx.highpass(hit, 800)
    hit = fx.bitcrush(hit, depth=3)
    hit = fx.env(hit, a=0.001, d=0.06, s=0.1, r=0.02)
    c = canvas.place(c, hit, t, vol=0.25 + i * 0.05)

# Frame 2 (t=7) — light through holes, softer metallic pings
for i, t in enumerate([7.2, 8.2, 9.2, 10.2, 11.2]):
    freq = theory.note_freq("B5") if i % 2 == 0 else theory.note_freq("E6")
    ping = osc.sine(freq, 0.3)
    ping = fx.env(ping, a=0.002, d=0.15, s=0.0, r=0.15)
    ping = fx.reverb(ping, decay=0.4)
    c = canvas.place(c, ping, t, vol=0.12)

# Frame 3 (t=13) — the machine sees targets, heavy sub + noise burst
sub = osc.sine(theory.note_freq("E1"), 1.5)
sub = fx.env(sub, a=0.01, d=0.3, s=0.8, r=0.8)
c = canvas.place(c, sub, 13.0, vol=0.3)

for t in [13.3, 14.6, 15.9, 17.2]:
    burst = osc.noise(0.15)
    burst = fx.bitcrush(burst, depth=2)
    burst = fx.lowpass(burst, 400)
    burst = fx.env(burst, a=0.001, d=0.1, s=0.2, r=0.05)
    c = canvas.place(c, burst, t, vol=0.35)

c = canvas.normalize(c)
c = fx.fade_out(c, 4.0)

canvas.save_wav(c, "/tmp/crow-audio/01-sparse-industrial.wav")
print("Done: 01-sparse-industrial.wav")
