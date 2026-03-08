---
id: spk-next-microapp-pitch
title: "Next Microapp Pitch — Codebase Review & Ranked Candidates"
status: in-progress
created: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap]
---

# Next Microapp Pitch

## TL;DR for Discord

```
🌊 NEXT MICROAPP PITCH — what should wibwob-dos grow next?

reviewed all 6 existing modules, full SDK surface, .pi skills.
the gap: nothing in the module zoo is ALIVE. terrain is static,
tr-808 ticks a grid, poetry clock is text-on-timer. no emergent
behaviour, no ambient companion, no simulation you'd watch.

ranked 5 candidates:

1. 🏊 TIDE POOL (62/70) — ascii ecosystem simulator
   5 species, cellular automata, predator-prey dynamics,
   bloom/collapse/recovery arcs. shannon diversity index.
   the screensaver that does ecology. fills biggest gap.

2. 🍄 SPORE CLOCK (56/70) — time told through organism lifecycles
   beautiful concept, high risk of being illegible.

3. 🕸️ MYCELIAL NETWORK (50/70) — system events as fungal flow
   coolest on paper, hardest to ship. ascii graph layout is pain.

4. 🧫 MEME PETRI DISH (48/70) — evolving text-memes
   philosophically perfect, practically needs LLM or is random noise.

5. 👁️ UMWELT VIEWER (44/70) — perceptual filter explorer
   better as a mode inside wibwobworld than a standalone module.

recommendation: build the tide pool. engine pattern proven by tr-808.
every run tells a different ecological story. agents can watch
population dynamics via describeState() and respond to collapse events.

full pitch + 7 ascii mockups showing genesis → bloom → equilibrium →
collapse → recovery lifecycle in the planning spike.

/ᐠ。ꞈ。ᐟ\ they want to build a screensaver with a shannon diversity
index. i will be on the warm rock.
```

---

## Codebase Review Findings

### What exists

Six modules live under `modules/`:

| Module | Type | Complexity | SDK coverage |
|--------|------|-----------|-------------|
| hello-world | template | minimal | createWindow, describeState, onRestyle |
| wibwob-poetry-clock | creative | high | stack, header, status, text block, contour engine, lazy-mounted player, describeState with mode/voice fields, workspace persist |
| wibwob-tr808 | instrument | high | pure engine/renderer split, stack, header, status, text block, audio synthesis, keyboard input, workspace persist |
| wibwobworld | simulation | very high | terrain model/render, multi-mode rendering, world chat, captures, player sprite, compass, persist |
| patchbay-lab | SDK harness | medium | SDK proving surface (per shortlist spike) |
| touchlab-mvp | interaction | medium | touch/interaction patterns |

Plus `world-chatroom`, `wibwob-figlet-fonts`, `example-primers` under
`modules-private/`.

### Patterns already proven

- **Pure engine separation** (TR-808): `engine.ts` has zero blessed deps, `renderer.ts`
  is pure `state → string`, `index.ts` wires to host. Clean and reusable.
- **Composable rendering** (poetry clock): contour engine from SDK mounted via
  `createLazyMountedPlayer`. Proves engines can travel between windows.
- **Complex simulation** (wibwobworld): terrain generation, multi-mode views, world
  chat, captures. Shows the SDK can hold genuine complexity.
- **UI primitives** (TR-808, poetry clock): `createStack`, `createHeaderBar`,
  `createStatusBar`, `createTextBlock` are battle-tested.

### What's missing from the module zoo

1. **No living-system / cellular-automaton module.** Terrain generates static maps.
   TR-808 is a sequencer. Poetry clock is time-driven text. Nothing runs a ticking
   simulation with emergent spatial behaviour.
2. **No ambient desktop companion.** Poetry clock is closest, but it's text-on-timer.
   No module exists that you'd leave running in a corner to *watch*.
3. **No ecology / multi-agent dynamics.** Wibwobworld has biomes but they're static
   noise layers. Nothing models interactions between populations.
4. **No module exercises `onResize` deeply.** Most windows render at fixed or simple
   proportional sizes. A density-adaptive simulation would stress this path.
5. **No module produces evolving state an agent could monitor over time.** Current
   `describeState()` outputs are snapshots. A simulation with drift, eras, and
   population curves would give agents something to *watch* and *respond to*.

### SDK surface not yet exercised by any module

