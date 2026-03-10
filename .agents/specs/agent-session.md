---
subsystem: agent-session
covers: WibWobAgentSession, jailed coding tools, agent window rendering, ScrambleBrain, Scramble window
files:
  - src/services/wibwob-agent-session.ts
  - src/services/agent-tools.ts
  - src/services/scramble-brain.ts
  - src/windows/wibwob-agent-window.ts
  - src/windows/scramble-window.ts
  - src/core/config.ts (REPO_ROOT, SPIKE_PI_DIR)
triggers:
  pre-change: jailed tool paths, model selection, context injection, Scramble states
  post-change: send a message in agent chat, verify tool calls are jailed, check Scramble responds
---

## Overview

WibWobAgentSession owns the in-process Wib&Wob LLM agent: model selection, system prompt loading,
7 jailed coding tools scoped to REPO_ROOT, TUI desktop tools (tui_*), and desktop state injection
via transformContext. ScrambleBrain is a separate lighter agent powering Scramble the cat — simpler
model, no coding tools, shares the same window manager. Both run inside the same Bun event loop.

## Key Files

- src/services/wibwob-agent-session.ts — full agent: model, tools, context injection, pi-session bridge
- src/services/agent-tools.ts — tui_* tool implementations; createTuiTools(), formatDesktopSummary()
- src/services/scramble-brain.ts — ScrambleBrain: lighter agent, Scramble-specific prompts, states
- src/windows/wibwob-agent-window.ts — agent window factory; renders tool calls with wibwob-tv palette
- src/windows/scramble-window.ts — Scramble UI: smol popup (3-state) + floating window
- src/core/config.ts — REPO_ROOT (jail root), SPIKE_PI_DIR, SPIKE_PI_APPEND_SYSTEM_PATH

## Agent Session Architecture

Model selection: wibwob-agent-session.ts resolves from config/env. Claude Sonnet is default;
haiku for lightweight turns; opus for deep reasoning. Model can be changed via settings.

System prompt: loaded from SPIKE_PI_DIR at session start. SPIKE_PI_APPEND_SYSTEM_PATH appends
additional context. The AGENTS.md system prompt includes the full Wib&Wob persona, desktop
context, and tool documentation.

Context injection (transformContext): before every LLM turn, formatDesktopSummary(state) is
prepended to the user message as a [DESKTOP STATE] block. This gives the agent current window
IDs, focus, and open apps without explicit state calls on every turn.

Session persistence: sessions are tracked via pi-session bridge (pi-session-bridge.ts).
Session ID is available at /health?sessionId. Previous session history can be loaded on resume.

## Jailed Coding Tools (7 tools)

All scoped to REPO_ROOT (src/core/config.ts). Path jail enforced by jailPath() —
any path that resolves outside REPO_ROOT throws "Path escapes workspace".

  read   — read file contents (offset/limit supported); jail: REPO_ROOT
  write  — write file (creates dirs); jail: REPO_ROOT
  edit   — find+replace in file; jail: REPO_ROOT
  bash   — execute shell command; cwd forced to REPO_ROOT or subdirectory of it
  grep   — regex search in files; jail: REPO_ROOT
  find   — find files by pattern; jail: REPO_ROOT
  ls     — list directory; jail: REPO_ROOT

Agents CANNOT: read files outside REPO_ROOT, write outside REPO_ROOT, run
bash with cwd outside REPO_ROOT. ~ expansion is handled but jailed.

REPO_ROOT is the absolute path to the wibandwob-dos repo root (src/core/config.ts).
In a worktree it resolves to the worktree root, not the main repo.

## TUI Desktop Tools

Available alongside coding tools. Source: src/services/agent-tools.ts.
These are the tui_* tools listed in state-and-api.md. Key ones:

  tui_get_state       — always call first for real window IDs
  tui_list_commands   — discover commands before running
  tui_menu_command    — execute any registered command by id
  tui_move_window     — move/resize by id (use left/top, not x/y)
  tui_send_input      — type into a window's input field
  tui_screenshot      — text screenshot for visual verification

## Scramble

ScrambleBrain (src/services/scramble-brain.ts) — lighter agent:
  Model: haiku by default (cheaper, faster)
  No coding tools — only TUI tools for desktop interaction
  States: ready | thinking | error | offline | sleeping
  Protection: Scramble's window is NEVER closed by clearDesktop() or close-all commands

