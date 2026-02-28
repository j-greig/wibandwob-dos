# TS TUI MVP

TypeScript spike for a minimal WibWob-DOS-style desktop shell.

## Scope

- fullscreen terminal app
- top menu bar with `File` and `Edit`
- bottom status line
- read-only primer viewer window
- editable text window
- experimental shell window backed by a pseudo-terminal

## Run

```bash
cd /Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp
npm install
npm run dev
```

## Controls

- `Alt-F`: open File menu
- `Alt-E`: open Edit menu
- `Tab`: focus next window
- `Shift-Tab`: focus previous window
- `Esc`: close menus or prompts
- `Ctrl-Q`: quit app

File menu:

- `Open Primer...`: open a read-only text file in a viewer window
- `Open Text File...`: open an editable text file
- `New Text Buffer`: open a blank editor window
- `Open Terminal`: open experimental shell window

Text editor:

- `Ctrl-S`: save to disk if the editor has a file path

Terminal window:

- experimental only
- suitable for shell commands and line-oriented tools
- full-screen terminal apps are not expected to render correctly yet
