# Pi Mono Repository — TypeScript Coding Style Forensics

**Analyzed**: 2026-03-16  
**Scope**: pi-mono (`packages/{coding-agent,agent,tui,ai,web-ui,mom,pods}`) + mitsuhiko extensions (`/tmp/agent-stuff/pi-extensions/`)

---

## Repository Overview

| Package | Files | Lines | `any` count | Catch blocks | Type guards | Generics |
|---------|-------|-------|-------------|--------------|-------------|----------|
| coding-agent | 114 | 39,333 | 83 | 199 | 29 | 43 |
| agent | 5 | 1,952 | 25 | 6 | 0 | 2 |
| tui | 25 | 10,373 | 7 | 12 | 7 | 1 |
| ai | 41 | 25,139 | 61 | 62 | 8 | 9 |
| web-ui | 71 | 14,617 | — | — | — | — |
| mom | 16 | 4,048 | — | — | — | — |
| pods | 9 | 1,773 | — | — | — | — |
| **mitsuhiko ext** | 14 | 13,054 | 38 | — | — | — |

---

## 1. packages/coding-agent (DEEP)

### 1.1 Naming Conventions

**P1 — Strength: Consistent kebab-case file naming**  
All files use `kebab-case.ts`: `settings-manager.ts`, `session-manager.ts`, `model-resolver.ts`, `agent-session.ts`. Zero violations across 114 files.

**P1 — Strength: PascalCase for types/interfaces, camelCase for values**  
Perfectly consistent. Types: `ExtensionContext`, `SessionEntry`, `ToolDefinition`. Values: `createAgentSession`, `buildSessionContext`. No mixed conventions observed.

**P2 — Observation: Manager suffix prevalence**  
`SettingsManager`, `SessionManager`, `KeybindingsManager`, `ModelRegistry` — the codebase uses both `-Manager` and `-Registry` without a clear distinction. `ModelRegistry` manages models; `SessionManager` manages sessions. Both are stateful singletons.

### 1.2 Constants & Magic Numbers

**P0 — Strength: Near-zero magic numbers**  
Constants are well-named and co-located:
```typescript
// settings-manager.ts — defaults inline with optionality
getCompactionReserveTokens(): number { return this.settings.compaction?.reserveTokens ?? 16384; }
getCompactionKeepRecentTokens(): number { return this.settings.compaction?.keepRecentTokens ?? 20000; }
```

**P1 — Strength: String literal unions over enums**  
Zero TypeScript `enum` declarations across the entire codebase. All discriminants use string literal unions:
```typescript
// types.ts:636
export type InputEventResult =
  | { action: "continue" }
  | { action: "transform"; text: string; images?: ImageContent[] }
  | { action: "handled" };
```
This is the correct modern TypeScript choice — avoids enum double-mapping, works with discriminated unions, tree-shakes cleanly.

**P2 — Note: Constants in mitsuhiko extensions**  
Extensions define file-scoped constants at module top level:
```typescript
// control.ts
const CONTROL_DIR = path.join(os.homedir(), ".pi", "session-control");
const SOCKET_SUFFIX = ".sock";
const SESSION_MESSAGE_TYPE = "session-message";
```
Clean pattern — WibWob-DOS could adopt this vs scattered inline strings.

### 1.3 Functions

**P0 — Observation: File size hotspots**

| File | Lines | Concern |
|------|-------|---------|
| `interactive-mode.ts` | 4,442 | God file — needs decomposition |
| `agent-session.ts` | 3,097 | Large but cohesive |
| `session-manager.ts` | 1,411 | Moderate — tree management complexity |
| `extensions/types.ts` | 1,411 | Pure type definitions — acceptable |
| `settings-manager.ts` | 953 | Getter/setter pairs bloat |

`interactive-mode.ts` at 4,442 lines is a **P0** issue — it handles rendering, input routing, state machine transitions, and UI composition all in one file.

**P1 — Strength: Arrow functions for short operations, `function` for named exports**  
```typescript
// Arrow for inline callbacks (agent-loop.ts:11)
const stream = createAgentStream();

// Named function for exports (agent-loop.ts:18)
export function agentLoop(
  prompts: AgentMessage[],
  context: AgentContext,
  ...
```
Ratio: 1,312 arrows vs 428 `function` declarations in coding-agent — arrows dominate for inline/closure use, `function` reserved for module-level exports. This is consistent and intentional.

