# Autoresearch Ideas: Unix CLI (ww) — Phase 2

## Current state
- src/cli/ww.ts exists — thin HTTP client to control API
- Supports: state, windows, commands, health, cmd <id>, dot syntax, noun verb syntax
- Outputs JSON to stdout, errors to stderr

## Parity improvements
- ww window <id> move should also work (target before verb)
- ww theme set --name dark should work
- ww screenshot should hit GET /screenshot/text
- ww window <id> close should work without --id flag (positional arg)

## Ergonomics
- --quiet / -q flag: output just IDs one per line (for xargs piping)
- --format flag: template strings like tmux -F
- Focused-window default: ww window move --x 10 --y 5 (no ID = focused)

## Coverage
- Map all 132 api:true commands to verify they work via ww
- Special subcommands for frequent operations (ww open, ww close, ww focus)

## Test improvements
- Test window.resize with flag parsing
- Test theme.set
- Test ww with WW_API env var override
- Test stderr output format on errors
