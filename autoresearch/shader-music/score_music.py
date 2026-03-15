# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""
Automated music quality scorer for shader-driven chiptune.

Analyses output.wav and shader_data.json to produce a variety score (0-100).

Dimensions:
  1. Pitch variety     — how many distinct notes used, range covered
  2. Rhythmic variety  — step-to-step brightness changes, not monotone
  3. Dynamic range     — spread between quiet and loud moments
  4. Track independence — tracks aren't all doing the same thing
  5. Silence usage     — some silence is good, all silence is bad
"""

import sys, os, json
import numpy as np
from scipy.io import wavfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def score_shader_data(data):
    """Score based on shader brightness patterns."""
    tracks = data["track_brightness"]
    scores = {}

    # 1. Pitch variety — how spread out are brightness values per track?
    pitch_scores = []
    for name, vals in tracks.items():
        vals = np.array(vals)
        unique = len(np.unique(np.round(vals, 2)))
        spread = np.std(vals)
        # More unique values + wider spread = better
        pitch_scores.append(min(1.0, unique / 15.0) * 0.5 + min(1.0, spread / 0.3) * 0.5)
    scores["pitch_variety"] = np.mean(pitch_scores) * 100

    # 2. Rhythmic variety — step-to-step changes
    rhythm_scores = []
    for name, vals in tracks.items():
        vals = np.array(vals)
        if len(vals) < 2:
            rhythm_scores.append(0)
            continue
        diffs = np.abs(np.diff(vals))
        # Good rhythm has lots of changes, not flat
        change_rate = np.mean(diffs > 0.01)
        change_magnitude = np.mean(diffs)
        rhythm_scores.append(change_rate * 0.6 + min(1.0, change_magnitude / 0.2) * 0.4)
    scores["rhythmic_variety"] = np.mean(rhythm_scores) * 100

    # 3. Dynamic range — spread between min and max brightness
    dyn_scores = []
    for name, vals in tracks.items():
        vals = np.array(vals)
        dyn_range = np.max(vals) - np.min(vals)
        dyn_scores.append(min(1.0, dyn_range / 0.5))
    scores["dynamic_range"] = np.mean(dyn_scores) * 100

    # 4. Track independence — low correlation between tracks
    track_arrays = [np.array(v) for v in tracks.values()]
    if len(track_arrays) >= 2:
        correlations = []
        for i in range(len(track_arrays)):
            for j in range(i + 1, len(track_arrays)):
                if np.std(track_arrays[i]) > 0 and np.std(track_arrays[j]) > 0:
                    corr = abs(np.corrcoef(track_arrays[i], track_arrays[j])[0, 1])
                    correlations.append(corr)
        if correlations:
            avg_corr = np.mean(correlations)
            # Lower correlation = more independent = better
            scores["track_independence"] = (1.0 - avg_corr) * 100
        else:
            scores["track_independence"] = 50
    else:
        scores["track_independence"] = 50

    # 5. Silence usage — some is good (5-30%), too much or none is bad
    silence_scores = []
    for name, vals in tracks.items():
        vals = np.array(vals)
        silence_pct = np.mean(vals < 0.05)
        # Ideal: 10-25% silence
        if 0.05 <= silence_pct <= 0.35:
            silence_scores.append(1.0)
        elif silence_pct < 0.05:
            silence_scores.append(0.5)  # no silence — dense but ok
        elif silence_pct > 0.8:
            silence_scores.append(0.1)  # too much silence
        else:
            silence_scores.append(0.7)
    scores["silence_usage"] = np.mean(silence_scores) * 100

    return scores


def score_audio(wav_path):
    """Score the actual audio output."""
    scores = {}
    try:
        sr, data = wavfile.read(wav_path)
        if data.dtype == np.int16:
            data = data.astype(np.float64) / 32768.0

        # RMS energy variation — should have dynamics
        chunk_size = sr // 4  # quarter-second chunks
        chunks = [data[i:i+chunk_size] for i in range(0, len(data) - chunk_size, chunk_size)]
        rms_values = [np.sqrt(np.mean(c**2)) for c in chunks]
        rms_std = np.std(rms_values)
        scores["audio_dynamics"] = min(1.0, rms_std / 0.1) * 100

        # Spectral variety — different frequencies over time
        from scipy.fft import rfft
        spectral_centroids = []
        for chunk in chunks[:20]:  # first 20 chunks
            spectrum = np.abs(rfft(chunk))
            freqs = np.arange(len(spectrum)) * sr / (2 * len(spectrum))
            if np.sum(spectrum) > 0:
                centroid = np.sum(freqs * spectrum) / np.sum(spectrum)
                spectral_centroids.append(centroid)
        if spectral_centroids:
            sc_std = np.std(spectral_centroids)
            scores["spectral_variety"] = min(1.0, sc_std / 500.0) * 100
        else:
            scores["spectral_variety"] = 0

        # Not clipping
        peak = np.max(np.abs(data))
        scores["headroom"] = 100 if peak < 0.99 else 50

    except Exception as e:
        print(f"[scorer] Audio analysis error: {e}")
        scores["audio_dynamics"] = 0
        scores["spectral_variety"] = 0
        scores["headroom"] = 0

    return scores


def main():
    # Load shader data
    shader_data_path = os.path.join(SCRIPT_DIR, "shader_data.json")
    wav_path = os.path.join(SCRIPT_DIR, "output.wav")

    if not os.path.exists(shader_data_path):
        print("[scorer] No shader_data.json found")
        print("SCORE: 0")
        return

    with open(shader_data_path) as f:
        shader_data = json.load(f)

    shader_scores = score_shader_data(shader_data)
    audio_scores = score_audio(wav_path) if os.path.exists(wav_path) else {}

    all_scores = {**shader_scores, **audio_scores}

    # Weighted composite
    weights = {
        "pitch_variety": 0.20,
        "rhythmic_variety": 0.20,
        "dynamic_range": 0.15,
        "track_independence": 0.15,
        "silence_usage": 0.10,
        "audio_dynamics": 0.10,
        "spectral_variety": 0.05,
        "headroom": 0.05,
    }

    total = 0
    for key, weight in weights.items():
        val = all_scores.get(key, 0)
        total += val * weight

    print(f"\n[scorer] === MUSIC QUALITY SCORE ===")
    for key, val in sorted(all_scores.items()):
        w = weights.get(key, 0)
        print(f"  {key:>22}: {val:6.1f}  (weight {w:.0%})")
    print(f"  {'TOTAL':>22}: {total:6.1f}")
    print(f"\nSCORE: {total:.1f}")


if __name__ == "__main__":
    main()
