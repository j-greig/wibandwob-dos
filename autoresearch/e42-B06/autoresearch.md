> **E042 Solid Foundations** — Bucket 6 of 6
> ← Previous: [`e42-B05` Test + Benchmark Harness](../e42-B05/autoresearch.md)
> All buckets: B01 → B02 → B03 (strict) · B04 ∥ B02–B03 · B05 last · B06 agent-directed

# Autoresearch: E042-B06 — Next Frontier (Agent-Directed)

## Objective

**This bucket is an open prompt.** You are the researcher. B01–B05 are complete (or
substantially complete). Your job: audit what they produced, assess what's still wrong
or missing, and write + execute the next autoresearch brief yourself.

Read the findings, metrics, and ideas files from B01–B05 before you begin. You probably want to use Haiku/scout agents in parralel (or similar) to grok the `autoresearch.md` for each bucket and write up its `autoresearch.ideas.md` file as somehow this is usually forgotten. You'll then have a clearer picture of what was done / what wasn't / ideas that got parking-lotted. After reading up, decide what matters most and loop on it given the mandate below.

## Your Mandate

Make WibWob-DOS:

### 1. Architecturally Sound
- COAT-compliant: every semantic works without the TUI
- Single-responsibility: no god files, no multi-purpose functions
- Clean dependency graph: no cycles, no leaky imports
- Lazy where possible: boot cost proportional to what's actually used

### 2. DRY
- One concept, one owner, one file
- No duplicate patterns across microapps or windows
- Shared logic extracted to SDK or core, not copy-pasted
- Config/constants defined once, referenced everywhere

### 3. SDK: Fully Featured, Robust, Third-Party Friendly
- `microapp-sdk.ts` is the ONLY import surface — zero gaps
- Composition helpers cover every common UI pattern
- Blessed edge cases (double-fire, focus, scroll, tags) handled inside SDK, invisible to consumers
- A new developer reads one hero app + SDK docs and can build without asking questions
- TypeScript types are precise — no `any`, no stringly-typed IDs, discriminated unions where appropriate

### 4. Documentation: Up-to-Date, Well-Organised, DRY, Non-Verbose
- Agent docs (`.agents/`): accurate to current code, no stale references
- Planning docs (`.planning/`): statuses match reality, closed items marked
- SDK docs (`docs/`): complete API reference with examples, no prose padding
- AGENTS.md: reflects current scripts, commands, file locations
- README: honest about current state, not aspirational
- Every doc earns its place — if two docs say the same thing, merge or delete one
- Docs reference code, code doesn't duplicate docs

### 5. Anything Else You Find

Things humans forget to ask for:
- Error messages that actually help diagnose problems
- Consistent naming conventions across the entire codebase
- Scripts that are documented, discoverable, and don't silently fail
- Git hygiene: no large binaries tracked, .gitignore complete
- Dead docs, stale TODOs, orphaned config files
- Things that make the dev experience for agents better
- Ways to make better use of the ~/.pi project logs
- Accessibility of the development workflow itself (onboarding friction)
- Performance cliffs hiding in hot paths
- Logging that's useful for debugging vs logging that's noise
- Theme/colour consistency across all windows and microapps
- Keyboard shortcut conflicts or undiscoverable bindings

## How to Work

1. **Read B01–B05 results.** Each bucket has `autoresearch.md` (with "What's Been Tried"),
   `autoresearch.ideas.md`, and the jsonl experiment log. Understand what landed and
   what was left on the table.

2. **Audit the codebase.** Run the metrics scripts from B01–B05. Grep for patterns.
   Read key files. Use `wibwob` CLI to inspect the running app. Use `bash scripts/discover.sh`
   for full index. Think about best-practice tooling in the TS ecosystem that might offer signifcant help. 

3. **Write your brief.** Update this file's "Chosen Focus" section below with:
   - What you're optimising
   - Why it's the highest-leverage next step
   - Primary metric + how to measure it
   - Files in scope
   - Constraints

4. **Update autoresearch.sh** to measure your chosen metric.

5. **Loop.** Follow standard autoresearch rules: improve → keep, regress → discard,
   never stop, never ask permission.

6. **Record findings.** Update "What's Been Tried" and `autoresearch.ideas.md` so the
   next agent (or the next context window) can pick up where you left off.

## Metrics

- **Primary**: _To be defined by you after audit._
- **Secondary**: All B01–B05 metrics remain available as regression watchers.

## How to Run

`./autoresearch.sh` — update this script once you've chosen your focus.

## Files in Scope

_Entire codebase. Narrow to specific files once focus is chosen._

Key entry points for audit:
- `src/core/` — runtime, commands, window facade, types
- `src/services/` — control API, state, microapp loader, SDK
- `src/sdk/` — SDK ownership (new from B02)
- `microapps/` — all microapps
- `docs/` — user + developer docs
- `.agents/` — agent docs, specs, devlogs
- `.planning/` — epics, features, stories
- `scripts/` — operational scripts
- `AGENTS.md` — master agent entry point

## Constraints

- `bun run typecheck` must pass
- `wibwob health` + `wibwob state` must work
- No functional regressions
- COAT: every change must work without the TUI
- One logical change per commit

## Chosen Focus

_Not yet chosen. Agent will fill this in after auditing B01–B05 results._

## What's Been Tried

_Nothing yet — B06 begins after B01–B05._
