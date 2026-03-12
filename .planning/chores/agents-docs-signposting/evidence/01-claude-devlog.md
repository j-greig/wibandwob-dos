# Devlog: First-Contact Module Discovery

**Goal:** A human asked me to "vibe code a custom module" for this project.
I know nothing about the codebase. This log tracks every file I open,
what I learned, and what I decided to do next.

---

## Friction Points (discovered during this walkthrough)

1. **Dead link** — `docs/module-authoring.md` referenced by `.agents/microapp-sdk.md`
   and `modules/README.md` but does not exist. Agent hits a wall following breadcrumbs.

2. **60% content overlap** — `docs/building-custom-modules.md` and `.agents/microapp-sdk.md`
   both contain skeletons, manifests, common mistakes tables, and checklists. Double the
   token cost for the same knowledge.

3. **No fast path** — docs are procedural and thorough but no "here's the 30-second
   pattern" distillation. Scaffold generates a static text box saying "replace me" rather
   than showing animation/styling patterns in action.

4. **Architecture detour** — AGENTS.md links `.agents/architecture.md` before the module
   section. A fresh agent reads 200 lines about window-facade.ts and command-catalog.ts
   before discovering none of it matters for modules.

5. **No "which example for which pattern" table** — three reference modules listed but
   no guidance on when to look at each one.

6. **SDK exports are ~100+ symbols** — no "you need these 5 for 90% of modules"
   fast-start section.

---

## Proposed: directory structure as audience signposting

### Problem: flat .agents/ mixes two audiences

`.agents/` holds docs for two distinct readers — core shell contributors
and module addon authors — in a single flat directory with no structural
signal about who should read what.

An agent tasked with "build me a module" currently has to open and skim
architecture.md (window-facade, command-catalog, content-measurement)
before discovering none of it applies. AGENTS.md compounds this: its
four `@` includes and opening sections (Direction, Canon, Key Files)
are all core-contributor context, with "Building a New Module" buried
at line 53.

The docs are thorough. The problem is sequencing and legibility — the
right information exists but the wrong reader encounters the wrong
material first.

### Principle: the filepath IS the table of contents

If an agent can determine relevance from the path alone — before opening
any file — it reads fewer irrelevant tokens and reaches the right doc
faster. Directory names should encode audience, not just topic.

### Proposed .agents/ structure

```
.agents/
  core/                     you are maintaining the shell
    architecture.md
    control-api.md
    invariants.md
    specs/
      window-system.md
      state-and-api.md
      workspace.md
      agent-session.md
      image-rendering.md
  modules/                  you are building an addon
    microapp-sdk.md
  skills/                   (unchanged)
```

`core/` vs `modules/` — two words, zero ambiguity, readable at `ls` speed.

### Proposed AGENTS.md: module-first ordering

The most common agent task is "build a module", not "refactor the window
manager". AGENTS.md should front-load the more common path and let core
material follow. A module author stops reading early. A core contributor
reads everything anyway.

```
# AGENTS.md

(one-line project description)

## Building Modules                        ← first, smaller, self-contained
  scaffold command
  three-doc reading list
  which-example-for-which-pattern table
  @.agents/modules/microapp-sdk.md

## Shell Development                       ← second, full depth
  @.agents/core/architecture.md
  @.agents/core/invariants.md
  @.agents/core/control-api.md
  Direction, Canon, Key Files, Command Rules, Subsystem Specs...
```

### Deduplication

`docs/building-custom-modules.md` = the canonical full guide (lifecycle,
manifest, skeleton, common mistakes, verification checklist). Public,
self-sufficient, copy-pasteable.

`.agents/modules/microapp-sdk.md` = SDK policy and advanced API reference
only. Strips the duplicated skeleton, manifest template, and common-mistakes
table — those live in the main guide exclusively.

One source of truth per concern, applied to the docs themselves.

### Annotated tree

Directory names should pass the "cold read" test — a new agent running
`ls .agents/` should know where to go without opening anything.

Problems with obvious first choices:
- `modules/` collides with repo-root `modules/` where actual code lives
- `core/` is generic — could mean core concepts, core docs, core anything

Better names encode the ACTIVITY, not the subject:

