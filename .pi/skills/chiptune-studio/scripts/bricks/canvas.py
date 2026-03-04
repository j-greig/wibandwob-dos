# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pydub", "audioop-lts"]
# ///
"""Canvas — the mixing desk. Place sounds in time, blend, export.
Also bridges numpy synthesis world to pydub file world."""

import io
import wave
import numpy as np

SR = 22050

def make(dur, sr=SR):
    return np.zeros(int(dur * sr))

def place(canvas, sound, start_s, vol=1.0, sr=SR):
    start = int(start_s * sr)
    end = min(start + len(sound), len(canvas))
    if start >= len(canvas) or start < 0:
        return canvas
    n = end - start
    canvas[start:end] += sound[:n] * vol
    return canvas

def normalize(audio, peak_db=-3.0):
    peak = np.max(np.abs(audio))
    if peak == 0:
        return audio
    target = 10 ** (peak_db / 20)
    return audio * (target / peak)

def crossfade(seg_a, seg_b, overlap_s, sr=SR):
    """Cosine crossfade between two segments."""
    overlap = int(overlap_s * sr)
    if overlap <= 0 or len(seg_a) < overlap or len(seg_b) < overlap:
        return np.concatenate([seg_a, seg_b])
    t = np.linspace(0, np.pi, overlap)
    fo = 0.5 * (1.0 + np.cos(t))
    fi = 0.5 * (1.0 - np.cos(t))
    return np.concatenate([
        seg_a[:-overlap],
        seg_a[-overlap:] * fo + seg_b[:overlap] * fi,
        seg_b[overlap:],
    ])

def save_wav(audio, path, sr=SR):
    audio_int16 = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(audio_int16.tobytes())
    return path

# --- Bridge: numpy <-> pydub ---

def to_pydub(audio, sr=SR):
    """Convert numpy float64 array to pydub AudioSegment."""
    from pydub import AudioSegment
    audio_int16 = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(audio_int16.tobytes())
    buf.seek(0)
    return AudioSegment.from_wav(buf)

def from_pydub(segment, sr=SR):
    """Convert pydub AudioSegment to numpy float64 array.
    Resamples to target sr if needed. Returns mono."""
    from pydub import AudioSegment
    # Convert to mono if stereo
    if segment.channels > 1:
        segment = segment.set_channels(1)
    # Convert to target sample rate
    if segment.frame_rate != sr:
        segment = segment.set_frame_rate(sr)
    # Extract raw samples
    samples = np.array(segment.get_array_of_samples(), dtype=np.float64)
    return samples / 32768.0

def mix_with_voice(music_audio, voice_path, output_path, music_db=-7):
    """Mix numpy music under a voiceover file. Standard reel mix."""
    from pydub import AudioSegment
    music = to_pydub(music_audio)
    voice = AudioSegment.from_file(voice_path)
    if len(music) > len(voice):
        music = music[:len(voice)]
    elif len(music) < len(voice):
        music = music + AudioSegment.silent(duration=len(voice) - len(music))
    mixed = voice.overlay(music + music_db)
    mixed.export(output_path, format="mp3", bitrate="192k")
    return output_path
