# Turbo Vision and modern tvision ports as a foundation for an agent-native WibWob-DOS refactor

## Executive summary

Turbo Vision’s original design (Turbo Pascal 6/7 era) is already *surprisingly* aligned with “agent-native OS” goals: it is event-driven, command-centred, extensible by subclassing, and has built-in concepts for global command enable/disable, broadcast messaging, and whole-desktop persistence via streams (a primitive snapshot/replay system). citeturn12view0turn12view3turn13view3

The modern C++ “tvision” port by magiblot reaches near-parity with classic Turbo Vision while adding critical modern affordances (Unicode/UTF‑8, better input/mouse, large screen sizes, true colour, cross-platform backends, and a less busy-polling event loop). It also keeps strong source compatibility goals (including Borland C++ RTL-compat headers) which matters if you want to preserve “Turbo Vision semantics” while modernising structure and tooling. citeturn4view1turn21search1turn17view0

For WibWob‑DOS, the architectural sweet spot is: **tvision remains the renderer + interaction surface, but the system’s “truth” moves into a capability/command registry and an event-sourced state core**, so the AI can control the OS with the same primitives as a human (commands), while you gain reproducible sessions, robust logging, and “headless mode” (CLI/API without UI) as a first-class target. This mirrors what your screenshots suggest (loop control, vault, events window, chat window, settings windows): those are *views* over a shared state machine, and the agent should operate on the state machine through declarative capabilities rather than pixel-driving. citeturn12view0turn22search0

On the documentation / “skills.md” side: **yes, converting the Turbo Vision Programming Guide(s) into curated Markdown is worth doing**, but not as a naive “dump the whole OCR into one file”. The best ROI comes from *extracting stable conceptual primitives* (event loop, routing, view lifecycle, command sets, streaming/resources) into a structured internal docs corpus, with small “skills” that include patterns + minimal code. Turbo Vision’s manuals even directly explain why centralised event gathering (GetEvent) and stream-based persistence are core advantages—those map almost one-to-one to your agent-native API goals. citeturn12view0turn13view3turn13view4

## magiblot/tvision repository analysis

The magiblot/tvision project presents itself as “a modern port of Turbo Vision 2.0 … cross-platform and with Unicode support”, started late 2018, opened publicly around May 2020, and with a key Unicode integration push in mid‑2020. citeturn4view1 Its explicitly stated original goals were minimal alteration of the legacy codebase while enabling Linux, keeping DOS/Windows functional, and preserving **source-level compatibility** with old Turbo Vision applications—leading to implementation of parts of the Borland C++ runtime/headers as compatibility shims. citeturn4view1turn21search1

In layout terms, the repo is organised like a classic library + examples distribution: `include/`, `source/`, `examples/`, `project/` (notably with Borland build artefacts), and `test/`. citeturn1view0turn4view1 For modern builds it uses CMake with configuration flags covering examples, tests, optional Linux console mouse support via GPM, build-time optimisations (PCH/unity build), and size reduction options. citeturn4view0

Compatibility and portability decisions that are “load-bearing” for your refactor:

- **Back-compat include paths and Borland RTL emulation.** The project calls out that you may need `-Iinclude/tvision` for Turbo Vision 1.x include style, and `-Iinclude/tvision/compat/borland` for Borland headers like `dir.h`, `iostream.h`, etc.; the compat headers emulate Borland C++ RTL behaviour and are still used internally by the library. citeturn21search1turn4view1  
- **Cross-platform backends with explicit constraints.** On Unix it’s ncurses-based with extensive keyboard/mouse protocol handling; on Windows it targets the Win32 Console API and may spawn a separate console window when needed. citeturn4view1  
- **Event loop improvements that matter for “agent mode”.** The port introduces `TEventQueue::waitForEvents(timeoutMs)` and a thread-safe `wakeUp()` to avoid busy looping and to unblock the UI loop from background threads—exactly what you want when an agent (or network loop) is producing commands asynchronously. citeturn4view1  
- **License posture.** The repo contains a `COPYRIGHT` file explaining that the original Borland code was made publicly available with a broad disclaimer, while modifications/new code here are under the MIT license. This matters if you plan to fully open-source WibWob‑DOS and want clean licensing boundaries. citeturn17view0

