# E047: WibWob-Pi Integration

**Status:** 🟡 in-progress  
**Branch:** `epic/e047-wibwob-pi`  
**Worktree:** `~/Repos/wibwob-pi`  
**GH Issue:** https://github.com/j-greig/wibandwob-dos/issues/129  
**Review:** `.agents/reviews/pi-mono-2026-03-16/`

## Vision

WibWob-DOS as a spatial canvas for pi sessions. Multiple pi coding agents visible
as WibWob windows — viewable, steerable, and coordinatable from a single desktop.
Uses mitsuhiko's `control.ts` Unix socket protocol (no changes to pi required).

## Slices

### Slice 0: `pi-sessions` microapp (MVP)
- [~] S00: Scaffold microapp at `microapps/pi-sessions/`
- [ ] S01: Session discovery — scan `~/.pi/session-control/*.sock`, list live sessions
- [ ] S02: Session connection — Unix socket JSON-RPC client (send/get_message/get_summary/subscribe/abort)
- [ ] S03: Session list window — blessed list showing live sessions with status
- [ ] S04: Session detail window — streaming output from connected session
- [ ] S05: Send message — input box to send prompts to a pi session
- [ ] S06: Turn-end subscription — live updates when pi session completes a turn
- [ ] S07: Command palette entries (open sessions, send message, get summary, abort)

### Slice 1: Command bridge spike (future)
- [ ] S10: Load simple pi extension via jiti into Bun process
- [ ] S11: Wire `pi.registerCommand()` → `host.registerCommand()`
- [ ] S12: Test with notify.ts (88 LOC) and go-to-bed.ts (188 LOC)

### Slice 2: Tool bridge spike (future)
- [ ] S20: Expose pi extension tools to WibWob's agent window
- [ ] S21: TypeBox schema → WibWob agent tool adapter
- [ ] S22: Test with `send_to_session` tool from control.ts

## Key References

- **control.ts protocol:** https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/control.ts
- **Pi extension types:** https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts
- **Pi extension loader:** https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/extensions/loader.ts
- **WibWob microapp scaffold:** `bash scripts/scaffold-microapp.sh`
- **WibWob microapp docs:** `docs/building-custom-microapps.md`

## Architecture

```
WibWob-DOS (blessed TUI, port 8099)
┌────────────────────────────────────────────────┐
│  ┌── Pi Sessions ──────┐  ┌── Session #1 ───┐ │
│  │ ● refactor-auth     │  │ > Refactoring    │ │
│  │ ● write-tests       │  │   auth module... │ │
│  │ ○ old-session       │  │                  │ │
│  │                     │  │ [input box]      │ │
│  └─────────────────────┘  └──────────────────┘ │
│                                                 │
│  ┌── WibWob Agent ─────────────────────────────┐│
│  │ "coordinate both sessions on the API"       ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
       │                         │
       ▼ Unix socket             ▼ Unix socket
  ~/.pi/session-control/    ~/.pi/session-control/
    refactor-auth.sock        write-tests.sock
       │                         │
       ▼                         ▼
  Pi Session 1              Pi Session 2
  (separate terminal)       (separate terminal)
```

## Socket Protocol (from control.ts)

```jsonc
// Send message to session
→ { "type": "send", "message": "refactor auth module", "mode": "steer" }
← { "type": "response", "command": "send", "success": true }

// Get last assistant message
→ { "type": "get_message" }
← { "type": "response", "command": "get_message", "success": true, "data": { "message": "..." } }

// Get AI summary
→ { "type": "get_summary" }
← { "type": "response", "command": "get_summary", "success": true, "data": { "summary": "...", "model": "..." } }

// Subscribe to turn completions
→ { "type": "subscribe", "event": "turn_end" }
← { "type": "event", "event": "turn_end", "data": { ... } }

// Abort current operation
→ { "type": "abort" }

// Clear/rewind session
→ { "type": "clear", "summarize": true }
```

## Non-Goals (this epic)

- No pi-tui → blessed UI bridge (Phase 4, deep impedance mismatch)
- No embedded pi agent core in WibWob (separate processes, connected via sockets)
- No shared settings system (future convergence)
