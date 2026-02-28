# 007 — Terminal Emulator

> Developer handover document for the WibWob-DOS TypeScript rebuild.
> Covers the C++ tvterm-based terminal emulator, PTY management, IPC commands,
> the Backrooms TV subprocess model, and the TS spike's bun-pty implementation.

---

## 1. tvterm-core Architecture

The C++ app embeds **tvterm**, a vendored terminal emulator library that lives under
`vendor/tvterm/`. It is a full VT-sequence parser backed by **libvterm** with a
Turbo Vision rendering surface.

### Key components

| File | Role |
|------|------|
| `vendor/tvterm/include/tvterm/termctrl.h` | `TerminalController` — owns the PTY, the emulator, and the state mutex |
| `vendor/tvterm/include/tvterm/termemu.h` | `TerminalSurface` (wraps `TDrawSurface`), damage tracking, terminal state |
| `vendor/tvterm/include/tvterm/vtermemu.h` | `VTermEmulator` — libvterm-backed VT parser/state machine |
| `vendor/tvterm/source/tvterm-core/pty.cc` | PTY allocation (`openpty`/`forkpty`), shell spawning, resize, disconnect |
| `vendor/tvterm/source/tvterm-core/termctrl.cc` | Event loop: reader thread + writer thread + mutex-protected state |

### Threading model

`TerminalController::create()` spawns **two detached threads**:

1. **ReaderLoop** — blocking `read()` on the PTY master fd. Reads one byte, then
   drains any available bytes via `FIONREAD`/`ioctl`. Feeds data to the
   `VTermEmulator` which updates the `TerminalState` (surface cells + cursor + title).
2. **WriterLoop** — waits on a condition variable. Wakes up to:
   - Process queued `TerminalEvent`s (keyboard input → write to PTY master).
   - Flush pending client data from the `GrowArrayWriter`.
   - Handle viewport resize events (sends `TIOCSWINSZ` to PTY).

State access is serialised via `Mutex<TerminalState>`, exposed through
`TerminalController::lockState(func)`.

### Screen buffer model

`TerminalSurface` wraps Turbo Vision's `TDrawSurface` — a 2D grid of `TScreenCell`
(one per character cell). Each cell contains:

- `TCellChar` — the UTF-8 text content (handles wide chars and trail cells)
- Foreground/background colour attributes

The surface tracks **per-row damage** (`RowDamage { begin, end }`) so the view only
repaints changed regions. `clearDamage()` resets after each render pass.

### VT parser

`VTermEmulator` delegates to libvterm (`struct VTerm *vt`) which handles:
- CSI sequences (cursor movement, SGR colours, erase, scroll regions)
- OSC sequences (title changes)
- Mouse reporting enable/disable
- Alt-screen buffer switching
- A scrollback `LineStack` (up to 10,000 lines)

The emulator sets `TERM=xterm-256color` via `VTermEmulatorFactory::getCustomEnvironment()`.

---

## 2. Terminal View: TUI Rendering

`app/tvterm_view.h` and `app/tvterm_view.cpp` define `TWibWobTerminalWindow`, a thin
subclass of tvterm's `BasicTerminalWindow`.

### Rendering flow

1. The app's **idle handler** (`wwdos_app.cpp:~2916`) broadcasts
   `cmTvTermCheckUpdates` on every idle tick.
2. `BasicTerminalWindow` (from tvterm) handles this broadcast: checks
   `termCtrl.stateHasBeenUpdated()`, and if true, locks state and copies the
   `TerminalSurface` cells into the view's `TDrawBuffer` for painting.
3. Damage tracking means only changed rows are copied.

### Command constants

tvterm uses broadcast commands for its update cycle. WibWob-DOS assigns these
starting at ID 500 to avoid collisions:

```cpp
cmTvTermCheckUpdates = 500,  // idle → poll for updates
cmTvTermUpdated      = 501,  // terminal repainted
cmTvTermGrabInput    = 502,  // terminal wants exclusive keyboard
cmTvTermReleaseInput = 503,  // terminal releases keyboard
hcTvTermInputGrabbed = 504,  // help context hint
```

These are bundled into `TVTermConstants` and passed to the tvterm library.

### Window behaviour

