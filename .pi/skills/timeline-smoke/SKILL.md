---
name: timeline-smoke
description: >-
  Smoke test a VJ timeline end-to-end with real macOS screencapture PNGs at every
  cue step, plus tmux text dumps and state JSON. Capture-then-review pattern — all
  evidence collected first, comparison done after. Use when testing a new timeline,
  verifying the pipeline after code changes, or debugging cue behaviour. Triggers on:
  "smoke test timeline", "test the timeline", "capture each step", "screenshot each cue".
---

# Timeline Smoke Test

End-to-end smoke test for a VJ timeline. Fires each cue, screenshots the real TUI
on the external monitor after each one, captures state JSON + tmux text, then runs
a review pass on everything collected.

## Quick run

```bash
./tests/timeline-smoke/run.sh scratch/timelines/test-8bar.json
```

Results in `scratch/smoke-capture-<timestamp>/`.

## What it captures per cue

| File | What |
|------|------|
| `00-baseline.png` | macOS screencapture of TUI before run |
| `01-cue_t0s.png` | real external monitor screenshot after cue fires |
| `01-cue_t0s.txt` | tmux pane text dump |
| `01-cue_t0s_state.json` | full `/state` JSON snapshot |
| `expected.jsonl` | machine-readable expected-state log |
| `validate.txt` | timeline-validate output |
| `dry-run.txt` | timeline-dry-run resolved cue schedule |
| `timed-capture.txt` | timeline-capture timed run log |
| `review.txt` | timeline-review expected-vs-actual report |

## Capture-then-review pattern

Recording pass and review pass are fully separated:
1. Run fires cues sequentially, sleeps for repaint, screenshots
2. After ALL cues have fired, review.txt is generated
3. No inline assertions — just evidence collection

This means you can watch the TUI during the run without the test
racing against assertions.

## Environment

| Var | Default | Purpose |
|-----|---------|---------|
| `DISPLAY_NUM` | `2` | macOS display index for screencapture |
| `API` | `http://127.0.0.1:8099` | Control API |
| `TMUX_SESSION` | `wibwob-screenshot` | tmux session name |
| `REPAINT_WAIT` | `1.0` | Seconds to wait after cue before screenshot |

External monitor is display 2 on the current setup. Use `DISPLAY_NUM=1` for main monitor.

## Prerequisites

- App running: `CONTROL_API_PORT=8099 bun run dev` in tmux session `wibwob-screenshot`
- TUI visible on external monitor (display 2)
- If app is not running, load `tmux-launch` skill first

## Finding display number

```bash
# Capture each display to a /tmp file, check which one has the TUI
screencapture -x -D 1 /tmp/d1.png
screencapture -x -D 2 /tmp/d2.png
# Read them to check
```

## Examples

```
tests/timeline-smoke/examples/test-8bar.json   — 8-bar test timeline, one change per bar
```

## Files

| File | Purpose |
|------|---------|
| `tests/timeline-smoke/run.sh` | Main smoke test script |
| `tests/timeline-smoke/examples/` | Canonical example timelines for testing |
| `scratch/smoke-capture-*/` | Timestamped output from each run |

## Relation to other skills/scripts

| Thing | Role |
|-------|------|
| `vj-timeline` skill | Authoring timelines, understanding format |
| `scripts/timeline-capture.ts` | Timed capture (used inside this script) |
| `scripts/timeline-review.ts` | Review pass (used inside this script) |
| `ww-screenshot` skill | Single-window crop (not used here — this captures full display) |
| `tui-smoke-test` skill | Agent/session smoke tests — different concern |

## Known issues / gotchas

- Run AFTER clearing the desktop — baseline capture will show leftover windows otherwise
- tmux pane width may not match TUI width if terminal was resized — text dumps look wide
- `REPAINT_WAIT=1.0` may need increasing on slow machines or for heavy primer loads
- The cue-firing in this script is manual (API calls) not the real timed runner.
  Use `timed-capture.txt` + `review.txt` for timing-accurate ground truth.
