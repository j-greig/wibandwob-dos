# E001: Codified Context Infrastructure v2

Status: proposed
GitHub issue: #106
PR: —

> **Relationship to e001-brief.md:** This v2 doc supersedes the acceptance
> criteria in e001-brief.md. When implementation starts, the brief's ACs
> should be replaced with the seven ACs defined here. The brief remains
> the canonical epic shell (status, links, summary); this doc owns the
> detailed design and updated acceptance criteria.

## Summary

WibWob-DOS needs a project-memory system that is cheap to query, easy to update, and hard to let drift silently. The aim is not to copy the 'Codified Context' paper literally. The aim is to adapt its hot / specialist / cold memory pattern to this repo using the primitives we already have: `CLAUDE.md`, `.pi/skills/`, `.planning/`, scripts, and QMD.

This v2 proposes a practical shape:

* **Tier 1: hot memory** stays in `CLAUDE.md` and carries compact repo law: architecture summary, command-path law, routing triggers, update rules, and a planner-first protocol.
* **Tier 2: specialists** are implemented primarily as **skills**, with thin helper scripts where needed. These are not generic personas. They are repo-specific operators with clear scope, permissions, inputs, outputs, and linked cold-memory docs.
* **Tier 3: cold memory** is stored as machine-facing subsystem specs in markdown/QMD-friendly form and retrieved through **QMD-backed search scripts** that expose the paper’s five core retrieval actions.

The important adaptation is this: for WibWob-DOS, the “served via MCP” layer does not need to begin as a full remote service. It can begin as **repo-local scripts + skills** that present the same interface shape:

1. `list_subsystems`
2. `get_files_for_subsystem`
3. `find_relevant_context`
4. `search_context_documents`
5. `suggest_agent`

QMD becomes the retrieval engine over docs we create and curate. Skills become the ergonomic surface the agent calls. Scripts do the deterministic work: indexing, mapping, drift checks, and structured lookup.

The system should be **phased and reactive**. Start with a small constitution and a few high-failure subsystem specs. Add specialists only where the agent repeatedly stalls, misroutes, or re-asks for the same context. Treat knowledge-to-code ratio as telemetry, not target. The useful signal is agent behaviour: confusion, repetition, null search hits, or plausible-but-wrong edits.

## Why this shape fits WibWob-DOS

WibWob-DOS already has the beginnings of all three tiers:

* `CLAUDE.md` as always-loaded project law
* `.pi/skills/` as a natural place for specialist operators
* `.planning/` and other markdown material as seed cold memory
* QMD as an existing search/index primitive

What is missing is not raw documentation quantity. What is missing is **clear separation of roles**:

* what is always loaded
* what is loaded only for a domain
* what is searchable on demand
* what updates when code changes
* what signals that memory is missing or stale

This epic formalises that separation.

## Core design decisions

### 1) Skills + scripts instead of full MCP first

The five paper tools should first exist as **stable repo-local commands**, wrapped by skills where useful.

Proposed mapping:

* `list_subsystems` → script returns known subsystem keys, titles, linked specs, linked skills
* `get_files_for_subsystem` → script returns file coverage map for one subsystem
* `find_relevant_context` → script performs weighted lookup from task text across subsystem names, aliases, file paths, command IDs, and QMD hits
* `search_context_documents` → script performs broader free-text or keyword search across machine-facing specs and selected planning docs
* `suggest_agent` → script returns best-fit skill(s), confidence, and why

Later, these can be exposed over MCP without changing the conceptual interface.

### 2) QMD is the retrieval backend, not the hot-memory format

Default assumption for v2:

* canonical spec files remain markdown with frontmatter or a strict heading schema
* QMD indexes and searches those docs
* scripts normalise queries and shape results

This keeps authoring simple while still using QMD for search.

### 3) Planner-first is a protocol, then a tool

Before implementation work, the agent should do a context pass:

1. identify likely subsystem(s)
2. run `suggest_agent`
3. fetch linked spec(s)
4. inspect drift/staleness warnings
5. only then start editing

At first this can live in `CLAUDE.md` and skills. Later it can be enforced by automation.

### 4) Specs are machine-facing and scoped to one subsystem

Each spec should describe one subsystem only. Not a whole feature cluster, not a vague theme.

Suggested spec keying for WibWob-DOS: by **conceptual subsystem**, not folder alone and not single class alone.

Examples:

* `command-registry`
* `window-manager`
* `workspace-persistence`
* `desktop-shell-chrome`
* `content-measurement`
* `agent-control-surface`
* `theme-system`
* `blessed-rendering-adapter`

