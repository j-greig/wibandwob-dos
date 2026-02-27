---
Status: in-progress
Type: feature
Parent: E018
GitHub issue: —
PR: —
---

# F06 — Terrain Name Fixes & Subprocess Robustness

## TL;DR

Fix blank output for terrain types with spaces in their names, and harden the C++↔Python subprocess contract.

## Problem

Terrains with spaces (`saddle pass`, `ridge valley`, `lone peak`, `twin peaks`) showed blank in WibWob-DOS because the terrain name wasn't quoted in the shell command, causing argparse to see two separate args.

## Root cause

`ContourBridge::start()` built the command as:
```
python3 contour_stream.py --terrain saddle pass --levels 5
```
Should be:
```
python3 contour_stream.py --terrain "saddle pass" --levels 5
```

## Fixes applied

- [x] Quote terrain name in subprocess command (`"` around value)
- [x] Resolve script path from executable location (not just cwd)

## Remaining work

- [ ] Add `--list-terrains` contract test: Python output must match C++ `kTerrainNames[]`
- [ ] Redirect subprocess stderr to a debug log (not /dev/null) in debug builds
- [ ] Consider using terrain index (0-6) instead of name string to avoid quoting issues entirely
- [ ] Add error recovery: if subprocess exits non-zero, show error in view instead of blank
