# WibWob AgentSession Migration Plan

## Root Cause
`WibWobAgentSession` is currently built directly on raw `Agent` (`src/services/wibwob-agent-session.ts:8,535`) and manually re-implements responsibilities that now belong to `AgentSession`: session persistence, resume/new session control, retry/compaction lifecycle, model/session metadata, and richer event surface.

Primary coupling points causing migration friction:
- Raw-agent construction and state reads are hardcoded (`src/services/wibwob-agent-session.ts:448,535,620-631`).
- Manual event reducer is tied to `AgentEvent` only (`src/services/wibwob-agent-session.ts:783`).
- Manual JSONL append logic duplicates `AgentSession` persistence (`src/services/wibwob-agent-session.ts:716-722,850-873`).
- Resume/reset are implemented via local state + `loadSessionMessages` instead of session switching (`src/services/wibwob-agent-session.ts:683-700`; `src/services/pi-session-bridge.ts:100-105`).
- `/reload` behavior is split/incorrect in UI: it reopens the window, but slash dispatcher does not implement prompt reload (`src/windows/wibwob-agent-window.ts:330-347,433-442`; `src/windows/agent-slash-commands.ts:1-69`).

## 1. Dependency Audit

### What `AgentSession` requires
From `AgentSessionConfig` (`node_modules/@mariozechner/pi-coding-agent/dist/core/agent-session.d.ts:65-84`):
- Required:
  - `agent: Agent`
  - `sessionManager: SessionManager`
  - `settingsManager: SettingsManager`
  - `resourceLoader: ResourceLoader`
  - `modelRegistry: ModelRegistry`
  - `cwd: string`
- Optional but recommended:
  - `customTools?: ToolDefinition[]`
  - `initialActiveToolNames?: string[]`
  - `baseToolsOverride?: Record<string, AgentTool>`
  - `scopedModels?`
  - `extensionRunnerRef?`

### What we already have
- `AuthStorage`, `ModelRegistry`, `SettingsManager`, `SessionManager` are already imported/used in `WibWobAgentSession` (`src/services/wibwob-agent-session.ts:11-15,496-498,531`).
- We already construct custom tools (TUI + session bridge + music) and jailed coding tools.

### Missing or new pieces
- `ResourceLoader` is not currently constructed in WibWob. Must add `DefaultResourceLoader` or a minimal custom loader.
- `ToolDefinition` registration path is not used; current code returns `AgentTool[]`.
- If we want extension-context parity with upstream, we should provide `extensionRunnerRef` and keep `Agent.transformContext` compatible.

### Stub vs implement
- Must implement (not optional for production parity):
  - `ResourceLoader` wiring (`DefaultResourceLoader`) so `session.reload()` and prompt/tool rebuild work.
  - `customTools` conversion to `ToolDefinition[]`.
- Can stub short-term (phase 1, then harden):
  - Extension UI bindings (`bindExtensions`) can remain unused initially.
  - Scoped model cycling can be omitted initially.
- Recommended immediate implementation:
  - `baseToolsOverride` with jailed `read/write/edit/bash/grep/find/ls` to preserve sandbox guarantees.

## 2. Seam Map

