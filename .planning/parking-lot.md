# Parking Lot (Non-Epic Follow-Ons)

Use this register for bonus/off-cuff items that are valid `task` or `spike` issues but do not yet warrant a full epic/feature/story tree.

## Status Header
Status: `in-progress`
GitHub issue: —
PR: —

## Active Items
- `spike` — Pi-in-tvterm as agentic hands for W&W: rather than inter-instance chat, run a Pi/Claude agent inside a tvterm window, give it access to the WibWob API, and let it operate the DOS autonomously — spawning windows, painting canvases, calling MCP tools — as a "body" layer separate from the W&W chat "voice" layer; Pi inter-instance protocol is a poor fit for symbient identity but a natural fit for task handoff between agents sharing a session
- `task` — E014 follow-on: W&W are instance-locked — each pair has independent context and treats relayed messages as external input not "other self"; true cross-instance identity would require shared prompt/memory layer; shelved until heartbeat/world-registry epic
- `task` — E014 follow-on: no `/broadcast` endpoint — seeding multiple instances with the same prompt requires N separate API calls; add `POST /broadcast` or broker `--seed-prompt` param
- `task` — 4-pane monitor chat log pane does not follow new log files after app restart (tails the log that existed at monitor launch); fix the self-refreshing bash loop in `monitor.sh`
- `task` — `capabilities` response returns bare command names with no descriptions; agents must guess from name alone — add description field to capabilities JSON

## Completed Items
- [x] `fix` #94 — scramble jet-black bg + tall→smol resize fix (merged 2026-02-24)
- [x] `epic` E014 #92 — inter-instance group chat: `get_chat_history`, broker, TTS voice fallback, 4-pane monitor (merged 2026-02-24)
- [x] `epic` E012 #93 — app modularisation phase 1: json_utils, ui_helpers, frame_animation_window, paint_wwp_codec extracted (merged 2026-02-24)
- [x] `task` #36 — always-on Codex<>Claude mailbox daemon with unread notifications
- [x] `task` #38 — promoted to dedicated planning track `e003-dark-pastel-theme`
- [x] `task` #35 — browser copy API route
- [x] `task` #33 — screenshot reliability

## Notes
- Parent epics/features remain source-context for linked follow-ons, but this file is the global queue for bonus work.
- Keep entries short; detailed AC/Test content belongs in issue body and/or promoted briefs.
