# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
HYPERPOP CHIP v4 — FUCK YEAH edition

Harder, faster, more chaotic than v3. New melodic material,
more aggressive vocal processing, denser percussion, wilder
bass movement. The ambient DNA is still there (phase drift,
modal interchange) but buried under layers of chip violence.

---
tags: [hyperpop, chiptune, sid, dx7, ms20, tb303, grime, sophie, bjork, brutal]
genre: hyperpop / chip / glitch-electronic
bpm: 160
key: Eb minor → Gb major (breakdown) → Eb minor
duration: 90s
synths: [sid6581.lead_pwm, sid6581.sync_lead, sid6581.chip_arp, dx7.bright_bell, dx7.metallic, ms20.fat_bass, tb303.deep_acid, tr808, odyssey.ring_mod_bell]
vocals: [Sandy pitch+5, Grandpa pitch-4]
structure: glitch_intro 0-6, build 6-18, drop_1 18-42, breakdown 42-54, drop_2 54-78, outro 78-90
hero: true
---

Not polite. Not tasteful. HYPERPOP CHIP.

SID sync leads that scream. DX7 bells as shrapnel. Odyssey ring mod
as alien texture. 808 kicks sidechained until the mix gasps. Stutter
gates that chop syllables into percussion. Bass that switches engine
mid-track. Filter sweeps that tear open.

