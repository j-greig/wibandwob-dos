# signls — Vendored MIDI Sequencer

[signls](https://github.com/emprcl/signls) is a non-linear, node-based
generative MIDI sequencer (Go/Bubbletea TUI) by [emprcl](https://github.com/emprcl).

## How it works

The pi extension at `.pi/extensions/signls/index.ts` manages this directory:

- **Binary** (`signls`) — downloaded from GitHub Releases on first use (gitignored)
- **Banks** (`banks/*.json`) — grid bank files, committed to the repo
- **Config** (`config.json`) — signls runtime config (gitignored, regenerated)

## Usage from pi

```
/signls launch          # start in tmux session
/signls stop            # graceful shutdown
/signls status          # check install/running state
/signls attach          # print tmux attach command
```

Or via the LLM tool:

```
signls { action: "launch", bank: "my-set" }
signls { action: "inspect", bank: "default" }
signls { action: "status" }
```

## Manual usage

```bash
vendor/signls/signls --bank vendor/signls/banks/default.json --keyboard qwerty-mac
```

## Version

Currently pinned to **v0.7.1**. Update `SIGNLS_VERSION` in the extension to upgrade.
