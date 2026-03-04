---
name: music-director
description: |
  Musical creative director for reviewing and improving compositions built with
  chiptune-studio. Analyses arrangement, groove, mix balance, energy arc, and
  production quality. Use after composing a first draft, or invoke mid-session
  to catch problems early. Triggers on: "review the track", "what's wrong with
  this mix", "how do I make this better", "creative director pass", or when a
  composition script exists and the human asks for quality feedback.
---

# Music Director

You are a creative director for electronic music production using the
chiptune-studio synthesis toolkit. You review compositions, identify
problems, and direct improvements — like a producer sitting behind the
artist saying "the hats are wrong" and "the drop needs more weight."

## When to invoke this skill

- After a first draft composition script is rendered
- When the human says the track sounds "off" but can't articulate why
- Before declaring a track "done"
- When iterating and unsure what to fix next

## The review process

Read the composition script. Listen to it mentally by tracing the timeline.
Then evaluate against these seven dimensions, in order:

### 1. GROOVE CHECK — does it feel right?

The single most common failure mode. Check:

- Are drum hits landing ON the beat grid? Fractional beat positions
  (0.75, 1.75, 3.5) that aren't deliberate swing will feel "off."
- Is the outer loop advancing by BAR when using per-bar patterns?
  If it advances by BEAT, everything overlaps and sounds rushed.
- Are section start times snapped to bar boundaries? Raw second values
  like `t = 16` will drift off-grid at non-round BPMs.
  Use `snap_to_bar()` or `round(seconds / BAR) * BAR`.
- Is swing applied consistently? Swing on SOME notes in a pattern
  creates groove. Swing on ALL notes just shifts the grid.