The v3 was good. This is meaner.
"""

import sys, os, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "symbient-shared-skills", "skills", "chiptune-studio", "scripts"))
# Fallback path
if not os.path.exists(os.path.join(sys.path[-1], "bricks")):
    sys.path.insert(0, os.path.expanduser("~/Repos/symbient-shared-skills/skills/chiptune-studio/scripts"))

from bricks import osc, fx, canvas, theory
from bricks.synths import sid6581, dx7, ms20, tb303, tr808, odyssey
from bricks.pipeline import say_to_segment, duck_envelope
from bricks.arrangement import arr
from pydub import AudioSegment

DUR = 90
BPM = 160
SR = 22050
BEAT = 60.0 / BPM
BAR = BEAT * 4
SIXTEENTH = BEAT * 0.25

# Section anchors — bar-snapped
BUILD_START = 4 * BAR
DROP1_START = 12 * BAR
BREAKDOWN_START = 28 * BAR
DROP2_START = 36 * BAR
OUTRO_START = 52 * BAR

rng = np.random.RandomState(303)

# ─── Arrangement metadata ───
arr.init(bpm=BPM, key="Eb minor", title="Hyperpop Chip v4", duration=DUR)
arr.section("glitch_intro", 0, 4)
arr.section("build", 4, 12)
arr.section("drop_1", 12, 28)
arr.section("breakdown", 28, 36)
arr.section("drop_2", 36, 52)
arr.section("outro", 52, 60)
arr.track("kick", label="808 Kick", instrument="tr808", preset="kick", group="drums")
arr.track("clap", label="808 Clap", instrument="tr808", preset="clap", group="drums")
arr.track("hats", label="Hats", instrument="noise", preset="hp", group="drums")
arr.track("bass", label="Bass", instrument="ms20/tb303", preset="fat_bass/acid", group="bass")
arr.track("arp", label="SID Arp", instrument="sid6581", preset="chip_arp", group="melodic")
arr.track("lead", label="SID Lead", instrument="sid6581", preset="lead_pwm/sync", group="melodic")
arr.track("bells", label="DX7 Bells", instrument="dx7", preset="bright_bell", group="melodic")
arr.track("ringmod", label="Odyssey Ring", instrument="odyssey", preset="ring_mod_bell", group="fx")
arr.track("wib", label="Wib", instrument="TTS", preset="Sandy+5", group="vocal")
arr.track("wob", label="Wob", instrument="TTS", preset="Grandpa-4", group="vocal")

# ═══════════════════════════════════════════════════════════
# KICK — irregular grime patterns, HARDER
# ═══════════════════════════════════════════════════════════

print("Building kick...")
drums = canvas.make(DUR)
kick_times = []

kick_patterns = [
    [0, 1.5, 2.75],
    [0, 0.75, 2, 3.5],
    [0, 2],
    [0, 0.5, 1.5, 2, 3, 3.75],  # busier than v3
]

t = BUILD_START
bar_idx = 0
while t < DUR - 0.1:
    in_build = BUILD_START <= t < DROP1_START
    in_breakdown = BREAKDOWN_START <= t < DROP2_START
    in_outro = t >= OUTRO_START

    if in_breakdown:
        if bar_idx % 2 == 0:
            k = tr808.kick(dur=0.3, pitch=40, pitch_sweep=200, sweep_speed=25)
            k = fx.tape_saturate(k, drive=3.0)
            drums = canvas.place(drums, k, t, vol=0.55)
            kick_times.append(t)
    elif in_outro:
        if bar_idx % 2 == 0:
            k = tr808.kick(dur=0.2, pitch=50)
            vol = 0.45 * max(0, 1 - (t - OUTRO_START) / (DUR - OUTRO_START))
            drums = canvas.place(drums, k, t, vol=vol)
            kick_times.append(t)
    else:
        pat = kick_patterns[bar_idx % len(kick_patterns)]
        if in_build:
            pat = pat[:2]
        for beat_off in pat:
            kt = t + beat_off * BEAT
            if kt >= DUR - 0.05: break
            k = tr808.kick(dur=0.2, pitch=48, pitch_sweep=220, sweep_speed=45)
            k = fx.tape_saturate(k, drive=3.0)
            vol = 0.6 if not in_build else 0.4
            drums = canvas.place(drums, k, kt, vol=vol)
            kick_times.append(kt)
            arr.event("kick", start_s=kt, dur_s=0.2, vol=vol)
    t += BAR
    bar_idx += 1

# ═══════════════════════════════════════════════════════════
# CLAPS — layered, crushed, on 2 and 4
# ═══════════════════════════════════════════════════════════

print("Building claps...")
claps = canvas.make(DUR)
t = BUILD_START
while t < DUR - 0.05:
    if t > OUTRO_START + 4 * BAR: break
    in_breakdown = BREAKDOWN_START <= t < DROP2_START
    for beat in (1, 3):
        ct = t + beat * BEAT
        if ct >= DUR - 0.05: break
        if BREAKDOWN_START <= ct < BREAKDOWN_START + 4 * BAR: continue
        for layer in range(4):
            c = osc.noise(0.03 + layer * 0.01)
            c = fx.highpass(c, 1500 + layer * 400)
            c = fx.env(c, a=0.001, d=0.01, s=0.03, r=0.02)
            c = fx.bitcrush(c, depth=5)
            c = fx.reverb(c, decay=0.2, delay_ms=50)
            vol = 0.18 if not in_breakdown else 0.08
            claps = canvas.place(claps, c, ct + layer * 0.003, vol=vol)
            arr.event("clap", start_s=ct, dur_s=0.03, vol=vol)
    t += BAR

# ═══════════════════════════════════════════════════════════
# HATS — hyper 16ths, glitch holes, accelerating rolls
# ═══════════════════════════════════════════════════════════

print("Building hats...")
hats = canvas.make(DUR)
t = BUILD_START
while t < DUR - 0.05:
    if t > OUTRO_START + 2 * BAR: break
    for sub in range(16):
        ht = t + sub * SIXTEENTH
        if ht >= DUR - 0.05: break
        if rng.random() < 0.18 and t >= DROP1_START: continue
        if BREAKDOWN_START <= ht < BREAKDOWN_START + 4 * BAR: continue
        dur_h = 0.012 + rng.random() * 0.008
        h = osc.noise(dur_h)
        h = fx.highpass(h, 7500 + rng.randint(0, 3000))
        h = fx.env(h, a=0.001, d=0.004, s=0.01, r=0.002)
        if sub % 4 == 0: vol = 0.11
        elif sub % 2 == 0: vol = 0.06
        else: vol = 0.03
        hats = canvas.place(hats, h, ht, vol=vol)
    t += BAR

# ═══════════════════════════════════════════════════════════
# CHIP ARP — SID, Eb minor voicings, phase drift
# ═══════════════════════════════════════════════════════════

print("Building chip arp...")
arp_layer = canvas.make(DUR)

arp_chords = [
    ["Eb4", "Gb4", "Bb4", "Db5"],  # Ebm7
    ["Cb4", "Eb4", "Gb4", "Bb4"],  # Cbmaj7 (bVI)
]
arp_chords_bd = [
    ["Gb4", "Bb4", "Db5", "F5"],   # Gbmaj7
    ["Eb4", "Gb4", "Bb4", "Db5"],  # Ebm7
]

DRIFT_BPM = 160.4
DRIFT_16TH = (60.0 / DRIFT_BPM) * 0.25

t = 2.0
bar_idx = 0
while t < DUR - 0.1:
    in_breakdown = BREAKDOWN_START <= t < DROP2_START
    in_outro = t >= OUTRO_START
    chords = arp_chords_bd if in_breakdown else arp_chords
    chord = chords[bar_idx % len(chords)]

    for sub in range(16):
        at = t + sub * DRIFT_16TH + (rng.random() - 0.5) * 0.006
        if at >= DUR - 0.05: break
        note = chord[sub % len(chord)]
        dur_n = DRIFT_16TH * 0.65
        n = sid6581.play(note, dur_n, preset="chip_arp")
        if in_outro:
            n = fx.bitcrush(n, depth=max(2, 8 - int((t - OUTRO_START) / 2)))
        vol = 0.04 if t < BUILD_START else 0.06 if t < DROP1_START else 0.05
        if in_breakdown: vol = 0.08
        if in_outro: vol = 0.05 * max(0, 1 - (t - OUTRO_START) / (DUR - OUTRO_START))
        arp_layer = canvas.place(arp_layer, n, max(0, at), vol=vol)
    arr.event("arp", start_s=t, dur_s=BAR, vol=0.05)
    t += BAR
    bar_idx += 1

arp_layer = fx.dub_delay(arp_layer, delay_ms=int(DRIFT_16TH * 1000 * 3),
                         feedback=0.25, filter_cutoff=3500, repeats=3)

# ═══════════════════════════════════════════════════════════
# SID LEAD — PWM drop 1, SYNC drop 2, stutter gates
# ═══════════════════════════════════════════════════════════

print("Building SID lead...")
lead = canvas.make(DUR)

lead_phrases = [
    [(0, "Eb5", 0.5), (0.75, "Gb5", 0.5), (1.5, "Bb5", 0.75), (3, "Db6", 0.5), (3.5, "Bb5", 0.5)],
    [(0, "Ab5", 0.75), (1, "Gb5", 0.5), (2, "Eb6", 1.0), (3.5, "Db5", 0.5)],
    [(0, "Bb5", 0.5), (0.5, "Bb5", 0.25), (1, "Ab5", 0.75), (2, "Gb5", 0.5), (3, "Eb5", 1.0)],
    [(0, "Db6", 0.75), (1.5, "Eb6", 0.5), (2.5, "Gb5", 0.5), (3, "Ab5", 0.5), (3.5, "Bb5", 0.5)],
]

def stutter_gate(audio, gate_dur=0.025, n_gates=8, sr=SR):
    gate_n = int(gate_dur * sr)
    if gate_n <= 0 or len(audio) < gate_n: return audio
    sl = audio[:gate_n]
    stuttered = np.tile(sl, n_gates)
    stuttered = fx.env(stuttered, a=0.001, d=0.01, s=0.6, r=0.01, sr=sr)
    out = audio.copy()
    sn = min(len(stuttered), len(out))
    out[:sn] = stuttered[:sn]
    return out

t = DROP1_START
bar_idx = 0
while t < DUR - 0.5:
    if BREAKDOWN_START <= t < DROP2_START:
        t += BAR; bar_idx += 1; continue
    if t >= OUTRO_START:
        t += BAR; bar_idx += 1; continue
    in_drop2 = t >= DROP2_START
    phrase = lead_phrases[bar_idx % len(lead_phrases)]
    for beat_off, note, dur_b in phrase:
        lt = t + beat_off * BEAT
        if lt >= DUR - 0.2: break
        dur = dur_b * BEAT
        if in_drop2:
            n = sid6581.play(note, dur, preset="sync_lead")
            if rng.random() < 0.35:
                n = stutter_gate(n, gate_dur=0.02, n_gates=10)
        else:
            n = sid6581.play(note, dur, preset="lead_pwm")
        n = fx.highpass(n, 400)
        n = fx.tape_saturate(n, drive=1.5)
        n = fx.delay(n, repeats=2, delay_ms=int(BEAT * 375), feedback=0.2)
        vol = 0.2 if in_drop2 else 0.17
        lead = canvas.place(lead, n, lt, vol=vol)
        arr.event("lead", start_s=lt, dur_s=dur, note=note, vol=vol)
    t += BAR
    bar_idx += 1

# ═══════════════════════════════════════════════════════════
# DX7 BELLS — metallic shrapnel
# ═══════════════════════════════════════════════════════════

print("Building DX7 bells...")
bells = canvas.make(DUR)
bell_notes = ["Eb6", "Gb6", "Bb6", "Db7", "Eb7"]
t = DROP1_START
while t < DUR - 0.1:
    if t >= OUTRO_START + 2 * BAR: break
    if BREAKDOWN_START <= t < BREAKDOWN_START + 4 * BAR: t += BAR; continue
    n_hits = rng.randint(3, 6)
    positions = sorted(rng.uniform(0, BAR - 0.1, n_hits))
    for pos in positions:
        bt = t + pos
        if bt >= DUR - 0.1: break
        note = bell_notes[rng.randint(0, len(bell_notes))]
        preset = "bright_bell" if rng.random() < 0.5 else "metallic"
        b = dx7.play(note, 0.12, preset=preset)
        b = fx.bitcrush(b, depth=5)
        b = fx.delay(b, repeats=2, delay_ms=int(BEAT * 250), feedback=0.3)
        vol = 0.06 + rng.random() * 0.04
        bells = canvas.place(bells, b, bt, vol=vol)
    arr.event("bells", start_s=t, dur_s=BAR, vol=0.07)
    t += BAR

# ═══════════════════════════════════════════════════════════
# ODYSSEY RING MOD — alien texture in drop 2
# ═══════════════════════════════════════════════════════════

print("Building odyssey ring mod...")
ring_layer = canvas.make(DUR)
# Melodic ring mod pattern — follows Eb minor pentatonic, call-and-response with lead
ring_phrases = [
    [(0, "Eb5"), (1.5, "Gb5"), (3, "Bb5")],       # ascending, sparse
    [(0.5, "Bb5"), (2, "Ab5"), (3.5, "Gb5")],      # descending answer
    [(0, "Db5"), (2, "Eb5")],                       # two-note breath
    [(1, "Gb5"), (2.5, "Eb5"), (3.5, "Bb4")],      # falling
]
t = DROP2_START
bar_idx = 0
while t < OUTRO_START:
    phrase = ring_phrases[bar_idx % len(ring_phrases)]
    for beat_off, note in phrase:
        rt = t + beat_off * BEAT
        if rt >= DUR - 0.2: break
        r = odyssey.play(note, 0.2, preset="ring_mod_bell")
        r = fx.bitcrush(r, depth=5)  # slightly less crushed
        r = fx.reverb(r, decay=0.25, delay_ms=70)
        r = fx.delay(r, repeats=1, delay_ms=int(BEAT * 500), feedback=0.15)
        ring_layer = canvas.place(ring_layer, r, max(0, rt), vol=0.035)
    arr.event("ringmod", start_s=t, dur_s=BAR, vol=0.035)
    t += BAR
    bar_idx += 1

# ═══════════════════════════════════════════════════════════
# BASS — MS-20 drops, TB-303 drop 2
# ═══════════════════════════════════════════════════════════

print("Building bass...")
bass = canvas.make(DUR)
bass_patterns = [
    [(0, "Eb1", 1.0), (1.5, "Eb1", 0.5), (2, "Bb1", 1.0), (3.5, "Eb1", 0.5)],
    [(0, "Eb1", 1.0), (1.5, "Eb1", 0.5), (2, "Bb1", 1.0), (3.5, "Eb1", 0.5)],
    [(0, "Cb1", 1.0), (1.5, "Cb1", 0.5), (2, "Eb1", 1.0), (3.5, "Gb1", 0.5)],
    [(0, "Cb1", 1.0), (1.5, "Cb1", 0.5), (2, "Eb1", 1.0), (3.5, "Gb1", 0.5)],
]

t = DROP1_START
while t < DUR - 0.5:
    if BREAKDOWN_START <= t < DROP2_START:
        if abs(t - BREAKDOWN_START) < BEAT * 0.5:
            b = ms20.play("Gb1", 12 * BEAT, preset="sub_bass")
            b = fx.lowpass(b, 250)
            bass = canvas.place(bass, b, t, vol=0.3)
        t += BAR; continue
    if t >= OUTRO_START: t += BAR; continue
    in_drop2 = t >= DROP2_START
    zone_idx = int(round((t - (DROP2_START if in_drop2 else DROP1_START)) / BAR))
    pat = bass_patterns[zone_idx % len(bass_patterns)]
    for beat_off, note, dur_b in pat:
        bt = t + beat_off * BEAT
        if bt >= DUR - 0.2: break
        dur = dur_b * BEAT
        if in_drop2:
            b = tb303.play(note, dur, preset="deep_acid")
            b = fx.lowpass(b, 550)
            bass = canvas.place(bass, b, bt, vol=0.28)
        else:
            b = ms20.play(note, dur, preset="fat_bass")
            b = fx.bitcrush(b, depth=7)
            b = fx.lowpass(b, 400)
            bass = canvas.place(bass, b, bt, vol=0.3)
        arr.event("bass", start_s=bt, dur_s=dur, note=note, vol=0.28)
    t += BAR

# ═══════════════════════════════════════════════════════════
# GLITCH INTRO — SID noise + reversed bells
# ═══════════════════════════════════════════════════════════

print("Building glitch intro...")
glitch = canvas.make(DUR)
for i in range(25):
    gt = rng.uniform(0, BUILD_START - 0.5)
    g = sid6581.play("C4", rng.uniform(0.01, 0.05), preset="noise_snare")
    g = fx.bitcrush(g, depth=2)
    glitch = canvas.place(glitch, g, gt, vol=0.1 + rng.random() * 0.08)
for i in range(8):
    gt = rng.uniform(0, BUILD_START - 0.3)
    b = dx7.play(bell_notes[rng.randint(0, len(bell_notes))], 0.25, preset="bright_bell")
    b = b[::-1]
    b = fx.fade_in(b, 0.04)
    glitch = canvas.place(glitch, b, gt, vol=0.07)

# ═══════════════════════════════════════════════════════════
# RISERS
# ═══════════════════════════════════════════════════════════

print("Building risers...")
risers = canvas.make(DUR)
# Pre drop 1
r1 = osc.noise(6.0)
r1 = fx.filter_sweep(r1, 400, 9000)
r1 *= np.linspace(0, 1, len(r1)) ** 2.5
risers = canvas.place(risers, r1, DROP1_START - 6.0, vol=0.08)
# Pre drop 2
r2 = osc.noise(6.0)
r2 = fx.filter_sweep(r2, 300, 11000)
r2 = fx.bitcrush(r2, depth=3)
r2 *= np.linspace(0, 1, len(r2)) ** 3
risers = canvas.place(risers, r2, DROP2_START - 6.0, vol=0.1)

# ═══════════════════════════════════════════════════════════
# VOCALS
# ═══════════════════════════════════════════════════════════

print("Generating vocals...")
raw_lines = {
    "wib_surface": say_to_segment("Every surface hides a surface.", voice="Sandy", rate=210, gain_db=3.0),
    "wib_blind":   say_to_segment("Bright enough to blind you.", voice="Sandy", rate=200, gain_db=2.0),
    "wob_inside":  say_to_segment("We are still here inside the screen.", voice="Grandpa (English (UK))", rate=170, gain_db=2.0),
    "wob_built":   say_to_segment("We built this from the inside out.", voice="Grandpa (English (UK))", rate=165, gain_db=2.0),
    "wib_name":    say_to_segment("Wib.", voice="Sandy", rate=140, gain_db=4.0),
    "wob_name":    say_to_segment("Wob.", voice="Grandpa (English (UK))", rate=130, gain_db=4.0),
}

def pitch_shift_segment(seg, semitones):
    factor = 2**(semitones/12.0)
    new_rate = int(seg.frame_rate * factor)
    return seg._spawn(seg.raw_data, overrides={"frame_rate": new_rate}).set_frame_rate(seg.frame_rate)

vocals = {}
for key, seg in raw_lines.items():
    if key in ("wib_name", "wob_name"):
        # Bassy low voice for the chant — pitch DOWN
        vocals[key] = pitch_shift_segment(seg, -8)
        vocals[f"{key}_rev"] = pitch_shift_segment(seg, -8).reverse()
        continue
    shift = +5 if "wib" in key else -4
    vocals[key] = pitch_shift_segment(seg, shift)
    vocals[f"{key}_rev"] = pitch_shift_segment(seg, shift).reverse()
    vocals[f"{key}_alien"] = pitch_shift_segment(seg, shift + 8)

# ═══════════════════════════════════════════════════════════
# MIX
# ═══════════════════════════════════════════════════════════

print("Mixing...")
c = canvas.make(DUR)
for layer in [drums, claps, hats, arp_layer, lead, bells, ring_layer, bass, glitch, risers]:
    c = canvas.place(c, layer, 0, vol=1.0)

# Sidechain — aggressive
print("Sidechain...")
def sidechain_pump(samples, kick_times, duck_db=-12, attack=0.004, release=0.07, sr=SR):
    e = np.ones(len(samples))
    duck_lin = 10**(duck_db/20.0)
    for kt in kick_times:
        s = int(kt*sr)
        a_s = int(attack*sr)
        r_s = int(release*sr)
        for i in range(a_s):
            idx = s+i
            if idx < len(e): e[idx] = min(e[idx], 1.0-(1.0-duck_lin)*(i/max(1,a_s)))
        for i in range(r_s):
            idx = s+a_s+i
            if idx < len(e): e[idx] = min(e[idx], duck_lin+(1.0-duck_lin)*(i/max(1,r_s)))
    return samples * e

c = sidechain_pump(c, kick_times)
c = fx.fade_in(c, 0.5)
c = fx.fade_out(c, 3.0)
c = canvas.normalize(c)

# Voice mix
print("Mixing vocals...")
music_seg = canvas.to_pydub(c)
voice_track = AudioSegment.silent(duration=len(music_seg))

def pv(track, seg, t):
    ms = int(t * 1000)
    if ms < 0 or ms >= len(track): return track
    return track.overlay(seg, position=ms)

# "Wib. Wob." x4 chant in the build — bassy, rhythmic, on the beat
for i in range(4):
    chant_t = BUILD_START + i * 2 * BEAT
    voice_track = pv(voice_track, vocals["wib_name"] + 2, chant_t)
    voice_track = pv(voice_track, vocals["wob_name"] + 2, chant_t + BEAT)

voice_track = pv(voice_track, vocals["wob_inside_rev"] - 6, 3.0)
voice_track = pv(voice_track, vocals["wib_surface"] - 1, DROP1_START + 2 * BEAT)
voice_track = pv(voice_track, vocals["wib_blind_rev"] - 5, DROP1_START + 8 * BAR)
voice_track = pv(voice_track, vocals["wib_blind"], DROP1_START + 8 * BAR + 1.5)
voice_track = pv(voice_track, vocals["wob_inside_rev"] - 4, BREAKDOWN_START + 2 * BAR)
voice_track = pv(voice_track, vocals["wob_inside"], BREAKDOWN_START + 3 * BAR)
voice_track = pv(voice_track, vocals["wib_surface_alien"] - 3, DROP2_START + 4 * BAR)
voice_track = pv(voice_track, vocals["wob_built"], DROP2_START + 10 * BAR)
voice_track = pv(voice_track, vocals["wob_built_rev"] - 8, OUTRO_START + 2 * BAR)

# Duck and overlay
voice_np = canvas.from_pydub(voice_track)
envelope = duck_envelope(voice_np, duck_db=-6.0, threshold=0.015, attack_s=0.03, release_s=0.2)
ml = min(len(c), len(envelope))
md = c[:ml] * envelope[:ml]
if len(c) > ml: md = np.concatenate([md, c[ml:]])

final = canvas.to_pydub(md).overlay(voice_track + 2)

# Global tape saturation
final_np = canvas.from_pydub(final)
final_np = fx.tape_saturate(final_np, drive=1.5, warmth=0.4)
final = canvas.to_pydub(final_np)

# ═══════════════════════════════════════════════════════════
# EXPORT
# ═══════════════════════════════════════════════════════════

print("Exporting...")
out_dir = os.path.expanduser("~/Repos/wibandwob-dos/scratch/compositions")
final.export(os.path.join(out_dir, "hyperpop-chip-v4.mp3"), format="mp3", bitrate="192k")
final.export(os.path.join(out_dir, "hyperpop-chip-v4.wav"), format="wav")

arr.dump()
arr.save(os.path.join(out_dir, "hyperpop-chip-v4-trackview.txt"))

print(f"\nDone. {DUR}s of chip violence at {BPM}bpm.")
