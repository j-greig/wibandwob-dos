# Module Discovery Devlog

Date: 2026-03-12
Repo: `wibandwob-dos`
Branch observed: `chore/menu-nav-file-audit`
Scope: first-contact exploration for "vibe code a custom module"

## Discovery Trail

### 1. `AGENTS.md`

Why I opened it:
- It is the root operating contract for this repo.
- The task was "build a microapp", so I expected it to define the sanctioned path.

What I learned:
- The repo explicitly points module builders to four docs: `.agents/architecture.md`, `.agents/invariants.md`, `.agents/control-api.md`, and `.agents/microapp-sdk.md`.
- The fastest stated path for a new module is: run `scripts/scaffold-microapp.sh`, read `docs/building-custom-microapps.md`, then study `glitchbox`, `e026-demo`, and `wibwob-poetry-clock`.
- Modules live in `microapps/*` and are treated as microapps loaded through the same window system as the rest of the shell.
- Touching `microapps/*` also triggers two subsystem specs: `window-system.md` and `agent-session.md`.
- Verification expectations are stronger than "typecheck passes"; the repo wants runtime and visual verification too.

What I opened next because of that:
- `docs/building-custom-microapps.md`
- `scripts/scaffold-microapp.sh`
- `.agents/` itself, to understand the doc surface it was pointing at

### 2. `.agents/` directory listing

Why I opened it:
- `AGENTS.md` sent me into `.agents/`, but I needed to know the top-level shape before picking files.
- This was the first real test of whether the docs are discoverable by cold read.

What I learned:
- Top level contains `architecture.md`, `control-api.md`, `invariants.md`, `microapp-sdk.md`, one stray `wibwobworld-iso-fix.md`, and a `specs/` directory.
- `specs/` contains internal subsystem specs, but the top-level names do not distinguish "microapp author docs" from "shell maintainer docs".
- The directory is small enough to browse, but not self-segmenting by audience.

What I opened next because of that:
- `docs/building-custom-microapps.md` for the public authoring path
- `scripts/scaffold-microapp.sh` for the real starter template
- `.agents/microapp-sdk.md` for the deeper authoring contract

### 3. `docs/building-custom-microapps.md`

Why I opened it:
- `AGENTS.md` explicitly says to read it after scaffolding.
- I wanted the "public" path before reading internal specs.

What I learned:
- The doc is a solid quick-start: manifest shape, `index.ts` entry point, required lifecycle hooks, basic command registration, timer usage, and a minimal verification checklist.
- It correctly emphasizes `describeState`, `captureText`, `onCleanup`, and `onRestyle`.
- It tells microapp authors to stay on the `src/services/microapp-sdk.js` import surface.
- It mentions workspace persistence, but only at the level of "implement snapshot save/restore"; it does not show the real host API or a complete example.
- It references `microapps/dream-forecast/`, which does not appear in the file list I gathered. That is stale.

What I opened next because of that:
- `scripts/scaffold-microapp.sh` to see what "happy path" starter code really looks like
- `.agents/microapp-sdk.md` to see whether the missing persistence details exist there

### 4. `scripts/scaffold-microapp.sh`

Why I opened it:
- Scaffold scripts are often more truthful than docs. They encode the current assumptions.
- I wanted to know what a freshly generated module actually looks like today.

What I learned:
- The script creates only two files: `microapp.json` and `index.ts`.
- The scaffold registers a single `open` command and builds a very small window with a boxed checklist.
- It wires `describeState`, `captureText`, and `onRestyle`, but not `onCleanup`.
- That is notable because the public docs say four hooks are required, while the scaffold intentionally skips `onCleanup` until there is "real cleanup to do". That is a mild contract mismatch.
- The scaffold still uses direct `blessed.box` composition, not higher-level SDK primitives.

What I opened next because of that:
- `.agents/microapp-sdk.md` to see the fuller contract
- real modules, to see what the scaffold eventually grows into

### 5. `.agents/microapp-sdk.md`

Why I opened it:
- `AGENTS.md` and the window-system spec both point to it as the canonical authoring contract.
- I needed to know whether it was a thin summary or the real source of truth.

