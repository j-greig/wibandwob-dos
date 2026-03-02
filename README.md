# WibWob-DOS

Terminal-native TypeScript TUI desktop shell.

## Run

```bash
bun install
bun run dev      # watch mode
bun run start    # single run
```

## Controls

- `Alt-F`: open File menu
- `Alt-E`: open Edit menu
- `Tab` / `Shift-Tab`: cycle window focus
- `Esc`: close menus or prompts
- `Ctrl-Q`: quit

## Menu layout

- `File`: file/workspace operations
- `Edit`: future edit operations
- `View`: palette, inspector, document reader
- `Window`: focus, layout, workspace management
- `Applications`: app launchers

## Typecheck

```bash
bun run typecheck
```

## Architecture

See `docs/020-target-architecture.md` for the canonical end-state layout.
See `docs/000-docs-overview.md` for the full doc inventory.