**P1 — Pattern: Factory functions over constructors**  
```typescript
// session-manager.ts — static factory methods
static create(cwd: string, sessionDir?: string): SessionManager
static open(path: string, sessionDir?: string): SessionManager
static continueRecent(cwd: string, sessionDir?: string): SessionManager
static inMemory(cwd: string = process.cwd()): SessionManager
static forkFrom(sourcePath: string, targetCwd: string, sessionDir?: string): SessionManager
```
5 static factory methods on `SessionManager`, constructor is `private`. This is excellent — WibWob-DOS partially uses this pattern but could be more disciplined.

**P2 — SettingsManager getter/setter boilerplate**  
`settings-manager.ts` has ~40 getter/setter pairs following identical patterns:
```typescript
getCompactionEnabled(): boolean { return this.settings.compaction?.enabled ?? true; }
setCompactionEnabled(enabled: boolean): void {
  if (!this.globalSettings.compaction) { this.globalSettings.compaction = {}; }
  this.globalSettings.compaction.enabled = enabled;
  this.markModified("compaction", "enabled");
  this.save();
}
```
Each pair is 4-8 lines. Could be codegen'd or use `Proxy`, but the explicitness is arguably readable.

### 1.4 Error Handling

**P1 — Pattern: Catch-stringify-report**  
The dominant error handling pattern across the codebase:
```typescript
// runner.ts (repeated ~15 times)
try {
  const handlerResult = await handler(event, ctx);
  // ...
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  this.emitError({
    extensionPath: ext.path,
    event: event.type,
    error: message,
    stack,
  });
}
```
This is defensive and correct for extension isolation — a misbehaving extension can't crash the host. But the pattern is copy-pasted ~15 times in `runner.ts`. Could be extracted to a helper.

**P0 — Absence: Zero custom Error subclasses**  
No `class FooError extends Error` anywhere in the core packages. All errors are plain `Error` with string messages, or `{ error: string }` objects. This means catch sites can't discriminate error types:
```typescript
// sdk.ts:161 — string matching is the error discrimination mechanism
throw new Error(
  `No API key found for "${resolvedProvider}". ` +
  `Set an API key environment variable or run '/login ${resolvedProvider}'.`,
);
```
WibWob-DOS should **not** copy this pattern — custom error classes enable better error routing.

**P1 — Pattern: Graceful degradation in settings**  
```typescript
// settings-manager.ts
private static tryLoadFromStorage(
  storage: SettingsStorage,
  scope: SettingsScope,
): { settings: Settings; error: Error | null } {
  try {
    return { settings: SettingsManager.loadFromStorage(storage, scope), error: null };
  } catch (error) {
    return { settings: {}, error: error as Error };
  }
}
```
Error recovery with empty defaults. Good pattern for configuration — system continues with defaults rather than crashing.

### 1.5 Type Usage

**P0 — `any` usage: 83 occurrences, mostly intentional**

| Category | Count | Example |
|----------|-------|---------|
| `catch (error: any)` | ~12 | `read.ts:204`, `find.ts:266`, `ls.ts:90,159` |
| `Model<any>` | ~25 | Unavoidable — Model is generic over Api type |
| `AgentTool<any>` | ~15 | Same — tool schema is generic |
| `as any` | ~5 | `(event.message as any).errorMessage` |
| Actual unsafe `any` | ~10 | `grep.ts:241 let event: any` |

The `Model<any>` and `AgentTool<any>` uses are structural — the generic parameter is the API type, and many contexts work with heterogeneous models. The `catch (error: any)` pattern is pre-TypeScript 4.4 style; modern code should use `catch (error: unknown)`.

**P0 — Strength: Excellent discriminated union design**  
```typescript
// types.ts — SessionEntry union
export type SessionEntry =
  | SessionMessageEntry
  | ThinkingLevelChangeEntry
  | ModelChangeEntry
  | CompactionEntry
  | BranchSummaryEntry
  | CustomEntry
  | CustomMessageEntry
  | LabelEntry
  | SessionInfoEntry;
```
All members share `type: string` discriminant. Pattern used consistently for:
- `SessionEvent` (11 variants)
- `ToolCallEvent` (8 variants)
- `ToolResultEvent` (8 variants)
- `ExtensionEvent` (full union, ~25 variants)
- `AgentEvent` (10 variants)
- `InputEventResult` (3 variants)

This is the gold standard for TypeScript event systems. WibWob-DOS uses this pattern partially but could be more systematic.

