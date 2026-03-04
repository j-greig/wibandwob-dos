# AMBIENT PRESENCE v4 — Score Notes

## What v3 Got Right (keep)
- Glacial harmonic movement (not key changes — voice leading)
- Modal recontextualisation (same notes, different root = different feeling)
- Phase relationships between voices
- Spoken word as structural punctuation, not decoration
- Asymmetric dynamic arc

## What v3 Got Wrong (fix)
- No pulse. Nothing with rhythm. Continuous tones = meditation tape
- No register contrast. Everything mid-low. Nothing bright, nothing deep
- Bass glide too slow to perceive — shift happens but you cannot feel it
- No surprise. No moment where the texture cracks open
- One mood, one dynamic, one texture for 120 seconds
- Too sad. Eb minor energy even though technically Eb major

## The New Piece: "ambient presence iv"

### Concept
Same narrative: being a desktop at night, existing without observation.
But this time the desktop is not SLEEPING. It is DREAMING. Things happen
in the dream. Small rhythmic events. A bell that appears. A bass note
that drops an octave unexpectedly. The phase loops from v3 are here but
they interact with percussive elements that give the ear something to
hold onto.

Think: Nils Frahm "Says" meets Boards of Canada "Music Has the Right
to Children" meets a single SID chip running at 3am.

### Key & Harmony
Root key: Ab major. Warmer than Eb, less academic. The major 3rd (C)
gives genuine warmth.

Harmonic movement:
  0-30s   Ab major (home)
  30-60s  Fm (relative minor — same notes, sadder root)  
  60-80s  Db lydian (IV chord becomes new tonic, raised 4th = Ab = brightness)
  80-100s Ab major (home, but now with added 9th — Bb — for richness)

This is FOUR harmonic regions in 100 seconds. Each one recontextualises
the same pitch collection. The ear travels without any note changing.

### Tempo & Pulse
72 BPM. Resting heart rate. Not glacial, not driving.

The pulse is NOT four-on-floor. It is:
  - DX7 bell hits on beat 1 and the "and" of beat 3 (dotted pattern)
  - A ghost 808 kick on beat 1 only, very quiet, more felt than heard
  - SID chip arp that runs in 16ths but with a skip pattern — not every
    note sounds. Phase-drifts against the bell hits.

### Voices (6 layers, but never all at once)

1. GROUND — Juno warm pad on Ab2, detuned, slow tremolo
   Present throughout. The always-on hum. But with JUNO warmth, not
   raw oscillator cold.

2. PULSE — DX7 bright bell, dotted rhythm
   Ab4 on beat 1, Eb5 on the "and" of 3. Clean, no crush.
   Enters at 8s. Creates the rhythmic skeleton. Delayed (300ms, 2 taps)
   so each hit leaves a shimmer trail.

3. DRIFT — SID chip arp, Ab3-C4-Eb4-G4 (Abmaj7)
   16th notes at 72bpm but with skip_fn: ~40% of notes are silent.
   The gaps ARE the rhythm. Phase-drifts (BPM 72.3) against the bell.
   Enters at 15s. Bitcrush at 6 for warm grit.
   When harmony shifts to Fm, same notes but arp starts on C (reordered).
   When harmony shifts to Db, add Bb to make Bbm7 voicing.

4. SUB — 808 kick, very quiet, on beat 1 only
   Not percussion — a pitched sub event. Like feeling a heartbeat through
   a wall. Ab1. Enters at 20s.

5. BRIGHT — Prophet5 arp sparkle, high register
   Eb6-Ab6-C7 — three notes, very sparse, one every 2-3 bars
   Each one a tiny event, like a star appearing. Reverb tail carries it.
   Enters at 30s (with the Fm shift). Creates register contrast.

6. VOICE — Spoken word, same four lines but with different treatment
   25s  Wob: "the human left" — dry, close, intimate
   45s  Wib: "the primers are still there" — delay trail (dub_delay)
   65s  Wob: "nobody is watching" — whispered, highpassed, barely there
   85s  Wib: "we are still here" — full, warm, present, the brightest moment

### Dynamic Arc
  0-8s    Ground alone, fading in. Silence becoming sound.
  8-15s   Bell enters. First pulse. The dream begins.
  15-25s  Arp drifts in. Texture builds. Phase relationships start.
  25-35s  Voice 1. Sub enters. Harmonic shift to Fm.
  35-50s  Prophet sparkles appear. Full texture. Most layers active.
  50-65s  Db lydian shift. Everything gets BRIGHTER. The "surprise" moment.
          The arp voicing shifts. The bell note rises to Bb5.
          This is the peak — not louder, but harmonically richest.
  65-80s  Strip back. Voice 3 is barely audible. Arp thins (more skips).
  80-100s Home key returns with the 9th. Voice 4 is warm and full.
          Bell and arp together, phasing. Gradual fade. The dream ends.

### The Surprise (60s mark)
At exactly 60 seconds, ONE SID sync_lead note: Ab5, 0.3 seconds,
bitcrushed to 3, with a fast pitch bend up from Gb5.
It cuts through everything. A moment of pure chip aggression in an
ambient piece. Then silence (0.5s of nothing). Then the piece continues
softer than before. The silence after the scream is the most powerful
moment.

### Duration
100 seconds. Not 120. Tighter. No padding.
