# AVRIL 14TH — ASCII MUSIC VIDEO
## Draft Cue Sheet v0.1

Track: Avril 14th — Aphex Twin
Duration: 2:04 (124,000ms)
Format: chiptune cover (solo melody line, crystalline, cold)
Visual engine: WibWob-DOS TUI

---

## VISUAL AXES (the three levers)

1. DENSITY   — how many windows are open (1 = sparse, 6 = peak)
2. TEMPERATURE — theme: wibwob-dark (coldest) → nord → phosphor (warmest)
3. FONT SCALE — figlet size: none / small / medium / LARGE

---

## ACT ONE: ARRIVAL  0:00 — 0:38

Emotional register: quiet wonder, slight dissociation.
The melody enters alone and tentative.

DENSITY:      1–2 windows
TEMPERATURE:  wibwob-dark (stay cold)
FONT SCALE:   none to start, tiny figlet at 0:30

### Cues

| ms    | action                                                      |
|-------|-------------------------------------------------------------|
| 0     | Desktop blank. Theme: wibwob-dark. All windows closed.      |
| 2000  | OPEN starry-sky.txt — full width, top-left. Alone.          |
|       | (82w x 27h @ 2,2)                                           |
| 15000 | OPEN symbient.txt — small, mid-right. Self observing.       |
|       | (recommended size, ~63w)                                    |
| 30000 | FIGLET small: "avril" — narrow font, low on desktop         |
| 35000 | OPEN iso-cube-all-angles.txt — appears quietly lower left   |

---

## ACT TWO: DEEPENING  0:38 — 1:28

Emotional register: longing, recognition, ache.
Harmony arrives. Melody repeats but now knows where it goes.

DENSITY:      3–5 windows, building
TEMPERATURE:  nord at ~0:50, phosphor hits at 1:10
FONT SCALE:   medium figlet 0:55, LARGE banner at phosphor hit

### Cues

