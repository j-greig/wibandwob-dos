# Doom E1M1 "At Doom's Gate" — Chiptune Cover Walkthrough

Complete annotated example of the chiptune-cover process applied to
scoring a 42-second video reel about a dying Doom player.

## 1. RESEARCH

**Source:** Doom E1M1 "At Doom's Gate" by Bobby Prince (1993)

**Findings:**
- **Key:** E Phrygian (E F G A B C D)
- **BPM:** 170 (driving metal tempo)
- **Core riff:** `E E D C Bb B` — E pedal with descending chromatic melody
- **Signature:** The Bb is a chromatic passing tone outside E Phrygian. The Bb→B resolution is what makes it snarl.
- **Structure:** Pedal-tone driven. E2 eighth notes underneath, melody rides on top.

**Research path:** Web search → Hooktheory TheoryTab → verified against known transcriptions.

## 2. ARRANGE

**Translation decisions:**

| Original | Chiptune version |
|---|---|
| Heavy metal guitar riff | `sawtooth` arp at 170 BPM, `crush=3`, `lowpass(2000)` |
| Palm-muted E pedal | `square` arp on E2 repeats, `note_frac=0.5`, `lowpass(800)` |
| Bass guitar | `sub_rumble("E1")` for subsonic weight |
| Drums | `noise(0.06)` + `lowpass(150)` + tight ADSR, placed at 0.35s intervals |
| "Wide" moments | Detuned `pad()` pairs (E+G+B) with `triangle`, `tremolo` |
| Resolution | Clean `resolve("E3")` with reverb |

**Riff arrays defined:**
```python
RIFF_NOTES = ["E3", "E3", "D3", "C3", "Bb2", "B2"]    # Main phrase
RIFF_NOTES_B = ["E3", "E3", "D3", "C3", "A2", "B2"]   # Variation (A instead of Bb)
```

The B variation goes to A2 instead of Bb2, keeping the chromatic resolution (A→B whole step vs Bb→B half step) but changing the approach angle.

## 3. SCENE-MATCH

Video has 6 scenes with known timecodes from voiceover:

| Scene | Time | Emotional arc | Arrangement |
|---|---|---|---|
| The Request (hospital) | 0-8.4s | Quiet, still | E2 triangle drone + isolated riff bleeps (heart monitor) |
| The Screen (game loads) | 8.4-13.8s | Building | Half-speed riff awakens, E pedal starts |
| Health Pack (playing) | 13.8-20.2s | Full intensity | Full riff 170 BPM, driving pedal, sub, kicks |
| Comfort Item (shotgun) | 20.2-26.8s | Peak aggression | Riff variation B, octave doubling, combat noise |
| Brothers & Sisters | 26.8-35.5s | Reflective/wide | Hymnal riff (1/3 speed, triangle), choir pads, sparkle |
| The Exit | 35.5-42s | Resolution | Clean E3 resolve, ghost of riff whispered |

**Key arrangement decisions:**
- Scene 1 uses `bitcrush(depth=5)` on bleeps to sound like medical equipment
- Scene 2 runs at `BPM // 2` (half speed) as the riff "wakes up"
- Scene 3 is the first full-speed riff moment — the backbone arrives
- Scene 4 doubles the melody with ghost octave (`triangle`, vol=0.04)
- Scene 5 switches to `BPM // 3` and moves from sawtooth → triangle wave
- Scene 6 has a single `resolve()` + ghost riff at `BPM // 4`, barely audible

## 4. COMPOSE — Key Code Patterns

### Hospital drone (Scene 1)
```python
hosp_drone = drone("E2", 8.4, wave_fn=triangle)
hosp_drone = lowpass(hosp_drone, 200)
hosp_drone = tremolo(hosp_drone, rate=0.03, depth=0.2)
hosp_drone = env(hosp_drone, a=3.0, d=0.5, s=0.6, r=2.0)
c = canvas.place(c, hosp_drone, 0.0, vol=0.10)
```
Very slow tremolo (0.03 Hz = one cycle per 33 seconds). Heavy lowpass at 200Hz.
The drone IS the hospital. It hums.

### Riff bleeps as heart monitor (Scene 1)
```python
for i, note in enumerate(RIFF_NOTES[:4]):
    bleep = sine(note_freq(note), 0.15)
    bleep = env(bleep, a=0.005, d=0.05, s=0.3, r=0.08)
    bleep = bitcrush(bleep, depth=5)
    c = canvas.place(c, bleep, 2.0 + i * 1.5, vol=0.06)
```
Only the first 4 riff notes. 1.5s spacing. Short sine bleeps, not arps.
The melody exists before the game loads... it's in the hospital equipment.

### Noise kicks (Scenes 3-4)
```python
for beat_offset in np.arange(0, 6.6, 0.35):
    kick = noise(0.06)
    kick = lowpass(kick, 150)
    kick = env(kick, a=0.002, d=0.03, s=0.1, r=0.02)
    c = canvas.place(c, kick, 20.2 + beat_offset, vol=0.13)
```
0.35s spacing at 170 BPM = roughly every other 8th note. Not every beat.
Loose enough to drive without trampling the riff.

### Choir pads (Scene 5)
```python
choir_e = pad(note_freq("E3"), note_freq("E3") * 1.005, 8.7,
              blend=0.5, wave_fn=triangle)
choir_e = lowpass(choir_e, 600)
choir_e = tremolo(choir_e, rate=0.08, depth=0.15)
choir_e = env(choir_e, a=2.0, d=1.0, s=0.6, r=3.0)
```
Detuned by factor of 1.005 (about 1Hz at E3). Slow tremolo. Long envelope.
Three pads stacked (E3, G3, B3) with staggered entries for the E minor chord.

### Sparkle cascade (Scene 5)
```python
spark = sparkle(["E4", "G4", "B4", "E5", "G5"], start_t=0.0, dur=6.0,
                spacing=0.12, wave_fn=sine, crush=6, peak_vol=0.06)
spark = reverb(spark, decay=0.4, delay_ms=100)
c = canvas.place(c, spark, 29.0, vol=0.04)
```
E minor pentatonic ascending. Each dot on the "226,377 upvotes" screen becomes
a note in the cascade. The sparkle IS the community appearing.

## 5. MIX

Score rendered to WAV, then mixed under voiceover in a separate script:

```python
score_quiet = score - 5.5  # -5.5dB under voice
mixed = voiceover.overlay(score_quiet)
tail = AudioSegment.silent(duration=1500)
mixed = mixed + tail
mixed = mixed.fade_out(3500)
```

-5.5dB keeps the music audible but never competes with speech. The 1.5s silent
tail + 3.5s fade-out lets the final resolve ring and die naturally.

## Errors Encountered

- `ghost_echo()`: used `delay_ms` kwarg which doesn't exist. Correct params: `time_offset`, `octave_shift`, `sparsity`
- `noise_breath()`: used `burst_rate` kwarg which doesn't exist. Correct params: `n_breaths`, `dur_range`, `cutoff`
- `sparkle()`: used `density` kwarg which doesn't exist. Correct params: `start_t`, `dur`, `spacing`

Always check `chiptune-studio/references/pattern-catalog.md` for exact function signatures.
