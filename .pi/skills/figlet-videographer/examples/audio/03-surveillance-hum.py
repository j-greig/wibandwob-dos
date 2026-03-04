# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v3: SURVEILLANCE HUM
50Hz mains hum as the machine. Interference clicks. Rising target lock.
"""
import sys, numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-studio/scripts")
from bricks import osc, fx, theory, canvas, patterns

SR = 22050
DUR = 22.0

c = canvas.make(DUR)

# 50Hz mains hum — ever-present surveillance
hum = osc.sine(50.0, DUR)
hum_h3 = osc.sine(150.0, DUR)
hum = hum + hum_h3 * 0.3
hum = fx.env(hum, a=2.0, d=1.0, s=0.8, r=3.0)
c = canvas.place(c, hum, 0.0, vol=0.1)

# Frame 1: interference clicks — crow disrupting the signal
for t in [0.3, 1.5, 2.7, 3.9, 5.1]:
    click = osc.noise(0.02)
    click = fx.env(click, a=0.001, d=0.015, s=0.0, r=0.005)
    c = canvas.place(c, click, t, vol=0.4)

# Frame 2: refracted tones — light splitting
for i, t in enumerate([7.2, 8.2, 9.2, 10.2, 11.2]):
    harmonic = 50.0 * (i + 4)  # 200, 250, 300, 350, 400 Hz
    tone = osc.sine(harmonic, 0.6)
    tone = fx.tremolo(tone, rate=3.0 + i, depth=0.5)
    tone = fx.env(tone, a=0.05, d=0.3, s=0.2, r=0.25)
    tone = fx.reverb(tone, decay=0.3)
    c = canvas.place(c, tone, t, vol=0.08)

# Frame 3: target lock — rising sweep + accelerating clicks
sweep_dur = 4.0
n_samples = int(sweep_dur * SR)
t_arr = np.linspace(0, 1, n_samples)
sweep_freq = 80 + t_arr * 600
phase = 2 * np.pi * np.cumsum(sweep_freq) / SR
sweep = np.sin(phase)
sweep = fx.bitcrush(sweep, depth=5)
sweep = fx.env(sweep, a=0.5, d=0.5, s=0.8, r=1.5)
c = canvas.place(c, sweep, 13.0, vol=0.15)

# Accelerating clicks
click_times = [13.3, 14.0, 14.5, 14.9, 15.2, 15.4, 15.55, 15.65, 15.72, 15.78]
for t in click_times:
    click = osc.noise(0.015)
    click = fx.env(click, a=0.001, d=0.01, s=0.0, r=0.005)
    c = canvas.place(c, click, t, vol=0.5)

# Final lock tone
lock = osc.square(theory.note_freq("E4"), 1.0)
lock = fx.bitcrush(lock, depth=6)
lock = fx.env(lock, a=0.001, d=0.1, s=0.6, r=0.5)
c = canvas.place(c, lock, 17.2, vol=0.2)

c = canvas.normalize(c)
c = fx.fade_out(c, 3.0)

canvas.save_wav(c, "/tmp/crow-audio/03-surveillance-hum.wav")
print("Done: 03-surveillance-hum.wav")
