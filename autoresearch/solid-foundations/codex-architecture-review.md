# Codex Architecture Review

## Verdict

The target architecture is directionally correct but incomplete. It correctly identifies the main structural problem: a small set of god objects absorbing unrelated responsibilities. It is also mostly careful about the E039 zone. But as written, it is still too biased toward file decomposition as the metric of success. The agentic devlog shows that the highest-friction failures are not only "files are too big"; they are control-surface mismatches, hidden interstitial UI states, weak runtime observability, undocumented command semantics, and module/runtime workflow ambiguity.

So the answer to "does it solve the right problems?" is: partially. It solves maintainability problems well. It does not yet fully solve agent-operability problems, which is the reason this codebase hurts in practice.

## What The Target Gets Right

- It correctly protects the command pipeline as an E039 zone: `command-catalog.ts` -> `command-registry.ts` -> `control-api.ts` -> CLI.
- It correctly keeps the CLI projected through the API instead of importing catalog internals directly. The devlog is explicit that the HTTP-projected CLI was the winning architecture because it picks up runtime/module commands automatically.
- It correctly treats `app-controller.ts`, `ui-parts.ts`, `browser-windows.ts`, and `wibwob-agent-session.ts` as the highest-leverage decompositions.
- It correctly preserves `ui-parts.ts` as a compatibility barrel during extraction. That is the right incremental move.
- It correctly avoids a broad `shared/` or `util/` dumping ground.
- It correctly fixes the `canvas-types.ts` -> `modules/` inversion. That is a real architectural bug, not just an aesthetic issue.

## Where The Target Misses

### 1. It over-indexes on file size and under-indexes on runtime friction

The devlog's recurring failures are:

- interactive prompts hijacking API/CLI flows
- query/control commands losing return values unless `direct: true`
- commands exposed in menus with required args but no no-arg fallback
- missing inspectability for nested/panel content
- reload-safe vs restart-required ambiguity
- silent module-loader failures and runtime logging corrupting the TUI

Those are architecture problems too. They affect how agents can operate the system. The target document barely treats them as first-class design constraints.

### 2. `window-openers.ts` is sensible; `WindowOpenerRegistry` is probably too much too soon

Extracting opener functions out of `app-controller.ts` is good. Turning them into a registry abstraction is not yet justified by the evidence in the reports or devlog. This repo already has friction from "features got added to the nearest file." It does not need a second speculative abstraction layer unless there is a concrete need for third-party registration or dynamic opener discovery.

Recommendation: extract a plain `window-openers.ts` module first. Do not commit to a registry pattern in the target architecture until a real use case appears.

### 3. The target under-specifies the file manager problem

Moving `browser-windows.ts` to `file-manager-window.ts` reduces a historical accident, but it does not fully solve the architectural issue. The report explicitly calls out git status, ripgrep, clipboard integration, Finder/Quick Look/xdg-open, and viewport helpers all mixed into one window. A 1,400-line "single-purpose" file is still a god object with a narrower label.

Recommendation: the target should include a second-stage split for file manager concerns:

- pure window rendering/input wiring in `file-manager-window.ts`
- filesystem/git/search/OS integration in services
- generic viewport helpers in core

Without that, the biggest operationally messy window remains messy, just renamed.

### 4. The target treats overlays as UI decomposition only, not as API-state architecture

The devlog shows that interstitial picker states are the main agent failure mode, and that the winning pattern was explicit overlay control primitives:

- `overlay.info`
- `overlay.select`
- `overlay.confirm`
- `overlay.cancel`

The target splits `overlay-manager.ts` by prompt type, which is good for code structure, but it does not state the architectural rule that every shared overlay must expose deterministic control/introspection surfaces. That omission matters more than the file split.

Recommendation: add an overlay contract to the target architecture:

- shared overlays must support inspect/select/confirm/cancel semantics
- non-shared pickers must expose equivalent local command hooks until migrated
- API-triggered commands must not drop users into undismissable interactive state without an API control path

### 5. The target misses module-operability and SDK-boundary work

The devlog records repeated friction around module development:

- undocumented real command IDs
- nonexistent `modules.reload`
- loader failures being invisible
- direct imports past `microapp-sdk.ts`
- `describeState()` binding/reload ambiguity

The target architecture says `modules/ -> microapp-sdk.ts only`, but it does not convert that into migration work. The parked SDK boundary audit is directly relevant to "solid foundations" and should be represented as an explicit follow-on or a scoped wave in the plan.

Recommendation: add a foundation task for microapp SDK hardening:

- close direct-import gaps in `microapp-sdk.ts`
- make module loader failures visible in logs/state
- document or implement real module reload behavior

### 6. The target does not treat inspectability as a core architectural concern

The devlog has a strong pattern: agents succeed when there is a semantic proof path, not just a visual one. Examples:

- `/state`
- panel `.inspect` commands
- direct query commands returning structured data
- `describeState()` as the semantic contract

The current/target documents mention `describeState()` only indirectly. They should be stronger here.

Recommendation: add an explicit architecture rule:

- every meaningful interactive surface must expose a semantic inspection path
- child/panel-heavy windows should standardize optional `contentPreview` or equivalent inspection metadata
- direct query/control commands must bypass `focusOrCreate`-style wrappers that discard return values

This is foundational for agents, not just testing sugar.

### 7. The target contains at least one factual drift that should be cleaned up before it becomes the migration source of truth

The documents disagree on the current CLI naming/runtime story:

- current architecture and folder reports describe `src/cli/wibwob.ts`
- the devlog describes `src/cli/ww.ts` and calls it the implemented thin HTTP client
- E039 wants `ww`

Likewise, there is drift around `control-api.ts` being hand-rolled vs Hono-adjacent.

Recommendation: resolve factual drift first. A migration plan built on stale filenames or stale transport assumptions will create churn for no gain.

## E039 Alignment

Mostly good, with caveats.

### Aligned

- Freezing `command-catalog.ts`, `command-registry.ts`, and `control-api.ts` from major restructuring before E039 is correct.
- Preserving the API-projected CLI model is correct.
- Treating Unix sockets as additive to HTTP is correct and matches both the brief and devlog.

### Needs tightening

- Do not let architecture work rename the CLI as a prerequisite. The name (`wibwob` vs `ww`) is an E039 concern, not a foundations concern. IT IS `wibwob` BTW THIS IS THE ONLY OPTION.
- Do not "clean up routing" in `control-api.ts` in a way that changes response shapes, command discovery semantics, or module-command visibility before E039 lands.
- Do not introduce catalog-to-CLI or transport abstraction layers pre-emptively. The devlog is clear that the thin client won because extra layers were unnecessary.

## Incremental Achievability

Achievable, but the proposed migration order is not quite right.

The target's Wave 1 starts with the largest mechanical extractions (`ui-parts.ts`, `overlay-manager.ts`). Those are conceptually low-risk, but in practice they create broad import churn across many windows right at the start of the refactor. That is not the safest opening move.

### Better order

1. Fix the hard correctness issue first: `canvas-types.ts` importing from `modules/`.
2. Do the smallest, high-signal deduplications first: test API helpers, shared `html-to-markdown.ts`, shared ANSI constants.
3. Add missing architecture rules and docs for command/query semantics:
   - `direct: true` for query/control commands
   - no-arg fallback or picker requirement for menu-visible commands
   - reload-safe vs restart-required guidance
4. Extract the lowest-risk god-object seams:
   - `app-controller.ts` -> action bridge, FX service, clipboard service
   - `wibwob-agent-session.ts` -> tool files
5. Split `browser-windows.ts` and `generative-windows.ts`.
6. Split `ui-parts.ts` once the functional seams are proven by actual consumers.
7. Split `overlay-manager.ts` together with explicit overlay control contracts, not as a purely internal reshuffle.

Why: this order pays down correctness and operability first, then decomposes the high-churn UI files after the target contracts are clearer.

## Specific Recommendations

### A. Add an "Agent Operability" section to the target architecture

This should be a real section, not scattered notes. It should define:

- every interactive interstitial must have an API/command control path
- query/control commands must return structured data and avoid focus wrappers that swallow results
- every menu/palette-visible command must have a no-arg fallback, picker, or be removed from menu surfaces
- every important surface must expose semantic state, not just screen rendering

This would align the architecture with the actual devlog failures.

### B. Downgrade speculative abstractions

Change:

- `WindowOpenerRegistry`

To:

- plain extracted `window-openers.ts`

Maybe later:

- registry, if E039 or module/runtime extension patterns create a concrete need

The repo has already been hurt by growth through convenience. The fix should be simpler shapes, not just new shapes.

### C. Make file-manager decomposition explicit

Add a second-stage target for `file-manager-window.ts`:

- service extraction for git/search/OS shell-outs
- reusable viewport/content helpers in core
- platform-specific integrations isolated from TUI rendering

Otherwise the biggest remaining file will still be a future trap.

### D. Pull the microapp SDK audit into scope

The target architecture already states the desired module boundary. It should also state the migration steps needed to achieve it. Right now it declares the rule without planning the work.

### E. Add observability/runtime workflow items to the migration plan

At minimum:

- loader/logging must never scribble into the TUI
- startup/module-load failures should be visible in a log or state surface
- add documented reload-safe vs restart-required guidance

These are disproportionately valuable for autonomous work.

### F. Resolve source-of-truth drift before implementation

Before this document is used to guide refactors, normalize:

- current CLI filename and intended rename path
- actual `control-api.ts` implementation state
- whether Hono is present, planned, or merely commented

An architecture plan must be factually boring.

## Bottom Line

The target architecture is good at structural cleanup and mostly compatible with E039. Its main weakness is that it assumes "split the large files" is equivalent to "solve the agent friction." It is not. The real win is to combine decomposition with explicit operability contracts: inspectable state, controllable interstitials, predictable command semantics, visible module/runtime failures, and minimal churn inside the E039 command pipeline.

If those additions are made, the target architecture becomes a strong foundation document. Without them, it risks producing a cleaner file tree while leaving the hardest day-to-day agent failures intact.

REVIEW_COMPLETE
