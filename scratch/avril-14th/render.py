#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
#
# Avril 14th — Aphex Twin — chiptune cover v4
#
# Key:       A major (F# C# G# — 3 sharps)
# Tempo:     72 BPM, 3/4 time
# 1 beat     = 0.8333s
# 1 bar      = 2.5s
# Duration:  124s (~49 bars)
#
# Melody register: E5, F#5, C#5, B4, A4, G#5 — 5th octave primarily
#
# Source: scratch/avril-14th/research-notes.md
# Opening motif: E5-E5-F#5-E5-C#5-B4 (stepwise descent in A major)
# Signature: held C#5 for 3 full beats at bar 4 — the ache
# Left hand: gentle arpeggio A2-E3-A3 / D3-A3-D4 / E3-B3-E4 (I-IV-V-I)
#
# Voices:
#   Melody: triangle + vibrato onset 100ms, clean (no bitcrush in Act 1)
#   Ghost:  one octave up, vol 0.03, heavy lowpass 3000Hz, very sparse
#   LH:     triangle, vol 0.055, lowpass 600Hz, mild bitcrush depth=8

import sys
import numpy as np
from scipy import signal as sp

sys.path.insert(0, "/Users/james/Repos/wibandwob-dos/.pi/skills/chiptune-studio/scripts")
from bricks import *

SR    = 22050
BPM   = 72
BEAT  = 60.0 / BPM    # 0.8333s
BAR   = 3.0 * BEAT    # 2.5s per bar
TOTAL = 124.0


# ------------------------------------------------------------------
# NOTE BUILDER

def make_note(name, dur_beats, vol=0.22, do_vibrato=True, crush=None):
    freq  = note_freq(name)
    dur_s = dur_beats * BEAT
    if dur_s < 0.01:
        return np.zeros(44)
    t = np.linspace(0, dur_s, int(SR * dur_s), endpoint=False)

    if do_vibrato and dur_s > 0.18:
        vib_depth = 0.0028
        vib_rate  = 5.0
        onset     = 0.10
        vib_env   = np.clip((t - onset) / 0.08, 0, 1)
        freq_mod  = freq * (1.0 + vib_depth * np.sin(2*np.pi*vib_rate*t) * vib_env)
        phase     = np.cumsum(2*np.pi*freq_mod / SR)
        audio     = sp.sawtooth(phase, width=0.5).astype(np.float64)
    else:
        audio = triangle(freq, dur_s)

    # Piano envelope: very fast attack, medium decay, low sustain
    r     = min(0.40, dur_s * 0.32)
    audio = env(audio, a=0.003, d=0.15, s=0.25, r=r)

    if crush:
        audio = bitcrush(audio, depth=crush)

    return audio * vol


def make_ghost(name, dur_beats, vol=0.035):
    """One octave up, barely audible shimmer."""
    freq    = note_freq(name)
    freq_hi = freq * 2.0
    dur_s   = dur_beats * BEAT
    t       = np.linspace(0, dur_s, int(SR * dur_s), endpoint=False)
    audio   = sp.sawtooth(2*np.pi*freq_hi*t, width=0.5).astype(np.float64)
    audio   = env(audio, a=0.005, d=0.10, s=0.12, r=0.20)
    audio   = lowpass(audio, cutoff=3000)
    return audio * vol


def make_lh_note(name, dur_beats, vol=0.055):
    """Left hand note — triangle, quiet, warmth-filtered."""
    freq  = note_freq(name)
    dur_s = dur_beats * BEAT
    t     = np.linspace(0, dur_s, int(SR * dur_s), endpoint=False)
    audio = sp.sawtooth(2*np.pi*freq*t, width=0.5).astype(np.float64)
    audio = env(audio, a=0.008, d=0.20, s=0.30, r=0.35)
    audio = bitcrush(audio, depth=8)
    audio = lowpass(audio, cutoff=600)
    return audio * vol


def place_phrase(c, phrase, start_s, vol_mul=1.0,
                 with_ghost=False, ghost_every=5, crush=None):
    for idx, (beat_off, note, dur_b) in enumerate(phrase):
        t0 = start_s + beat_off * BEAT
        if t0 >= TOTAL - 0.05:
            break
        nd = make_note(note, dur_b, vol=0.22 * vol_mul, crush=crush)
        c  = place(c, nd, t0)
        if with_ghost and idx % ghost_every == 0:
            g  = make_ghost(note, dur_b, vol=0.035 * vol_mul)
            c  = place(c, g, t0)
    return c


# ---- LEFT HAND ------------------------------------------------

