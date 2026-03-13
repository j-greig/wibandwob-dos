---
id: e037
title: LLM-Orch CLI Studio for WibWob-DOS
status: in-progress
priority: high
depends: [e036]
---

# E037 — LLM-Orch CLI Studio

## Context

We want a WibWob-DOS-native orchestration surface inspired by Symbients/llm-orchestrator.
The source orchestration engine is external and Rust-based, but this epic is explicitly
for the CLI workflow (`cargo run ...`) with Claude Code auth (`provider = "cc"`).

The in-app goal is not to clone Tauri/React; it is to expose the same orchestration
value inside our terminal desktop with canonical SDK UI parts.

## Goal

Ship a microapp that can run llm-orchestrator CLI conversations where:
- Wib agent runs `cc:haiku`
- Wob agent runs `cc:sonnet`
- both produce compact ASCII art in turns while discussing a chosen topic

The microapp must show:
- live conversation turns panel
- orchestration/step stream panel
- settings/runtime panel (topic, models, command/config paths, status)

## Feature checklist

- [x] F01 scaffold and branch/worktree setup
- [x] F02 create initial planning brief under `.planning/epics/e037-*`
- [x] F03 implement module shell and SDK layout panels
- [x] F04 wire CLI run/stop process lifecycle + run artifact generation
- [x] F05 parse stream into conversation turns + orchestration panel
- [~] F06 add persistence/history controls and improved parsing robustness
- [ ] F07 add smoke script for deterministic CLI integration checks
- [ ] F08 polish UX, docs, and closeout

## Acceptance criteria

AC-1: A user can open `LLM Orch Studio` from Applications and start a CLI run.
Test: Open app, click Run CLI Show, observe status change idle → running.

AC-2: Run files are generated with `cc` models (`haiku`, `sonnet`) and topic.
Test: Inspect `scratch/llm-orch-runs/<run>/actors/*.toml` and `conversation.toml`.

AC-3: Conversation panel receives and displays parsed Talk turns.
Test: During run, panel shows `Wib:`/`Wob:` entries from stream.

AC-4: Steps panel shows raw stream and step-related diagnostics.
Test: During run, panel accumulates output lines with step metadata.

AC-5: Stop action terminates child process and updates state.
Test: Start run, press Stop, verify status moves to `stopped` and PID clears.

AC-6: Minimum quality gate passes.
Test: `bun run typecheck` exits 0.

## Out of scope for initial slice

- Running or embedding Tauri/React GUI
- Cloud history sync
- Full parity with all llm-orchestrator GUI editors
- Multi-run timeline playback/replay engine
