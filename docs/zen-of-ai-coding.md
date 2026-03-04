# Zen of AI Coding — Summary and Reflections for WibWob-DOS

> Summary of [Zen of AI Coding](https://nonstructured.com/zen-of-ai-coding/)
> by Nonstructured, March 2026. An homage to the Zen of Python by Tim Peters.

## The Principles

The article is dedicated to those sceptical about the significance of agentic
coding, and to those who are not, and are wondering what it means for the
future of their profession.

### Core thesis

The marginal cost of code is collapsing — and that single fact changes
everything that follows.

### The aphorisms

1. **You do not need to write another line of code if you do not want to.**
   Coding agents can accomplish most coding tasks with the right direction.

2. **Bugs are not magically gone.**
   Agents do not achieve perfection. The limiting factor is no longer the
   number of reviewers — it is the tightness of your feedback loops.

3. **Velocity without feedback is chaos.**
   Good tests are the first feedback loop. The agent will iterate until the
   tests pass. Give it access to CI for a second loop. Server logs for a
   third.

4. **Your stack is a suggestion.**
   Agents are competent across most major stacks where training data exists.
   Since you are not writing the code, your attachment to a specific stack
   becomes less relevant. Do not limit yourself to what you personally know.

5. **Concrete artifacts beat abstract specifications.**
   A flawed reference implementation provides better context than a pristine
   specification. Agents reason more effectively from concrete artifacts than
   from abstract intent.

6. **Changing your mind is cheap.**
   Architectural decisions that once felt permanent are now provisional.

7. **Run small bets.**
   When code is cheap, you can run more small bets. They rebuilt their CMS
   four times from scratch, each time learning more about what was actually
   needed.

8. **Technical debt is cheaper to service.**
   Updating libraries, migrating APIs, modernizing patterns — these are now
   trivially delegable tasks. Neglect becomes less defensible.

9. **The bottleneck is trust, not building.**
   The highest leverage work unblocks shipping: tight feedback loops, tests,
   evals, guardrails, observability, and clear acceptance criteria — anything
   that turns "we can build it" into "we can trust it".

10. **Buy vs. Build shifts toward Build.**
    When implementation is cheap, building your own becomes viable more often.

11. **The bottleneck moves upstream.**
    It is no longer about developer days. It is about time stuck in product
    decisions, unclear requirements, security review, user testing, release
    processes, and operational risk.

12. **You still have a job.**
    Comprehension of the codebase at the function level is no longer
    necessary. But relying entirely on the models is a recipe for disaster.

13. **Coding is only the beginning.**
    Agents can assist with business analysis, UX, infrastructure, operations,
    ad campaigns, analytics configuration, even accounting workflows.

14. **A new discipline is being born.**
    Software development, as the act of manually producing code, is dying.
    Your role in it is vital, but it is no longer centered on typing code.

---

## How WibWob-DOS Already Embodies This

WibWob-DOS is, in many ways, a living case study of these principles. The
repo is built almost entirely through agent sessions — Claude Code, Codex,
Pi — with a human directing architecture, validating output, and steering
taste. That makes it worth examining where the philosophy is already
embedded and where gaps remain.

### What is already strong

**Concrete artifacts over abstract specs.**
The `.planning/` directory, CLAUDE.md, and the working app itself are all
concrete artifacts. The 28KB CLAUDE.md is essentially a reference
implementation of project intent — not a spec, but a living description
that agents consume directly. Agents work from this, not from Jira tickets.

**Tight feedback loops.**
The control API (`/state`, `/windows/text/export`, `/screenshot/text`),
the screenshot scripts, and the parity-check hooks form a feedback loop
that agents use mid-session. The `fleet-test.sh` script opens all window
types across all themes and captures the result. This is exactly the kind
of loop the article describes.

**Small bets and cheap mind-changing.**
The repo has been through multiple architectural passes — C++ to TypeScript,
chat collapse, WindowFacade extraction, command registry, theme system.
Each was a full rewrite of the relevant subsystem, not an incremental patch.
The planning `.trash/` directory is full of retired documents from abandoned
approaches. Changing your mind is cheap when the cost of code is near zero.

**Technical debt servicing is delegable.**
The contract tests in CI (`contract-tests.yml`) catch parity drift
automatically. The `name-lint.sh` and `commit-lint.sh` hooks enforce
conventions without human attention. These are guard rails that make
delegation safe.

**Registry-driven architecture.**
The command catalog is a single source of truth consumed by menus, palette,
API, and agent tools. This is exactly the kind of architecture that makes
agent-driven development reliable — one definition, many projections.

---

## Where the Philosophy Suggests Improvements

The article's principles point to specific gaps in the current repo. These
are not criticisms — they are opportunities that become visible when you
take the "cost of code is collapsing" thesis seriously.

### 1. Test coverage is thin relative to the codebase

**Principle: "Good tests are the first feedback loop."**

The repo has 930 lines of test code across 6 files for 6000+ lines of core
source. The existing tests are good — they validate API contracts, workspace
round-trips, and theme cycling. But there is no coverage of:

- Window factory logic (do windows actually create and render?)
- Command catalog integrity (are all action keys implemented?)
- Service logic (content measurement, figlet service, editor service)
- State transitions (focus, drag, z-order sequences)

When agents are writing most of the code, tests are the primary mechanism
for catching regressions. The article says the agent will iterate until
tests pass — but only if the tests exist.

**Concrete actions:**
- Add a `command-action-coverage.test.ts` that verifies every `actionKey`
  in the catalog has a matching handler in `app-controller.ts`.
- Add a `window-factory-smoke.test.ts` that instantiates each window type
  and validates `describeState()` returns expected shape.
- Add a `content-measurement.test.ts` for the measurement service with
  known inputs and expected outputs.
- Consider a `bun test` step in CI alongside the Python contract tests.

### 2. No automated lint or format enforcement

**Principle: "Velocity without feedback is chaos."**

There is no ESLint, Biome, or Prettier configured. The Claude Code hooks
enforce commit format and file naming, but not code quality. When multiple
agents (Claude, Codex, Pi) are contributing code, style drift is
inevitable without automated enforcement.

**Concrete actions:**
- Add Biome (or ESLint + Prettier) with a minimal config that matches the
  existing code style.
- Add a `bun run lint` script.
- Wire it into CI so PRs get checked automatically.
- The commit hook could run lint on staged files.

### 3. No `bun test` in CI

**Principle: "Give your agent access to your CI to create a second feedback loop."**

The CI runs Python contract tests but not the Bun test suite. The 6 test
files in `src/tests/` only run locally. This means the second feedback
loop (CI) is incomplete.

**Concrete actions:**
- Add a `bun-tests.yml` workflow (or extend `contract-tests.yml`) that
  runs `bun test` on push/PR.
- Ensure tests can run headless (no blessed screen required) — the current
  tests use the control API, so they likely need the app running. Consider
  splitting into unit tests (pure logic, no app) and integration tests
  (need running app).

### 4. No test harness for agent-contributed code

**Principle: "The agent will iterate until the tests pass."**

When an agent adds a new window type or service, there is no template or
harness that automatically generates the corresponding test stubs. The
`ww-scaffold-view` skill scaffolds C++ headers and CMakeLists patches, but
there is no equivalent for TypeScript test scaffolding.

**Concrete actions:**
- Extend `ww-scaffold-view` (or create a TS equivalent) to also generate
  a minimal test file alongside the new window/service.
- The generated test should cover `describeState()` shape, basic
  instantiation, and cleanup.

### 5. Acceptance criteria validation is manual

**Principle: "Clear acceptance criteria turn 'we can build it' into 'we can trust it'."**

The `.planning/README.md` defines a rigorous AC format with `GIVEN/WHEN/THEN`
and `VERIFY:` blocks. But AC validation is manual — a human reads the AC and
decides if it passed. The `stop-ac-check.sh` hook checks for unresolved TODOs
but does not execute AC assertions.

**Concrete actions:**
- For AC items that map to API-testable behavior, generate executable test
  cases from the AC text. Even a simple script that hits the control API
  endpoints described in `VERIFY:` blocks would close the loop.
- The `ww-audit` skill already does post-implementation parity checks —
  extend it to also validate AC from the relevant story/feature doc.

### 6. Dependency freshness is not tracked

**Principle: "There is little excuse for stale dependencies or ignored security patches."**

The repo has 10 runtime dependencies and 5 dev dependencies. There is no
Dependabot, Renovate, or `bun outdated` check in CI. When the article says
maintenance is "trivially delegable", it assumes the signal exists. No
signal, no delegation.

**Concrete actions:**
- Enable Dependabot or Renovate for automated dependency PRs.
- Add a `bun outdated` check to CI (informational, not blocking).
- The `@claude` GitHub action could handle dependency update PRs
  automatically.

### 7. The OpenAPI spec is generated but not validated

**Principle: "Concrete artifacts beat abstract specifications."**

The control API exposes `GET /openapi.json`, which is good. But there is
no contract test that validates the spec matches actual endpoint behavior.
The spec is a concrete artifact that could become a stale artifact without
validation.

**Concrete actions:**
- Add a contract test that fetches `/openapi.json` and validates that
  every listed endpoint responds with the expected status code.
- Or simpler: a test that compares the endpoint list in `/openapi.json`
  against the endpoint list in `/help` and fails on drift.

### 8. Agent session observability is minimal

**Principle: "Give it access to your server logs to create a third feedback loop."**

The `wibwob-agent-session.ts` runs agent sessions with 7 jailed tools, but
there is no structured logging of tool use, token consumption, error rates,
or session duration. When the app is the agent's workspace, observability
of the agent-within-the-app matters.

**Concrete actions:**
- Add structured logging to `wibwob-agent-session.ts` (tool invocations,
  token counts, errors).
- Expose agent session metrics through `describeState()` or a dedicated
  `/agent/metrics` endpoint.
- The `app-logger.ts` service exists but its coverage of agent sessions
  is unclear.

### 9. No smoke test for the full boot sequence

**Principle: "Tight feedback loops."**

There are smoke scripts for individual features (`fleet-test.sh`,
`command-registry-smoke.sh`, `window-state-parity-loop.sh`), but no
single script that validates the full boot-to-healthy sequence:
start app, wait for health, check default workspace loaded, verify
menu structure, verify state endpoint, shut down cleanly.

**Concrete actions:**
- Create a `scripts/boot-smoke.sh` that:
  1. Starts the app in background
  2. Polls `/health` until ready
  3. Validates `/state` has expected shape
  4. Validates `/commands/list` returns commands
  5. Optionally opens one window and screenshots it
  6. Shuts down cleanly
- Wire this into CI as an integration test gate.

### 10. Module system has no validation

**Principle: "Guardrails."**

The `modules/` directory contains primer modules with `module.json`
manifests. There is no schema validation for these manifests, no test that
loads all modules and verifies they parse, and no CI check for module
integrity.

**Concrete actions:**
- Add a JSON schema for `module.json`.
- Add a test or CI step that validates all modules against the schema.
- The `module-loader.ts` service presumably does runtime validation, but
  build-time validation catches errors earlier.

---

## Broader Reflections

### The repo as its own best documentation

WibWob-DOS already treats the running app as documentation — the control
API, the state endpoint, the OpenAPI spec, and the screenshot tools all
make the app self-describing. This is the "concrete artifacts beat abstract
specs" principle taken seriously. The improvement frontier is making those
artifacts *automatically validated*, not just available.

### Multi-agent coordination as a design constraint

The repo is worked on by Claude Code, Codex, and Pi agents, plus a human.
The `.planning/README.md` glossary, the CLAUDE.md invariants, and the hook
system are all coordination mechanisms. The article's principle that "you
still have a job" maps to the human's role here: setting architectural
direction, validating taste, and maintaining the coordination artifacts
that make multi-agent work reliable.

The gap is that coordination is currently convention-enforced (docs and
hooks) rather than contract-enforced (tests and CI). Moving the most
critical invariants from prose to executable checks would make multi-agent
coordination more robust.

### The "build over buy" principle in action

The repo uses blessed (a TUI framework) but has replaced much of its
built-in behavior with custom implementations — drag, editor, shadows,
cursor. This is "build over buy" applied at the library level. The article
validates this instinct: when code is cheap, building exactly what you need
is often better than fighting a library's assumptions.

### Stack flexibility

The repo migrated from C++ to TypeScript — a stack change that would have
been expensive before agents. The 16 legacy docs in
`.planning/epics/e002-ts-tui-root-migration/legacy-docs/` document the
handover. This is the "your stack is a suggestion" principle: the right
stack is whatever makes the current goals achievable, and changing stacks
is a bounded cost, not a career decision.

---

## Summary Table: Philosophy vs. Repo Status

| Principle | Repo Status | Gap |
|-----------|-------------|-----|
| Tight feedback loops | Strong (control API, screenshots, hooks) | No `bun test` in CI |
| Tests as first loop | Partial (930 lines for 6000+ LOC) | Thin coverage, no factory/service tests |
| Concrete artifacts | Strong (CLAUDE.md, OpenAPI, state API) | OpenAPI not contract-tested |
| Cheap mind-changing | Strong (multiple rewrites landed) | — |
| Technical debt service | Partial (contract tests, hooks) | No dependency tracking |
| Guardrails | Partial (hooks, naming, parity) | No lint/format, no module validation |
| Observability | Partial (state API, app-logger) | Agent session metrics missing |
| Trust over velocity | Partial (parity checks, AC format) | AC not executable |
| Small bets | Strong (epics, spikes, modular work) | — |
| Build over buy | Strong (custom drag, shadows, editor) | — |

---

*Document created March 2026. Intended as a living reference — update as
gaps are closed and new principles emerge from practice.*