- `handleEvent()` — if the terminal is disconnected and a keypress arrives,
  the window auto-closes. Otherwise delegates to `BasicTerminalWindow`.
- `sizeLimits()` — constrains max size to the owner (desktop) bounds.
- `options |= ofTileable` — terminals participate in tile/cascade layout.

---

## 3. PTY Spawn: Shell Environment and Sizing

### Unix path (`pty.cc`)

`createPty()` calls `openpty()` to get a master/slave fd pair, then `vfork()`s:

**Child process setup:**
1. `setsid()` — new session (detach from parent's controlling terminal)
2. `ioctl(slaveFd, TIOCSCTTY, 0)` — acquire controlling terminal
3. Reset signal handlers (`SIGINT`, `SIGQUIT`, `SIGSTOP`, `SIGCONT`) to `SIG_DFL`
4. `dup2()` slave fd onto stdin/stdout/stderr
5. Close master fd and excess slave fd
6. `execve(shell, args, envp)` — runs `$SHELL` (or `/bin/sh` fallback)

**Environment:**
- Inherits parent's full `environ`, with custom overrides merged in.
- `VTermEmulatorFactory` sets `TERM=xterm-256color`.
- Shell is resolved from the `SHELL` environment variable.

**Initial termios:**
- Standard cooked mode: `ICRNL | IXON`, `OPOST | ONLCR`, `CS8`, `ISIG | ICANON | ECHO`
- `IUTF8` set when available
- Baud rate: B38400 (conventional for PTYs, irrelevant in practice)
- Standard control characters (Ctrl-C = SIGINT, Ctrl-Z = SIGSUSP, etc.)

### Resize propagation

`PtyMaster::resizeClient()` sends `TIOCSWINSZ` ioctl to the master fd. This
triggers a `SIGWINCH` in the child's process group, causing shell/curses apps to
query the new size. In tvterm, resize events come through the `WriterLoop` via
a queued `TerminalEvent` of type `ViewportResize`.

### Disconnect / cleanup

`PtyMaster::disconnect()`:
1. Close master fd
2. `SIGHUP` to child PID
3. `sleep(1)`, then `SIGKILL` if still alive
4. `waitpid()` to reap

---

## 4. terminal_write / terminal_read IPC Commands

These are the API commands that allow external callers (the FastAPI server) to
interact with terminal windows.

### `terminal_write`

**Signature:** `api_terminal_write(app, text, window_id) → string`

**Semantics:**
- Finds the target terminal window (by `window_id`, or topmost by z-order).
- Calls `TWibWobTerminalWindow::sendText(text)`.
- `sendText()` iterates each **byte** of the text and injects it as a
  `TerminalEvent::KeyDown` through `termView->termCtrl.sendEvent()`.
- Special handling for `\n`/`\r` → sends `\r` with scancode `0x1c0d` (kbEnter).
- Returns `"ok"` on success, `"err ..."` on failure.

**Important:** This is a *keystroke injection*, not a raw PTY write. The bytes
pass through tvterm's event pipeline and then get written to the PTY master by
the WriterLoop thread. This means terminal line editing (backspace, etc.) works
naturally.

### `terminal_read`

**Signature:** `api_terminal_read(app, window_id) → string`

**Semantics:**
- Finds the target terminal window (by `window_id`, or topmost by z-order).
- Calls `TWibWobTerminalWindow::getOutputText()`.
- Locks the terminal state and reads the **visible screen buffer** — not scrollback.
- Iterates every cell in the `TerminalSurface`, extracting UTF-8 text.
- Skips wide-char trail cells to avoid duplicating characters.
- Strips null bytes (empty cells) and trailing whitespace per row.
- Returns the full screen content as a newline-separated string.

**Note:** This reads the *rendered VT state*, not raw PTY output. ANSI sequences
have already been parsed by libvterm into cell attributes. The returned text is
clean plaintext.

### Registration in command_registry.cpp

```cpp
{"open_terminal",    "Open a terminal emulator window", false},
{"terminal_write",   "Send text input to the terminal emulator (requires text param; optional window_id)", true},
{"terminal_read",    "Read the visible text content of a terminal window (optional window_id param)", false},
```

---

## 5. Multi-Terminal Support: Window ID Targeting

### Z-order default selection

Both `terminal_write` and `terminal_read` accept an optional `window_id` parameter.
When omitted, `find_terminal_by_zorder()` walks the desktop's view chain from
front to back (z-order) and returns the **first** `TWibWobTerminalWindow` found:

```cpp
static TWibWobTerminalWindow* find_terminal_by_zorder(TWwdosApp& app) {
    TView* start = app.deskTop->first();  // frontmost
    if (!start) return nullptr;
    TView* v = start;
    do {
        if (auto *tw = dynamic_cast<TWibWobTerminalWindow*>(v))
            return tw;
        v = v->next;
    } while (v != start);
    return nullptr;
}
```

This means the most recently focused terminal window is the default target.

### Explicit targeting

When `window_id` is provided, it's looked up in `app.idToWin` (the global window
registry map). The result is `dynamic_cast`'d to `TWibWobTerminalWindow*` — if the
window exists but isn't a terminal, the command returns an error.

