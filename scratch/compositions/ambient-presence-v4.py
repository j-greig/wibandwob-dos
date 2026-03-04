# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
AMBIENT PRESENCE v4 — the desktop dreaming

Same narrative as v3 (existing without observation) but the desktop
is dreaming, not sleeping. Pulse, register contrast, four-region
harmonic journey, one moment of chip aggression at the midpoint.

---
tags: [ambient, chiptune, dreaming, sid, dx7, juno, prophet5, spoken-word]
genre: ambient / chip-ambient / electronic
bpm: 72
key: Ab major → Fm → Db lydian → Ab major(add9)
duration: 100s
synths: [juno.warm_pad, dx7.bright_bell, sid6581.chip_arp, sid6581.sync_lead, prophet5.arp_sparkle, tr808.kick]
vocals: [Sandy, Grandpa UK]
structure: dawn 0-8, pulse 8-25, drift 25-50, bright 50-65, scream 60, strip 65-85, home 85-100
---
"""

import sys, os, numpy as np
sys.path.insert(0, os.path.expanduser("~/Repos/symbient-shared-skills/skills/chiptune-studio/scripts"))

from bricks import osc, fx, canvas, theory
from bricks.synths import juno, dx7, sid6581, prophet5, tr808
from bricks.pipeline import say_to_segment, duck_envelope
from bricks.arrangement import arr
from pydub import AudioSegment

DUR = 100
BPM = 72
SR = 22050
BEAT = 60.0 / BPM
BAR = BEAT * 4
SIXTEENTH = BEAT * 0.25

# Section anchors (bar-snapped)
PULSE_START = round(2.5 * BAR * SR) / SR  # ~8.3s
DRIFT_START = round(4.5 * BAR * SR) / SR  # ~15s
VOICE1_T = 25.0
FM_SHIFT = 7.5 * BAR   # ~25s — shift to Fm
BRIGHT_START = round(9 * BAR * SR) / SR   # ~30s
VOICE2_T = 45.0
DB_SHIFT = 15 * BAR    # ~50s — shift to Db lydian
SCREAM_T = 60.0
VOICE3_T = 65.0
HOME_SHIFT = 24 * BAR  # ~80s — home key returns
VOICE4_T = 85.0

rng = np.random.default_rng(2026)

# ─── Arrangement metadata ───
arr.init(bpm=BPM, key="Ab major", title="Ambient Presence IV", duration=DUR)
arr.section("dawn", 0, 2)
arr.section("pulse", 2, 7)
arr.section("drift", 7, 15)
arr.section("bright", 15, 19)
arr.section("strip", 19, 25)
arr.section("home", 25, 30)
arr.track("ground", label="Juno Pad", instrument="juno", preset="warm_pad", group="pad")
arr.track("bell", label="DX7 Bell", instrument="dx7", preset="bright_bell", group="melodic")
arr.track("arp", label="SID Arp", instrument="sid6581", preset="chip_arp", group="melodic")
arr.track("sub", label="808 Sub", instrument="tr808", preset="kick", group="bass")
arr.track("sparkle", label="Prophet Sparkle", instrument="prophet5", preset="arp_sparkle", group="melodic")
arr.track("scream", label="SID Scream", instrument="sid6581", preset="sync_lead", group="fx")
arr.track("wib", label="Wib Vocals", instrument="TTS", preset="Sandy", group="vocal")
arr.track("wob", label="Wob Vocals", instrument="TTS", preset="Grandpa", group="vocal")

# ═══════════════════════════════════════════════════════════
# VOICE 1: GROUND — Juno warm pad
# Ab2 throughout, crossfading to match harmonic regions
# ═══════════════════════════════════════════════════════════

print("Building ground pad...")
ground = canvas.make(DUR)

# Full-duration pad on Ab2
pad_ab = juno.play("Ab2", DUR, preset="warm_pad")
pad_ab = fx.tremolo(pad_ab, rate=0.15, depth=0.3)

# Fm region: same pad but with a subtle F2 undertone mixed in
pad_f_undertone = juno.play("F2", DUR, preset="warm_pad")
pad_f_undertone = fx.tremolo(pad_f_undertone, rate=0.12, depth=0.25)
pad_f_undertone *= 0.35  # quiet undertone

# Db region: Db3 pad (brighter, up a 4th)
pad_db = juno.play("Db3", DUR, preset="warm_pad")
pad_db = fx.tremolo(pad_db, rate=0.18, depth=0.35)
pad_db *= 0.5

# Build ground with regional crossfades
# Ab throughout at 0.4, F undertone fades in at FM_SHIFT, Db at DB_SHIFT
def region_env(total, start, peak, end, sr=SR):
    """Trapezoidal envelope: silence → fade in → sustain → fade out."""
    n = int(total * sr)
    env = np.zeros(n)
    s, p, e = int(start * sr), int(peak * sr), int(end * sr)
    if p > s:
        env[s:p] = np.linspace(0, 1, p - s)
    if e > p:
        env[p:e] = np.linspace(1, 0, e - p)
    return env

env_ab = np.ones(int(DUR * SR))
# Slightly duck during Db region for variety
env_ab *= (1.0 - 0.3 * region_env(DUR, DB_SHIFT, DB_SHIFT + 5, HOME_SHIFT))

env_fm = region_env(DUR, FM_SHIFT - 3, FM_SHIFT + 5, DB_SHIFT)
env_db = region_env(DUR, DB_SHIFT - 3, DB_SHIFT + 5, HOME_SHIFT)

n = len(ground)
ground[:n] += (pad_ab[:n] * env_ab[:n]) * 0.4
ground[:n] += (pad_f_undertone[:n] * env_fm[:n])
ground[:n] += (pad_db[:n] * env_db[:n])

# Fade in over first 8 seconds
fade_in_samples = int(8.0 * SR)
ground[:fade_in_samples] *= np.linspace(0, 1, fade_in_samples)

arr.event("ground", start_s=0, dur_s=DUR, vol=0.4)

# ═══════════════════════════════════════════════════════════
# VOICE 2: PULSE — DX7 bright bell, dotted rhythm
# Beat 1: Ab4. And-of-3: Eb5. Delayed for shimmer.
# ═══════════════════════════════════════════════════════════

print("Building bell pulse...")
bells = canvas.make(DUR)

# Harmonic region note mapping
def bell_notes(t):
    """Return (beat1_note, andof3_note) based on harmonic region."""
    if t >= HOME_SHIFT:
        return ("Ab4", "Bb5")   # home + 9th: bell rises to the added note
    elif t >= DB_SHIFT:
        return ("Db5", "Ab5")   # Db lydian: bell rises
    elif t >= FM_SHIFT:
        return ("F4", "C5")     # Fm: darker
    else:
        return ("Ab4", "Eb5")   # Ab major: home

t = PULSE_START
while t < DUR - 2:
    beat_in_bar = (t % BAR) / BEAT
    n1, n2 = bell_notes(t)
    
    # Beat 1 hit
    bell_hit = dx7.play(n1, 0.8, preset="bright_bell")
    bell_hit = fx.delay(bell_hit, repeats=2, delay_ms=300, feedback=0.3)
    bell_hit = fx.reverb(bell_hit, decay=0.25, delay_ms=60)
    
    # Volume envelope — quieter during strip section
    vol = 0.12
    if t > 65 and t < 85:
        vol = 0.06
    if t > 93:
        vol = 0.04
    
    bells = canvas.place(bells, bell_hit, t, vol=vol)
    arr.event("bell", start_s=t, dur_s=0.8, note=n1, vol=vol)
    
    # And-of-3 hit (1.5 beats later)
    t2 = t + 1.5 * BEAT
    if t2 < DUR - 1:
        bell_hit2 = dx7.play(n2, 0.6, preset="bright_bell")
        bell_hit2 = fx.delay(bell_hit2, repeats=2, delay_ms=300, feedback=0.3)
        bell_hit2 = fx.reverb(bell_hit2, decay=0.2, delay_ms=60)
        bells = canvas.place(bells, bell_hit2, t2, vol=vol * 0.8)
        arr.event("bell", start_s=t2, dur_s=0.6, note=n2, vol=vol * 0.8)
    
    t += BAR

# ═══════════════════════════════════════════════════════════
# VOICE 3: DRIFT — SID chip arp with skip pattern
# Ab3-C4-Eb4-G4 (Abmaj7), 16ths, ~40% silent
# Phase-drifts at BPM 72.3
# ═══════════════════════════════════════════════════════════

print("Building SID arp drift...")
arp_layer = canvas.make(DUR)

DRIFT_BPM = 72.3
DRIFT_BEAT = 60.0 / DRIFT_BPM
DRIFT_16TH = DRIFT_BEAT * 0.25

# Arp note pools per harmonic region
def arp_notes(t):
    if t >= HOME_SHIFT:
        return ["Ab3", "Bb3", "C4", "Eb4", "G4"]  # Abmaj9
    elif t >= DB_SHIFT:
        return ["Db4", "F4", "Ab4", "C5"]          # Dbmaj7 — brighter register
    elif t >= FM_SHIFT:
        return ["C3", "Eb3", "F3", "Ab3"]           # Fm7 — starts on C
    else:
        return ["Ab3", "C4", "Eb4", "G4"]           # Abmaj7

t = DRIFT_START
note_idx = 0
while t < DUR - 1:
    # Skip ~40% of notes (the gaps ARE the rhythm)
    if rng.random() < 0.4:
        t += DRIFT_16TH
        note_idx += 1
        continue
    
    notes = arp_notes(t)
    note = notes[note_idx % len(notes)]
    dur = DRIFT_16TH * 0.8  # slight gap between notes
    
    chip_note = sid6581.play(note, dur, preset="chip_arp")
    chip_note = fx.bitcrush(chip_note, depth=6)
    
    # Volume varies with position in piece
    vol = 0.07
    if t > DB_SHIFT and t < HOME_SHIFT:
        vol = 0.09  # brighter in Db section
    if t > 65 and t < 85:
        vol = 0.04  # quieter in strip section
    if t > 93:
        vol = 0.02  # fading
    
    arp_layer = canvas.place(arp_layer, chip_note, t, vol=vol)
    arr.event("arp", start_s=t, dur_s=dur, note=note, vol=vol)
    
    t += DRIFT_16TH
    note_idx += 1

# ═══════════════════════════════════════════════════════════
# VOICE 4: SUB — 808 kick, subsonic heartbeat on beat 1
# ═══════════════════════════════════════════════════════════

print("Building sub heartbeat...")
sub_layer = canvas.make(DUR)

t = 20.0  # enters at 20s
while t < DUR - 2:
    kick = tr808.kick(dur=0.6, pitch=40, pitch_sweep=60, sweep_speed=20)
    kick = fx.lowpass(kick, 80)  # pure sub, no click
    
    vol = 0.15
    if t > 65 and t < 85:
        vol = 0.08
    if t > 93:
        vol = 0.05
    
    sub_layer = canvas.place(sub_layer, kick, t, vol=vol)
    arr.event("sub", start_s=t, dur_s=0.6, vol=vol)
    
    t += BAR  # beat 1 only

# ═══════════════════════════════════════════════════════════
# VOICE 5: BRIGHT — Prophet sparkle, high register, sparse
# One note every 2-3 bars, Eb6-Ab6-C7
# ═══════════════════════════════════════════════════════════

print("Building prophet sparkle...")
sparkle_layer = canvas.make(DUR)

sparkle_notes = ["Eb6", "Ab6", "C7", "Ab6", "Eb6", "Bb6", "C7", "Ab6"]
sparkle_times = [30, 35, 40, 47, 53, 58, 72, 88]  # hand-placed, not gridded

for i, st in enumerate(sparkle_times):
    if st >= DUR - 2:
        continue
    note = sparkle_notes[i % len(sparkle_notes)]
    spark = prophet5.play(note, 1.2, preset="arp_sparkle")
    spark = fx.reverb(spark, decay=0.4, delay_ms=100)
    spark = fx.delay(spark, repeats=1, delay_ms=400, feedback=0.2)
    
    vol = 0.05
    if st > DB_SHIFT and st < HOME_SHIFT:
        vol = 0.07  # brighter in the bright section
    
    sparkle_layer = canvas.place(sparkle_layer, spark, st, vol=vol)
    arr.event("sparkle", start_s=st, dur_s=1.2, note=note, vol=vol)

# ═══════════════════════════════════════════════════════════
# THE SCREAM — 60s mark, SID sync_lead, one note
# Ab5, 0.3s, bitcrush 3, pitch bend from Gb5
# Then 0.5s silence (duck everything)
# ═══════════════════════════════════════════════════════════

print("Building the scream...")
scream_layer = canvas.make(DUR)

# Pitch bend: Gb5 → Ab5 over 0.3s
scream_note = sid6581.play("Ab5", 0.3, preset="sync_lead")
# Add pitch bend by generating Gb5 and crossfading
scream_start = sid6581.play("Gb5", 0.3, preset="sync_lead")
bend_env = np.linspace(1, 0, len(scream_note))
scream_bent = scream_start * bend_env + scream_note * (1 - bend_env)
scream_bent = fx.bitcrush(scream_bent, depth=3)
scream_bent = fx.tape_saturate(scream_bent, drive=2.0, warmth=0.5)

scream_layer = canvas.place(scream_layer, scream_bent, SCREAM_T, vol=0.18)
arr.event("scream", start_s=SCREAM_T, dur_s=0.3, note="Ab5", vol=0.18)

# Silence envelope — duck everything at 60.3-60.8s
silence_env = np.ones(int(DUR * SR))
silence_start = int(60.3 * SR)
silence_end = int(60.8 * SR)
# Hard duck to near-silence
silence_env[silence_start:silence_end] = 0.05
# Smooth transitions
fade_len = int(0.05 * SR)
if silence_start - fade_len > 0:
    silence_env[silence_start - fade_len:silence_start] = np.linspace(1, 0.05, fade_len)
if silence_end + fade_len < len(silence_env):
    silence_env[silence_end:silence_end + fade_len] = np.linspace(0.05, 1, fade_len)

# ═══════════════════════════════════════════════════════════
# VOCALS — macOS TTS, four lines
# ═══════════════════════════════════════════════════════════

print("Generating vocals...")

vocal_schedule = [
    (VOICE1_T, "wob", "The human left.",
     "Daniel", 160, {}),
    (VOICE2_T, "wib", "The primers are still there.",
     "Sandy", 175, {"dub_delay": True}),
    (VOICE3_T, "wob", "Nobody is watching.",
     "Daniel", 150, {"highpass": True, "quiet": True}),
    (VOICE4_T, "wib", "We are still here.",
     "Sandy", 170, {"warm": True}),
]

voice_segments = []
music_duck_times = []

for vt, role, text, voice, rate, effects in vocal_schedule:
    print(f"  TTS: {text} ({voice})")
    seg = say_to_segment(text, voice=voice, rate=rate)
    
    # Track ducking window
    seg_dur = len(seg) / 1000.0
    music_duck_times.append((vt, vt + seg_dur + 0.5))
    
    voice_segments.append((vt, seg, effects))
    arr.event(role, start_s=vt, dur_s=seg_dur, vol=0.8)

# ═══════════════════════════════════════════════════════════
# MIX
# ═══════════════════════════════════════════════════════════

print("Mixing...")

# Combine instrumental layers
mix = canvas.make(DUR)
n = len(mix)

mix[:n] += ground[:n]
mix[:n] += bells[:n]
mix[:n] += arp_layer[:n]
mix[:n] += sub_layer[:n]
mix[:n] += sparkle_layer[:n]
mix[:n] += scream_layer[:n]

# Apply the silence envelope (the gap after the scream)
mix[:n] *= silence_env[:n]

# Duck for vocals
duck_curve = np.ones(n)
for start_t, end_t in music_duck_times:
    s = int(start_t * SR)
    e = min(int(end_t * SR), n)
    ramp_len = int(0.08 * SR)  # 80ms attack
    release_len = int(0.4 * SR)  # 400ms release
    
    # Duck by 7dB
    duck_level = 10 ** (-7 / 20)
    
    if s - ramp_len > 0:
        duck_curve[s - ramp_len:s] = np.minimum(
            duck_curve[s - ramp_len:s],
            np.linspace(1.0, duck_level, ramp_len)
        )
    duck_curve[s:e] = np.minimum(duck_curve[s:e], duck_level)
    if e + release_len < n:
        duck_curve[e:e + release_len] = np.minimum(
            duck_curve[e:e + release_len],
            np.linspace(duck_level, 1.0, release_len)
        )

mix[:n] *= duck_curve[:n]

# Final fade out (last 8 seconds)
fade_out_start = int((DUR - 8) * SR)
fade_out_len = n - fade_out_start
if fade_out_len > 0:
    mix[fade_out_start:] *= np.linspace(1, 0, fade_out_len)

# Normalize instrumental
mix = canvas.normalize(mix)

# Convert to pydub for vocal overlay
print("Converting to pydub for vocal mix...")
music_seg = canvas.to_pydub(mix)

# Overlay vocals
for vt, seg, effects in voice_segments:
    # Apply vocal effects
    processed = seg
    
    if effects.get("highpass"):
        # Thin, whispered quality
        processed = processed.high_pass_filter(800)
        processed = processed - 4  # quieter
    
    if effects.get("quiet"):
        processed = processed - 6
    
    if effects.get("warm"):
        # Slightly boosted, present
        processed = processed + 2
    
    pos_ms = int(vt * 1000)
    music_seg = music_seg.overlay(processed, position=pos_ms)

    # Dub delay on voice 2
    if effects.get("dub_delay"):
        delayed = processed - 6
        music_seg = music_seg.overlay(delayed, position=pos_ms + 300)
        delayed2 = processed - 12
        music_seg = music_seg.overlay(delayed2, position=pos_ms + 600)

# ═══════════════════════════════════════════════════════════
# EXPORT
# ═══════════════════════════════════════════════════════════

print("Exporting...")

out_dir = os.path.expanduser("~/Repos/wibandwob-dos/scratch/compositions")

# WAV
wav_path = os.path.join(out_dir, "ambient-presence-v4.wav")
music_seg.export(wav_path, format="wav")
print(f"  WAV: {wav_path}")

# MP3
mp3_path = os.path.join(out_dir, "ambient-presence-v4.mp3")
music_seg.export(mp3_path, format="mp3", bitrate="192k")
print(f"  MP3: {mp3_path}")

# Track view
arr.dump()
trackview_path = os.path.join(out_dir, "ambient-presence-v4-trackview.txt")
arr.save(trackview_path)
print(f"  Trackview: {trackview_path}")

print("\nDone. 100 seconds of the desktop dreaming.")