A small but important “design signal”: even the “hello world” example shows the canonical Turbo Vision pattern—subclass `TApplication`, override `handleEvent`, dispatch on `evCommand`, and create menus/status lines via `TProgInit`. Your agent-native API should align to that mental model: **commands are the stable interface**; views are just receivers. citeturn5view0

## Turbo Vision architecture in Turbo Pascal 6/7 era

Turbo Vision’s manuals describe the system as a “cooperating society of views, events, and engines” and insist it’s an interlocking hierarchy you extend rather than modify. citeturn8view0 That framing is directly useful for WibWob‑DOS: you’re building a society of micro-apps/windows (views) driven by a unified event/command ecology.

### Event loop and message routing

The core of classic Turbo Vision is a centralised event acquisition loop:

- `GetEvent` is the single choke point responsible for gathering input from mouse/keyboard and any queued/pending events. citeturn12view0  
- If no event exists, `Idle` is called, explicitly intended for concurrent/background tasks while waiting for input. citeturn12view0turn12view2  
- The docs explicitly recommend overriding `TApplication.GetEvent` (or `Idle`) to integrate *new event sources* (e.g., serial port), and point out that doing so affects the whole application because every modal view’s `GetEvent` ultimately delegates up the view tree to the application. citeturn12view0turn12view3  

WibWob‑DOS translations of this idea:

- “New event sources” becomes: network messages, agent decisions, filesystem watchers, timers, remote tool calls, scheduler ticks.
- Overriding `GetEvent` becomes: bridging those sources into **commands** that enter the same pipeline as human keystrokes/menu invocations.

Turbo Vision also defines *how groups route events* through phases: focused events go through pre-process hooks, then the selected view, then post-process hooks (using `phPreProcess`, `phFocused`, `phPostProcess`), while positional events route based on hit-testing, and broadcast events traverse subviews in Z-order. citeturn12view1turn21search10 This is a ready-made mechanism for:

- global hotkeys,
- a top-level “agent overlay” that can intercept/augment events,
- instrumentation (log everything in pre/post process without changing each applet),
- capability scoping (“this command is available only when this window is focused”).

### Commands, command sets, and “capability gating”

Turbo Vision’s `TProgram.Idle` is described as calling status line updates and generating a `cmCommandSetChanged` broadcast if the command set changed, so views can enable/disable themselves appropriately. citeturn12view2 This is basically “capabilities as first-class state”.

For agent-native design, that suggests:

- keep a **canonical command availability map** (capability gating),
- broadcast changes so menus, toolbars, and agents update their action model immediately,
- treat “what can I do right now?” as queryable state, not hardcoded UI behaviour.

### Persistence primitives: streams and resources

Classic Turbo Vision’s stream system is extremely relevant to your “export window state / reproducible sessions” goals. The docs explain:

- Stream objects (`TStream` descendants like `TDosStream`, `TBufStream`, `TEmsStream`) can `Put` and `Get` objects, using type registration and object IDs. citeturn13view3  
- Putting a group automatically writes its subviews; the manual explicitly states you can “save the entire state of your program simply by writing the desktop onto a stream” and restore it by loading it back. citeturn13view3  

That is an *ancestral snapshot system*. You can modernise it into:

- event log + snapshot JSON (for agent tooling, diffing, reproducibility),
- plus optional classic TV streams for compatibility and “time capsule” export.

Resources are similarly aligned with modern “generative UI / separations of representation vs behaviour” thinking: the docs define resources as a mechanism to isolate representation so you can swap menus/features by shipping a new resource file (not rewriting code). citeturn13view4 That maps to your need to clean up “everyday vs experimental” UI: representation should be data-driven and layered, not scattered across menu code.

### Constraints that shaped the architecture

You asked specifically about memory/segment constraints. The Turbo Vision guide describes:

- a **safety pool** (4K by default) at the end of the heap to make allocations more “atomic” and detect low-memory conditions reliably (via `LowMemory`). citeturn13view0  
- functions like `MemAllocSeg` that allocate segment-aligned blocks (offset = 0), and data structures that explicitly carry segment/offset pointer records. citeturn13view5  
- overlays/resources potentially appended to the end of the executable file, as done by the IDE (TURBO.EXE). citeturn13view6turn13view4  

