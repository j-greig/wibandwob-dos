# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""Effects — transform any sound. Stack them, chain them, abuse them."""

import numpy as np
from scipy import signal as sp

SR = 22050

def bitcrush(audio, depth=4):
    """Reduce bit depth. 4=NES grit. 8=SNES smooth. 2=destruction."""
    levels = 2 ** depth
    return np.round(audio * levels) / levels

def tremolo(audio, rate=4.0, depth=0.5, sr=SR):
    """Amplitude modulation. rate=Hz, depth=0.0-1.0."""
    t = np.linspace(0, len(audio) / sr, len(audio), endpoint=False)
    lfo = 1.0 - depth * 0.5 * (1.0 + np.sin(2 * np.pi * rate * t))
    return audio * lfo

def reverb(audio, decay=0.3, delay_ms=80, sr=SR):
    """Comb-filter reverb. Not convolution — metallic room tone. Lo-fi."""
    delay_samples = int(sr * delay_ms / 1000)
    out = audio.copy()
    for i in range(delay_samples, len(out)):
        out[i] += out[i - delay_samples] * decay
    peak = np.max(np.abs(out))
    if peak > 0:
        out = out / peak * np.max(np.abs(audio))
    return out

def delay(audio, repeats=3, delay_ms=200, feedback=0.5, sr=SR):
    """Discrete echo with diminishing repeats."""
    delay_samples = int(sr * delay_ms / 1000)
    total_extra = delay_samples * repeats
    out = np.zeros(len(audio) + total_extra)
    out[:len(audio)] = audio
    for r in range(1, repeats + 1):
        offset = delay_samples * r
        gain = feedback ** r
        end = min(offset + len(audio), len(out))
        n = end - offset
        out[offset:end] += audio[:n] * gain
    # Trim or normalize
    peak = np.max(np.abs(out))
    if peak > 0:
        out = out * (np.max(np.abs(audio)) / peak)
    return out

def lowpass(audio, cutoff, sr=SR, order=4):
    nyquist = sr / 2
    cutoff = min(cutoff, nyquist * 0.95)
    if cutoff <= 0:
        return audio
    b, a = sp.butter(order, cutoff / nyquist, btype='low')
    return sp.lfilter(b, a, audio).astype(np.float64)

def highpass(audio, cutoff, sr=SR, order=4):
    """Remove everything below cutoff. Useful for thinning out drones."""
    nyquist = sr / 2
    cutoff = max(cutoff, 20)  # below 20Hz is just DC offset
    cutoff = min(cutoff, nyquist * 0.95)
    b, a = sp.butter(order, cutoff / nyquist, btype='high')
    return sp.lfilter(b, a, audio).astype(np.float64)

def env(audio, a=0.01, d=0.1, s=0.7, r=0.1, sr=SR):
    """ADSR envelope."""
    n = len(audio)
    a_n = int(a * sr)
    d_n = int(d * sr)
    r_n = int(r * sr)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, a_n),
        np.linspace(1, s, d_n),
        np.full(s_n, s),
        np.linspace(s, 0, r_n),
    ])
    if len(e) > n:
        e = e[:n]
    elif len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return audio * e

def fade_in(audio, dur, sr=SR):
    samples = min(int(dur * sr), len(audio))
    out = audio.copy()
    out[:samples] *= np.linspace(0, 1, samples)
    return out

def fade_out(audio, dur, sr=SR):
    samples = min(int(dur * sr), len(audio))
    out = audio.copy()
    out[-samples:] *= np.linspace(1, 0, samples)
    return out

def trim_silence(audio, threshold=0.01, pad_samples=110, sr=SR):
    """Trim leading and trailing silence from audio. Essential for tight vocal sync.

    threshold: amplitude below which counts as silence (0.01 works for TTS)
    pad_samples: keep this many samples of silence as natural attack/release buffer
                 (110 samples ≈ 5ms at 22050Hz — enough for smooth onset)

    macOS say_to_segment adds 300-400ms trailing silence to every word.
    This function strips it so words can be placed precisely on beat grids.
    """
    abs_audio = np.abs(audio)

    # Find first sample above threshold
    start = 0
    for i in range(len(abs_audio)):
        if abs_audio[i] > threshold:
            start = max(0, i - pad_samples)
            break

    # Find last sample above threshold
    end = len(abs_audio)
    for i in range(len(abs_audio) - 1, -1, -1):
        if abs_audio[i] > threshold:
            end = min(len(abs_audio), i + pad_samples)
            break

    if start >= end:
        return audio  # all silence or too short, return as-is

    return audio[start:end]


def chain(audio, *effects):
    """Apply a list of (fn, kwargs) tuples in sequence.
    Example: chain(tone, (bitcrush, {'depth': 4}), (lowpass, {'cutoff': 800}))"""
    for fn, kwargs in effects:
        audio = fn(audio, **kwargs)
    return audio