**P1 — Strength: Typed function overloads for type narrowing**  
```typescript
// types.ts:773-789 — isToolCallEventType overloads
export function isToolCallEventType(toolName: "bash", event: ToolCallEvent): event is BashToolCallEvent;
export function isToolCallEventType(toolName: "read", event: ToolCallEvent): event is ReadToolCallEvent;
// ... 5 more overloads
export function isToolCallEventType<TName extends string, TInput extends Record<string, unknown>>(
  toolName: TName, event: ToolCallEvent,
): event is ToolCallEvent & { toolName: TName; input: TInput };
```
This is sophisticated TypeScript — built-in tools narrow automatically, custom tools require explicit type parameters. The explanation comment is excellent.

**P1 — Strength: `ReadonlySessionManager` pick type**  
```typescript
export type ReadonlySessionManager = Pick<
  SessionManager,
  "getCwd" | "getSessionDir" | "getSessionId" | "getSessionFile" | "getLeafId" | ...
>;
```
Clean read-only facade via `Pick` — extensions get read access without mutation. WibWob-DOS uses `Readonly<T>` for similar effect but `Pick` is better when the read surface is a subset.

**P2 — `CustomAgentMessages` declaration merging pattern**  
```typescript
// types.ts:239-245
export interface CustomAgentMessages {
  // Empty by default - apps extend via declaration merging
}
export type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];
```
Open-ended extensibility via module augmentation. Elegant but potentially confusing — documented with example which helps.

### 1.6 Module Structure

**P1 — Strength: Clean barrel exports with explicit re-exports**  
`extensions/index.ts` is 120 lines of explicit `export type { ... } from "./types.js"` with alphabetical organization and section comments. No `export *` — every export is deliberate.

**P1 — Strength: Index files are re-export-only**  
All index files are pure re-exports. No logic in barrel files. `core/index.ts`, `tools/index.ts`, `extensions/index.ts` all follow this pattern.

**P1 — Pattern: `.js` extension in imports**  
All relative imports use `.js` extensions:
```typescript
import type { EventBus } from "../event-bus.js";
import { execCommand } from "../exec.js";
```
Required for ESM compatibility. Consistent across all packages.

**P2 — Circular dependency prevention note in loader.ts**  
```typescript
// NOTE: This import works because loader.ts exports are NOT re-exported from index.ts,
// avoiding a circular dependency. Extensions can import from @mariozechner/pi-coding-agent.
import * as _bundledPiCodingAgent from "../../index.js";
```
Explicit documentation of why something works — excellent practice.

### 1.7 Import Discipline

**P0 — Strength: `type` imports used consistently**  
```typescript
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent, Model } from "@mariozechner/pi-ai";
```
Every import that's type-only uses `import type`. This is important for bundle size and avoids side effects. Checked across all packages — near 100% compliance.

**P1 — Pattern: Package imports grouped logically**  
Standard ordering: Node builtins → external packages → internal cross-package → relative imports. No explicit enforcement tool visible, but consistently followed.

---

## 2. packages/agent (DEEP)

### 2.1 Architecture Quality

**P0 — Strength: Tiny, focused package**  
Only 5 files, 1,952 lines. Clear responsibility boundary:
- `types.ts` (310 lines) — all type definitions
- `agent.ts` (612 lines) — Agent class + state management
- `agent-loop.ts` (682 lines) — pure loop logic
- `proxy.ts` (340 lines) — proxy transport
- `index.ts` (8 lines) — re-exports

This is exemplary package design. Each file has a single clear purpose.

### 2.2 Agent Class Analysis

**P1 — Pattern: State mutation via setters, no reactive system**  
```typescript
setSystemPrompt(v: string) { this._state.systemPrompt = v; }
setModel(m: Model<any>) { this._state.model = m; }
setThinkingLevel(l: ThinkingLevel) { this._state.thinkingLevel = l; }
```
Direct mutation with no validation, no events. The class uses a manual subscriber pattern instead:
```typescript
subscribe(fn: (e: AgentEvent) => void): () => void {
  this.listeners.add(fn);
  return () => this.listeners.delete(fn);
}
```
This works but means state changes are invisible to subscribers unless they happen via the event system. WibWob-DOS's state-service.ts has the same architectural choice.

**P1 — Issue: `any` in Agent state management**  
```typescript
// agent.ts:573
} catch (err: any) {
  const errorMsg: AgentMessage = {
    // ...
    errorMessage: err?.message || String(err),
  } as AgentMessage;
```
The `as AgentMessage` cast at line 589 is unsafe — the constructed object has `role: "assistant"` with fields that don't match the `AssistantMessage` type exactly. Should use a proper constructor/factory.

