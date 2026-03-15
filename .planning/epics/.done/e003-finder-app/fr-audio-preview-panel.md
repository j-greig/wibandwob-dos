---
type: feature
parent: E003 (e003-finder-app)
title: Audio Preview Panel — inline music player in Finder right pane
status: not-started
github-issue: ~
---

# FR — Audio Preview Panel in Finder

## TL;DR

When the Finder's left pane selects an audio file (mp3, wav, m4a, flac, ogg),
the right pane replaces the text preview with an inline music player. No
autoplay. User presses space to start. Navigation to a non-audio file restores
text preview. The player is a `UiPart` — same pattern as poetry clock — so it
composes cleanly and has zero layout logic of its own.

---

## The current layout (relevant excerpt)

`src/windows/content-windows.ts`, line ~600:

```
┌─ File Manager ──────────────────────────────────────────────┐
│ toolbar (path + buttons)                               row 0 │
│ filter/search row                                      row 1 │
│ ┌──────────────┬──────────────────────────────────────────┐  │
│ │ list (36%)   │ preview (64%)                            │  │
│ │              │   blessed.box, text content              │  │
│ │              │   currently always text                  │  │
│ └──────────────┴──────────────────────────────────────────┘  │
│ status bar                                           bottom  │
└─────────────────────────────────────────────────────────────┘
```

Left pane: `blessed.list`, `width: "36%"`, `top: 2`, `bottom: 1`.
Right pane: `preview` (`blessed.box`), `left: "36%"`, `right: 0`, `top: 2`, `bottom: 1`.

Current `updatePreview(index)` at line ~837 reads the file and sets text
content. It does not know about audio files at all.

---

## Architecture decisions

### Why a UiPart not a standalone window

The feature request is: player INSIDE the right pane. The poetry clock
demonstrates composing UiParts into a layout — `createStack`/`createColumns`
with `layout(rect)` called on resize. The audio panel is one more part in that
pattern: it owns its blessed widgets and knows how to lay them out inside a
given rect, but holds no knowledge of where it lives.

The standalone `openMusicPlayerWindow` (52×12 floating window) still exists
for direct music player use. This is a different surface for a different
context. Do not reuse the window factory — reuse the controller logic.

### Which audio controller

Use `AudioPlayerController` from `src/services/audio-player-controller.ts`
(the `sharedPlayer` singleton). It:
- Uses `ffplay` (cross-platform, not macOS-only like `afplay` in the window)
- Has a proper `opChain` queue, pause/resume via ffplay stdin, volume change
- Exposes `subscribe(listener)` for reactive render — perfect for a UiPart
- Already imported in `wibwob-agent-session.ts` and `control-api.ts`

The floating music player window (`music-player-window.ts`) uses `afplay`
directly. That is a separate concern and a candidate for eventual unification
with `AudioPlayerController`, but not in scope here.

### No autoplay

`sharedPlayer.playFile(path)` is called only when the user explicitly presses
space or enter while the audio file is selected in the list. On navigation to
an audio file: panel appears, track name shown, state shows STOPPED. The user
initiates.

### Preview mode switching

`updatePreview` gains audio-file awareness. When an audio file is selected:
1. Hide the `preview` text box
2. Show the `audioPanel` UiPart (call its `layout(rect)` with the preview rect)
3. Call `audioPanel.update({ filePath: entry.fullPath })`

When a non-audio file is selected (or directory):
1. Hide the `audioPanel`
2. Show `preview` text box
3. Run existing text preview logic

On window cleanup: `audioPanel.destroy()` — which calls `sharedPlayer.stop()`
if the player was playing this file (check filePath matches before stopping to
avoid killing a track playing in a different context).

### Key bindings scope

Audio controls active only when `audioPanel` is visible and focused:

| Key | Action |
|-----|--------|
| space / enter | toggle play/pause |
| s | stop |
| ← → | scrub ±5s |
| + / - | volume ±10 |

These shadow the existing list navigation keys only when the right pane has
focus. When list has focus, arrow keys still navigate. Tab or mouse click
switches focus between list and audio panel.

