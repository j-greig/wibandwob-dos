#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
#
# Avril 14th — Aphex Twin  (Drukqs, 2001)
# Chiptune cover — wibwob2 render-v4
#
# KEY:   F minor (= Ab major, Camelot 4A/4B — same notes: Ab Bb C Db Eb F G)
# BPM:   76  (multiple cover transcriptions; 72 was slightly slow)
# TIME:  3/4  (one bar = 3 beats = 2.368s at 76 BPM)
# DURATION: 124s
#
# MELODY SOURCE: guitar tab from r/aphextwin (tuning C# G# D# G# C D#)
#   converted to piano pitches — see scratch/avril-14th/MELODY-RESEARCH.md
#
# Melodic DNA:
#   Rising:  Ab3 → F4 → Ab4 → C5   (root → third → fifth)
#   Falling: C5 → Bb4 → Ab4 → Eb4 → Db4 → C4 → Ab3  (stepwise descent)
#   The piece IS the descent. Everything else is approach and landing.
#
# Answers to open questions from RENDER-FINDINGS.md:
#   1. Phrase B top: uses Db5 (b6 of Fm) — keeps the b6 colour, more ache
#   2. LH rhythm: straight 3-per-bar but note 3 arrives at 2.5 beats (slight lean)
#   3. Ghost: sine + bitcrush4 — cleaner, more ethereal than triangle
#
# Voices:
#   Melody:  triangle + vibrato onset 80ms
#   Ghost:   sine, octave up, vol=0.04, crush=4, Act 2 only every 4th note
#   LH:      triangle, vol=0.055, lowpass 480Hz, Act 2+ only
#   Drone:   Act 2 peak only — Ab2 sine, vol=0.03, tremolo, heavily filtered

import sys
import numpy as np
from scipy import signal as sp

sys.path.insert(0, "/Users/james/Repos/wibandwob-dos/.pi/skills/chiptune-studio/scripts")
from bricks import *

SR    = 22050
BPM   = 76
BEAT  = 60.0 / BPM          # 0.7895s
BAR   = 3.0 * BEAT           # 2.368s per bar
TOTAL = 124.0

OUT_WAV = "/Users/james/Repos/wibandwob-dos/scratch/compositions/avril-14th-v4.wav"
OUT_MP3 = "/Users/james/Repos/wibandwob-dos/scratch/compositions/avril-14th-v4.mp3"

# ─────────────────────────────────────────────────────────────────────────────
# VOICES

def melody_note(name, dur_beats, vol=0.21, crush=None):
    dur_s = max(0.02, dur_beats * BEAT)
    freq  = note_freq(name)
    t     = np.linspace(0, dur_s, int(SR * dur_s), endpoint=False)
    # Triangle via sawtooth(width=0.5) with vibrato that fades in at 80ms
    vib_env  = np.clip((t - 0.08) / 0.07, 0.0, 1.0)
    freq_mod = freq * (1.0 + 0.003 * np.sin(2*np.pi*5.0*t) * vib_env)
    phase    = np.cumsum(2*np.pi*freq_mod/SR)
    audio    = sp.sawtooth(phase, width=0.5).astype(np.float64)
    rel      = min(0.38, dur_s * 0.42)
    audio    = env(audio, a=0.004, d=0.15, s=0.26, r=rel)
    if crush:
        audio = bitcrush(audio, depth=crush)
    return audio * vol

def ghost_note(name, dur_beats, vol=0.04):
    """Sine, one octave up — barely there, more shimmer than voice."""
    dur_s    = max(0.02, dur_beats * BEAT)
    freq_hi  = note_freq(name) * 2.0
    t        = np.linspace(0, dur_s, int(SR * dur_s), endpoint=False)
    audio    = np.sin(2*np.pi*freq_hi*t).astype(np.float64)
    audio    = env(audio, a=0.006, d=0.10, s=0.18, r=0.20)
    audio    = bitcrush(audio, depth=4)
    audio    = lowpass(audio, cutoff=4000)
    return audio * vol

def lh_note(name, dur_beats, vol=0.055):
    """Triangle, very lowpassed — felt not heard."""
    dur_s = max(0.02, dur_beats * BEAT)
    audio = triangle(note_freq(name), dur_s)
    audio = env(audio, a=0.006, d=0.12, s=0.22, r=min(0.28, dur_s*0.38))
    audio = lowpass(audio, cutoff=480)
    return audio * vol

# ─────────────────────────────────────────────────────────────────────────────
# MELODY SCORE  (F minor, beat offsets within each phrase)
#
# Phrase A — the main 4-bar cell (12 beats = 9.47s at 76 BPM)
# Derived from guitar tab pitch sequence in MELODY-RESEARCH.md
# Shape: Ab4→F4→Ab4 rise, C5 peak, stepwise descent Bb4→Ab4→Eb4→Db4→C4→Ab3

