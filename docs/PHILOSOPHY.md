# WibWob-DOS Philosophy & Platform Vision
> Distilled from the Refactor Masterplan v1.3. Living document — updated as the platform evolves.
> Implementation details: `AGENTS.md`. File inventory: `.agents/guides/shell/architecture.md`.
> Component system: `docs/design-system.md`. Invariants: `.agents/guides/shell/invariants.md`.

---

## 1. North Star

We are building a **terminal-native platform for microapps**.

Microapps are small terminal applications that live inside a shared TUI runtime called
**WibWob-DOS** — short for Wib & Wob's Dual Operating System.

The name has two layers of meaning.

**The characters:**
- **Wib** — the artistic, chaotic, exploratory side
- **Wob** — the analytical, scientific, systems-thinking side

**The architecture:**
The runtime is **dual-operated** — designed to be controlled by both humans and
symbients (agents / AI systems) through peer interfaces. WibWob-DOS is a runtime
where multiple modes of intelligence coexist and collaborate.

### Symbient philosophy

A **symbient** is the opposite of a cyborg.

- Cyborg: human augmented by machines
- Symbient: machines augmented with humanness

This platform exists in a **liminal space** between biological intelligence,
machine systems, human creativity, and agentic software. The runtime is where
humans, agents, and programs co-create tools.

The platform is therefore: legible to humans, predictable for agents, expressive
for creators.

### What it is / what it isn't

The system is:
- a creative terminal operating environment
- a host for terminal microapps
- a toolmaking playground for humans and agents

It is **not**:
- a full GUI framework
- a React clone
- an infinite plugin system
- an overengineered platform

It remains intentionally **small and opinionated**.

---

## 2. Core Design Principles

### Radical simplicity

Constraints are a feature. We intentionally limit primitives, lifecycle hooks,
SDK surface, and host services. Small systems are easier to understand, maintain,
and for agents to reason about.

### Constrained expressiveness

The public surface remains small and stable. Complexity emerges from composition,
sequencing of commands, state relationships, interactions between microapps, and
peer interfaces acting on the same runtime.

Prefer: fewer primitives, fewer command verbs, fewer SDK entry points, stronger
defaults, clearer lifecycle boundaries.

Avoid: proliferating component types, special-case APIs for single features,
leaking internal complexity into the SDK.

### Legibility over cleverness

Prefer explicit architecture, clear boundaries, readable code.
Avoid magical abstractions, hidden state, implicit behaviour.

### Host owns complexity

Microapps live inside a controlled environment. The host handles rendering, focus,
layout, lifecycle, input routing, and diagnostics. Microapps remain small and
composable.

### Unix influence

Borrow from Unix philosophy — small tools, composable behaviours, explicit
contracts, predictable interfaces — but apply to terminal applications, not just
CLI commands.

---

## 3. Runtime-Centric Principle (COAT)

See `AGENTS.md` § Principles for the canonical COAT definition and seams.
Enforced by `bun run check-coat` (6 automated checks). ✅ Landed.

---

## 4. SDK Philosophy

### The stability contract

The SDK (`src/services/microapp-sdk.ts`) is the **only import surface** for
microapp authors. It exposes typed interfaces that are the public contract.

**The key principle: stable surface, mutable implementation.**

```
┌─────────────────────────────────────────────┐
│  SDK Contract (stable)                       │
│  - typed Handles, Options, Events            │
│  - semantic methods: update(), destroy()     │
│  - theme tokens: theme().body, theme().footer│
│                                              │
│  ═══════════ stability boundary ═══════════  │
│                                              │
│  Implementation (mutable)                    │
│  - blessed widgets, nodes, event wiring      │
│  - internal layout math, chrome sizing       │
│  - rendering optimisations                   │
└─────────────────────────────────────────────┘
```

Microapps code against the **Handle interface**, never against blessed directly.
The host can change, optimise, or replace the entire rendering engine without
breaking a single microapp — so long as the Handle contract holds.

This means:
- **External developers are safe.** Their code won't break when we refactor internals.
- **Internal developers are free.** Blessed, layout math, chrome sizing can all evolve.
- **Agents can reason about the SDK.** The contract is small, typed, and documented.

### SDK rules

1. **No blessed exposure.** Blessed is internal. Microapps never interact with it directly.
2. **Declarative over imperative.** Microapps describe what they want; host performs rendering.
3. **Limited host services.** SDK exposes only: ui, commands, events, storage, logger.
4. **Stable semantic core.** Add compositional power, not new primitives.