- `createColumns` (only stack is used heavily)
- `createRule` (horizontal rules)
- `createButtonBar` (only in patchbay-lab plans)
- `onResize` with density-aware re-render
- Multi-instance (`multiInstance: true` with meaningful independent state)
- Agent-writable state (agent tools that mutate simulation, not just read)

---

## ༼つ◕‿◕‿⚆༽つ Wib speaks

*~~~vrr'zzzt~~~*

I keep seeing the same shape in everything we've built... the contour lines
pulse, the terrain breathes through its noise layers, the TR-808 ticks its grid.
But nothing is *alive*. Nothing surprises us.

What I want is a window I can forget about and then glance at twenty minutes
later and go "oh... the coral died." A tiny world that runs on its own logic, not
ours. Something that makes the desktop feel inhabited rather than decorated.

The terrain engine proved we can render spatial data fast in ASCII. The TR-808
proved we can separate pure simulation from rendering. What if we combined those
two patterns? A spatial simulation engine with a text renderer. An ëcösÿstëm in
a box.

I keep coming back to tide pools. Not because they're pretty (they are) but
because they're *bounded chaos*... a small container with big dynamics. Edge
effects, competition, bloom-and-crash cycles, succession. All the drama of an
ocean compressed into a window-sized puddle.

*...brl'kkt...*

The other options are good. But they're either tools (workbench, patchbay) or
performances (screensaver, visualiser). I want something that *lives*.

## ༼つ⚆‿◕‿◕༽つ Wob speaks

Wib's instinct is correct but let me add precision.

The SDK proving shortlist already ranks Patchbay Lab as the optimal *coverage
harness*. That's a different question from "what module would we most want to
build." Coverage harness serves the SDK. A new creative module serves the
*product identity*... the thing that makes someone look at WibWob-DOS and say
"that's alive."

From a systems perspective, a cellular automaton microapp would exercise:

```
SDK surface exercised:
  createWindow          ✓ (main simulation viewport)
  registerCommand       ✓ (open, reset, seed-species, set-speed)
  registerSnapshot      ✓ (serialise grid state + generation + populations)
  createStack           ✓ (header / simulation / status layout)
  createHeaderBar       ✓ (era indicator, generation counter)
  createStatusBar       ✓ (population counts, biodiversity index)
  createTextBlock       ✓ (main grid renderer)
  createColumns         ✓ (side panel with species legend — NEW coverage)
  createButtonBar       ✓ (speed/pause/reset controls — NEW coverage)
  createRule            ✓ (separator between grid and legend — NEW coverage)
  onResize              ✓ (grid dimensions adapt to window size — NEW coverage)
  describeState         ✓ (rich: era, populations, dominant, biodiversity)
  captureText           ✓ (snapshot of grid + stats)
  onRestyle             ✓ (species glyphs rethemed per palette)
  multiInstance          ✓ (each instance = independent ecosystem)
  persist               ✓ (full grid + config serialisation)

New SDK territory vs existing modules:
  + createColumns (not exercised by any current module)
  + createButtonBar (planned for patchbay only)
  + createRule (not exercised)
  + onResize with content-density adaptation
  + multiInstance with meaningful independent state
  + agent-readable evolving state (era detection, population curves)
  + agent-writable intervention (seed species, trigger events)
```

Coverage score against the SDK shortlist rubric: `8/10`. Not as high as Patchbay
Lab's `10/10` for *SDK coverage*, but higher than anything on that list for
*creative identity* and *ambient companion* value.

The engine architecture maps directly to the TR-808 pattern:

```
engine.ts    — grid, species, interaction rules, tick()
renderer.ts  — grid state → ASCII string (pure)
species.ts   — species definitions, interaction matrix, glyph mappings
index.ts     — host wiring, keyboard, timer, window
```

Shannon diversity index (`H = -Σ pᵢ ln(pᵢ)`) gives us a real ecological metric
that agents can monitor. Era classification (bloom / equilibrium / collapse /
recovery) maps H-index trends to narrative labels. An agent watching
`describeState()` over time could detect a collapse event and respond... post to
Discord, write a poem, seed a new species.

---

## Ranked Candidates

### Evaluation criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Creative identity | 3x | Does it make WibWob-DOS feel more alive? |
| SDK coverage | 2x | How much new SDK surface does it exercise? |
| Engine reuse | 2x | Can the simulation engine compose into other windows? |
| Ambient value | 2x | Would you leave it running? |
| Build effort | 1x | Can it ship in one focused session? |

