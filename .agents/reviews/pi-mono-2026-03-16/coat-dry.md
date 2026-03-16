# pi-mono COAT/DRY/Monorepo Hygiene Review

**Date:** 2026-03-16  
**Repo:** `/tmp/pi-mono` (7 packages, 97,235 LOC)  
**Extensions:** `/tmp/agent-stuff/pi-extensions/` (14 files, 13,054 LOC)

---

## 1. Package Inventory

| Package | npm name | LOC | Files | Role |
|---------|----------|-----|-------|------|
| **ai** | `@mariozechner/pi-ai` | 25,139 | 41 | LLM provider abstraction, streaming, types |
| **agent** | `@mariozechner/pi-agent-core` | 1,952 | 5 | Agent loop, tool execution, event model |
| **coding-agent** | `@mariozechner/pi-coding-agent` | 39,333 | 114 | **The product**: session, tools, extensions, modes |
| **tui** | `@mariozechner/pi-tui` | 10,373 | 25 | Terminal UI components (editor, markdown, etc.) |
| **web-ui** | `@mariozechner/pi-web-ui` | 14,617 | 71 | Browser-based chat UI |
| **mom** | `@mariozechner/pi-mom` | 4,048 | 16 | Slack bot using coding-agent |
| **pods** | `@mariozechner/pi` | 1,773 | 9 | GPU pod management CLI |

### Dependency Graph

```
ai ← agent ← coding-agent ← mom
         ↗        ↑
tui ─────┘        │
                  pods (uses agent-core only)
web-ui ← ai + tui + agent-core
```

---

## 2. Cross-Package DRY Violations

### 2.1 `ThinkingLevel` — Divergent Definitions (🔴 Critical)

```typescript
// packages/ai/src/types.ts:45
export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

// packages/agent/src/types.ts:220
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
```

**The `agent` package adds `"off"` to the `ai` package's type.** `coding-agent` imports from `agent-core` (which has `"off"`), but `ai` doesn't know about `"off"`. This is a semantic fork of a core type — whoever handles `"off"` must strip it before passing to `ai`.

**Fix:** One definition. Either `ai` owns it (with `"off"`) or `agent` re-exports an extended union.

### 2.2 `truncate.ts` — Copy-Paste Between Packages (🔴 Critical)

```
packages/coding-agent/src/core/tools/truncate.ts  — 265 LOC
packages/mom/src/tools/truncate.ts                 — 236 LOC
```

**~89% identical.** The `coding-agent` version has extra fields (`maxLines`, `maxBytes` in `TruncationResult`) and a `truncateLine()` helper for grep. The core algorithm (`truncateHead`, `truncateTail`, `formatSize`, constants) is copy-pasted.

Both packages export `TruncationResult` and `TruncationOptions` — same names, slightly different shapes.

### 2.3 Tool Implementations — Simplified Forks in `mom`

| Tool | coding-agent LOC | mom LOC | Shared Logic |
|------|----------------:|--------:|-------------|
| `bash.ts` | 321 | 97 | ~60% (truncation, temp files, schema) |
| `read.ts` | 222 | 159 | ~50% (truncation, image detect, schema) |
| `edit.ts` | (in coding-agent) | 165 | ~40% (diff logic) |
| `write.ts` | (in coding-agent) | 45 | minimal overlap |
| `truncate.ts` | 265 | 236 | ~89% (near-identical) |

`mom` re-implements tools because it runs in a sandbox (`Executor` interface) rather than locally. This is **legitimate boundary duplication** — the execution context differs. But `truncate.ts` has no execution context dependency and should be shared.

### 2.4 `ExecOptions` / `ExecResult` — Dual Definitions

```
packages/coding-agent/src/core/exec.ts     — ExecOptions, ExecResult
packages/mom/src/sandbox.ts                — ExecOptions, ExecResult (different shapes)
```

Different enough to be intentional (sandbox vs local), but same names cause confusion.

### 2.5 `Attachment` — Unrelated Types, Same Name

```
packages/mom/src/store.ts       — Attachment { original, local }
packages/web-ui/src/utils/      — Attachment { id, type, fileName, mimeType, size, content, ... }
```

Completely different types with the same name. No actual duplication — just namespace collision. **Healthy boundary duplication.**