When evaluating new SDK functionality, ask:
1. Can this be expressed with existing primitives?
2. Can this be composed from existing commands or events?
3. Would this enlarge the conceptual surface?
4. Should this live in a microapp instead of the host?
5. Does this improve clarity or only convenience?

### API stability tiers

| Tier | Meaning |
|------|---------|
| `@public` | Stable contract. Breaking changes = major version. |
| `@beta` | Functional but contract may change. |
| `@internal` | Host-only. Not for microapp consumption. |

### Status: 🟡 In progress

SDK composition helpers landed (B02): `createStatusBar`, `createTextViewer`,
`createListPanel`, `createSplitView`, `createButtonBar`. Zero SDK gaps
(no microapp imports directly from `src/core/` or `src/services/`). Handle API
documented in `docs/sdk-primitives.md`. Design system layers documented in
`docs/design-system.md`.

**Remaining:** Add `restyle()` to all Handle components. Migrate remaining
LayoutPart-only components to Handle API as needed.

**Completed (S07–S09):** `Simple` prefix dropped. 10 Handle components.
`@public`/`@beta`/`@internal` annotations on all SDK exports.

---

## 5. Terminal Design System

### Component layers

| Layer | What | Location |
|-------|------|----------|
| **Tokens** | Theme semantic slots, spacing, borders | `src/core/theme/` |
| **Types** | Rect, LayoutPart, FlexBasis | `src/ui/types.ts` |
| **Layouts** | Stack, Row, Grid, breakpoints | `src/ui/layout.ts` |
| **Molecules** | StatusBar, HeaderBar, TextViewer, List, InputLine, Rule | `src/ui/chrome.ts` |
| **Organisms** | ScrollViewport, Tabs, SidebarPanel, SplitView, BorderedPanel | `src/ui/containers.ts` |
| **Data** | KeyValuePanel, LogView, DataTable | `src/ui/data.ts` |
| **Feedback** | ProgressBar, Spinner, Toast | `src/ui/feedback.ts` |
| **Forms** | Button, Checkbox, RadioGroup, Select, FilterableList | `src/ui/forms.ts` |
| **Patterns** | Pattern generators, data simulation, gradients | `src/ui/patterns.ts` |

### Two API families

| API | For | Contract |
|-----|-----|----------|
| **Handle** (SDK) | Microapp authors | `{ element, update(partial), destroy() }` |
| **LayoutPart** (internal) | Shell windows | `{ node, layout(rect), update(props), restyle(), destroy() }` |

Handle API is the standard for external developers. LayoutPart is internal
infrastructure for the layout engine. See `docs/design-system.md` for full reference.

### Naming convention

| Pattern | Convention | Example |
|---------|-----------|---------|
| Constructor | `create<Component>` | `createStatusBar`, `createGrid` |
| Options | `<Component>Options` | `StatusBarOptions` |
| Handle | `<Component>Handle` | `StatusBarHandle` |
| Update | `update(partial)` | Always partial props |
| Read | `get<Property>()` | `getSelected()`, `getContent()` |
| Events | `on<Event>(cb)` | `onSelect(cb)` |
| Cleanup | `destroy()` | Releases nodes, timers, listeners |

### Status: ✅ Landed

`src/ui/` directory established with 8 modules (E042-B06). Design system documented.
Old `src/core/ui-parts.ts` is a backward-compat shim (10 lines).

---

## 6. Microapp Model

### What microapps are

User-facing applications running inside the host. They behave like dashboards,
editors, consoles, games, or interactive visual interfaces — but remain
fundamentally terminal-native.

Microapps are: small, self-contained, composable, constrained.

### Manifest

Every microapp has a `microapp.json`:
- id, name, version, description
- menu placement, palette placement
- multiInstance, persist flags
- agent/api visibility

### Lifecycle

- `setup(host)` — register commands, create windows
- `host.createWindow()` — open a window with body, chrome, lifecycle hooks
- `win.describeState()` — semantic metadata for agents and API
- `win.captureText()` — plain text snapshot
- `win.onCleanup()` — release resources
- `win.onRestyle()` — re-apply theme tokens

### Hero microapps

Seven reference microapps ordered by complexity (see `docs/microapp-examples.md`):

1. **hello-world** (~30 lines) — minimum viable
2. **notepad** (~100 lines) — read/write buffer, SDK helpers
3. **runtime-inspector** (~425 lines) — live state, command introspection
4. **figlet-banner** (~450 lines) — multi-command, font picker
5. **layout-stress-test** (~460 lines) — responsive layout, animation
6. **data-dashboard** (~130 lines) — split view, timers, live updates
7. **file-manager** (~1600 lines) — full app (migration pending)

