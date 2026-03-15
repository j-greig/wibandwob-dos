# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
Mix all SFX hits into a single timeline WAV/MP3.

Takes a cue file (TSV: timestamp_ms \t wav_path) and renders
a single mixed audio file with all hits placed at correct times.

Usage:
  uv run mix-sfx-track.py cues.tsv output.wav
  uv run mix-sfx-track.py cues.tsv output.mp3
"""

import sys, os
import numpy as np
import wave, io

SR = 22050

def load_wav(path):
    with wave.open(path, 'rb') as wf:
        assert wf.getsampwidth() == 2
        frames = wf.readframes(wf.getnframes())
        data = np.frombuffer(frames, dtype=np.int16).astype(np.float64) / 32767.0
        # If stereo, take mono mix
        if wf.getnchannels() == 2:
            data = (data[0::2] + data[1::2]) / 2.0
        # Resample if needed
        if wf.getframerate() != SR:
            from scipy import signal
            num_samples = int(len(data) * SR / wf.getframerate())
            data = signal.resample(data, num_samples)
    return data

def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} cues.tsv output.wav|mp3")
        sys.exit(1)

    cues_path = sys.argv[1]
    out_path = sys.argv[2]

    # Parse cues
    cues = []
    with open(cues_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            ts_ms = int(parts[0])
            wav_path = parts[1]
            vol = float(parts[2]) if len(parts) > 2 else 1.0
            cues.append((ts_ms, wav_path, vol))

    if not cues:
        print("No cues found!")
        sys.exit(1)

    # Find total duration — last cue + its wav length + 2s padding
    max_end_ms = 0
    wavs = {}
    for ts_ms, wav_path, vol in cues:
        if wav_path not in wavs:
            wavs[wav_path] = load_wav(wav_path)
        end_ms = ts_ms + int(len(wavs[wav_path]) / SR * 1000)
        max_end_ms = max(max_end_ms, end_ms)

    total_dur = (max_end_ms + 2000) / 1000.0
    canvas = np.zeros(int(total_dur * SR))

    # Place all cues
    for ts_ms, wav_path, vol in cues:
        data = wavs[wav_path]
        start = int(ts_ms / 1000.0 * SR)
        end = start + len(data)
        if end > len(canvas):
            canvas = np.concatenate([canvas, np.zeros(end - len(canvas))])
        canvas[start:end] += data * vol

    # Normalize
    peak = np.max(np.abs(canvas))
    if peak > 0:
        canvas = canvas * (0.85 / peak)

    # Save
    clipped = np.clip(canvas, -1.0, 1.0)
    pcm = (clipped * 32767).astype(np.int16)

    if out_path.endswith('.mp3'):
        wav_buf = io.BytesIO()
        with wave.open(wav_buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SR)
            wf.writeframes(pcm.tobytes())
        wav_buf.seek(0)
        from pydub import AudioSegment
        seg = AudioSegment.from_wav(wav_buf)
        seg.export(out_path, format="mp3", bitrate="192k")
    else:
        with wave.open(out_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SR)
            wf.writeframes(pcm.tobytes())

    print(f"  Mixed {len(cues)} cues → {out_path} ({total_dur:.1f}s)")

if __name__ == "__main__":
    main()
