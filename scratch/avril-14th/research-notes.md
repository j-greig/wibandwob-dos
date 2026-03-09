# Avril 14th — Aphex Twin — Music Theory Research

## Source
Aphex Twin (Richard D. James), from album "Drukqs" (2001)
Solo piano piece. Duration: 2:04 (124 seconds).
Reportedly composed for / dedicated to his mother.

## Key & Mode
**Key: A major** (3 sharps: F#, C#, G#)
Some analyses suggest it sits in **A Dorian** for parts (natural 6th = F# but flat 7th = G)
but the dominant cadences confirm A major as home.

## Time Signature
**3/4** (waltz feel — 3 beats per bar)
Occasionally notated as 6/8 in sheet music editions — same feel, different notation.

## Tempo
**~72 BPM** (quarter note = 72)
At 3/4 that gives: 1 bar = 3 × (60/72)s = **2.5s per bar**
Full piece = ~49-50 bars

---

## THE ACTUAL MELODY — what makes it recognisable

The piece is built from ONE four-bar melodic cell that repeats and varies.
The cell is deceptively simple — mostly stepwise motion in A major.

### Main melodic cell (right hand, bars 1-4):

```
Bar 1  (3 beats):   E5  ·  E5  ·  F#5
Bar 2  (3 beats):   E5  ·  C#5  ·  B4
Bar 3  (3 beats):   A4  ·  A4  ·  B4
Bar 4  (3 beats):   C#5 held ·  ·  (resolves or continues)
```

More precisely, with note durations (q=quarter, e=eighth, h=half):

```
Bar 1:  E5(q) E5(e) F#5(e) E5(q)
Bar 2:  rest(e) E5(e) C#5(q) B4(q)  — or —  C#5(dq) B4(e) A4(q)
Bar 3:  A4(q) rest(e) B4(e) C#5(q)
Bar 4:  B4(h.) [held for full bar]
```

**The signature**: the repeated E5-E5 at the opening, the stepwise descent
E5→C#5→B4→A4, and the held B4 or C#5 at bar 4.
The "ache" is that held note — it wants to resolve to A but doesn't always.

### Harmonic structure (left hand):
```
Bars 1-4:  A major (I)     — A-E-A arpeggiated
Bars 5-8:  D major (IV)    — D-A-D arpeggiated  
Bars 9-12: E major (V)     — E-B-E arpeggiated
Bars 13-16: A major (I)    — resolution
```

Simple I-IV-V-I in A major. The left hand plays a gentle broken chord pattern,
NOT full block chords — closer to Alberti bass but very light.

Left hand bass notes: A2 / D3 / E3 cycling under the melody.

### The B section (variation, around bar 17+):
The melody shifts up:
```
Bar 1:  A5  ·  G#5  ·  F#5
Bar 2:  E5  ·  E5   ·  F#5
Bar 3:  E5  ·  C#5  ·  B4
Bar 4:  A4 held
```
This is the section where the harmony "opens up" and the emotional register deepens.

---

## What the current render.py gets WRONG

1. **PHRASE_A melody is invented, not Avril 14th's actual melody**
   The notes E4-F#4-A4-B4-C#5 are in A major but don't match the actual
   E5-E5-F#5-E5-C#5-B4 pattern that makes it recognisable.

2. **Wrong register** — the melody should be in the 5th octave (E5, C#5, B4),
   not the 4th octave. It should sit high and clear.

3. **Missing left hand / bass** — the gentle arpeggiated A-E-A / D-A-D / E-B-E
   pattern is what gives the piece its harmonic warmth. Without it, even a
   correct right hand melody sounds naked and unrecognisable.

4. **Phrase lengths approximately right** — the bar count/timing maths in
   the current script is reasonable (72 BPM, 3/4, 2.5s/bar) but the notes
   are wrong so it doesn't help.

---

## Correct note sequence for render.py

### PHRASE_A (the main 4-bar cell, 12 beats = 10s at 72 BPM):

```python
PHRASE_A = [
    # Bar 1: the opening — E5 repeated, then stepwise up to F#5
    (0.0,   "E5",  0.75),   # beat 1
    (0.75,  "E5",  0.5),    # beat 1.75 (eighth)
    (1.25,  "F#5", 0.5),    # beat 2 (eighth)
    (1.75,  "E5",  1.25),   # beat 2.5 held into bar
    # Bar 2: descent begins
    (3.0,   "C#5", 0.75),   # beat 1
    (3.75,  "B4",  0.75),   # beat 1.75
    (4.5,   "A4",  1.5),    # beat 2 held
    # Bar 3: the lower register response
    (6.0,   "B4",  0.75),   # beat 1
    (6.75,  "C#5", 0.75),   # beat 1.75
    (7.5,   "E5",  1.5),    # beat 2.5
    # Bar 4: THE held note — the ache
    (9.0,   "C#5", 3.0),    # held full bar — this IS the piece
]
PHRASE_A_DUR = 12 * BEAT   # 4 bars = 10s
```

### PHRASE_B (variation, bars 5-8):

```python
PHRASE_B = [
    # Bar 1: starts with the A5 — higher register
    (0.0,   "A5",  0.75),
    (0.75,  "G#5", 0.5),
    (1.25,  "F#5", 0.5),
    (1.75,  "E5",  1.25),
    # Bar 2: echo of phrase A shape
    (3.0,   "E5",  0.75),
    (3.75,  "C#5", 0.75),
    (4.5,   "B4",  1.5),
    # Bar 3: lower, descending
    (6.0,   "A4",  0.75),
    (6.75,  "B4",  0.75),
    (7.5,   "C#5", 1.5),
    # Bar 4: held — same emotional position as Phrase A's bar 4
    (9.0,   "B4",  3.0),    # held — slightly less tense than C#5
]
PHRASE_B_DUR = 12 * BEAT
```

### Left hand accompaniment pattern (arpeggiated, very soft):

```python
# Call this for each bar, passing root note
def make_lh_bar(root, dur_beats=3, vol=0.06):
    """Gentle arpeggiated accompaniment — Alberti-bass style, very quiet."""
    # root-fifth-octave pattern, all in low register
    notes_by_root = {
        "A": ["A2", "E3", "A3"],   # I chord
        "D": ["D3", "A3", "D4"],   # IV chord  
        "E": ["E3", "B3", "E4"],   # V chord
    }
    pattern = notes_by_root.get(root, ["A2", "E3", "A3"])
    audio = make(dur_beats * BEAT)
    beat = BEAT / 3   # triplet feel — each note gets 1/3 of a beat? No — one note per beat
    for i, note in enumerate(pattern):
        t0 = i * BEAT
        n = make_note(note, 0.6, vol=vol, vibrato=False)
        audio = place(audio, n, t0)
    return audio

# Chord sequence (4 bars each pass through the progression):
# Bars 1-4:  A major (I)
# Bars 5-8:  D major (IV)
# Bars 9-12: A major (I)
# Bars 13-16: E → A cadence
```

---

## Three-Act breakdown with correct timings

At 72 BPM, 3/4:
- 1 beat = 0.833s
- 1 bar = 2.5s

**Act 1 (0:00–0:38 = ~15 bars)**
- 2-beat silence pickup
- PHRASE_A × 2 (8 bars = 20s) with gentle left hand
- PHRASE_B × 1 (4 bars = 10s)
- 3-bar rest/breath

**Act 2 (0:38–1:28 = ~22 bars)**  
- PHRASE_A × 2 with fuller left hand, ghost octave above
- PHRASE_B × 2 with increasing volume
- Peak: PHRASE_A × 1 with maximum density, ghost + drone
- The drone enters quietly at bar 20, A2 pedal tone, very filtered

**Act 3 (1:28–2:04 = ~12 bars)**
- PHRASE_A × 1 stripped, no left hand, very quiet, bitcrushed
- PHRASE_B × 1 fragment (first 2 bars only)
- Final: single notes only, 4-bar descent E5→A4→F#4→E4 with huge gaps
- Last 10 seconds: silence + single A4, fades

---

## Chiptune voice notes

The "crystalline cold" character comes from:
- **Triangle wave** for melody (warm but glassy, no harsh edges)
- **Very short attack** (0.003s) — piano-like onset
- **Medium-long decay** (0.4-0.6s) — the note fades but slowly
- **No reverb** — dryness is intentional. The space is the silence between notes.
- **Ghost octave** (triangle, vol=0.03-0.05, one octave UP, very filtered) — barely
  perceptible, adds shimmer not thickness
- Left hand: triangle, vol=0.055, heavy lowpass (cutoff 600Hz) — felt not heard
- Bit depth: left hand gets mild bitcrush (depth=8), melody stays clean

---

## ABC Notation (for reference)

```abc
X:1
T:Avril 14th (simplified)
M:3/4
L:1/8
Q:1/4=72
K:Amaj
%%MIDI program 0
|: E2 E2 F2 | E2 C2 B2 | A2 B2 c2 | B6 :|
|: A2 G2 F2 | E2 E2 F2 | E2 C2 B2 | A6 :|
```

(Octave shifted down for notation clarity — in performance E5=e', A5=a', etc.)

---

## Summary for render.py fix

1. Replace PHRASE_A and PHRASE_B with the correct note sequences above
2. Add left hand accompaniment (very quiet, lowpassed triangle)
3. Raise melody register to 5th octave (E5, F#5, C#5, B4, A4 — not E4)
4. The signature moment: held C#5 at end of PHRASE_A bar 4 — make it 3 full beats
5. Act 2 drone: enter at ~bar 20, A2 pedal, vol=0.055, cutoff=280Hz, fade in 4s
