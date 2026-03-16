---
id: E046
title: "Deep Linking: pi CLI + macOS → WibWob-DOS"
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E046 — Deep Linking: pi CLI + macOS → WibWob-DOS

## Problem

There are two broken seams in the WibWob-DOS ecosystem:

1. **pi CLI → WibWob-DOS**: When working in the pi coding agent (this terminal),
   clicking a file link or running a tool that opens a file goes to the system
   default app (Finder, Preview, etc.) instead of opening in the WibWob-DOS file
   manager, editor, or markdown viewer — even though WibWob-DOS is running in
   another Ghostty tab.

2. **macOS → WibWob-DOS**: There's no way to double-click a `.md` or `.json`
   file in Finder and have it open in WibWob-DOS. No way to click a
   `wibwob://open?path=/foo/bar.ts` link in a browser and have it routed to a
   specific WibWob-DOS app.

Both seams require the same infrastructure: a routing layer that maps file types
and URL schemes to WibWob-DOS commands, dispatched via the HTTP API (port 8099).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Entry Points                          │
├──────────────┬──────────────────┬────────────────────────┤
│  pi CLI ext  │  macOS URL scheme│  macOS file assoc.     │
│  (Ghostty)   │  wibwob://...    │  double-click .md      │
├──────────────┴──────────────────┴────────────────────────┤
│                                                          │
│                  WibWob Router                           │
│                                                          │
│  1. Parse intent (file path, URL, app hint)              │
│  2. Check WibWob-DOS is alive (GET /health)              │
│  3. Map to command:                                      │
│     .md  → markdown.open  |  .json → finder.open         │
│     .ts  → editor.open    |  .txt  → editor.open         │
│     .png → primer.open    |  dir/  → finder.navigate     │
│     wibwob://shader?name=X → ghostty.shader.set          │
│  4. POST /commands/run { id, args }                      │
│  5. Fallback: system `open` if WibWob-DOS unreachable    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│              WibWob-DOS (port 8099)                      │
│              Command Registry → Window Manager           │
└──────────────────────────────────────────────────────────┘
```

## Existing infrastructure

| Piece | Status | Location |
|-------|--------|----------|
| HTTP API with command dispatch | ✅ Done | `src/services/control-api.ts` |
| `wibwob-url-handler.sh` (stub) | 🟡 Partial | `scripts/wibwob-url-handler.sh` |
| `wibwob-open` pi extension | ✅ Done | `.pi/extensions/wibwob-open/index.ts` |
| Ghostty AppleScript API | ✅ Available | Ghostty 1.3+ SDEF |
| `POST /commands/run` | ✅ Done | Control API |
| File-opening commands | ✅ Done | `editor.open`, `finder.open`, `markdown.open`, `primer.open` |

## Key decision: two layers, same router

The **WibWob Router** is a shared TypeScript module that maps intents to
commands. It's consumed by:

1. **pi CLI extension** (`.pi/extensions/wibwob-open/`) — intercepts file-open
   tool calls and routes through the router.
2. **macOS `.app` launcher** (`WibWob.app/`) — receives URL scheme and file
   association events, shells out to `bun run router.ts`.

Same routing logic, two entry points. This avoids duplicating the file-type →
command mapping.

---

## Goals

1. **pi CLI → WibWob-DOS**: Any file the agent opens or the user clicks in pi
   opens in the right WibWob-DOS app (editor, file manager, markdown viewer).
2. **`wibwob://` URL scheme**: Clickable links that route to specific apps/views
   in WibWob-DOS — works from browsers, Slack, documentation, etc.
3. **macOS file associations**: Double-click `.md`, `.json`, `.txt` in Finder →
   opens in WibWob-DOS.
4. **Graceful fallback**: If WibWob-DOS isn't running, fall back to system defaults.
5. **Ghostty-first but terminal-agnostic**: Optimise for Ghostty (AppleScript,
   shaders, tab control), but core routing works in any terminal.

## Non-goals (v1)

- Linux/Windows support (macOS-first, `open` fallback for others).
- Editing files round-trip back to pi CLI (file watcher for reload).
- Real-time sync between pi and WibWob-DOS state.

