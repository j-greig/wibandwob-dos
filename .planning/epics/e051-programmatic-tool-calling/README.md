# E051 — Programmatic Tool Calling (PTC) for Pi

**Status:** research-complete  
**Branch:** —  
**Owner:** —  
**Created:** 2026-03-17  

---

## TL;DR

PTC lets the LLM write *code that calls tools* instead of making individual tool calls.
One `execute_code` invocation replaces dozens of round-trips. Tool results stay in the
sandbox — only `console.log()` output returns to the LLM context. **85%+ token reduction**
on multi-tool workflows, same accuracy. We can build this as a ~300 LOC pi extension
with zero MCP dependency.

---

## Contents

1. [What PTC Is](#what-ptc-is) — the core insight in 30 seconds
2. [Why It Matters](#why-it-matters) — concrete wins for pi agents
3. [How Anthropic Does It](#how-anthropic-does-it) — native API beta
4. [How open-ptc-agent Does It](#how-open-ptc-agent-does-it) — OSS reference
5. [Our Design: Pi Extension](#our-design-pi-extension) — no MCP, JS sandbox
6. [Architecture](#architecture) — tool stubs, sandbox, prompt augmentation
7. [Implementation Plan](#implementation-plan) — phased delivery
8. [Reference Material](#reference-material) — local files, repos

---

## What PTC Is

Traditional tool calling:
```
LLM → call tool A → wait → result A enters context (10KB)
LLM → call tool B → wait → result B enters context (10KB)  
LLM → call tool C → wait → result C enters context (10KB)
LLM → "ok here's my answer based on 30KB of context I just consumed"
```

PTC:
```
LLM → writes code:
    a = await toolA()
    b = await toolB()
    c = await toolC()
    summary = process(a, b, c)  // filter, aggregate, extract
    console.log(summary)        // only THIS returns to LLM
→ LLM sees ~200 bytes of summary, not 30KB of raw results
```

**The insight:** LLMs are great at writing code. Let them orchestrate tool calls
*in code* and process results *in code*. The LLM's context window only sees the
final distilled output.

---

## Why It Matters

### For pi agents specifically

| Scenario | Without PTC | With PTC |
|----------|------------|----------|
| Read 50 files looking for a pattern | 50× `read` tool calls, all content in context | One `execute_code`: read + grep + summarise in JS |
| Batch edit with validation | N× read + edit + typecheck round-trips | One code block: read → edit → validate → report |
| API data processing | Raw JSON dumps pollute context | Fetch → parse → filter → aggregate → print summary |
| Sequential dependencies | Multiple LLM turns to chain results | Single code execution handles the chain |

### Measured impact (from Anthropic's cookbook)

- **Token reduction:** 110,473 → 15,919 (85.6% reduction)
- **API round-trips:** Same or fewer
- **Accuracy:** Equivalent (arithmetic is *more* precise in code)

---

## How Anthropic Does It

> Source: `.agents/progmatic-tool-calling-ptc.md` (Anthropic cookbook, local copy)

Anthropic's native PTC is a Claude API beta feature (`advanced-tool-use-2025-11-20`):

1. **Tool annotation** — Add `allowed_callers: ["code_execution_20250825"]` to tools
2. **Code execution tool** — Add `{ type: "code_execution_20250825", name: "code_execution" }` to tool list
3. **Server-side container** — Anthropic runs a persistent Python container; `container_id` tracks state across turns
4. **Async tool bridge** — LLM writes `await get_expenses({...})` in Python; the sandbox calls the tool via the API, but results route to the *sandbox*, not the LLM context
5. **Caller field** — Each `tool_use` block has `caller.type`: `"direct"` or `"code_execution_20250825"`

### Key mechanic

Tools invoked from within code execution still produce `tool_use` blocks in the API
response. The host executes them and sends results back. But these results are seen
**only by the sandbox code**, not by the model. This is what prevents context pollution.

---

## How open-ptc-agent Does It

> Source: `tmp/vendor/open-ptc-agent/` (cloned repo)

The [open-ptc-agent](https://github.com/Chen-zexi/open-ptc-agent) project is an open-source
reimplementation built on LangChain + Daytona sandbox:

1. **MCP tool bridge** — MCP servers auto-converted to Python modules via `ToolFunctionGenerator`
2. **Sandbox upload** — Generated `tools/{server}.py` files uploaded to Daytona sandbox
3. **MCP client in sandbox** — `mcp_client.py` manages JSON-RPC stdio/SSE/HTTP connections to MCP servers *from inside the sandbox*
4. **Single `execute_code` tool** — The only LLM-visible tool; LLM writes Python that imports and calls tool modules
5. **Progressive discovery** — Tool docs at `tools/docs/{server}/{tool}.md`; LLM reads them via `read_file()` before use

### Key difference from Anthropic

In open-ptc-agent, tool calls happen **entirely inside the sandbox**. No `tool_use`
blocks return to the API at all. The LLM only sees stdout from code execution.
Even more aggressive about context reduction, but requires the sandbox to have
direct network/process access to tool backends.

### Architecture (from their repo)

```
User Task → PTCAgent writes Python → Daytona Sandbox executes
                                      ├── MCP Tools (Python imports)
                                      ├── process / filter / aggregate
                                      └── dump to data/ → summary to stdout
```

---

## Our Design: Pi Extension

### Why not MCP?

Pi already has `pi.registerTool()`. MCP adds transport indirection we don't need.
The PTC value is **code-as-orchestrator**, not MCP-as-transport.

### Why not Anthropic's native PTC?

It's a Claude-specific API beta. We want this to work with any model pi supports
(Gemini, OpenAI, local models). The pattern is model-agnostic — any LLM that can
write JavaScript can benefit.

### Core idea

Register one `execute_code` tool. Inside it, inject async function stubs for every
pi tool. Execute the LLM's code in a `node:vm` sandbox. Only `console.log()` output
returns as the tool result.

```
┌─────────────────────────────────────────────┐
│  pi-ptc extension                           │
│                                             │
│  1. Registers `execute_code` tool           │
│  2. Generates async stubs for all pi tools  │
│  3. Executes LLM code in node:vm sandbox    │
│  4. Returns only console.log output         │
│  5. Augments system prompt with tool docs   │
└─────────────────────────────────────────────┘
```

---

## Architecture

### Tool stub generation

For each registered pi tool, generate an async function:

```typescript
// Generated at runtime from pi's tool registry
async function read(params) {
  return await __callTool("read", params);
}
async function bash(params) {
  return await __callTool("bash", params);
}
async function grep(params) {
  return await __callTool("grep", params);
}
// ... all registered tools
```

`__callTool` is the bridge that actually executes the pi tool, captures the result,
and returns it to the sandbox's memory — NOT to the LLM context.

### Sandbox execution

```typescript
import { createContext, runInNewContext } from 'node:vm';

async function executePTC(code: string, tools: ToolDef[]) {
  const stdout: string[] = [];
  
  const sandbox = {
    console: { log: (...args) => stdout.push(args.map(String).join(' ')) },
    JSON,
    __callTool: async (name, params) => {
      // Execute the real pi tool, return result to sandbox only
      const result = await executeRealTool(name, params);
      return result;
    },
    // ... generated tool function stubs
  };
  
  await runInNewContext(`(async () => { ${code} })()`, sandbox, { timeout: 60_000 });
  return stdout.join('\n');
}
```

### System prompt augmentation

Via `before_agent_start`, inject when-to-use guidance:

```
When a task requires multiple tool calls, sequential dependencies, or processing
large results, prefer execute_code over individual tool calls.

Available functions inside execute_code:
- read({ path, offset?, limit? }) — read file contents
- bash({ command, timeout? }) — run shell command
- grep({ pattern, path?, glob? }) — search file contents
- write({ path, content }) — write file
- edit({ path, oldText, newText }) — edit file
- find({ pattern, path? }) — find files by glob

Pattern: call tools, process in JS, console.log() only the summary.
```

### Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | JS/TS not Python | Pi is Bun/Node — no Python dependency needed |
| Sandbox | `node:vm` + timeout | Simplest, sufficient for tool orchestration |
| Tool bridge | Direct pi tool execution | No MCP needed — tools already in pi |
| Result routing | Only `console.log()` returns | Core PTC insight: large results stay in sandbox |
| Discovery | System prompt injection | `before_agent_start` adds tool docs |
| State | Stateless per-call | Simpler than Anthropic's container; add later if needed |

---

## Implementation Plan

### Phase 1 — Working prototype (~300 LOC)

- [ ] `execute_code` tool with `node:vm` sandbox
- [ ] Tool stubs for core tools: `read`, `bash`, `grep`, `write`, `edit`, `find`
- [ ] Basic `console.log()` → result routing
- [ ] Timeout + error handling

### Phase 2 — Prompt engineering

- [ ] `before_agent_start` hook: inject tool summary + usage guidance
- [ ] When-to-use heuristics in prompt (many tools → suggest PTC)
- [ ] Examples in prompt showing the pattern

### Phase 3 — WibWob surface + polish

- [ ] Typed `wibwob_*` stubs (state, cmd, open, close, move, screenshot) — thin wrappers over `bash({ command: 'wibwob ...' })`
- [ ] Streaming progress via `onUpdate` during long executions
- [ ] Dynamic tool discovery (stubs regenerated on tool add/remove)
- [ ] Add `execute_code` to subagent tools lists (`.pi/agents/*.md`)

### Phase 4 — Advanced (optional)

- [ ] Shared state across turns (persistent sandbox context)
- [ ] `worker_threads` or `isolated-vm` for real sandboxing (note: `node:vm` is NOT a security boundary — same process, same memory, same fs access as pi. Fine for PTC since `bash()` is equally powerful, but document explicitly)
- [ ] Token usage tracking (measure actual savings)

---

## Cross-Synthesis Notes

> From planning session review, 2026-03-17

### Adjacencies (no overlap, no rework risk)

- **E047 S20-S22 (tool bridge spike)** — PTC's tool registry introspection could feed the WibWob→pi tool adapter someday. Same schema walking, different direction.
- **E048 (unix CLI surface)** — PTC + `bash()` partially delivers E048's goal (agents composing wibwob commands in code) without a new CLI binary.
- **Codex subagent extension** — Architecturally similar (one tool does compound work) but codex spawns subprocess; PTC runs in-process via `node:vm`.

### Proving ground: the ops agent

The ops agent (`.pi/agents/ops.md`) is the best first test case. Its workflows are highly sequential (health → state → commands → verify → screenshot = 5-8 tool calls). Its outputs are large (state JSON = 5-10KB). PTC should compress a typical ops workflow from ~50KB context to ~2KB.

### Subagent gotcha

Subagent definitions in `.pi/agents/*.md` have explicit `tools:` fields. If `execute_code` isn't listed, subagents won't see it. Phase 3 must add it to each agent definition.

### Prompt injection ordering

Both wwdos-state.ts and PTC inject via `before_agent_start`. Both append, so they compose. PTC tool docs should be stable (system prompt level); desktop state is already per-turn.

### E001 retrieval scripts synergy

E001's planned retrieval scripts (`list_subsystems`, `get_files_for_subsystem`) are exactly the multi-call workflows PTC accelerates. PTC + E001 = agents self-orient with minimal token cost.

### `node:vm` is not a security boundary

`node:vm` shares process, memory, filesystem with pi. The LLM's code can `process.exit()`, read env vars, access anything pi can. This is fine — the LLM already has `bash()` which is equally powerful. But document it so nobody mistakes it for isolation.

---

## Reference Material

| Resource | Location | What |
|----------|----------|------|
| Anthropic PTC cookbook | `.agents/progmatic-tool-calling-ptc.md` | Full walkthrough with code, metrics, comparison |
| open-ptc-agent repo | `tmp/vendor/open-ptc-agent/` | OSS implementation (LangChain + Daytona + MCP) |
| Pi extensions docs | `/opt/homebrew/lib/.../docs/extensions.md` | `registerTool`, events, `before_agent_start` |
| Scratch analysis | `scratch/ptc-analysis.md` | Raw research notes and comparison table |

### Key files in open-ptc-agent

- `libs/ptc-agent/ptc_agent/agent/tools/code_execution.py` — execute_code tool
- `libs/ptc-agent/ptc_agent/core/tool_generator.py` — MCP → Python stub generation
- `libs/ptc-agent/ptc_agent/core/mcp_registry.py` — MCP server management
- `libs/ptc-agent/ptc_agent/agent/prompts/templates/` — system prompt templates

### External references

- [Anthropic: Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [CodeAct paper](https://arxiv.org/abs/2402.01030) — academic foundation for the pattern
