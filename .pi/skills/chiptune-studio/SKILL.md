---
name: chiptune-studio
description: |
  Composable audio synthesis toolkit for building chiptune music from numpy primitives.
  Three layers: oscillators/effects/theory (raw materials), patterns (compositional gestures),
  pipeline (pydub bridge, mixing, splicing, voice, export). Use when composing original
  music for video reels, generating stingers/interstitials, mixing voiceover with score,
  or any task requiring programmatic audio synthesis. Triggers on: music composition,
  chiptune generation, audio scoring, sound design, stinger creation, reel audio mixing.
---

# Chiptune Bricks

Composable audio synthesis. Numpy in, sound out.

## Architecture

Four layers, each building on the last:

```
PRIMITIVES   osc · fx · theory · canvas    raw waveforms, effects, note math, mixing
PATTERNS     patterns                       compositional gestures that place sounds in time
SYNTHS       synths                         virtual instruments with presets (pick your gear)
PIPELINE     pipeline                       pydub bridge, file mixing, voice, export
```

All synthesis happens in numpy float64 at SR=22050. Pipeline bridges to pydub for
file operations (MP3 export, voice mixing, splicing).

## audioop-lts Required

Python 3.13+ removed the `audioop` module that pydub depends on. **Always include
`audioop-lts`** in script dependencies or pydub will crash with
`ModuleNotFoundError: No module named 'audioop'`. This is not optional.

## Quick Start

```python
# Every composition script needs this header for uv:
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
# NOTE: audioop-lts is REQUIRED — pydub breaks without it on Python 3.13+

import sys
sys.path.insert(0, "~/Repos/symbient-skills/skills/chiptune-studio/scripts")

from bricks import *

# Make a 30-second canvas, place sounds, export
c = canvas.make(30)
c = canvas.place(c, patterns.arp(["C3","E3","G3","B3"], 30, bpm=90), 0.0)
c = canvas.place(c, patterns.drone("C2", 30), 0.0, vol=0.3)
c = canvas.normalize(c)
canvas.save_wav(c, "output.wav")
```

## How to Compose

This is a toolkit, not a jukebox. The bricks are verbs. You supply the nouns.

### Creative Heuristics

When composing, think in these dimensions rather than mapping moods to presets:

**Density** — how many simultaneous layers? Two clean voices that breathe carry more
weight than six muddy ones. Start sparse, add only what earns its place.

**Register** — where in the frequency spectrum? Low instruments feel heavy, anchoring.
High instruments feel exposed, fragile. The gap between them is where tension lives.

**Movement** — what changes over time? A static drone under an evolving arp creates
contrast. Everything moving at once creates chaos (sometimes you want chaos).

**Texture** — smooth vs gritty? Bitcrush depth is the primary texture knob.
6 = warm grit. 4 = NES character. 2 = deliberate destruction. No crush = clean,
vulnerable, exposed. Texture carries emotional information.

**Space** — where is the silence? Silence after noise hits harder than noise after
noise. A rest in an arp pattern (via skip_fn) creates anticipation. Fade-ins
give the ear time to adjust. Space is a compositional choice, not absence.

**Arc** — does the piece go somewhere? Energy can build (additive layers),
decay (subtractive, progressive bitcrush), breathe (swell and retreat),
or fracture (structured patterns breaking down). The arc serves the narrative.

### The Skip-First-Idea Rule

The obvious musical choice for a given narrative is almost never the interesting one.
When you reach for C minor... stop. When you default to 4/4 at 120bpm... stop.
Log the first instinct, then make a different choice. The second or third idea
carries the composer's actual thinking rather than pattern-matching.

### Influences Percolate

Don't build lookup tables (sad → minor, happy → major). Instead, let multiple
influences inform decisions simultaneously:

- The narrative's pacing and emotional weight
- Whatever musical references feel resonant (not prescriptive genre-matching)
- Physical constraints (duration, voice frequency range to avoid)
- What you HAVEN'T done recently (check compose-fingerprints.jsonl)
- Random constraints as creative fuel (forced tempo, waveform bans, layer limits)

These inputs create a field of possibilities. The composition emerges from their
intersection, not from any single input dictating the output.

### Structural Thinking

Pieces have sections. Sections have layers. Layers have sounds.

Common structural moves (not rules, just vocabulary):
- **Additive**: start with one voice, add layers over time
- **Subtractive**: start full, remove or degrade elements
- **Call and response**: two voices alternating
- **Pointillist**: isolated events with space between them
- **Drone-and-detail**: sustained bed with moving elements over it

Transitions between sections: crossfade, silence gap, filter sweep, rhythmic
break, new element entering early (foreshadowing).

## Synths — Virtual Instruments

The `bricks.synths` module provides classic synthesiser emulations with presets.
Each synth is a single Python file with an engine function and named presets.
All share a consistent API: `play(note, dur, preset=)`, `list_presets()`.

### Available Synths

| Module | Instrument | Character | Key methods |
|--------|-----------|-----------|-------------|
| `juno` | Roland Juno-106 | Warm detuned chorus polysynth | `play`, `chord`, `bass_chord` |
| `tb303` | Roland TB-303 | Acid bass with filter sweep | `play`, `slide`, `slide_notes` |
| `monopoly` | Korg Monopoly | PWM mono lead with portamento | `play`, `phrase` |
| `prophet5` | Prophet-5 | Dual-osc polysynth with drift | `play`, `chord`, `arp` |
| `ms20` | Korg MS-20 | Aggressive dual-filter bass monster | `play`, `chord`, `bass_fifth` |
| `odyssey` | ARP Odyssey | Ring mod, S&H, metallic weirdness | `play`, `duo`, `chord` |