---

## Features & Stories

### F01 — WibWob Router (shared core)

#### S01 — File-type → command routing module
**Status:** not-started

Create `src/services/wibwob-router.ts` (or `scripts/lib/wibwob-router.ts`) — a
pure function that maps an intent to a WibWob-DOS command:

```typescript
interface RouteIntent {
  path?: string;       // absolute file/dir path
  url?: string;        // wibwob://... URL
  line?: number;       // optional line number (editor.open supports it)
  app?: string;        // explicit app hint: "editor" | "finder" | "markdown" | "primer"
}

interface RouteResult {
  commandId: string;   // e.g. "editor.open"
  args: Record<string, unknown>;
}

function route(intent: RouteIntent): RouteResult | null;
```

Default file-type mapping:

| Pattern | Command | Notes |
|---------|---------|-------|
| `.md` | `markdown.open` | Rendered markdown viewer |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.sh`, `.css` | `editor.open` | Code editor |
| `.json`, `.yaml`, `.yml`, `.toml` | `editor.open` | Config files in editor |
| `.txt`, `.ascii`, `.ans` | `primer.open` | ASCII art / plain text |
| `.png`, `.jpg`, `.gif`, `.webp` | `primer.open` | Image-to-ASCII conversion |
| Directory | `finder.navigate` | File manager navigation |
| `wibwob://shader?name=X` | `ghostty.shader.set` | Shader control |
| `wibwob://open?path=X` | (re-route through path logic) | Generic open |
| `wibwob://command?id=X&args=Y` | (direct command dispatch) | Power-user URL |

- [ ] AC-01: `route({ path: "/foo/bar.ts" })` returns `{ commandId: "editor.open", args: { filePath: "/foo/bar.ts" } }`.
  Test: Unit test with 10+ file extensions.
- [ ] AC-02: `route({ path: "/foo/" })` returns `{ commandId: "finder.navigate", args: { path: "/foo/" } }`.
  Test: Unit test with directory paths.
- [ ] AC-03: `route({ url: "wibwob://open?path=/foo/bar.md" })` parses URL and routes to `markdown.open`.
  Test: Unit test with URL parsing.
- [ ] AC-04: `route({ path: "/foo/bar.ts", app: "finder" })` respects explicit app hint.
  Test: Unit test — app override beats file extension.
- [ ] AC-05: Unknown extensions return `editor.open` as default (not null).
  Test: `route({ path: "/foo/bar.xyz" })` → editor.open.

#### S02 — CLI dispatcher script
**Status:** not-started

Create `scripts/wibwob-open.sh` (or enhance existing `wibwob-url-handler.sh`)
that shells into the router:

```bash
# Usage:
wibwob open /path/to/file.ts          # routes to editor
wibwob open /path/to/dir/             # routes to file manager
wibwob open wibwob://shader?name=glow # routes to shader command
```

Checks `GET /health` first. Falls back to `open` / `$EDITOR` if WibWob-DOS
is not running.

- [ ] AC-06: `wibwob open /tmp/test.md` opens markdown viewer in WibWob-DOS.
  Test: Run command with WibWob-DOS running → window appears.
- [ ] AC-07: With WibWob-DOS stopped, falls back to system `open`.
  Test: Stop WibWob-DOS → run command → system default opens.

### F02 — pi CLI Extension

#### S03 — Enhance `wibwob-open` pi extension with router
**Status:** not-started

The existing `.pi/extensions/wibwob-open/index.ts` already registers a
`wibwob_open` tool. Enhance it to:

1. Use the WibWob Router for file-type → command mapping (not hardcoded `editor.open`).
2. Intercept `on("tool_call")` for `read` tools — offer "Open in WibWob?" after reading.
3. Intercept OSC 8 hyperlinks in pi output — rewrite `file://` links to `wibwob://` when
   WibWob-DOS is alive.

- [ ] AC-08: `wibwob_open` tool routes `.md` files to `markdown.open` (not `editor.open`).
  Test: Agent calls `wibwob_open({ path: "README.md" })` → markdown viewer opens.