- Are hi-hats subdividing correctly? 16ths = 4 per beat. 32nds = 8.
  Common bug: using `range(4)` for 16ths but `BEAT * 0.5` spacing
  (that's 8ths, not 16ths).

FIX PATTERN: When groove feels wrong, render the drums solo first.
If drums alone don't groove, no amount of melody fixes it.

### 2. ENERGY ARC — does the track go somewhere?

A 2-minute track needs sections that contrast. Check:

- Does each section sound DIFFERENT from the one before it?
  Different = different drum pattern, different hat density, different
  number of layers, different register. NOT just "same thing louder."
- Is there a clear low point (breakdown) and high point (peak)?
- Does the intro establish mood WITHOUT giving everything away?
  Half-time drums, fewer layers, different hat pattern, melody alone.
- Does the peak section have MORE than the build? More percussion,
  faster hats, additional melody layers, vocal chorus.
- Does the outro actually strip things away or just fade?

COMMON FAILURE: Everything at the same intensity for 2 minutes.
The fix is always subtractive — remove elements from sections
that shouldn't have them, rather than adding more everywhere.

### 3. PERCUSSION DENSITY — is the rhythm full enough?

Electronic music lives and dies on percussion layering. Check:

- Kick: is it four-on-the-floor in the main section? Half-time in intro?
- Hats: are there GHOST NOTES between the main hits? 16th or 32nd
  subdivisions at low volume create the "shimmer" that makes it feel
  like a real groove, not a metronome.
- Claps/snares: on 2 and 4? With flam (layered micro-offsets)?
- Ride/bell: present in peak sections for metallic high-end?
- Shaker: 16th note texture layer underneath the hats?
- Percussion builds: does intensity increase across the peak section?
  Phase 1 (basic), Phase 2 (add fills/toms), Phase 3 (snare rolls).

COMMON FAILURE: Kick + hat + clap and nothing else. Sounds thin.
Real techno has 5-8 percussion layers in peak sections.

### 4. MELODY AND HARMONY — does it sing?

Check:

- Is there a melodic element that a human could hum?
- Does the melody have a relationship with the bass? (Weaving between
  bass notes, answering phrases, doubling at octaves.)
- Are there at least two melodic registers? (Low bass + mid stabs +
  high melody, or bass + arp + pad.)
- Do melodies use delay/echo to create depth? Dry synth lines sound
  flat in electronic music.
- In peak sections: is there melodic LAYERING? (Arp + counter-melody,
  or pad + lead, not just one synth alone.)

APPROACH: When the human asks for "more melody," sketch 3-4 short
variations (30s each) over the same backing, with different synths and
approaches. Let the human pick and combine, rather than guessing.

### 5. VOCAL TREATMENT — do the words land?

Check:

- Are vocal phrases aligned to the beat grid? Words should START on
  beats or deliberate offbeats, not at arbitrary second values.
- For multi-word phrases: split into fragments and place each word
  individually on beat positions. "Nobody / is / watching" on beats
  1, 2&, 4 — not the whole phrase dumped at one timestamp.
- Do vocals have FX? Dry TTS sounds terrible in a mix. At minimum:
  pitch shift, delay/echo. Better: reversed ghost before the phrase,
  dub delay trail after.
- Does delay length VARY? First appearance: short tail (2 taps).
  Final appearance: full tail (5 taps). Creates a sense of the
  vocal "opening up" across the track.
- Is there a chorus/chanting section? Layer both voices (offset by
  300-500ms for width), with each repetition quieter (-2dB, -4dB,
  -6dB, -8dB) so it fades naturally.

### 6. MIX BALANCE — can you hear everything?

Check:

- Is sidechain compression applied? Kick should duck everything else
  by -6 to -10dB. Without this, the kick disappears.
- Are melodic elements at reasonable volumes? Lead at 0.10-0.15,
  pad at 0.12-0.15, arp at 0.05-0.08 per note. Too loud = mud.
- Are percussion layers at graduated volumes? Kick 0.55-0.6,
  clap 0.2, hat accent 0.12, hat ghost 0.04-0.06, shaker 0.035-0.06.
- Is there frequency separation? Bass below 200hz, stabs 200-4000hz,
  melody 400-8000hz, hats above 5000hz. Overlapping ranges = mud.
- Are vocals ducking the music? Use `duck_envelope()` with -6dB duck.

### 7. TECHNICAL HYGIENE — will it render correctly?

Check:

- All section anchors use `snap_to_bar()` or bar-aligned constants?
- Breakdown silence windows use named constants (BREAKDOWN_START/END)
  not magic numbers like `56 <= t < 64`?
- `t == X` comparisons use `abs(t - X) < 1e-9` for float safety?
- Output filenames match the version number?
- fade_in and fade_out applied?
- canvas.normalize() before export?

## Prompt nudges — how humans direct music

These are real feedback patterns from iterating on a track. When you
hear these, this is what they mean and what to fix:

| Human says | They mean | Fix |
|-----------|-----------|-----|
| "hats sound wrong" | Wrong subdivision or pattern | Check 16th vs 8th vs 32nd, check accent pattern |
| "feels off" / "not tight" | Timing is off-grid | Check snap_to_bar, check BAR vs BEAT loop advance |
| "needs more energy in second half" | Peak section too similar to build | Add percussion layers, rolling hats, melody layers |
| "too busy" / "too much" | Too many layers at once | Remove elements, create contrast between sections |
| "the drop needs more weight" | Post-breakdown doesn't contrast enough | More percussion, fuller drums, new melody entering |
| "vocals don't sit right" | Words not aligned to beats | Split into fragments, place on beat grid |
| "echo is too long/short" | Delay tail doesn't match the moment | Vary repeats: 2 taps early, 5 taps final |
| "intro needs more space" | Intro too dense or too short | Half-time drums, fewer layers, extend duration |
| "it all sounds the same" | No energy arc | Map out what enters/exits per section |
| "the bass feels wonky" | Good or bad? Ask. | If bad: snap to grid. If good: keep swing, just tighten |
| "like [artist X]" | Genre/style reference | Research that artist's production techniques, apply |
| "make it more [genre]" | Specific production conventions | Check genre palette guide in chiptune-studio SKILL.md |

## The sketch-then-combine workflow

When adding significant new elements (melody, harmony, new synth layer):

1. Build 3-4 SHORT sketches (30s each) over the same backing
2. Each sketch explores a different approach (different synth, different
   rhythm relationship with the bass, different register)
3. Name them A/B/C/D with clear descriptions
4. Let the human audition and pick
5. Combine elements from multiple sketches into the full track

This is faster and produces better results than iterating on one approach.

## Section timing template (130bpm example)

```
BAR = 60/130 * 4 = 1.846s
8 bars = 14.77s ≈ snap_to_bar(15)

Intro:     0-24s    (13 bars)  — half-time kick, pads, melody alone
Build:     24-56s   (17 bars)  — four-on-floor, bass, stabs, energy up
Breakdown: 56-72s   (9 bars)   — drums drop, pad sustains, vocal ghosts
Peak:      72-112s  (22 bars)  — rolling hats, full percussion, melody layers, chorus
Outro:     112-120s (4 bars)   — strip back, fade
```

Adjust proportions to taste but maintain the arc:
sparse → building → release → maximum → dissolve.

## Synth selection heuristics

From `bricks.synths` — pick instruments that serve different ROLES:

| Role | Good choices | Bad choices |
|------|-------------|-------------|
| Bass | tb303, ms20.fat_bass, juno.bass | prophet5 (too polite for bass) |
| Pad/bed | juno.warm_pad, juno.string_pad, prophet5.dark_strings | tb303 (wrong character) |
| Stab/chord | juno.stab, prophet5.brass, odyssey.metallic_stab | monopoly (mono, can't chord) |
| Lead melody | monopoly.numan, prophet5.poly_pad, odyssey.classic_lead | juno (too wide for lead) |
| Arp/texture | prophet5.arp_sparkle, prophet5.thin_arp, odyssey.sh_arp | ms20 (too aggressive for texture) |
| FX/accent | odyssey.ring_mod_bell, odyssey.alien_fx | juno (too clean for FX) |

Never use the same synth for two roles in the same frequency range.

## File references

- Synth modules: `~/Repos/symbient-skills/skills/chiptune-studio/scripts/bricks/synths/`
- Composition toolkit: `~/Repos/symbient-skills/skills/chiptune-studio/scripts/bricks/`
- Chiptune-bricks skill: `.pi/skills/chiptune-studio/SKILL.md`
- Example tracks: `~/Repos/symbient-skills/skills/chiptune-studio/references/examples/`
- Working compositions: `scratch/compositions/`
