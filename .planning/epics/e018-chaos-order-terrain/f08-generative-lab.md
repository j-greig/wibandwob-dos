---
Status: in-progress
Type: feature
Parent: E018
GitHub issue: —
PR: —
---

# F08 — Generative Lab (Contour Studio v2)

## TL;DR

New window: "Generative Lab". A cellular automata / generative systems playground with composable rule primitives. Modes range from Game of Life to Brian Eno-style bloom to fully random rulesets. Save exports both art AND the ruleset YAML that created it. Engine is substrate-agnostic — same rules work on grids, contours, glyphs, or any future cell type.

## Architecture

```
generative_engine.py          — substrate-agnostic rule engine
  ├── substrates/             — what fills a cell (0/1, contour, glyph, colour)
  ├── rules/                  — composable transforms (grow, die, drift, pulse...)
  ├── seeders/                — initial state generators (random, spiral, edge...)
  └── presets/                — named mode YAML files

generative_stream.py          — pipe-friendly wrapper (like contour_stream.py)
app/generative_lab_view.h/cpp — TUI window (like contour_map_view)
```

### Substrate layer (what a cell IS)

The engine operates on a 2D grid of `Cell` objects. Each cell has:
- `state`: int (0=dead, 1+=alive variants)
- `age`: int (ticks since birth)
- `value`: str (display character — '0', '1', '╭', '█', etc.)
- `substrate`: which renderer draws it

Substrates are pluggable renderers:
- `binary` — 0/1 with box-drawing borders (like primer)
- `contour` — marching squares curves
- `block` — █▓▒░ density blocks
- `glyph` — emoji, kanji, ASCII art fragments
- `empty` — substrate for future expansion

### Rule primitives (the Lego bricks)

Each rule is a pure function: `(grid, params) → grid`. Composable, chainable, order matters.

| Rule | Params | Description |
|------|--------|-------------|
| `seed_random` | density, state | Randomly activate N% of cells |
| `seed_points` | coords[] | Activate specific cells |
| `seed_edge` | edge(top/bottom/left/right), density | Seed along an edge |
| `seed_spiral` | cx, cy, arms, spacing | Spiral pattern from centre |
| `seed_clusters` | n, radius_range | Random circular clusters |
| `grow_flood` | p, bias(up/down/left/right/none) | Probabilistic flood fill from active cells |
| `grow_life` | born[], survive[] | Conway-style birth/survival rules |
| `grow_brian` | — | Brian's Brain: on→dying→dead→on |
| `grow_diffuse` | rate | Cells spread to neighbours with probability |
| `die_isolate` | min_neighbours | Kill cells with too few neighbours |
| `die_overcrowd` | max_neighbours | Kill cells with too many neighbours |
| `die_age` | max_age | Cells die after N ticks |
| `flip_threshold` | n | Toggle state if exactly N neighbours |
| `drift` | dx, dy | Shift all cells by (dx,dy) per tick |
| `pulse` | period, states[] | Cycle cell state through values over time |
| `border_box` | — | Draw box-drawing chars around active regions |
| `border_contour` | levels | Marching squares on density field |
| `border_none` | — | No borders, just cell values |
| `mutate_rules` | rate, range | Randomly tweak rule params |
| `symmetry` | axis(x/y/xy/rotate4) | Mirror/rotate the grid |
| `gravity` | direction, strength | Cells fall/drift under gravity |
| `merge_absorb` | — | When regions touch, larger absorbs smaller |
| `oscillate` | param, min, max, period | Sine-wave a rule param over time |
| `branch` | p, angle_range | Growth splits into branches (coral/tree) |
| `erode` | p | Randomly remove edge cells |
| `smooth` | rounds | Average cell states with neighbours |

### Preset modes