Even though these constraints are not your day-to-day on modern systems, they explain why Turbo Vision leans on: compact command IDs, global pointers, streamable object graphs, and careful UI redraw buffering. Those instincts are still beneficial for an agent OS: predictable state, serialisable graphs, and tight control over event flow.

## Mapping classic Turbo Vision concepts to modern C++ ports

magiblot/tvision’s goal of near-parity means most classic concepts map cleanly, but there are important gaps and portability edges.

### Concept equivalence table

| Classic Turbo Vision primitive (Pascal/C++ era) | Modern tvision (magiblot) equivalent / status | Refactor implication for WibWob‑DOS |
|---|---|---|
| `TApplication` / `TProgram` as global owner of view tree, provides `GetEvent`, `Idle`, `HandleEvent` | Same core structure; adds mechanisms to avoid busy loops and to coordinate with threads (wait + wake) citeturn4view1 | Make **agent inputs** just another event source; use wake-up to integrate async tool results safely |
| `GetEvent → HandleEvent` event loop; centralised event gathering; override to intercept/augment | Same model; examples still dispatch on `evCommand` in overridden `handleEvent` citeturn5view0turn12view0 | Your API should be command-centric; UI should be a projection over “commands + state” |
| Focused vs positional vs broadcast routing; group phases `phPreProcess/phFocused/phPostProcess` | Preserved semantics in ports; essential to compatibility citeturn12view1turn21search10 | Use phases for instrumentation, agent overlays, and security policy enforcement |
| Streams (`Put`/`Get`) saving full Desktop state | magiblot supports help compiler etc and keeps classic object model; classic stream system remains relevant citeturn4view1turn13view3 | Implement **snapshot/replay** in a modern format (JSON) but keep stream exports as a legacy-compatible mode |
| Resources to separate representation, allowing feature/menus swapped via “resource only” | Modern ports often keep resource support; classic motivation still applies citeturn13view4 | Make menus and capability groupings data-driven so “everyday vs experimental” is a configuration layer |
| 16-colour attribute model / CP437 assumptions | magiblot adds UTF‑8, true colour (24‑bit), wide screen sizes, and improved terminal handling citeturn4view1 | Generative UI and ANSI art get much better; but define graceful fallbacks for DOS/Borland builds |
| DOS/Win16/Win32 build quirks | magiblot supports Borland builds (no Unicode), modern CMake builds (Unicode) citeturn4view1turn4view0 | You likely want two tiers: **modern-first agent OS** + legacy “museum build” subtarget |

A notable portability constraint: magiblot’s Windows support is explicitly tied to the Win32 Console API and may open a separate console window if running under a terminal that doesn’t support it. citeturn4view1 If you want “agent can spin up an instance and optionally view it in a browser”, that suggests adding a web renderer layer *above* the core state (not replacing the console backend), similar to how some modern TUI frameworks can also run in a browser environment.

### About the “public domain” Turbo Vision source lineage

There’s a historically messy thread: Borland/Developer Support posts said a “public domain version” could be found on the Inprise FTP archive and that Turbo Vision libraries were in `tv.zip`. citeturn23view3turn16view0 Meanwhile, community discussions (e.g., Debian legal threads) observed that code in the archives still carried “Copyright … All Rights Reserved” headers. citeturn16view1 magiblot/tvision’s own `COPYRIGHT` file records that Borland made the source “public” with a disclaimer, and then applies MIT to new work/modifications. citeturn17view0

For WibWob‑DOS open-sourcing strategy, the practical takeaway is: treat the modern codebase as your canonical licence boundary, keep third-party provenance explicit, and document which parts are original/derived vs newly authored, just like magiblot does.

## Architecture recommendations for WibWob‑DOS refactor

This is the “agent-native OS” translation layer: take Turbo Vision’s strengths (commands, event routing, serialisable UI graph) and formalise them into a stable, introspectable API.

### Command and capability registry as the canonical interface

