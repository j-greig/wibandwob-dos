---
date: 2026-03-09
session: glitchbox smoke testing + scroll fix + gen art
branches:
  main: 7a91074
  epic: epic/e027-glitchbox-tui (worktree ~/Repos/wibwob-glitchbox)
---

# Handover — 2026-03-09 GlitchBox Smoke + E025 Scroll Fix

## Quickstart prompt for next agent

We are building WibWob-DOS — a TypeScript/Bun terminal desktop (blessed TUI).

This session focused on two things: fixing the §y² Chronicles scroll bug and smoke-testing GlitchBox.

### What to resume

**1. GlitchBox smoke testing** — the main unfinished task.

Start the app:
```bash
cd ~/Repos/wibwob-glitchbox
lsof -ti:8098 | xargs kill -9 2>/dev/null; tmux kill-session -t glitchbox 2>/dev/null; sleep 1
tmux new-session -d -s glitchbox -x 220 -y 60 "cd ~/Repos/wibwob-glitchbox && CONTROL_API_PORT=8098 bun run start"
sleep 12 && curl -sf http://127.0.0.1:8098/health
```

Open GlitchBox + agent, tell agent to dance:
```bash
curl -s -X POST http://127.0.0.1:8098/commands/run -H 'Content-Type: application/json' -d '{"id":"microapp.wibwob.glitchbox.glitchbox.open"}'
curl -s -X POST http://127.0.0.1:8098/commands/run -H 'Content-Type: application/json' -d '{"id":"agent.open"}'
# Then send input to agent window (check window ID via /state first):
curl -s -X POST http://127.0.0.1:8098/windows/input -H 'Content-Type: application/json' -d '{"id":2,"input":"dance in glitchbox\r"}'
```

**2. Known issues to fix/verify:**

- **Haiku tick fights agent**: The autonomous haiku tick (60s interval, 15s cooldown) will override whatever the agent just set after 15s of inactivity. Consider: increasing cooldown to 60s, or disabling haiku tick while agent is actively using glitchbox commands, or making haiku tick respect a "last agent action" timestamp separate from "last user action".

- **Gen art background too faint**: `glitchbox.gen` toggles it on but the cellular automata is sparse. It scales with energy now (higher energy = more sparks) but at low energy it's nearly invisible. May need brighter char palette or denser seeding.

- **No legs visible on stick figure**: User reported this. Leg landmarks exist in all presets (25-28). Legs may be rendering below the visible area if dancer y-position is too high, or the lines are too faint against the field background. Needs visual verification.

- **Agent chat tool result spam**: Partially fixed — tool results now truncated to 60 chars and microapp prefixes stripped. But consecutive tool calls still take 1 line each and can fill the chat window. Consider: collapsing N consecutive tool calls into "✓ N commands run" summary, or hiding tool results entirely for tui_run_command.

- **`g` key doesn't toggle gen art**: The key binding is registered but doesn't fire. `/windows/input` with `"g"` and `tmux send-keys` both failed. The `glitchbox.gen` API command works. May be a blessed key focus issue — the `root.key` handler might not be receiving keystrokes when the button bars have focus.

### What was done this session

**E025 scroll fix (DONE)**:
- Root cause: blessed `_getCoords()` double-subtracts `childBase` for grandchildren of scrollable boxes
- Fix: `fixed: true` on all grandchild nodes (titleBar, content, editor, grip)
- Added `sy2.panel.inspect` command for programmatic verification
- Fixed `direct: true` on all sy2 panel commands (focusOrCreate was swallowing return values)
- Verified: 62/62 panels render with content at all scroll positions

**E027 GlitchBox (15/15 ACs DONE, but needs smoke testing)**:
- `/dance` slash command in Wib&Wob agent chat and Scramble chat
- Haiku autonomous tick (60s, pi agent-core Agent, 15s user cooldown)
- Fixed animation tick missing `host.screen.render()`
- Fixed infinite loop crash: `glitchbox.move` missing `from:0, to:1` in tween call → NaN coords → drawLine while(true) never breaks
- Added NaN guard + maxIter cap in skeleton-renderer drawLine
- Added generative art background (cellular automata, `g` key / GEN button / `glitchbox.gen` command)
- Agent chat tool result truncation + prefix stripping

### Key files

| File | What |
|------|------|
| `modules/glitchbox/index.ts` | Main module — dancer, field, gen art, haiku tick, commands |
| `src/core/skeleton-renderer.ts` | `renderSkeletonAt()`, pose presets, drawLine with NaN guard |
| `src/windows/wibwob-agent-render.ts` | Agent chat transcript renderer — tool result formatting |
| `src/services/motion-service.ts` | `tween()` with finite guard on from/to |
| `src/windows/agent-slash-commands.ts` | `/dance` slash command |
| `src/services/scramble-brain.ts` | Scramble's `/dance` handler |
| `modules/sy2-chronicles/index.ts` | §y² Chronicles — `fixed:true` scroll fix, panel inspect |

### Ports / sessions

| What | Port | tmux session |
|------|------|-------------|
| Main app (other worktree) | 8099 | wibwob (attached, NOT running currently) |
| GlitchBox worktree | 8098 | glitchbox (killed, needs restart) |

### Agentic devlog

Updated at `.planning/spikes/spk-agentic-tui-runtime-roadmap/agentic-devlog.md` with:
- blessed fixed:true scroll pattern (must be in SDK docs)
- sy2.panel.inspect tooling pattern
- focusOrCreate swallowing return values (direct:true requirement)
- worktree setup friction
