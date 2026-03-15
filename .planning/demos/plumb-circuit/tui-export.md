# WibWob-DOS Plumb Circuit — Full TUI Export

Four windows tiled 2×2, text flowing: **primer → notepad → agent chat → agent reply**

```
 File   Edit   View   Window   Core Apps  Applications   Help                       ◖⚆ᴥ⚆◗ uv2   ↻
┌─ chaos.txt ──────────────────────────────────────────────────────────────── x ─┐┌─ Notepad ──────────────────────────────────────────────────────────────── x ─┐
│  ╭─╮  ╭╮ ╭╮   ╭╮                                                             ││  ╭─╮  ╭╮ ╭╮   ╭╮                                                          │
│  ╰╮╰╮╭╯╰─╯╰╮ ╭╯╰╮                                                            ││  ╰╮╰╮╭╯╰─╯╰╮ ╭╯╰╮                                                         │
│   ╰╮╰╯   ╭─╯╭╯  │                                                            ││   ╰╮╰╯   ╭─╯╭╯  │                                                         │
│   ╭╯╭╮  ╭╯ ╭╯   │                                                            ││   ╭╯╭╮  ╭╯ ╭╯   │                                                         │
│  ╭╯ ││ ╭╯  │    │                                                            ││  ╭╯ ││ ╭╯  │    │                                                         │
│  │  ╰╯ │   ╰╮  ╭╯                                                            ││  │  ╰╯ │   ╰╮  ╭╯                                                         │
│  ╰╮    ╰╮   ╰╮╭╯                                                             ││  ╰╮    ╰╮   ╰╮╭╯                                                          │
│   ╰╮    ╰─╮  ╰╯                                                              ││   ╰╮    ╰─╮  ╰╯                                                           │
│    ╰╮     ╰─╮                                                                ││    ╰╮     ╰─╮                                                             │
│     ╰───────╯                                                                ││     ╰───────╯                                                             │
│                                                                              ││                                                                           │
│                                                                              ││  Notepad  │  10 lines  175 chars                                          │
└──────────────────────────────────────────────────────────────────────────── + ─┘└────────────────────────────────────────────────────────────────────── + ─┘
┌─ Wib&Wob Chat ──────────────────────────────────────────────────────────── x ─┐┌─ Agent Reply ──────────────────────────────────────────────────────── x ─┐
│  cc:3db7cc2b                                              sonnet-4-6  #1a935f ││  (full agent chat transcript captured via screen crop)                    │
│  ╭╯ ││ ╭╯  │    │                                                            ││                                                                           │
│  │  ╰╯ │   ╰╮  ╭╯                                                            ││  It looks like a descending spiral — reading like a vortex or              │
│  ╰╮    ╰╮   ╰╮╭╯                                                             ││  whirlpool drawn with box-drawing characters. The form tapers              │
│   ╰╮    ╰─╮  ╰╯                                                              ││  from a wide open top down to a closed base. Quite elegant.                │
│    ╰╮     ╰─╮                                                                ││                                                                           │
│     ╰───────╯                                                                ││  **w2 — Wib&Wob Chat** is focused but the window content                   │
│  ```                                                                         ││  isn't directly readable from the API.                                     │
│                                                                              ││                                                                           │
│  It looks like a descending spiral — reading like a vortex or whirlpool      ││  ▸  ✓ 3 tools ran                                                         │
│  drawn with box-drawing characters (╭╯╰─│). The form tapers from a wide      ││                                                                           │
│  open top down to a closed base. Quite elegant.                              ││  Agent Reply  │  21 lines  1784 chars                                      │
│                                                                              │└────────────────────────────────────────────────────────────────────── + ─┘
│  **w2 — Wib&Wob Chat** is focused but the window content isn't directly      │
│  readable from the API.                                                      │
│  ▸  ✓ 3 tools ran                                                            │
│  Ready. █                                                                    │
└──────────────────────────────────────────────────────────────────────────── + ─┘
Tab Next  Shift-Tab Prev  Ctrl-S Save  Ctrl-Q Quit  |  Term 169x44  Theme wibwob-dark  Windows 4
```

## The Pipeline

```
chaos.txt ──plumb──▶ Notepad ──plumb──▶ Wib&Wob Chat ──plumb──▶ Agent Reply
  (primer)           (buffer)            (AI responds)            (response captured)
  175 bytes           175 bytes           175 bytes in             1784 bytes out
                                          1784 bytes response
```

## Commands Used

```bash
wibwob cmd primer.open --filePath .../chaos.txt     # open source art
wibwob cmd microapp.wibwob.notepad.open              # open buffer
wibwob cmd agent.open                                # open AI chat
wibwob cmd microapp.wibwob.notepad.open --title "Agent Reply"  # open dest
wibwob cmd window.tile                               # 2×2 layout

wibwob plumb --from 3 --to 4    # primer → notepad (notepad.write)
wibwob plumb --from 4 --to 2    # notepad → agent  (agent.send)
wibwob plumb --from 2 --to 5    # agent → reply    (notepad.write)
```

## Plan 9 Parallel

In Plan 9, `plumb(1)` sends messages between programs through a uniform
text interface. Programs don't need to know about each other — they just
read and write text. WibWob plumb does the same: `captureText()` is read,
the command fallback chain (`write` → `send` → `create`) is write. The
plumber is 60 lines of CLI that composes two HTTP calls. No new endpoints,
no new SDK methods. COAT.