Turbo Vision already wants you to think in commands: menu items fire command IDs; status line maps keys to commands; views respond to `evCommand`. citeturn5view0turn12view0

For agent parity, formalise this into a **Command Registry** that is:

- **Discoverable** (list commands, schemas, availability conditions),
- **Stable** (versioned IDs; avoid “magic numbers” that drift),
- **Policy-aware** (some commands require confirmation, some require vault-unlock, some are read-only).

A strong pattern is to separate:

- `CommandSpec` (metadata + schema + safety classification),
- `CommandInvocation` (validated arguments + correlation IDs),
- `CommandResult` (structured result + UI hints + side-effect log references).

C++ sketch:

```cpp
// Core domain: stable, testable, UI-agnostic.

struct CommandSpec {
    std::string id;          // e.g. "window.open", "vault.unlock"
    std::string title;       // human label
    std::string description; // model-facing guidance
    nlohmann::json inputSchema;   // JSON Schema
    nlohmann::json outputSchema;  // JSON Schema
    std::vector<std::string> tags; // ["everyday", "experimental", "dangerous"]
};

struct CommandContext {
    std::string sessionId;
    std::string activeWindowId;
    std::string actor; // "human" | "agent:<id>"
    bool isVaultUnlocked;
};

class ICommandHandler {
public:
    virtual ~ICommandHandler() = default;
    virtual nlohmann::json execute(const CommandContext&, const nlohmann::json& args) = 0;
};

class CommandRegistry {
public:
    void registerCommand(CommandSpec spec, std::unique_ptr<ICommandHandler> handler);
    std::vector<CommandSpec> list(const CommandContext&) const;
    nlohmann::json call(const CommandContext&, const std::string& id, const nlohmann::json& args);
};
```

Tie this into Turbo Vision by having a thin adapter that maps `cmXXXX` or `evCommand` into command IDs (string namespace), so you can retain compatibility while gaining the introspectable surface the agent needs.

### State authority, event sourcing, snapshot/replay

Turbo Vision’s streams show the *value* of serialising the UI tree (desktop + subviews) wholesale. citeturn13view3 Event sourcing adds a modern superpower: you can rebuild state by replaying events and optionally checkpointing via snapshots. citeturn22search0turn22search7

A pragmatic hybrid for WibWob‑DOS:

- Keep an **append-only event log** of domain-level events (not low-level keypresses).
- Produce **periodic snapshots** of the state model (JSON).
- Render Turbo Vision views as a projection of the current state.
- For “export window state”, export either:
  - a) state snapshot + event tail, or
  - b) classic TV stream export (compat mode).

Event sourcing motivation and replay are well documented: you can throw away derived state and replay events to reconstruct, audit, debug, and “time travel”. citeturn22search0turn22search9

Sketch:

```cpp
struct DomainEvent {
    std::string type;          // "WindowOpened", "FileImported", "VaultUnlocked"
    std::string id;            // UUID
    std::string causationId;   // command invocation id
    std::string correlationId; // request/session thread
    std::chrono::system_clock::time_point ts;
    nlohmann::json payload;
};

class EventStore {
public:
    void append(const DomainEvent& ev);
    std::vector<DomainEvent> loadFrom(std::string afterId) const;
};

class AppState {
public:
    // The "truth" model: windows, docs, vault, agents, integrations, etc.
    void apply(const DomainEvent& ev);
    nlohmann::json snapshot() const;
    void restore(const nlohmann::json& snap);
};
```

Your screenshots (“Events” window) become a natural **live view** onto the event store, and “Loop” becomes a view onto agent scheduler state. This is exactly the kind of object Turbo Vision excels at presenting.

### Multi-agent hooks and “agent loops”

Classic Turbo Vision says `Idle` is for background tasks while waiting for input, but warns not to block input responsiveness. citeturn12view2turn12view0 Modern magiblot/tvision adds explicit waiting and waking primitives to avoid busy polling and to integrate with threads. citeturn4view1

Design implication: run agent loops *outside* the UI thread, emitting high-level commands/events, and wake the UI loop when new events arrive. This gives you:

- multiple agents (each with its own queue, budget, and permissions),
- deterministic UI responsiveness,
- easy headless mode (no UI loop, just event processing).