What I learned:
- This is the most valuable module-authoring doc in the repo.
- It explains the host object, window handle, render policy, UI primitives, tree widget, tabs, timers, motion, render monitor, animation helpers, patterns, figlet helpers, and restyle patterns.
- It is much more implementation-aware than `docs/building-custom-microapps.md`.
- It contains a broken reference to `docs/microapp-authoring.md`, which does not exist.
- It also leaks some internals and edge-case gotchas that matter more to shell maintainers than first-time microapp authors.

What I opened next because of that:
- the triggered specs for modules: `.agents/specs/window-system.md` and `.agents/specs/agent-session.md`
- `src/services/microapp-sdk.ts` later, to compare docs against the actual export surface

### 6. `.agents/specs/window-system.md`

Why I opened it:
- `AGENTS.md` says any `microapps/*/index.ts` change should read this first.
- A microapp author needs to know what assumptions the host window system makes.

What I learned:
- The spec explains how microapp windows are registered through the shared `WindowManager`.
- It clarifies important invariants: `describeState()` must include `appType`, cleanup must stop timers, and chrome math belongs outside window code.
- It documents real blessed failure modes, including scrollable-canvas rendering bugs and input duplication.
- For a microapp author, this is useful but too internal and too broad as a first stop.

What I opened next because of that:
- `.agents/specs/agent-session.md`, because modules are also called out there
- example modules to see whether they follow these invariants in practice

### 7. `.agents/specs/agent-session.md`

Why I opened it:
- `AGENTS.md` also makes this a pre-change read for modules.
- I wanted to know whether this mattered to "build a microapp" or only to agent internals.

What I learned:
- Most of this file is about the in-app agent, jailed tools, and Scramble.
- The module-relevant part is smaller: command registration shape, menu array shape, reload vs restart, invisible microapp-loader errors, and the warning that menu commands with required args need a picker or fallback.
- The note about module load errors only surfacing in stderr is important and easy to miss elsewhere.
- This spec contains microapp authoring guidance, but it is buried inside an agent-session document whose filename does not suggest "microapp authoring".

What I opened next because of that:
- representative modules, to see the gap between theory and actual module code

### 8. `microapps/hello-world/index.ts`

Why I opened it:
- Minimal example named in the docs.
- Best place to understand the lowest-complexity real module.

What I learned:
- This is no longer a tiny "hello world" sample. It is a layout-engine proving ground.
- It demonstrates responsive layout ideas and SDK imports, but it is not the cleanest first example for someone learning the basic module shape.
- The comments are helpful, but the file is concept-heavy enough to scare off a new agent looking for the smallest correct pattern.

What I opened next because of that:
- `microapps/hello-world/microapp.json`, to separate the simple manifest from the now-complex implementation
- `microapps/wibwob-poetry-clock` for a compact real app
- `microapps/glitchbox` and `microapps/e026-demo` for advanced patterns

### 9. `microapps/glitchbox/index.ts`

Why I opened it:
- `AGENTS.md` explicitly recommends it as an animated reference.
- I wanted to see how a real multi-command microapp is structured.

What I learned:
- `glitchbox` is a rich demo of command registration, stateful control commands, animation, and complex render logic.
- It is useful as an inspiration file and for advanced command patterns like `direct: true`.
- It is not a good first-stop teaching example because it is large and stylistically dense.

What I opened next because of that:
- `microapps/wibwob-poetry-clock/index.ts` for something smaller and more lived-in
- `microapps/e026-demo/index.ts` for breadth across SDK features

### 10. `microapps/wibwob-poetry-clock/index.ts`

Why I opened it:
- `AGENTS.md` calls it a compact real app.
- I wanted an example that is not just a demo toy.

What I learned:
- This module is a good "real microapp" reference: small enough to follow, rich enough to show timers, rendering, mode switching, and persistence hooks.
- It also shows that modules can reach beyond pure TUI behavior and use external services, but still stay on the SDK path.
- This became my best candidate for a persistence example after I found the docs vague there.

