---
name: chiptune
description: |
  Composable audio synthesis toolkit for chiptune music, covers, and scoring.
  Two workflows: BRICKS (original compositions from numpy primitives) and
  COVER (arrange well-known melodies as chiptune). Use when composing music,
  generating stingers, mixing voiceover with score, covering songs in 8-bit,
  or any task requiring programmatic audio synthesis.
---

# Chiptune — Synthesis and Arrangement

Two workflows, one toolkit.

## Workflow 1: BRICKS — Original Composition

Read the full bricks reference:
  .pi/skills/chiptune-bricks/SKILL.md

Key points:
- Three layers: primitives (osc/fx/theory), patterns (compositional gestures), pipeline (pydub/export)
- All synthesis in numpy float64 at SR=22050
- Scripts in .pi/skills/chiptune-bricks/scripts/
- References in .pi/skills/chiptune-bricks/references/

## Workflow 2: COVER — Arrange Known Melodies

Read the full cover reference:
  .pi/skills/chiptune-cover/SKILL.md

Process:
1. RESEARCH — extract key, tempo, melody, harmony from source
2. ARRANGE — make creative chiptune decisions (voices, textures, structure)
3. COMPOSE — build with chiptune-bricks primitives
4. MIX — export via pipeline

References in .pi/skills/chiptune-cover/references/

## Quick Start

```python
# Original composition
from scripts.chiptune_bricks import osc, fx, theory, canvas, patterns, pipeline

# Cover arrangement
# 1. Research the song
# 2. Map to chiptune voices
# 3. Compose with bricks
# 4. Export with pipeline
```

## audioop-lts Required

pydub needs audioop which was removed in Python 3.13+:
```bash
pip install audioop-lts
```
