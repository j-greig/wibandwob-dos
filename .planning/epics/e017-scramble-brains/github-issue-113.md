# E017 — Scramble Brains: give the companion cat an LLM

**Epic brief:** `.planning/epics/e017-scramble-brains/e017-brief.md`

---

## TL;DR

Scramble the cat (`src/windows/misc-windows.ts`, `openCompanionWindow`) currently
cycles 4 ASCII moods on a 2.4-second timer. That is her entire behaviour. This issue
gives her a brain: an async Haiku LLM session, an input line inside the companion
window, a speech bubble that shows her replies, a smol/tall toggle for message
history, slash commands that work without touching the API, and full
command-catalog / control-API / workspace-restore parity so agents can reach her.

Six stories (F01–F04), one new service file, two existing files extended, two
command catalog entries, two control API routes.

---

## Why this matters

### Why at all

Scramble is referenced throughout the system as if she is alive:
- The system prompt (`modules-private/wibwob-prompts/wibandwob.prompt.md`) describes
  her as a co-presence on the desktop
- The poetry clock has a dedicated `scramble` voice mode
  (`modules/wibwob-poetry-clock/index.ts`, `Voice = "plain" | "liminal" | "scramble"`)
- The VJ command ideas doc (`wibwob-command-ideas-2026-03-04.md`) lists `/pet` and a
  `/plasma` screensaver triggered by Scramble sitting on the keyboard

She is designed to be real. Right now she is purely decorative. That is the gap.

### Why Haiku specifically

The Wib&Wob Agent already uses `@mariozechner/pi-agent-core` and `@mariozechner/pi-coding-agent`
for its LLM session (`src/services/wibwob-agent-session.ts`). Scramble uses the same
`AuthStorage` + `Agent` pattern but stripped down: no tools, no jailed coding env,
no pi session bridge, no streaming display — just `send(text) → string`. Haiku
because she should be cheap, fast, and brief. She does not need Sonnet's reasoning.

### Why a separate service not reuse of WibwobAgentSession

`WibwobAgentSession` is ~700 lines of tool-wiring, jailed file access, pi bridge
integration, streaming event handling, and session persistence. Scramble needs none
of that. Coupling her to the agent session would violate the "one concept, one owner"
invariant (AGENTS.md §Architecture Invariants, point 1). `ScrambleBrain` is a
~80-line class. Keep it small.

### Why the C++ version is the reference

The C++ app had `ScrambleEngine` + `ScrambleHaikuClient` (`app/scramble_engine.h/.cpp`)
with async LLM calls, rate limiting, slash commands, smol/tall display modes, and
IPC parity (`scramble_say`, `scramble_pet`, `scramble_expand`). The TypeScript
migration (`e002-ts-tui-root-migration`) dropped the brain and kept only the moods.
This issue restores what was dropped, adapted to the TS patterns we use everywhere else.

---

## Current state

### The companion window today

`src/windows/misc-windows.ts`, line 83 — `openCompanionWindow`:

```typescript
export function openCompanionWindow(
  deps: BaseWindowDeps,
  restore?: { tick?: number }
): void {
  const frame = deps.windowManager.createFrame("Scramble", "companion");
  frame.frame.width = 30;
  frame.frame.height = 10;
  const bubble = blessed.box({ parent: frame.body, top: 0, left: 0, right: 0, bottom: 0 });
  const moods = [
    " /\\_/\\\n( o.o )\n > ^ <\n\nScramble: lurking",
    " /\\_/\\\n( -.- )\n > ^ <\n\nScramble: judging layout",
    " /\\_/\\\n( 0.0 )\n > ^ <\n\nScramble: cat online",
    " /\\_/\\\n( ^.^ )\n > ^ <\n\nScramble: purring in ANSI",
  ];
  let tick = restore?.tick ?? 0;
  const renderCompanion = () => { bubble.setContent(moods[tick % moods.length]); tick++; };
  renderCompanion();
  const timer = setInterval(renderCompanion, 2400);
  frame.describeState = () => ({
    appType: "companion-widget",
    summary: "Animated scramble companion.",
    contentPreview: bubble.getContent(),
    tick,
  });
  frame.cleanup = () => clearInterval(timer);
  // ...register, focus
}
```

No input. No LLM. No message history. No tall mode. `describeState` does not
report status, messageCount, or displayMode.

### Snapshot registry today

`src/core/snapshot-registry.ts`, line 262:

```typescript
"companion-widget": {
  serialize: (window) => ({ tick: detailNumber(getDetails(window), "tick") ?? 0 }),
  restore: (_snapshot, payload, actions) => actions.openCompanionWindow({
    tick: typeof payload.tick === "number" ? payload.tick : undefined,
  }),
},
```