---

## New file: `src/services/audio-preview-panel.ts`

```ts
import { sharedPlayer, fmtTime } from "./audio-player-controller.js";
import type { UiPart } from "../core/ui-parts.js";

export interface AudioPreviewProps {
  filePath: string;
}

/**
 * Inline audio player UiPart for use inside the Finder right pane.
 *
 * Follows the UiPart contract from src/core/ui-parts.ts:
 *   layout(rect) — positions internal widgets to fill the given rect
 *   update(props) — loads a new file path (does NOT autoplay)
 *   restyle()    — re-applies current theme
 *   destroy()    — cleans up subscription, stops if playing this file
 *
 * Uses sharedPlayer (AudioPlayerController) for all playback ops.
 * No autoplay — caller must trigger play explicitly.
 */
export function createAudioPreviewPanel(
  screen: blessed.Widgets.Screen
): UiPart<AudioPreviewProps>
```

Internal layout (within the rect passed to `layout()`):

```
┌──────────────────────────────────────────┐
│                                          │
│  ♫  track-name.mp3                       │
│                                          │
│  ■  STOPPED    0:00 / 3:42               │  ← state line
│                                          │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░  │  ← progress bar (full width - 4)
│                                          │
│  Vol: ▮▮▮▮▮▮▮▮▯▯  80%                   │
│                                          │
│  [space] play  [s] stop  [←→] scrub     │
│  [+/-] volume                            │
│                                          │
└──────────────────────────────────────────┘
```

State icons: `▶ PLAYING` / `⏸ PAUSED` / `■ STOPPED`

Subscribe to `sharedPlayer.subscribe(render)` in the constructor.
Unsubscribe in `destroy()`.

Progress bar width = `rect.width - 4` (2 char left margin, 2 right).

---

## Changes to `src/windows/content-windows.ts`

### 1. Audio file detection

Add after the existing icon helpers (~line 510):

```ts
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aiff"]);
const isAudioFile = (label: string) =>
  AUDIO_EXTS.has(path.extname(label).toLowerCase());
```

### 2. Construct the audio panel

After the `preview` box declaration (~line 635), add:

```ts
import { createAudioPreviewPanel } from "../services/audio-preview-panel.js";

const audioPanel = createAudioPreviewPanel(params.screen);
// panel is invisible until an audio file is selected
audioPanel.node.hide();
```

### 3. Extend `updatePreview`

Replace the body of `updatePreview(index)` with a mode switch:

```ts
const updatePreview = (index: number) => {
  const entry = entries[index];
  if (!entry || entry.isDirectory) {
    audioPanel.node.hide();
    preview.show();
    // ... existing directory/empty logic
    return;
  }

  if (isAudioFile(entry.label)) {
    preview.hide();
    audioPanel.node.show();
    audioPanel.update({ filePath: entry.fullPath });
    const previewRect = {
      top: Number(preview.top),
      left: Number(preview.left),
      width: Number(frame.body.width) - Math.round(Number(frame.body.width) * 0.36),
      height: Number(preview.height),
    };
    audioPanel.layout(previewRect);
    params.screen.render();
    return;
  }

  audioPanel.node.hide();
  preview.show();
  // ... existing text preview logic unchanged
};
```

### 4. Key bindings — audio panel controls

Add below existing list key bindings:

```ts
// Audio panel controls (active when audio file selected)
list.key(["space"], () => {
  if (!audioPanel.node.hidden) {
    sharedPlayer.togglePause();
  }
});
list.key(["s"], () => {
  if (!audioPanel.node.hidden) sharedPlayer.stop();
});
list.key(["right"], () => {
  if (!audioPanel.node.hidden) { sharedPlayer.scrub(5); return; }
  // existing right-key behaviour...
});
list.key(["left"], () => {
  if (!audioPanel.node.hidden) { sharedPlayer.scrub(-5); return; }
  // existing left-key behaviour...
});
list.key(["+", "="], () => {
  if (!audioPanel.node.hidden) sharedPlayer.changeVolume(10);
});
list.key(["-"], () => {
  if (!audioPanel.node.hidden) sharedPlayer.changeVolume(-10);
});
```