### 5) Drift detection is session-start first, with suppression

Staleness matters most when an agent begins work. So the first strong hook should be a **session-start drift check**:

* inspect recent commits or working tree changes
* map changed files to covered subsystems
* compare with spec update markers
* emit warnings into session context

CI and pre-commit can follow later.

**Suppression logic** (from companion repo review): drift warnings must not become permanent noise. Without suppression, agents learn to ignore them.

* show a drift warning N times (default 3), then auto-dismiss until new commits arrive for that subsystem
* priority tiering on subsystems: HIGH (state, commands, window system) always warns; MEDIUM (workspace, agent surface) warns N times then suppresses; LOW (theme, paint, games) suppresses silently after first warning
* priority tier is declared per-subsystem in the index file (see decision 6)

### 6) One index file is the core data structure

All five retrieval scripts are views over a single lookup table. The index is primary; the tools are secondary.

**Location:** `docs/specs/subsystem-index.yaml` (or `.json`)

**Shape per entry:**

```yaml
window-system:
  title: Window System
  aliases: [wm, window manager, blessed windows]
  priority: HIGH
  files: [src/core/window-*.ts, src/core/layout-*.ts]
  spec: docs/specs/window-system.md
  skills: [window-system-reviewer]
  tests: [test/window-*.test.ts]
```

Every retrieval script reads this file. QMD indexes the specs it points to. Drift detection walks its file globs. `suggest_agent` matches task text against aliases and file paths. One file to maintain, not five scripts with hardcoded knowledge.

### 7) Bootstrap skill for spec creation

A `context-factory` skill that generates new subsystem specs from a template. Three questions:

1. what subsystem?
2. what files does it cover?
3. what breaks when it goes wrong?

Outputs a draft spec in canonical format, adds an entry to `subsystem-index.yaml`, and indexes via QMD. This is how the system grows reactively without manual boilerplate.

## Proposed architecture

### Tier 1 — Hot memory

**Location**

* `CLAUDE.md`
* optional generated include files later, but not required for phase 1

**Purpose**

* repo law
* architecture compression
* trigger routing
* planner-first protocol
* memory maintenance rules

**Must contain**

* short architecture map of `core`, `windows`, `services`, `adapters`, `tests`
* command-path law: define command once, derive menu/palette/API from registry
* pre-change trigger table
* post-change trigger table
* when to call retrieval scripts
* when to call specialist skills
* how to respond to drift warnings
* how to promote repeated explanations into specs

### Tier 2 — Specialists

**Location**

* `.pi/skills/` as primary home
* helper scripts in `scripts/context/` or similar

**Specialist shape**

Each specialist should declare:

* subsystem scope
* allowed file areas
* permissions: read-only reviewer or write-capable builder
* required retrieval calls before editing
* linked specs
* common failure modes
* expected output format
* escalation rules

**Initial specialist candidates**

1. `command-registry-keeper`
2. `window-manager-reviewer`
3. `workspace-persistence-builder`
4. `content-measurement-reviewer`
5. `agent-control-surface-builder`

These should be chosen from actual failure history, not aesthetics.

### Tier 3 — Cold memory

**Location**

* `docs/specs/` or `.planning/specs/` depending on repo preference
* indexed by QMD

**Spec structure**

Each spec should use a repeatable structure:

1. purpose
2. subsystem boundary
3. key files
4. important types / functions / commands
5. invariants
6. expected behaviour
7. symptom → cause → fix table
8. do / do not
9. tests / validation commands
10. related specs
11. related skills
12. coverage map
13. last reviewed / drift marker

## Retrieval interface

The repo should expose the following stable actions.

### `list_subsystems`

Returns all subsystem keys with:

* title
* aliases
* linked files
* linked specs
* linked skills
* last reviewed timestamp

### `get_files_for_subsystem`

Returns:

* covered files
* optional file globs
* excluded files
* related tests
* related commands

### `find_relevant_context`

Input: free-text task description
Output: ranked subsystem hits with reasons, linked specs, linked skills, possible warnings

Ranking sources may include:

* subsystem key and aliases
* file path mentions
* command IDs
* app/window type names
* QMD keyword matches
* recent touched files

### `search_context_documents`

Broader free-text lookup across cold-memory docs and selected planning docs. Results should return small structured excerpts, not full dumps by default.

### `suggest_agent`

Returns best-fit specialist skill(s) with:

* confidence
* reasoning
* required context docs
* whether a read-only reviewer should run first

## Phased rollout

### Phase 1 — Foundation

* tighten `CLAUDE.md`
* add trigger tables
* define planner-first protocol
* choose canonical spec location
* create 3–5 subsystem specs
* create retrieval scripts with simple keyword matching
* integrate QMD indexing/search

### Phase 2 — First specialists and drift checks

* add 3–5 specialist skills for real high-failure domains
* add explicit coverage maps
* add session-start drift detector
* surface drift warnings into agent context
* log retrieval hits and misses

### Phase 3 — Compaction and maintenance

* add spec promotion workflow from repeated explanations
* compact overlapping planning material into stable subsystem specs
* add telemetry dashboards/reports
* decide whether to expose scripts over MCP
* consider embeddings only if keyword routing proves weak

## Proposed defaults for unresolved questions

These are defaults for v2 unless Codex argues otherwise.

### Storage

* keep hot memory in `CLAUDE.md`
* store machine-facing specs in `docs/specs/`
* treat `.planning/` as mixed material: some prose stays human-facing, stable extracts get promoted into specs

### Routing

* routing should use more than file globs: include command IDs, subsystem keys, and window/app types where available
* the command registry should become one routing source, but not the only one

### Spec lifecycle

* lifecycle: `draft -> active -> compressed -> archived`
* agents may propose spec patches directly, but human review remains default
* source of truth precedence: code + tests first, constitution for repo law, workspace snapshots as evidence not law

### Drift/staleness

Count as stale when any of these change without spec review:

* file coverage contents
* exported command signature
* workspace snapshot schema
* key type or function names listed in spec
* expected behaviour contradicted by tests

Run drift detection at:

* session start first
* CI second
* pre-commit later if noise is manageable

### Retrieval scope

Retrieval results should be able to return:

* specs
* exact files
* related commands
* related tests
* recent commits touching the subsystem

Live TUI runtime state should be queryable later, but it is not required for phase 1.

## Self-compacting and self-updating model

For WibWob-DOS, “self-compacting” should mean three things:

1. **promotion** — repeated explanations or repeated agent failures become stable subsystem facts
2. **deduplication** — facts that appear across multiple planning docs get merged into one canonical spec
3. **compression** — older planning prose gets summarised upward into short machine-facing statements and linked, not copied

“Self-updating” should not mean fully autonomous truth editing. It should mean:

* the system detects likely stale areas
* proposes updates
* links evidence
* lets a human or trusted agent accept the patch

## Acceptance criteria

* [ ] AC-1: `CLAUDE.md` contains a planner-first protocol plus pre-change and post-change trigger tables

  * Test: grep for planner-first section, pre-change triggers, post-change triggers, and fallback routing instructions

* [ ] AC-2: repo exposes five retrieval actions as scripts or script-backed skills

  * Test: exercise `list_subsystems`, `get_files_for_subsystem`, `find_relevant_context`, `search_context_documents`, and `suggest_agent` from an agent session

* [ ] AC-3: at least five single-subsystem specs exist in canonical machine-facing format

  * Test: each spec passes structure checklist and includes coverage map, invariants, failure modes, and related skills

* [ ] AC-4: QMD indexes canonical specs and returns relevant results for free-text queries

  * Test: run representative queries from agent tasks and verify ranked hits include the correct subsystem docs

* [ ] AC-5: a session-start drift detector warns when covered code changed without spec review

  * Test: modify a covered file, leave spec unchanged, begin a new agent session, verify warning names subsystem and stale spec

* [ ] AC-6: telemetry records retrieval hits, null searches, drift warnings, and repeated human re-explanation events

  * Test: run telemetry report and verify each metric is reported from session/log data

* [ ] AC-7: at least one specialist is read-only reviewer and at least one is write-capable builder

  * Test: inspect skill definitions and verify permission class changes behaviour

## First candidate specs

The confusion audit is a strong input, but it needs to be filtered through current repo reality:

* old **C++ / Python / API split** pain should not dominate if that architecture is gone
* scores still matter when they reveal enduring conceptual difficulty
* first-wave specs should follow **live TS risk**, not historical total pain

Adjusted first five specs for the current TypeScript shell:

1. **window-system**

   * still the core abstraction
   * active in the TS shell
   * high confusion volume remains relevant
2. **workspace**

   * very high correction-to-confusion ratio
   * boot/restore law is easy to get subtly wrong across sessions