### In-game terminal spawning

The app spawns contextual terminal windows from games (Rogue dungeon hacking,
Deep Signal analysis). These use `createTerminalWindow()` + `sendText()` to
inject scripted shell commands that create narrative terminal experiences using
`echo`, `sleep`, and shell pipelines. These terminals are full PTY-backed shells
— the "script" is just shell commands piped through `sendText()`.

---

## 6. Backrooms TV Subprocess Model

`app/backrooms_tv_view.cpp` implements a **different** PTY strategy for running
the Backrooms CLI (a Node.js/TSX process) as a streaming text source.

### Why forkpty() instead of pipe()

The Backrooms CLI (`npx tsx src/ui/cli-v3.ts`) streams LLM output to stdout.
Node.js buffers stdout when it detects a non-TTY (pipe). Using `forkpty()` gives
the child its own **private PTY** so Node sees `isatty(1) === true` and streams
unbuffered.

**Critical constraint:** This PTY must be *separate* from Turbo Vision's terminal.
An earlier approach using `script(1)` shared the parent's controlling terminal
and mutated termios state, which froze the Turbo Vision event loop.

### Process group management

```cpp
pid_ = forkpty(&masterFd, nullptr, nullptr, &ws);
```

`forkpty()` calls `setsid()` in the child, making it the leader of a new session
and process group. This is exploited for cleanup:

```cpp
// Kill the entire process group (sh -> npx -> node tree)
kill(-pid_, SIGTERM);
usleep(100000);  // 100ms grace
kill(-pid_, SIGKILL);
waitpid(pid_, &status, 0);
```

The negative PID in `kill(-pid_)` sends the signal to the entire process group,
which is essential because the child is `sh -c "cd ... && npx tsx ..."` — a
chain of shell → npx → node processes.

### Environment

```cpp
TERM=dumb NO_COLOR=1 WIBWOB_AUTH_METHOD=claude-cli npx tsx ...
```

- `TERM=dumb` — suppresses ANSI formatting from the CLI
- `NO_COLOR=1` — further hint to disable colour output
- `--raw` flag — CLI streams only LLM deltas, no formatting
- `2>/dev/null` — stderr discarded (or rather, goes to the PTY but is ignored)

### Reading model

The master fd is set **non-blocking** (`O_NONBLOCK`). `readAvailable()` drains in
a loop:

```cpp
for (;;) {
    ssize_t n = read(fd_, buf, sizeof(buf));
    if (n > 0) { out.append(buf, n); continue; }
    if (n == 0) return totalRead > 0 ? totalRead : -1;  // EOF
    if (errno == EAGAIN) break;                           // no more data
    if (errno == EIO) return totalRead > 0 ? totalRead : -1;  // PTY EOF
}
```

**PTY EOF quirk:** When the slave side closes, the master gets `EIO` (not `EOF`
like a pipe). The code handles both `n == 0` and `errno == EIO` as end-of-stream.

### ANSI stripping

Despite `TERM=dumb`, some ANSI escapes leak through (from Node's error formatting,
etc.). `stripAnsi()` removes CSI (`ESC[...letter`) and OSC (`ESC]...BEL`) sequences
before appending lines to the display buffer.

### Display

