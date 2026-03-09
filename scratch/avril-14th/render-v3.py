#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
import os
import sys
import numpy as np
from scipy import signal as sp

sys.path.insert(0, "/Users/james/Repos/wibandwob-dos/.pi/skills/chiptune-studio/scripts")
from bricks import *

SR = 22050
BPM = 72
BEAT = 60.0 / BPM
BAR = 3.0 * BEAT
TOTAL = 124.0

ACT1_START = 0.0
ACT2_START = 38.0
ACT3_START = 88.0
END_TIME = 124.0

OUT_WAV = "/Users/james/Repos/wibandwob-dos/scratch/compositions/avril-14th-v3.wav"
OUT_MP3 = "/Users/james/Repos/wibandwob-dos/scratch/compositions/avril-14th-v3.mp3"

# q=1 beat, e=0.5 beat, h.=3 beats
PHRASE_A = [
    (0.0, "E5", 1.0),
    (1.0, "E5", 0.5),
    (1.5, "F#5", 0.5),
    (2.0, "E5", 1.0),
    (3.0, "C#5", 1.0),
    (4.0, "B4", 1.0),
    (5.0, "A4", 1.0),
    (6.0, "B4", 1.0),
    (7.0, "C#5", 0.5),
    (7.5, "E5", 0.5),
    (8.0, "E5", 1.0),
    (9.0, "C#5", 3.0),
]
PHRASE_B = [
    (0.0, "A5", 1.0),
    (1.0, "G#5", 0.5),
    (1.5, "F#5", 0.5),
    (2.0, "E5", 1.0),
    (3.0, "E5", 1.0),
    (4.0, "C#5", 1.0),
    (5.0, "B4", 1.0),
    (6.0, "A4", 1.0),
    (7.0, "B4", 0.5),
    (7.5, "C#5", 0.5),
    (8.0, "E5", 1.0),
    (9.0, "B4", 3.0),
]
PHRASE_DUR = 12.0 * BEAT

LH_CYCLE = [
    ("A2", "E3", "A3"),
    ("A2", "E3", "A3"),
    ("A2", "E3", "A3"),
    ("A2", "E3", "A3"),
    ("D3", "A3", "D4"),
    ("D3", "A3", "D4"),
    ("D3", "A3", "D4"),
    ("D3", "A3", "D4"),
    ("E3", "B3", "E4"),
    ("E3", "B3", "E4"),
    ("E3", "B3", "E4"),
    ("E3", "B3", "E4"),
    ("A2", "E3", "A3"),
    ("A2", "E3", "A3"),
    ("A2", "E3", "A3"),
    ("A2", "E3", "A3"),
]


def melody_note(name: str, dur_beats: float, vol: float = 0.20, crush_depth: int | None = None) -> np.ndarray:
    dur_s = max(0.01, dur_beats * BEAT)
    freq = note_freq(name)
    t = np.linspace(0, dur_s, int(SR * dur_s), endpoint=False)

    vib_depth = 0.003
    vib_rate = 5.0
    vib_onset = 0.08
    vib_ramp = 0.08
    vib_env = np.clip((t - vib_onset) / vib_ramp, 0.0, 1.0)
    freq_mod = freq * (1.0 + vib_depth * np.sin(2.0 * np.pi * vib_rate * t) * vib_env)
    phase = np.cumsum(2.0 * np.pi * freq_mod / SR)
    audio = sp.sawtooth(phase, width=0.5).astype(np.float64)

    release = min(0.35, max(0.10, dur_s * 0.45))
    audio = env(audio, a=0.004, d=0.15, s=0.28, r=release)
    if crush_depth is not None:
        audio = bitcrush(audio, depth=crush_depth)
    return audio * vol


def ghost_note(name: str, dur_beats: float, vol: float = 0.04) -> np.ndarray:
    dur_s = max(0.01, dur_beats * BEAT)
    freq_hi = note_freq(name) * 2.0
    base = triangle(freq_hi, dur_s)
    shaped = env(base, a=0.004, d=0.15, s=0.28, r=min(0.25, dur_s * 0.4))
    return shaped * vol


def lh_note(name: str, dur_beats: float, vol: float = 0.055) -> np.ndarray:
    dur_s = max(0.01, dur_beats * BEAT)
    base = triangle(note_freq(name), dur_s)
    shaped = env(base, a=0.004, d=0.15, s=0.28, r=min(0.25, dur_s * 0.4))
    return lowpass(shaped * vol, cutoff=500)


