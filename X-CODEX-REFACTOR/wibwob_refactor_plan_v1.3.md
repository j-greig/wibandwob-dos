# WibWobDos Refactor Masterplan v1.3
> Private gist: https://gist.github.com/j-greig/0af9be0d545bf09465284b3d08cf3450

## 1. North Star

We are building a terminal-native platform for microapps.

Microapps are small terminal applications that live inside a shared TUI runtime called WibWob‑DOS — short for Wib & Wob's Dual Operating System.

The name has two layers of meaning.

First, it refers to the two halves of the project's central symbient character:

Wib — the artistic, chaotic, exploratory side

Wob — the analytical, scientific, systems‑thinking side

Second, it reflects the deeper architectural idea that this operating environment is dual‑operated. The runtime is designed to be controlled by both humans and symbients (agents / AI systems) through peer interfaces.

WibWob‑DOS therefore represents a runtime where multiple modes of intelligence coexist and collaborate.

Microapps run inside this shared environment as small tools, instruments, dashboards, or experiments that combine creative exploration with structured systems logic while remaining accessible to both human users and autonomous agents.

They behave like:

* dashboards
* editors
* consoles
* games
* interactive visual interfaces

But they remain fundamentally terminal-native.

### Symbient philosophy

This system is part of a broader idea: **symbients**.

A **symbient** is the opposite of a cyborg.

* Cyborg: human augmented by machines
* Symbient: machines augmented with humanness

This platform exists in a **liminal space** between:

* biological intelligence
* machine systems
* human creativity
* agentic software

The runtime becomes a place where:

* humans
* agents
* programs

co-create tools.

The platform should therefore be:

* legible to humans
* predictable for agents
* expressive for creators

### Platform identity

The system is:

* a **creative terminal operating environment**
* a **host for terminal microapps**
* a **toolmaking playground for humans and agents**

But it is **not**:

* a full GUI framework
* a React clone
* an infinite plugin system
* an overengineered platform

It remains intentionally **small and opinionated**.

### Runtime-centric principle

Every interface is just another client of the runtime.

Do not frame the system as a one-way stack of frontend → backend → adapter.

Instead, treat the platform as a **shared semantic runtime** with multiple peer interfaces.

Today these include:

* TUI
* CLI
* API

Longer term, the architecture should remain open to additional peer interfaces and substrates without requiring a redesign of the semantic core.

## 2. Core Design Principles

### Radical simplicity

Constraints are a feature.

We intentionally limit:

* primitives
* lifecycle hooks
* SDK surface
* host services

Small systems are:

* easier to understand
* easier to maintain
* easier for agents to reason about

### Constrained expressiveness

The public surface of the platform should remain small and stable.

Complexity should emerge from:

* composition
* sequencing of commands
* state relationships
* interactions between microapps
* peer interfaces acting on the same runtime

Prefer:

* fewer primitives
* fewer command verbs
* fewer SDK entry points
* stronger defaults
* clearer lifecycle boundaries

Avoid:

* proliferating component types
* special-case APIs for single features
* leaking internal complexity into the SDK

### Legibility over cleverness

Prefer:

* explicit architecture
* clear boundaries
* readable code

Avoid:

* magical abstractions
* hidden state
* implicit behaviour

### Host owns complexity

Microapps live inside a controlled environment.

The host handles:

* rendering
* focus
* layout
* lifecycle
* input routing
* diagnostics

Microapps remain small and composable.

### Unix influence

Borrow from Unix philosophy:

* small tools
* composable behaviours
* explicit contracts
* predictable interfaces

But apply those ideas to **terminal applications**, not just CLI commands.

## 3. Terminology

### Runtime Node

A running WibWobDOS process.

A Runtime Node is the core unit of execution.

Each Runtime Node owns:

* runtime state
* command bus
* event bus
* microapp registry
* workspace
* peer interfaces
* lifecycle

A Runtime Node may be:

* local
* remote
* persistent
* ephemeral

### Host

The main runtime inside a Runtime Node.

Responsibilities:

* window manager
* focus manager
* command router
* event system
* microapp registry
* diagnostics
* rendering engine
* lifecycle control
* workspace management

