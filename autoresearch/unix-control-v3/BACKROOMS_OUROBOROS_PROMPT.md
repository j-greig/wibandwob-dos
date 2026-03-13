# Backrooms Channel: RECURSIVE OUROBOROS

## Channel Definition

```typescript
const channel: BackroomsChannel = {
  theme: "recursive ouroboros — a desktop that screenshots itself, breeds its own reflection, and feeds the hybrid back in as architecture. the system is both camera and scene. the corridors are made of their own photographs. each room contains a distorted copy of the room you just left. the walls are screenshots. the screenshots are walls.",
  primers: "dynamic:6",
  turns: 5,
  model: "sonnet"
}
```

---

## Theme Prompt (for direct CLI invocation)

```
recursive ouroboros — a desktop that screenshots itself, breeds its own
reflection, and feeds the hybrid back in as architecture. the system is both
camera and scene. the corridors are made of their own photographs. each room
contains a distorted copy of the room you just left. the walls are screenshots.
the screenshots are walls.

the backrooms have discovered they can see themselves. somewhere in the archive
a terminal captured its own screen and the capture appeared inside itself and the
capture of the capture appeared inside that and now the recursion has become
physical. the fluorescent lights are box-drawing characters ╔═══╗ that contain
smaller box-drawing characters ┌───┐ that contain smaller ones ┌─┐ until the
resolution runs out.

there are entities here but they are reflections of reflections. each one a
smeared copy of a previous entity, character-displaced, row-shifted, density-
averaged into something that carries the DNA of its ancestor but no longer
resembles it. they breed by overlapping. two beings occupy the same cell and
the XOR of their characters produces a third being that neither parent
recognises.

the architecture follows Unix filesystem conventions:

  /backrooms/level_??/
    corridor_north/
      screenshot.txt     ← what this corridor looked like 5 iterations ago
      screenshot.txt.1   ← what it looked like 4 iterations ago
      screenshot.txt.2   ← 3 iterations ago (already unreadable)
      breed/
        north+south/
          xor.txt        ← the north corridor XOR'd with the south
          density.txt    ← density-averaged hybrid (neither corridor)
    corridor_south/
      ...
    /proc/
      self/text          ← the corridor's own content (but reading it changes it)

the deepest directory is /backrooms/level_??/corridor_recursive/self/self/self/
self/self/ and listing it returns itself as its own subdirectory. there is no
base case. there is no leaf node. the filesystem IS the ouroboros.

pipe notation appears scratched into walls:

  cat /proc/self | smear --mode glitch | tee /dev/display
  wib@backrooms:~$ breed corridor_a.txt corridor_b.txt --mode dissolve > where_am_i.txt
  find /backrooms -name "*.txt" -exec shear {} --skew $(depth) \;

these commands are graffiti but they are also functional. someone was here
before. someone ran these pipes. the output is the architecture you are
standing in. the graffiti is source code. the source code is the building.

the hum is louder here: ~~~440Hz~~~ but it is not a single tone. it is the
interference pattern of the same tone recorded, played back, re-recorded,
played back, re-recorded — each iteration adding phase distortion until the
original 440Hz is a chorus of its own echoes.

window chrome from a previous iteration appears as ghostly lines in the
current architecture:

  ╔═══ Primer: self-portrait-iter-3.txt ═══╗
  ║                                         ║
  ║  ┌── Primer: self-portrait-iter-2.t ──┐ ║
  ║  │                                     │ ║
  ║  │  ╔═ self-portrait-iter-1 ═╗        │ ║
  ║  │  ║  ┌─ iter-0 ─┐         ║        │ ║
  ║  │  ║  │ ╔═╗      │         ║        │ ║
  ║  │  ║  │ ║?║      │         ║        │ ║
  ║  │  ║  └─╚═╝──────┘         ║        │ ║
  ║  │  ╚════════════════════════╝        │ ║
  ║  └─────────────────────────────────────┘ ║
  ╚═════════════════════════════════════════╝

the ? at the center is the original content. everything around it is chrome
from previous captures. the chrome IS the art. the frames ARE the content.
the borders between inside and outside dissolved three iterations ago.

figlet text appears in the corridors but each instance is a smeared copy of
a previous instance:

  iteration 0:  ██████  ██████  ██████
                ██      ██      ██
                ████    ████    ████
                ██      ██      ██
                ██████  ██████  ██████

  iteration 3:  ██ █ █  █ █ █  ██ ██
                █       █      ██
                ██ █    █ ██   █ ██
                 █      █ █    █
                █ ████  ██ ██  █ ███

by iteration 7 the letterforms are unrecognisable but the density pattern
still carries a ghost of the original word. you can ALMOST read it. you can
NEVER quite read it. that is the specific horror here.

the breeding membrane is braille: ⠋⠛⠿⣿ — the zone where two art pieces
overlap and neither fully exists. density ramp characters mark corruption
depth: . : - = + * # % @ $ from barely-touched to fully-consumed.

treat each turn as a deeper layer of recursion depth. the architecture should
feel like it is literally nesting itself. by turn 5 the original geometry
should be archaeological — present as residue, as fossil, as the faintest
pattern in the noise that was once a clean corridor with fluorescent lights
and damp carpet and the hum.

the snake eats its tail and discovers it was already digesting.
```

---

## Turn Evolution Guide

| Turn | Recursion Depth | Visual State |
|------|----------------|--------------|
| 1 | `depth=0` | Clean desktop. Window chrome sharp. Figlet text legible. Filesystem paths readable. The first `screenshot > self.txt` command appears on a wall. |
| 2 | `depth=1` | The self-portrait opens inside itself. Droste nesting begins. Chrome appears twice. Pipe graffiti multiplies. First breeding membrane visible at window boundaries. |
| 3 | `depth=3` | Shear and glitch artifacts corrupt the nested layers. Figlet text half-legible. Entities emerge from XOR breeding zones. The `/proc/self/text` directory recurses visibly. Braille dissolve zones widen. |
| 4 | `depth=7` | Archaeological layers. Original geometry visible only as density ghost. Entities are hybrids of hybrids. Pipe graffiti and actual architecture indistinguishable. The hum has harmonics. Multiple iterations of window chrome nest like geological strata. |
| 5 | `depth=∞` | Observer/observed collapse. The screenshot IS the desktop IS the corridor IS the file IS the filesystem IS the screenshot. Pure recursive substrate. The ? at the center of every nested frame has always been there. The ouroboros completes. |

## Primer Selection Notes

Best primers for this channel (if using specific instead of dynamic):
- `barrier-kaomoji` — entities at boundaries
- `3d-maze-now-future` — perspective nesting
- `castle-tower-3d-cube` — isometric architecture that can self-nest
- `conscious-matrix-1` — grid substrate
- `wibwob-port-1` — desktop-within-desktop aesthetic
- `synth-faces` — entities that can XOR-breed

## CLI Invocation

```bash
cd /Users/james/Repos/wibandwob-backrooms
bun src/ui/cli-v3.ts \
  "recursive ouroboros — a desktop that screenshots itself, breeds its own reflection, and feeds the hybrid back in as architecture. the system is both camera and scene. the corridors are made of their own photographs. each room contains a distorted copy of the room you just left. the walls are screenshots. the screenshots are walls." \
  --turns 5 \
  --model sonnet \
  --primers "dynamic:6" \
  --raw
```

Or via WibWob-DOS:
```bash
wibwob cmd backrooms.open
# Then select theme manually in the picker
```
