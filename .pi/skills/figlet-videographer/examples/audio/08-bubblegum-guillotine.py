# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
crow light machine — v8: BUBBLEGUM GUILLOTINE
Detuned music-box melody in E major over a trap 808 sub.
Sugary top, violent bottom. The kawaii mask slips.
170 BPM. Bitcrushed to 5 for that plastic-toy feel.
Trap hats accelerate into rolls. Sub drops on the 1.
No word sync — just a mood bed.
"""
import sys, os
import numpy as np
sys.path.insert(0, "/Users/james/.claude/skills/chiptune-bricks/scripts")
from bricks import osc, fx, theory, canvas, patterns, pipeline

SR = 22050
DUR = 28.0
BPM = 170

c = canvas.make(DUR)

# ── MUSIC BOX — detuned, crushed, saccharine ──
# E major pentatonic — deliberately too sweet
box_notes = ["E5", "G#5", "B5", "C#6", "E6", "C#6", "B5", "G#5"]
box = patterns.arp(
    box_notes, DUR, bpm=int(BPM * 1.5),
    wave_fn=osc.triangle, note_frac=0.4,
    crush=5, vol=0.09,
    skip_fn=lambda i: i % 6 in (3, 5)  # gaps make it breathe
)
c = canvas.place(c, box, 0.0)

# Second box — same notes, detuned sharp, offset
box2_notes = ["F5", "A5", "C6", "D6", "F6", "D6", "C6", "A5"]  # quarter-tone-ish clash
box2 = patterns.arp(
    box2_notes, DUR, bpm=int(BPM * 1.5),
    wave_fn=osc.square, note_frac=0.3,
    crush=6, vol=0.04,
    offset=0.1  # slightly behind = uncanny
)
c = canvas.place(c, box2, 0.0)

# ── 808 SUB — sine kick that sustains, drops every 2 bars ──
sub_hit_dur = 0.6
beat_s = 60.0 / BPM
bar_s = beat_s * 4
for i in range(int(DUR / (bar_s * 2))):
    t = i * bar_s * 2
    sub = osc.sine(theory.note_freq("E1"), sub_hit_dur)
    # Pitch bend down
    n = len(sub)
    bend = np.linspace(1.0, 0.5, n)
    phase = 2 * np.pi * np.cumsum(theory.note_freq("E1") * bend) / SR
    sub = np.sin(phase)
    sub = fx.env(sub, a=0.001, d=0.1, s=0.6, r=0.3)
    c = canvas.place(c, sub, t, vol=0.35)

# ── TRAP HATS — 16ths with rolls ──
hat_str = "h.hHh.hH|h.h.hHHH"
hats = patterns.drums_from_string(hat_str, DUR, bpm=BPM, crush=4)
c = canvas.place(c, hats, 0.0, vol=0.1)

# ── CLAP — off-beat, dry ──
clap_str = "..C...C...C...C."
claps = patterns.drums_from_string(clap_str, DUR, bpm=BPM, crush=3)
c = canvas.place(c, claps, 0.0, vol=0.15)

# ── NOISE RISERS at section breaks ──
for t in [6.5, 13.5, 20.5]:
    riser_dur = 1.5
    riser = osc.noise(riser_dur)
    riser = fx.highpass(riser, 3000)
    riser = fx.env(riser, a=1.2, d=0.1, s=0.3, r=0.2)
    riser = fx.bitcrush(riser, depth=3)
    c = canvas.place(c, riser, t, vol=0.2)

# ── MIX ──
c = canvas.normalize(c, peak_db=-2.0)
c = fx.fade_in(c, 0.2)
c = fx.fade_out(c, 2.0)

out_dir = os.path.dirname(os.path.abspath(__file__))
pipeline.render(c, "08-bubblegum-guillotine", out_dir, fade_in_s=0, fade_out_s=0, peak_db=-2.0)
