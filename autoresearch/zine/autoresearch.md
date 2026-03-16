# Zine Moodboard Spike — Interactive Architecture Poster

## Objective

Convert the static ASCII architecture moodboard into an interactive zine
microapp. Three slices: menu visibility, COAT/SDK migration, moodboard
as a .canvas.yaml with ~15 panels.

## Primary Metric

`zine_score` — sum of pass/fail behaviour checks (0–100).

Higher is better. Each check is binary.

### Scoring Breakdown

| Feature | Points | Checks |
|---------|--------|--------|
| Slice 0: Menu access | 10 | tier promoted from beta (5), zine opens via command palette (5) |
| Slice 1: COAT compliance | 25 | no direct blessed.box/list outside SDK (10), check-coat passes (5), typecheck passes (5), describeState implemented (5) |
| Slice 1: SDK migration | 15 | imports only from microapp-sdk (5), onRestyle handles theme (5), captureText implemented (5) |
| Slice 2: Moodboard canvas | 30 | moodboard.canvas.yaml exists and is valid YAML (5), has >= 10 panels (5), has figlet panel (5), has text panels (5), has ascii-art panels (5), loadCanvas parses it without error (5) |
| Slice 2: Panel content | 20 | philosophy text present (5), COAT diagram present (5), principles present (5), north star present (5) |

## Benchmark Command

```bash
bash autoresearch/zine/autoresearch.sh
```

Outputs `zine_score: <N> / 100` on the last meaningful line.

## Constraints

- `bun run typecheck` must pass
- `bun run check-coat` must pass
- No new API endpoints
- Zine must still load existing .canvas.yaml files (backward compat)
