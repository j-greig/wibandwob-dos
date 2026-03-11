# E033 Module Anti-Pattern Audit

## TL;DR

This is a rolling audit tracker for `/modules`.

Scope for this pass:
- inspect module-local anti-patterns
- do not change core runtime code
- prefer notes that can later become small, safe follow-up fixes

Legend:
- `[ ]` not yet audited
- `[x]` audited

## Module checklist

- [ ] e026-demo
- [x] example-primers
- [x] glitchbox
- [ ] heartbeat
- [x] hello-world
- [ ] patchbay-lab
- [ ] sy2-chronicles
- [ ] terminal
- [ ] touchlab-mvp
- [ ] wibwob-figlet-fonts
- [ ] wibwob-poetry-clock
- [ ] wibwob-tidepool
- [ ] wibwob-tr808
- [ ] wibwobworld
- [ ] world-chatroom
- [ ] zine

## Module: e026-demo

- Audit status: placeholder only in this first pass.
- Likely audit angle: broad demo modules often accumulate too many responsibilities and become accidental SDK documentation by example rather than clear product code.
- Follow-up when audited properly: check for mixed concerns, duplicated helper logic, and direct imports that bypass the preferred SDK path.

## Module: example-primers

- Audit status: initial pass complete.
- Result: low risk in current form.
- `module.json` is content-only and does not expose runtime code, so the usual lifecycle and redraw anti-patterns do not apply here.
- Watch-out: if this module ever grows loader-side logic, keep it content-only or rename it clearly; right now the manifest is honest and minimal.

## Module: glitchbox

- Audit status: initial pass complete.
- Anti-pattern: one very large `index.ts` mixes command registration, window construction, animation, generative-art simulation, autonomous agent orchestration, button-bar wiring, keyboard handling, and state reporting in one place. It is powerful, but cognitively dense.
- Anti-pattern: module-level singleton state (`activeWindow`, `activeDancer`, `activeRenderAll`, shared field state) makes the module behaviour depend on ambient globals inside `setup(...)`. That is workable for `multiInstance: false`, but still makes local ownership and future testing harder.
- Anti-pattern: repeated direct `host.screen.render()` calls are scattered across input handlers and timers. That suggests the module still relies on ambient redraw discipline rather than one calmer local invalidation path.
- Anti-pattern: the module creates and manages its own `Agent`, auth storage, and model selection inside the view module. That is an unusually heavy dependency seam for a microapp and makes the module less portable and harder to reason about.
- Anti-pattern: timing behaviour is split across several timer concepts (`restartTick`, periodic energy-speed adjustment, haiku tick), which raises drift risk and complicates cleanup reasoning.
- Positive note: cleanup, restyle, `describeState()`, and `captureText()` are present and explicit, so the module is messy but not totally undisciplined.
- Safe future tidy-up target: extract local controller helpers inside the module first before touching any shared runtime seam.

## Module: heartbeat

- Audit status: placeholder only in this first pass.
- Likely audit angle: anything schedule- or polling-oriented should be checked for timer cleanup, duplicated polling logic, and whether state reporting is too thin for an operational surface.

## Module: hello-world

- Audit status: initial pass complete.
- Anti-pattern: `renderFiglet(...)` uses `spawnSync(...)` during setup-time banner generation. For a tiny example this is acceptable, but as canonical starter code it normalises shelling out synchronously from a module.
- Anti-pattern: the example includes an empty `win.onCleanup(() => {})`. It is harmless, but teaching no-op cleanup as normal ceremony is slightly noisy in the starter path.
- Anti-pattern: command metadata and window title/banner text are all handwritten locally. Again fine for a tiny example, but the starter example should stay alert to copy-paste drift because new module authors will imitate it exactly.
- Positive note: the module is otherwise clean, honest, and minimal. It uses the canonical SDK import path, state description, capture text, and restyle hook correctly.
- Safe future tidy-up target: either precompute the banner more explicitly or note in docs that synchronous shelling-out is only acceptable for toy examples.

## Module: patchbay-lab

- Audit status: placeholder only in this first pass.
- Likely audit angle: patch/composition prototypes often duplicate graph vocabulary, routing helpers, and panel state that should eventually converge with TouchLab-style composition naming.

## Module: sy2-chronicles

- Audit status: placeholder only in this first pass.
- Likely audit angle: narrative/editorial modules should be checked for overgrown inline content, hidden file IO assumptions, and weak `describeState()` summaries.

## Module: terminal

- Audit status: placeholder only in this first pass.
- Deferred deliberately: terminal is currently in a collision-prone seam, so only documentation-level notes should be made until the active lane settles.
- Likely audit angle later: recursion safety, PTY lifecycle cleanup, input focus ownership, and command/API parity.

## Module: touchlab-mvp

- Audit status: placeholder only in this first pass.
- Likely audit angle: now that shared composition scaffolding exists, check whether any old TouchLab-local helper logic still duplicates shared composition concerns.

## Module: wibwob-figlet-fonts

- Audit status: placeholder only in this first pass.
- Likely audit angle: inspect whether it is cleanly content-focused or whether font discovery/rendering concerns leak into runtime code paths unexpectedly.

## Module: wibwob-poetry-clock

- Audit status: placeholder only in this first pass.
- Likely audit angle: timer ownership, content regeneration cadence, and whether capture/state output reflects the actually visible poem state.

## Module: wibwob-tidepool

- Audit status: placeholder only in this first pass.
- Likely audit angle: animated surface discipline, resize behaviour, and whether any simulation loop is tied too directly to `screen.render()`.

## Module: wibwob-tr808

- Audit status: placeholder only in this first pass.
- Likely audit angle: audio/process cleanup, command-to-state parity, and whether pad/step state is modelled clearly or hidden inside widget mutation.

## Module: wibwobworld

- Audit status: placeholder only in this first pass.
- Likely audit angle: likely broad-scope module, so first check should be for mixed responsibilities and hidden service coupling.

## Module: world-chatroom

- Audit status: placeholder only in this first pass.
- Likely audit angle: room/session lifecycle, message-state ownership, and whether transport concerns leak too far into the view module.

## Module: zine

- Audit status: placeholder only in this first pass.
- Likely audit angle: large editorial surfaces often hide central tick loops, mount registries, and layout/state coupling that deserve explicit naming.
