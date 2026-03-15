# Ghostty Scripting API — Community Triage Report

**Source:** https://github.com/ghostty-org/ghostty/discussions/2353
**Comments:** 107 (Oct 2023 – Mar 2026)
**Method:** All comments fetched via GitHub API, scored by weighted reactions
(👍+1, ❤️×2, 🚀+1, 👀+1, 🎉+1, 👎×-2, 😕×-1), analysed in parallel.

---

## What the Community Wants (ranked by signal)

### Tier 1 — Strong consensus (15+ pts)

| Score | Use Case | Who | WibMux Relevance |
|------:|----------|-----|-----------------|
| 50 | **Text protocol IPC** (memcached/redis style, debuggable, telnet-friendly) | mitchellh | Foundation: WibMux could be a client of this when it ships |
| 32 | **JSON-RPC over Unix socket** (working prototype with MCP server) | hyperb1iss | Direct precedent: WibMux is exactly this pattern |
| 22 | **Project-specific terminal layouts** (5-tab Rails setup, scripted in 30s) | jnstq | Core WibMux use case: `wibmux create` with layout spec |
| 19 | **CLI-based control** (cross-platform `ghostty` commands) | cryptocode | WibMux wraps this for WibWob; CLI is the right interface |

### Tier 2 — Clear demand (6–14 pts)

| Score | Use Case | Who | WibMux Relevance |
|------:|----------|-----|-----------------|
| 14 | Cross-platform unified API (not per-OS) | adamcstephens | Future: WibMux starts macOS-only, could abstract later |
| 13 | Escape sequences for remote config (SSH colour coding) | RGBCube | Not WibMux scope — needs VT protocol work |
| 12 | Separate concerns: 3 distinct APIs (control, config, query) | pluiedev | Good architecture: WibMux only needs control + query |
| 11 | **Vim dispatch integration** (split from editor, env+cwd+title) | calebhearth | Agent-friendly: same pattern as `wibmux split --command` |
| 9 | **App Intents + AppleScript wrappers** (working macOS prototype) | kkilchrist | Direct precedent: confirms AppleScript approach works |
| 8 | **iTerm-style scripted dev environments** (SSH + splits + commands) | pjv | Exactly what WibMux automates |
| 8 | **Fuzzy tab search** (Hammerspoon → fzf → focus terminal) | dlants | WibMux `list` + `focus` enables this |
| 7 | Native macOS AppleScript as first-class citizen | timvisher | WibMux's foundation |
| 6 | **Smart splits** (neovim ↔ Ghostty split navigation) | honeyspoon | Stretch: WibMux could expose split IDs for editor plugins |
| 6 | Sandbox-safe API (App Store compatible) | aehlke | AppleScript works in sandbox ✅ |
| 6 | Quick terminal mode (separate from main window) | luv2code | `wibmux create --quick` could do this |

### Tier 3 — Niche but interesting (1–5 pts)

| Score | Use Case | WibMux Relevance |
|------:|----------|-----------------|
| 5 | Scrollback buffer access (kitty-scrollback.nvim) | Not needed — WibWob has `/screenshot/ansi` |
| 3 | Persistent terminal session IDs (`TERM_SESSION_ID`) | WibMux labels already solve this |
| 2 | Workspace restoration from YAML config | `wibmux` could read workspace JSON |
| 2 | Execute command + return structured result | `wibmux send` + WibWob API for results |
| 1 | Status bar monitoring (waybar/sketchybar) | WibWob API already exposes state |

---

## Rejected Ideas (downvoted)

| Score | Idea | Why rejected |
|------:|------|-------------|
| -24 | **D-Bus** | "Pretty nasty to script", Linux-only, 12 thumbs down |
| -16 | Just copy what other terminals do (GPL code) | Can't — license incompatible (MIT vs GPL) |
| -10 | Platform-specific APIs (different per OS) | Community wants unified, not fragmented |
| -10 | Just look at existing terminals | Same GPL issue |
| -2 | HTTP/JSON is the only sensible approach | Overengineered for this; text protocol preferred |
| -2 | Reimplement tmux multiplexing in Ghostty | "Waste" — use native splits instead |

---

## Protocol Debate Summary

| Approach | Support | Status |
|----------|---------|--------|
| **Text protocol** (mitchellh's preference) | 50 pts | Planned for cross-platform IPC |
| **JSON-RPC/Unix socket** | 32 pts | Working prototype exists (hyperb1iss) |
| **AppleScript** | 7–9 pts | **Shipped in Ghostty 1.3** (PR #11208) |
| **Apple Shortcuts/Intents** | 9 pts | Already exists (#7634) |
| Escape sequences | 13 pts | **Shelved** — security nightmare (mitchellh) |
| HTTP/JSON | 2 pts | Considered overengineered |
| D-Bus | -24 pts | Rejected |

**mitchellh's stated plan (2025-07):**
1. Platform-specific IPC first (AppleScript ✅, D-Bus planned, Shortcuts ✅)
2. Cross-platform API later via Unix domain sockets
3. Escape sequences shelved pending security design

---

## What This Means for WibMux

### Already achievable with Ghostty 1.3 AppleScript

Everything in our [8 core operations](../../../autoresearch/wibmux/autoresearch.md) is
achievable TODAY with the shipped AppleScript API:

| Operation | AppleScript command | Community validation |
|-----------|-------------------|---------------------|
| create | `new window` with config | 22 pts (project layouts) |
| list | Query `windows`/`terminals` | 8 pts (fuzzy tab search) |
| focus | `focus`/`activate window` | 8 pts (terminal switching) |
| send | `input text`/`send key` | 11 pts (vim dispatch) |
| split | `split` with direction | 6 pts (smart splits) |
| read | WibWob API (not AppleScript) | Already solved |
| attach | `activate window` + WibWob `attach` | Already solved |
| close | `close`/`close window` | Trivial |

### Unique WibMux advantages the community doesn't have

1. **WibWob API layer** — we don't need terminal content reading (the #1 security
   blocker for everyone else). WibWob exposes state via HTTP.
2. **Instance lifecycle** — `wibwob attach` already handles orphan detection,
   workspace save/restore, PID management. Nobody else has this.
3. **Agent-friendly** — the 32-pt JSON-RPC prototype is exactly what agents want.
   WibMux + WibWob API = agent control surface without waiting for Ghostty IPC.
4. **Shader control** — nobody else is automating Ghostty shaders. We have 11
   shaders and a hot-swap script. `wibmux shader` is unique.

### What to watch for

- **Unix socket IPC** — when Ghostty ships this (text protocol), WibMux should
  adopt it as transport and drop AppleScript dependency. Keeps us cross-platform ready.
- **`perform action` expansion** — mitchellh may expose more actions. Track new
  Ghostty releases for additions to the SDEF.
- **Security model** — if Ghostty adds auth tokens for IPC, WibMux needs to handle them.

---

## References

- Discussion: https://github.com/ghostty-org/ghostty/discussions/2353
- AppleScript PR: https://github.com/ghostty-org/ghostty/pull/11208
- hyperb1iss IPC prototype: referenced in discussion (32 pts)
- kkilchrist App Intents fork: referenced in discussion (9 pts)
- Community shader discussion: https://github.com/ghostty-org/ghostty/discussions/2353
- Raw data: `scratch/wibmux-research/all-comments-scored.md`