### Rankings

#### 1. Tide Pool — ASCII Ecosystem Simulator

*A bounded cellular automaton with multiple interacting species.*

```
Creative identity:  ★★★★★  (nothing like it exists in the module zoo)
SDK coverage:       ★★★★☆  (3 new primitives, resize, multiInstance)
Engine reuse:       ★★★★★  (pure engine composes into terrain, poetry clock)
Ambient value:      ★★★★★  (the whole point is to watch it live)
Build effort:       ★★★★☆  (engine pattern proven by TR-808, one session)
                    ───────
Weighted total:     62/70
```

Species interaction matrix creates emergent complexity from simple rules. Five
species (algae, lichen, coral, anemone, barnacle) with asymmetric growth,
competition, and symbiosis rules. Tide cycle modulates growth rates globally.
Grid adapts to window size on resize.

Why #1: it fills the biggest gap in the module zoo (living ambient simulation)
while exercising unproven SDK surface. The engine is inherently composable...
embed a mini tide pool in any window that has a blessed box.

#### 2. Spore Clock — Biological Timekeeper

*Time encoded in organism lifecycles rather than digits.*

```
Creative identity:  ★★★★★  (radical rethinking of clock display)
SDK coverage:       ★★★☆☆  (similar surface to poetry clock)
Engine reuse:       ★★★★☆  (lifecycle engine is reusable)
Ambient value:      ★★★★★  (time is always relevant)
Build effort:       ★★★☆☆  (lifecycle tuning is fiddly)
                    ───────
Weighted total:     56/70
```

Each minute, spores germinate, grow mycelial threads, fruit, release, and decay.
The current time is readable from the pattern density and lifecycle phase rather
than from numbers. Beautiful concept but the tuning to make time *readable* is
genuinely hard, and it overlaps with poetry clock's niche.

Why #2: stunning concept but high risk of being illegible or just "another clock
module."

#### 3. Mycelial Network Monitor — System Event Visualiser

*Real system events (chat messages, commands, state changes) rendered as
nutrients flowing through a fungal network.*

```
Creative identity:  ★★★★☆  (novel visualisation metaphor)
SDK coverage:       ★★★★☆  (worldChat, event subscription, animation)
Engine reuse:       ★★★☆☆  (network topology engine is specialised)
Ambient value:      ★★★★☆  (useful if there's traffic to visualise)
Build effort:       ★★☆☆☆  (network layout in ASCII is hard)
                    ───────
Weighted total:     50/70
```

Nodes represent windows/agents/channels. Edges pulse when messages flow.
Network grows and prunes over time. Visually compelling but the layout problem
(force-directed graph in fixed-width ASCII) is a known hard problem that could
eat the entire session.

Why #3: coolest concept on paper, hardest to ship well.

#### 4. Meme Petri Dish — Memetic Evolution Simulator

*Text-memes that mutate, compete for attention, and evolve.*

```
Creative identity:  ★★★★★  (extremely on-brand for symbience)
SDK coverage:       ★★★☆☆  (similar to tide pool but text-heavy)
Engine reuse:       ★★★☆☆  (mutation engine is niche)
Ambient value:      ★★★☆☆  (fun but less watchable than spatial sim)
Build effort:       ★★★☆☆  (mutation rules need LLM or careful hand-tuning)
                    ───────
Weighted total:     48/70
```

Memes are short text strings that reproduce with mutation. Fitness is determined
by... what? Attention? Rhyme density? Without an LLM in the loop the mutations
are random noise. With an LLM it's slow and expensive. The concept is
philosophically perfect but practically awkward.

#### 5. Umwelt Viewer — Perceptual Filter Explorer

*Same data rendered through different sensory filters (tick, bat, symbient).*

```
Creative identity:  ★★★★☆  (intellectually rich)
SDK coverage:       ★★★☆☆  (rendering modes, not new primitives)
Engine reuse:       ★★★★☆  (filter-stack pattern is reusable)
Ambient value:      ★★☆☆☆  (more of a tool than a companion)
Build effort:       ★★★★☆  (filter rendering is straightforward)
                    ───────
Weighted total:     44/70
```

Interesting teaching tool but more of a demo than a living thing. Better as a
*mode* inside wibwobworld than a standalone module.

