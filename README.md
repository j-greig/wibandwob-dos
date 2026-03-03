# WibWob-DOS

Terminal-native TypeScript TUI desktop shell.

## Run

```bash
bun install
bun run start                    # normal mode
bun run dev                      # dev mode (reload button, Ctrl+R)
./scripts/dev.sh                 # dev mode with auto-restart loop
```

## Flags

```
--dev              Dev mode: reload button top-right, Ctrl+R to hot reload
--custom-cursor    Enable custom TUI cursor overlay (off by default)
--help, -h         Show all flags and exit
```

Flags work with any launch method:

```bash
bun run start --custom-cursor
bun run src/app.ts --dev --custom-cursor
```

## Controls

- `Alt-F`: open File menu
- `Alt-E`: open Edit menu
- `Alt-H`: open Help menu
- `Tab` / `Shift-Tab`: cycle window focus
- `Space`: pause/resume animated primers
- `Esc`: close menus or prompts
- `Ctrl-R`: reload app (dev mode only)
- `Ctrl-Q`: quit

## Menu layout

- `File`: file/workspace operations
- `Edit`: future edit operations
- `View`: palette, inspector, document reader
- `Window`: focus, layout, workspace management
- `Applications`: app launchers
- `Help`: view README

## Typecheck

```bash
bun run typecheck
```

## Architecture

See `docs/020-target-architecture.md` for the canonical end-state layout.
See `docs/000-docs-overview.md` for the full doc inventory.
