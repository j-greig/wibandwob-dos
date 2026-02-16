# S11: MCP Browser Core Tools

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f04-ai-browser-tools`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f04-ai-browser-tools/f04-feature-brief.md`

## Objective

Expose core browser navigation operations via MCP with parity to human keyboard workflows.

## Tasks

- [x] Register MCP tools: `browser.open`, `browser.back`, `browser.forward`, `browser.refresh`, `browser.find`
- [x] Wire tools through canonical command dispatch with `actor="ai"`
- [x] Add contract tests for tool argument validation and successful execution
- [x] Add parity checks against existing browser command surface

## Acceptance Criteria

- [x] **AC-1:** AI can open and navigate browser pages via MCP core tools
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_browser_core.py -q`
- [x] **AC-2:** MCP calls are actor-attributed and visible in command/event outputs
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_browser_core.py -q`

## Rollback

- Revert MCP core tool registration and dispatch adapters.

## Status

Status: `done`
GitHub issue: #20
PR: —