LH_CHORDS = {
    "A": ["A2", "E3", "A3"],   # I
    "D": ["D3", "A3", "D4"],   # IV
    "E": ["E3", "B3", "E4"],   # V
}

def place_lh_bar(c, start_s, chord="A", vol=0.055):
    """One bar of Alberti-style arpeggio: root, fifth, octave."""
    notes = LH_CHORDS.get(chord, LH_CHORDS["A"])
    for beat_i, note in enumerate(notes):
        t0 = start_s + beat_i * BEAT
        if t0 >= TOTAL:
            break
        n = make_lh_note(note, 0.7, vol=vol)
        c = place(c, n, t0)
    return c

def place_lh_section(c, start_s, n_bars, vol=0.055):
    """Place n_bars of LH using the I-IV-V-I cycle."""
    cycle = ["A","A","A","A", "D","D","D","D", "E","E", "A","A"] * 10
    for i in range(n_bars):
        t0    = start_s + i * BAR
        chord = cycle[i % len(cycle)]
        c     = place_lh_bar(c, t0, chord=chord, vol=vol)
    return c


# ------------------------------------------------------------------
# THE MELODY — A major, 5th octave
# Source: scratch/avril-14th/research-notes.md

# PHRASE_A — the main 4-bar cell (12 beats = 10s)
# Opening: E5-E5-F#5-E5 then descent to C#5-B4-A4
# Signature: held C#5 at bar 4 (3 full beats)
PHRASE_A = [
    # Bar 1: the opening motif — repeated E then step up
    (0.0,  "E5",  0.75),
    (0.75, "E5",  0.5),
    (1.25, "F#5", 0.5),
    (1.75, "E5",  1.25),
    # Bar 2: descent begins — C#5 then B4 then A4
    (3.0,  "C#5", 0.75),
    (3.75, "B4",  0.75),
    (4.5,  "A4",  1.5),
    # Bar 3: lower register response, rising back
    (6.0,  "B4",  0.75),
    (6.75, "C#5", 0.75),
    (7.5,  "E5",  1.5),
    # Bar 4: THE held C#5 — this is the ache, 3 full beats
    (9.0,  "C#5", 3.0),
]
PHRASE_A_DUR = 12 * BEAT  # 10s

# PHRASE_A variant — slight rhythmic variation for second statement
PHRASE_A2 = [
    (0.0,  "E5",  1.0),
    (1.0,  "F#5", 0.5),
    (1.5,  "E5",  1.5),
    (3.0,  "C#5", 1.0),
    (4.0,  "B4",  0.5),
    (4.5,  "A4",  1.5),
    (6.0,  "A4",  0.5),
    (6.5,  "B4",  0.5),
    (7.0,  "C#5", 2.0),
    # Bar 4: held again — longer this time
    (9.0,  "C#5", 1.5),
    (10.5, "B4",  1.5),
]
PHRASE_A2_DUR = 12 * BEAT

# PHRASE_B — variation, higher register, starts on A5
# "opens up" — emotional register deepens
PHRASE_B = [
    # Bar 1: A5 descending through G#5 F#5
    (0.0,  "A5",  0.75),
    (0.75, "G#5", 0.5),
    (1.25, "F#5", 0.5),
    (1.75, "E5",  1.25),
    # Bar 2: echo of PHRASE_A's bar 1 shape
    (3.0,  "E5",  0.75),
    (3.75, "C#5", 0.75),
    (4.5,  "B4",  1.5),
    # Bar 3: descending further
    (6.0,  "A4",  0.75),
    (6.75, "B4",  0.75),
    (7.5,  "C#5", 1.5),
    # Bar 4: held B4 — slightly less tense than C#5 in PHRASE_A
    (9.0,  "B4",  3.0),
]
PHRASE_B_DUR = 12 * BEAT

# DISSOLUTION phrase — Act 3. Same shapes, falling apart.
# Fewer notes, longer holds, bigger gaps.
PHRASE_DISS = [
    (0.0,  "E5",  1.5),
    (1.5,  "C#5", 1.5),
    (3.0,  "B4",  3.0),
    (6.0,  "A4",  2.0),
    (8.0,  "E5",  1.0),
    (9.0,  "C#5", 3.0),
]
PHRASE_DISS_DUR = 12 * BEAT

# FINAL — just the skeleton, fading out
PHRASE_FINAL = [
    (0.0,  "E5",  3.0),
    (3.0,  "C#5", 3.0),
    (6.0,  "B4",  3.0),
    (9.0,  "A4",  6.0),   # held to end, fades
]


# ------------------------------------------------------------------
# BUILD

c = make(TOTAL)
t = 0.0

print("Act 1: Arrival — A major, melody enters alone (0:00–~0:38)")

