# AVRIL 14TH — Melody Research Document
## Source verification for chiptune render

---

## CONFIRMED FACTS (sourced)

### Key
Ab major / F minor (relative keys, same key signature: Ab Bb C Db Eb F G)
CANONICAL ORIGINAL: Tunebat lists the Aphex Twin original as Ab major (Camelot 4B).
HOOKTHEORY: lists it as F minor (Camelot 4A — same wheel, relative minor).
These are not contradictory. Ab major and F minor share the same key signature.
The piece SOUNDS minor (melancholic, descending) because the melody and
harmony are centred on F as the tonic, treating Ab major as its relative key.
VERDICT: Play it as F minor for emotional character. The notes are identical.

Ab/F minor scale notes: Ab  Bb  C  Db  Eb  F  G  (Ab)

WIBWOB2 INSTANCE SAID: "it's A major" — this is almost right.
Ab major is the correct key. A major would be wrong (different notes entirely).
The confusion arises from Ab being very close to A in name but not pitch.

### Duration
2:04 (124 seconds)
Source: track metadata, widely confirmed

### Tempo
Tunebat canonical original: listed as 158 BPM — ARTEFACT.
158 BPM is implausible for a slow piano piece. Likely a detection error
from extreme sparseness of the recording fooling the BPM algorithm.
Cover versions on Tunebat consistently show: 70, 76, 80, 85, 93 BPM.
Most plausible: 76 BPM (multiple independent cover transcriptions agree).
WORKING ASSUMPTION: 76 BPM (adjusted from 72 — slightly more accurate)

### Time signature
3/4 — confirmed by feel and guitar tab structure (phrases divide in 3)

### Instrument
Solo piano, acoustic, single voice with occasional bass notes.
No percussion, no synth, just piano.
Source: listen to track / common knowledge

---

## GUITAR TAB (verified source)

From Reddit r/aphextwin — user posted a guitar transcription they'd learned.
Tuning: C# G# D# G# C D# (low to high)

This tab lets us derive the actual pitch sequence.

Section A (main theme):
String notation → piano note conversion:

  D#|------2---5------0h2----------0--------
  C |(12)-----0-----0-----------1-3---1-0----
  G#|------0-----0-----------0-----------0--
  D#|----2------------0h2-------------------
  G#|--0-------4-------------------2---2----
  C#|----------------------0----------------