```
.agents/
│
├── module-dev/                     you are making an addon for the shell
│   └── microapp-sdk.md             SDK contract, advanced API, import rules
│
├── shell-dev/                      you are working on the shell itself
│   ├── architecture.md             STOP: not needed for module work
│   ├── control-api.md              STOP: not needed for module work
│   ├── invariants.md               STOP: not needed for module work
│   └── specs/                      STOP: not needed for module work
│       ├── window-system.md        window lifecycle, chrome, z-order, facade
│       ├── state-and-api.md        state shape, API parity, tool wiring
│       ├── workspace.md            save/restore, snapshot format, migration
│       ├── agent-session.md        agent window, tools, session lifecycle
│       └── image-rendering.md      image hydration, extraction, splice pipeline
│
└── skills/                         runtime operational skills for agents
    ├── chiptune/                   audio synthesis and cover arrangements
    ├── ww-ops/                     build, launch, test, health check
    ├── ww-screenshot/              capture single window as text crop
    └── ...
```

`module-dev/` vs `shell-dev/` — terse, parallel, no ambiguity.
`dev` signals "you are here to write code", distinguishing both from
`skills/` which is "you are here to operate".

The entire `shell-dev/` subtree is irrelevant for module vibe coding.
A module author never touches src/core, src/services, window-facade,
command-catalog, or any subsystem spec. Everything they need flows
through the host object and the SDK import surface. If an agent opens
anything in `shell-dev/` while making a module, the directory
structure failed its job.

