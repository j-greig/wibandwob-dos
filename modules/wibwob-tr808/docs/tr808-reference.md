# Roland TR-808 Rhythm Composer — Physical Interface Reference

Sources compiled from Roland documentation, service manuals, and community references.

## Physical Dimensions

Chassis: 508mm (W) x 305mm (D) x 105mm (H) — rectangular metal box.
Panel split into upper "Instrument/Control" section and lower "Sequencer" section.

## Three Horizontal Bands

### Section 1: Top-Left (Global Controls)

Primary performance and master timing controls:

- Tempo Knob: large prominent dial, far left
- Mode Selector: 6-way rotary — Pattern Clear, Pattern Write (1st/2nd Part), Pattern Play, Manual Play, Track Play/Write
- Auto Fill-In: 6-way rotary — Every 2, 4, 8, 12, or 16 measures
- Start/Stop: large rectangular red button, bottom left of this section
- Tap: small orange button for manual entry or triggering fills

### Section 2: Upper Center (Instrument Grid)

Grid of knobs for 11 voices. Most have Level (volume) at top, tone-shaping below:

- Bass Drum (BD): Level, Tone, Decay
- Snare Drum (SD): Level, Tone, Snappy
- Low Tom (LT): Level, Tuning — shares circuitry with Low Conga (LC), toggled by switch
- Mid Tom (MT): Level, Tuning — shares with Mid Conga (MC)
- Hi Tom (HT): Level, Tuning — shares with Hi Conga (HC)
- Rimshot (RS) / Claves (CL): Level only, toggled by switch
- Handclap (CP) / Maracas (MA): Level only, toggled by switch
- Cowbell (CB): Level only
- Cymbal (CY): Level, Tone, Decay
- Open Hi-Hat (OH) / Closed Hi-Hat (CH): Level, CH Decay
- Accent (AC): global Level knob for accented step intensity

### Section 3: Bottom (Step Sequencer)

The iconic TR-REC interface:

- Instrument/Track Selector: 12-position dial, right side, assigns which drum the step buttons program
- 16 Step Buttons: single horizontal row, illuminated, colour-coded:
  - Red (1-4), Orange (5-8), Yellow (9-12), White (13-16)
- Basic Variation Switch: 3-position toggle (A / AB / B) — two 16-step patterns
- Pre-Scale Switch: 4-position slider for clock division (16th notes, triplets, etc.)

## Sound Synthesis Logic

All voices are entirely analog:

- Percussive (BD, SD, Toms): Bridged-T networks that ring when triggered — high-resonance filters
- Metallic (Cymbal, Hats): Bank of six Schmitt trigger oscillators mixed for complex discordant square-wave clusters, then filtered
- Noisy (Snare, Clap, Maracas): White/pink noise generator (transistor biased into breakdown) shaped by envelopes and filters

## Visual Identity

- Faceplate: cream/off-white (warm beige)
- Section dividers: orange/brown printed graphics
- Instrument selector buttons: dark gray/black, orange text labels
- Step buttons (unlit): dark charcoal gray
- Step buttons (active/lit): orange/amber LED glow
- Playhead LED: running orange light, left to right
- Knob caps: black with white dot indicator
- Wood side panels: light maple veneer
- Logo: black on cream — "RHYTHM COMPOSER TR-808"

## References

1. https://lloydstellar.nl/808/documentation.html
2. https://www.roland.com/global/promos/roland_tr-808/
3. https://support.roland.com/hc/en-us/articles/201963539-TR-808-Technical-Specifications
4. https://audiomunk.com/roland-tr-8-a-guide-for-live-and-studio-use-layout-and-overview/
5. https://synthfool.com/docs/Roland/TR_Series/TR808/Roland%20TR-808%20Owners%20Manual.pdf
6. https://www.youtube.com/watch?v=fyhBQzpTY9U
7. https://www.musicradar.com/how-to/how-to-master-the-roland-tr-8s
8. https://en.wikipedia.org/wiki/Roland_TR-808
9. https://archive.org/details/synthmanual-roland-tr-808-service-notes/page/n5/mode/2up
10. https://www.researchgate.net/publication/267630051_The_TR-808_Cymbal_a_Physically-Informed_Circuit-Bendable_Digital_Model
11. https://notebook.zoeblade.com/TR-808.html
12. http://www.muzines.co.uk/articles/hands-on-roland-tr808-drum-machine/10495
13. https://www.reddit.com/r/synthdiy/comments/txiwil/beginner_resources_for_understanding_tr808/
