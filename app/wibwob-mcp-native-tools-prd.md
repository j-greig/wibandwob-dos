# PRD: Native Agent SDK Tools for Wib&Wob (API + MCP Integration)

## Context & Problem
- Today the TUI exposes tools via MCP (FastAPI at `/tools/api_server`, `mcp_tools.py`), wired into the Agent SDK bridge as an in-proc MCP server. It “works ok-ish” but is brittle and doesn’t use the Agent SDK’s native custom tools interface.
- Agent SDK custom tools (https://platform.claude.com/docs/en/agent-sdk/custom-tools.md) allow declaring tools directly in the SDK call, with streaming input required when MCP servers are present.
- Goal: expose existing API capabilities as native Agent SDK tools, preserving the current MCP functionality but with less fragility and better alignment to the SDK model.

## Goals
- Register core TUI/API capabilities as native Agent SDK tools (no in-proc MCP server dependency).
- Support streaming input mode (async iterable prompt) as required when MCP servers/custom tools are used.
- Keep tool behavior aligned with existing API server semantics.
- Maintain compatibility with current menu/UI flows and logging.

## Non-Goals
- Full rewrite of the FastAPI server.
- Expanding tool surface beyond current API/MCP coverage in this iteration.
- Changing Claude/LLM behavior outside tool invocation wiring.

## Users
- TUI operators issuing MCP-driven commands (window control, text injection, state queries).
- Developers wanting more stable tool plumbing and clearer SDK alignment.

## Requirements
1) Custom tools: define Agent SDK `tool()` entries for the current TUI actions (create/move/close/tile/cascade windows, send text/figlet, get state).  
2) Transport: tools call the existing API server at `http://127.0.0.1:8089` (as today) unless superseded by a native invocation path.  
3) Streaming input: switch bridge prompt handling to async generator when tools/MCP are enabled (no plain string prompt).  
4) Allowed tools: explicitly set `tools` / `allowedTools` to the native tool set; avoid duplication and keep names stable.  
5) Error surfacing: propagate tool errors to the TUI (log + chat message).  
6) Backward compatibility: preserve current behavior if native tools fail (fallback to existing MCP server wiring if feasible).  
7) Observability: log tool registration and calls (name, args, status).  
8) Minimal UI impact: no change to menu UX; tools remain transparent to the chat user.

## Approach
- Tool definitions: mirror `mcp_tools.py` actions as Agent SDK `tool()` definitions in the bridge (or a shared module). Use zod schemas consistent with API payloads.
- Invocation: each tool handler calls the API server endpoints (same URLs used by MCP) with axios/fetch; return Agent SDK tool result shape.
- Prompt handling: always supply an async iterable prompt to `query()` when tools/MCP are configured (system prompt via options; user msg via stream).
- Allowed tools: dedupe and pass only the defined tool names; keep MCP names stable (`tui_create_window`, etc.).
- MCP coexistence: keep current MCP server available as a fallback flag; default to native tools. If overkill for a given run, allow disabling native tools (config flag).
- Config: add bridge/session config toggle `useNativeTools` (default true), `useMcpServerFallback` (default true). Document required env/ports.
- Testing: run chat with tools enabled, exercise create/move/tile/send_text/figlet/get_state; verify streaming remains intact.

## Alternatives & Honesty
- Staying on the existing in-proc MCP server is acceptable short-term and was working “ok-ish,” but it keeps the prompt API brittle (string vs stream) and adds another abstraction layer. Moving to native tools reduces moving parts and aligns with Agent SDK guidance.

## Risks & Mitigations
- Risk: Prompt stream misuse (passing a string) breaks tools. Mitigation: enforce async generator path whenever tools are enabled; add guardrails/logs.
- Risk: Tool duplication/conflicts. Mitigation: dedupe tool names and configs; single source of truth for tool list.
- Risk: API server availability. Mitigation: clear errors surfaced to chat/log; fallback to MCP server if configured.

## Rollout & Testing
- Implement native tools and prompt streaming in the bridge; keep MCP fallback switch.
- Manual tests: run `./build/app/test_pattern 2> /tmp/sdk_debug.log`, send tool-using prompts (“open a gradient window”, “tile windows”), verify tool results and streaming text.
- Log review: check tool registration and call logs; ensure no “Expected message role 'user'” or streaming iterator errors.