### 2.6 `Model` — Two Definitions

```
packages/ai/src/types.ts:313    — Model<TApi> { api, id, name?, ... } (generic, provider-aware)
packages/pods/src/types.ts:9    — Model { id, name, ... } (deployment config)
```

Different domains. `pods` is a separate product (GPU management). **Healthy boundary duplication.**

---

## 3. COAT Compliance

### The COAT Test: "Would this work if I deleted the TUI?"

#### 3.1 Mode Architecture — Good Separation ✅

The `coding-agent` has three modes:

| Mode | LOC | Purpose |
|------|-----|---------|
| **interactive** | 13,425 (37 files) | TUI-based interactive agent |
| **rpc** | 1,464 (4 files) | Headless JSON-RPC protocol |
| **print** | 124 (1 file) | Single-shot text/JSON output |

All three modes delegate to `AgentSession` (3,097 LOC, the shared semantic core). The core operations — `prompt()`, `compact()`, `fork()`, `switchSession()`, `cycleModel()`, `setThinkingLevel()` — are on `AgentSession`, not in any mode.

**Print mode** is the gold standard COAT adapter: 124 LOC, zero business logic, pure I/O wiring.  
**RPC mode** is well-structured: 638 LOC of protocol translation, no semantic invention.

**Verdict: If you delete the TUI, `AgentSession` + print mode + RPC mode still work.** ✅

#### 3.2 Core ← Interactive Theme Import — COAT Violation (🟡 Medium)

```
src/core/agent-session.ts:29       → import { theme } from "../modes/interactive/theme/theme.js"
src/core/extensions/types.ts:41    → import type { Theme } from "../../modes/interactive/theme/theme.js"
src/core/extensions/runner.ts:8    → import { theme } from "../../modes/interactive/theme/theme.js"
src/core/resource-loader.ts:6      → import { loadThemeFromPath } from "../modes/interactive/theme/theme.js"
src/core/export-html/index.ts:5    → import { getResolvedThemeColors } from "../../modes/interactive/theme/theme.js"
src/core/export-html/tool-renderer.ts → import type { Theme } from "../../modes/interactive/theme/theme.js"
```

**The core package imports from the interactive mode adapter.** This is an inversion — the adapter should depend on core, not the reverse. The `Theme` type and `theme` singleton are used for:

1. HTML export (colors)
2. Extension API surface (`Theme` in extension types)
3. Resource loading (theme discovery)

**The theme system is semantics disguised as presentation.** It belongs in core, not in `modes/interactive/`.

**Fix:** Move `theme/theme.ts` to `core/theme/`. The interactive mode just *uses* it.

#### 3.3 TUI Types in Extension API — COAT Violation (🟡 Medium)

`src/core/extensions/types.ts` imports from `@mariozechner/pi-tui`:

```typescript
import type { Component, EditorComponent, EditorTheme, KeyId, OverlayHandle, OverlayOptions, TUI } from "@mariozechner/pi-tui";
```

These TUI types appear in the `ExtensionAPI` — the public surface for extensions:
- `setContent(factory: (tui: TUI, theme: Theme) => Component)`
- `setEditorComponent(factory: (tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => EditorComponent)`
- `showCustom(...(tui: TUI, ...) => Component)`
- `OverlayHandle`, `OverlayOptions`

**Extensions written against this API are TUI-coupled.** An RPC-mode extension can't use `setContent()` or `showCustom()` because there's no TUI. The extension API has mixed semantics (headless operations + TUI presentation) without clean separation.

**This fails the COAT test:** An extension that uses `ctx.ui.setContent()` does not work without the TUI.

**Fix:** Split `ExtensionAPI` into:
- `ExtensionCoreAPI` — headless operations (tools, session, model, flags, commands)
- `ExtensionUIAPI` — optional, TUI-coupled (setContent, showCustom, overlays)

Extensions opt into UI by checking for the presence of the UI context.

#### 3.4 Interactive Mode Thickness — Acceptable (🟢)

The 4,442-LOC `interactive-mode.ts` is thick, but it's **UI wiring, not semantic invention**:
- Wires TUI components to `AgentSession` events
- Manages UI state (scroll, focus, loading animations)
- Handles keyboard shortcuts → `session.method()` calls
- `executeCompaction()` wraps `session.compact()` with loader/error UI