`TBackroomsTvView` is a `TScroller` (not a terminal emulator). It maintains a
`std::deque<std::string> lines_` ring buffer (max 5000 lines) and renders plain
text with fixed white-on-black attributes. A timer polls `readAvailable()` and
appends new lines. Auto-scroll tracks whether the user has scrolled up manually.

---

## 7. The TS Spike's Terminal Implementation

`spikes/ts-tui-mvp/src/core/app-controller.ts` → `openTerminalWindow()`

### Stack

- **blessed** — TUI framework (Node.js ncurses wrapper)
- **@skitee3000/bun-pty** — PTY binding for Bun/Node (wraps native `forkpty`)

### PTY creation

```typescript
pty = spawnPty(this.resolveShellPath(), ["-i"], {
    name: "xterm-256color",
    cols: Math.max(20, Number(frame.body.width)),
    rows: Math.max(8, Number(frame.body.height) - 1),
    cwd: REPO_ROOT,
    env: this.getPtyEnv()
});
```

Shell resolution: tries `$SHELL`, then `/bin/zsh`, `/bin/bash`, `/bin/sh`.

Environment: inherits full `process.env`, sets `TERM=xterm-256color` and
`COLORTERM=truecolor` as defaults.

### Rendering approach

The TS spike does **not** implement a VT parser. Instead:

1. `pty.onData(chunk)` fires with raw PTY output.
2. A regex strips ANSI CSI sequences: `chunk.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")`.
3. Also strips `\r` and `BEL` (`\x07`).
4. Cleaned text is split on `\n` and appended to a `blessed.log()` widget.
5. Partial lines are buffered in `terminalPartialLine`.

### Input model

A single-line `blessed.textbox` at the bottom of the window:
- User types a command, presses Enter.
- The full line is written to `pty.write(command + "\r")`.
- The line is also logged to the transcript as `$ command`.

This is a **line-at-a-time** input model — there is no character-by-character
keystroke forwarding. Full-screen TUI apps (vim, htop) won't work.

### Resize

```typescript
const syncPtySize = () => pty.resize(
    Math.max(20, Number(frame.body.width)),
    Math.max(8, Number(frame.body.height) - 1)
);
```

Hooked to both `frame.frame.on("resize")` and `screen.on("resize")`.

### Cleanup

`frame.cleanup = () => pty.kill()` — sends SIGTERM to the PTY child.

---

## 8. Key Differences: tvterm vs blessed/bun-pty Approach

| Aspect | C++ (tvterm) | TS spike (blessed + bun-pty) |
|--------|-------------|------------------------------|
| **VT parsing** | Full libvterm parser → cell grid | Regex ANSI strip → plain text log |
| **Screen buffer** | 2D `TScreenCell` grid with attributes | Scrolling text log (`blessed.log`) |
| **Colour support** | Full 256-colour + RGB via libvterm | Stripped — no colour in output |
| **Full-screen apps** | vim, htop, etc. work correctly | Broken — no alt-screen, no cursor addressing |
| **Input model** | Character-by-character keystroke injection | Line-at-a-time textbox submission |
| **Scrollback** | libvterm LineStack (10k lines) | blessed.log built-in scroll |
| **Read API** | Reads rendered cell grid (clean text) | Would read `transcript.getContent()` |
| **Write API** | Keystroke events through TerminalController | `pty.write(text)` — raw PTY write |
| **Damage tracking** | Per-row dirty regions, incremental repaint | Full content repaint on blessed render |
| **Threading** | Dedicated reader + writer threads | Node.js event loop (single-threaded, async I/O) |

### Implications for the rebuild

The TS spike's approach is fine for simple shell interactions (running commands,
reading output) but cannot host full-screen terminal apps. To reach parity with
the C++ version, the rebuild will need either:

1. **xterm.js** (or similar) — a full VT emulator for the browser/terminal, rendered
   into a blessed-compatible surface. This is the standard approach for web terminals.
2. **node-pty + custom VT parser** — parse VT sequences into a cell grid and render
   to blessed's draw buffer. Essentially re-implementing what tvterm does.
3. **Passthrough mode** — for blessed running in a real terminal, forward raw PTY
   output directly to the host terminal within a subwindow region using cursor
   positioning. Fragile but avoids re-parsing.

