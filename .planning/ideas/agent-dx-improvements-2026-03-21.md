# Agent DX Improvements — Ranked

> Written: 2026-03-21
> Source: codebase exploration + direct friction experience
> Scope: improvements that reduce agent friction, eliminate silent failures, and sharpen the dev loop

---

## Tier 1: Eliminate whole failure classes

**1. `GET /errors/recent` API endpoint**
Every interesting failure — TDZ crash, blank window, cleanup throw — is visible only in the tmux pane. An agent has no way to self-diagnose without visual inspection. A ring buffer of last N errors (with microapp id, stack trace, timestamp) would turn the most frustrating class of problem into readable state.

**2. Command DSL → codegen**
The 4-file sync tax is a trap. Every new shell command requires touching `command-catalog.ts`, `command-definition.ts`, `app-controller.ts`, `control-api.ts` in sync. Define commands in a typed JSON schema; generate the four files. Eliminates the entire class of "command exists in menu but not API" bugs. The generator pattern already exists in this repo — this is the same idea applied to source code.

**3. `GET /health` with `docsStale: string[]`**
Right now COAT.md may not reflect the current codebase when a session opens. Adding stale-detection to `/health` (diff gen-script outputs against current files, same logic as `doc-sync.sh`) means agents know to regenerate before starting work instead of after hitting divergence.

**4. `stableId` option for `createWindow`**
Window IDs are random on every open. Any choreography script that captures IDs and then reruns is broken the second time. A `stableId: "microapp-id:qualifier"` option that produces a deterministic ID from content fingerprint would make choreography scripts idempotent by default.

**5. SSE stream for `/state` diffs**
Polling `/state` in loops with sleeps to detect when windows appear is fragile. `GET /state/stream` emitting JSON diffs (window added, closed, state changed) would let agents react rather than poll. Eliminates the `sleep 0.5` dance after `desktop.clear-all`.

---

## Tier 2: Sharp reduction in friction

**6. Microapp debug endpoint**
`GET /microapps/:id/debug` returns: last open time, current `captureText()` output, current `describeState()` output, last error. Currently requires open → screenshot → parse text → cross-reference with `/state`. This is the information always needed when iterating on a microapp.

**7. Symbolic window references**
`POST /commands/run` with `windowId: "@last"` or `windowId: "@title:Click Counter"` or `windowId: "@appType:wibwob.figlet"` instead of raw IDs. Choreography scripts currently have a capture-and-use ID pattern that breaks constantly. Symbolic refs would make most choreography scripts 40% shorter and ID-capture-race-proof.

**8. Per-session auto-briefing file**
At session start, generate `.pi/context/session-brief.md`: active epic, relevant GOTCHAS.md entries filtered to that epic's domain, current open windows from `/state`, last 3 devlog entries. One file to read vs synthesizing from 5 sources. The `session-context.sh` hook already runs at start — this is the same hook writing a single digest.

**9. `POST /windows/scaffold` bulk layout**
Most choreography scripts are: clear → wait → open N windows → move each → resize each. A single call with a layout spec (app IDs, positions, sizes) would replace 20-line scripts. The API already batches commands; this is a higher-level version of that.

**10. Blessed widget tree inspector**
A microapp that renders the live blessed widget tree (parent/child relationships, types, positions, style keys). When a window is blank, there is no way to know if the widget was mounted, where it is in the tree, or what style keys it has. React DevTools for blessed. Not a common need but incredibly high value when the need arises.

---

## Tier 3: Quality of life

**11. Microapp-to-microapp messaging**
`host.send(appId, payload)` / `host.on("message", cb)`. Right now microapps are hermetically isolated — a file picker can't send a path to an editor. This is the missing composition primitive. Opens a whole class of workflows that aren't currently possible.

**12. Command provenance in `/state`**
Each window and recent command in `/state` gains `actor: "human" | "agent" | "api" | "cli"` and `timestamp`. Valuable for debugging ("was that me or the human?") and for future multi-agent scenarios. Already planned in `.planning/refactor-docs/022-peer-provenance-follow-on.md` — not yet implemented.

**13. Zod validation for `registerCommand` args**
Command args are currently `any`. A `schema: z.object({...})` field in `registerCommand` that validates at the API boundary would turn malformed calls into typed errors at entry rather than silent failures deep in action handlers.

**14. `POST /commands/run?dry=true`**
Returns what would happen — which windows would open, what state would change — without executing. Useful before running choreography scripts that are hard to undo. Low effort since action handlers are thin dispatchers.

**15. Ghost state detection**
`GET /state/inconsistencies` — windows in blessed widget tree but absent from `/state`, or vice versa. These ghosts happen after crash recovery and workspace restore. Currently invisible. Surfacing them turns a confusing debugging session into a one-liner.

**16. Skill relevance injection**
When a skill is invoked, look up GOTCHAS.md entries tagged to its domain (e.g. `microapp-creator` triggers TDZ crash + list style + clear-all race gotchas as preflight context). The knowledge exists; it just doesn't reach agents at the moment it's needed.

**17. Devlog query interface**
`scripts/devlog.sh` is write-only. `GET /devlog?last=5&domain=blessed` would make it readable without file-system access. The devlog is a first-class source of truth about what burned past agents — it should be queryable by current agents mid-task.

**18. Microapp contract linter as precommit hook**
Verify every microapp: exports `setup(host)`, registers all 4 required hooks, has valid `microapp.json`, ID doesn't collide. TypeScript catches some of this but the 4-hooks requirement is only enforced by `registerMicroappHooks` if you opt in. A linter catches the cases where you don't.

---

## Tier 4: Surprising / longer-horizon

**19. Session replay from `.pi/session-logs/`**
57MB of session logs exist but are never consumed. A tool that replays a session as a sequence of API calls — letting you watch what past agents built — would be a powerful learning and debugging tool. The data is already there.

**20. Hash-stable IDs as the default**
Make random IDs opt-in. Default: IDs are a hash of `appId + openArgs + instanceN`. Same app, same args, same instance slot → same ID. Would make the entire test/validation layer more reliable and eliminate most choreography script fragility.

**21. `/state` depth levels**
`GET /state?depth=summary` vs `?depth=full` vs `?depth=agent`. Right now `/state` is one size. An agent doing a quick orientation check doesn't need the same payload as an agent doing detailed window management. Cheaper calls = less noise in agent reasoning.

**22. Blessed test harness (headless widget rendering)**
Run blessed widgets in a virtual PTY without a real terminal. Would catch TDZ crashes, style crashes, and `captureText()` returning empty — before the restart/validate cycle. Currently there's no way to unit-test blessed widget behavior; this is the unlock for that.