| ms    | action                                                      |
|-------|-------------------------------------------------------------|
| 38000 | OPEN msdos-music-tracker.txt — corner, small. Meta-honest.  |
| 42000 | CLOSE starry-sky if needed for space                        |
| 50000 | THEME SWITCH → nord                                         |
| 55000 | FIGLET medium: "something remembering"                      |
| 60000 | OPEN conscious-matrix-1.txt — left third, density builds   |
| 65000 | OPEN wibwob-3d-cube (art window) — geometric, hypnotic      |
| 65000 | OPEN jgs-piano.txt — appears quietly mid-right              |
|       | (the instrument made visible just before it's subsumed)     |
| 70000 | THEME SWITCH → phosphor  (the emotional peak)               |
| 70500 | CLOSE figlet "something remembering"                        |
| 71000 | OPEN hypersigil-mesh.txt — full width, behind everything    |
| 72000 | FIGLET LARGE: "AVRIL" — half-width dominant                 |
| 72500 | CLOSE jgs-piano.txt — chiptune overwhelms the instrument    |

---

## ACT THREE: DISSOLUTION  1:28 — 2:04

Emotional register: acceptance, incompleteness.
The piece doesn't end, it stops being held together.

DENSITY:      collapsing 4 → 1 → 0
TEMPERATURE:  back to wibwob-dark by 1:40, colder than opening
FONT SCALE:   shrinking, last figlet small, then nothing

### Cues

| ms     | action                                                     |
|--------|------------------------------------------------------------|
| 88000  | OPEN reality-breaks-apart.txt — 3 seconds, then close     |
| 88000  | THEME SWITCH → wibwob-dark                                 |
| 91000  | CLOSE reality-breaks-apart                                 |
| 95000  | CLOSE hypersigil-mesh                                      |
| 100000 | CLOSE 3d-cube                                              |
| 100000 | FIGLET small: "it stops"                                   |
| 105000 | CLOSE conscious-matrix                                     |
| 108000 | CLOSE figlet                                               |
| 108000 | OPEN am-i-dreaming.txt — centre, alone                     |
| 110000 | OPEN past-future.txt — right of am-i-dreaming              |
| 118000 | CLOSE am-i-dreaming                                        |
| 118000 | FIGLET tiny: "·"                                           |
| 121000 | CLOSE past-future                                          |
| 122000 | CLOSE figlet                                               |
| 122000 | ALL WINDOWS CLOSED. Empty desktop. Cursor only.            |
|        | 2 seconds of nothing before track ends at 124000ms         |

---

## PRIMER MANIFEST

All paths verified. Open via POST /view/primer/open.

### Act One
- starry-sky.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/starry-sky.txt
- symbient.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/symbient.txt
- iso-cube-all-angles.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/iso-cube-all-angles.txt

### Act Two
- msdos-music-tracker.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/msdos-music-tracker.txt
- conscious-matrix-1.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/conscious-matrix-1.txt
- wibwob-3d-cube (art window — open via /view/art/open)
- hypersigil-mesh.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/hypersigil-mesh.txt

### Act Three
- reality-breaks-apart
  /microapps/example-primers/primers/reality-breaks.txt
- am-i-dreaming.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/am-i-dreaming.txt
- past-future.txt
  /scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers/past-future.txt

### Joan Stark pieces (new, in /scratch/avril-14th/)
- jgs-piano.txt          — Act One anchor (the instrument itself)
- jgs-crescent-moons.txt — Act One / Two transition, fragile
- jgs-night-sky.txt      — Act One atmosphere
- jgs-candle.txt         — Act Three, dissolution, single flame
- jgs-mountain-night.txt — Act Two background depth

### Concrete poetry fragments (new, in /scratch/avril-14th/)
- poem-arrival.txt       — "something / remembering / itself"
- poem-the-note.txt      — "one note / then another / the space between"
- poem-deepening.txt     — "present moment becoming memory as it happens"
- poem-dissolution.txt   — "it doesn't end / it stops / being / held / together"
- poem-silence.txt       — just "·" — final 15 seconds

---

## FIGLET CUES (concrete typography)

These are the live figlet window text values, to be opened/closed per cue:

| time    | text                        | font       | size  |
|---------|-----------------------------|------------|-------|
| 0:30    | "avril"                     | small      | tiny  |
| 0:55    | "something remembering"     | standard   | med   |
| 1:10    | "AVRIL"                     | big/banner | LARGE |
| 1:40    | "it stops"                  | small      | small |
| 1:48    | "·"                         | standard   | tiny  |

---

## OPEN QUESTIONS FOR NEXT PASS

1. Chiptune render: oscillator = 25% duty-cycle pulse wave (NOT triangle).
   Thinner than square, slightly nasal, quality of something calling from distance.
   Fast attack, medium decay, no sustain. Gentle pitch vibrato starting ~80ms into
   each note — the "reaching" quality. This IS what the piece is about.
2. Should the figlet "AVRIL" at 1:10 be animated (cycling fonts) or static?
3. The empty desktop at 2:02 — does the theme background fill char matter?
   (Consider changing fill char to single dot or space for the ending)
4. RESOLVED: jgs-piano NOT in Act One — too literal. Instead: open at 1:05
   alongside 3d-cube, then close at 1:12 as AVRIL figlet hits. The instrument
   appears briefly then gets subsumed by the chiptune. Medium becomes content.
5. Layout heuristic system — capture the density/temperature/font-scale model
   as a proper data structure for the VJ timeline engine.

---

## CURRENT DESKTOP PREVIEW

The layout currently open on the desktop shows:
- starry-sky.txt  (82x27 @ 2,2)     — Act One hero
- jgs-piano.txt   (39x19 @ 2,31)    — the instrument
- poem-arrival.txt (53x13 @ 44,31)  — "something remembering itself"
- jgs-crescent-moons (25x19 @ 44,46) — fragile Act One/Two
- past-future.txt (43x29 @ 86,32)   — Act Three right column
- poem-dissolution (47x19 @ 2,52)   — "it doesn't end / it stops"
- am-i-dreaming.txt (63x12 @ 51,66) — the question, bottom

This is the emotional register of Act One into early Act Two.
The phosphor hit and density peak are not yet shown here.