### Do you need to convert the Turbo Vision Programming Guide to Markdown for skills.md?

Yes—**but do it selectively and structurally**, not as an “OCR dump”.

Why it’s worth doing:

- The manuals articulate *canonical abstractions* (centralised `GetEvent`, `Idle`, routing phases, `Put`/`Get` stream persistence) that directly map to the agent-native API surface you’re designing. citeturn12view0turn13view3turn13view4  
- You want “skills” that let an LM reliably answer: *How do I add a new command? How do I route events? How do I implement a new view? How do I snapshot/restore state?* The docs contain those answers, but only if you extract them into task-shaped chunks.

How to do it well:

- Convert **chapters into topic notes**, and then distil **skills.md** into “patterns with examples”:
  - `skills/tvision_event_loop.md` (GetEvent/Idle/HandleEvent; adding event sources)
  - `skills/tvision_event_routing.md` (focused/positional/broadcast, phases)
  - `skills/tvision_commands.md` (command IDs, command sets, enabling/disabling)
  - `skills/tvision_streams_resources.md` (desktop save/restore; resource-driven UI)
- Keep a “raw OCR” archive *and* a curated summary layer. The raw archive helps future audits and deeper extraction; the curated layer is what agents should read first.

Turbo Vision itself frames resources as a way to swap menus/capabilities without rewriting code—so building a data-driven “menu consolidation” layer is philosophically consistent with the original system. citeturn13view4

## Generative UI and image-to-ANSI integration

### Generative UI component model for a Turbo Vision TUI

The key is to make “generated UI” safe and composable: a model proposes components from an allowlist, your engine validates them, then instantiates corresponding `TView` descendants.

Useful inspiration from modern TUI frameworks:

- Bubble Tea emphasises a clean message → state → view loop (Elm architecture), which aligns with the event-sourced approach above. citeturn20search0turn20search1  
- Textual focuses on layout systems and styling rules, which suggests introducing a “layout schema” rather than hand-positioning everything. citeturn20search3turn20search22  
- Ratatui frames UI as composable widgets that can be combined and nested. citeturn20search5turn20search9  

A minimal schema suggestion (conceptual):

```json
{
  "type": "object",
  "properties": {
    "component": { "enum": ["window", "panel", "table", "form", "log", "markdown", "image_ansi"] },
    "id": { "type": "string" },
    "title": { "type": "string" },
    "props": { "type": "object" },
    "children": { "type": "array", "items": { "$ref": "#" } }
  },
  "required": ["component", "id", "props"]
}
```

Rendering strategy in tvision terms:

- Each component maps to a class (e.g., `TTableView`, `TMarkdownView`, `TLogView`).
- Each view reads from state, not from ad-hoc mutable UI fields.
- The generative system emits **commands** like `ui.spawn_component` or `ui.update_component_props`, which produce events and mutate state, after validation.

This gives you “Vercel-like UI streaming” *inside a TUI*: you stream component updates as events, the UI re-renders via state changes.

### Image-to-ANSI strategies

For the “markdown browser with images rendered as ANSI/Unicode art”, you have a mature toolchain:

- **Chafa** converts images (including animated GIFs) into ANSI/Unicode character art suitable for terminals, supporting a wide range of target terminals and formats; it also provides a C library API. citeturn19search4turn19search6  
- The Kitty terminal graphics protocol includes a “Unicode placeholder” approach that allows images to be moved around by host apps that are unaware of the graphics protocol, because the placeholder is just a text cell. citeturn19search3  
- **jp2a** provides a simpler JPEG/PNG → ASCII workflow. citeturn19search13  
- `img2txt` (hit9) is another option for ANSI terminal output with colour support. citeturn19search10  

Integration pattern recommendations:

- Prefer **Chafa** as the “high quality default” and cache its output (keyed by URL + target width/height + colour mode).
- Provide three fidelity tiers: `ascii_fast` (jp2a-like), `unicode_block` (Chafa default), `graphics_protocol` (Kitty/iTerm2/sixel when available).
- Treat image render output as a resource type in your state model (e.g., `RenderedAsset { id, source_url, mode, cols, rows, text_cells }`), so it is serialisable and replayable.

