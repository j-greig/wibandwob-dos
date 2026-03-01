# Wib&Wob Chat v2 Plan

Canonical plan file for the native Pi SDK chat slice.

Notes:
- this is the single source of truth for this feature pass
- do not maintain a duplicate JSON tracker in parallel
- keep this slice native to the blessed desktop, not PTY-hosted

Goal: replace the user-facing `Pi Chat` terminal surface with a native `Wib&Wob Chat` window that streams one assistant message in place and exposes its state through the existing desktop/control substrate.

Rules for this pass:
- use `pi-agent-core`, not the nested interactive Pi terminal UI
- keep the new surface under existing `chat` window kind unless a new kind is strictly required
- every visible command/state in the window must have state/control parity
- keep user chat free of internal coding/task-loop protocols

## Slice 1

- [x] Add a dedicated `Wib&Wob Chat` v2 tracker and keep it canonical
- [x] Implement a `pi-agent-core`-backed chat session service with structured streaming state
- [x] Build a native blessed `Wib&Wob Chat` window with:
  - [x] transcript panel
  - [x] input box
  - [x] in-place streaming assistant updates
- [x] Wire menu/palette/context-menu/control-api entry points
- [x] Ensure desktop state and workspace payloads identify the new chat surface
- [x] Run `bun run typecheck`
- [x] Run an API-driven smoke pass and export a text capture

## Success bar

- opening `Wib&Wob Chat` never launches the Pi terminal UI
- one user submit creates one user message and one streaming assistant message
- assistant streaming updates happen in place instead of appending duplicate partials
- the chat window shows only transcript/input UI, not internal coding/task-loop state
- the window can be opened through the control API and inspected through `/state`

## Evidence

- `bun run typecheck`
- control/API parity loop:
  - `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scripts/window-state-parity-loop.sh`
- native chat smoke loop:
  - `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scripts/wibwob-chat-v2-smoke.sh`
- latest native chat tmux capture:
  - `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/captures/wibwob-chat-v2-smoke-pane.txt`
- latest native chat text export:
  - `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/captures/2026-02-28T22-17-10.683Z_wibwob-chat-v2-smoke.txt`
