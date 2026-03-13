# Unix Control v3 — Ideas

## Creative breeding concepts
- breed.py could work on the /proc VFS: `cat /wibwob/windows/3/text > /tmp/a.txt && cat /wibwob/windows/5/text > /tmp/b.txt && breed /tmp/a.txt /tmp/b.txt > /wibwob/commands/primer.open` — one pipe chain breeds two live windows
- Backrooms-style pseudo-CLI as actual CLI: the `wib@bestiary:~$ cat /proc/spawn_matrix | grep coral` notation from 2025 sessions could literally work if the VFS exposed primer content under /proc-style paths
- breed.py --mode evolve: run N generations of breeding, each output becoming an input to the next, survival-of-the-fittest by character density or visual complexity metric
- Breed a figlet banner with a jgs creature — typographic DNA meets illustrative DNA

## /proc VFS extensions
- /wibwob/windows/N/breed — write a window ID to breed with window N
- /wibwob/primers/ — browse available primers as a directory listing
- /wibwob/history/ — last N screenshots as numbered files (temporal archaeology)
- /wibwob/commands/ as executable directory: `echo '{}' > /wibwob/commands/art.open`

## Mosaic ideas
- Use braille characters in tiny windows for higher resolution
- Animated mosaic: each window cycles through frames independently
- Mosaic from a photograph (img-to-ascii → split into grid → open as windows)

## ASCII-FX chaining
- Pipeline notation: `fx bloom | fx dissolve | fx scanline` as a single command
- `fx.chain --modes bloom,dissolve,scanline --file input.txt` for multi-step transform