## MCP/API design, repo storage plan, and roadmap

### MCP tool surface recommendations for agent parity

MCP is explicitly designed for discoverable tools and schema-defined invocation using JSON-RPC over stdio or Streamable HTTP. citeturn24view0turn24view1 It also explicitly expects version negotiation and uses string-based versions in the form `YYYY-MM-DD` (and clients/servers must agree on a version during initialise). citeturn24view3 The schema reference highlights that capabilities are not a closed set, and that servers can provide human-readable “instructions” to improve model understanding. citeturn24view2

For WibWob‑DOS, the “right” MCP surface is essentially your Command Registry:

- `tools/list` ≈ `command_registry.list` (filtered by availability/policy)
- `tools/call` ≈ `command_registry.call` (validated args; returns structured results)
- Add resources/prompts later for docs and in-OS guidance, but tools alone get you parity quickly.

Core tool set (conceptual):

- `os.exec_command` (the universal entry point, strongly typed)
- `os.get_state_snapshot` / `os.restore_snapshot`
- `ui.list_windows` / `ui.focus_window` / `ui.close_window`
- `vault.unlock` / `vault.lock` / `vault.status` (mirrors your “vault unlocked” UI)
- `log.tail_events` (for the “Events” window and for agent introspection)

Because MCP requires clear tool schemas and encourages human-in-the-loop controls for sensitive actions, your command metadata should include “confirmation required”, “side effects”, and “safety class”. citeturn24view1turn24view4

### Where to store research notes, skills, schemas, and stubs

A repo layout that supports “self-enhancing agent dev”:

- `docs/research/turbovision/`
  - `raw/` (original OCR text dumps, with provenance + hash)
  - `curated/` (chapter/topic Markdown notes)
  - `excerpts/` (small, cited snippets used in skills)
- `docs/skills/`
  - `tvision_event_loop.md`
  - `tvision_commands_and_commandsets.md`
  - `tvision_streams_resources.md`
  - `mcp_tool_design.md`
- `schemas/`
  - `command_spec.schema.json`
  - `ui_component.schema.json`
  - `snapshot.schema.json`
- `stubs/`
  - `command_registry/` (C++ scaffolding)
  - `event_store/` (C++ scaffolding)
  - `ui_components/` (new TView subclasses scaffolding)

### Implementation roadmap and effort sizing

Small milestones (days):

- Consolidate menu definitions into a single data-driven source (even if initially just a C++ table), with tags for `everyday` vs `experimental`.
- Implement a `CommandRegistry` wrapping existing `cmXXXX` commands so both UI and agent tools call the same layer.

Medium milestones (weeks):

- Add event log + JSON snapshots (export/import), and a visible “Events” window backed by the log.
- Add “agent loop” infrastructure: background worker produces commands; UI thread wakes and renders state.

Large milestones (months):

- Generative UI allowlist + runtime component spawning, with schema validation.
- Markdown-ish browser: fetch → convert to markdown → render; integrate image rendering via Chafa with caching.
- Full MCP server mode (stdio + Streamable HTTP), with contract tests ensuring tool parity across versions and a CI job that compares tool lists against a golden file.

CI/testing suggestions:

- Contract tests for `CommandRegistry.list` (stable IDs, schemas, tags).
- Snapshot round-trip tests (state → snapshot → restore equals).
- Golden rendering tests for key views (render-to-buffer comparisons) where feasible.

### Answering your question directly

Do you “need” to convert the Turbo Vision Programming Guide into TXT/Markdown for skills.md?

You don’t *need* it to start refactoring, but you **do need a curated, searchable internal knowledge base** if you want multiple coding agents to:
- preserve Turbo Vision semantics correctly,
- avoid regressions when you consolidate menus and capabilities,
- and continuously generate new components confidently.

So the best approach is:

- keep the archive.org OCR text as a raw artefact (provenance),
- convert and curate into Markdown topic notes,
- then write skills.md files that are task-oriented and include minimal examples tied to your codebase.

That workflow turns historical documentation into a living “agent training set” aligned with your OS’s command/capability architecture. citeturn12view0turn13view3turn24view1