### Available Drum Machines

| Module | Machine | Type | Character |
|--------|---------|------|-----------|
| `tr808` | Roland TR-808 | Synthesised | Boomy, the hip-hop/electro kick |
| `linndrum` | LinnDrum LM-2 | Sample-based | Dry, punchy, 8-bit, 80s pop |
| `cr78` | Roland CR-78 | Sample-based | Thin, metallic, lo-fi, 1978 |

All drum machines share the `kit(preset=)` API returning a dict of callable functions.

### Usage

```python
from bricks.synths import juno, tb303, ms20, prophet5, odyssey
from bricks.synths import tr808, linndrum, cr78

# Synths
pad = juno.chord(["Eb3", "G3", "Bb3"], 4.0, preset="warm_pad")
acid = tb303.play("Eb2", 0.5, preset="acid_saw")
bass = ms20.play("Eb1", 1.0, preset="screaming_bass")
arp_line = prophet5.arp(["Eb4", "G4", "Bb4"], 4.0, preset="arp_sparkle")
bells = odyssey.play("Eb4", 1.0, preset="ring_mod_bell")

# Drum kits
drums = linndrum.kit("classic")   # or tr808.kit("minimal_techno"), cr78.kit()
kick = drums["kick"]()
snare = drums["snare"]()
hat = drums["hh"]()
```

### Genre Palette Guide

These are starting points, not rules. Mix and match.

| Genre | Synths | Drums | Notes |
|-------|--------|-------|-------|
| Techno | tb303 acid_saw, juno stab | tr808 minimal_techno | Four-on-the-floor, acid filter sweeps |
| Italo disco | juno italo_bass, juno warm_pad | tr808 electro or linndrum | Chorus bass, lush pads |
| Synth-pop | prophet5 poly_pad, monopoly numan | linndrum classic | Linn kick, Prophet strings, Monopoly lead |
| Industrial | ms20 industrial, odyssey metallic_stab | tr808 classic | MS-20 drive cranked, ring mod |
| Ambient | prophet5 dark_strings, ms20 drone | cr78 (sparse) | Long attacks, slow filter sweeps |
| Hyperpop | odyssey alien_fx, ms20 screaming_bass | tr808 trap | Bitcrushed, pitch-shifted, chaotic |
| New wave | monopoly thin_80s, juno string_pad | cr78 or linndrum | CR-78 gives the authentic primitive feel |

## Pattern Reference

Full API docs for all functions: `references/pattern-catalog.md`

Read that file when you need parameter details, function signatures, or usage
examples. What follows here is the conceptual vocabulary.

### Pattern Vocabulary (gestures, not recipes)

| Pattern | What it does | Compositional role |
|---------|-------------|-------------------|
| `arp` | Cycles notes at tempo | Harmonic motion, pulse, melodic backbone |
| `sequencer` | Beat grid with hit patterns | Rhythmic foundation, groove |
| `sparkle` | Rapid note cascade | Accent, transition, shimmer |
| `drone` | Sustained tone bed | Foundation, mood, harmonic anchor |
| `ghost_echo` | Delayed octave-shifted replica | Depth, haunting, doubling |
| `noise_breath` | Filtered noise bursts | Organic texture, air between tones |
| `sub_rumble` | Ultra-low sine | Subsonic weight, physical sensation |
| `stinger_hits` | Escalating hit sequence | Punctuation, drama, tension build |
| `resolve` | Clean sustained note | Emotional payoff, release, ending |

### Effect Vocabulary

| Effect | Sonic character | Compositional use |
|--------|----------------|-------------------|
| `bitcrush` | Digital grit | Texture control (depth 2-8 range) |
| `tremolo` | Amplitude wobble | Movement in static sounds |
| `reverb` | Metallic room | Space, lo-fi depth |
| `delay` | Discrete echoes | Rhythmic complexity, space |
| `lowpass` | Warmth, muffling | Distance, intimacy, frequency masking |
| `highpass` | Thinning | Isolation, fragility |
| `env` | ADSR shape | Attack character, sustain, release tail |

## Pipeline Operations

When the composition needs to leave numpy world:

- `canvas.to_pydub(audio)` / `canvas.from_pydub(segment)` — the bridge
- `pipeline.mix_layers()` — overlay multiple AudioSegments at dB offsets
- `pipeline.splice_at()` — insert audio at a precise timecode
- `pipeline.duck_envelope()` — generate sidechain gain curve from voice
- `pipeline.say_to_segment()` — macOS TTS → AudioSegment
- `pipeline.export_mp3()` — standard export with optional normalize + fade
- `canvas.mix_with_voice()` — quick numpy music + voice file → MP3

## Dependencies

```
numpy, scipy, pydub, audioop-lts
```

All scripts should use `uv run` with inline metadata:
```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
```

## Anti-Patterns

- Reimplementing oscillators in every script (use `from bricks import *`)
- Defaulting to C minor at 120bpm (the chiptune uncanny valley)
- Six layers when two would breathe better (if the narrative is 'simple', that is)
- Ignoring silence as a compositional element
- Keeping the same pacing and key for the entire piece
- Mood→preset lookup tables instead of genuine creative decisions
- Forgetting the numpy/pydub boundary (synthesis in numpy, file ops in pydub)