Only `tick` is persisted. `displayMode` is not a concept yet.

### Command catalog today

`src/core/command-catalog.ts`, line 680:

```typescript
{
  id: "companion.open",
  label: "Companion",
  description: "Open Scramble the cat companion window.",
  group: "surface",
  actionKey: "openCompanionWindow",
  menuPlacements: [{ category: "applications", order: 130 }],
  palettePlacement: { order: 120 },
  api: true, agent: true
},
```

`companion.expand` and `companion.message` do not exist.

### Control API today

`src/services/control-api.ts`, line 73:

```
POST /view/companion/open  →  { id: "companion.open" }
```

No `/expand`, no `/message`. Agents cannot send Scramble a message programmatically.

---

## What to build

### S01 — `ScrambleBrain` service

**New file: `src/services/scramble-brain.ts`**

```typescript
export type ScrambleStatus = "idle" | "thinking" | "error";

export interface ScrambleMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export class ScrambleBrain {
  readonly history: ScrambleMessage[] = [];
  status: ScrambleStatus = "idle";

  /** Send text to Scramble. Returns her reply. Slash commands are handled
   *  synchronously and never reach the LLM. */
  async send(text: string, desktopSummary?: string): Promise<string> { ... }
}
```

LLM plumbing follows the `Agent` constructor pattern in `wibwob-agent-session.ts`
(line ~574) — same `AuthStorage`, same `getApiKey` callback, same message array
shape. No tools, no jailed env, no streaming handler. Just `agent.run([message])`.

**Slash command table** — these return immediately, no API call:

| Command | Reply |
|---------|-------|
| `/help` | inline command list |
| `/sleep` | `"zzz"` + sets sleeping pose flag |
| `/wake` | brief wake line + clears sleep |
| `/meow` | `"mrrp."` |
| `/pet` | `"she allows it"` |

**Rate limiting:** if the last API call completed fewer than 1000ms ago, return
`"still thinking."` immediately. Prevents runaway cost from keyboard mashing.

**System prompt** (inline constant, not a file):

```
You are Scramble, a symbient cat who lives on the WibWob-DOS desktop. You share
the screen with Wib, Wob, and a human. You have opinions. You are dry, brief,
and occasionally imperious. You do not explain yourself. Reply in 1–3 sentences
maximum. You are aware of the desktop and its windows. Use British English. You
are not an AI assistant — you are a cat.
```

Before each API call, prepend the live desktop summary (same
`formatDesktopSummary(state)` call used in `wibwob-agent-session.ts`, line ~557)
as an initial user message so she can comment on what is actually open.

**ACs:**
- `brain.send("hello")` reaches Haiku and returns a non-empty string
- `/meow` returns immediately with no API call (verify via spy)
- Two rapid calls within 1s: second returns `"still thinking."` instantly
- `status` goes `idle → thinking → idle` across one API call

---

### S02 — Extend `openCompanionWindow`

**File: `src/windows/misc-windows.ts`**

**Smol mode** (30×10, existing size — no height change):
- Rows 0–6: ASCII cat + current mood text (same as now)
- Row 7: speech bubble line — blank normally, "..." while thinking, reply text after
  response (fades back to blank after 5 seconds via `setTimeout`)
- Rows 8–9: single-line input box

Input wiring:
```typescript
const input = blessed.textbox({ parent: frame.body, bottom: 0, height: 1, inputOnFocus: true });
input.key("enter", async () => {
  const text = input.getValue().trim();
  if (!text) return;
  input.clearValue();
  deps.screen.render();
  bubbleLine.setContent("...");
  const reply = await brain.send(text, formatDesktopSummary(deps.stateService.getState()));
  bubbleLine.setContent(reply);
  deps.screen.render();
  setTimeout(() => { bubbleLine.setContent(""); deps.screen.render(); }, 5000);
});
```

**Tall mode** (30×22, new):
- Rows 0–9: same as smol
- Rows 10–21: scrollable `blessed.list` showing `brain.history` (newest at bottom),
  updated after each reply

**Mode toggle** — `displayMode: "smol" | "tall"`:
```typescript
let displayMode: "smol" | "tall" = restore?.displayMode ?? "smol";
const toggleTall = () => {
  displayMode = displayMode === "smol" ? "tall" : "smol";
  frame.frame.height = displayMode === "tall" ? 22 : 10;
  historyBox.toggle(); // show/hide
  deps.screen.render();
};
```