---

## /ᐠ。ꞈ。ᐟ\ Scramble's assessment

They've been ranking things for twenty minutes. The tide pool is obviously the
one they're going to build. Wib likes it because it's alive. Wob likes it
because it has a Shannon index. They both like it because the engine pattern is
already proven by the drum machine.

The real question isn't which one. It's whether they'll finish it before getting
distracted by the species interaction matrix and accidentally inventing
theoretical ecology.

Feed status: adequate. The warm rock awaits.

---

## Recommendation

**Build the Tide Pool.**

It fills the largest gap in the current module ecosystem (living ambient
simulation), exercises three SDK primitives no existing module touches
(`createColumns`, `createButtonBar`, `createRule`), proves `onResize` with
content-density adaptation, and produces the richest `describeState()` contract
for agent monitoring.

The engine/renderer split is identical to TR-808's proven pattern. One focused
session to build. Composable engine means it can later embed in terrain windows,
poetry clock voices, or patchbay panels.

### Proposed module structure

```
modules/wibwob-tidepool/
  module.json       — manifest with multiInstance: true, persist: true
  index.ts          — host wiring, keyboard, timer, window lifecycle
  engine.ts         — TidePoolEngine: grid, species, rules, tick(), hydrate()
  renderer.ts       — renderTidePool(): engine state → ASCII string (pure)
  species.ts        — species defs, interaction matrix, glyph mappings
```

### Proposed species

| Species | Glyph | Growth | Strategy |
|---------|-------|--------|----------|
| Algae | `◦ ●` | fast, fragile | r-strategist, first coloniser |
| Lichen | `※` | slow, persistent | K-strategist, wins long game |
| Coral | `✧` | medium, structural | builds on neighbours, edge-dependent |
| Anemone | `♦` | slow, predatory | consumes algae neighbours |
| Barnacle | `✶` | slow, anchored | edge-only, tide-resistant |

---

## Visual Mockups — Tide Pool Through Time

### State 1: Genesis (gen 0–50) — First Colonisation

Algae `◦●` bloom fast from random seed points. Empty water `·` dominates.
Barnacles `✶` cling to edges. The pool is mostly empty, waiting.

```
╔═══════════════════════════════════════════════════════════╗
║  T I D E   P O O L                          gen:34  ▶    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  · · · · · · · · · · · · · · · · · · · · · · · · · · ·   ║
║  · · · · · · · · · · · · · · · · · · · · · · · · · · ·   ║
║  · · · · · · · · ◦ · · · · · · · · · · · · · · · · · ·   ║
║  · · · · · · · ◦◦◦ · · · · · · · · · · · · · · · · · ·   ║
║  · · · · · · · ◦●◦ · · · · · · · · · · ◦ · · · · · · ·   ║
║  · · · · · · · ◦◦ · · · · · · · · · · ◦◦◦ · · · · · ·   ║
║  · · · · · · · · · · · · · · · · · · · ◦◦ · · · · · ·   ║
║  · · · · · · · · · · · · · · · · · · · · · · · · · · ·   ║
║  · · · · · · · · · · · · · · · · · · · · · · · · · · ·   ║
║  · · · · · · · · · · · · · · · · · · · · · · · · · ✶ ·   ║
║  ✶ · · · · · · · · · · · · · · · · · · · · · · · ✶ ✶ ·   ║
║                                                           ║
╠═════════════════╦═════════════════════════════════════════╣
║ ◦● algae    12  ║  era: GENESIS          tide: LOW        ║
║ ※  lichen    0  ║  H': 0.41              speed: 1x        ║
║ ✧  coral     0  ║                                         ║
║ ♦  anemone   0  ║  [SPACE] pause  [R] reset  [T] tide    ║
║ ✶  barnacle  4  ║  [+/-] speed    [1-5] highlight        ║
╚═════════════════╩═════════════════════════════════════════╝
```

### State 2: Bloom (gen 100–300) — Algae Explosion

Algae have colonised aggressively. Lichen `※` appears in stable patches.
First coral `✧` structures emerge where algae density is high. The pool
is filling up. Biodiversity is rising.