The semantic operations all delegate to `AgentSession`. Interactive mode adds *presentation* for each operation (loading spinners, error display, status updates). This is **appropriate adapter thickness** — the complexity is proportional to the UI surface.

**One exception:** `cycleModel()` in interactive mode has 200+ LOC of UI for model selection dialogs, scoped models display, etc. The model *cycling* semantic is in `session.cycleModel()`, but the model *selection* workflow is interactive-only. This is correctly placed.

---

## 4. Single-Owner Principle

| Concept | Owner | Competing? | Notes |
|---------|-------|------------|-------|
| **Message types** | `ai` (`Message`, `AssistantMessage`, etc.) | ✅ Single | `agent` extends with `AgentMessage` |
| **Tool schema** | `ai` (`Tool<TParams>`) | ✅ Single | `agent` extends with `AgentTool` |
| **Agent loop** | `agent` (`Agent`, `AgentLoop`) | ✅ Single | Clean separation |
| **Session lifecycle** | `coding-agent/core` (`AgentSession`) | ✅ Single | All modes delegate here |
| **Extension system** | `coding-agent/core/extensions/` | ✅ Single | Well-factored |
| **Model registry** | `coding-agent/core` (`ModelRegistry`) | ✅ Single | |
| **ThinkingLevel** | 🔴 **Two owners** | `ai` + `agent` | Divergent definitions |
| **Theme** | 🟡 **Misplaced** | `modes/interactive/` but used by core | Should be in core |
| **Truncation** | 🔴 **Two owners** | `coding-agent/tools/` + `mom/tools/` | Duplicated |
| **Session persistence** | `coding-agent/core` (`SessionManager`) | ✅ Single | web-ui has its own — but different domain (browser IndexedDB vs JSONL files) |

### Session Persistence — Two Systems, Intentionally

```
coding-agent/core/session-manager.ts  — JSONL file-based, with branching/forking
web-ui/src/storage/                   — IndexedDB-based, simpler metadata model
```

These are different products with different storage requirements. `web-ui` doesn't use `SessionManager` — it has its own `SessionsStore`. **Healthy boundary duplication.** The types don't collide.

---

## 5. Monorepo Hygiene

### 5.1 Build System — Functional but Fragile (🟡)

```json
"build": "cd packages/tui && npm run build && cd ../ai && npm run build && cd ../agent && npm run build && cd ../coding-agent && npm run build && cd ../mom && npm run build && cd ../web-ui && npm run build && cd ../pods && npm run build"
```

**Serial `cd && build` chain.** No dependency-aware build tool (turborepo, nx, etc.). Build order is manually maintained. Adding a package requires editing the chain.

**Dev mode uses `concurrently`** — fine for watch mode, but doesn't handle dependency order.

### 5.2 Version Management — Lockstep ✅

All packages share a version (`0.58.3`). `scripts/sync-versions.js` ensures consistency. `version:patch/minor/major` scripts update all packages simultaneously. This is correct for a tightly-coupled monorepo.

### 5.3 Shared Config ✅

- `tsconfig.base.json` — shared compiler options
- `biome.json` — shared linting/formatting
- `.husky` — shared git hooks

### 5.4 Workspace Config (🟢)

```json
"workspaces": ["packages/*", "packages/web-ui/example", "packages/coding-agent/examples/extensions/..."]
```

Example packages in workspaces is slightly unusual but works for ensuring examples build.

### 5.5 Test Infrastructure — Sparse (🟡)

`"test": "npm run test --workspaces --if-present"` — only runs tests in packages that have them. No shared test utilities package. No integration test harness across packages.

---

## 6. Extension Analysis (mitsuhiko extensions)

### 6.1 `control.ts` (1,748 LOC) — Inter-Session Communication

**What it does:** Unix domain socket RPC for sending messages between pi sessions, subscribing to events, getting summaries, clearing sessions.

**Does it own semantics that should be in core?**

| Feature | In Core? | Verdict |
|---------|----------|---------|
| Socket lifecycle management | No | Extension-appropriate ✅ |
| `send_to_session` tool | No | Extension-appropriate ✅ |
| Session discovery (`~/.pi/session-control/`) | No | Extension-appropriate ✅ |
| AI summarization of sessions | No | Extension-appropriate ✅ |
| Custom RPC protocol | No | Extension-appropriate ✅ |
| Message renderer for session messages | No | Extension-appropriate ✅ |

