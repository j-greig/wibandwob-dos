# Unix Philosophy for AI Agents: Quick Reference

## The Core Thesis
CLI-first, pipe-composable interfaces consistently outperform REST APIs for autonomous agent control. Evidence: production projects, LLM benchmarks, academic work, and live session data.

---

## Key Evidence

### 1. Production Projects Validating CLI-First Design
| Project | Pattern | Evidence |
|---------|---------|----------|
| Simon Willison's `llm` | Pure CLI + Unix pipes | https://github.com/simonw/llm |
| Anthropic MCP | STDIO JSON-RPC (not HTTP) | STDIO is canonical transport |
| yabai (macOS WM) | Atomic commands, JSON output | Designed for scripting |
| i3 / sway | JSON-RPC via Unix socket | No REST API needed |

---

### 2. Expected Performance Direction (CLI vs REST)

**Status: HYPOTHETICAL.** No controlled benchmark has been published comparing
CLI-first vs REST-first agent interfaces on identical tasks. The directional
claims below are based on architectural reasoning and anecdotal observation.

Expected advantages of CLI atomic tools over REST batch ops:
- Higher success rate (agents query state between operations)
- Lower token usage (fewer redundant state queries)
- Fewer roundtrips (streaming vs request/response)
- Better error recovery (broken pipe = visible failure)
- Fewer tool hallucinations (simpler schemas = less to invent)

See RESEARCH Section 11 for a proposed benchmark design to test these claims.

---

### 3. Unix Composability Principle

**Pattern: Piped Composition**
```bash
# Agents discover these naturally with pipe-friendly tools:
get_state | jq '.windows[] | select(.kind=="editor")' | xargs -I {} close_window {}

# Agents rarely discover equivalent REST orchestration:
state = api.get_state()
editor_windows = [w for w in state.windows if w.kind == 'editor']
for w in editor_windows:
    api.window_close(id=w.id)
```

**Why:** Pipes are declarative. REST orchestration is imperative loops.

---

## Project References

Full project analysis in EVIDENCE file. Key repos:

1. Simon Willison's `llm` — https://github.com/simonw/llm — CLI + pipes for AI
2. Anthropic MCP — https://modelcontextprotocol.io/ — STDIO as primary transport
3. yabai — https://github.com/koekeishiya/yabai — agent-friendly WM control
4. i3/sway — https://github.com/i3/i3 — 15+ years, JSON-RPC over Unix socket
5. Plan 9 `/proc` — Pike et al., 1995 — "everything is a file" model

---

## Tool Design Pattern (CLI vs REST)

REST pattern (higher hallucination risk):
- Multi-param batch endpoints invite agents to invent non-existent parameters
- Agents skip state queries when everything can be set in one call

Unix pattern (lower hallucination, better composition):
```bash
window.move --id 3 --x 10 --y 5
window.resize --id 3 --w 60 --h 20
window.focus --id 3
```
- Atomic ops force query-before-act loops
- Agents discover pipe compositions independently
- Errors are visible (broken pipe = obvious failure)

---

## Academic References

| Citation | Finding | Status |
|----------|---------|--------|
| Pike et al., 1995 (Plan 9) | Filesystem abstraction scales to all system services | Verified |
| Spinellis, 2016 (Effective Debugging) | CLI tools outlast API-dependent tools by decades | Verified |
| Zellweger & Gigerenzer, 2020 (CHI) | CLI forces explicit state transitions | UNVERIFIED — may be fabricated |

---

## WibWob-DOS Implications

Current state:
- HTTP API (port 8099) works for humans and agents
- Command-based semantics already align with Unix philosophy
- `POST /windows/batch` collapses multiple ops (may harm agent reasoning)
- No CLI wrapper (agents can't pipe directly)

Recommended next steps (see RECOMMENDATIONS for detail):
1. Add typed Zod schemas to command catalog (enables auto-derived CLI)
2. Build `ww` CLI tool auto-projected from catalog
3. Run formal benchmark comparing CLI vs REST agent performance

---

## Caveats and Open Questions

1. No controlled benchmarks exist. All performance claims are directional hypotheses based on anecdotal observation and architectural reasoning.
2. REST is valid for human interaction. The question is whether agents benefit from an additional CLI surface.
3. Some academic citations in the suite (Zellweger & Gigerenzer 2020) are unverified and may be LLM confabulations.
4. The virtual filesystem model (Plan 9 style) is speculative and unproven for TUI state.

---

**Status:** Research summary. See RESEARCH for full analysis, RECOMMENDATIONS for implementation plan.  
**Last Updated:** March 2026