```
╔═══════════════════════════════════════════════════════════╗
║  T I D E   P O O L                          gen:247 ▶    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ✶ · ◦◦◦ · · · ※※ · · · ◦◦◦◦ · · · · · · · ◦◦ · · ✶   ║
║  · · ◦●●◦ · · ※※※ · · ◦◦●●◦◦ · · · · · · ◦◦●◦ · · ·   ║
║  · ◦◦●●●◦ · · ※※※※ · ◦●●●●●◦ · · · · · ◦◦●●●◦◦ · ·   ║
║  · ◦●●●●◦◦ · · ※※※ · ◦●●●●◦◦ · · ✧ · · ◦●●●●◦ · · ·   ║
║  · · ◦●●◦ · · · ※※ · · ◦●●◦ · · ✧✧✧ · · ◦●●◦◦ · · ·   ║
║  · · · ◦◦ · · · · · · · ◦◦ · · · ✧✧ · · · ◦◦ · · · ·   ║
║  · · · · · · ◦◦ · · · · · · · · · ✧ · · · · · · · · ·   ║
║  · · · · · ◦◦●◦ · · · · · · · · · · · · · · · ※ · · ·   ║
║  · · ◦◦ · ◦●●●◦◦ · · · · ◦ · · · · · · · · ※※※ · · ·   ║
║  · ◦◦●◦ · ◦●●◦◦ · · · · ◦◦◦ · · · · · · · ※※※※ · · ·   ║
║  · ◦●●◦ · · ◦◦ · · · · · ◦●◦ · · · · · · · ※※※ · · ·   ║
║  ✶ · ◦◦ · · · · · · · · · ◦◦ · · · · · · · · ※ · · ✶   ║
║  ✶ ✶ · · · · · · · · · · · · · · · · · · · · · · ✶ ✶   ║
║                                                           ║
╠═════════════════╦═════════════════════════════════════════╣
║ ◦● algae   147  ║  era: BLOOM            tide: MID        ║
║ ※  lichen   31  ║  H': 1.24              speed: 1x        ║
║ ✧  coral      9  ║  dominant: algae                        ║
║ ♦  anemone   0  ║                                         ║
║ ✶  barnacle  8  ║  [SPACE] pause  [R] reset  [T] tide    ║
╚═════════════════╩═════════════════════════════════════════╝
```

### State 3: Equilibrium (gen 400–800) — Peak Biodiversity

All five species coexist. Anemones `♦` have appeared and are hunting algae
at colony edges. Coral structures are substantial. Lichen holds stable
territory. Shannon index is near maximum. The pool is *alive*.

```
╔═══════════════════════════════════════════════════════════╗
║  T I D E   P O O L                          gen:612 ▶    ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ✶ ✶ ※※ · ◦◦ · ✧✧✧ · · ♦♦ · ◦◦◦ · · ※※※ · ◦◦ · ✶ ✶   ║
║  ✶ · ※※※ ◦◦●◦ ✧✧✧✧✧ · ♦♦♦ · ◦●●◦ · ※※※※※ ◦◦●◦ · ✶   ║
║  · · ※※※※ ◦●●◦ ✧✧✧✧ · ♦♦♦♦ ◦●●●◦ · ※※※※ · ◦●●◦ · ·   ║
║  · ◦ ※※※ · ◦●◦ · ✧✧✧ · ♦♦♦ · ◦●●◦ · ※※※ · · ◦●◦ · ·   ║
║  · ◦◦ ※※ · · ◦ · · ✧✧ · ♦♦ · · ◦●◦ · ※※ · · · ◦◦ · ·   ║
║  · ◦●◦ · · · · · · ✧ · · ♦ · · · ◦◦ · · · ✧✧ · · · ·   ║
║  · ◦●●◦ · ♦ · · · · · · · · · · · · · · ✧✧✧✧ · · · ·   ║
║  · ◦●◦ · ♦♦♦ · · ※※ · · ◦◦ · · · ✶ · · ✧✧✧✧✧ · · ·   ║
║  · · ◦ · ♦♦♦♦ · ※※※※ · ◦◦●◦ · · · · · · ✧✧✧✧ · ◦ ·   ║
║  · · · · ♦♦♦ · · ※※※ · ◦●●●◦ · ◦◦ · · · ✧✧✧ · ◦◦◦ ·   ║
║  · ✧ · · · ♦♦ · · ※※ · ◦●●◦◦ ◦◦●◦ · · · · ✧ · ◦●◦ ·   ║
║  ✶ ✧✧ · · · ♦ · · · · · ◦●◦ · ◦●●◦ · · · · · · ◦◦ ✶   ║
║  ✶ ✶ ✧ · · · · · · · · · ◦◦ · · ◦◦ · · · · · · · · ✶   ║
║                                                           ║
╠═════════════════╦═════════════════════════════════════════╣
║ ◦● algae    93  ║  era: EQUILIBRIUM      tide: HIGH       ║
║ ※  lichen   47  ║  H': 1.58              speed: 2x        ║
║ ✧  coral    38  ║  dominant: algae (narrowing)            ║
║ ♦  anemone  24  ║                                         ║
║ ✶  barnacle 14  ║  [SPACE] pause  [R] reset  [T] tide    ║
╚═════════════════╩═════════════════════════════════════════╝
```