- [ ] AC-09: Extension checks `/health` before routing; falls back gracefully.
  Test: Stop WibWob-DOS → tool call → returns error message, doesn't crash.
- [ ] AC-10: Extension works with the standard pi extension lifecycle (install, enable, disable).
  Test: `pi extension list` shows `wibwob-open` with correct status.

### F03 — macOS URL Scheme (`wibwob://`)

#### S04 — Lightweight `.app` bundle for URL registration
**Status:** not-started

Create `scripts/create-wibwob-app.sh` that generates a minimal
`WibWob.app` bundle at `~/Applications/WibWob.app/`:

```
WibWob.app/
  Contents/
    Info.plist          ← CFBundleURLSchemes: ["wibwob"]
    MacOS/
      wibwob-launcher   ← Shell script: parse URL → wibwob open "$URL"
```

Not a real Cocoa app — just enough for LaunchServices to register the URL
scheme. The launcher script delegates to the CLI dispatcher (S02).

- [ ] AC-11: After running `create-wibwob-app.sh`, `open wibwob://open?path=/tmp` works.
  Test: Create app → `open wibwob://open?path=/tmp/test.md` → WibWob-DOS opens file.
- [ ] AC-12: URL scheme persists across reboots (LaunchServices cached it).
  Test: Reboot → `open wibwob://open?path=/tmp/test.md` still works.
- [ ] AC-13: `wibwob://command?id=finder.open` dispatches arbitrary commands.
  Test: `open "wibwob://command?id=primer.open&args.filePath=/tmp/art.txt"` → primer opens.

#### S05 — macOS file type associations
**Status:** not-started

Extend the `.app` bundle's `Info.plist` with `CFBundleDocumentTypes` to claim
file associations for `.md`, `.txt`, `.ascii` (opt-in — user must explicitly
set WibWob as default via Finder → Get Info → Open With).

- [ ] AC-14: `WibWob.app` appears in Finder's "Open With" menu for `.md` files.
  Test: Right-click a `.md` file in Finder → WibWob listed.
- [ ] AC-15: Setting WibWob as default for `.md` → double-click opens in WibWob-DOS.
  Test: Set default → double-click `README.md` → markdown viewer opens in WibWob-DOS.

### F04 — Ghostty Integration

#### S06 — Ghostty-specific enhancements
**Status:** not-started

When running inside Ghostty (detected via `$TERM_PROGRAM`):

1. `wibwob://` links in pi output become clickable OSC 8 hyperlinks.
2. Shader control URLs work: `wibwob://shader?name=glow`.
3. Tab management: `wibwob://tab?action=new&command=bun+run+dev` (stretch goal).

- [ ] AC-16: OSC 8 links in pi output clickable in Ghostty → route to WibWob-DOS.
  Test: Pi agent outputs a file path → Cmd+click → opens in WibWob-DOS.
- [ ] AC-17: `wibwob://shader?name=glow` activates shader in Ghostty.
  Test: Open URL → shader changes in real-time.

---

## Implementation order

| Phase | Stories | Effort | Why this order |
|-------|---------|--------|----------------|
| 1. Router | S01, S02 | 1 day | Foundation — everything depends on this |
| 2. pi CLI | S03 | 0.5 day | Highest daily-use value |
| 3. URL scheme | S04 | 0.5 day | Enables browser/Slack links |
| 4. File assoc. | S05 | 0.5 day | Finder integration |
| 5. Ghostty | S06 | 1 day | Polish — OSC 8, shaders |

## Risks

- **LaunchServices caching**: macOS aggressively caches URL scheme registrations.
  Unregistering requires `lsregister -u` or app deletion + reboot.
- **Multiple WibWob-DOS instances**: Router must detect which instance to target
  (use port from `scratch/wibwob.pid` or env var).
- **pi extension API stability**: `on("tool_call")` hook API may change between
  pi versions — pin to known-good version.
- **Ghostty SDEF availability**: AppleScript API is Ghostty 1.3+ only. Detect
  version and degrade gracefully.
