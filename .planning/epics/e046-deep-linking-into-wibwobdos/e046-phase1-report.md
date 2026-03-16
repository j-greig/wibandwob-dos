# E046 Phase 1 Report — Deep Linking Infrastructure

**Date:** 2026-03-16
**Stories:** S01, S02, S03a, S04, S05
**Status:** Phase 1 complete. S03b/c (stretch) and S06 (Ghostty) remain.

## What shipped

| Story | Deliverable | Key file |
|-------|-------------|----------|
| S01 Router | File-type → command mapping, URL parsing, instance discovery | `lib/wibwob-router.ts` |
| S01 Tests | 31 unit tests covering extensions, dirs, URLs, hints, edges | `lib/wibwob-router.test.ts` |
| S02 CLI | `wibwob open <path\|url>` subcommand | `src/cli/wibwob.ts` |
| S03a Extension | Pi extension rewrite — uses router, socket discovery | `.pi/extensions/wibwob-open/index.ts` |
| S04 URL scheme | macOS .app via osacompile, `wibwob://` registered | `scripts/create-wibwob-app.sh` |
| S05 File assoc. | `.md`, `.txt`, `.ascii` in Info.plist | (same script) |

## Routing table

| Extension | Command | App |
|-----------|---------|-----|
| `.md` | `markdown.open` | Markdown viewer |
| `.ts/.js/.py/.sh/.css` + 20 more | `editor.open` | Text editor |
| `.json/.yaml/.toml` | `editor.open` | Text editor |
| `.txt/.ascii/.ans/.nfo` | `primer.open` | Primer viewer |
| `.png/.jpg/.gif/.webp/.svg` | `primer.open` | Image-to-ASCII |
| Directory | `finder.open` + `finder.navigate` | File manager |
| `wibwob://open?path=X` | (re-route via path) | Auto |
| `wibwob://command?id=X` | (direct dispatch) | Any |
| `wibwob://shader?name=X` | `ghostty.shader.set` | Ghostty (S06) |

## Architecture

```
pi CLI ext / macOS .app / wibwob open CLI
         │
         ▼
   lib/wibwob-router.ts  (standalone, no TUI deps)
   ├─ route(intent) → commands[]
   ├─ discoverInstance() → socket or port
   └─ dispatch() → POST /commands/run
         │
         ▼
   WibWob-DOS control API (port 8099 or unix socket)
```

## Known issues

- `markdown.open` sometimes creates "Untitled.txt" instead of rendered view — pre-existing command bug, not router issue.
- Stale WibWob.app applet process blocks Apple Event delivery — kill old process, fresh launch works.
- LaunchServices caching can delay URL scheme registration — `lsregister -f` forces it.

## Remaining (Phase 2)

- **S03b** — `on("tool_call")` intercept in pi extension (stretch)
- **S03c** — OSC 8 link rewriting in Ghostty (stretch)
- **S06** — `ghostty.shader.set` command + shader URL routing