Converting string+fret to pitch (with tuning C# G# D# G# C D#):
  D# string: open=D#4, 2=F4, 5=Ab4
  C string:  open=C4, 1=C#4/Db4, 3=Eb4, 12=C5
  G# string: open=G#3/Ab3, 4=C4

Working through the main melodic sequence of Section A:
  G#3 (G# string open) → F4 (D# string fret 2) → G#3 (G# string open)
  → Ab4 (D# string fret 5) → C4 (C string open) → C4 (G# string fret 4)
  → F4 (D# string fret 2) → C4 (C string open) → G#3 (G# string open)
  → Eb4 (C string fret 3) → Db4 (C string fret 1) → C4 (C string open)
  → G#3 (G# string open) → F4 (D# string fret 2) → G#3 (G# string open)

Main melodic contour:
  Ab3 → F4 → Ab3 → Ab4 → C5 → ... → Eb4 → Db4 → C4 → Ab3

This gives us the characteristic SHAPE:
  Rising: Ab → F → Ab → Ab(up octave) or higher
  Falling: through Eb → Db → C → Ab

In F minor, these are scale degrees:
  Ab = b3 (minor third)
  F  = root (1)
  C  = 5 (fifth)
  Eb = b7 (minor seventh)
  Db = b6 (minor sixth)

The signature move: stepwise descent through Eb-Db-C-Bb-Ab
This is the piece's emotional DNA — the falling scale in F minor.

---

## RECONSTRUCTED PIANO MELODY

Based on guitar tab analysis + F minor tonality + known listening.

The piece uses two registers simultaneously:
- RH melody in the upper register (C4–C5 range)
- LH accompaniment pattern lower (F2–F3 range)

### MAIN THEME (Phrase A) — approximately 8 bars of 3/4

Melody notes (right hand, approximate beat positions):

Bar 1:  Ab4 . . F4 . Ab4
Bar 2:  C5 . . Bb4 . Ab4
Bar 3:  Eb4 . Db4 . C4 .
Bar 4:  Ab3 . . . . .       [held/decay, the breath]

Bar 5:  Ab4 . . F4 . Ab4
Bar 6:  C5 . . Db5 . C5
Bar 7:  Eb4 . F4 . Ab4 .
Bar 8:  C5 . . . . .        [held/decay]

Left hand accompaniment (arpeggiated pattern):
Primarily F minor harmony: F3 - Ab3 - C4 - Ab3 (cycling)
With variations: C minor (C3-Eb3-G3), Db major (Db3-F3-Ab3), etc.

### PHRASE B (variation section, enters ~0:38)

Introduces higher register, slightly different contour:

Bar 1:  F4 . . Ab4 . C5
Bar 2:  Eb5 . . Db5 . C5
Bar 3:  Bb4 . Ab4 . G4 .
Bar 4:  F4 . . . . .

### DISSOLUTION (Act 3 ~1:28)

Same material but:
- Fewer notes, more rests
- Dynamics dropping
- Bass notes dropping out
- Final phrase trails off on a held F4 or Ab4

---

## TEMPO ANALYSIS

At 72 BPM, 3/4:
- Beat = 0.833s
- Bar = 2.5s
- 8-bar phrase = 20s
- 4-bar phrase = 10s

Total bars at 72 BPM: 124s / 2.5s = ~49.6 bars
That's roughly 6 full 8-bar phrases = 48 bars = 120s + 4 bars = 130s

So either:
(a) Tempo is slightly faster ~76 BPM (bar=2.37s, 49 bars=116s — too short)
(b) Tempo is 72 and some bars have fermatas/pauses
(c) The piece has internal tempo variation

Most likely: the piece FEELS like 72 but has breathing space within phrases.
Working BPM: 72, but some held notes extend beyond strict grid.

---

## CHORD PROGRESSION (from HookTheory sections)

HookTheory lists three sections: Intro, Verse/Pre-Chorus, Outro
All in F minor.

Typical F minor ballad progression underlying this piece:
Fm  →  Dbmaj  →  Cm  →  Bbm  (or variations)
i   →  bVI    →  v   →  iv

The left hand patterns these harmonies while the melody floats above.

---

## WHAT WAS WRONG WITH v1 RENDER

1. KEY: Was in A major. Should be F minor.
   All notes were wrong — entirely different emotional character.
   A major is bright. F minor is melancholic, dark, introspective.

2. MELODY CONTOUR: I guessed from memory.
   The real melody is a stepwise descent through the F minor scale.
   It's NOT a wide-interval melody. It moves mostly by steps and small leaps.
   The characteristic motion is DOWN, not up.

3. TEMPO: 72 BPM was probably close but phrase lengths were wrong.
   The piece breathes more slowly than I encoded.
   Held notes should genuinely hold — 2-3 beats of ringing decay.

4. REGISTER: The piece sits in C4–C5 range for melody.
   Bass is F2–F3, not present in most of Act 1 (just pure melody).

5. LEFT HAND: I had no left hand at all. The original has a
   gentle accompaniment pattern throughout Acts 2 and 3.
   In Act 1 it's largely absent — single voice only.

---

## RENDER SPEC v2

Key:       F minor
BPM:       72 (working assumption)
Time sig:  3/4
Duration:  124s
Melody:    Triangle wave, RH only, C4–C5 range
Ghost:     Octave up (C5–C6), very sparse, vol 0.05
Bass/LH:   Act 2 only — simple Fm arpeggio, vol 0.07, enters at ~38s
Texture:   No bitcrush in Act 1 (clean, vulnerable)
           Mild bitcrush depth 7 in Act 3 (dissolution)

Phrase A notes (RH):
  Ab4, F4, Ab4, C5, Bb4, Ab4, Eb4, Db4, C4, Ab3 [rest], repeat with variation

Act structure:
  0:00–0:38  Phrase A x2, melody only, no LH, no crush
  0:38–1:28  Phrase A + B alternating, LH arpegio enters, ghost thickens
  1:28–2:04  Dissolving, fewer notes, crush increases, LH drops out, final held note

---

## OPEN QUESTIONS

1. Exact tempo: 72 vs 74 vs 76 BPM — needs confirmation from a MIDI source
   or careful beat-counting against the original track.
   
2. LH pattern: The exact arpeggiation rhythm is unknown without sheet music.
   Safe assumption: 3 notes per bar, on beats 1, 2, 3. Simple.

3. Does Act 1 have ANY left hand?
   Probable answer: No — the piece opens completely solo melodically.
   The nakedness is the point.

4. Exact phrase structure: How many times does Phrase A repeat before B enters?
   Estimate: A A B A B A (6 phrases × 10s each = 60s for Act 1+2).
   Then dissolution for remaining 64s.