What I opened next because of that:
- its `microapp.json`
- later, the snapshot section near the bottom of the file

### 11. `.agents/architecture.md`

Why I opened it:
- `AGENTS.md` listed it first among the core docs.
- I wanted to know whether it materially helps a microapp author or mostly serves shell maintainers.

What I learned:
- It is mostly shell-internal architecture: app controller, command registry, window manager, services, Tmux patterns, dual instance notes.
- Useful for contributors modifying the shell, but too broad for someone just trying to build a microapp.
- The "Blessed Pattern" section is relevant, but the file as a whole is not audience-filtered.

What I opened next because of that:
- `.agents/invariants.md` to see whether it is similarly maintainer-facing

### 12. `.agents/invariants.md`

Why I opened it:
- `AGENTS.md` and the rest of the docs treat these invariants as hard rules.
- I needed to know which rules actually constrain microapp authors.

What I learned:
- Several invariants matter directly to modules: single owner per concern, semantic state via `describeState()`, restyleable widgets, commands defined once, and not bypassing the SDK path.
- The file also contains shell-level architectural rules that a microapp author does not need on first contact.
- This is another "important but mixed-audience" document.

What I opened next because of that:
- `microapps/e026-demo/index.ts`, since I now understood the architectural direction and wanted to see the SDK breadth in use

### 13. `microapps/e026-demo/index.ts`

Why I opened it:
- `AGENTS.md` recommends it as a broad sampler.
- I wanted to see whether it is a good feature map of the SDK surface.

What I learned:
- It is exactly that: tree widget, timers, motion, panel primitives, button bar, render monitor, and window movement helpers.
- As a sampler it is excellent.
- As an onboarding doc replacement it is too much code and too much incidental UI for a first-time microapp author.

What I opened next because of that:
- manifests for the simpler modules, to confirm the metadata shape
- `src/services/microapp-sdk.ts`, to compare doc claims with actual exports

### 14. `microapps/hello-world/microapp.json`

Why I opened it:
- After seeing `hello-world/index.ts` had become advanced, I wanted to confirm whether the manifest was still a clean baseline.

What I learned:
- The manifest is straightforward and matches the public docs well.
- It uses `multiInstance: true`, which is a helpful reminder that the manifest can opt into multiple windows independently of code structure.

What I opened next because of that:
- `microapps/wibwob-poetry-clock/microapp.json`

### 15. `microapps/wibwob-poetry-clock/microapp.json`

Why I opened it:
- I wanted a `persist: true` example to compare against the docs' persistence claims.

What I learned:
- The manifest is small and clean, but it does not itself teach how persistence works.
- It confirmed I needed to inspect the loader and the module code, not just the docs.

What I opened next because of that:
- `src/services/microapp-sdk.ts`
- `src/services/microapp-loader.ts`

### 16. `src/services/microapp-sdk.ts`

Why I opened it:
- The docs keep calling this the canonical import surface.
- I wanted the real export list and to check whether docs were accurate or stale.

What I learned:
- This file is the real SDK contract.
- It re-exports far more than the public docs summarize: layout primitives, animation helpers, render monitor, tree widget, ASCII composition tools, terrain helpers, patterns, markdown helpers, and more.
- The existence of this broad export surface explains why modules can stay decoupled from `src/core/*`.
- It also means the docs are at risk of drifting unless one of them is generated or explicitly kept aligned with this file.

What I opened next because of that:
- `src/services/microapp-loader.ts` for the host interface and registration behavior

### 17. `src/services/microapp-loader.ts`

Why I opened it:
- The loader is the real owner of `MicroappHost`, command registration, snapshots, and window registration.
- If docs and scaffold disagree, the loader decides.

What I learned:
- `createWindow()` delays registration via `queueMicrotask()` so modules get one synchronous pass to attach hooks before the window enters managed state.
- `describeState()` is wrapped to force `appType: moduleId`.
- `registerCommand()` prefixes command IDs as `microapp.<moduleId>.<id>` and wraps non-`direct` commands in `focusOrCreate`.
- `registerSnapshot()` exists on the host and is the real persistence seam.
- The host also exposes `runCommand`, `runGlobalCommand`, `worldChat`, and a `ui` object.
- This file is the real source of truth for persistence and command behavior; no public doc matches it closely enough.

