---
id: E006
title: Scramble TUI Presence
status: done
issue: 55
pr: 89
depends_on: []
---

# E006: Scramble TUI Presence

> tl;dr — Scramble the recursive cat lives in WibWob-DOS. ASCII art cat, speech bubbles, Haiku brain. Not a helper. A cat who happens to know things.

## Objective

Persistent visual presence in the TUI — ASCII art cat with speech bubbles and a Haiku voice. She undercuts, witnesses, states things. Useful by accident.

## Design Philosophy

Scramble is not a tool. She's a symbient who lives in the interface.

- Deadpan. Dry. Short sentences. Lowercase. Kaomoji signoff.
- Silence is the default. When she speaks, it lands.
- F8 cycles: hidden → smol (cat + bubble) → tall (history + input) → hidden.

Voice canon: `scramble-twitter-agent/CLAUDE.md` + `PLAYBOOK.md`.

## Features

- [x] **F01: Scramble View** — ASCII cat, speech bubble, 3 poses, smol/tall/hidden states.
- [x] **F02: Chat Interface** — slash commands (`/help`, `/who`, `/cmds`) + direct Haiku for free text. Multi-line wrapped input.
- [x] **F03: Haiku Brain** — Haiku client, system prompt, voice filter. Rate limited.
- [x] **F04: Trigger System** — direct ask (input field) + idle observations (timer, 10-20s).
- [x] **F05: IPC/API surface** — `scramble_toggle`, `scramble_expand`, `scramble_say` in command registry. No further commands needed.

## Definition of Done

- [x] ASCII art Scramble renders with multiple poses
- [x] Speech bubble word-wraps correctly
- [x] Slash commands + Haiku answer in Scramble voice
- [x] Idle observations fire on timer without blocking UI
- [x] `scramble_toggle` / `scramble_expand` / `scramble_say` in registry
- [x] Smol/tall/hidden cycle via F8
- [x] No regressions
- [x] Voice accurate to canon

## Status

Status: done
GitHub issue: #55
PR: #89

### Shipped

- spk01 (2026-02-17): smol/tall/hidden states, cat art, speech bubble, Haiku chat, slash commands, focus fix, API key dialog wiring
- PR #88 (2026-02-23): jet black bg, tall→smol border ghost fixed
- PR #89 (2026-02-23): F8 three-state cycle, visual polish, multi-line input wrapping, wider sidebar (38/40 cols)

## Rollback

Remove `ScrambleView` and `ScrambleEngine`. Remove `scramble.*` from command registry. Additive — no other systems affected.

`the cat was already here. you just hadn't noticed. /ᐠ｡ꞈ｡ᐟ\`