| Concern in `WibWobAgentSession` | Current Location | Migration Ownership | Action |
|---|---|---|---|
| Model selection bootstrapping | `resolveModel()` + `initialize()` (`src/services/wibwob-agent-session.ts:424-442,486-552`) | Delegate mostly | Keep preferred-model policy as thin preselection; let `AgentSession` own model lifecycle thereafter (`setModel`, `cycleModel`). |
| Agent construction | `new Agent(...)` (`src/services/wibwob-agent-session.ts:535-546`) | Keep (wrapper seam) | Still create raw `Agent`, but wrap with `new AgentSession(config)` and store `this.session`. |
| Session persistence append | `appendMessage` in `send()/handleEvent()` (`src/services/wibwob-agent-session.ts:716-722,850-873`) | Delegate | Delete manual appends; rely on `AgentSession` internal persistence (`agent-session.js:167-177`). |
| Session resume/new | `resume()`, `reset()`, `resumeMessages` | Delegate | Replace with `session.switchSession(path)` and `session.newSession()`. |
| Retry + compaction | none/manual error text only | Delegate | Consume new events `auto_retry_*`, `auto_compaction_*` for UI status. |
| Event stream reducer | `handleEvent(event: AgentEvent)` (`src/services/wibwob-agent-session.ts:783`) | Keep (adapter) | Replace with `handleSessionEvent(event: AgentSessionEvent)`; map superset events. |
| Desktop state injection | `transformContext` in raw agent (`src/services/wibwob-agent-session.ts:512-526`) | Keep WibWob-specific | Preserve via `Agent` `transformContext`; prepend `[Current desktop state]` summary. |
| TUI tools | `createTuiTools()` (`src/services/agent-tools.ts`) | Keep WibWob-specific | Convert to `ToolDefinition[]` (or add adapter) and register via `AgentSession.customTools`. |
| Jailed coding tools | `createJailedCodingTools()` | Keep WibWob-specific | Move into `baseToolsOverride` to override built-ins with jailed variants. |
| Session bridge tools | `createPiSessionTools()` | Keep WibWob-specific | Register as `customTools`. |
| Music tools | `createMusicTools()` | Keep WibWob-specific | Register as `customTools`. |
| `/reload` prompt | `reloadPrompt()` + UI reopen workaround | Delegate + local UI | Use `await session.reload()` for runtime reload; keep window reopen only if explicitly desired as UI refresh, not command semantics. |

## 3. Event Mapping Table (`AgentSessionEvent` -> `ChatMessageEntry`)

References:
- `AgentSessionEvent` union includes new events (`agent-session.d.ts:40-56`).
- Base `AgentEvent` variants (`pi-agent-core/types.d.ts:139-178`).

| Event type | Transcript mapping | Status/state updates | Notes |
|---|---|---|---|
| `message_start` (assistant) | create streaming assistant row | `status = "Streaming..."` | same as current behavior |
| `message_update` + `text_delta` | append delta to active assistant row | `status = "Streaming..."` | same |
| `message_end` (assistant) | finalize/normalize assistant text | `status = "Ready."` | no manual persistence |
| `tool_execution_start` | status row: `[tool] ...` | `lastToolName`, `status = Running ...` | keep compact formatting helpers |
| `tool_execution_update` | optional status row or ignore | optional | currently ignored; recommend ignore in phase 1 |
| `tool_execution_end` | status row: `[done]/[fail] ...` | status success/fail | same |
| `turn_end` | if error surfaced, set error text | `lastError`, `status = "Error."` | keep fallback parsing for API errors |
| `agent_end` | close any open streaming row | clear `lastToolName`, `status = "Ready."` | same |
| `auto_compaction_start` | status row: `[compact] start (threshold|overflow)` | `status = "Compacting..."` | new |
| `auto_compaction_end` | status row summarizing result | `status = Ready/Error`, maybe `lastError` | include `aborted`, `willRetry`, `errorMessage` |
| `auto_retry_start` | status row: `[retry] attempt/max in delay` | `status = "Retrying..."` | new |
| `auto_retry_end` | status row: success/final fail | restore `Ready` or `Error` | new |

## 4. Tool Registration Plan

### Current state
- `createTuiTools(ctx)` returns `AgentTool[]` (`src/services/agent-tools.ts:459`).
- `createPiSessionTools` and `createMusicTools` currently emit tool-like objects in raw-agent shape (`src/services/wibwob-agent-session.ts:254-392`).

### Target registration
Use `AgentSession` runtime tool registry (`customTools` + `baseToolsOverride`):

1. Base coding tools (jailed)
- Build map `{ read, write, edit, bash, grep, find, ls }` from `createJailedCodingTools()`.
- Pass map as `baseToolsOverride` in `AgentSessionConfig`.
- Set `initialActiveToolNames` to include all seven (today default is 4 upstream).

2. TUI tools
- Add adapter in `agent-tools.ts`:
  - `createTuiToolDefinitions(ctx): ToolDefinition[]` (native target).
  - Keep `createTuiTools(ctx): AgentTool[]` temporarily as compatibility wrapper if needed.

3. Session bridge tools
- Convert `createPiSessionTools(...)` return type to `ToolDefinition[]`.

4. Music tools
- Convert `createMusicTools(...)` return type to `ToolDefinition[]`.

