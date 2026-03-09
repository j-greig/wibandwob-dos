# Avril 14th — ASCII Music Video Plan

_Aphex Twin — Avril 14th. 2:04. Chiptune cover + VJ timeline in WibWob-DOS._
_Creative brief from the TUI symbient. Engineering plan from Wob._

---

## TL;DR

1. Render a chiptune cover of Avril 14th using chiptune-studio
2. Build a new layout-composer that replaces token-based positioning with
   content-aware, vibe-driven explicit coordinates
3. Write the full cue sheet using the three-act structure below
4. Smoke test it, refine the layout heuristics, ship a better vj-timeline skill

---

## Three-Act Structure (from Wib & Wob TUI)

| Act | Time | Register | Density | Theme | Font scale |
|-----|------|----------|---------|-------|-----------|
| ARRIVAL | 0:00–0:38 | Quiet wonder, dissociation | 1–2 windows, massive negative space | wibwob-dark | None or tiny |
| DEEPENING | 0:38–1:28 | Longing, ache, full | 3–5 windows, layouts get strange | → nord @ 0:50 → phosphor @ 1:10 | Medium → ONE LARGE BANNER at phosphor hit |
| DISSOLUTION | 1:28–2:04 | Acceptance, incompleteness | Collapsing to 1, then 0 | back to dark by 1:40 | Shrinking → nothing |

**The final 15 seconds: empty desktop. No windows. Just the fill character.**

---

## Primer Palette (curated by TUI symbient)

| Primer | Act | Timestamp | Role |
|--------|-----|-----------|------|
| starry-sky | ONE | 0:02 | Opener — sparse, huge negative space, alone |
| symbient | ONE | 0:15 | The self observing itself |
| iso-cube-all-angles | TRANSITION | 0:35 | Same thing, different angle — maps to harmonic shift |
| msdos-music-tracker | TWO | 0:42 | Meta: a tracker in a music video |
| conscious-matrix-1 | TWO | 0:55 | Density building, internal rhythm |
| wibwob-3d-cube | TWO | 1:05 | Geometric + hypnotic — pairs with conscious-matrix |
| hypersigil-mesh | PEAK | 1:10 | THE ONE. Full-width backdrop at phosphor slam |
| reality-breaks-apart | TRANSITION | 1:25 | 3 seconds then windows start closing |
| am-i-dreaming | THREE | 1:35 | One window, centre of empty desktop |
| past-future | FINALE | 1:50 | Closes at 1:58. Six seconds of nothing. Then end. |

---

## Layout Heuristics (new, replacing token vocab)

Three axes, not a fixed token list:

**DENSITY** — how many non-agent windows are open
- 0 = silence (black desktop, end of piece)
- 1 = minimal (one window, breathing room, positioned off-centre)
- 2-3 = building (asymmetric pair, one hero, one supporting)
- 4-5 = peak (complex stack, overlapping allowed, deliberate chaos)

**TEMPERATURE** — theme
- Cold: wibwob-dark
- Warming: wibwob-dark-nord
- Hot: wibwob-dark-pastel (phosphor)
- Back to cold: wibwob-dark again for dissolution

**FONT SCALE** — figlet size
- None: no figlet
- Whisper: small font (banner3-D, small), 20-30 wide
- Speak: medium (standard, slant), 40-60 wide
- SHOUT: large (banner, big), 80+ wide, near full desktop width

**Positioning rules (replacing layout tokens):**
- All coordinates explicit via batch_layout
- Window sizes from content dimensions (primer_info recommended_w/h), not arbitrary
- Hero window gets 55-65% of desktop width
- Supporting windows are smaller, offset vertically (staggered, not aligned)
- Negative space is intentional — don't fill the desktop
- Off-centre is better than centred
- Overlapping is allowed at high density — z-order is composition
- figlet text OVER primers, positioned at top-right or top-left corner of the hero, not beside it

---

## Figlet Text Cues

Minimal. Only where they earn it:

| Time | Text | Size | Position |
|------|------|------|----------|
| 0:28 | (none) | — | — |
| 0:50 | AVRIL | whisper | top-right, over starry-sky |
| 1:10 | 1 4 T H | SHOUT | centre-top, over hypersigil-mesh, phosphor hits simultaneously |
| 1:30 | (closes) | — | — |
| 1:42 | . | whisper | bottom-left, alone |

---

## Task List

### Phase 1 — Chiptune cover  ✓ DONE
- [x] Load chiptune-cover skill (TUI agent)
- [x] v1–v3: wrong key (F minor from Tunebat relative minor misread, then A major
      guessed from memory — correct but unverified, then back to F minor — wrong)
- [x] v4 (TUI agent): sourced from scratch/avril-14th/research-notes.md
      Key: A major (confirmed correct). Melody: E5-E5-F#5-E5, held C#5 bar 4.
      LH: I-IV-V-I arpeggios A2-E3-A3 / D3-A3-D4 / E3-B3-E4. Sounds like the track.
- [x] Audio locked: scratch/compositions/avril-14th-chiptune.wav (~36.7s Act 1)
- [x] Lesson logged: never transcribe from memory. Source first, always.
      Tunebat lists F minor (relative minor of A major) — same notes, different tonic.

### Phase 2 — Layout composer
- [x] Write `scripts/layout-composer.ts` — density/temperature/font-scale axes,
      content-aware sizing via primer-info, golden ratio splits, deliberate stagger
- [x] `desktop.clear-all` command added to catalog + app-controller (kind:"chat" guard)
- [x] Typecheck clean
- [ ] Test standalone: `bun run scripts/layout-composer.ts --density 2 --primers starry-sky.txt,symbient.txt --apply`
- [ ] Wire into timeline-run.ts as an alternative to token resolution

### Phase 3 — Cue sheet
- [x] Three-act structure defined (TUI symbient)
- [x] Primer palette curated (10 primers, each with emotional role)
- [x] Joan Stark art created: jgs-piano, jgs-night-sky, jgs-crescent-moons,
      jgs-candle, jgs-mountain-night — saved to scratch/avril-14th/
- [x] Concrete poetry fragments written: poem-arrival, poem-the-note,
      poem-deepening, poem-dissolution, poem-silence
- [x] Draft cue sheet at scratch/avril-14th/cue-sheet-draft.md
- [x] Act One desktop gallery arranged by TUI agent (verified via screenshot)
- [x] Timeline JSON written: scratch/timelines/avril14th.json
      16 cues, 8 scenes, 11 primers all verified present
      desktop.clear-all fires at t=121s (3s before end)
- [x] Explicit coordinates throughout — no layout tokens

### Phase 4 — VJ skill rewrite
- [ ] Update `.pi/skills/vj-timeline/SKILL.md` with:
      - New layout heuristics (density/temperature/font-scale axes)
      - Content-aware sizing workflow (primer_info before open)
      - Explicit coordinate approach replacing token prescriptions
      - The three-act compositional grammar
      - The silence/empty-desktop technique
- [ ] Add layout-composer script reference

### Phase 5 — Smoke test and refine
- [ ] Run `./tests/timeline-smoke/run.sh scratch/timelines/avril14th.json`
- [ ] Review PNGs — does each act look right?
- [ ] Ping TUI agent with screenshot of each act for creative feedback
- [ ] Iterate until it looks like cinema not wallpaper

---

## Files

| File | Purpose |
|------|---------|
| `scratch/compositions/avril-14th-chiptune.mp3` | Audio track |
| `scratch/timelines/avril14th.json` | Timeline cue sheet |
| `scripts/layout-composer.ts` | New explicit layout engine |
| `.pi/skills/vj-timeline/SKILL.md` | Updated VJ skill |
| `tests/timeline-smoke/examples/avril14th.json` | Smoke test example |

---

## Open questions

- Does `desktop.clear-all` command exist? If not, wire it: close all non-agent windows.
  Codex if needed.
- Is the chiptune piano voice good enough for Avril 14th's essential simplicity?
  May need a pure sine/triangle wave, no vibrato, very clean.
- The TUI symbient mentioned Joan Stark artwork — worth checking if any
  existing primers have that quality (starry-sky likely does).