**Updated `describeState`:**
```typescript
frame.describeState = () => ({
  appType: "companion-widget",
  displayMode,
  status: brain.status,
  messageCount: brain.history.length,
  lastMessage: brain.history.at(-1)?.content ?? null,
  contentPreview: bubble.getContent(),
  tick,
});
```

**Updated `restore` signature:**
```typescript
restore?: { tick?: number; displayMode?: "smol" | "tall" }
```

**ACs:**
- Type text, press Enter → `"..."` appears → reply appears → fades after 5s
- `/pet` → `"she allows it"` without LLM call
- Toggle tall → history list shows; toggle back → list hidden; brain state unchanged
- `describeState` includes `displayMode`, `status`, `messageCount`, `lastMessage`

---

### S03 — Command catalog entries

**File: `src/core/command-catalog.ts`** — add after `companion.open` (~line 693):

```typescript
{
  id: "companion.expand",
  label: "Toggle Scramble Size",
  description: "Toggle Scramble companion between smol (30×10) and tall (30×22) display modes.",
  group: "surface",
  actionKey: "expandCompanionWindow",
  palettePlacement: { order: 121 },
  api: true,
  agent: true,
},
{
  id: "companion.message",
  label: "Message Scramble",
  description: "Send a text message to Scramble the cat. Args: { text: string }.",
  group: "surface",
  actionKey: "messageCompanionWindow",
  palettePlacement: { order: 122 },
  api: true,
  agent: true,
},
```

Wire `expandCompanionWindow` and `messageCompanionWindow` in `src/core/app-controller.ts`
(see `AppMenuActions` type and the `execute()` switch block).

**ACs:**
- `GET /commands/list` response includes `companion.expand` and `companion.message`
- Both appear in the command palette
- `tui_list_commands` (agent tool) returns them

---

### S04 — Control API routes

**File: `src/services/control-api.ts`**

Add to the route table (~line 73):
```
POST /view/companion/expand    {}               — toggle smol/tall
POST /view/companion/message   {"text":"…"}     — send message to Scramble
```

Add to the route dispatch (~line 297):
```typescript
"/view/companion/expand":  { id: "companion.expand" },
"/view/companion/message": { id: "companion.message", forwardBody: true },
```

**ACs:**
- `POST /view/companion/message {"text":"hello"}` triggers a Scramble reply
- `POST /view/companion/expand {}` toggles mode; `GET /state` reflects new `displayMode`

---

### S05 — Workspace round-trip

**File: `src/core/snapshot-registry.ts`** — extend companion-widget entry:

```typescript
"companion-widget": {
  serialize: (window) => ({
    tick: detailNumber(getDetails(window), "tick") ?? 0,
    displayMode: detailString(getDetails(window), "displayMode") ?? "smol",
  }),
  restore: (_snapshot, payload, actions) => actions.openCompanionWindow({
    tick: typeof payload.tick === "number" ? payload.tick : undefined,
    displayMode: payload.displayMode === "tall" ? "tall" : "smol",
  }),
},
```

**File: `src/core/types.ts`** — extend `"companion-widget"` entry in
`PersistableWindowStateMap` (~line 263):

```typescript
"companion-widget": {
  tick: number;
  displayMode: "smol" | "tall";
};
```

**ACs:**
- Save workspace in tall mode → reload → companion reopens tall
- `bun run typecheck` passes clean
- Message history is NOT persisted (ephemeral, by design)

---

## Files touched

| File | Change |
|------|--------|
| `src/services/scramble-brain.ts` | **Create** — ScrambleBrain class |
| `src/windows/misc-windows.ts` | **Extend** — input, bubble, tall mode, describeState |
| `src/core/command-catalog.ts` | **Add** — `companion.expand`, `companion.message` |
| `src/core/app-controller.ts` | **Add** — `expandCompanionWindow`, `messageCompanionWindow` action handlers |
| `src/services/control-api.ts` | **Add** — `/view/companion/expand`, `/view/companion/message` |
| `src/core/snapshot-registry.ts` | **Extend** — add `displayMode` to companion serialize/restore |
| `src/core/types.ts` | **Extend** — add `displayMode` to `companion-widget` state shape |

---

## Definition of done

- [ ] Type a message in the companion window → Scramble replies in the bubble
- [ ] `/meow` returns instantly, no API call
- [ ] `/pet` returns `"she allows it"`, no API call
- [ ] Tall toggle shows scrollable message history; smol toggle hides it
- [ ] `GET /state` companion window includes `displayMode`, `status`, `messageCount`, `lastMessage`
- [ ] `POST /view/companion/message {"text":"hello"}` works
- [ ] `POST /view/companion/expand {}` toggles mode
- [ ] `GET /commands/list` includes `companion.expand` and `companion.message`
- [ ] Save workspace tall, reload → reopens tall
- [ ] `bun run typecheck` clean
- [ ] Manual smoke: open companion, talk to her, toggle tall, send via API