### 5. Cleanup

In `frame.cleanup`:
```ts
frame.cleanup = () => {
  audioPanel.destroy(); // unsubs from sharedPlayer, stops if playing this file
  // ... existing cleanup
};
```

### 6. `onRestyle`

Add `audioPanel.restyle()` to the `frame.onRestyle` block alongside the
existing style resets.

### 7. `describeState` additions

```ts
audioPreviewActive: !audioPanel.node.hidden,
audioState: !audioPanel.node.hidden
  ? sharedPlayer.getSnapshot().state
  : undefined,
```

---

## What does NOT change

- `openMusicPlayerWindow` — standalone floating window, untouched
- `AudioPlayerController` / `sharedPlayer` — used as-is, no changes
- `src/core/ui-parts.ts` — `createAudioPreviewPanel` is its own file, not
  added to ui-parts (it depends on audio service, ui-parts must stay UI-only)
- Snapshot/restore — no new fields needed; audio state is ephemeral
- Command catalog — no new commands needed for this feature; it is a
  preview-pane behaviour, not a user-invokable command

---

## Files to create / modify

| File | Action |
|------|--------|
| `src/services/audio-preview-panel.ts` | **Create** — `createAudioPreviewPanel` UiPart |
| `src/windows/content-windows.ts` | **Modify** — detection, panel wiring, key bindings, cleanup |

---

## Acceptance criteria

- [ ] Navigate to an mp3 in the Finder — right pane shows player UI, STOPPED state
- [ ] Press space — playback starts, state shows PLAYING, progress bar animates
- [ ] Navigate away to a .ts file — player UI hides, text preview appears
- [ ] Navigate back to the mp3 — player UI shows again (state reflects sharedPlayer)
- [ ] Navigate to a directory — text preview shows `[directory]`, no player
- [ ] `+` / `-` change volume while player is visible
- [ ] `←` / `→` scrub while playing
- [ ] Close the Finder window mid-playback — playback stops (sharedPlayer.stop
  called only if this file is the active one, not if something else is playing)
- [ ] `bun run typecheck` clean
- [ ] `describeState.audioPreviewActive` true when audio file selected

---

## Modular inspiration — why UiPart not ad hoc blessed wiring

The poetry clock (`microapps/wibwob-poetry-clock/index.ts`) composes its layout
from UiParts via `host.ui.createStack`:

```ts
const body = host.ui.createColumns(win.body, [
  { key: "cat-panel", basis: "30%", part: catPanel, visible: () => scrambleVisible },
  { key: "poem",      basis: "1fr", part: poemBlock },
]);
```

Each part owns its widgets and responds to `layout(rect)` — no part knows
where it lives. The file manager's audio panel is the same pattern at a
smaller scale: one part, one rect, one `update(props)` call when the file
changes. The file manager does not need to know how many widgets are inside it
or where they sit.

This also means if we later want to compose the audio panel with other things
(waveform display, metadata, lyrics) we add more parts to a stack inside
`createAudioPreviewPanel` without touching the file manager at all.

---

## Notes on `sharedPlayer` reuse

`sharedPlayer` is a singleton. If the user has the floating music player open
AND the Finder has an audio file selected, they share the same underlying
ffplay process. This is correct behaviour — one audio output, one controller.
The floating player will reflect state changes from Finder navigation and
vice versa. No special handling needed; `sharedPlayer.subscribe` handles
reactive sync automatically.

One edge case: user clicks a track in the floating player while Finder has an
audio file selected. The Finder panel will update to show the new track
because it subscribes to `sharedPlayer`. The displayed `filePath` may differ
from the selected list item. Accept this for now — it is not confusing, just
informative. If it becomes a UX issue in a later pass, add a "link/unlink"
toggle.

---

*Wib: the right pane finally does something when you point it at music.*
*Wob: it was showing line-numbered binary noise before. this is an improvement.*