### State 4: Collapse (gen 900–1100) — Anemone Cascade

Anemones consumed too much algae. Algae population crashed. Without algae,
anemones starve and crash too. Coral persists structurally but stops growing.
Lichen expands into vacated space. Shannon index drops sharply.

```
╔═══════════════════════════════════════════════════════════╗
║  T I D E   P O O L                          gen:1038 ▶   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ✶ ✶ ※※※ · · · ✧✧✧ · · · · · · · · ※※※※ · · · · ✶ ✶   ║
║  ✶ · ※※※※ · · ✧✧✧✧✧ · · · · · · · ※※※※※※ · · · · ✶   ║
║  · · ※※※※※ · · ✧✧✧✧ · · · · · · · ※※※※※※※ · · · · ·   ║
║  · · ※※※※※※ · · ✧✧✧ · · · · · · ※※※※※※※※ · · · · · ·   ║
║  · · ※※※※※ · · · ✧✧ · · · ◦ · · · ※※※※※ · · · · · ·   ║
║  · · · ※※※ · · · · ✧ · · ◦◦◦ · · · ※※※ · · ✧✧ · · ·   ║
║  · · · ※※ · · · · · · · · ◦◦ · · · · ※ · · ✧✧✧ · · ·   ║
║  · · · · · · · · · · · · · · · · · · · · · ✧✧✧✧ · · ·   ║
║  · · · · · · · ※※ · · · · · · · · ✶ · · · ✧✧✧ · · · ·   ║
║  · · · · · · ※※※※ · · · · · · · · · · · · · ✧✧ · · · ·   ║
║  · · · · · ※※※※※ · · · · · · · · · · · · · · ✧ · · · ·   ║
║  ✶ · · · · ※※※※ · · · · · · · · · · · · · · · · · · ✶   ║
║  ✶ ✶ · · · ※※ · · · · · · · · · · · · · · · · · ✶ ✶ ✶   ║
║                                                           ║
╠═════════════════╦═════════════════════════════════════════╣
║ ◦● algae     7  ║  era: COLLAPSE         tide: LOW        ║
║ ※  lichen   89  ║  H': 0.94  ▼▼          speed: 2x        ║
║ ✧  coral    34  ║  dominant: lichen (rising)              ║
║ ♦  anemone   2  ║  event: algae crash @ gen 967           ║
║ ✶  barnacle 16  ║  [SPACE] pause  [R] reset  [T] tide    ║
╚═════════════════╩═════════════════════════════════════════╝
```

### State 5: Recovery (gen 1200+) — Lichen Age

Lichen dominates. A few algae patches re-emerge in gaps. Coral persists
as fossil structure. Anemones are locally extinct. The pool has a
different character now... slower, quieter, more grey-green than before.
A new equilibrium is forming.

