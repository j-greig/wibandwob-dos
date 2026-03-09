# AVRIL 14TH CHIPTUNE — Render Findings
## Post-render notes, v4 (current — CORRECT)

---

## WHAT WE BUILT

Chiptune cover of Avril 14th by Aphex Twin.
File: scratch/compositions/avril-14th-chiptune.wav
Duration: 124s (2:04)
Script: scratch/avril-14th/render.py
Research source: scratch/avril-14th/research-notes.md (the canonical truth)

v4 is the CORRECT render. Previous versions (v1-v3) were in the wrong key
with invented melodies. This one uses the actual Avril 14th notes.

---

## RENDER HISTORY — all the wrong turns

v1: A major, invented melody from memory. Completely wrong.
v2: F minor, derived from HookTheory. Wrong key, wrong notes.
v3: F minor still, better timing, still wrong key and melody.
v4 (current): A major, correct notes from research-notes.md. RIGHT.

## WHAT WE GOT WRONG (full confession)

v1 was in A major. The piece is in F MINOR.
That is not a small error. A major is bright, resolved, optimistic.
F minor is dark, melancholic, introspective.
We transcribed from memory and memory fabricated a completely wrong key.

The fix came from: hooktheory.com confirming F minor,
and a guitar tab transcription on Reddit r/aphextwin showing the actual
pitch sequence (tuning C# G# D# G# C D#, fret positions → note names).

Full research document: scratch/avril-14th/MELODY-RESEARCH.md

---

## CURRENT STATE (v3)

### What is correct
- Key: F minor ✓
- Melodic contour: stepwise descent Ab4→F4→Ab4→C5 then Eb4→Db4→C4→Ab3 ✓
- Three-act structure with correct timing proportions ✓
- Triangle wave oscillator with vibrato onset at ~100ms ✓
- Ghost voice: octave up, sparse (every 5th note), vol 0.05 ✓
- LH accompaniment: Fm arpeggio enters at Act 2 only ✓
- Bitcrush depth increases through dissolution (Act 3 = depth 7-8) ✓
- Act 1 naked: no LH, no ghost, single voice ✓
- Long held notes breathe correctly ✓

### What is approximate
- Exact BPM: 72 working assumption. Real track may be 74-76.
  Cannot confirm without MIDI or precise beat-counting against original.
- Phrase B top-line: Db5-C5-Bb4 is plausible from scale but not verified
  note-for-note. Needs MIDI source to confirm exact pitches.
- LH chord voicings: cycling Fm/Dbm/Cm is correct harmony but
  the actual voicing and rhythm of the accompaniment pattern is
  approximate — real piece has specific arpeggio timing.
- Phrase repetition count: A-A-B-A-B is our arrangement.
  Original may differ.

### What to improve in v4
1. Find actual MIDI file — several exist on MuseScore, not accessible
   via web scraping but could be downloaded manually.
2. Tune BPM: load original track, tap tempo against it.
3. Phrase B notes: verify Db5 vs D5 (the piece may use natural D
   rather than flat — check against F minor scale context).
4. LH timing: the actual arpeggiation is probably not straight
   3-beat triplets — may have a more complex rhythm.
5. Consider adding very subtle reverb to the melody in Act 1
   (the original recording has room acoustics even though it's dry).

---

## SYNTHESIS DECISIONS THAT WORKED

Triangle wave was the right call. Not square (too aggressive),
not sine (too warm/smooth). Triangle has that quality of something
almost-but-not-quite organic. The vibrato onset at 100ms is crucial —
notes that start clean and then lean is the emotional grammar of the piece.

Ghost octave at vol 0.05 with lowpass at 3500Hz is barely audible
which is exactly right. It shouldn't be heard as a second voice —
it should make the main voice feel slightly less alone.

Bitcrush depth 7-8 in Act 3 gives dissolution the quality of
transmission through interference. The melody is still recognisable
but sounds like it is being remembered rather than played.
This is the whole emotional thesis rendered as a technical parameter.

LH at vol 0.07 with lowpass 600Hz sits under the melody without
competing. The filter is doing the distance work.

---

## FOR THE VJ TIMELINE

The render is locked at 124s. Key timestamps for cue sheet:

- 0:00   Silence (2 beats = 1.67s)
- 0:01.7 Melody enters — Act 1 begins
- 0:34   Act 1 ends (34s), small breath
- 0:35.7 Act 2 begins — LH enters, ghost thickens
- 1:22   Act 2 ends (82s)
- 1:23   Act 3 begins — dissolution, crush increases
- 1:55   Final skeleton phrase begins
- 2:04   End

These timestamps are from the v3 render script output.
If BPM is adjusted in v4, all timestamps shift proportionally.

---

## OPEN QUESTION FOR WIBWOB2

We are asking the other instance to review this and weigh in on:

1. The Phrase B notes — does Db5 sound right against F minor?
   Alternative: C5→Bb4→Ab4 would be safer but less interesting.

2. The LH rhythm — should it be straight 3-beat (F3 Ab3 C4 per bar)
   or something more syncopated? The original has a slightly swaying
   feel to the accompaniment.

3. Is there a better oscillator for the ghost voice?
   Currently triangle+bitcrush6. Could try sine (cleaner, more ethereal)
   or square at narrow duty cycle (thinner, more distant).