### 2.3 Agent Loop Design

**P0 — Strength: Clean event stream architecture**  
```typescript
// agent-loop.ts — loop is a pure function that takes config + emit callback
async function runLoop(
  currentContext: AgentContext,
  newMessages: AgentMessage[],
  config: AgentLoopConfig,
  signal: AbortSignal | undefined,
  emit: AgentEventSink,
  streamFn?: StreamFn,
): Promise<void> {
```
The loop has no mutable external state. It receives everything via parameters and communicates only through the `emit` sink. This is **excellent** functional design.

**P1 — Strength: Sequential vs parallel tool execution**  
Clean strategy pattern for tool execution mode. Both `executeToolCallsSequential` and `executeToolCallsParallel` share preparation logic via `prepareToolCall` and differ only in execution order. Well-decomposed.

**P1 — Pattern: Discriminated result types**  
```typescript
type PreparedToolCall = { kind: "prepared"; toolCall: AgentToolCall; tool: AgentTool<any>; args: unknown; };
type ImmediateToolCallOutcome = { kind: "immediate"; result: AgentToolResult<any>; isError: boolean; };
```
Private discriminated unions within the module for internal flow control. Not exported — good encapsulation.

### 2.4 Type Design in types.ts

**P0 — Strength: Rich JSDoc contracts**  
Every config option has detailed JSDoc:
```typescript
/**
 * Converts AgentMessage[] to LLM-compatible Message[] before each LLM call.
 *
 * Contract: must not throw or reject. Return a safe fallback value instead.
 * Throwing interrupts the low-level agent loop without producing a normal event sequence.
 */
convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
```
The "Contract:" prefix pattern appears 4 times in `types.ts`, documenting error handling expectations. This is rare and valuable.

**P1 — Strength: Event union uses inline object types**  
```typescript
export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
  // ...
```
Simple events are inline objects. Complex ones get named interfaces. Good trade-off between brevity and readability.

---

## 3. packages/tui (MEDIUM)

### 3.1 Architecture

**P1 — Strength: Component interface is minimal**  
```typescript
export interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```
4 members, one required. This is the right abstraction level for a terminal UI component. Compare WibWob-DOS's blessed widget API which has 50+ properties.

**P1 — Strength: Focusable as separate interface**  
```typescript
export interface Focusable {
  focused: boolean;
}
export function isFocusable(component: Component | null): component is Component & Focusable {
  return component !== null && "focused" in component;
}
```
Interface segregation — not all components need focus. Type guard for narrowing. Clean.

### 3.2 File Size Distribution

| File | Lines | Assessment |
|------|-------|-----------|
| `editor.ts` | 2,196 | Complex but justified — full text editor |
| `keys.ts` | 1,269 | Key mapping tables — inherently large |
| `tui.ts` | 1,212 | TUI runtime — moderate |
| `utils.ts` | 905 | String/width utilities — could split |
| `markdown.ts` | 811 | Markdown renderer — justified |

No extreme outliers. `utils.ts` at 905 lines is the only candidate for splitting (visible-width utilities vs ANSI utilities).

### 3.3 Type Safety

**P0 — Strength: Minimal `any` (7 occurrences)**  
The TUI package is the cleanest package for type safety. The 7 `any` occurrences are in `markdown.ts` for parsed token types from the markdown parser library (unavoidable external type).

### 3.4 WibWob-DOS Relevance

The pi TUI's `Component` interface is what WibWob-DOS should aspire to. The key insight:
- **Pi**: `render(width) => string[]` — components produce lines, runtime handles display
- **WibWob-DOS/blessed**: widgets own their screen region and render directly

Pi's approach is simpler, more testable, and avoids the blessed focus/z-order/resize complexity that causes WibWob-DOS bugs.

---

## 4. packages/ai (MEDIUM)

### 4.1 Generated Code

**P2 — Note: `models.generated.ts` is 13,608 lines**  
Over half the package (13,608 of 25,139 lines) is generated model definitions. This is appropriate — model catalogs should be generated, not hand-maintained.

### 4.2 Provider Pattern

**P1 — Strength: API registry with late binding**  
```typescript
// stream.ts
function resolveApiProvider(api: Api) {
  const provider = getApiProvider(api);
  if (!provider) {
    throw new Error(`No API provider registered for api: ${api}`);
  }
  return provider;
}
```
Provider implementations register themselves via `register-builtins.ts`. Extensible via runtime registration. Clean adapter pattern.

