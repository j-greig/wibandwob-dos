# Autoresearch: WibMux — Ghostty-native tmux replacement

## Objective

Build and iterate on `wibmux` — a bash/osascript CLI that replaces tmux for
WibWob-DOS session management using Ghostty's AppleScript API (PR #11208).

Primary metric: **capability score** — how many of the 10 core operations
WibMux can perform successfully (0–10 scale, higher is better).

## Metrics
- **Primary**: capability_count (integer 0–10, higher is better)
- **Secondary**: latency_ms (average operation latency), reliability (% success over 10 runs)

## The 10 Core Operations

### Session lifecycle (replace tmux session management)
1. **create** — open a new Ghostty window running WibWob-DOS (`new window` + config)
2. **list** — enumerate running WibWob terminals by cwd/title (query `windows`/`terminals`)
3. **focus** — switch to a specific WibWob instance (`focus`/`activate window`)
4. **attach** — reconnect to an orphan WibWob instance (save workspace → kill → restart)
5. **close** — cleanly shut down a WibWob terminal (`close window`)

### Input & control (replace tmux send-keys)
6. **send** — input text/keys to a WibWob terminal (`input text`/`send key`)
7. **read** — capture terminal content (via WibWob API `/screenshot/ansi`, not osascript)

### Project layouts (community #1 request, 22 pts)
8. **layout** — apply a named layout: create tabs/splits, position panes, run commands.
   Reads a simple layout spec (JSON or inline args). Replaces the "5 minutes setting up
   tabs manually" pattern. Examples:
   - `wibmux layout --file layouts/dev.json` — WibWob + agent + logs in 3 splits
   - `wibmux layout --tabs "wibwob:bun run dev" "agent:pi" "logs:tail -f scratch/wibwob.log"`

### Shader control (unique to WibMux, nobody else has this)
9. **shader** — hot-swap Ghostty GLSL shader (`sed` config rewrite + `perform action "reload_config"`)
10. **shader-list** — list available shaders from the shaders directory

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
| `autoresearch/wibmux/layouts/` | Layout spec files (JSON) |

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

## Architecture Notes

**Why AppleScript works for us when it doesn't for others:**
- The #1 blocker for everyone in Ghostty #2353 is "how do I read terminal content?"
  (security nightmare, needs auth tokens, escape sequence risks). **We don't need it.**
  WibWob exposes `/screenshot/ansi`, `/state`, and full window state via HTTP API.
- AppleScript handles creation, focus, input, lifecycle. WibWob API handles reading.
  Two complementary layers, no security gaps.

**Why layouts are high-value:**
- 22 community pts (highest concrete use case). Rails devs want 5-tab setup in 30s.
- WibWob devs want: main instance + agent chat + log tail + alt instance. Every session.
- Layout specs are declarative, shareable, version-controllable.

**Future-proofing:**
- When Ghostty ships Unix socket IPC (mitchellh's stated plan), WibMux can swap
  osascript calls for socket commands. The CLI interface stays the same.
- Layout specs are transport-agnostic — they describe what, not how.

## Reference

- Ghostty SDEF: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
- Spike brief: `.planning/spikes/spk-wibmux/spk-wibmux-brief.md`
- Community triage: `.planning/spikes/spk-wibmux/ghostty-community-triage.md`
- Existing attach logic: `src/cli/wibwob.ts` (search for "attach")
- Existing shader script: `/Users/james/Repos/wibandwob-dos/scripts/ghostty-shader.sh`
- Process manager: `scripts/lib/process-manager.sh`
- Ghostty AppleScript PR: https://github.com/ghostty-org/ghostty/pull/11208
- Community discussion: https://github.com/ghostty-org/ghostty/discussions/2353
- Community shader discussion: https://github.com/ghostty-org/ghostty/discussions/2353
- Community shader script: https://github.com/JefStat/ghostty-shaders/blob/a34744b/shader.sh

## What's Been Tried

(Nothing yet — baseline run pending)