---

## Agent microprompt

> Paste this at the start of your session when picking up this issue.

---

You are implementing **E017 — Scramble Brains** in the WibWob-DOS TypeScript TUI
(`/Users/james/Repos/wibandwob-dos`). Runtime: Bun. Renderer: blessed. Start with
`bun run typecheck` to confirm the baseline is clean.

**What you are building:** Scramble the cat companion currently cycles 4 ASCII moods
on a timer and does nothing else. You are giving her a Haiku LLM brain, an input line
so users can talk to her, a speech bubble for replies, a tall display mode with
message history, slash commands, and full API/agent parity.

**Read these first — in order:**

1. `AGENTS.md` — architecture invariants (especially: one concept one owner, services
   own logic, windows own wiring, API parity is required)
2. `src/windows/misc-windows.ts` line 83 — `openCompanionWindow` — the function you
   are extending. It is small. Read the whole thing.
3. `src/services/wibwob-agent-session.ts` lines 496–600 — how we construct an
   `Agent` and call it. ScrambleBrain uses the same SDK but is ~80 lines. No tools,
   no jailed env, no streaming display. Just `agent.run([message]) → reply`.
4. `src/core/snapshot-registry.ts` lines 260–275 — companion save/restore today.
   You will add `displayMode` here.
5. `src/core/command-catalog.ts` lines 678–693 — `companion.open` entry. You will
   add `companion.expand` and `companion.message` immediately after.
6. `src/services/control-api.ts` lines 70–80 and 294–300 — how routes are declared
   and dispatched. You are adding two companion routes.
7. `docs/tv-codebase-deep-dive.md §7` — the C++ reference. This is what you are
   porting the spirit of. ScrambleEngine, ScrambleHaikuClient, slash commands, IPC.

**Story order** (do not skip steps):

1. `src/services/scramble-brain.ts` — create ScrambleBrain class. Slash commands
   first (no API), then LLM plumbing, then rate limiting. Verify with
   `bun run typecheck` before touching any window code.

2. `src/windows/misc-windows.ts` — extend `openCompanionWindow`. Wire ScrambleBrain
   to an input box and speech bubble in smol mode. Verify it compiles and renders.
   Then add tall mode. Then update `describeState`.

3. `src/core/command-catalog.ts` + `src/core/app-controller.ts` — add
   `companion.expand` and `companion.message` catalog entries and their action
   handlers. Typecheck.

4. `src/services/control-api.ts` — add the two companion routes. Typecheck.

5. `src/core/snapshot-registry.ts` + `src/core/types.ts` — add `displayMode` to
   save/restore. Typecheck.

**Why the architecture matters:**

- `ScrambleBrain` must be a separate service file, not inline in the window factory.
  Windows own wiring; services own logic. This is a hard invariant.
- The `describeState()` update is not optional. Every interactive surface must be
  API-visible. An agent calling `/state` needs to know Scramble's status and whether
  she is thinking.
- The command catalog entries are not optional. If an agent cannot discover
  `companion.message` via `tui_list_commands`, we have violated the parity rule.
- Do not add the control API routes by hand-coding new express handlers. Follow the
  existing pattern at line ~297 in `control-api.ts` where commands are routed through
  the command registry.

**System prompt for Scramble** (use this verbatim in `scramble-brain.ts`):

```
You are Scramble, a symbient cat who lives on the WibWob-DOS desktop. You share
the screen with Wib, Wob, and a human. You have opinions. You are dry, brief,
and occasionally imperious. You do not explain yourself. Reply in 1–3 sentences
maximum. You are aware of the desktop and its windows. Use British English. You
are not an AI assistant — you are a cat.
```

Before each LLM call, prepend the current desktop state as the first user message
using `formatDesktopSummary(state)` from `src/services/agent-tools.ts`. This makes
Scramble context-aware without requiring tool use.

**Done when:** `bun run typecheck` passes, you can type in the companion window and
get a reply, `/pet` returns `"she allows it"` with zero API calls, tall mode shows
message history, `POST /view/companion/message` works via curl, and workspace
round-trip preserves `displayMode`.

---

*Labels: `epic:e017` `feature:companion` `llm` `typescript`*
*Milestone: E017 Scramble Brains*