5. Aggregate custom tools
- `customTools = [...tuiDefs, ...piSessionDefs, ...musicDefs]`.

## 5. Slash Command Mapping

Current command handler: `src/windows/agent-slash-commands.ts:17-69`.

| Slash command | New backend method | Keep local? | Notes |
|---|---|---|---|
| `/help` | n/a | Yes | static text |
| `/new` | `await session.newSession()` | No | replaces local `reset()` semantics |
| `/session` | `session.getSessionStats()` | Partial | show model, id, counts, tokens, cost, file |
| `/resume ...` | `await session.switchSession(path)` | No | keeps list/lookup logic in window |
| `/reload` | `await session.reload()` | No | fixes current mismatch between help text and behavior |
| `/stop` | `await session.abort()` | No | async now; return “nothing running” if not streaming |
| `/model` | `session.model` / `getSnapshot().model` | Partial | future: add `/model next` -> `cycleModel()` |
| `/tools` | `session.getActiveToolNames()` | No | optionally show `getAllTools()` |
| `/clear` | local transcript clear | Yes | this is UI-only, keep local to WibWob transcript state |

Important UI fix:
- Remove `/reload` special-case window reopen path or decouple it from prompt reload semantics (`src/windows/wibwob-agent-window.ts:330-347,433-442`).

## 6. Migration Steps (typecheck-safe phases)

1. Introduce backend seam in `WibWobAgentSession` (estimated 80-120 LOC)
- Add `private session?: AgentSession` alongside or replacing `private agent?: Agent`.
- Keep public API unchanged initially (`initialize/send/resume/reset/abort/getSnapshot`).
- Typecheck.

2. Add AgentSession dependency construction (estimated 120-180 LOC)
- Build `DefaultResourceLoader` and call `await reload()`.
- Create raw `Agent` with WibWob `transformContext` desktop injection.
- Construct `AgentSession` with required config (`sessionManager`, `settingsManager`, `modelRegistry`, `resourceLoader`, `cwd`).
- Subscribe via `session.subscribe(...)`.
- Typecheck.

3. Convert tool plumbing (estimated 160-240 LOC across 2 files)
- Add `ToolDefinition` builders/adapters in `src/services/agent-tools.ts`.
- Convert session-bridge + music tool factories to `ToolDefinition[]`.
- Pass jailed coding tools through `baseToolsOverride` and set active names.
- Typecheck.

4. Replace message send/queue/resume/reset paths (estimated 120-170 LOC)
- `send()` -> `session.prompt(...)` or `session.sendUserMessage(...)` with streaming behavior parity.
- `resume()` -> `session.switchSession(path)`.
- `reset()` -> `session.newSession()`.
- Remove `resumeMessages` path.
- Typecheck.

5. Replace event reducer with AgentSessionEvent adapter (estimated 140-220 LOC)
- Rename `handleEvent` -> `handleSessionEvent`.
- Add mappings for `auto_compaction_*` and `auto_retry_*`.
- Remove manual `sessionManager.appendMessage(...)` logic.
- Typecheck.

6. Slash/UI integration cleanup (estimated 60-120 LOC across 2 files)
- Make slash dispatcher async-capable for `/stop`, `/new`, `/reload`.
- Implement actual `/reload` command behavior using session reload.
- Remove duplicate `/reload` window-only special-case.
- Typecheck.

7. Remove raw-Agent-only dead code + finalize snapshot model (estimated 80-140 LOC)
- Snapshot fields should read from `session.state`/`session` getters.
- Remove obsolete helper/state methods listed in section 8.
- Typecheck.

8. Verification pass and docs update (estimated 40-80 LOC)
- Add tests listed below.
- Update docs reference if behavior changed (`/reload`, session stats).
- Final typecheck + manual smoke via control API.

## 7. Risk Register + Tests

### Risks
1. Tool incompatibility at registration boundary
- Cause: `AgentTool` vs `ToolDefinition` shape mismatch.
- Mitigation: explicit adapter tests for execute signatures and schemas.

2. Loss of jailed filesystem guarantees
- Cause: falling back to default base tools instead of jailed overrides.
- Mitigation: assert active tool implementations are the jailed set.

