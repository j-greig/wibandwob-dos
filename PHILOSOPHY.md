# WibWob-DOS — Philosophy

---

## What this is

WibWob-DOS is a **terminal-native host for composable microapps** — a shared
runtime operated equally by humans and agents.

**Wib** is the artistic, chaotic, exploratory side.
**Wob** is the analytical, systems-thinking side.

The runtime holds both. It is a liminal space: between biological intelligence
and machine systems, between creative play and engineering rigour. Microapps
resemble zines, instruments, and Unix tools — small, expressive, composable.

A **symbient** is the inverse of a cyborg. Not a human augmented by machines —
a machine augmented with humanness. This platform is designed for symbiency:
humans and agents co-create tools inside the same runtime, through peer interfaces.

---

## The operational consequence (for agents building here)

> **Whatever the human can do, the agent must be able to do.**
> This is not a feature. It is the design constraint.

Every window exposes `describeState()`. Every command is reachable via the API.
Every user-visible surface has a typed representation in desktop state.
If an agent cannot reach a surface, discover a command, or read meaningful state —
that is a **bug**, not a limitation.

This is why COAT exists. The COAT test: *"Would this work without the TUI,
using only the API?"* If no: it isn't done.

---

## Five decision filters

Use these when evaluating any change — new primitive, new SDK method, new command,
new abstraction. If a proposed change fails more than one filter, pause.

**1. Radical simplicity**
Does this add a new primitive, or compose from existing ones?
Prefer composition. Constraints are the creative material.

**2. Constrained expressiveness**
Does this enlarge the SDK surface, or express more through existing primitives?
Complexity should emerge from composition and state relationships — not API growth.

**3. Legibility over cleverness**
Is this explicit and readable, or magical and implicit?
Agents cannot debug hidden state. Prefer obvious ownership, clear boundaries.

**4. Host owns complexity**
Is this the host's responsibility or the microapp's?
The host handles rendering, layout, focus, lifecycle, input routing, diagnostics.
Microapps remain small, composable, ignorant of blessed internals.

**5. Unix influence**
Is this a small composable tool, or a growing framework?
One concept, one owner. Small tools. Explicit contracts. Predictable interfaces.

---

## The SDK stability contract

The SDK (`src/services/microapp-sdk.ts`) is the **only import surface** for
microapp authors. Stable surface, mutable implementation:

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

Stability tiers: `@public` (stable) · `@beta` (may change) · `@internal` (host only).

<progressive-disclosure>
Every export from microapp-sdk.ts with its stability tier, type signature, and
one-line description — the full surface an agent needs to pick the right component
without reading source.
</progressive-disclosure>

---

## North star

> Create a **small, stable host for composable terminal microapps**.
>
> The runtime remains small and legible. Complexity emerges from composition,
> not API growth. The SDK remains radically simple. The internals remain free
> to evolve. The outcomes remain unexpectedly rich.
>
> **Every interface is just another client of the runtime.**
