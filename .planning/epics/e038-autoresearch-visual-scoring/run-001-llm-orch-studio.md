# Run 001 — LLM Orch Studio UI Quality

First autoresearch visual scoring session. Target: `microapps/llm-orch-studio/index.ts`.

## Config

- Metric: ui_score (1-10, higher is better)
- Axes: layout, readability, aesthetic, coherence, character
- Architecture: B (self-scoring via Pi Read on PNG)
- tmux geometry: 211x56
- Display: 2

## Results

13 experiments. 7 discarded, 6 kept. All keeps shown below.

| Run | Commit  | ui_score | L | R | A | Co | Ch | What changed |
|-----|---------|----------|---|---|---|----|----|-------------|
| 1   | bdc0329 | 3.6      | 4 | 5 | 3 | 4  | 2  | Baseline scaffold. Generic, no personality. |
| 4   | 9f710b6 | 5.6      | 5 | 6 | 5 | 6  | 6  | Subtitle, idle placeholder messages in logs |
| 5   | bfcd7e7 | 5.8      | 6 | 6 | 5 | 6  | 6  | Compact topic row, turns table right column |
| 8   | f4e23f8 | 6.6      | 7 | 6 | 6 | 7  | 7  | Responsive sizing, wider gap, tighter turns |
| 12  | e893417 | 7.4      | 7 | 7 | 8 | 7  | 8  | Animated pulse in status banner |
| 13  | 48451a6 | 7.8      | 8 | 7 | 8 | 8  | 8  | Dual figlet headers with typographic hierarchy |
| 14  | 98b8cb7 | 8.0      | 8 | 8 | 8 | 8  | 8  | Remove help text, 1-unit gap, severity markers in log |

## Deltas (baseline to best)

| Axis        | Start | End | Change |
|-------------|-------|-----|--------|
| ui_score    | 3.6   | 8.0 | +122%  |
| layout      | 4     | 8   | +100%  |
| readability | 5     | 8   | +60%   |
| aesthetic   | 3     | 8   | +167%  |
| coherence   | 4     | 8   | +100%  |
| character   | 2     | 8   | +300%  |

Final state: perfect eights across all five axes.

Biggest winner: CHARACTER (+300%). Started as a generic scaffold with zero
personality, ended with animated breathing dots, dual figlet headers,
severity-coloured log entries, and WibWob-flavoured idle messages.

Readability closed the gap in the final run (+60%) — removing redundant
help text and adding severity markers (~, +) in the log created scannable
hierarchy. The smallest change with the most precise impact.

## Timeline

All timestamps GMT, 2025-03-13.

- 10:16 — Run 1: baseline captured
- 10:22 — Run 4: first meaningful keep (subtitle + placeholders)
- 10:23 — Run 5: layout tightening
- 10:28 — Run 8: responsive sizing
- 10:34 — Run 12: animated pulse (big aesthetic jump)
- 10:36 — Run 13: dual figlet headers
- 10:38 — Run 14: breathing room + severity markers (final: 8.0 flat)

Total elapsed: ~22 minutes for 14 iterations.

## Observations

1. The agent frontloaded layout fixes (runs 4-8) then shifted to
   character/aesthetic work (runs 12-13). Natural progression.

2. Discarded runs (7 of 13 = 54%) were mostly small tweaks that did not
   move the needle or broke something the checks caught. Healthy discard
   rate — the agent is not keeping everything.

3. The biggest single-run jump was run 12 (animated pulse): +0.8 on
   ui_score. Adding life/motion to the UI had outsized impact on
   aesthetic and character axes.

4. Readability is the hardest axis to improve in terminal UI. Limited
   by blessed constraints (no font control, character-cell grid).

## Raw JSONL

Archived at `autoresearch.jsonl` in repo root (active session file).
Copy preserved below for planning record:

```jsonl
{"type":"config","name":"LLM Orch Studio UI Quality","metricName":"ui_score","metricUnit":"","bestDirection":"higher"}
{"run":1,"commit":"bdc0329","metric":3.6,"metrics":{"layout":4,"readability":5,"aesthetic":3,"coherence":4,"character":2},"status":"keep","description":"Baseline: LLM Orch Studio scaffold state. Generic layout, no personality.","timestamp":1773399382962,"segment":0}
{"run":4,"commit":"9f710b6","metric":5.6,"metrics":{"layout":5,"readability":6,"aesthetic":5,"coherence":6,"character":6},"status":"keep","description":"Add subtitle, idle placeholder messages in conversation and steps logs","timestamp":1773399752990,"segment":0}
{"run":5,"commit":"bfcd7e7","metric":5.8,"metrics":{"layout":6,"readability":6,"aesthetic":5,"coherence":6,"character":6},"status":"keep","description":"Compact topic to 1 row, move turns table to right column, tighter proportions","timestamp":1773399821586,"segment":0}
{"run":8,"commit":"f4e23f8","metric":6.6,"metrics":{"layout":7,"readability":6,"aesthetic":6,"coherence":7,"character":7},"status":"keep","description":"Responsive window sizing fills desktop, wider column gap, turns table 6-row basis","timestamp":1773400085346,"segment":0}
{"run":12,"commit":"e893417","metric":7.4,"metrics":{"layout":7,"readability":7,"aesthetic":8,"coherence":7,"character":8},"status":"keep","description":"Animated pulse in status banner — breathing dots when idle, filled dots when running. UI feels alive.","timestamp":1773400471559,"segment":0}
{"run":13,"commit":"48451a6","metric":7.8,"metrics":{"layout":8,"readability":7,"aesthetic":8,"coherence":8,"character":8},"status":"keep","description":"Dual figlet headers: LLM ORCH (slant, accent) left + STUDIO (small, muted) right. Visual symmetry and typographic hierarchy.","timestamp":1773400589845,"segment":0}
```

## Screenshots

Archived at `.planning/epics/e038-autoresearch-visual-scoring/output/shots/` (001 through 013).
Baseline: `output/001-baseline.png`. Final: `output/014-final-8.0.png`.

## Raw JSONL (updated with run 14)

```jsonl
{"run":14,"commit":"98b8cb7","metric":8,"metrics":{"layout":8,"readability":8,"aesthetic":8,"coherence":8,"character":8},"status":"keep","description":"Remove redundant help text, add 1-unit breathing room before convo, severity-coloured idle entries, keyWidth:10"}
```
