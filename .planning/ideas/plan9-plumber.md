# Plan 9 Plumber for WibWob-DOS

Reference: https://9fans.github.io/plan9port/man/man4/plumber.html

## The Idea

Plan 9's plumber is an inter-process message router. Programs send messages
containing a piece of data (a filename, URL, line number, etc.) and the plumber
routes them to the right handler based on pattern-matching rules.

Example: right-clicking a file path in any window → plumber matches "looks like
a file path" → opens it in the editor. No app needs to know about any other app.

## Why It Fits WibWob-DOS

- COAT-native: plumbing is a runtime semantic, not a TUI concept
- Microapps stay decoupled: they emit messages, plumber routes
- Agent-friendly: agents can plumb messages the same way humans do
- Already hinted: notepad has "plumb" in its hero description, `wibwob.ts` CLI
  references plumbing, `text-windows.ts` has plumb patterns

## Sketch

```typescript
// Plumb rules (declarative, like Plan 9's plumb files)
const rules: PlumbRule[] = [
  { pattern: /\.(txt|md|ts|js)$/,  action: "edit",   target: "wibwob.notepad" },
  { pattern: /\.(png|jpg|gif)$/,   action: "view",   target: "wibwob.primer-viewer" },
  { pattern: /^https?:\/\//,       action: "browse",  target: "wibwob.browser" },
  { pattern: /\.canvas\.yaml$/,    action: "open",    target: "wibwob.zine" },
];

// Any microapp can plumb
host.plumb("open", "/path/to/file.md");
// → plumber matches *.md → routes to notepad with { action: "edit", data: "/path/to/file.md" }

// Plumber is a service, not a UI
plumberService.route({ action: "open", data: "/path/to/file.md" });
```

## Implementation Path

1. `src/services/plumber-service.ts` — rule engine, route(), registerRule()
2. Rules file: `plumb-rules.ts` or `plumb-rules.yaml` (like Plan 9's `$HOME/lib/plumbing`)
3. SDK surface: `host.plumb(action, data)` — sends to plumber
4. SDK surface: `host.onPlumb(cb)` — receives routed messages
5. Command: `plumb.send` — API/CLI-accessible
6. Command: `plumb.rules` — list active rules

## Relates To

- Event bus / persistence redesign (TODO-b1ddb4ff) — plumber is a typed event router
- File-manager: "open with" is plumbing
- Runtime Inspector: could show plumb rule matches live
- Agent tools: `tui_plumb` tool for agents to route content between apps

## Priority

Medium-term. Not blocking current work but architecturally significant.
Fits the symbient philosophy — plumbing is content-aware routing that both
humans and agents use identically.

## wibwob:// URL Scheme

Register a macOS URL handler for `wibwob://` URIs. When Ghostty (or any terminal)
renders an OSC 8 hyperlink with `wibwob://open?path=/foo/bar`, clicking it routes
to the running WibWob-DOS file browser via the control API.

Use cases:
- Pi agent output with clickable file paths → open in wibwob file browser
- Terminal output with file references → plumb to editor/viewer
- Cross-process routing (any tool can emit wibwob:// links)

Implementation:
1. macOS .app bundle or `open -a` handler registered for `wibwob://`
2. Handler script: parse URI, call `wibwob run "finder.open" --path <path>`
3. Fallback: if wibwob not running, `open <path>` (system default)
4. Pi extension: emit file paths as OSC 8 links with `wibwob://` scheme
