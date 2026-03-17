---
name: signls
description: >
  Manage the signls generative MIDI sequencer. Install, launch in tmux,
  stop, check status, and inspect bank files. Use when composing generative
  MIDI sequences, launching the sequencer, managing bank files, or any task
  involving signls.
---

# Signls — Generative MIDI Sequencer

[signls](https://github.com/emprcl/signls) is a non-linear, node-based
generative MIDI sequencer (Go/Bubbletea TUI).

## Quick Reference

Use the `signls` tool (registered by `.pi/extensions/signls/index.ts`):

| Action    | Description                              |
|-----------|------------------------------------------|
| `install` | Download binary from GitHub Releases     |
| `launch`  | Start in tmux session (auto-installs)    |
| `stop`    | Graceful shutdown (Ctrl+Q then kill)     |
| `attach`  | Print `tmux attach` command              |
| `status`  | Show installed/running/bank files        |
| `inspect` | Read a bank file, summarize grids        |

Optional `bank` parameter selects a bank file (default: `default.json`).
Banks resolve from `vendor/signls/banks/`.

## Typical Workflow

1. `signls { action: "launch" }` — starts in tmux
2. User interacts with TUI directly (`tmux attach -t signls`)
3. Place nodes (1–9), set directions (ctrl+arrows), press space to play
4. `signls { action: "inspect" }` — check grid state from pi
5. `signls { action: "stop" }` — graceful shutdown

## Bank Files

- Location: `vendor/signls/banks/*.json`
- Each bank has 32 grids with tempo, key, scale, node placements
- Grid state auto-saves when switching grids or quitting

## MIDI Output

signls creates a virtual MIDI output ("Signls Default Midi Output").
Connect a DAW or software synth to hear output.

## Slash Command

`/signls launch` — also available as `/signls [install|stop|status|attach]`

## Key Bindings (inside signls TUI)

| Key           | Action                |
|---------------|-----------------------|
| `space`       | Play / Stop           |
| `1`–`9`       | Add node types        |
| `enter`       | Edit selected node    |
| `ctrl+arrows` | Set node direction    |
| `tab`         | Show bank selector    |
| `-` / `=`     | Tempo down / up       |
| `m`           | Toggle mute           |
| `ctrl+q`      | Quit                  |