PHRASE_A = [
    # Bar 1: the approach — root area, rising
    (0.0,  "Ab4", 0.75),
    (0.75, "F4",  0.75),
    (1.5,  "Ab4", 1.0),
    # Bar 2: the rise to the fifth
    (3.0,  "C5",  1.5),
    (4.5,  "Bb4", 1.5),
    # Bar 3: descent begins
    (6.0,  "Ab4", 0.75),
    (6.75, "Eb4", 0.75),
    (7.5,  "Db4", 0.75),
    (8.25, "C4",  0.75),
    # Bar 4: the landing — held, the ache
    (9.0,  "Ab3", 3.0),   # held full bar — the breath
]
PHRASE_A_DUR = 12 * BEAT   # 4 bars = 9.47s

# Phrase A2 — second statement, slight variation in bar 2
PHRASE_A2 = [
    (0.0,  "Ab4", 0.75),
    (0.75, "F4",  0.75),
    (1.5,  "Ab4", 1.0),
    (3.0,  "C5",  0.75),
    (3.75, "Db5", 0.75),  # the b6 — extra ache
    (4.5,  "C5",  1.5),
    (6.0,  "Ab4", 0.75),
    (6.75, "Eb4", 0.75),
    (7.5,  "Db4", 1.5),
    (9.0,  "C4",  1.0),
    (10.0, "Ab3", 2.0),
]
PHRASE_A2_DUR = 12 * BEAT

# Phrase B — variation, higher register, enters Act 2
# Top line: F4→Ab4→C5→Eb5 rise, then Db5→C5→Bb4→Ab4 descent
PHRASE_B = [
    (0.0,  "F4",  0.75),
    (0.75, "Ab4", 0.75),
    (1.5,  "C5",  1.0),
    (3.0,  "Eb5", 1.5),
    (4.5,  "Db5", 1.5),   # b6 — the colour note
    (6.0,  "C5",  0.75),
    (6.75, "Bb4", 0.75),
    (7.5,  "Ab4", 1.5),
    (9.0,  "F4",  3.0),   # root — settled but wistful
]
PHRASE_B_DUR = 12 * BEAT

# Dissolution phrase — same shapes, falling apart, long silences
PHRASE_C = [
    (0.0,  "Ab4", 2.0),
    (2.0,  "F4",  2.0),
    (4.0,  "Eb4", 3.0),
    (7.0,  "Db4", 3.0),
    (10.0, "C4",  2.0),
    (13.0, "Ab3", 5.0),   # the final held note
]
PHRASE_C_DUR = 18 * BEAT

# ─────────────────────────────────────────────────────────────────────────────
# LEFT HAND  (Fm arpeggiation, slightly leaning — note 3 at beat 2.5 not 3.0)
#
# Chord cycle: Fm  Fm  Dbmaj  Cm  (i  i  bVI  v in F minor)

LH_CHORDS = [
    ("F3",  "Ab3", "C4"),   # Fm
    ("F3",  "Ab3", "C4"),   # Fm
    ("Db3", "F3",  "Ab3"),  # Db major
    ("C3",  "Eb3", "G3"),   # Cm
]

def place_lh_bar(c, start_s, chord_idx, vol_mul=1.0):
    """One bar of LH arpeggiation: beat 1, beat 2, beat 2.5 (slight lean)."""
    notes = LH_CHORDS[chord_idx % len(LH_CHORDS)]
    offsets = [0.0, BEAT, BEAT * 2.5]   # the lean on beat 3
    for off, note in zip(offsets, notes):
        t0 = start_s + off
        if t0 >= TOTAL - 0.1:
            continue
        n = lh_note(note, 0.55, vol=0.055 * vol_mul)
        c = place(c, n, t0)
    return c

def place_lh_section(c, start_s, end_s, vol_mul=1.0):
    bars = int((end_s - start_s) / BAR)
    for i in range(bars):
        t = start_s + i * BAR
        if t >= TOTAL - BAR:
            break
        # Gentle fade-in over first 4 bars
        bar_vol = vol_mul * min(1.0, 0.4 + i * 0.15)
        c = place_lh_bar(c, t, i, vol_mul=bar_vol)
    return c

# ─────────────────────────────────────────────────────────────────────────────
# PHRASE PLACER

def place_phrase(c, phrase, start_s, vol_mul=1.0,
                 with_ghost=False, ghost_every=4, crush=None):
    for idx, (beat_off, note, dur_b) in enumerate(phrase):
        t0 = start_s + beat_off * BEAT
        if t0 >= TOTAL - 0.05:
            break
        nd = melody_note(note, dur_b, vol=0.21 * vol_mul, crush=crush)
        c  = place(c, nd, t0)
        if with_ghost and idx % ghost_every == 0:
            g = ghost_note(note, dur_b, vol=0.04 * vol_mul)
            c = place(c, g, t0)
    return c