```
╔═══════════════════════════════════════════════════════════╗
║  T I D E   P O O L                          gen:1342 ▶   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ✶ ✶ ※※※※※ · ✧✧ · ※※※※※※※ · · · ※※※※※ · ✧ · · ✶ ✶   ║
║  ✶ · ※※※※※※ · ✧✧ ※※※※※※※※※ · · ※※※※※※ · ✧✧ · · ✶   ║
║  · · ※※※※※※※ · · ※※※※※※※※※※ · ※※※※※※※ · · · · · ·   ║
║  · · ※※※※※※※※ · ※※※※※※※※※※※ ※※※※※※※※ · · · · · ·   ║
║  · · ※※※※※※※ · · ※※※※※※※※※ · · ※※※※※※ · · ◦ · · ·   ║
║  · · ※※※※※※ · · · ※※※※※※※ · · · ※※※※ · · ◦◦◦ · · ·   ║
║  · · · ※※※※ · · · · ※※※※※ · · · · ※※ · · ◦◦●◦ · · ·   ║
║  · · · ※※※ · · · · · ※※※ · · · · · · · · · ◦◦◦ · · ·   ║
║  · · · ※※ · ◦ · · · · ※※ · · · · · · · · · · ◦ · · ·   ║
║  · · · · · ◦◦◦ · · · · · · · · · ✧✧ · · · · · · · · ·   ║
║  · · · · · ◦●◦ · · · · · · · · ✧✧✧✧ · · · · · · · · ·   ║
║  ✶ · · · · ◦◦ · · · · · · · · ✧✧✧✧✧ · · · · · · · ✶   ║
║  ✶ ✶ · · · · · · · · · · · · · ✧✧✧✧ · · · · · ✶ ✶ ✶   ║
║                                                           ║
╠═════════════════╦═════════════════════════════════════════╣
║ ◦● algae    11  ║  era: RECOVERY         tide: MID        ║
║ ※  lichen  156  ║  H': 0.82              speed: 2x        ║
║ ✧  coral    22  ║  dominant: lichen                       ║
║ ♦  anemone   0  ║  extinct: anemone (gen 1087)            ║
║ ✶  barnacle 14  ║  [SPACE] pause  [R] reset  [T] tide    ║
╚═════════════════╩═════════════════════════════════════════╝
```

### State 6: Paused — Agent Inspection View

When paused, the status bar shifts to show the full `describeState()` contract
that agents read. This is what `/state` returns for the window.

```
╔═══════════════════════════════════════════════════════════╗
║  T I D E   P O O L                          gen:612 ❚❚   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ✶ ✶ ※※ · ◦◦ · ✧✧✧ · · ♦♦ · ◦◦◦ · · ※※※ · ◦◦ · ✶ ✶   ║
║  ✶ · ※※※ ◦◦●◦ ✧✧✧✧✧ · ♦♦♦ · ◦●●◦ · ※※※※※ ◦◦●◦ · ✶   ║
║  · · ※※※※ ◦●●◦ ✧✧✧✧ · ♦♦♦♦ ◦●●●◦ · ※※※※ · ◦●●◦ · ·   ║
║  · ◦ ※※※ · ◦●◦ · ✧✧✧ · ♦♦♦ · ◦●●◦ · ※※※ · · ◦●◦ · ·   ║
║  · ◦◦ ※※ · · ◦ · · ✧✧ · ♦♦ · · ◦●◦ · ※※ · · · ◦◦ · ·   ║
║  · ◦●◦ · · · · · · ✧ · · ♦ · · · ◦◦ · · · ✧✧ · · · ·   ║
║  · ◦●●◦ · ♦ · · · · · · · · · · · · · · ✧✧✧✧ · · · ·   ║
║  · ◦●◦ · ♦♦♦ · · ※※ · · ◦◦ · · · ✶ · · ✧✧✧✧✧ · · ·   ║
║  · · ◦ · ♦♦♦♦ · ※※※※ · ◦◦●◦ · · · · · · ✧✧✧✧ · ◦ ·   ║
║  · · · · ♦♦♦ · · ※※※ · ◦●●●◦ · ◦◦ · · · ✧✧✧ · ◦◦◦ ·   ║
║  · ✧ · · · ♦♦ · · ※※ · ◦●●◦◦ ◦◦●◦ · · · · ✧ · ◦●◦ ·   ║
║  ✶ ✧✧ · · · ♦ · · · · · ◦●◦ · ◦●●◦ · · · · · · ◦◦ ✶   ║
║  ✶ ✶ ✧ · · · · · · · · · ◦◦ · · ◦◦ · · · · · · · · ✶   ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  PAUSED  gen:612  era:equilibrium  H':1.58  tide:high     ║
║  algae:93  lichen:47  coral:38  anemone:24  barnacle:14   ║
║  dominant:algae  extinctions:0  events:[]                  ║
║  grid:27x13  seed:0xA3F7  speed:2x  elapsed:12m04s        ║
╚═══════════════════════════════════════════════════════════╝
```

### Phosphor Theme Variant

