# Rezi TUI MVP

Second spike for a TypeScript WibWob-DOS-style shell using Rezi and Bun.

## Scope

- Bun-native runtime
- Rezi renderer
- desktop-style shell with toolbar and status bar
- primer viewer panel
- editable text panel using Rezi `codeEditor`
- terminal panel using `bun-pty` plus Rezi `logsConsole`

## Run

```bash
cd /Users/james/Repos/wibandwob-dos/spikes/rezi-tui-mvp
bun install
bun run dev
```

## Notes

- This is a desktop-ish MVP, not a Turbo Vision port.
- The terminal panel is a persistent shell session with command input and streamed output.
- It is not a full VT terminal emulator yet, so fullscreen terminal apps are still out of scope.