What I opened next because of that:
- search results for doc cross-links and persistence examples

### 18. Search: `module-authoring|building-custom-modules|microapp-sdk`

Why I opened it:
- After reading several docs, I needed to see how they reference each other and whether any links were stale.

What I learned:
- `.agents/microapp-sdk.md` and `microapps/README.md` both point to `docs/microapp-authoring.md`.
- `docs/microapp-authoring.md` does not exist.
- `docs/building-custom-microapps.md` is therefore the closest public replacement, but the repo still advertises the missing doc as canonical.
- The search also confirmed the SDK import path is consistently used across modules.

What I opened next because of that:
- `microapps/README.md`
- a direct existence check for `docs/microapp-authoring.md`

### 19. `microapps/README.md`

Why I opened it:
- It looked like the module directory’s own onboarding document.
- I wanted to see whether it clarifies the public vs internal authoring path.

What I learned:
- It reinforces the missing `docs/microapp-authoring.md` link.
- It contains useful repo-level context about `microapps/` vs `microapps-private/`.
- It is partly stale: it mentions `dream-forecast` and a canonical doc that is missing.
- It does not currently function as a reliable entrypoint for new microapp authors.

What I opened next because of that:
- a direct existence check for `docs/microapp-authoring.md`

### 20. Existence check: `docs/microapp-authoring.md`

Why I opened it:
- Both `.agents/microapp-sdk.md` and `microapps/README.md` referred to it as canonical.

What I learned:
- It is missing.
- This is the most obvious first-contact paper cut in the current module docs.

What I opened next because of that:
- the lower half of `docs/building-custom-microapps.md`
- the lower half of `.agents/microapp-sdk.md`

### 21. Lower half of `docs/building-custom-microapps.md`

Why I opened it:
- I had only seen the front half. I needed to know whether persistence, examples, and pitfalls were explained later.

What I learned:
- The doc does include verification steps, common mistakes, and more example pointers.
- It still treats persistence too lightly.
- It names `dream-forecast` as an example even though I could not find that module.
- It is a good "starter guide", but not the full authoritative guide it is currently acting as.

What I opened next because of that:
- the lower half of `.agents/microapp-sdk.md`

### 22. Lower half of `.agents/microapp-sdk.md`

Why I opened it:
- I needed to see whether it filled in the missing authoring details.

What I learned:
- It is much richer than the public doc and includes practical code for timers, motion, render monitoring, patterns, figlet, scroll gotchas, and restyling.
- It also mixes beginner guidance with advanced gotchas and a few direct internal imports in examples, for example the scrollbar snippet from `src/core/ui-primitives.js`.
- That weakens the "SDK path only" message a little.

What I opened next because of that:
- a focused search for `registerSnapshot` and `persist` usage in real modules

### 23. Search: `registerSnapshot|persist|snapshot`

Why I opened it:
- The docs kept mentioning persistence without showing the actual shape.
- I needed live examples and to verify that the host API is really used by modules today.

What I learned:
- Many modules use `host.registerSnapshot(...)`.
- `wibwob-poetry-clock`, `world-chatroom`, `wibwobworld`, `wibwob-tr808`, `patchbay-lab`, and others have real persistence implementations.
- This confirmed the docs are underselling a real supported feature, not an aspirational one.

What I opened next because of that:
- the actual `registerSnapshot` implementation in `microapp-loader.ts`
- one compact example module using it

### 24. `src/services/microapp-loader.ts` snapshot section

Why I opened it:
- I wanted the exact host API shape for snapshots, not just the earlier interface skim.

What I learned:
- `host.registerSnapshot` registers a dynamic snapshot handler through `registerDynamicSnapshot(moduleId, snapshotHandler)`.
- The exposed handler shape in the current loader is `serialize` plus `restore`.
- This is the seam the docs should show when they talk about `"persist": true`.

What I opened next because of that:
- `microapps/wibwob-poetry-clock/index.ts` near its snapshot code