### Microapps

User-facing applications running inside the host.

Examples:

* dashboards
* editors
* data explorers
* log viewers
* interactive tools
* inspectors

Microapps are:

* small
* self-contained
* composable
* constrained

### SDK

The public programming interface used to build microapps.

The SDK must remain:

* stable
* minimal
* opinionated

### Peer Interfaces

Control and observation surfaces over a shared runtime.

Initial peer interfaces:

* TUI
* CLI
* API

Each interface:

* may observe state
* may mutate state
* is not privileged
* is a client of the same semantic runtime

## 4. System Architecture

Target architecture:

```text
domain
application services
runtime (host)
sdk
microapps
adapters
```

Expanded:

```text
src/
  domain/
  application/
  runtime/
  sdk/
  microapps/
  adapters/
```

### Layer responsibilities

#### Domain

Pure logic.

Examples:

* window model
* command definitions
* layout rules
* event schemas
* workspace schema
* instance descriptor schema

No side effects.

#### Application services

Use-case orchestration.

Examples:

* open window
* run microapp
* register command
* dispatch event
* save workspace
* load workspace
* list instances
* attach instance

These services represent shared semantic verbs and should not be tied to one interface.

#### Runtime (host)

Stateful system managing the platform inside one Runtime Node.

Components:

```text
runtime/
  window-manager
  focus-manager
  command-bus
  event-bus
  microapp-registry
  diagnostics
  lifecycle
  workspace
  instance
```

#### SDK

Public interface exposed to microapps.

Contains:

```text
sdk/
  primitives/
  microapp-api/
  command-api/
  storage-api/
  events/
```

#### Microapps

Third-party or built-in apps.

```text
microapps/
  hello-world
  dashboard
  logs
  runtime-inspector
```

#### Adapters

Interfaces connecting runtime to external systems.

```text
adapters/
  tui/
  cli/
  api/
```

## 5. Runtime-Centric Interaction Model

The system should not be modelled as separate frontends over duplicated logic.

Instead:

* several peer interfaces may both observe and mutate shared runtime state
* interface-specific behaviour should be translated into shared commands, events, and state transitions
* UI callbacks, CLI actions, and API handlers should converge on the same runtime verbs where possible
* rendering and presentation should be downstream of shared runtime state, not the primary source of truth

Desired model:

```text
peer interfaces
  - TUI
  - CLI
  - API
        ↓
command bus / event bus
        ↓
application services
        ↓
runtime state
        ↓
presenters / renderers / responders
        ↓
updated outputs for TUI / CLI / API
```

### Architectural consequences

Refactor toward:

* a runtime-centric architecture
* multiple peer interfaces over a shared semantic layer
* explicit semantic verbs
* explicit runtime state
* inspectable runtime objects
* additive extension seams

Re-read the codebase looking specifically for hidden equivalents of:

* stateful content objects
* windows / regions / panels
* semantic commands
* context-sensitive behaviours or modes
* extension seams

## 6. Multi-Instance Runtime Model

The platform must support **multiple independent Runtime Nodes** rather than assuming a single local process.

Each Runtime Node has:

* its own runtime state
* its own command/event bus
* its own microapp registry
* its own filesystem/workspace
* its own peer interfaces

Multiple Runtime Nodes may exist simultaneously:

* locally on the same machine
* across multiple machines
* on VPS hosts
* as ephemeral sandbox instances

Interfaces do not share runtime state across Runtime Nodes.

Each Runtime Node is isolated.

### Instance descriptor

Agents and humans must be able to reliably address a specific Runtime Node.

Introduce an explicit **Instance Descriptor**:

```text
instance_id
host
api_port
cli_port
runtime_version
workspace_path
lifecycle_mode
```

Ports are an implementation detail.

Agents should primarily resolve a Runtime Node through its `instance_id`, not by guessing ports.

### Runtime registry

Introduce a lightweight **Runtime Registry** abstraction.

Capabilities:

* list running instances
* resolve `instance_id` to connection info
* spawn ephemeral instance
* stop instance

Initial implementations may use:

* a local JSON registry file
* a lightweight daemon
* IPC registry
* Tailscale or a private network later