### Reading paths

  Module author — AGENTS.md top section, docs/building-custom-modules.md,
  one example module. Three docs, under 10 minutes, no detours.

  Core contributor — full AGENTS.md, .agents/core/*, specs on demand.
  Module section gives them SDK context they maintain anyway.

  External/community developer — identical to module author.
  The default path is the happy path.

---

## Step 0: Orient — `ls` the root

**Saw:** AGENTS.md, CLAUDE.md, README.md, HANDOVER.md, WELCOME.md, LINGO.md
at root. Also: `modules/`, `src/`, `docs/`, `.agents/`, `.planning/`, `scripts/`.

**Decision:** AGENTS.md is the canonical agent constitution — that's where I start.
README.md is for humans. AGENTS.md is for me.

---

## Step 1: AGENTS.md — the "Building a New Module" section

**Opened:** `AGENTS.md`
**Found:** A clear 5-step recipe at line 53:

1. Run `bash scripts/scaffold-microapp.sh modules/<name> wibwob.<id> "<Title>" <menuOrder>`
2. Read `docs/building-custom-modules.md` — lifecycle, SDK, common mistakes
3. Edit the scaffold, `bun run typecheck`, restart app
4. Reference modules: `glitchbox`, `e026-demo`, `wibwob-poetry-clock`
5. SDK surface: `.agents/microapp-sdk.md`

Also references: `.agents/architecture.md`, `.agents/invariants.md`,
`.agents/control-api.md`, `.agents/microapp-sdk.md` at the top.

**Verdict:** AGENTS.md gives me a BREADCRUMB TRAIL, not the knowledge itself.
It says "read docs/building-custom-modules.md" and "read .agents/microapp-sdk.md".
Good signposting. But I now need to follow both.

**Decision:** Open `docs/building-custom-modules.md` next — AGENTS.md says
that's where lifecycle, SDK, and common mistakes live.

---

## Step 2: docs/building-custom-modules.md — THE main guide

**Opened:** `docs/building-custom-modules.md` (~320 lines)

**This is the motherlode.** Contains:
- TL;DR and quick start (scaffold command)
- Directory structure
- Full module.json manifest with every field explained
- Full index.ts skeleton with all 4 required lifecycle hooks
- Host API reference (createWindow, registerCommand, screen, theme)
- Window handle API (body, id, focus, close, describeState, captureText, etc.)
- Animation section: createTimer, createEmbeddedLivePlayer
- SDK import guidance (import from microapp-sdk, not src/core)
- Workspace persistence notes
- Verification checklist (7 steps)
- Common mistakes table (10 entries)
- Example modules listed with descriptions
- "Further reading" links

**Verdict:** This is GENUINELY good agent documentation. It's complete,
copy-pasteable, and covers all the pitfalls. An agent could build a working
module from this doc alone.

**One issue:** References `docs/module-authoring.md` as further reading
from `.agents/microapp-sdk.md`, but that file DOES NOT EXIST. Dead link.
`modules/README.md` also references it. Two broken pointers to a ghost file.

**Decision:** Now check `.agents/microapp-sdk.md` for anything the main
guide missed.

---

## Step 3: .agents/microapp-sdk.md — SDK policy and API surface

**Opened:** `.agents/microapp-sdk.md` (~330 lines)

**This is a COMPLEMENTARY doc, not redundant.** It adds:
- Render policy (one local render function, mutate inside it, not ad hoc)
- Full MicroappHost API including geometry, windows facade, ui layout primitives
- Full MicroappWindowHandle API (same as main guide but tighter reference format)
- Core primitives: TreeWidget, Tabbed container, lifecycle timers, tween/motion,
  RenderMonitor, EmbeddedLivePlayer — ALL with code examples
- Pattern generators (11 built-in animated fill functions)
- Data simulation helpers (sinWave, randHistory, xLabels)
- ANSI gradient line
- Figlet text rendering
- Theme tokens reference
- Restyle pattern
- Common mistakes table (same as main guide, slight overlap)
- Scrollable canvas gotcha (blessed _getCoords bug + fix)
- Testing commands (typecheck, restart, API curl, screenshot)
- Shipping checklist

**Verdict:** Substantial overlap with `docs/building-custom-modules.md`
but adds the ADVANCED SDK surface (trees, tabs, tweens, patterns, gradients,
panel layout). An agent building anything beyond a static box needs this doc.

**Overlap problem:** Both docs have a "Common mistakes" table, a skeleton,
a manifest example, and a checklist. They're ~60% overlapping. An agent
reading both will process redundant content. Not harmful but not efficient.

**Decision:** Look at the scaffold script and real examples to see if the
docs match reality.

---

## Step 4: scripts/scaffold-microapp.sh — the generator

**Opened:** `scripts/scaffold-microapp.sh` (~95 lines)

**Does what it says.** Takes 3-4 args (dir, id, title, order), creates
module.json + index.ts with working boilerplate. The generated code matches
the patterns described in the docs. The scaffold includes a TODO-style
content box that tells you the next 5 steps.

**Verdict:** Excellent. An agent can run this and have a working module
in seconds. The generated code is correct and current.

---

## Step 5: modules/hello-world/ — minimal reference

**Opened:** `modules/hello-world/module.json` + `modules/hello-world/index.ts`

**Minimal, clean, correct.** Uses responsiveFiglet from the SDK. Has all 4
lifecycle hooks. 45 lines total. Matches the doc patterns exactly.

**Verdict:** Perfect "copy and modify" starting point.

---

## Step 6: modules/heartbeat/ — animated reference

**Opened:** `modules/heartbeat/index.ts` (~115 lines)

**Shows the animation pattern clearly.** Uses createTimer/clearTimers,
multiple blessed boxes, describeState with structured data (bpm, uptime,
frame, beat). Good example of a multi-timer module with proper cleanup.

**Verdict:** Exactly what an agent needs to see for "how do I animate stuff?"

---

## Step 7: modules/wibwob-poetry-clock/ — complex real module

**Opened:** `modules/wibwob-poetry-clock/index.ts` (first 60 lines of ~570)

**Shows real-world complexity.** Multiple modes, voices, AI integration,
contour player, figlet rendering. Imports many SDK exports. This is what
a "production" module looks like.

**Verdict:** Good for understanding scale, but NOT what you'd point a
first-timer at. Too much going on. hello-world and heartbeat are better
starting templates.

---

## Step 8: src/services/microapp-sdk.ts — the actual SDK source

**Opened:** `src/services/microapp-sdk.ts` (~287 lines)

**This is the re-export barrel file.** Shows every type, helper, and primitive
available to module authors. Well-organized with section headers:
- Core module authoring (timers, tween, render monitor, tree widget)
- Animation (embedded players)
- Grid canvas + ASCII composition
- Text rendering (markdown, figlet)
- Panel layout (magazine-style multi-panel)
- Advanced/internal (monster cam, skeleton, contour)

**Verdict:** An agent wouldn't READ this unless stuck — it's implementation.
But it's the definitive answer to "what can I import?"

---

## Step 9: .agents/architecture.md — broader context

**Opened:** `.agents/architecture.md` (first 60 lines)

**File inventory.** Lists every core file with a one-line description.
Has an "Adding a New Window Type" checklist (10 items).

**Verdict:** Overkill for module building. This is about adding core
window types, not microapps. A module author doesn't need to touch
window-facade.ts or command-catalog.ts. AGENTS.md already links here
but modules don't need most of this.

---

## Step 10: modules/README.md — module directory docs

**Opened:** `modules/README.md`

**Directory layout + private modules instructions.** References
`docs/module-authoring.md` which DOES NOT EXIST (second broken reference).
Has SDK import rules. Points at hello-world, poetry-clock, dream-forecast
as examples. Mostly about the private submodule system.

**Verdict:** Useful for understanding the module directory structure and
private module setup. Mostly duplicates what's already in the main guide.

---

## Step 11: Dead link audit

**Searched for:** `docs/module-authoring.md`
**Found references in:**
- `.agents/microapp-sdk.md` line 6: "Public authoring guide: docs/module-authoring.md"
- `modules/README.md`: "Canonical doc: docs/module-authoring.md"

**The file does not exist.** Two docs point at a ghost.

---

# ASSESSMENT: Can an agent vibe-code a module from these docs?

## What works well

1. **AGENTS.md breadcrumb trail** — immediately tells you the 5 steps and
   which docs to read. No guessing.

2. **docs/building-custom-modules.md** — genuinely excellent. Complete,
   copy-pasteable, covers pitfalls. An agent could build a working module
   from this one document.

3. **Scaffold script** — instant working boilerplate. Agent runs one command
   and has a compiling module.

4. **Reference modules** — hello-world (minimal), heartbeat (animated),
   poetry-clock (complex). Clear progression from simple to advanced.

5. **SDK barrel file** — everything importable from one path. No scavenger
   hunt through src/core/*.

6. **Common mistakes tables** — prevent the most likely agent errors
   (raw setInterval, theme read once, widgets on frame not body).

## What doesn't work

1. **Dead link: docs/module-authoring.md** — referenced by two docs,
   doesn't exist. An agent following the breadcrumb trail would hit a wall.
   Probably was replaced by docs/building-custom-modules.md without
   updating the pointers.

2. **Redundant overlap between the two main docs** —
   `docs/building-custom-modules.md` and `.agents/microapp-sdk.md` have
   ~60% content overlap (skeleton, manifest, common mistakes, checklists).
   An agent reads both and processes redundant tokens. Not harmful but
   wasteful. Could be: main guide for basics, SDK doc for advanced only.

3. **No "vibe coding" fast path** — the docs are thorough but procedural.
   There's no "here's a 30-second summary of the pattern" section that an
   agent could internalize to then freestyle from. The scaffold script is
   close, but the generated code is generic (a text box saying "replace me").
   A better scaffold might generate something WITH animation, WITH styling,
   to show the actual pattern in motion.

4. **The architecture.md detour** — AGENTS.md links to .agents/architecture.md
   at the top, which a fresh agent might read before finding the module section.
   architecture.md is about core window types, not microapps. An agent could
   waste significant context reading it. The module-building section in
   AGENTS.md should be more prominent or come before the architecture links.

5. **No "which example for which pattern" guide** — AGENTS.md lists three
   reference modules but doesn't say WHEN to look at each:
   - hello-world = static content (should say: "start here")
   - heartbeat = timers/animation (should say: "for animated modules")
   - poetry-clock = AI integration (should say: "for modules that call LLMs")
   The descriptions in the building guide are better but still terse.

6. **SDK exports are huge** — microapp-sdk.ts re-exports ~100+ symbols.
   The doc covers the important ones but an agent browsing the source file
   might be overwhelmed. A "you need these 5 imports for 90% of modules"
   section would help.

## The actual agent journey (ranked by efficiency)

### Optimal path (3 docs, ~10 min of reading):
1. AGENTS.md § "Building a New Module" (30 sec — get the recipe)
2. Run scaffold script (10 sec — have working code)
3. docs/building-custom-modules.md (5 min — understand the pattern)
4. One reference module matching your use case (2 min — see it real)
5. Start coding

### What actually happens (5-7 docs, ~20 min):
1. AGENTS.md — read the whole thing looking for module info (3 min)
2. .agents/architecture.md — linked at top, read it, most isn't relevant (3 min)
3. docs/building-custom-modules.md — the actual guide (5 min)
4. .agents/microapp-sdk.md — reread similar content with SDK additions (5 min)
5. Try docs/module-authoring.md — file not found (wasted attempt)
6. modules/README.md — more of the same (2 min)
7. Finally look at an example module (2 min)
8. Start coding

### Recommendations to improve agent onboarding:
1. Fix the dead link (point docs/module-authoring.md references at
   docs/building-custom-modules.md, or create it as a redirect)
2. Deduplicate the two main docs (building-custom-modules = full guide,
   microapp-sdk = advanced-only SDK reference, no skeleton/manifest duplication)
3. Add a "which example for which pattern" table in AGENTS.md
4. Add a "5 imports you always need" section to the SDK doc
5. Consider moving "Building a New Module" higher in AGENTS.md, before
   the architecture links that aren't relevant to module authors
