# Spike: Scramble Window Expand States

**Status: COMPLETE** — landed 2026-02-17 in commits `6d428d9` + `a326e9c`

Key discoveries: TV `select()` on TWindow only changes Z-order (not focus) due to `ofTopSelect`. Fixed by calling `makeFirst()` + `owner->setCurrent()` directly. See `memories/2026/02/20260217-183200-headless-tui-testing.md` for full trace.

> tl;dr — Scramble window gets 3 display states: hidden, smol (current 28x14), tall (full desktop height). Tall mode adds message history + input field so you can actually chat with the cat. Transition via keybind or command.

## The Problem

Current Scramble is 28x14 with no input field. You can see her but can't talk to her. Issue #56 (F04 trigger system) needs a text input, but 14 rows isn't enough for cat + bubble + history + input. The window needs to grow.

## Three States

| State | Dims | Content | Transitions |
|-------|------|---------|-------------|
| **Hidden** | — | Off-screen, destroyed | smol→hidden (toggle), tall→hidden (toggle) |
| **Smol** | 28 x 14 | Cat + speech bubble only (current) | hidden→smol (toggle), tall→smol (shrink) |
| **Tall** | 28 x full-height | Cat at bottom + message history + input field | smol→tall (expand) |

Position: always right-edge anchored. In tall mode, stretches from top to bottom of desktop at same x position.

## UI Components Needed

### Existing (keep as-is)
- `TScrambleView` — cat art + speech bubble renderer (anchors to bottom of its bounds)
- `TScrambleWindow` — wrapper window

### New Components

#### 1. `TScrambleMessageView` (new class)
Simplified scrollable message history. NOT a full `TScroller` like WibWob — keep it minimal.

```
- Vector of {sender, text} messages
- Simple draw: render last N messages that fit
- Auto-scroll to bottom on new message
- No scroll bars in smol mode (not visible anyway)
- Optional vscrollbar in tall mode
```

Much simpler than `TWibWobMessageView` — no streaming, no timestamps, just a log of exchanges.

#### 2. `TScrambleInputView` (new class)
Single-line input field at the very bottom of the window (above cat? or above message area?).

```
- Single line text input with prompt char
- Enter submits to ScrambleEngine (KB first, Haiku fallback)
- Response goes to say() AND message history
- Only visible in tall mode (smol mode has no input)
```

Pattern: follow `TWibWobInputView` but stripped down. No spinner, no status line. Just `> ` prompt + text + cursor blink.

#### 3. `ScrambleDisplayState` enum (new)
```cpp
enum ScrambleDisplayState {
    sdsHidden = 0,
    sdsSmol   = 1,
    sdsTall   = 2
};
```

Tracked in `TTestPatternApp` alongside `scrambleWindow` pointer.

### Modified Components

#### `TScrambleWindow` changes
- Gains `displayState` member
- In **smol**: contains only `TScrambleView` (current behavior)
- In **tall**: layout becomes vertical stack:
  ```
  ┌─────────────────────────┐
  │ Message history          │  <- TScrambleMessageView
  │ (scrollable)             │
  │                          │
  │                          │
  ├─────────────────────────┤
  │ > input here_            │  <- TScrambleInputView (2-3 rows)
  ├─────────────────────────┤
  │ ┌───────────────────┐   │
  │ │ mrrp. (=^..^=)    │   │  <- TScrambleView (cat + bubble, fixed height)
  │ └───────────────────┘   │
  │    /\_/\                 │
  │   ( o.o )               │
  │    > ^ <                 │
  └─────────────────────────┘
  ```
- `changeBounds` relayouts children based on state
- Cat stays at bottom (her territory), conversation grows upward

#### `TTestPatternApp` changes

**Option A**: Cycle — toggle cycles hidden->smol->tall->hidden
**Option B**: Two commands — toggle (hidden<->last-visible-state), expand/shrink (smol<->tall)
**Option B is better** — matches user mental model. F8 = show/hide. Another key = grow/shrink.

## State Tracking

```cpp
// In TTestPatternApp
ScrambleDisplayState scrambleState = sdsHidden;
TScrambleWindow* scrambleWindow = nullptr;

void toggleScramble();       // hidden <-> smol (or hidden <-> last-used state)
void expandScramble();       // smol -> tall
void shrinkScramble();       // tall -> smol
// OR:
void toggleScrambleExpand(); // smol <-> tall (single toggle)
```

On state change:
1. Calculate new bounds (same x, different height)
2. Either resize in-place (preferred) or destroy+recreate
3. Insert/remove message and input views as needed
4. If expanding: window needs `ofSelectable` so input field can take focus
5. If shrinking: remove `ofSelectable`, put behind other windows again

### Focus Considerations

- **Smol**: `ofSelectable` OFF — cat sits behind other windows, doesn't steal focus
- **Tall**: `ofSelectable` ON — user needs to type in input field, so window must be focusable
- Shrinking back to smol: return to non-selectable, put behind other windows

## Command/API Surface

Register in command registry:
```
scramble.expand  — toggle scramble between smol and tall
```

Extends F05 (`scramble.*` commands). Keybind TBD — maybe Shift+F8 since F8 is toggle.

## Implementation Order

1. **Add `ScrambleDisplayState` enum + state tracking** in app
2. **Create `TScrambleInputView`** — minimal input field, submits to engine
3. **Create `TScrambleMessageView`** — minimal message log
4. **Modify `TScrambleWindow`** — layout switching between smol/tall
5. **Add `toggleScrambleExpand()` to app** — resize + relayout
6. **Register `scramble.expand` command** in registry
7. **Wire input->engine->say()->history** — the actual chat flow

Steps 2+3 can be parallel. Step 4 depends on both. Steps 5-7 are sequential.

## What NOT To Build

- No scroll bars in smol mode
- No streaming responses (Scramble is terse, responses arrive complete)
- No export/logging (unlike WibWob chat — Scramble doesn't keep diaries)
- No TTS integration
- No fancy transitions/animations between states
- Keep the same 28-char width in both states (tall = taller, not wider)

## Open Questions

1. **Width**: Keep 28 in tall mode, or go wider? 28 might be tight for message history. Could go 32-36.
2. **Cat position in tall**: Bottom (proposed) or top? Bottom feels right — she's grounded. Messages scroll above her like thought bubbles.
3. **Message persistence**: Clear on shrink->smol? Or keep history so expanding again shows it? Keep it — messages live in engine/view, just hidden when smol.
4. **Key binding**: F8 = toggle visibility. Shift+F8 = expand? Or a new function key?

## Relation to Other Features

- **Unblocks F04** (trigger system): input field enables direct-ask trigger
- **Supports F05** (`scramble.ask`): API can route to same input->engine->response flow
- **Independent of F02/F03**: engine already handles queries, this is purely view-layer
