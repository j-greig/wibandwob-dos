## F03 — Registry + Menu Wiring

Status: not-started
GitHub issue: #103
PR: —

### Summary

Wire the Backrooms TV window into the standard WibWob-DOS command surface: command constant, registry capability, View menu entry, `handleEvent` dispatch, and factory function. Follows `ww-scaffold-view` skill procedure.

### Parity Scope

`ui+registry` for v1. Full parity (IPC/REST/MCP) in a follow-on once the view is stable.

### Stories

- [ ] **S09**: Allocate `cmBackroomsTv` command ID (next free after 283)
- [ ] **S10**: Add `open_backrooms_tv` to `command_registry.cpp` capabilities + dispatch
- [ ] **S11**: Add View > Generative > Backrooms TV menu item in `wwdos_app.cpp`
- [ ] **S12**: Factory function `createBackroomsTvWindow(const TRect &bounds)`

### Acceptance Criteria

AC-F03-1: `open_backrooms_tv` appears in `GET /capabilities` response.
Test: `curl /capabilities | jq '.[] | select(.name == "open_backrooms_tv")'` returns entry.

AC-F03-2: Menu item opens the window.
Test: Screenshot after menu selection shows Backrooms TV window.

AC-F03-3: Command registry dispatch opens window via IPC.
Test: `curl -X POST /menu/command -d '{"command":"open_backrooms_tv"}'` returns success, `/state` shows window.