### 25. `microapps/wibwob-poetry-clock/index.ts` snapshot section

Why I opened it:
- I wanted the smallest real example of persistence.

What I learned:
- This is the example the docs should probably use.
- The module serializes `mode` and `voice`, then restores by calling its own `open` command with those args.
- That is a clear, teachable pattern: snapshot minimal semantic state, restore through the same public opening path.

What I opened next because of that:
- one more module snippet, because I wanted to see whether there were competing patterns in the wild

### 26. `microapps/wibwob-tidepool/index.ts` snapshot section

Why I opened it:
- I wanted to see whether persistence patterns were consistent across modules.

What I learned:
- There appears to be API drift in the wild: this module uses a different-looking snapshot pattern with `canRestore` and a different payload shape.
- Whether that is current, stale, or pending branch work, it strengthens the case that persistence docs need a single authoritative explanation.

What I stopped on:
- At this point I had enough evidence to assess the docs and propose a cleaner `.agents/` layout.

## Assessment

### Can an agent efficiently build a microapp from these docs?

Short answer:
- Yes, but only after triangulating across too many files.

What works:
- `AGENTS.md` gives a usable breadcrumb trail and names good example modules.
- `docs/building-custom-microapps.md` is a competent quick-start.
- `.agents/microapp-sdk.md` contains the highest-value practical guidance.
- `src/services/microapp-sdk.ts` and `src/services/microapp-loader.ts` are clean enough that an agent can recover the truth when docs are fuzzy.
- The example module set is strong and varied: minimal-ish, animated, compact real app, and broad sampler.

What causes friction:
- The canonical link is broken. Multiple places point to `docs/microapp-authoring.md`, which is missing.
- Module author guidance is split awkwardly across public docs, `.agents` docs, subsystem specs, and implementation code.
- The most useful authoring doc is named `.agents/microapp-sdk.md`, which sounds like internal reference, not "start here if building a microapp".
- Required-vs-optional lifecycle guidance is inconsistent.
  - Public doc: four hooks are mandatory.
  - Scaffold: no `onCleanup` unless needed.
- Persistence is under-documented.
  - The docs say it exists.
  - The real API lives in `microapp-loader.ts`.
  - The best example is hidden in real modules.
- Some example pointers are stale or misleading.
  - `hello-world` is no longer truly minimal.
  - `dream-forecast` is referenced but not obviously present.
- Some advice leaks internal paths or shell-maintainer concerns into author docs.
  - Example: scrollbar import from `src/core/ui-primitives.js` in the SDK doc.
  - Example: large internal subsystem specs being mandatory reading before touching a module.

What is redundant:
- `docs/building-custom-microapps.md` and `.agents/microapp-sdk.md` overlap substantially on manifest shape, lifecycle hooks, timers, and imports.
- `microapps/README.md` repeats authoring pointers, but currently adds stale references more than clarity.
- `AGENTS.md` and `.agents/specs/agent-session.md` both explain reload vs restart for modules.

What is missing:
- One obvious, cold-read "microapp author start here" document.
- One authoritative persistence section with actual `host.registerSnapshot` examples.
- A genuinely minimal example module, kept intentionally boring.
- A doc explaining which `.agents/specs/*` files matter to microapp authors versus shell maintainers.
- A reliable map of example modules by use case:
  - minimal
  - animated
  - persistent
  - multi-command
  - layout sampler

Bottom line:
- An experienced agent can build a microapp efficiently here.
- A first-contact agent can also get there, but only by doing what I just did: reconcile docs against code.
- That is acceptable for maintainers, not ideal for onboarding.

## `.agents/` Structure Assessment

### Does the current structure help a new agent find the right docs?

Partially.

What is good:
- The directory is small.
- The filenames are plain English.
- `specs/` clearly signals deeper subsystem material.

What is weak:
- Top-level `.agents/` mixes three audiences without labeling them:
  - shell maintainers
  - microapp authors
  - operators/agents using the control API
