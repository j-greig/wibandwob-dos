# S13: AI Browser Actions (Summarise, Extract, Clip)

## Parent

- Epic: `e002-browser-and-state-export`
- Feature: `f04-ai-browser-tools`
- Feature brief: `.planning/epics/e002-browser-and-state-export/f04-ai-browser-tools/f04-feature-brief.md`

## Objective

Add higher-level AI browser actions for summarisation, link extraction, and page clipping to markdown.

## Tasks

- [x] Implement `browser.summarise` action with `new_window|clipboard|file` targets
- [x] Implement `browser.extract_links` with filter support
- [x] Implement `browser.clip` output path with markdown payload
- [x] Add contract tests for action behavior and file output

## Acceptance Criteria

- [x] **AC-1:** AI can create a summary artifact from current page
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_browser_actions.py -q`
- [x] **AC-2:** AI can extract links and clip content to markdown file path
  - Test: `uv run --with pytest --with fastapi pytest tests/contract/test_mcp_browser_actions.py -q`

## Rollback

- Revert AI action tool registration and adapters.

## Status

Status: `done`
GitHub issue: #20
PR: —

