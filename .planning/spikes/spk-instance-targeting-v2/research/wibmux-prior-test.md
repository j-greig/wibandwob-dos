# WibMux Prior Test — Ghostty-native session management

> Source: 3 commits on main (4fb343d, 7225368, 835a615)
> File: `autoresearch/wibmux/wibmux.sh` (~900 lines bash)
> Status: prototype, worked on macOS, not integrated into main CLI

## What WibMux is

A bash script (`wmux`) that wraps Ghostty's AppleScript API to provide
tmux-like session management using native Ghostty windows, tabs, and splits
instead of a PTY multiplexer.

## Commands (10/10 core + stretch)

| Command | What |
|---------|------|
| `wmux create [--label X]` | New Ghostty window with optional label |
| `wmux list` / `wmux ls` | List tracked windows with labels |
| `wmux focus <label>` | Bring window to front |
| `wmux attach <label>` | Focus + verify alive |
| `wmux close <label>` | Close window, clean tracking |
| `wmux send <label> "text"` | Type text into window |
| `wmux read <label>` | Read terminal content (via WibWob HTTP API) |
| `wmux layout <name>` | Apply JSON layout (tabs + initial commands) |
| `wmux shader <name>` | Hot-swap Ghostty shader config |
| `wmux split [dir]` | Native Ghostty pane split |
| `wmux inspect [id]` | Window → tab → terminal → cwd tree |
| `wmux 0` / `wmux 1` | Switch by index (like tmux Ctrl-b+N) |
| `wmux bar on/off` | Status bar attempt (see below) |

## Instance tracking

Labels are tracked via files in `scratch/.wibmux/<label>.id` containing
the Ghostty window ID. Resolution: check tracking file first, fall back
to window title match. Dead windows detected and cleaned on access.

**This is the same pattern as WibWob-DOS socket files** —
filesystem IS the registry, names are the addresses.

## Status bar R&D — 4 approaches tried

| Approach | Result |
|----------|--------|
| ANSI scroll region | Shell prompt overwrites it — we don't own the PTY |
| Ghostty split as bar | Works (1-row pane confirmed) but has shell chrome noise |
| PTY proxy binary | Correct approach but ~1-2K lines of systems code |
| Native macOS app (cmux model) | Most capable but it is building a new terminal |

**Conclusion:** "The bar is a PTY-ownership problem, not a rendering problem."
Ghostty's native tab bar is the practical status bar.

## Relevance to instance targeting

### Same problems, same solutions

WibMux tackles EXACTLY the same discovery + targeting problem as WibWob-DOS
instances, but for Ghostty windows instead of WibWob-DOS processes:

| WibMux | WibWob-DOS | Same pattern |
|--------|-----------|--------------|
| `scratch/.wibmux/<label>.id` | `scratch/instances/<label>.sock` | Filesystem registry |
| `wmux focus <label>` | `wibwob --instance <label>` | Name-based targeting |
| `wmux list` | `wibwob instances` | Discovery via scan |
| Dead ID cleanup on access | Dead socket cleanup | Probe-and-clean |
| `wmux read` via HTTP API | `wibwob read` via HTTP/socket | Transport abstraction |

### Key insight from wibmux

WibMux already proved that **label-based tracking via filesystem** works
reliably for session management. The same model scales to WibWob-DOS
instances — and potentially to remote VPS instances if the registry
becomes network-accessible.

### The `read` problem

WibMux cannot read terminal content natively (Ghostty blocks this for
security). It falls back to the WibWob HTTP API (`/screenshot/text`).
This means wibmux ALREADY depends on the WibWob control API for inspection,
making it a natural integration point rather than a separate tool.

## Recommendations for spk-instance-targeting-v2

1. **Unify the patterns.** WibMux's `scratch/.wibmux/` and WibWob's
   `scratch/instances/` are the same idea. Could share a registry abstraction.

2. **The name IS the address.** Both systems proved this. `wmux focus main`
   and `wibwob @main health` should feel like the same gesture.

3. **Probe-and-clean is correct.** Both systems check if the tracked entity
   is still alive before trusting the registry file. This is the right model
   for crash-resilient discovery.

4. **Don't build a PTY proxy.** WibMux's status bar R&D showed this is a
   rabbit hole. Use native terminal features (tabs, title bar) for status.
   The WibWob control API is the inspection surface.