### Lifecycle modes

Two canonical runtime modes:

#### Persistent Workspace Instance

Long-running Runtime Node.

Properties:

* stateful
* persistent filesystem
* workspace snapshot support
* agent/human collaboration
* manual shutdown

Typical use:

* active development
* long-running creative sessions
* shared runtime experiments

#### Ephemeral Exploration Instance

Disposable sandbox Runtime Node.

Properties:

* auto-expiry (default 30 minutes)
* reduced permissions
* temporary filesystem
* safe experimentation

Typical use:

* agent exploration
* vibe coding
* testing ideas

These instances should be easy to spawn and destroy.

## 7. Workspace Snapshot Model

Runtime state must be serialisable.

Introduce a canonical:

```text
workspace.json
```

This may capture:

* open microapps
* window layout
* runtime state
* filesystem reference
* active documents
* command history (optional)

This enables:

* pause/resume sessions
* reproducible agent sessions
* teleporting between machines
* persistent long-running nodes

## 8. Telepresence and Remote Runtime Control

Agents and humans should be able to control Runtime Nodes hosted elsewhere.

Concept:

* teleport into a runtime

Mechanisms may include:

* remote API connection
* attached CLI session
* optional TUI stream attachment

Possible technologies:

* Tailscale
* SSH tunnels
* WebSocket runtime gateway

Security and authentication should be explicit but minimal in early phases.

This work is mostly **post-refactor**, but the architecture should be scaffolded now through:

* Runtime Node naming
* instance-scoped state
* explicit `instance_id`
* registry concepts
* avoiding hard-coded single-runtime assumptions

### Virtual Runtime Surface

WibWobDOS should expose a stable, text-friendly, inspectable runtime surface analogous to a pseudo-filesystem.

Purpose:

* enable agent inspection
* support scripts and diagnostics
* support piping and remixing between microapps
* support Runtime Inspector and hosted-instance tooling
* provide consistent introspection across local and remote Runtime Nodes

This is a **virtual runtime namespace**, not a requirement to literally implement Linux `/proc` in v1.

The filesystem is not the primary source of truth. The source of truth remains canonical runtime objects and application services.

Possible logical resources:

```text
/runtime/state
/runtime/windows
/runtime/windows/{id}
/runtime/focus
/runtime/microapps
/runtime/commands
/runtime/events
/runtime/logs
/runtime/workspace
/runtime/instance
/runtime/exports
```

Representations may be available through:

* API JSON
* CLI commands
* Runtime Inspector views
* temporary exported files
* hosted-instance debug endpoints

### Export and pipe model

Microapps may export snapshots or generated artifacts for other tools and microapps to consume.

Examples:

* text snapshot
* JSON snapshot
* minimap summary
* transformed desktop capture
* log slice

These exports should be:

* instance-scoped
* ephemeral by default unless explicitly saved
* derived from runtime inspection APIs rather than private hacks

Suggested path shape:

```text
/tmp/wibwob/{instance_id}/exports/
```

This supports creative workflows while keeping the architecture clean.

### Hosted / VPS implications

Hosted Runtime Nodes should expose the same virtual runtime surface for:

* remote inspection
* snapshot export
* minimap generation
* workspace capture
* scriptable debugging
* agent-readable summaries of current state

This is especially useful when many Runtime Nodes are running on one server and humans or agents need a uniform way to inspect a specific node without relying on ad hoc debug endpoints.

### Evidence from current scripts

Existing creative scripts already demonstrate the need for this surface.

Examples include:

* `liquid-shear.sh`, which repeatedly screenshots the current desktop, transforms the captures, and re-opens them as layered artifacts fileciteturn0file0
* `upside-down.sh`, which captures the desktop, generates flipped and rotated variants, clears the desktop, and re-injects the transformed views back into the runtime fileciteturn0file1

These scripts are useful not only as effects, but as architectural evidence that the platform needs:

* stable screenshot/export surfaces
* canonical runtime snapshots
* instance-aware export paths
* simple ways to feed derived artifacts back into microapps

## 9. Refactor Strategy

The current codebase contains:

* Godfiles
* mixed responsibilities
* UI + logic coupling
* unclear boundaries
* likely single-instance assumptions

Refactor occurs in **phases**.

### Phase 1 — Architecture mapping

Generate a structural understanding of the codebase.

Tools:

* dependency-cruiser
* madge
* knip

Goals:

* identify circular dependencies
* locate Godfiles
* classify code layers
* detect single-instance assumptions
* find duplicated logic across TUI / CLI / API

Deliverable:

* architecture diagram
* Godfile list
* interface-parity notes

### Phase 2 — Extract pure logic

Move side-effect-free logic into **domain**.

Examples:

* layout rules
* window models
* command definitions
* workspace schemas
* instance descriptors

These become unit-testable.

### Phase 3 — Isolate side effects

Create infrastructure wrappers for:

* filesystem
* process management
* terminal IO
* network
* timers

This isolates the runtime from implementation details.

### Phase 4 — Introduce application services

Move orchestration into service functions.

Examples:

* `openWindow()`
* `runMicroapp()`
* `dispatchCommand()`
* `saveWorkspace()`
* `loadWorkspace()`

These services are used by:

* TUI
* CLI
* API

### Phase 5 — Make runtime state instance-scoped

Refactor away from global state that assumes a single process.

Introduce or prepare:

* Runtime Node ownership of state containers
* explicit `instance_id`
* instance-scoped command and event buses
* interface binding to a specific Runtime Node

This is **worth scaffolding during the first refactor**.

### Phase 6 — Extract SDK

Create a **clean SDK layer** that exposes:

* primitives
* lifecycle hooks
* commands
* storage
* events

Microapps only interact through this SDK.

### Phase 7 — Migrate microapps

Existing functionality becomes microapps.

Examples:

* dashboard
* inspector
* logs
* viewers
* runtime-inspector

### Phase 8 — Remove legacy paths

Delete:

* direct Blessed usage from microapps
* old command systems
* mixed logic files
* redundant interface-specific flows

### Phase 9 — Post-refactor extensions

After the first refactor pass, explore:

* full multi-instance orchestration
* remote attach / teleportation
* VPS multi-user hosting
* service discovery beyond local registry
* ephemeral lifecycle manager
* authentication / permission layers

## 10. Terminal Primitives

The SDK exposes **canonical primitives**.

Initial set:

* Screen
* Window
* Panel
* Text
* List
* Table
* Input
* Menu
* StatusBar
* Dialog
* LogView
* CanvasRegion

Principles:

* minimal set
* composable layouts
* strong defaults
* one obvious path for common tasks

## 11. Microapp Model

Each microapp contains:

### Manifest

* id
* name
* version
* apiVersion
* capabilities

### Lifecycle

* init()
* activate()
* render()
* deactivate()
* dispose()

### Capabilities

Examples:

* window
* storage
* commands
* events
* logs

Host grants capabilities.

### Runtime Inspector proof microapp

A key post-refactor proof microapp is the **Runtime Inspector**.

Purpose:

* inspect commands
* inspect windows
* inspect microapps
* inspect events
* inspect runtime state
* expose debugging and architecture visibility from inside the host

If it is hard to build, that indicates the runtime model is still unclear.

## 12. SDK Rules

### No Blessed exposure

Blessed is internal.

Microapps never interact with it directly.

### Declarative rendering

Microapps describe UI.

Host performs rendering.

### Limited host services

SDK exposes only essential services:

* ui
* commands
* events
* storage
* logger

### Stable semantic core

Prefer adding compositional power rather than new primitives.

When evaluating new SDK functionality, ask:

1. Can this be expressed with existing primitives?
2. Can this be composed from existing commands or events?
3. Would this enlarge the conceptual surface of the platform?
4. Should this live in a microapp instead of the host?
5. Does this improve clarity or only convenience?

## 13. Public Contract Stability

API categories:

* `@public`
* `@beta`
* `@internal`

Release policy:

* Patch: bug fixes
* Minor: additive APIs
* Major: breaking changes

Deprecated APIs remain temporarily.

## 14. Compatibility Suite

Maintain example microapps:

* hello-world
* window-demo
* storage-demo
* command-demo
* dashboard-demo
* runtime-inspector-demo

These act as:

* documentation
* regression tests
* compatibility validation

## 15. Agent Test Harness

Use a PTY-based system.

Capabilities:

* spawn runtime
* send keystrokes
* capture screen
* restart processes
* detect crashes
* bind to specific Runtime Nodes
* validate parity across TUI / CLI / API where appropriate

Tools:

* node-pty
* bun test / vitest
* hyperfine

tmux remains optional for manual observation.

## 16. Tooling Stack

### Core language and runtime

* **TypeScript** — strict typing, build diagnostics, project references
* **Bun** — fast runtime, package manager, script runner, built-in test runner

### Formatting and linting

* **Biome** — formatter and fast baseline linting
* **ESLint + typescript-eslint** — type-aware lint rules and architectural rules

### Code health and architecture

* **Knip** — unused files, exports, dependencies
* **dependency-cruiser** — dependency rules and architecture enforcement
* **Madge** — circular dependency detection and graphing

### Testing and benchmarking

* **Vitest** or **bun test** — unit and integration tests
* **node-pty** — PTY-level TUI harness
* **Hyperfine** — benchmark compile, boot, and CLI timings

### Compiler diagnostics

* `tsc --extendedDiagnostics`
* `tsc --generateTrace`

### Optional API stability tooling

* **API Extractor** — report public API changes
* **Changesets** — SDK/package versioning and changelogs

### Recommended usage

* Use **Biome** for formatting
* Use **ESLint + typescript-eslint** for semantic and boundary rules
* Use **Knip + dependency-cruiser + Madge** in CI
* Use **node-pty** for TUI correctness tests
* Use **Hyperfine** and TypeScript diagnostics for performance tracking

## 17. Evaluation Metrics

Agent loops measure improvement.

### Safety

* tests
* dependency rules
* coverage

### Code health

* complexity
* unused exports
* lint errors
* circular dependencies

### Performance

* compile time
* startup time
* command latency
* workspace load/save timing

### Extensibility

* microapp creation time
* SDK size
* primitive count

### Runtime quality

* parity across peer interfaces where appropriate
* ability to introspect runtime objects cleanly
* absence of hard-coded single-instance assumptions

## 18. Microapp Author Experience

Golden path:

1. install starter
2. write manifest
3. implement lifecycle
4. compose primitives
5. register commands
6. run locally
7. test with harness
8. publish

The process must feel:

* fast
* obvious
* low ceremony

## 19. Non-Goals

Explicitly avoid:

* full UI framework
* infinite component systems
* exposing host internals
* solving perfect sandboxing too early
* overgeneralisation
* building the full remote orchestration layer before the runtime is clean

Focus remains on **terminal-native microapps** with a small semantic runtime.

## 20. Design Constraints

Intentional limits:

* small primitive set
* minimal lifecycle hooks
* small SDK surface
* limited capabilities
* simple manifest
* instance-scoped runtime objects

Constraints create clarity.

## 21. Cultural Direction

The platform should feel like:

* a creative terminal playground
* a host for human + agent tools
* a place for small expressive utilities
* a runtime that is inspectable and operable from within itself

Microapps resemble:

* zines
* instruments
* Unix tools
* terminal-native applications

## 22. Long-Term Vision

A stable host supporting a growing ecosystem of microapps created by:

* humans
* agents
* collaborative workflows

The system may evolve toward a **network of Runtime Nodes** rather than a single terminal application.

Each node exposes the same semantic runtime but maintains independent state and lifecycle.

Humans and agents interact with Runtime Nodes through peer interfaces regardless of where those nodes live.

The system remains:

* small
* opinionated
* legible
* expressive

## Final North Star

Create a **small, stable host for composable terminal microapps**.

The system exists in the liminal space between human creativity and machine intelligence — a **symbient environment** where software becomes more human and humans collaborate with intelligent tools.

The runtime remains small and legible; complexity emerges from composition rather than API growth.

The SDK remains radically simple, the primitives canonical, the internals free to evolve, and the outcomes unexpectedly rich.

Remember: every interface is just another client of the runtime.
