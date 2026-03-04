# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""Oscillators — the raw waveforms. Every sound starts here."""

import numpy as np
from scipy import signal as sp

SR = 22050  # sample rate — matches macOS `say`

def sine(freq, dur, sr=SR):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    return np.sin(2 * np.pi * freq * t)

def square(freq, dur, duty=0.5, sr=SR):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    return sp.square(2 * np.pi * freq * t, duty=duty).astype(np.float64)

def triangle(freq, dur, sr=SR):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    return sp.sawtooth(2 * np.pi * freq * t, width=0.5).astype(np.float64)

def sawtooth(freq, dur, sr=SR):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    return sp.sawtooth(2 * np.pi * freq * t).astype(np.float64)

def noise(dur, sr=SR):
    return np.random.uniform(-1, 1, int(sr * dur))

def silence(dur, sr=SR):
    return np.zeros(int(sr * dur))

def pad(freq1, freq2, dur, blend=0.6, wave_fn=sawtooth, sr=SR):
    """Two detuned waveforms blended into a warm pad.
    blend: 0.0 = all freq2, 1.0 = all freq1, 0.6 = classic warm mix."""
    a = wave_fn(freq1, dur, sr=sr) if sr != SR else wave_fn(freq1, dur)
    b = wave_fn(freq2, dur, sr=sr) if sr != SR else wave_fn(freq2, dur)
    return a * blend + b * (1.0 - blend)


def reese(freq, dur, detune=0.008, sr=SR):
    """Two detuned sawtooths → the classic DnB reese bass.
    detune: frequency ratio offset (0.008 = ~14 cents). Higher = wider, more menacing.
    Returns raw mix — apply lowpass + bitcrush downstream for full reese character."""
    a = sawtooth(freq, dur, sr=sr) if sr != SR else sawtooth(freq, dur)
    b = sawtooth(freq * (1.0 + detune), dur, sr=sr) if sr != SR else sawtooth(freq * (1.0 + detune), dur)
    return (a + b) * 0.5