Scramble window has TWO entry points (scramble-window.ts:1):
  openScrambleSmolPopup      — 3-state clippy: smol → tall → pop-out (default on boot)
  openScrambleFloatingWindow — full floating window (like agent window)

Smol popup states:
  smol  — 3-line cat art only (bottom-right, ~14 wide)
  tall  — expanded to show conversation transcript
  pop-out — converts to full floating window, smol popup is destroyed

Scramble commands (all via control API or command catalog):
  scramble.say   — POST /scramble/say { text }
  scramble.pet   — makes Scramble happy
  scramble.sleep — sets sleeping=true, responds to no messages
  scramble.wake  — sets sleeping=false
  scramble.meow  — Scramble makes a noise
  scramble.expand — toggle smol/tall
  scramble.pop_out — promote to floating window

Cat art states (scramble-window.ts:24):
  default  — ( o.o ) — /\_/\
  curious  — ( o.O ) — thinking
  sleeping — ( -.- ) — sleeping=true

Protection rule: Scramble's WindowRecord has a special flag checked by clearDesktop() and
close-all timeline cues. NEVER set kind="scramble" on any other window.

## Invariants

1. jailPath() is the gate — all file/bash ops go through it; never bypass it
2. Agent window (appType "wibwob-agent") is singleton — only one open at a time (focusOrCreate)
3. Scramble is NOT closed by clearDesktop() — it is protected by kind check
4. transformContext fires before every LLM turn — desktop state is always current
5. ScrambleBrain has no coding tools — it cannot read/write files
6. session.send() is async — tool results arrive via async events, not return values
7. Model names must match those registered in ModelRegistry — invalid names cause silent fallback

## Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Path escapes workspace" error in tool | Agent tried to read/write outside REPO_ROOT | Check path; jailPath is working correctly — agent must use relative paths or REPO_ROOT-relative absolute paths |
| Agent has no desktop context | transformContext not firing | Check wibwob-agent-session.ts transformContext wiring; formatDesktopSummary must receive live DesktopState |
| Agent opens second agent window | focusOrCreate not used | app-controller.ts:364 uses focusOrCreate — check wiring |
| Scramble not responding | sleeping=true or status=offline | POST /scramble/wake first; check /scramble/state |
| Scramble closed by clear-all | kind check missing in clearDesktop | clearDesktop must skip windows with kind="scramble" |
| Tool calls not showing in agent window | formatToolCall not covering new tool name | Add case to formatToolCall() in wibwob-agent-session.ts:112 |
| Wrong model used | Model string not in ModelRegistry | Check model ID; use exact registered name |
| Session history lost | pi-session-bridge not resuming | Check SPIKE_PI_DIR path; session files are in scratch/pi-sessions/ |

## Do / Don't

DO: always call tui_get_state first before any window operation in agent tools
DON'T: hardcode window IDs in agent prompts or session context

DO: use formatDesktopSummary to give agents a compact state summary
DON'T: dump the full DesktopState JSON into context — it is too large

DO: keep Scramble's model as haiku — it is lightweight by design
DON'T: give Scramble the full coding tool suite — it is not a code editor

DO: add new tool display cases to formatToolCall() when adding tui_* tools
DON'T: leave new tools with default JSON display — it clutters the transcript

DO: check /scramble/state before sending; handle sleeping state gracefully
DON'T: assume Scramble is always ready — it may be sleeping or thinking

DO: keep jailed tools jailed — any bypass defeats the safety model
DON'T: add an unjailed bash or read tool for "convenience"

## Change Checklist

When adding a new tui_* tool:
- [ ] Implement in agent-tools.ts createTuiTools()
- [ ] Add display case to formatToolCall() in wibwob-agent-session.ts
- [ ] Update tui_list_commands to include it
- [ ] Document in state-and-api.md Agent Tools section
- [ ] Test: send agent a message that triggers the new tool

When changing jailed tool behaviour:
- [ ] Test path escaping: try ../../../etc/passwd — must throw
- [ ] Test valid REPO_ROOT path: must succeed
- [ ] bun run typecheck passes

When changing Scramble:
- [ ] Verify clearDesktop still skips kind="scramble"
- [ ] Test all 3 smol states (smol → tall → pop-out)
- [ ] Test pop-out then close: smol popup should NOT re-open automatically
- [ ] Verify /scramble/state returns correct fields after changes
