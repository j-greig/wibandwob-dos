# S12: MCP Browser Modes and Low-Level APIs

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f04-ai-browser-tools`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f04-ai-browser-tools/f04-feature-brief.md`

## Objective

Expose browser mode controls and low-level fetch/render primitives through MCP for agent-controlled workflows.

## Tasks

- [x] Register MCP tools: `browser.set_mode`, `browser.fetch`, `browser.render`, `browser.get_content`
- [x] Route each tool to existing API/IPC command paths
- [x] Add tests for mode persistence and content retrieval behavior
- [x] Validate response schema and error handling

## Acceptance Criteria

- [x] **AC-1:** AI can change heading/image render modes and observe state updates
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_browser_modes.py -q`
- [x] **AC-2:** AI can fetch/render/read content via low-level tools
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_browser_modes.py -q`

## Rollback

- Revert MCP mode/fetch/render/get_content tool adapters.

## Status

Status: `done`
GitHub issue: #20
PR: —

