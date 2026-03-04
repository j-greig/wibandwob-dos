# Pattern Catalog

Full API reference for all chiptune-studio modules.

## Table of Contents

- [osc — Oscillators](#osc)
- [fx — Effects](#fx)
- [theory — Music Theory](#theory)
- [canvas — Mixing Desk](#canvas)
- [patterns — Compositional Gestures](#patterns)
- [pipeline — File Operations](#pipeline)

---

## osc

Raw waveform generators. All return numpy float64 arrays, amplitude -1.0 to 1.0.

### `sine(freq, dur, sr=22050)`
Pure sine wave. Smooth, clean, no harmonics.

### `square(freq, dur, duty=0.5, sr=22050)`
Square wave with variable duty cycle. `duty=0.5` is classic square.
Narrow duty (0.1-0.3) = nasal, reedy. Wide (0.7-0.9) = hollow.

### `triangle(freq, dur, sr=22050)`
Triangle wave. Softer than square, warmer than sine. Good default melodic voice.

### `sawtooth(freq, dur, sr=22050)`
Sawtooth wave. Bright, buzzy, harmonically rich. Classic synth lead/bass.

### `noise(dur, sr=22050)`
White noise. Uniform random samples. Use with lowpass for breath, hiss, texture.

### `silence(dur, sr=22050)`
Zeros. Explicit silence as a compositional element.

### `pad(freq1, freq2, dur, blend=0.6, wave_fn=sawtooth, sr=22050)`
Two detuned waveforms blended. `blend`: 0.0 = all freq2, 1.0 = all freq1.
Classic warm pad sound from slight detuning (e.g., C3 + C3 shifted by a few Hz).

### `reese(freq, dur, detune=0.008, sr=22050)`
Two detuned sawtooths mixed. The classic DnB bass. `detune` is frequency ratio
offset (0.008 = ~14 cents). Higher = wider, more menacing. Returns raw mix...
apply `lowpass` + `bitcrush` downstream for full reese character.
```python
bass = osc.reese(theory.note_freq("F1"), 4.0, detune=0.01)
bass = fx.lowpass(bass, 200)
bass = fx.bitcrush(bass, depth=4)
```

---

## fx

Transform any numpy audio array. All return numpy float64.

### `bitcrush(audio, depth=4)`
Reduce bit depth. Fewer levels = more grit.
- `depth=8`: SNES smooth
- `depth=6`: warm vintage
- `depth=4`: NES character
- `depth=2`: deliberate destruction

### `tremolo(audio, rate=4.0, depth=0.5, sr=22050)`
Amplitude modulation via sine LFO. `rate` in Hz, `depth` 0.0-1.0.
Slow (0.1-0.5 Hz) = breathing. Fast (4-8 Hz) = vibrato. Very fast (>10 Hz) = ring mod territory.

### `reverb(audio, decay=0.3, delay_ms=80, sr=22050)`
Comb-filter reverb. Not convolution... metallic, lo-fi room tone.
Short delay (20-40ms) = small room. Long (80-150ms) = cavern. High decay = infinite wash.

### `delay(audio, repeats=3, delay_ms=200, feedback=0.5, sr=22050)`
Discrete echo with diminishing repeats. Output is longer than input (by `repeats * delay_ms`).
Normalized to input peak. Rhythmic delay (e.g., beat-synced ms) creates groove.

### `lowpass(audio, cutoff, sr=22050, order=4)`
Butterworth lowpass. Remove everything above cutoff Hz.
200-400Hz = muffled, distant. 800-1200Hz = warm. 2000+ = subtle smoothing.

### `highpass(audio, cutoff, sr=22050, order=4)`
Butterworth highpass. Remove everything below cutoff Hz. Minimum 20Hz.
Useful for thinning drones, removing rumble, isolating upper register.

### `env(audio, a=0.01, d=0.1, s=0.7, r=0.1, sr=22050)`
ADSR envelope. All times in seconds, `s` is sustain level (0.0-1.0).
- Percussive: `a=0.003, d=0.05, s=0.1, r=0.05`
- Pad: `a=0.5, d=0.3, s=0.7, r=1.0`
- Pluck: `a=0.001, d=0.15, s=0.2, r=0.3`

### `fade_in(audio, dur, sr=22050)`
Linear fade from silence. `dur` in seconds.

### `fade_out(audio, dur, sr=22050)`
Linear fade to silence. `dur` in seconds.

### `trim_silence(audio, threshold=0.01, pad_samples=110, sr=22050)`
Strip leading and trailing silence below threshold. Essential for vocal sync.
macOS `say_to_segment` adds 300-400ms trailing silence per word... this removes it.
`pad_samples` keeps a tiny buffer (~5ms) for natural attack/release.

```python
seg = pipeline.say_to_segment("kindled", voice="Sandy", rate=200)
raw = canvas.from_pydub(seg)      # 800ms total
trimmed = fx.trim_silence(raw)     # 412ms — 388ms of dead air removed
```

### `chain(audio, *effects)`
Apply effects in sequence. Each effect is `(fn, kwargs_dict)`.
```python
chain(tone, (bitcrush, {'depth': 4}), (lowpass, {'cutoff': 800}))
```

---

## theory

Music theory utilities. Note names use format `"C3"`, `"Ab4"`, `"F#2"` etc.

### Constants

- `NOTES`: `["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]`
- `SCALES`: dict with keys: `major`, `minor`, `dorian`, `mixolydian`, `pentatonic`,
  `minor_pent`, `whole_tone`, `chromatic`, `blues`. Values are interval lists from root.

### `note_freq(name)`
Get frequency in Hz for a note name. Handles enharmonics (Db→C#, A#→Bb etc).
Falls back to C3 (130.81 Hz) for unrecognized names.

### `scale_notes(root, scale_type, octaves=(2, 5))`
Get list of `(name, freq)` tuples for a scale across octave range.
```python
scale_notes("D", "minor", octaves=(3, 5))
# → [("D3", 146.83), ("E3", 164.81), ("F3", 174.61), ...]
```

### `chord_notes(root, quality, octave=3)`
Get note names for a chord. Returns list of strings.
Qualities: `major`, `minor`, `dim`, `aug`, `sus2`, `sus4`, `7`, `maj7`, `min7`.
```python
chord_notes("A", "minor", octave=3)  # → ["A3", "C3", "E3"]
chord_notes("G", "7", octave=2)      # → ["G2", "Bb2", "D2", "F2"]
```

---

## canvas

The mixing desk. Place sounds in time, blend, export. Also bridges numpy↔pydub.

### `make(dur, sr=22050)`
Create empty canvas (numpy zeros). `dur` in seconds.

### `place(canvas, sound, start_s, vol=1.0, sr=22050)`
Add sound onto canvas at time position. Additive mixing (overlaps sum).
`start_s` in seconds. `vol` multiplies the sound amplitude.
Returns modified canvas. Out-of-bounds placements are silently clipped.

### `normalize(audio, peak_db=-3.0)`
Scale audio so peak amplitude matches target dB. -3.0 dB is standard headroom.

### `crossfade(seg_a, seg_b, overlap_s, sr=22050)`
Cosine crossfade between two segments. Returns concatenated result with
smooth transition over `overlap_s` seconds. Falls back to hard concat if
segments are shorter than overlap.

### `save_wav(audio, path, sr=22050)`
Write numpy array to 16-bit mono WAV file. Returns path.

### `to_pydub(audio, sr=22050)`
Convert numpy float64 array → pydub AudioSegment. The bridge from synthesis world
to file world. Use this when you need pydub operations (overlay, export MP3, splice).

### `from_pydub(segment, sr=22050)`
Convert pydub AudioSegment → numpy float64 array. Handles stereo→mono conversion
and sample rate conversion. Use when importing audio files back into synthesis world.

### `mix_with_voice(music_audio, voice_path, output_path, music_db=-7)`
Quick mix: numpy music under a voice file → MP3. Length-matches to voice.
`music_db` controls how far the music ducks under voice (negative = quieter).

---

## patterns

Compositional gestures. Each returns a numpy array (a canvas with sounds placed).
These are tools that place sounds according to structural principles.

### `drums_from_string(pattern, dur, bpm=110, wave_fn=osc.square, crush=3, custom_chars=None, drop_fn=None, sr=22050)`

Convert shorthand string to full drum pattern. Highest-leverage brick.

Characters: `K`=kick `S`=snare `H`=hat `C`=clap `R`=rim `T`=tom `O`=open-hat `.`=rest.
Uppercase=loud, lowercase=ghost. Spaces ignored.

```python
# Basic boom-bap
drums_from_string("K...S...k.K.S..s", dur=30, bpm=85)

# Amen-ish break
drums_from_string("K..K.S..K..K.S..", dur=30, bpm=170)

# Multi-layer (pipe separator): kick/snare over steady hats
drums_from_string("K...S...K.K.S...|h.h.h.h.h.h.h.h.", dur=30, bpm=110)
```

- `custom_chars`: dict to override or add character mappings
- `drop_fn`: same as sequencer... `drop_fn(beat_index, progress) → bool`
- Pattern length determines beats_per_bar for the sequencer

### `arp(note_names, dur, bpm=80, wave_fn=osc.triangle, note_frac=0.7, crush=6, vol=0.18, skip_fn=None, offset=0.0, sr=22050)`

Cycle through notes at tempo. The universal arpeggiator.

- `note_names`: list of note strings, cycled infinitely
- `note_frac`: fraction of beat duration for each note (0.7 = 70% sound, 30% gap)
- `skip_fn`: callable `skip_fn(index) → bool`. If True, skip that beat.
  Use for breathing patterns: `lambda i: i % 4 == 3` skips every 4th note.
- `offset`: start time in seconds (for layering offset arps)

### `sequencer(hits, dur, bpm=110, wave_fn=osc.square, crush=3, drop_fn=None, sr=22050)`

Beat grid. `hits` maps bar positions to sound configs.

```python
hits = {
    0: {'note': 'C2', 'vol': 0.2, 'duty': 0.3, 'dur_beats': 0.5},
    2: {'note': 'C2', 'vol': 0.15, 'duty': 0.5, 'dur_beats': 0.3},
    3: [{'note': 'C2', 'vol': 0.1}, {'note': 'D2', 'vol': 0.1}],  # random pick
}
```

- `drop_fn`: callable `drop_fn(beat_index, progress) → bool`. If True, drop hit.
  `progress` is 0.0-1.0 through piece. Use for degradation:
  `lambda i, p: random.random() < p * 0.5` = increasingly sparse.

### `sparkle(note_names, start_t, dur, spacing=0.1, note_dur=0.12, wave_fn=osc.sine, crush=6, peak_vol=0.12, curve="bell", sr=22050)`

Rapid cascade of short notes.

- `start_t`: when the cascade begins (seconds)
- `spacing`: time between notes (seconds). Tight (0.05) = waterfall. Wide (0.2) = stately.
- `curve`: volume shape across the cascade
  - `"bell"`: peak in middle
  - `"decay"`: loud → quiet
  - `"swell"`: quiet → loud
  - `"flat"`: even volume

### `drone(note, dur, wave_fn=osc.sawtooth, second_note=None, blend=0.6, cutoff=300, crush=5, trem_rate=0.1, trem_depth=0.4, vol=0.2, fade=(2.0, 3.0), sr=22050)`

Continuous tone bed.

- `second_note`: optional second pitch for blended pad sound
- `cutoff`: lowpass frequency (lower = more muffled)
- `trem_rate`: tremolo speed in Hz (0.05-0.2 = slow breathing)
- `fade`: tuple `(fade_in_sec, fade_out_sec)`. Set either to 0 to disable.

### `ghost_echo(note_names, dur, bpm=80, octave_shift=1, time_offset=0.5, wave_fn=osc.triangle, crush=5, vol=0.06, sparsity=3, sr=22050)`

Delayed, quieter, sparser replica of a melody. Haunting doubling.

- `octave_shift`: how many octaves up (negative = down)
- `time_offset`: fraction of a beat to delay behind the original
- `sparsity`: play every Nth note (3 = plays 1/3 of notes)

### `noise_breath(dur, n_breaths=None, dur_range=(0.5, 2.0), cutoff=800, vol=0.04, seed=42, sr=22050)`

Filtered noise bursts at random times. Organic texture.

- `n_breaths`: count. None = auto (~1 per 8 seconds)
- `dur_range`: min/max breath length in seconds
- `seed`: random seed for reproducibility

### `sub_rumble(note, dur, trem_rate=0.05, trem_depth=0.7, vol=0.1, fade=(3.0, 5.0), sr=22050)`

Ultra-low sine for subsonic foundation. Felt more than heard.
Use notes in octave 1 or 0 (C1 = 32.7 Hz, C0 = 16.35 Hz).

### `stinger_hits(notes_per_hit, timings, dur, wave_fn=osc.square, crush=5, vol_curve=None, sr=22050)`

Escalating hit sequence. Small → medium → BIG.

- `notes_per_hit`: list of lists. More notes per hit = bigger chord = more power.
- `timings`: list of start times (seconds) for each hit
- `vol_curve`: volumes per hit. None = auto-escalate from 0.1 upward.

```python
stinger_hits(
    [["C3"], ["C3","E3"], ["C3","E3","G3","C4"]],
    [0.0, 0.3, 0.7],
    dur=2.0
)
```

### `vocal_from_score(score, dur, bpm, snap="start", vol=0.85, gain_db=4.0, trim_threshold=0.01, sr=22050)`

Place TTS words precisely on beat grid. The DAW-equivalent vocal pattern.
Handles: `say_to_segment` → `trim_silence` → snap to beat → place on canvas.

- `score`: list of `(beat_number, word, voice, rate)` tuples, OR path to `.vocal.yaml` file
- `snap`: `"start"` = word onset on beat (percussive), `"center"` = word midpoint on beat (singing)
- `gain_db`: TTS boost (TTS is quiet, 3-5 dB helps)

```python
# Inline score
bars = [
    (8,  "kindled",   "Sandy",   200),
    (10, "not",       "Grandpa", 200),
    (11, "coded",     "Sandy",   200),
]
voice = patterns.vocal_from_score(bars, dur=50, bpm=140)
```

YAML file format (`.vocal.yaml`):
```yaml
tempo: 140
snap: start
voices:
  wib: {voice: Sandy, rate: 200}
  wob: {voice: Grandpa, rate: 200}
bars:
  - {beat: 8,  word: kindled, who: wib}
  - {beat: 10, word: not,     who: wob}
  - {beat: 11, word: coded,   who: wib}
```

### `resolve(note, dur, start_t=None, wave_fn=osc.triangle, vol=0.2, reverb_decay=0.15, total_dur=None, sr=22050)`

Single clean sustained note as emotional payoff. NOT bitcrushed.
Place at end of chaotic section. The silence after noise.

- `start_t`: None = auto-place at end of `total_dur`
- `reverb_decay`: reverb amount (0 = dry, 0.3 = washed)

---

## pipeline

File-based operations via pydub. These operate on AudioSegments, not numpy arrays.
Use `canvas.to_pydub()` to cross the bridge.

### `splice_at(audio, insert, at_ms, pre_silence_ms=0, post_silence_ms=0)`
Insert AudioSegment at precise timecode. Returns spliced result.
`audio[:at_ms] + silence + insert + silence + audio[at_ms:]`

### `match_length(target, source, mode="pad")`
Adjust source length to match target.
- `"pad"`: silence-extend if short, trim if long
- `"trim"`: only trim, never extend
- `"loop"`: loop source to fill target length

### `mix_layers(*layers, master_db=-3.0)`
Mix multiple AudioSegment layers. Each layer is `(segment, gain_db)`.
First layer is reference length. Others are length-matched.
```python
mix_layers(
    (voiceover, 0.0),
    (score, -7.0),
    (ambience, -15.0),
)
```

### `duck_envelope(voice, duck_db=-12.0, threshold=0.02, attack_s=0.05, release_s=0.2, sr=22050)`
Generate gain envelope from voice amplitude. Returns numpy array.
Multiply against music to duck it when voice is present.
- `duck_db`: how far to duck (dB). -12 = significant, -6 = gentle.
- `threshold`: RMS level that triggers ducking
- `attack_s`: how fast ducking engages
- `release_s`: how fast volume returns after voice stops

### `say_to_segment(text, voice="Samantha", rate=180, gain_db=0.0)`
macOS TTS → pydub AudioSegment. Requires `/usr/bin/say`.
Common voices: Samantha, Alex, Fiona (Scottish), Daniel (British).

### `export_mp3(audio, path, bitrate="192k", fade_out_ms=0, normalize_to=None)`
Standard MP3 export. `normalize_to` in dB (e.g., -3.0). Returns output path.

### `preview(path, duration_s=None, wait=True)`
Play a WAV or MP3 via macOS `afplay`. Closes the feedback loop inside the session.
- `duration_s`: play only first N seconds (None = full file)
- `wait`: if True, block until playback finishes; False = background play

```python
pipeline.preview("output.wav", duration_s=10)  # listen to first 10s
```

### `render(audio_np, name, out_dir, fade_in_s=0.5, fade_out_s=2.0, peak_db=-3.0, bitrate="192k", sr=22050)`
One-call render: normalize → fade → save WAV + MP3 → print confirmation.
Eliminates the 5-line boilerplate at the end of every composition script.
Returns `(wav_path, mp3_path)` tuple.

```python
c = canvas.make(30)
c = canvas.place(c, patterns.arp(["C3","E3","G3"], 30), 0.0)
pipeline.render(c, "my-track", "output/")
# → output/my-track.wav + output/my-track.mp3
```

### `preview_wrap(audio, pad_before_ms=3000, pad_after_ms=3000, breath_ms=0, export_path=None, bitrate="192k")`
Wrap audio with silence for preview listening. Optional direct export.
`breath_ms`: short silence after audio (pacing, distinct from padding).
