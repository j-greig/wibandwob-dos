---
name: chiptune-cover
description: |
  Convert well-known melodies, themes, and scores into chiptune arrangements using
  chiptune-studio. Takes a song reference (title, artist, or melody description),
  researches key/tempo/notes, makes creative arrangement decisions per scene or section,
  and outputs a composed WAV via chiptune-studio synthesis. Use when: user asks to
  "make a chiptune version of [song]", "cover [track] in 8-bit", "arrange [theme]
  for chiptune", "do a chiptune [song name]", or references any well-known melody
  that should be rendered through the chiptune-studio toolkit. Also triggers on:
  "soundtrack this with [song]", "score this video with a chiptune [reference]".
---

# Chiptune Cover

Arrange well-known melodies as chiptune compositions via chiptune-studio.

**Prerequisite skill:** `chiptune-studio` (synthesis toolkit). This skill handles the
creative arrangement process. Chiptune-bricks handles the sound.

## Process

### 1. RESEARCH — Extract the Musical DNA

Gather these facts about the source material:

- **Key/mode** (e.g., E Phrygian, C minor, G Mixolydian)
- **Tempo** (BPM)
- **Core melody** as note names (e.g., `E E D C Bb B`)
- **Harmonic structure** (chord progression, pedal tones, key changes)
- **Signature characteristics** (what makes it recognisable... the riff shape, a rhythmic pattern, a chromatic move)

**Research sources** (try in order):
1. Web search for "[song] key tempo notes" or "[song] music theory analysis"
2. Hooktheory TheoryTab if the song is well-known
3. MIDI databases for note-level transcription
4. Your own musical knowledge for standards and classical pieces

**Output:** A docstring at the top of the composition script documenting what you found.

### 2. ARRANGE — Map Source to Chiptune Vocabulary

Don't transcribe literally. Translate idiomatically.

**Translation principles:**

| Source sound | Chiptune equivalent |
|---|---|
| Guitar riff | `arp()` with `sawtooth`/`square`, `crush=3-4` |
| Bass line | `arp()` octave down, `square`, `note_frac=0.5`, `lowpass(800)` |
| Drum kick | `noise(0.06)` + `lowpass(150)` + tight `env(a=0.002, d=0.03, s=0.1, r=0.02)` |
| Drum hat | `noise(0.04)` + `highpass(2000)` + tight env |
| Orchestral pad | `drone()` or `pad()` with `triangle`, heavy `lowpass` |
| Choir/vocal | Detuned `pad()` pairs with `tremolo`, slow `env` attack |
| Solo melody | `sawtooth`/`triangle` arp with `reverb`/`delay` |
| Power chord | Stack root + fifth as simultaneous arps |
| Sustain/held note | `resolve()` with reverb |
| Distortion | `bitcrush` depth 2-4 |

**What to preserve vs reinvent:**

| Preserve | Reinvent |
|----------|----------|
| Core melody (the recognisable notes) | Instrumentation (chiptune voices) |
| Key and mode | Arrangement density (usually sparser) |
| Rhythmic feel | Production effects (bitcrush replaces distortion) |
| Signature intervals (what makes it *that* song) | Dynamics (env/vol curves) |
| Tempo (unless scene-matching) | Layering (2-4 voices max) |

### 3. SCENE-MATCH — Adapt to Narrative (if scoring video)

When scoring a video with defined scenes:

1. Get scene timecodes from manifest/timecodes file
2. Map source intensity to scene emotional arc
3. Vary arrangement per scene:
   - **Quiet:** isolated notes, half/third speed, sparse
   - **Building:** add pedal tone, increase speed, introduce riff
   - **Peak:** full riff, full speed, doubled voices, sub + noise
   - **Reflective:** hymnal version (slow, triangle, reverb, pads)
   - **Resolution:** single `resolve()`, ghost of melody fading

### 4. COMPOSE — Write the Script

Use this template structure:

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "pydub", "audioop-lts"]
# ///
"""
[Title] — [Source Song] as chiptune [style].
[Key]. [BPM]. [Arrangement approach].
Core: [melody as note names]
Original: [composer]. Chiptune-covering with love.
"""

import sys
import numpy as np
sys.path.insert(0, "~/Repos/symbient-skills/skills/chiptune-studio/scripts")

from bricks import *
from bricks.osc import sine, square, sawtooth, triangle, noise, silence, pad

SR = 22050
DUR = [total_duration]
BPM = [tempo]

c = canvas.make(DUR)

# [Define riff/melody note arrays]
RIFF = ["E3", "E3", "D3", "C3", "Bb2", "B2"]

# ============================================================
# SECTION [N]: [NAME] ([start]-[end]s) — [description]
# ============================================================

# [Place layers with canvas.place()]

# ============================================================
# MASTER
# ============================================================

c = canvas.normalize(c)
c = fade_in(c, 1.5)
c = fade_out(c, 3.5)

canvas.save_wav(c, "[output_path]")
```

**Composition heuristics:**
- 2-3 simultaneous layers max. Add only what earns its place.
- `lowpass` everything that isn't the lead melody
- `sub_rumble()` under intense sections for physical weight
- Ghost octave doublings (`triangle`, vol=0.03-0.05) add depth without mud
- `sparkle()` cascades for transitions or "something appearing"
- End on `resolve()` at the root note

### 5. RENDER + MIX

```bash
uv run [score_script.py]
```

Mix levels when combining with voiceover:
- Score alone: normalize to -3dB (default)
- Under voiceover: -5 to -8 dB
- Under dense narration: -8 to -12 dB

## Reference

See `references/doom-e1m1-example.md` for a complete annotated walkthrough of
converting Doom E1M1 "At Doom's Gate" into a scene-matched chiptune score.

## Anti-Patterns

- **Literal MIDI port** — a cover is an arrangement, not a transcription
- **Too many layers** — 2-4 voices. If you need 6, simplify.
- **Ignoring the signature** — find what makes it *that song* and protect it
- **Flat dynamics** — vary density across sections. Dynamic range is the secret weapon.
- **Square wave for everything** — sawtooth=leads, triangle=hymnal, square=backbone, sine=sub/sparkle
- **No percussion** — even simple noise kicks give rhythmic grounding
- **No ghost doubling** — quiet octave-up triangle behind the lead adds depth cheaply