# 2-beat silence before the piece begins
t = 2 * BEAT   # 1.67s

# First statement — no ghost, no LH, completely naked
c = place_phrase(c, PHRASE_A, t, vol_mul=0.80)
t += PHRASE_A_DUR

# Small breath — one bar rest
t += BAR

# Second statement — same phrase, gentle ghost appears (every 6th note)
c = place_phrase(c, PHRASE_A2, t, vol_mul=0.88, with_ghost=True, ghost_every=6)
t += PHRASE_A2_DUR

# LH enters very quietly in bar 7 of Act 1 — barely perceptible
lh_act1_start = 2*BEAT + PHRASE_A_DUR + BAR + 3*BEAT
c = place_lh_section(c, lh_act1_start, n_bars=6, vol=0.035)

# Phrase B closes Act 1
c = place_phrase(c, PHRASE_B, t, vol_mul=0.90, with_ghost=True, ghost_every=5)
t += PHRASE_B_DUR + BAR

print(f"  Act 1 ends: t={t:.1f}s  (target ~38s)")

# ------------------------------------------------------------------
print("Act 2: Deepening — harmony and ghost thicken (0:38–~1:28)")

act2_start = t

# LH at fuller volume for whole of Act 2
lh_n_bars = int((88.0 - act2_start) / BAR) + 4
c = place_lh_section(c, act2_start, n_bars=lh_n_bars, vol=0.055)

# PHRASE_A — returns, we know it now
c = place_phrase(c, PHRASE_A, t, vol_mul=1.00, with_ghost=True, ghost_every=4)
t += PHRASE_A_DUR

# PHRASE_B — higher register, opens up
c = place_phrase(c, PHRASE_B, t, vol_mul=1.05, with_ghost=True, ghost_every=3)
t += PHRASE_B_DUR

# PHRASE_A2 — ghost every 2nd note, density peak
c = place_phrase(c, PHRASE_A2, t, vol_mul=1.10, with_ghost=True, ghost_every=2)
t += PHRASE_A2_DUR

# PHRASE_B again — emotional peak
c = place_phrase(c, PHRASE_B, t, vol_mul=1.12, with_ghost=True, ghost_every=2)
t += PHRASE_B_DUR

# Low A2 pedal drone enters quietly around bar 20 (~50s)
drone_start = act2_start + 12 * BEAT
drone_dur   = t - drone_start + 4.0
drone_audio = drone(
    "A2", drone_dur,
    wave_fn=triangle,
    cutoff=280,
    crush=8,
    trem_rate=0.05,
    trem_depth=0.18,
    vol=0.055,
    fade=(4.0, 6.0)
)
c = place(c, drone_audio, drone_start)

print(f"  Act 2 ends: t={t:.1f}s  (target ~88s)")

# ------------------------------------------------------------------
print("Act 3: Dissolution — stripping back (1:28–2:04)")

t += BEAT   # breath

# Dissolution phrase — no LH, mild bitcrush, sparse
c = place_phrase(c, PHRASE_DISS, t, vol_mul=0.70,
                 with_ghost=True, ghost_every=6, crush=7)
t += PHRASE_DISS_DUR + BAR

# PHRASE_A stripped — very quiet, more crush
c = place_phrase(c, PHRASE_A, t, vol_mul=0.50, crush=8)
t += PHRASE_A_DUR

print(f"  Dissolution body ends: t={t:.1f}s")

# Final skeleton — timed to reach end of canvas
final_start = TOTAL - 12 * BEAT - 4.0   # 12 beats before end
if t > final_start:
    final_start = t + BEAT
print(f"  Final phrase: t={final_start:.1f}s → ~{final_start + 12*BEAT:.1f}s")

n_final = len(PHRASE_FINAL)
for idx, (beat_off, note, dur_b) in enumerate(PHRASE_FINAL):
    t0       = final_start + beat_off * BEAT
    if t0 >= TOTAL:
        break
    progress = idx / n_final
    vol_v    = 0.42 * (1.0 - progress * 0.72)
    nd       = make_note(note, dur_b, vol=vol_v, crush=9)
    c        = place(c, nd, t0)

# ------------------------------------------------------------------
print("Post-processing...")
c = fade_out(c, 6.0)
c = normalize(c, peak_db=-3.0)

out = "/Users/james/Repos/wibandwob-dos/scratch/compositions/avril-14th-chiptune.wav"
save_wav(c, out)
print(f"\nSaved:    {out}")
print(f"Duration: {len(c)/SR:.1f}s   Peak: {np.max(np.abs(c)):.4f}")
print("Key: A major   BPM: 72   Osc: triangle+vibrato   LH: arpeggio I-IV-V-I")