Recommendation: Use **xterm.js headless** (or `node-pty` + a minimal VT state
machine like `vt-parser`) to maintain a cell grid, then render that grid into
blessed box content with `{tags: true}` for colours. This preserves the clean
read/write API semantics while supporting full-screen apps.

---

## 9. Gotchas

### ANSI stripping

- **Backrooms TV** strips ANSI with `stripAnsi()` (handles CSI + OSC) despite
  `TERM=dumb`. Some Node libraries ignore `TERM` and check `isatty()` instead.
- **TS spike** uses a regex that only handles CSI (`ESC[...`), missing OSC
  (`ESC]...`), DCS, and other escape types. Edge case: title-setting sequences
  (`ESC]0;title BEL`) will leak garbage into the transcript.
- **terminal_read** returns clean text because libvterm has already parsed
  everything into cells. No stripping needed at the read API level.

### PTY EOF (EIO)

When a PTY slave closes (child exits), the master fd returns `EIO` on read —
**not** `EOF` (`read() == 0`) like a pipe. Both the tvterm reader and the
Backrooms bridge handle this:

```cpp
if (errno == EIO || errno == ENXIO) {
    // PTY slave closed — PTY equivalent of EOF
    return totalRead > 0 ? totalRead : -1;
}
```

**TS rebuild note:** bun-pty wraps this in the `onExit` event, but if you use
raw node-pty, you must handle `EIO` from the data stream gracefully.

### Buffering

- **Pipe buffering:** Node.js buffers stdout to 64KB chunks when `!isatty(1)`.
  The Backrooms TV view avoids this by using `forkpty()` to give the child a PTY.
  The TS spike uses bun-pty which also provides a real PTY, so this isn't an issue.
- **script(1) poisoning:** An earlier Backrooms implementation used `script(1)` to
  force line-buffered output. This shared the parent's controlling terminal and
  corrupted Turbo Vision's termios state. **Never** use `script(1)` in a process
  that owns a TUI.

### Shell inheritance

- The C++ terminal inherits the parent's `$SHELL` and full environment. If the
  app is launched from a restricted context (Docker, cron), the shell may not
  exist or may be `/bin/sh` with minimal PATH.
- The TS spike's `resolveShellPath()` cascades through `$SHELL → /bin/zsh →
  /bin/bash → /bin/sh`, which is more defensive.
- Both pass the full parent environment to the child PTY. Be aware that
  `TERM=xterm-256color` is set by both, which may confuse apps if the outer
  terminal doesn't actually support 256 colours.

### Process group cleanup

- **tvterm:** `PtyMaster::disconnect()` sends `SIGHUP` then `SIGKILL` to the
  child PID only — not the process group. If the shell spawned background jobs,
  they may orphan.
- **Backrooms TV:** Uses `kill(-pid_, SIGTERM/SIGKILL)` to kill the entire
  process group. This is more thorough for the `sh -c "npx tsx ..."` chain.
- **TS spike:** `pty.kill()` sends SIGTERM to the child. Cleanup of descendant
  processes depends on bun-pty's implementation.

### terminal_write encoding

`sendText()` iterates **bytes**, not characters. For multi-byte UTF-8 input,
each byte is sent as a separate `KeyDown` event with `textLength = 1`. This
works because tvterm's writer loop concatenates pending data before writing to
the PTY master, but it's fragile — if the writer flushes between bytes of a
multi-byte character, the terminal may see invalid UTF-8. In practice this
doesn't happen because the writer batches pending data, but it's worth noting
for the rebuild.

### terminal_read cell iteration

`getOutputText()` reads the visible surface only (no scrollback). The surface
size matches the window's interior dimensions. If the terminal window is resized,
the surface is re-allocated and old content is lost (standard VT behaviour —
scrollback is in libvterm's line stack, but `getOutputText` doesn't access it).

### Resize race

There's a potential race between resize propagation and read:
1. Window resizes → `TIOCSWINSZ` → `SIGWINCH` to child
2. Child redraws at new size
3. `terminal_read` sees the new surface

If `terminal_read` fires between steps 1 and 2, it may see a partially
re-rendered screen. In practice this is a non-issue for API callers because
they don't resize and read in the same tick, but automated test harnesses
should add a small delay after resize before reading.