def place_phrase(
    canvas: np.ndarray,
    phrase: list[tuple[float, str, float]],
    start_s: float,
    vol_mul: float,
    ghost_every: int | None = None,
    crush_depth: int | None = None,
) -> tuple[np.ndarray, int]:
    note_count = 0
    for beat_off, note, dur_b in phrase:
        t0 = start_s + beat_off * BEAT
        if t0 >= END_TIME:
            continue
        nd = melody_note(note, dur_b, vol=0.20 * vol_mul, crush_depth=crush_depth)
        canvas = place(canvas, nd, t0)
        if ghost_every and ghost_every > 0 and note_count % ghost_every == 0:
            g = ghost_note(note, dur_b, vol=0.04 * vol_mul)
            canvas = place(canvas, g, t0)
        note_count += 1
    return canvas, note_count


def place_lh_section(canvas: np.ndarray, start_s: float, end_s: float) -> np.ndarray:
    if end_s <= start_s:
        return canvas
    bars = int((end_s - start_s) // BAR)
    for bar_idx in range(bars):
        bar_start = start_s + bar_idx * BAR
        triad = LH_CYCLE[bar_idx % len(LH_CYCLE)]
        # Ramp from subtle entrance to target softness.
        ramp = 0.65 + 0.35 * (bar_idx / max(1, bars - 1))
        for beat_idx, n in enumerate(triad):
            t0 = bar_start + beat_idx * BEAT
            if t0 >= END_TIME:
                continue
            nd = lh_note(n, 0.92, vol=0.055 * ramp)
            canvas = place(canvas, nd, t0)
    return canvas


def place_last_10s_single_notes(canvas: np.ndarray, start_s: float) -> np.ndarray:
    # Sparse final notes only (last 10 seconds).
    final = [
        (0.0, "E5", 1.4, 0.11),
        (2.6, "C#5", 1.4, 0.095),
        (5.1, "B4", 1.6, 0.085),
        (7.4, "A4", 2.2, 0.072),
    ]
    for off_s, note, dur_b, vol in final:
        t0 = start_s + off_s
        if t0 >= END_TIME:
            continue
        nd = melody_note(note, dur_b, vol=vol, crush_depth=7)
        canvas = place(canvas, nd, t0)
    return canvas


def main() -> int:
    os.makedirs(os.path.dirname(OUT_WAV), exist_ok=True)
    c = make(TOTAL)

    print("Act 1: PHRASE_A x2, melody only (no left hand)")
    act1_t = ACT1_START + 9.0
    c, _ = place_phrase(c, PHRASE_A, act1_t, vol_mul=0.92)
    c, _ = place_phrase(c, PHRASE_A, act1_t + PHRASE_DUR, vol_mul=0.94)
    print(f"  timing check: act1_start={ACT1_START:.1f}s act2_start={ACT2_START:.1f}s")

    print("Act 2: PHRASE_B x1, PHRASE_A x1, PHRASE_B x1; LH enters at bar 3 and builds")
    c, _ = place_phrase(c, PHRASE_B, ACT2_START, vol_mul=1.00, ghost_every=4)
    c, _ = place_phrase(c, PHRASE_A, ACT2_START + PHRASE_DUR, vol_mul=1.04, ghost_every=4)
    c, _ = place_phrase(c, PHRASE_B, ACT2_START + (2.0 * PHRASE_DUR), vol_mul=1.08, ghost_every=4)
    lh_start = ACT2_START + (2.0 * BAR)
    c = place_lh_section(c, lh_start, ACT3_START)
    print(
        f"  timing check: lh_start={lh_start:.1f}s act2_end={ACT3_START:.1f}s "
        f"phrase_window={ACT2_START:.1f}-{ACT2_START + 3.0 * PHRASE_DUR:.1f}s"
    )

    print("Act 3: stripped PHRASE_A with bitcrush, then last-10s sparse notes")
    c, _ = place_phrase(c, PHRASE_A, ACT3_START + 2.0, vol_mul=0.62, crush_depth=7)
    c = place_last_10s_single_notes(c, END_TIME - 10.0)
    print(f"  timing check: act3_start={ACT3_START:.1f}s final_10s_start={END_TIME - 10.0:.1f}s")

    c = fade_out(c, 6.0)
    c = normalize(c, peak_db=-3.0)
    save_wav(c, OUT_WAV)

    print(f"Saved wav: {OUT_WAV}")
    mp3_status = "not attempted"
    try:
        export_mp3(c, OUT_MP3, bitrate="192k", fade_out_ms=0, normalize_audio=False)
        mp3_status = f"saved mp3: {OUT_MP3}"
    except Exception as exc:
        mp3_status = f"mp3 skipped: {exc}"
    print(mp3_status)
    print(f"Duration: {len(c) / SR:.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