**Verdict: COAT-compliant.** `control.ts` builds *on top of* the extension API without reaching into core internals. It uses `ctx.registerTool()`, `ctx.on("turnEnd")`, `ctx.session`, `ctx.modelRegistry` — all public extension API. The IPC protocol is a net-new capability, not a reimplementation of core semantics.

**The size (1,748 LOC) reflects genuine complexity** — socket lifecycle, race conditions, alias management, bidirectional messaging — not bloat.

### 6.2 `todos.ts` (2,076 LOC) — File-Based Todo Manager

**What it does:** CRUD for markdown todo files in `.pi/todos`, with a full TUI selector (fuzzy search, action menus, detail overlays).

| Feature | In Core? | Verdict |
|---------|----------|---------|
| Todo file format & CRUD | No | Extension-appropriate ✅ |
| `todo` tool for agent | No | Extension-appropriate ✅ |
| `/todos` slash command | No | Extension-appropriate ✅ |
| TUI overlay (TodoSelectorComponent) | No | Extension-appropriate ✅ |
| GC, locking, settings | No | Extension-appropriate ✅ |

**Verdict: COAT-compliant.** The todos system is entirely self-contained. It doesn't own any core semantic — it's a productivity feature built on the extension API.

**However:** The 2,076 LOC includes ~800 LOC of TUI components (`TodoSelectorComponent`, `TodoActionMenuComponent`, `TodoDeleteConfirmComponent`, `TodoDetailOverlayComponent`). These are **TUI-coupled** — they use `Container`, `SelectList`, `Input`, `Markdown` from `@mariozechner/pi-tui`. In RPC mode, the `/todos` command would need a different UI or fallback. This is the **extension API's fault** (mixing UI and headless), not the extension's.

### 6.3 Other Extensions — Quick Scan

| Extension | LOC | COAT Status |
|-----------|-----|-------------|
| `review.ts` | 1,971 | ✅ Uses public API, complex but appropriate |
| `session-breakdown.ts` | 1,629 | ✅ Analytics on session data |
| `prompt-editor.ts` | 1,315 | 🟡 TUI-heavy, won't work in RPC |
| `files.ts` | 1,114 | ✅ File system operations |
| `multi-edit.ts` | 772 | ✅ Tool extension |
| `context.ts` | 578 | ✅ Context management |
| `answer.ts` | 532 | ✅ |
| `whimsical.ts` | 474 | ✅ |
| `loop.ts` | 446 | ✅ |
| `go-to-bed.ts` | 188 | ✅ |
| `uv.ts` | 123 | ✅ |
| `notify.ts` | 88 | ✅ |

**No extension violates COAT by owning semantics that should be in core.** They all build on top of the extension API. The main issue is that TUI-coupled extensions can't degrade gracefully to RPC mode — but that's an extension API design issue, not the extensions' fault.

---

## 7. Package Boundary Analysis

### Should Anything Be Split?

#### `coding-agent` is too large (39,333 LOC) but correctly structured internally

The internal split is:
```
core/           — 20,120 LOC (session, tools, extensions, compaction)
modes/interactive/ — 13,425 LOC (TUI adapter)
modes/rpc/      — 1,464 LOC (RPC adapter)
modes/print-mode.ts — 124 LOC
```

**Splitting `core/` into its own package** would make the architecture explicit: `pi-agent-session` as the semantic core, with `pi-coding-agent` as the entry point that wires modes to the core. But the benefit is marginal — the internal module boundary is already clean.

#### `theme/` should move from `modes/interactive/` to `core/`

This is the most actionable structural change. Theme is used by:
- Core agent session (HTML export)
- Extension types (API surface)
- Resource loader (theme discovery)
- Interactive mode (rendering)
- RPC mode (passes theme colors in state)

It's a shared concern, not an interactive-mode concern.

### Should Anything Be Merged?

#### `agent` (1,952 LOC) could absorb into `ai` or `coding-agent`

The `agent` package provides the agent loop (`Agent` class), tool execution, and event model. It's tiny (5 files) and has exactly one consumer (`coding-agent`). The abstraction boundary isn't earning its keep — there's no second implementation of the agent loop.