3. **agent-llm-system**

   * high human-correction density
   * worth capturing as explicit rules, contracts, and “never do that” guidance
4. **terminal-pty-patterns**

   * not current shell core, but still relevant for Backrooms TV and any future terminal window
   * should be documented as reusable patterns and failure modes, not as a first-class UI subsystem
5. **state-control-surface**

   * adapted from the old `state-api-ipc` area
   * focus the spec on TS desktop state, command execution, and control contracts rather than the removed Python/API seam

Second wave:

6. **scramble**
7. **multiplayer-partykit**

`multiplayer-partykit` should likely stay out of phase 1 unless current roadmap work touches shared state. `scramble` is important but narrower than the shell-wide abstractions above.

Recommended first specialist upgrades:

1. `window-system-reviewer`
2. `workspace-persistence-reviewer`
3. `agent-tools-reviewer`
4. `terminal-pty-patterns-reviewer`
5. `state-control-surface-builder`

These should be split between **read-only reviewers** for dangerous or cross-cutting domains and **write-capable builders** where the implementation surface is smaller and easier to validate.

## First candidate scripts

* `scripts/context/list_subsystems.*`
* `scripts/context/get_files_for_subsystem.*`
* `scripts/context/find_relevant_context.*`
* `scripts/context/search_context_documents.*`
* `scripts/context/suggest_agent.*`
* `scripts/context/check_drift.*`
* `scripts/context/report_telemetry.*`

Language and exact layout should follow existing repo conventions.

## Questions for Codex before implementation

These are the most useful questions to ask the original concept author with full repo context.

1. The confusion audit ranks `terminal-pty`, `window-system`, `state-api-ipc`, `multiplayer-partykit`, `scramble`, `agent-llm-system`, and `workspace` as the main pain areas. Which of these are still **live TypeScript risks**, and which are mostly **historical scars** from the C++ / Python / API era?
2. Given the removal of the old API/Python side, should `state-api-ipc` be redefined for the new shell as **state-control-surface** or split into smaller TS-native specs?
3. Do you agree the first phase should prioritise these canonical specs:

   * `window-system`
   * `workspace`
   * `agent-llm-system`
   * `terminal-pty-patterns`
   * `state-control-surface`
     If not, what exact set would you choose instead, and why?
4. Of the current `.planning/` material, which files are closest to **promotable machine-facing specs** for those five areas?
5. Should canonical cold-memory docs live in `docs/specs/`, `.planning/specs/`, or elsewhere given current repo habits and likely maintenance burden?
6. Is QMD strong enough today to back these five retrieval actions, or are there known gaps around aliases, ranking, partial matches, or structured metadata?
7. Which routing signals already exist in the repo and are reliable enough to use: file globs, command IDs, window/app types, schema names, test names, folder boundaries?
8. Which current `.pi/skills/` entries are already close to true Tier 2 specialists and should be upgraded rather than replaced?
9. Which domains should be **read-only reviewer skills** first because write access there is risky?
10. What should count as a **subsystem** in this repo: conceptual area, file-tree area, runtime object, or command surface?
11. Where is the natural place to run a **session-start drift hook** in the actual workflow today?
12. What existing scripts or utilities could be reused to implement:

* `list_subsystems`
* `get_files_for_subsystem`
* `find_relevant_context`
* `search_context_documents`
* `suggest_agent`

13. Which **two user journeys** would best test the whole loop end-to-end: planner → retrieval → specialist → edit → drift warning → spec update?
14. What should count as a **repeated human re-explanation event** in current logs or working style?
15. Which parts of `CLAUDE.md` are already too mixed, too large, or too unstable and should eventually be pushed down into cold memory?
16. Which decisions in this concept are **wrong for this repo** and should be changed before stories are cut?
17. If you had to implement only **Phase 1 in one tight pass**, what exact files, scripts, and first specs would you create?

## Story slicing suggestion

Cut implementation stories in this order:

1. constitution tightening + trigger tables
2. canonical spec location + schema
3. QMD-backed retrieval scripts
4. first five subsystem specs
5. first two specialist upgrades
6. session-start drift detector
7. telemetry and compaction workflow

## Non-goals

* full embeddings-based semantic retrieval in phase 1
* full autonomous spec rewriting without review
* documenting the entire repo before using the system
* building a networked MCP service before repo-local retrieval works

## Reference note

This v2 borrows the paper’s architecture and operational lessons, but adapts the implementation to WibWob-DOS by using skills + scripts + QMD as the first concrete substrate.