- `microapp-sdk.md` is the most relevant file for this task, but its name sounds like an API reference, not an onboarding guide.
- `architecture.md` and `invariants.md` are globally important, but they read like shell-contributor docs, not task-specific docs.
- `wibwobworld-iso-fix.md` is an orphan at top level and breaks the information architecture.
- `specs/` contains mandatory module-adjacent material, but "specs" is not a strong cold-read cue for "read this before editing modules".

### Does it distinguish between someone building a microapp addon vs working on shell internals?

No, not well enough.

Current effect on a new agent:
- `ls .agents/` does not tell you "go here if you are authoring a module".
- It also does not tell you which files are cross-cutting rules versus implementation-owner documents.
- The result is defensive over-reading.

## Proposed `.agents/` Restructure

Design goals:
- Pass the cold-read test.
- Segment by audience first, subsystem second.
- Keep deep specs, but move them behind clearer directories.
- Make one module-authoring entrypoint impossible to miss.

### Annotated tree

```text
.agents/
├── README.md                      — Audience map and fastest doc paths
├── start-here/
│   ├── module-author.md           — First-stop guide for building microapps
│   ├── shell-contributor.md       — First-stop guide for shell internals
│   └── operator-agent.md          — First-stop guide for running the desktop
├── module-authors/
│   ├── overview.md                — Module model, lifecycle, verification expectations
│   ├── sdk-reference.md           — Canonical MicroappHost and SDK surface
│   ├── persistence.md             — Snapshot patterns with real examples
│   ├── examples.md                — Which module examples teach what
│   └── pitfalls.md                — Common module mistakes and gotchas
├── shell-internals/
│   ├── architecture.md            — Core service and ownership map
│   ├── invariants.md              — Cross-cutting architecture rules
│   └── subsystems/
│       ├── window-system.md       — Window lifecycle, registration, blessed gotchas
│       ├── state-and-api.md       — State model and control API contract
│       ├── workspace.md           — Workspace persistence and restore rules
│       ├── agent-session.md       — In-app agent architecture and tool rules
│       └── image-rendering.md     — Browser image processing specifics
├── operations/
│   ├── control-api.md             — HTTP control surface and operator workflow
│   ├── launch-and-restart.md      — Start, restart, tmux, health-check patterns
│   └── visual-verification.md     — Screenshot, minimap, human-check workflow
├── reference/
│   ├── command-rules.md           — Command catalog, menu, palette conventions
│   ├── docs-index.md              — Canonical docs and code truth sources
│   └── agent-notes-protocol.md    — How to append durable findings
└── archive/
    └── wibwobworld-iso-fix.md     — Historical one-off note, not onboarding
```

### Why this layout is better

- Audience-first navigation beats concept-first navigation for first contact.
- `start-here/module-author.md` makes the module path explicit instead of implied.
- `module-authors/` gives module builders a complete lane without forcing them through shell-internal docs first.
- `shell-internals/subsystems/` keeps the deep specs, but now their audience is legible.
- `operations/` isolates run-the-app guidance from build-the-app guidance.
- `reference/docs-index.md` gives maintainers one place to define what is canonical and retire stale links.
- `archive/` prevents one-off notes from polluting the cold-read surface.

## Opinionated Recommendations

If I were cleaning this up, I would do these in order:

1. Create `.agents/start-here/module-author.md` and make it the obvious entrypoint.
2. Replace all references to `docs/microapp-authoring.md` with the real canonical file.
3. Split current `.agents/microapp-sdk.md` into:
   - onboarding/overview
   - SDK reference
   - pitfalls/gotchas
4. Add one persistence doc with:
   - manifest `persist: true`
   - `host.registerSnapshot(...)`
   - one minimal serialize/restore example
5. Restore a truly minimal module example, or freeze one scaffold snapshot as canonical.
6. Move top-level one-off notes like `wibwobworld-iso-fix.md` out of the main discovery path.

## Final Take

The repo already contains enough truth for an agent to build good modules. The issue is not lack of content; it is signposting. Right now, the path is survivable but unnecessarily forensic. A small audience-based reorg would make "vibe code a custom module" feel like a supported workflow instead of an archaeological dig.
