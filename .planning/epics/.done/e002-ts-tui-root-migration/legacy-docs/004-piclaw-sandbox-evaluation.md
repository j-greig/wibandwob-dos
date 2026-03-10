# Piclaw Sandbox Evaluation

`piclaw` is now vendored at [piclaw](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/piclaw).

## Why it matters

`piclaw` is not a terminal UI library and not a drop-in chat window.

It is useful because it shows a credible way to run `pi` in a more isolated, operationally sane environment:

- Docker-based Debian sandbox
- Bun + pi preinstalled
- persistent workspace and config volumes
- pooled `AgentSession` instances
- model control tools
- task scheduling
- web and WhatsApp routing

For this spike, the relevant value is not WhatsApp or the web UI.  
The relevant value is the architecture around:

- agent session pooling
- isolation
- persistent agent home + workspace split
- typed control surfaces around pi

## What looks reusable in spirit

These parts are worth studying if the TS spike grows a real Wib&Wob chat/runtime layer:

- [agent-pool.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/piclaw/piclaw/src/agent-pool.ts)
  - warm `AgentSession` reuse instead of cold-starting a fresh agent every prompt
- [agent-control.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/piclaw/piclaw/src/agent-control.ts)
  - typed model/thinking/session control commands
- [runtime.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/piclaw/piclaw/src/runtime.ts)
  - service startup orchestration
- [config.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/piclaw/piclaw/src/config.ts)
  - explicit env/config layering

## What is not the right fit

Do not mistake `piclaw` for a windowing or rendering solution.

It does not solve:

- our blessed desktop shell
- overlapping windows
- terminal pane rendering quality
- workspace restore inside the TUI
- typed desktop-state integration

So it should influence service/runtime design, not screen architecture.

## Best use for the spike

If we keep pursuing `pi` inside the TS TUI, `piclaw` suggests a good long-term shape:

1. keep the TUI app as the renderer and window manager
2. wrap pi behind a single service seam
3. optionally isolate that seam later in Docker or a helper process
4. reuse session pooling and model-control ideas instead of inventing our own ad hoc agent runtime

## Recommendation

Short version:

- good vendor to study
- useful for sandboxing and runtime architecture
- not a direct UI integration path

If we later want a safer `Wib&Wob Chat` runtime, `piclaw` is a better reference for isolation and agent pooling than the current C++ API/MCP bridge stack.
