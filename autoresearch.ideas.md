# Autoresearch Ideas: Unix CLI (ww) — Phase 2

## Done
- [x] src/cli/ww.ts — thin HTTP client, ~140 lines
- [x] 3 syntax styles: dot (theme.set), noun-verb (theme set), positional (window 3 close)
- [x] Built-in: state, windows, commands, health, screenshot
- [x] Flag parsing: numbers, strings, booleans, JSON
- [x] -q/--quiet mode for piping
- [x] WW_API env override
- [x] JSON to stdout, errors to stderr, proper exit codes
- [x] bun run ww shortcut in package.json
- [x] 42/42 tests passing

## Could add (diminishing returns)
- `ww window` (no verb) → show focused window info
- `ww open <type>` shorthand for editor.new, art.open etc
- `ww close` (no args) → close focused window
- `--format` flag for tmux-style format strings
- Symlink/alias so `ww` works without `bun run` prefix
- Tab completion script generation
- `ww watch` — stream state changes (SSE or polling)

## NOT doing (out of scope for E039)
- Zod schemas on command definitions (Phase 1 from SURFACE_PARITY — separate story)
- Unix socket transport (future, HTTP is fine for now)
- Virtual filesystem model (speculative, long-term)