```yaml
# presets/game-of-life.yml
name: "Game of Life"
substrate: binary
rules:
  - seed_random: {density: 0.3}
  - grow_life: {born: [3], survive: [2, 3]}
  - border_box: {}
tick_ms: 100
continuous: true

# presets/eno-bloom.yml
name: "Eno Bloom"
substrate: binary
rules:
  - seed_points: {method: golden_ratio, count: 5}
  - grow_flood: {p: 0.35, bias: none}
  - die_age: {max_age: 12}
  - pulse: {period: 8, states: [1, 1, 1, 0]}
  - drift: {dx: 0.3, dy: 0}
  - border_box: {}
tick_ms: 120
continuous: true

# presets/coral-reef.yml
name: "Coral Reef"
substrate: contour
rules:
  - seed_edge: {edge: bottom, density: 0.15}
  - branch: {p: 0.3, angle_range: 60}
  - die_isolate: {min_neighbours: 1}
  - gravity: {direction: up, strength: 0.8}
  - border_contour: {levels: 4}
tick_ms: 80
continuous: true

# presets/mycelium.yml
name: "Mycelium"
substrate: binary
rules:
  - seed_clusters: {n: 3, radius_range: [1, 2]}
  - grow_flood: {p: 0.25, bias: none}
  - branch: {p: 0.15, angle_range: 120}
  - die_overcrowd: {max_neighbours: 4}
  - border_box: {}
tick_ms: 60
continuous: true

# presets/tidal.yml
name: "Tidal"
substrate: block
rules:
  - seed_edge: {edge: left, density: 0.8}
  - drift: {dx: 1, dy: 0}
  - oscillate: {param: "drift.dy", min: -1, max: 1, period: 20}
  - grow_diffuse: {rate: 0.1}
  - die_age: {max_age: 30}
  - border_none: {}
tick_ms: 100
continuous: true

# presets/crystal.yml
name: "Crystal"
substrate: binary
rules:
  - seed_points: {method: centre, count: 1}
  - grow_life: {born: [1, 3, 5], survive: [0, 2, 4, 6]}
  - symmetry: {axis: rotate4}
  - border_box: {}
tick_ms: 80
continuous: true

# presets/erosion.yml
name: "Erosion"
substrate: contour
rules:
  - seed_random: {density: 0.7}
  - die_isolate: {min_neighbours: 2}
  - erode: {p: 0.05}
  - smooth: {rounds: 1}
  - border_contour: {levels: 5}
tick_ms: 150
continuous: true

# presets/random.yml
name: "???"
substrate: random
rules: random
tick_ms: random(50, 200)
continuous: true
# Engine picks 3-6 random rules with random params each run.
# Mutate_rules applied every 50 ticks for evolution.
```

### Random mode generation

When `rules: random`, the engine:
1. Picks a substrate: weighted random from [binary:40%, contour:25%, block:25%, glyph:10%]
2. Picks 1 seeder from the seeder pool
3. Picks 2-4 rules from the rule pool (weighted by compatibility with substrate)
4. Assigns random params within sane ranges for each rule
5. Adds `mutate_rules: {rate: 0.02, range: 0.1}` so it evolves
6. Logs the generated ruleset to the save file

### Save format

```yaml
# exports/generative/20260227_eno-bloom_s42.yml
name: "Eno Bloom"
seed: 42
substrate: binary
ticks_elapsed: 347
rules:
  - seed_points: {method: golden_ratio, count: 5}
  - grow_flood: {p: 0.35, bias: none}
  - die_age: {max_age: 12}
  - pulse: {period: 8, states: [1, 1, 1, 0]}
  - drift: {dx: 0.3, dy: 0}
  - border_box: {}
output: |
  ┼─┼─┼─┼─┼
  │0│1│0│1│
  ...
```

### TUI controls

| Key | Action |
|-----|--------|
| 1-9 | Select preset (1=Life, 2=Bloom, 3=Coral...) |
| 0 | Random mode (new rules each press) |
| Space | Pause/resume |
| . | Step one tick (when paused) |
| r | New seed, same rules |
| m | Mutate: randomly tweak one rule param |
| s | Save (art + ruleset YAML) |
| i | Show info: current ruleset overlay |
| +/- | Speed up/slow down tick rate |
| TAB | Cycle substrate (re-render same state) |
| o | Toggle border style (box/contour/none) |

## Implementation plan

1. Build `tools/generative_engine.py` — rule engine with Cell grid, rule primitives, substrate renderers
2. Build `tools/generative_stream.py` — pipe wrapper with `--preset` and `--rules-json`
3. Build `app/generative_lab_view.h/cpp` — TUI window (fork of contour_map_view pattern)
4. Ship 8 presets + random mode
5. Save exports YAML + text

## Open questions

- Should presets be YAML files on disk (editable) or hardcoded in Python?
  → Disk. Users can create/share presets.
- Should random mode have a "lock" feature — lock rules you like, randomise the rest?
- Should there be a "breed" mode — take two rulesets, crossover, produce offspring?
