# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pydub", "audioop-lts"]
# ///
"""
Pipeline — file-based mixing, splicing, voice, export.
Operates in pydub's AudioSegment world with numpy bridges.

These are the glue operations between synthesis and final output:
splice stingers into timelines, duck music under voice,
generate TTS, export with metadata.
"""

import os
import subprocess
import numpy as np

SR = 22050


def splice_at(audio, insert, at_ms, pre_silence_ms=0, post_silence_ms=0):
    """Insert audio at a precise timecode. The editorial cut.

    Returns: audio[:at_ms] + silence + insert + silence + audio[at_ms:]
    """
    from pydub import AudioSegment
    first = audio[:at_ms]
    second = audio[at_ms:]
    parts = [first]
    if pre_silence_ms > 0:
        parts.append(AudioSegment.silent(duration=pre_silence_ms))
    parts.append(insert)
    if post_silence_ms > 0:
        parts.append(AudioSegment.silent(duration=post_silence_ms))
    parts.append(second)
    result = parts[0]
    for p in parts[1:]:
        result = result + p
    return result


def match_length(target, source, mode="pad"):
    """Adjust source length to match target.

    mode: "pad" = silence-extend if short, trim if long.
          "trim" = only trim, never extend.
          "loop" = loop source to fill target length.
    """
    from pydub import AudioSegment
    t_len = len(target)
    s_len = len(source)
    if s_len == t_len:
        return source
    if s_len > t_len:
        return source[:t_len]
    # source is shorter
    if mode == "trim":
        return source
    elif mode == "loop":
        loops_needed = (t_len // s_len) + 1
        looped = source * loops_needed
        return looped[:t_len]
    else:  # pad
        return source + AudioSegment.silent(duration=t_len - s_len)


def mix_layers(*layers, master_db=-3.0):
    """Mix multiple audio layers at specified volume offsets.

    layers: tuples of (AudioSegment, gain_db).
            First layer is the reference length.

    Example:
        mix_layers(
            (voiceover, 0.0),
            (score, -7.0),
            (ambience, -15.0),
        )
    """
    from pydub import AudioSegment
    if not layers:
        return AudioSegment.empty()
    ref = layers[0][0]
    ref_adjusted = ref + layers[0][1]
    result = ref_adjusted
    for seg, db in layers[1:]:
        seg = match_length(ref, seg)
        result = result.overlay(seg + db)
    if master_db is not None:
        # Normalize to target
        if result.dBFS != float('-inf'):
            delta = master_db - result.dBFS
            result = result + delta
    return result


def duck_envelope(voice, duck_db=-12.0, threshold=0.02,
                  attack_s=0.05, release_s=0.2, sr=SR):
    """Generate a gain envelope from voice amplitude.

    Returns numpy array (same length as voice) with values between
    10^(duck_db/20) and 1.0. Multiply against music to duck it
    when voice is present.

    The envelope ramps down during speech, ramps back up in silence.
    """
    # Compute voice amplitude in small windows
    window = int(0.02 * sr)  # 20ms frames
    n_frames = len(voice) // window
    floor = 10 ** (duck_db / 20)

    # Frame-level gate
    gate = np.ones(n_frames)
    for i in range(n_frames):
        chunk = voice[i * window:(i + 1) * window]
        rms = np.sqrt(np.mean(chunk ** 2))
        if rms > threshold:
            gate[i] = floor

    # Smooth with attack/release
    attack_frames = max(1, int(attack_s / 0.02))
    release_frames = max(1, int(release_s / 0.02))
    smoothed = np.ones(n_frames)
    current = 1.0
    for i in range(n_frames):
        target = gate[i]
        if target < current:
            # Ducking (attack)
            step = (current - floor) / attack_frames
            current = max(target, current - step)
        else:
            # Releasing
            step = (1.0 - floor) / release_frames
            current = min(target, current + step)
        smoothed[i] = current

    # Expand to sample-level
    envelope = np.repeat(smoothed, window)
    # Pad or trim to exact length
    if len(envelope) < len(voice):
        envelope = np.concatenate([envelope, np.full(len(voice) - len(envelope), smoothed[-1])])
    elif len(envelope) > len(voice):
        envelope = envelope[:len(voice)]

    return envelope


def say_to_segment(text, voice="Samantha", rate=180, gain_db=0.0):
    """Generate speech via macOS TTS, return as pydub AudioSegment.

    Requires macOS with /usr/bin/say.
    """
    import subprocess
    import tempfile
    from pydub import AudioSegment

    if not os.path.exists("/usr/bin/say"):
        raise OSError("macOS `say` command not found. This brick is macOS-only.")

    with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
        tmp = f.name
    try:
        subprocess.run(
            ["say", "-v", voice, "-r", str(rate), "-o", tmp, text],
            check=True, capture_output=True
        )
        seg = AudioSegment.from_file(tmp, format="aiff")
        if gain_db != 0.0:
            seg = seg + gain_db
        return seg
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def export_mp3(audio, path, bitrate="192k", fade_out_ms=0,
               normalize_to=None):
    """Standard MP3 export with optional normalization and fade.

    Returns the output path.
    """
    if normalize_to is not None:
        if audio.dBFS != float('-inf'):
            delta = normalize_to - audio.dBFS
            audio = audio + delta
    if fade_out_ms > 0:
        audio = audio.fade_out(fade_out_ms)
    audio.export(path, format="mp3", bitrate=bitrate)
    return path


def preview(path, duration_s=None, wait=True):
    """Play a WAV or MP3 file via macOS afplay. Closes the feedback loop.

    path: path to audio file
    duration_s: play only first N seconds (None = full file)
    wait: if True, block until playback finishes
    """
    if not os.path.exists(path):
        print(f"✗ File not found: {path}")
        return False
    cmd = ["afplay", path]
    if duration_s is not None:
        cmd.extend(["-t", str(duration_s)])
    print(f"▶ Playing: {os.path.basename(path)}" +
          (f" ({duration_s}s)" if duration_s else ""))
    try:
        if wait:
            subprocess.run(cmd, check=True)
        else:
            subprocess.Popen(cmd)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"✗ Playback failed: {e}")
        return False