# ─────────────────────────────────────────────────────────────────────────────
# BUILD

c = make(TOTAL)
t = 0.0

# ── ACT ONE  0:00–0:38  melody alone, naked, no LH, no ghost ─────────────────
print("Act 1: naked melody (0:00–~0:38)")
t = 1.5 * BEAT                         # ~1.2s pickup silence

c = place_phrase(c, PHRASE_A,  t, vol_mul=0.80)
t += PHRASE_A_DUR + BEAT               # phrase + 1-beat breath

c = place_phrase(c, PHRASE_A2, t, vol_mul=0.88)
t += PHRASE_A2_DUR

act1_end = t
print(f"  ends at {t:.1f}s (target 38s, diff {t-38:.1f}s)")

# ── ACT TWO  0:38–1:28  LH enters, ghost thickens, builds to quiet peak ──────
print("Act 2: harmony enters (0:38–~1:28)")
act2_start = t

# Phrase B — new voice, higher register
c = place_phrase(c, PHRASE_B, t, vol_mul=1.00, with_ghost=True, ghost_every=4)
t += PHRASE_B_DUR + BEAT * 0.5

# Phrase A returns — now weighted by memory
c = place_phrase(c, PHRASE_A, t, vol_mul=1.05, with_ghost=True, ghost_every=3)
t += PHRASE_A_DUR + BEAT * 0.5

# Phrase B again — ghost every 2nd note, density peak
c = place_phrase(c, PHRASE_B, t, vol_mul=1.08, with_ghost=True, ghost_every=2)
t += PHRASE_B_DUR

act2_end = t
print(f"  ends at {t:.1f}s (target 88s, diff {t-88:.1f}s)")

# LH: enters 2 bars into Act 2, covers full act
c = place_lh_section(c, act2_start + 2*BAR, act2_end)

# Subtle Ab2 drone under the peak phrase only (middle of Act 2)
drone_start = act2_start + PHRASE_B_DUR
drone_dur   = PHRASE_A_DUR + PHRASE_B_DUR * 0.6
try:
    d = drone("Ab2", drone_dur, wave_fn=triangle,
               cutoff=280, trem_rate=0.05, trem_depth=0.18,
               vol=0.028, fade=(3.0, 5.0))
    c = place(c, d, drone_start)
except Exception as e:
    print(f"  drone skipped: {e}")

# ── ACT THREE  1:28–2:04  dissolution, bitcrush rises, LH fades out ──────────
print("Act 3: dissolution (1:28–2:04)")
t += BEAT

act3_start = t

# Phrase C: dissolving shape, mild crush
c = place_phrase(c, PHRASE_C, t, vol_mul=0.72, crush=6)
t += PHRASE_C_DUR + BEAT

# Phrase A skeleton — crush deepens, volume receding
c = place_phrase(c, PHRASE_A, t, vol_mul=0.52, crush=8)
t += PHRASE_A_DUR

# LH fades through first half of Act 3 only
c = place_lh_section(c, act3_start, act3_start + PHRASE_C_DUR, vol_mul=0.45)

print(f"  body ends at {t:.1f}s")

# Final sparse notes — 4 isolated pitches trailing to silence
# Back-calculate: place them in the final ~12 seconds
final_start = max(t + BEAT, TOTAL - 13.0)
print(f"  final phrase at {final_start:.1f}s → ~{final_start+11:.1f}s")

FINAL_NOTES = [
    (0.0, "F4",  2.5, 0.14),
    (3.0, "Ab4", 2.5, 0.11),
    (6.0, "Eb4", 2.5, 0.09),
    (9.5, "F3",  3.5, 0.07),   # the root, very low, fading
]
for off_s, note, dur_b, vol in FINAL_NOTES:
    t0 = final_start + off_s
    if t0 >= TOTAL:
        break
    nd = melody_note(note, dur_b, vol=vol, crush=9)
    c  = place(c, nd, t0)

# ── MASTER ────────────────────────────────────────────────────────────────────
print("Post-processing...")
c = fade_in(c,  0.8)
c = fade_out(c, 7.0)
c = normalize(c, peak_db=-3.0)

save_wav(c, OUT_WAV)
print(f"\nSaved: {OUT_WAV}")
print(f"Duration: {len(c)/SR:.2f}s")
print(f"Key: F minor  BPM: 76  Osc: triangle+vibrato  Ghost: sine+crush4")

# MP3
try:
    from bricks.pipeline import export_mp3
    export_mp3(c, OUT_MP3, bitrate="192k", fade_out_ms=0, normalize_audio=False)
    print(f"MP3:  {OUT_MP3}")
except Exception as e:
    print(f"MP3 skipped ({e}) — wav is fine")
