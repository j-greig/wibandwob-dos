---
id: E046
title: "Deep Linking: pi CLI + macOS → WibWob-DOS"
status: in-progress
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
and URL schemes to WibWob-DOS commands, dispatched via the control API.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Entry Points                          │
├──────────────┬──────────────────┬────────────────────────┤
│  pi CLI ext  │  macOS URL scheme│  macOS file assoc.     │
│  (Ghostty)   │  wibwob://...    │  double-click .md      │
├──────────────┴──────────────────┴────────────────────────┤
│                                                          │
│              WibWob Router (standalone lib)               │
│              lib/wibwob-router.ts                        │
│                                                          │
│  1. Discover instance via scratch/instances/*.sock        │
│  2. Parse intent (file path, URL, app hint)              │
│  3. Map to command:                                      │
│     .md  → markdown.open  |  .json → editor.open         │
│     .ts  → editor.open    |  .txt  → editor.open         │
│     .png → primer.open    |  dir/  → finder.open + nav   │
│     wibwob://open?path=X  → (re-route through path map)  │
│     wibwob://command?id=X → (direct command dispatch)     │
│  4. POST to unix socket or HTTP port                     │
│  5. Fallback: system `open` if WibWob-DOS unreachable    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│              WibWob-DOS (control API)                    │
│              Command Registry → Window Manager           │
└──────────────────────────────────────────────────────────┘
```

## Key design decisions

### Router lives OUTSIDE WibWob-DOS

The router runs in **external** processes (pi extension, macOS .app launcher)
that pipe commands **into** WibWob-DOS. It must NOT live in `src/services/` —
that would make it part of the TUI process. Location: `lib/wibwob-router.ts`
(standalone, importable by both the extension and the launcher without pulling
in the entire app).

### Instance discovery via unix sockets

The control API tries ports 8099–8103. Hardcoding `127.0.0.1:8099` breaks with
multiple instances. The router discovers running instances via
`scratch/instances/*.sock` — the filesystem IS the registry. Falls back to
port scanning 8099–8103 if no sockets found.

### Directory opening: `finder.open` then `finder.navigate`

`finder.navigate` requires an already-open File Manager window. The router must
handle the "no window open" case by issuing `finder.open` first, then
`finder.navigate` with the path. (Note: the existing `wibwob-open` extension
and `wibwob-url-handler.sh` both have this bug — they call `finder.open` with
empty args for directories.)

## Existing infrastructure

| Piece | Status | Location |
|-------|--------|----------|
| HTTP API with command dispatch | ✅ Done | `src/services/control-api.ts` |
| Unix socket listener | ✅ Done | `src/services/control-api.ts` |
| Instance socket registry | ✅ Done | `scratch/instances/*.sock` |
| `wibwob-url-handler.sh` (stub) | 🟡 Partial | `scripts/wibwob-url-handler.sh` |
| `wibwob-open` pi extension | ✅ Done | `.pi/extensions/wibwob-open/index.ts` |
| Ghostty AppleScript API | ✅ Available | Ghostty 1.3+ SDEF |
| `POST /commands/run` | ✅ Done | Control API |
| File-opening commands | ✅ Done | `editor.open`, `finder.open`, `markdown.open`, `primer.open` |

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

Create `lib/wibwob-router.ts` — a standalone pure-function module that maps
intents to WibWob-DOS commands. No TUI dependencies.

```typescript
interface RouteIntent {
  path?: string;       // absolute file/dir path
  url?: string;        // wibwob://... URL
  line?: number;       // optional line number
  app?: string;        // explicit app hint: "editor" | "finder" | "markdown" | "primer"
}

interface RouteResult {
  commands: Array<{ id: string; args: Record<string, unknown> }>;
  // Array because dir open needs [finder.open, finder.navigate]
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
| `.png`, `.jpg`, `.gif`, `.webp` | `primer.open` | Image-to-ASCII |
| Directory | `[finder.open, finder.navigate]` | Open + navigate sequence |
| `wibwob://open?path=X` | (re-route through path logic) | Generic open |
| `wibwob://command?id=X&args=Y` | (direct dispatch) | Power-user URL |

Instance discovery:

```typescript
function discoverInstance(): { socket?: string; port?: number } | null;
// 1. Scan scratch/instances/*.sock
// 2. Fallback: probe ports 8099–8103 via GET /health
// 3. Return null if nothing found
```

- [ ] AC-01: `route({ path: "/foo/bar.ts" })` returns `{ commands: [{ id: "editor.open", args: { filePath: "/foo/bar.ts" } }] }`.
  Test: Unit test with 10+ file extensions.
- [ ] AC-02: `route({ path: "/foo/" })` returns two commands: `finder.open` then `finder.navigate`.
  Test: Unit test with directory path.
- [ ] AC-03: `route({ url: "wibwob://open?path=/foo/bar.md" })` parses URL and routes to `markdown.open`.
  Test: Unit test with URL parsing.
- [ ] AC-04: `route({ path: "/foo/bar.ts", app: "finder" })` respects explicit app hint.
  Test: Unit test — app override beats file extension.
- [ ] AC-05: Unknown extensions return `editor.open` as default (not null).
  Test: `route({ path: "/foo/bar.xyz" })` → editor.open.
- [ ] AC-06: `discoverInstance()` finds running instance via socket file.
  Test: With WibWob-DOS running → returns socket path.
- [ ] AC-07: `discoverInstance()` falls back to port scanning when no sockets.
  Test: Remove socket files → still finds instance via HTTP.
- [ ] AC-08: `discoverInstance()` returns null when nothing running.
  Test: Stop WibWob-DOS → returns null.

#### S02 — CLI dispatcher script
**Status:** not-started

Enhance `scripts/wibwob-url-handler.sh` (or create `wibwob open` subcommand)
that shells into the router:

```bash
# Usage:
wibwob open /path/to/file.ts          # routes to editor
wibwob open /path/to/dir/             # routes to file manager
wibwob open wibwob://open?path=/foo   # routes via URL scheme
```

Checks instance via `discoverInstance()`. Falls back to `open` / `$EDITOR` if
WibWob-DOS is not running.

- [ ] AC-09: `wibwob open /tmp/test.md` opens markdown viewer in WibWob-DOS.
  Test: Run command with WibWob-DOS running → window appears.
- [ ] AC-10: With WibWob-DOS stopped, falls back to system `open`.
  Test: Stop WibWob-DOS → run command → system default opens.
- [ ] AC-11: Integration test for `wibwob open`.
  Test: `bun run test:integration` includes deep-link routing tests.

### F02 — pi CLI Extension

#### S03a — Update `wibwob-open` extension to use router
**Status:** not-started

Replace the hardcoded `editor.open` / `finder.open` logic in
`.pi/extensions/wibwob-open/index.ts` with the WibWob Router. Use
`discoverInstance()` instead of hardcoded `127.0.0.1:8099`.

- [ ] AC-12: `wibwob_open` tool routes `.md` files to `markdown.open` (not `editor.open`).
  Test: Agent calls `wibwob_open({ path: "README.md" })` → markdown viewer opens.
- [ ] AC-13: Extension discovers instance via sockets, not hardcoded port.
  Test: WibWob-DOS on port 8100 → extension still finds it.
- [ ] AC-14: Extension checks health before routing; returns error if unreachable.
  Test: Stop WibWob-DOS → tool call → error message, no crash.
- [ ] AC-15: Extension works with pi extension lifecycle (install, enable, disable).
  Test: `pi extension list` shows `wibwob-open` with correct status.

#### S03b — `on("tool_call")` interception (stretch)
**Status:** not-started

Intercept `read` tool calls in the pi extension — when the agent reads a file,
optionally also open it in WibWob-DOS for the user to see.

- [ ] AC-16: After agent reads a file, it appears in WibWob-DOS File Manager.
  Test: Agent reads `src/app.ts` → file manager navigates to show it.

#### S03c — OSC 8 link rewriting (stretch, Ghostty-only)
**Status:** not-started

Rewrite `file://` links in pi output to `wibwob://` when WibWob-DOS is alive
and running inside Ghostty. Makes file paths clickable → opens in WibWob-DOS.

- [ ] AC-17: File paths in pi output are clickable OSC 8 links in Ghostty.
  Test: Pi agent outputs a file path → Cmd+click → opens in WibWob-DOS.

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

- [ ] AC-18: After running `create-wibwob-app.sh`, `open wibwob://open?path=/tmp` works.
  Test: Create app → `open wibwob://open?path=/tmp/test.md` → WibWob-DOS opens file.
- [ ] AC-19: URL scheme persists across reboots (LaunchServices cached).
  Test: Reboot → `open wibwob://open?path=/tmp/test.md` still works.
- [ ] AC-20: `wibwob://command?id=primer.open&args.filePath=/tmp/art.txt` dispatches arbitrary commands.
  Test: Open URL → primer window opens.

#### S05 — macOS file type associations
**Status:** not-started

Extend the `.app` bundle's `Info.plist` with `CFBundleDocumentTypes` to claim
file associations for `.md`, `.txt`, `.ascii` (opt-in — user must explicitly
set WibWob as default via Finder → Get Info → Open With).

- [ ] AC-21: `WibWob.app` appears in Finder's "Open With" menu for `.md` files.
  Test: Right-click a `.md` file in Finder → WibWob listed.
- [ ] AC-22: Setting WibWob as default for `.md` → double-click opens in WibWob-DOS.
  Test: Set default → double-click `README.md` → markdown viewer opens.

### F04 — Ghostty Integration

#### S06 — Ghostty-specific enhancements
**Status:** not-started

When running inside Ghostty (detected via `$TERM_PROGRAM`):

1. Shader control URLs: `wibwob://shader?name=glow` — requires registering
   `ghostty.shader.set` in `command-catalog.ts` as part of this story.
2. Tab management: `wibwob://tab?action=new&command=bun+run+dev` (stretch goal).

- [ ] AC-23: `ghostty.shader.set` command registered in `command-catalog.ts`.
  Test: `wibwob commands -q | grep ghostty.shader.set` returns the command.
- [ ] AC-24: `wibwob://shader?name=glow` activates shader in Ghostty.
  Test: Open URL → shader changes in real-time.
- [ ] AC-25: Router correctly maps shader URLs to `ghostty.shader.set` (added in this story).
  Test: Unit test for shader URL routing.

---

## Implementation order

| Phase | Stories | Effort | Why this order |
|-------|---------|--------|----------------|
| 1. Router | S01, S02 | 1 day | Foundation — everything depends on this |
| 2. pi CLI | S03a | 0.5 day | Highest daily-use value |
| 3. URL scheme | S04 | 0.5 day | Enables browser/Slack links |
| 4. File assoc. | S05 | 0.5 day | Finder integration |
| 5. Ghostty | S06 | 0.5 day | Shader URLs, new command |
| 6. Stretch | S03b, S03c | 1 day | Nice-to-have, Ghostty-only |

## Risks

- **LaunchServices caching**: macOS aggressively caches URL scheme registrations.
  Unregistering requires `lsregister -u` or app deletion + reboot.
- **Multiple WibWob-DOS instances**: Router discovers via socket files — but
  which instance to target if multiple are running? Default: first found.
  Future: `wibwob://open?instance=main&path=...` to specify.
- **pi extension API stability**: `on("tool_call")` hook API may change between
  pi versions — pin to known-good version.
- **Ghostty SDEF availability**: AppleScript API is Ghostty 1.3+ only. Detect
  version and degrade gracefully.
- **`finder.open` dir bug**: Both the existing `wibwob-open` extension and
  `wibwob-url-handler.sh` pass empty args when opening directories. S01 fixes
  this in the router; S03a fixes the extension. The old scripts should be
  updated or deprecated.