def render(audio_np, name, out_dir, fade_in_s=0.5, fade_out_s=2.0,
           peak_db=-3.0, bitrate="192k", sr=SR):
    """One-call render: normalize → fade → save WAV + MP3 → print confirmation.

    audio_np: numpy float64 canvas
    name: base filename without extension (e.g. "01-kibble-extended")
    out_dir: output directory path
    Returns: (wav_path, mp3_path) tuple
    """
    from . import fx, canvas
    audio_np = canvas.normalize(audio_np, peak_db=peak_db)
    if fade_in_s > 0:
        audio_np = fx.fade_in(audio_np, fade_in_s)
    if fade_out_s > 0:
        audio_np = fx.fade_out(audio_np, fade_out_s)

    os.makedirs(out_dir, exist_ok=True)
    wav_path = os.path.join(out_dir, f"{name}.wav")
    mp3_path = os.path.join(out_dir, f"{name}.mp3")

    canvas.save_wav(audio_np, wav_path, sr=sr)
    seg = canvas.to_pydub(audio_np, sr=sr)
    export_mp3(seg, mp3_path, bitrate=bitrate)

    dur = len(audio_np) / sr
    print(f"✓ {name}: {wav_path}")
    print(f"  {dur:.1f}s | WAV + MP3")
    return wav_path, mp3_path


def preview_wrap(audio, pad_before_ms=3000, pad_after_ms=3000,
                 breath_ms=0, export_path=None, bitrate="192k"):
    """Wrap audio with silence for preview listening.

    breath_ms: short silence after the audio (pacing, distinct from padding).
    """
    from pydub import AudioSegment
    parts = []
    if pad_before_ms > 0:
        parts.append(AudioSegment.silent(duration=pad_before_ms))
    parts.append(audio)
    if breath_ms > 0:
        parts.append(AudioSegment.silent(duration=breath_ms))
    if pad_after_ms > 0:
        parts.append(AudioSegment.silent(duration=pad_after_ms))
    result = parts[0]
    for p in parts[1:]:
        result = result + p
    if export_path:
        result.export(export_path, format="mp3", bitrate=bitrate)
    return result