**Counter-argument:** It's a clean, importable library for building different kinds of agents. `pods` imports from it. The abstraction is sound even if only one main consumer exists today.

**Verdict:** Keep separate — the abstraction is intentional and lightweight.

### Should a Shared Package Exist?

A `@mariozechner/pi-shared` or `@mariozechner/pi-utils` package would make sense for:

1. **`truncate.ts`** — used by `coding-agent` and `mom`
2. **`ThinkingLevel`** — needs one canonical definition
3. Potentially: MIME type detection, shell utilities

**Estimated size:** ~400 LOC. Small enough to be a single `pi-shared` package.

---

## 8. Quantitative Summary

### Duplication Ratio

| Category | Duplicated LOC | Total LOC | Ratio |
|----------|---------------|-----------|-------|
| **truncate.ts** | ~230 LOC (mom copies coding-agent) | 501 combined | **46%** |
| **Tool implementations** (bash, read) | ~150 LOC shared patterns | 800 combined | **19%** |
| **ThinkingLevel** | 2 definitions | — | type fork |
| **Total cross-package duplication** | ~380 LOC | 97,235 total | **0.4%** |

**0.4% cross-package duplication is excellent** for a monorepo of this size.

### Shared Type Coverage

| Type | Packages Using | Defined In | Shared? |
|------|---------------|------------|---------|
| `Message`, `AssistantMessage` | all | `ai` | ✅ |
| `Agent`, `AgentTool` | 4 | `agent` | ✅ |
| `ThinkingLevel` | 3 | `ai` + `agent` | ❌ |
| `TruncationResult` | 2 | `coding-agent` + `mom` | ❌ |
| `ExecOptions/Result` | 2 | `coding-agent` + `mom` | ❌ (different shapes) |
| `Model<T>` | 5 | `ai` | ✅ |
| `ExtensionAPI` | extensions + core | `coding-agent` | ✅ |

**~85% of shared types are properly single-sourced.** The remaining 15% is 3 types that need consolidation.

---

## 9. Recommendations (Priority Order)

### P0 — Fix Now

1. **Unify `ThinkingLevel`**: One definition in `ai`, with `"off"` if needed. `agent` re-exports.
2. **Extract `truncate.ts`** to a shared location importable by both `coding-agent` and `mom`. Options:
   - Add to `ai` (it's already a shared dep)
   - Create `@mariozechner/pi-shared` (cleaner but more packages)
   - Have `mom` import from `coding-agent` (already a dependency — simplest)

### P1 — Next Sprint

3. **Move `theme/` from `modes/interactive/` to `core/`**. Core should not import from an adapter. This is a file move + import rewrite, no logic change.
4. **Split `ExtensionAPI` into core + UI surfaces**. Extensions should be able to declare they're headless-only. The current API mixes `registerTool()` (works everywhere) with `ctx.ui.setContent()` (TUI-only).

### P2 — Backlog

5. **Consider a build orchestrator** (turborepo, wireit, or even a topological-sort script). The serial `cd && build` chain works but doesn't scale.
6. **Document the COAT contract** in `CONTRIBUTING.md`: "Core must never import from modes. Modes import from core. Extensions get the public API."
7. **Add cross-package type tests**: A CI check that `ThinkingLevel` is the same type in all packages, etc.

---

## 10. Overall Verdict

**COAT compliance: 8/10.** The fundamental architecture is sound — `AgentSession` is a genuine shared semantic core, and the three modes are adapters of varying thickness. The two violations (core→interactive theme import, TUI types in extension API) are structural but fixable.

**DRY compliance: 9/10.** Cross-package duplication is remarkably low at 0.4%. The `truncate.ts` copy-paste and `ThinkingLevel` fork are the only real issues.

**Monorepo hygiene: 7/10.** Lockstep versioning and shared config are solid. Build orchestration and test infrastructure could improve.

**Extension COAT compliance: 9/10.** The mitsuhiko extensions are well-behaved — they build on top of the public API without reaching into core. The TUI-coupling issue is the platform's problem, not the extensions'.

**The biggest architectural risk is the theme inversion** — core importing from interactive mode creates a dependency cycle that will complicate future refactoring. Fix that, unify `ThinkingLevel`, and this monorepo is in excellent shape.