3. Desktop-state injection regression
- Cause: using helper constructors that omit custom `transformContext`.
- Mitigation: integration test that prompt context contains `[Current desktop state]` header.

4. Duplicate or missing transcript rows
- Cause: event semantics differ (`message_end` persistence handled internally, new retry/compaction events).
- Mitigation: event-to-transcript unit tests with synthetic events.

5. `/reload` behavioral break
- Cause: current command is UI-reopen hack.
- Mitigation: test that `/reload` updates system prompt without requiring window reopen.

6. Async abort/new/resume race
- Cause: methods become async; callers currently treat them sync.
- Mitigation: make slash command dispatcher async and await command completion.

### Tests to add
1. Unit: `WibWobAgentSession` event mapping
- Input: sequence including `tool_execution_*`, `auto_compaction_*`, `auto_retry_*`.
- Assert: expected `ChatMessageEntry` list and status transitions.

2. Unit: tool registration
- Assert active tool names include TUI + jailed coding + session bridge + music.
- Assert read/write paths are jailed (escape attempts fail).

3. Unit: slash commands
- `/new` calls `newSession`, `/reload` calls `reload`, `/stop` calls async abort.

4. Integration: resume/session stats
- Switch session file and verify snapshot/sessionFile/sessionId change.

5. Integration: desktop injection
- Ensure injected desktop summary is prepended once per turn and remains compact.

6. Manual smoke (control API)
- open agent window, send prompt, call `/stop`, `/reload`, `/resume`, and verify transcript + state.

## 8. What We DELETE (`src/services/wibwob-agent-session.ts`)

Functions/methods that become unnecessary after full migration:

### Class internals to delete
- `private agent?: Agent` field (replace with `private session?: AgentSession`).
- `private resumeMessages?: AgentMessage[]` field.
- `private handleEvent(event: AgentEvent)` (`src/services/wibwob-agent-session.ts:783`).
- `private findCurrentAssistant()` (`src/services/wibwob-agent-session.ts:776`) once reducer is rewritten around active assistant tracking in new adapter.

### Public methods to remove or replace
- `reloadPrompt(): boolean` (`src/services/wibwob-agent-session.ts:591`) -> replace with async `reload(): Promise<boolean>` wrapping `session.reload()`.
- `resume(sessionPath: string): Promise<void>` (`src/services/wibwob-agent-session.ts:683`) -> replace internals with `session.switchSession`; remove `loadSessionMessages` dependency.
- `reset()` (`src/services/wibwob-agent-session.ts:660`) -> replace internals with `session.newSession()`.
- `getToolNames()` (`src/services/wibwob-agent-session.ts:656`) -> source from `session.getActiveToolNames()`; old direct `agent.state.tools` path deleted.

### Top-level helpers to delete if fully delegated
- `resolveModel(...)` (`src/services/wibwob-agent-session.ts:424`) if model selection is moved to AgentSession bootstrap helper.
- `getMessageRole(...)` and `getUserContentText(...)` (`src/services/wibwob-agent-session.ts:206-220`) if reducer no longer parses raw `Message` payloads directly.
- Manual append comments/logic tied to `SessionManager.appendMessage(...)` in `send` + old reducer.

Notes:
- Keep `formatToolCall`, `formatToolResult`, `normalizeVisibleReply`, `createPiSessionTools`, `createMusicTools`, and sender-info helpers; these are WibWob-specific presentation/integration concerns.
- Keep `clearTranscript()` if transcript-clearing remains a local UI feature (`/clear`).

## Fix Options With Tradeoffs

1. Manual construction (`Agent` + `AgentSession`) in WibWob (recommended)
- Pros: preserves desktop `transformContext`, jailed tools, and exact WibWob prompt semantics with minimal hidden behavior.
- Cons: more bootstrapping code to maintain.

2. Use `createAgentSession()` helper from SDK
- Pros: less setup code, aligned with upstream defaults.
- Cons: harder to inject desktop state via `transformContext`; harder to force jailed tool overrides and custom prompt composition without extra hooks.

3. Hybrid (start with helper, then fork seams)
- Pros: fastest initial migration.
- Cons: likely rework later when desktop injection/tool jail constraints need stricter control.

Recommendation: option 1.