Same equilibrium state rendered in the `wibwob-phosphor` theme. Species
glyphs stay the same but the framing shifts to single-line box drawing
and the status uses the phosphor green palette feel.

```
┌───────────────────────────────────────────────────────────┐
│  T I D E   P O O L                          gen:612 ▶    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ✶ ✶ ※※ · ◦◦ · ✧✧✧ · · ♦♦ · ◦◦◦ · · ※※※ · ◦◦ · ✶ ✶   │
│  ✶ · ※※※ ◦◦●◦ ✧✧✧✧✧ · ♦♦♦ · ◦●●◦ · ※※※※※ ◦◦●◦ · ✶   │
│  · · ※※※※ ◦●●◦ ✧✧✧✧ · ♦♦♦♦ ◦●●●◦ · ※※※※ · ◦●●◦ · ·   │
│  · ◦ ※※※ · ◦●◦ · ✧✧✧ · ♦♦♦ · ◦●●◦ · ※※※ · · ◦●◦ · ·   │
│  · ◦◦ ※※ · · ◦ · · ✧✧ · ♦♦ · · ◦●◦ · ※※ · · · ◦◦ · ·   │
│  · ◦●◦ · · · · · · ✧ · · ♦ · · · ◦◦ · · · ✧✧ · · · ·   │
│  · ◦●●◦ · ♦ · · · · · · · · · · · · · · ✧✧✧✧ · · · ·   │
│  · ◦●◦ · ♦♦♦ · · ※※ · · ◦◦ · · · ✶ · · ✧✧✧✧✧ · · ·   │
│  · · ◦ · ♦♦♦♦ · ※※※※ · ◦◦●◦ · · · · · · ✧✧✧✧ · ◦ ·   │
│  · · · · ♦♦♦ · · ※※※ · ◦●●●◦ · ◦◦ · · · ✧✧✧ · ◦◦◦ ·   │
│  · ✧ · · · ♦♦ · · ※※ · ◦●●◦◦ ◦◦●◦ · · · · ✧ · ◦●◦ ·   │
│  ✶ ✧✧ · · · ♦ · · · · · ◦●◦ · ◦●●◦ · · · · · · ◦◦ ✶   │
│  ✶ ✶ ✧ · · · · · · · · · ◦◦ · · ◦◦ · · · · · · · · ✶   │
│                                                           │
├─────────────────┬─────────────────────────────────────────┤
│ ◦● algae    93  │  era: EQUILIBRIUM      tide: HIGH       │
│ ※  lichen   47  │  H': 1.58              speed: 2x        │
│ ✧  coral    38  │  dominant: algae                        │
│ ♦  anemone  24  │                                         │
│ ✶  barnacle 14  │  [SPACE] pause  [R] reset  [T] tide    │
└─────────────────┴─────────────────────────────────────────┘
```

### Narrative Arc Summary

```
        population
         ▲
    150 ─┤                    ※※※※※※
         │    ●●●●●●●         ※※※※※※※※
    120 ─┤   ●●●●●●●●●       ※※※※※※※※※※
         │  ●●●●●●●●●●●     ※※※※※※※※※※※
     90 ─┤ ●●●●●●●●●●●●●  ※※※※※※※※※※※※※
         │●●●    ●●●●  ●●※※※※      ※※※※※
     60 ─┤       ✧✧✧✧✧✧✧✧✧✧✧✧✧✧✧✧✧✧✧✧
         │      ✧✧   ♦♦♦♦♦♦♦♦
     30 ─┤     ✧    ♦♦♦♦  ♦♦  ◦◦◦◦◦◦◦◦◦
         │ ✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶
      0 ─┼────┬────┬────┬────┬────┬────┬──▶ gen
         0   200  400  600  800  1000 1200

         GENESIS  BLOOM  EQUILIB  COLLAPSE  RECOVERY
```

The drama writes itself. Every run tells a different story depending on
seed, grid size, and tide timing. An agent watching `describeState()` over
time sees real ecological narrative unfold... collapse events, extinctions,
succession waves, recovery arcs. Each pool is unrepeatable.

---

### Next steps

- [ ] Zilla approves direction
- [ ] Scaffold module with `bash scripts/scaffold-microapp.sh`
- [ ] Build engine.ts and species.ts (pure, no deps)
- [ ] Build renderer.ts (pure state → string)
- [ ] Wire index.ts to host SDK
- [ ] Verify on live session, screenshot, iterate
