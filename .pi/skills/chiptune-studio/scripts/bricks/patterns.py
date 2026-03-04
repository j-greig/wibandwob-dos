# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""
Compositional patterns — the gestures between oscillator and song.

Each pattern is a TOOL, not a recipe. It places sounds on a canvas
according to a structural principle. What you feed it (which notes,
which waveform, which effects) determines the musical outcome.

Think of these as verbs: arp(), sparkle(), drone().
The nouns (notes, timbres, rhythms) come from the musician.
"""

import numpy as np
from . import osc, fx, canvas, theory

SR = 22050


# ═══════════════════════════════════════
# DRUM SHORTHAND
# ═══════════════════════════════════════

# Default character → sound mapping
_DRUM_CHARS = {
    'K': {'note': 'C2',  'vol': 0.25, 'duty': 0.2, 'dur_beats': 0.4},   # KICK loud
    'k': {'note': 'C2',  'vol': 0.10, 'duty': 0.2, 'dur_beats': 0.25},  # kick ghost
    'S': {'note': 'D4',  'vol': 0.20, 'duty': 0.8, 'dur_beats': 0.15},  # SNARE loud
    's': {'note': 'D4',  'vol': 0.08, 'duty': 0.8, 'dur_beats': 0.10},  # snare ghost
    'H': {'note': 'F#5', 'vol': 0.06, 'duty': 0.9, 'dur_beats': 0.08},  # HAT loud
    'h': {'note': 'F#5', 'vol': 0.03, 'duty': 0.9, 'dur_beats': 0.05},  # hat ghost
    'C': {'note': 'Eb4', 'vol': 0.12, 'duty': 0.85, 'dur_beats': 0.12}, # CLAP
    'c': {'note': 'Eb4', 'vol': 0.06, 'duty': 0.85, 'dur_beats': 0.08}, # clap ghost
    'R': {'note': 'C1',  'vol': 0.15, 'duty': 0.1, 'dur_beats': 0.6},   # RIM/low tom
    'T': {'note': 'G3',  'vol': 0.14, 'duty': 0.5, 'dur_beats': 0.2},   # TOM
    'O': {'note': 'F#5', 'vol': 0.08, 'duty': 0.9, 'dur_beats': 0.15},  # OPEN hat
}


def drums_from_string(pattern, dur, bpm=110, wave_fn=osc.square, crush=3,
                      custom_chars=None, drop_fn=None, sr=SR):
    """Convert shorthand string to full drum pattern.

    K=kick S=snare H=hat C=clap R=rim T=tom O=open-hat .=rest
    Uppercase=loud, lowercase=ghost. Spaces ignored.

    Examples:
        "K...S...K.K.S..."     → basic boom-bap (16 steps)
        "K.h.S.h.K.h.S.h."    → hat-driven groove
        "K..K.S..K..K.S.."    → amen-ish break
        "K.H.S.H.K.H.S.H."   → four-on-floor with hats

    Multi-layer: use | to separate simultaneous layers:
        "K...S...|h.h.h.h."   → kick/snare over steady hats

    custom_chars: dict to override or add char mappings.
    """
    chars = dict(_DRUM_CHARS)
    if custom_chars:
        chars.update(custom_chars)

    # Handle multi-layer patterns
    if '|' in pattern:
        layers = pattern.split('|')
        c = canvas.make(dur, sr)
        for layer in layers:
            layer_audio = drums_from_string(
                layer.strip(), dur, bpm=bpm, wave_fn=wave_fn,
                crush=crush, custom_chars=custom_chars, drop_fn=drop_fn, sr=sr
            )
            c = canvas.place(c, layer_audio, 0.0)
        return c

    # Strip spaces
    pattern = pattern.replace(' ', '')
    if not pattern:
        return canvas.make(dur, sr)

    # Build hits dict from string
    hits = {}
    for i, ch in enumerate(pattern):
        if ch == '.':
            continue
        if ch in chars:
            hits[i] = dict(chars[ch])  # copy to avoid mutation

    # Run sequencer with string length as beats_per_bar
    # Override the beats_per_bar detection by padding hits
    return sequencer(hits, dur, bpm=bpm, wave_fn=wave_fn, crush=crush,
                     drop_fn=drop_fn, sr=sr)


def arp(note_names, dur, bpm=80, wave_fn=osc.triangle, note_frac=0.7,
        crush=6, vol=0.18, skip_fn=None, offset=0.0, sr=SR):
    """Cycle through notes at tempo. The universal arpeggiator.

    skip_fn: callable(index) -> bool. If True, skip that note.
             Use for breathing patterns, grooves, gaps.
             None = play every note.
    """
    c = canvas.make(dur, sr)
    beat = 60.0 / bpm
    note_dur = beat * note_frac
    t = offset
    idx = 0
    while t < dur - 0.1:
        if skip_fn is None or not skip_fn(idx):
            name = note_names[idx % len(note_names)]
            freq = theory.note_freq(name)
            tone = wave_fn(freq, note_dur)
            tone = fx.env(tone, a=0.015, d=0.08, s=0.5, r=note_dur * 0.3)
            if crush:
                tone = fx.bitcrush(tone, depth=crush)
            c = canvas.place(c, tone, t, vol=vol)
        t += beat
        idx += 1
    return c


def sequencer(hits, dur, bpm=110, wave_fn=osc.square, crush=3,
              drop_fn=None, sr=SR):
    """Beat grid with configurable hits per bar position.

    hits: dict mapping beat_in_bar (0-indexed) to
          {'note': str, 'vol': float, 'duty': float, 'dur_beats': float}
          or list of such dicts for random selection.
    drop_fn: callable(beat_index, progress) -> bool.
             If True, drop this hit. progress is 0.0-1.0 through piece.
             Use for progressive degradation, swing, humanization.
    """
    c = canvas.make(dur, sr)
    beat = 60.0 / bpm
    beats_per_bar = max(hits.keys()) + 1 if hits else 4
    rng = np.random.RandomState(42)
    t = 0.0
    beat_idx = 0
    while t < dur - 0.05:
        progress = t / max(dur, 0.1)
        pos = beat_idx % beats_per_bar
        if pos in hits:
            if drop_fn is None or not drop_fn(beat_idx, progress):
                h = hits[pos]
                if isinstance(h, list):
                    h = h[rng.randint(0, len(h))]
                freq = theory.note_freq(h.get('note', 'C2'))
                d = h.get('duty', 0.4)
                hit_dur = beat * h.get('dur_beats', 0.5)
                tone = wave_fn(freq, hit_dur) if wave_fn != osc.square else osc.square(freq, hit_dur, duty=d)
                tone = fx.env(tone, a=0.003, d=0.02, s=0.3, r=0.05)
                if crush:
                    tone = fx.bitcrush(tone, depth=crush)
                c = canvas.place(c, tone, t, vol=h.get('vol', 0.15))
        t += beat
        beat_idx += 1
    return c


def sparkle(note_names, start_t, dur, spacing=0.1, note_dur=0.12,
            wave_fn=osc.sine, crush=6, peak_vol=0.12,
            curve="bell", sr=SR):
    """Rapid cascade of short notes. Shimmer, twinkle, breach moment.

    curve: "bell" = peak in middle, "decay" = loud to quiet,
           "swell" = quiet to loud, "flat" = even.
    """
    c = canvas.make(dur, sr)
    n = len(note_names)
    center = n / 2.0
    for i, name in enumerate(note_names):
        t = start_t + i * spacing
        if t >= dur - 0.05:
            break
        freq = theory.note_freq(name)
        tone = wave_fn(freq, note_dur)
        tone = fx.env(tone, a=0.005, d=0.02, s=0.3, r=note_dur * 0.4)
        if crush:
            tone = fx.bitcrush(tone, depth=crush)
        # Volume shaping
        if curve == "bell":
            v = peak_vol * (1.0 - abs(i - center) / max(center, 1))
        elif curve == "decay":
            v = peak_vol * (1.0 - i / max(n - 1, 1))
        elif curve == "swell":
            v = peak_vol * (i / max(n - 1, 1))
        else:
            v = peak_vol
        c = canvas.place(c, tone, t, vol=v)
    return c


def drone(note, dur, wave_fn=osc.sawtooth, second_note=None, blend=0.6,
          cutoff=300, crush=5, trem_rate=0.1, trem_depth=0.4,
          vol=0.2, fade=(2.0, 3.0), sr=SR):
    """Continuous tone bed. Optionally blended with a second note.

    fade: (fade_in_sec, fade_out_sec). Set either to 0 to disable.
    """
    freq = theory.note_freq(note)
    if second_note:
        freq2 = theory.note_freq(second_note)
        tone = osc.pad(freq, freq2, dur, blend=blend, wave_fn=wave_fn)
    else:
        tone = wave_fn(freq, dur)
    tone = fx.lowpass(tone, cutoff)
    if crush:
        tone = fx.bitcrush(tone, depth=crush)
    tone = fx.tremolo(tone, rate=trem_rate, depth=trem_depth)
    if fade[0] > 0:
        tone = fx.fade_in(tone, fade[0])
    if fade[1] > 0:
        tone = fx.fade_out(tone, fade[1])
    return tone * vol


def ghost_echo(note_names, dur, bpm=80, octave_shift=1, time_offset=0.5,
               wave_fn=osc.triangle, crush=5, vol=0.06,
               sparsity=3, sr=SR):
    """Delayed, quieter, sparser replica of a melody. Haunting doubling.

    octave_shift: how many octaves up (or down if negative).
    time_offset: fraction of a beat to delay.
    sparsity: play every Nth note (higher = sparser).
    """
    beat = 60.0 / bpm
    shifted = []
    for name in note_names:
        import re
        m = re.match(r"([A-G][#b]?)(\d+)", name)
        if m:
            shifted.append(f"{m.group(1)}{int(m.group(2)) + octave_shift}")
        else:
            shifted.append(name)
    c = canvas.make(dur, sr)
    t = beat * time_offset
    idx = 0
    note_dur = beat * 0.5
    while t < dur - 0.2:
        if idx % sparsity == 0:
            name = shifted[idx % len(shifted)]
            freq = theory.note_freq(name)
            tone = wave_fn(freq, note_dur)
            tone = fx.env(tone, a=0.01, d=0.05, s=0.3, r=note_dur * 0.35)
            if crush:
                tone = fx.bitcrush(tone, depth=crush)
            c = canvas.place(c, tone, t, vol=vol)
        t += beat
        idx += 1
    return c


def noise_breath(dur, n_breaths=None, dur_range=(0.5, 2.0), cutoff=800,
                 vol=0.04, seed=42, sr=SR):
    """Filtered noise bursts at random times. Organic texture between tones.

    n_breaths: None = auto from duration (~1 per 8 seconds).
    """
    if n_breaths is None:
        n_breaths = max(1, int(dur / 8.0))
    c = canvas.make(dur, sr)
    rng = np.random.RandomState(seed)
    for _ in range(n_breaths):
        t = rng.uniform(0.5, max(1.0, dur - 1.0))
        b_dur = rng.uniform(*dur_range)
        b_dur = min(b_dur, dur * 0.3)
        breath = osc.noise(b_dur)
        breath = fx.lowpass(breath, cutoff)
        breath = fx.env(breath, a=b_dur * 0.3, d=0.1, s=0.2, r=b_dur * 0.4)
        c = canvas.place(c, breath, t, vol=vol)
    return c


def sub_rumble(note, dur, trem_rate=0.05, trem_depth=0.7, vol=0.1,
               fade=(3.0, 5.0), sr=SR):
    """Ultra-low sine for subsonic foundation. Felt more than heard."""
    freq = theory.note_freq(note)
    tone = osc.sine(freq, dur)
    tone = fx.tremolo(tone, rate=trem_rate, depth=trem_depth)
    if fade[0] > 0:
        tone = fx.fade_in(tone, fade[0])
    if fade[1] > 0:
        tone = fx.fade_out(tone, fade[1])
    return tone * vol


def stinger_hits(notes_per_hit, timings, dur, wave_fn=osc.square,
                 crush=5, vol_curve=None, sr=SR):
    """Escalating hit sequence. Small → medium → BIG.

    notes_per_hit: list of lists. Each inner list = notes for that hit.
                   More notes = bigger chord = more power.
    timings: list of start times for each hit.
    vol_curve: list of volumes per hit. None = auto-escalate.
    """
    c = canvas.make(dur, sr)
    n_hits = len(notes_per_hit)
    if vol_curve is None:
        vol_curve = [0.1 + 0.15 * (i / max(n_hits - 1, 1)) for i in range(n_hits)]

    for i, (notes, t) in enumerate(zip(notes_per_hit, timings)):
        if t >= dur:
            break
        hit_vol = vol_curve[i] if i < len(vol_curve) else vol_curve[-1]
        hit_dur = 0.15 + 0.1 * (i / max(n_hits - 1, 1))  # longer hits as they escalate

        for j, name in enumerate(notes):
            freq = theory.note_freq(name)
            tone = wave_fn(freq, hit_dur)
            tone = fx.env(tone, a=0.003, d=0.04, s=0.4, r=hit_dur * 0.3)
            if crush:
                tone = fx.bitcrush(tone, depth=crush)
            c = canvas.place(c, tone, t + j * 0.01, vol=hit_vol * (1.0 - j * 0.15))
    return c


def vocal_from_score(score, dur, bpm, snap="start", vol=0.85,
                     gain_db=4.0, trim_threshold=0.01, sr=SR):
    """Place TTS words precisely on beat grid. The DAW-equivalent vocal pattern.

    score: list of (beat_number, word, voice, rate) tuples
           OR path to a .vocal.yaml file
    dur: total canvas duration in seconds
    bpm: tempo for beat-to-time conversion
    snap: "start" = word onset on beat (default, percussive)
          "center" = word midpoint on beat (more musical/singing)
    vol: global volume for all words
    gain_db: TTS gain boost (TTS is quiet, 3-5 dB helps)
    trim_threshold: silence detection threshold for trim_silence

    Returns numpy canvas with all words placed.

    Example:
        bars = [
            (8,  "kindled",   "Sandy",   200),
            (10, "not",       "Grandpa", 200),
            (11, "coded",     "Sandy",   200),
        ]
        voice = vocal_from_score(bars, dur=50, bpm=140)

    YAML file format (.vocal.yaml):
        tempo: 140
        gain_db: 4.0
        snap: start
        voices:
          wib: {voice: Sandy, rate: 200}
          wob: {voice: Grandpa, rate: 200}
        bars:
          - {beat: 8,  word: kindled,   who: wib}
          - {beat: 10, word: not,       who: wob}
          - {beat: 11, word: coded,     who: wib}
    """
    from . import pipeline

    beat_s = 60.0 / bpm  # seconds per beat

    # Handle YAML file input
    if isinstance(score, str):
        import yaml
        with open(score, 'r') as f:
            spec = yaml.safe_load(f)
        bpm = spec.get('tempo', bpm)
        beat_s = 60.0 / bpm
        gain_db = spec.get('gain_db', gain_db)
        snap = spec.get('snap', snap)
        voices = spec.get('voices', {})
        score = []
        for entry in spec.get('bars', []):
            who = entry.get('who', 'default')
            v_cfg = voices.get(who, {})
            score.append((
                entry['beat'],
                entry['word'],
                v_cfg.get('voice', entry.get('voice', 'Samantha')),
                v_cfg.get('rate', entry.get('rate', 180)),
            ))

    c = canvas.make(dur, sr)

    for beat_num, word, voice, rate in score:
        t = beat_num * beat_s
        if t >= dur - 0.1:
            break

        # Render word via TTS
        seg = pipeline.say_to_segment(str(word), voice=voice, rate=rate,
                                       gain_db=gain_db)
        word_np = canvas.from_pydub(seg)

        # CRITICAL: trim silence for tight sync
        word_np = fx.trim_silence(word_np, threshold=trim_threshold)

        # Snap mode
        if snap == "center":
            # Offset backwards by half the word duration
            word_dur = len(word_np) / sr
            t = t - (word_dur / 2.0)
            t = max(0, t)

        # Ensure we don't overflow canvas
        max_samples = int((dur - t) * sr)
        if len(word_np) > max_samples:
            word_np = word_np[:max_samples]

        c = canvas.place(c, word_np, t, vol=vol)

    return c


def resolve(note, dur, start_t=None, wave_fn=osc.triangle, vol=0.2,
            reverb_decay=0.15, total_dur=None, sr=SR):
    """Single clean sustained note as emotional payoff. NOT bitcrushed.

    Place at end of a chaotic section. The silence after noise.
    start_t: if None, placed at (total_dur - dur) for end-of-piece.
    """
    if total_dur is None:
        total_dur = dur + (start_t or 0)
    if start_t is None:
        start_t = max(0, total_dur - dur - 0.5)
    c = canvas.make(total_dur, sr)
    freq = theory.note_freq(note)
    tone = wave_fn(freq, dur)
    tone = fx.env(tone, a=0.5, d=0.3, s=0.6, r=dur * 0.4)
    tone = fx.reverb(tone, decay=reverb_decay, delay_ms=60)
    c = canvas.place(c, tone, start_t, vol=vol)
    return c