### 4.3 Type Design

**P1 — Strength: `KnownApi` + `(string & {})` pattern**  
```typescript
export type KnownApi = "openai-completions" | "mistral-conversations" | ... ;
export type Api = KnownApi | (string & {});
```
The `(string & {})` trick gives autocomplete for known values while allowing arbitrary strings. Used for both `Api` and `Provider`. This is a well-known TypeScript pattern but executed cleanly here.

**P1 — Pattern: `SimpleStreamOptions` extends `StreamOptions`**  
The options hierarchy is well-layered:
- `StreamOptions` — base options all providers share
- `SimpleStreamOptions extends StreamOptions` — adds reasoning/thinking
- `ProviderStreamOptions` — provider-specific additions

### 4.4 `any` Usage (61 occurrences)

Higher than expected. Most are in:
- `validation.ts` — Ajv integration (unavoidable, Ajv's types use `any`)
- `env-api-keys.ts:65` — `getEnvApiKey(provider: any)` — should be `string`
- Provider implementations — tool argument handling

---

## 5. Mitsuhiko Extensions (FOCUSED)

### 5.1 Extension Pattern

**P0 — Strength: Canonical extension structure**  
Every extension follows the same pattern:
```typescript
// Module-level: JSDoc header, imports, constants, types, helpers
// Single default export: factory function
export default function extensionName(pi: ExtensionAPI): void {
  // State declarations
  // Tool/command registration
  // Event subscriptions
}
```
14/14 extensions use `export default function`. Zero named exports. This is the correct extension pattern and matches the ExtensionFactory type exactly.

### 5.2 Naming & Organization

**P1 — Strength: Kebab-case filenames matching functionality**  
`session-breakdown.ts`, `prompt-editor.ts`, `go-to-bed.ts`, `multi-edit.ts`. Each file is one extension, one concern.

**P1 — Pattern: Constants block at top**  
```typescript
// todos.ts
const TODO_DIR_NAME = ".pi/todos";
const TODO_PATH_ENV = "PI_TODO_PATH";
const TODO_SETTINGS_NAME = "settings.json";
const TODO_ID_PREFIX = "TODO-";
const TODO_ID_PATTERN = /^[a-f0-9]{8}$/i;
const DEFAULT_TODO_SETTINGS = { gc: true, gcDays: 7 };
const LOCK_TTL_MS = 30 * 60 * 1000;
```
All constants before any functions. Clean and scannable.

### 5.3 Type Safety

**P1 — Issue: 38 `any` occurrences across 14 files**  
For 13,054 lines, that's 2.9 per 1,000 lines (vs coding-agent at 2.1/1,000). Most are in:
- `context.ts` (12) — heaviest `any` user, message manipulation
- `prompt-editor.ts` (12) — TUI component wiring
- `session-breakdown.ts` (7) — session data parsing

### 5.4 State Management Pattern

**P1 — Strength: Closure-based state in extensions**  
```typescript
// loop.ts
export default function loopExtension(pi: ExtensionAPI): void {
  let loopState: LoopStateData = { active: false };

  function persistState(state: LoopStateData): void {
    pi.appendEntry(LOOP_STATE_ENTRY, state);
  }

  function setLoopState(state: LoopStateData, ctx: ExtensionContext): void {
    loopState = state;
    persistState(state);
    updateStatus(ctx, state);
  }
```
Module-scoped mutable state via closure. Simple, no class needed. State is restored from session entries on startup:
```typescript
pi.on("session_start", async (_event, ctx) => {
  await restoreLoopState(ctx);
});
```

### 5.5 UI Composition

**P1 — Pattern: Inline component construction for custom UI**  
```typescript
// loop.ts:262-286
const selection = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const container = new Container();
  container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
  container.addChild(new Text(theme.fg("accent", theme.bold("Select a loop preset"))));
  const selectList = new SelectList(items, Math.min(items.length, 10), { ... });
  selectList.onSelect = (item) => done(item.value);
  selectList.onCancel = () => done(null);
  container.addChild(selectList);
  return {
    render(width) { return container.render(width); },
    invalidate() { container.invalidate(); },
    handleInput(data) { selectList.handleInput(data); tui.requestRender(); },
  };
});
```
Components are composed inline via Container + children. The `custom<T>()` generic pattern provides typed completion. This is what WibWob-DOS's microapp pattern should aspire to — the SDK provides the scaffold, extensions provide the content.

### 5.6 notify.ts — Exemplar Small Extension

**P0 — Strength: Perfect small extension** (88 lines)  
```typescript
export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (event) => {
    const lastText = extractLastAssistantText(event.messages ?? []);
    const { title, body } = formatNotification(lastText);
    notify(title, body);
  });
}
```
One event subscription. Pure helper functions. No state. No tools. Shows extensions can be tiny and focused.

---

## 6. packages/web-ui, mom, pods (LIGHT)

### 6.1 web-ui (71 files, 14,617 lines)
Lit-based web components. Uses `@customElement` decorators, `html` template literals. Standard web component patterns. No unusual style issues.

### 6.2 mom (16 files, 4,048 lines)
Multi-agent orchestration package. Clean separation between agent definitions and orchestration logic.

### 6.3 pods (9 files, 1,773 lines)
Container/pod abstraction. Small, focused. Uses Docker/Podman APIs.

---

## Cross-Cutting Findings

### Strength Summary

| # | Finding | Priority | Impact |
|---|---------|----------|--------|
| S1 | String literal unions over enums everywhere | P0 | Correct modern TS |
| S2 | Discriminated unions for all event systems | P0 | Excellent type narrowing |
| S3 | `import type` consistently used | P0 | Bundle correctness |
| S4 | Agent loop is pure — no mutable external state | P0 | Testable, predictable |
| S5 | Factory methods over public constructors | P1 | Controlled construction |
| S6 | Extension isolation via try/catch per handler | P1 | Fault tolerance |
| S7 | Component interface is minimal (4 members) | P1 | Right abstraction |
| S8 | JSDoc "Contract:" pattern in agent types | P1 | Error behavior documented |
| S9 | `.js` extensions in all imports | P1 | ESM compliant |
| S10 | Barrel exports are explicit, no `export *` | P1 | Tree-shakeable |

### Issue Summary

| # | Finding | Priority | Impact |
|---|---------|----------|--------|
| I1 | `interactive-mode.ts` at 4,442 lines | P0 | Unmaintainable god file |
| I2 | Zero custom Error classes | P0 | Can't discriminate errors |
| I3 | `catch (error: any)` pattern (pre-TS 4.4) | P1 | Should be `unknown` |
| I4 | Extension error handling copy-pasted 15× | P1 | Should extract helper |
| I5 | Settings getter/setter boilerplate (~40 pairs) | P2 | Verbose but readable |
| I6 | `any` in 83 places (coding-agent) | P1 | Most intentional, ~10 unsafe |
| I7 | Agent.ts `as AgentMessage` unsafe cast | P1 | Error message construction |

---

## WibWob-DOS Recommendations

### Learn From

1. **String literal unions instead of enums** — WibWob-DOS uses some enums; migrate to unions
2. **Discriminated union event system** — WibWob-DOS's command system could use `type` discriminants
3. **`import type` discipline** — WibWob-DOS is inconsistent; enforce via biome/eslint
4. **Factory methods with private constructors** — `SessionManager.create()` > `new SessionManager()`
5. **`ReadonlyX = Pick<X, read-methods>` pattern** — better than `Readonly<X>` for facades
6. **Component interface: `render(width) => string[]`** — blessed equivalent would be cleaner
7. **Extension closure state pattern** — microapps could use this instead of class state
8. **"Contract:" JSDoc prefix** — document error handling expectations in key interfaces

### Avoid

1. **4,400-line god files** — WibWob-DOS already has `app-controller.ts` trending this way
2. **No custom Error classes** — WibWob-DOS should keep its typed errors
3. **`catch (error: any)`** — use `catch (error: unknown)` with type guards
4. **Copy-pasted error handling blocks** — extract to a `safeCall` helper
5. **40 getter/setter pairs** — if WibWob-DOS settings grow, use a generic accessor pattern

### Architecture Patterns Worth Adopting

The **extension system architecture** (loader → runner → wrapper → types) is a model for WibWob-DOS's microapp system:
- **Loader**: discovers, validates, creates API instances (immutable after load)
- **Runner**: orchestrates lifecycle, creates contexts, dispatches events
- **Wrapper**: adapts extension tools to runtime tool interface
- **Types**: 1,400 lines of pure types with zero logic

This separation means the types file can be imported without side effects, the loader can be tested without a runner, and the wrapper is trivially simple.

---

*Generated by TypeScript style forensics analysis, 2026-03-16*
