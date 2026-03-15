# Autoresearch: WibMux — Ghostty-native tmux replacement

## Objective

Build and iterate on `wibmux` — a set of bash/osascript scripts that replace tmux
for WibWob-DOS session management using Ghostty's AppleScript API.

Primary metric: **capability score** — how many of the 8 core tmux operations
WibMux can perform successfully (0–8 scale, higher is better).

## Metrics
- **Primary**: capability_count (integer 0–8, higher is better)
- **Secondary**: latency_ms (average operation latency), reliability (% success over 10 runs)

## The 8 Core Operations

1. **create** — open a new Ghostty window running WibWob-DOS
2. **list** — enumerate running WibWob terminals (by cwd or title)
3. **focus** — switch to a specific WibWob instance
4. **send** — input text/keys to a WibWob terminal
5. **split** — create a split pane for a second instance
6. **read** — capture terminal content (via WibWob API, not osascript)
7. **attach** — reconnect to an orphan WibWob instance
8. **close** — cleanly shut down a WibWob terminal

## How to Run

```bash
./autoresearch.sh
```

Outputs `METRIC capability_count=N` and `METRIC latency_ms=N`.

## Files in Scope

| File | What |
|------|------|
| `autoresearch/wibmux/wibmux.sh` | The WibMux CLI script (main deliverable) |
| `autoresearch/wibmux/autoresearch.sh` | Benchmark runner |
| `autoresearch/wibmux/autoresearch.checks.sh` | Syntax/lint checks |
| `autoresearch/wibmux/test-operations.sh` | Integration test for all 8 ops |

## Off Limits

- `src/` — do not modify WibWob-DOS source code
- `scripts/lib/process-manager.sh` — read for reference but don't modify
- Any non-macOS paths (this is macOS-only via AppleScript)

## Constraints

- All Ghostty interaction via `osascript` (AppleScript)
- Must work with Ghostty 1.3+ (AppleScript support merged in PR #11208)
- WibWob-DOS must be running on port 8099 for `read` and `attach` operations
- Each operation must complete in under 5 seconds
- No Python/Node dependencies — bash + osascript only

## Reference

- Ghostty SDEF: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
- Spike brief: `.planning/spikes/spk-wibmux/spk-wibmux-brief.md`
- Existing attach logic: `src/cli/wibwob.ts` (search for "attach")
- Process manager: `scripts/lib/process-manager.sh`
- Ghostty PR: https://github.com/ghostty-org/ghostty/pull/11208

## What's Been Tried

(Nothing yet — baseline run pending)