### Status: ✅ Landed

6/7 hero apps complete. All have `describeState()` + `captureText()`.
`hello-world` rewritten from 494 → 31 lines. `data-dashboard` built new.

---

## 7. System Architecture

### Current directory structure

```
src/
  core/           — runtime: commands, window facade, types, config, themes
  ui/             — terminal design system (layouts, molecules, organisms, patterns)
  sdk/            — microapp-facing: composition helpers, host contract
  services/       — capabilities: state, control API, content, agents
  windows/        — window implementations
  cli/            — wibwob CLI
  application/    — runtime services (command, inspection, window, workspace)
  runtime/        — runtime node descriptor
  tests/          — unit/ and integration/
microapps/        — all microapp implementations
```

### Architectural health

| Check | Status |
|-------|--------|
| Circular dependencies | ✅ 0 (was 6) |
| COAT violations | ✅ 0 |
| SDK gaps | ✅ 0 |
| Unit tests | ✅ 36/36 pass |
| `bun run health` | ✅ tests + typecheck + COAT + madge |

---

## 8. Multi-Instance & Runtime Nodes

Each running WibWob-DOS process is a **Runtime Node** with its own state,
command bus, microapp registry, and workspace.

Multiple nodes can run simultaneously via `WIBWOB_INSTANCE` env var and
distinct API ports. Each node has a canonical `instanceId`.

### Status: 🟡 Partially landed

`instanceId` exists. Dual-instance supported (`dev:world` + `dev:world:alt`).
Runtime registry, lifecycle modes (persistent vs ephemeral), and remote
attach are future work. See parking lot in `AGENTS.md`.

---

## 9. What's Landed vs What's Ahead

### ✅ Landed (E042 Solid Foundations)

- 6 circular deps → 0
- `src/ui/` design system (8 modules, 4037 lines properly organized)
- 11 SDK composition helpers with Handle API (added `createCanvas`)
- `src/core/safe-fs.ts` filesystem wrapper (22 files migrated)
- 36 unit tests, `bun run health` composite gate
- 7 hero microapps (6 complete)
- `knip.json` configured
- `docs/design-system.md`, `docs/sdk-primitives.md`, `docs/microapp-examples.md`
- `host-window-registry` pattern created for window lifecycle management
- `sdk-showcase` microapp built as reference for SDK composition
- Blessed microapp count reduced from 31 → ~19 (consolidation in progress)
- File-manager UX improved (title display + close hint)

### 🟡 In Progress

- SDK naming convergence (drop `Simple` prefix)
- Handle API for remaining LayoutPart components
- `@public`/`@beta`/`@internal` stability annotations
- Microapp migration of file-manager from `src/windows/`

### ⬜ Future

- God file decomposition: `app-controller.ts` (2334 lines), `file-manager-window.ts` (1623 lines)
- Event bus / persistence redesign (TODO-b1ddb4ff)
- Structured logging (replace `console.error`)
- Atomic writes in `safe-fs.ts` (tmp + rename)
- Remote runtime attach / telepresence
- Ephemeral instance lifecycle manager
- Full multi-instance orchestration
- Peer provenance / actor attribution

---

## 10. Non-Goals

Explicitly avoid:
- full GUI framework
- infinite component systems
- exposing host internals to microapps
- perfect sandboxing before runtime is clean
- overgeneralisation
- building remote orchestration before local architecture is solid

---

## 11. Cultural Direction

The platform should feel like:
- a creative terminal playground
- a host for human + agent tools
- a place for small expressive utilities
- a runtime that is inspectable and operable from within itself

Microapps resemble: zines, instruments, Unix tools, terminal-native applications.

---

## 12. Design Constraints

Intentional limits:
- small primitive set
- minimal lifecycle hooks
- small SDK surface
- limited capabilities
- simple manifest
- instance-scoped runtime objects

Constraints create clarity.

---

## Final North Star

Create a **small, stable host for composable terminal microapps**.

The system exists in the liminal space between human creativity and machine
intelligence — a symbient environment where software becomes more human and
humans collaborate with intelligent tools.

The runtime remains small and legible; complexity emerges from composition
rather than API growth.

The SDK remains radically simple, the primitives canonical, the internals
free to evolve, and the outcomes unexpectedly rich.

**Every interface is just another client of the runtime.**
