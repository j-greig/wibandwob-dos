---
id: spk-wibmux
title: "WibMux — Ghostty-native tmux replacement for WibWob-DOS"
status: spike
created: 2026-03-15
---

# WibMux — Ghostty-native tmux replacement

## Problem

WibWob-DOS currently uses tmux for session management, background processes, and
multi-instance support. tmux works but adds:
- **Performance tax** — extra PTY hop slows blessed render (~23fps observed)
- **ACS garbling** — tmux capture-pane produces mangled box-drawing characters
- **Complexity** — agents must understand tmux sessions, panes, send-keys idioms
- **No GPU shaders** — tmux runs in its own renderer, Ghostty shaders only apply over final pixels

tmux stands for **t**erminal **mux**iplexer. WibMux = **Wib**Wob **Mux**iplexer —
same concept, Ghostty-native, WibWob-aware, agent-friendly.

## Opportunity: Ghostty AppleScript (PR #11208)

Ghostty 1.3 shipped full AppleScript support (merged 2026-03-06):
- **PR:** https://github.com/ghostty-org/ghostty/pull/11208
- **SDEF:** `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
- **Author:** mitchellh (Ghostty creator)

### Full Capability Matrix

| Category | Commands | What it gives us |
|----------|----------|-----------------|
| **Objects** | `application`, `window`, `tab`, `terminal` | Stable IDs, titles, working directories, hierarchy traversal |
| **Creation** | `new window`, `new tab`, `split` | Programmatic window/tab/pane creation with config |
| **Configuration** | `new surface configuration` | Reusable configs: font size, working dir, command, env vars, initial input |
| **Input** | `input text`, `send key`, `send mouse button/position/scroll` | Full synthetic input — replaces `tmux send-keys` |
| **Focus** | `focus`, `activate window`, `select tab` | Window/tab/terminal focus management |
| **Lifecycle** | `close`, `close tab`, `close window` | Clean teardown |
| **Actions** | `perform action` | Execute any Ghostty action string (e.g. `reload_config`) |
| **Queries** | `working directory`, `name`, `id`, `selected`, `index` | Read terminal state without scraping |

### Key Examples from PR

**tmux-like 4-pane layout:**
```applescript
tell application "Ghostty"
    set cfg to new surface configuration
    set initial working directory of cfg to projectDir
    set win to new window with configuration cfg
    set pane1 to terminal 1 of selected tab of win
    set pane2 to split pane1 direction right with configuration cfg
    set pane3 to split pane1 direction down with configuration cfg
    set pane4 to split pane2 direction down with configuration cfg
    input text "nvim ." to pane1
    send key "enter" to pane1
end tell
```

**Jump by working directory:**
```applescript
set matches to every terminal whose working directory contains "wibandwob-dos"
focus terminal (item 1 of matches)
```

**Broadcast to all terminals:**
```applescript
repeat with t in (terminals of application "Ghostty")
    input text cmd to t
    send key "enter" to t
end repeat
```

**Config reload (shader hot-swap):**
```applescript
perform action "reload_config" on terminal 1 of selected tab of front window
```

## Vision: What WibMux Replaces

| tmux concept | WibMux equivalent | Implementation |
|-------------|-------------------|----------------|
| `tmux new-session -s wibwob` | `wibmux new` | `new window` with WibWob config |
| `tmux attach -t wibwob` | `wibmux attach` | `activate window` + `focus` by cwd or title |
| `tmux send-keys` | `wibmux send` | `input text` + `send key` |
| `tmux capture-pane` | WibWob API `/screenshot/ansi` | Already exists, no tmux needed |
| `tmux split-window` | `wibmux split` | `split` with direction |
| `tmux select-pane` | `wibmux focus` | `focus` terminal |
| `tmux list-sessions` | `wibmux list` | Query Ghostty `windows`/`terminals` |
| Status bar | Ghostty tab bar + custom keybinds | Or a WibWob-DOS status window |

## What Already Exists

WibWob-DOS already has the pieces — they just route through tmux:

- **`wibwob attach`** — detects orphan instances, saves workspace, kills stale PID,
  restarts with workspace restore. This is the core "reattach" logic.
- **`wibwob start` / `wibwob restart`** — idempotent instance lifecycle
- **`wibwob instances`** — lists running instances via unix sockets
- **`scripts/lib/process-manager.sh`** — dual-mode (direct/tmux) process management
- **`scripts/ensure-running.sh`** — idempotent start
- **`scripts/restart.sh`** — stop → relaunch → poll `/health`
- **`scripts/start-alt-instance.sh`** — second instance on different port

## Research Questions

1. **Can osascript reliably manage Ghostty windows from a background process?**
   (TCC permissions, timing, error handling)
2. **What's the latency of `input text` vs `tmux send-keys`?**
3. **Can we read terminal content back?** (tmux capture-pane equivalent —
   or do we just use the WibWob API which already works?)
4. **Tab bar as session switcher** — can Ghostty tabs replace tmux session switching?
   Each tab = one WibWob instance?
5. **Ghostty keybindings** — can we bind Ghostty keys to osascript actions?
   (e.g. Ctrl+B equivalent for WibMux prefix key)
6. **Split panes vs separate windows** — which model works for WibWob multi-instance?
7. **Agent interface** — how do agents discover/control WibMux?
   (CLI commands? API endpoints? Both?)

## Relevant Docs

- Ghostty VT reference: https://ghostty.org/docs/vt/reference
- Ghostty VT concepts (sequences): https://ghostty.org/docs/vt/concepts/sequences
- Ghostty config: https://ghostty.org/docs/config
- Ghostty keybindings: https://ghostty.org/docs/config/keybind
- PR discussion (audio-reactive shaders): https://github.com/ghostty-org/ghostty/discussions/10201
- Ghostty shader discussion (community): https://github.com/ghostty-org/ghostty/discussions/2353
- Community shader switcher script: https://github.com/JefStat/ghostty-shaders/blob/a34744b95940216398e92865796739edb6c087f0/shader.sh
- Existing WibWob shader script: `/Users/james/Repos/wibandwob-dos/scripts/ghostty-shader.sh`
- WibWob attach logic: `src/cli/wibwob.ts` (grep `attach`)
- Process manager: `scripts/lib/process-manager.sh`

## Scope

macOS only (AppleScript). No Linux/cross-platform for this spike.
The goal is a proof-of-concept that replaces tmux for the WibWob-DOS
workflow on macOS, using Ghostty as the bare metal.

## Success Criteria

- [ ] osascript can create a Ghostty window, run `bun run start`, and verify `/health`
- [ ] osascript can send input to a running WibWob terminal
- [ ] osascript can focus/switch between multiple WibWob instances (tabs or windows)
- [ ] `wibmux` CLI wrapper that agents can use instead of tmux commands
- [ ] Measured latency comparison: WibMux vs tmux for common operations
- [ ] Cinema pipeline works without tmux (record.sh uses WibMux)

## Stretch Goals — Shader Automation

Ghostty supports custom GLSL shaders in the GPU compositor. WibMux can control them:

- **v1:** `wibmux shader <name>` — hot-swap shader via config rewrite + `perform action "reload_config"`. No restart. Agents set visual mood from CLI.
- **v2:** `wibmux shader --reactive` — audio-reactive shader mode, combined with chiptune pipeline.
- **v3:** WibWob-DOS TUI command `ghostty.shader --name <shader>` — the TUI controls its own container's GPU layer. Cinema pipeline captures shader + text composited via `screencapture`.

See `autoresearch/wibmux/autoresearch.ideas.md` for full details.
