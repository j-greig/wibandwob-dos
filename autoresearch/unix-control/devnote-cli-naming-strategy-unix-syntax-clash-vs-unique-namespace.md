# Devnote: CLI Naming Strategy — Unix-Familiar Syntax vs Unique Namespace

Keywords: naming, command names, syntax, Unix conventions, hallucination risk,
namespace collision, verb conflict, ww command, CLI design, LLM training data,
agent confusion, best practice, wmctrl, xdotool, tmux, kubectl, existing tools

## The Question

Should `ww` commands use syntax that mirrors well-known Unix utilities (risking
confusion/collision), or use a unique command vocabulary that avoids clashes?

## Two Strategies

### Strategy A: Unix-familiar verbs

```bash
ww ls                    # like ls — list windows
ww mv 3 --x 10 --y 5    # like mv — move a window
ww rm 3                  # like rm — close a window
ww cat 3                 # like cat — dump window content
ww ps                    # like ps — show running windows with state
ww top                   # like top — live dashboard of window activity
```

Pros:
- LLMs have massive training data for ls/mv/rm/cat/ps syntax
- Zero learning curve for humans who know Unix
- Feels native, not bolted-on
- Pipe patterns transfer: ww ls | grep editor | ww rm

Cons:
- HALLUCINATION RISK: LLM might confuse ww mv with real mv, try to pass
  file paths instead of window IDs, expect mv semantics (rename, overwrite)
- Semantic mismatch: mv moves files between locations, our "move" repositions
  a window on screen. Different concept wearing the same name.
- rm implies deletion (permanent), but closing a window is recoverable.
  An agent might hesitate to use rm thinking it is destructive.
- cat outputs file content, but ww cat would output window content. Close
  enough? Or confusing when both exist in the same shell session?

### Strategy B: Unique domain verbs

```bash
ww windows                # list windows
ww move 3 --x 10 --y 5   # move a window
ww close 3                # close a window
ww read 3                 # read window content
ww state                  # full desktop state
ww open figlet --text X   # open a new window
ww focus 3                # focus a window
ww tile                   # tile all windows
ww theme set dark         # change theme
ww watch                  # stream state changes
```

Pros:
- ZERO collision risk — no Unix tool called "ww windows" or "ww focus"
- Self-documenting: "close" means close, "move" means move, "open" means open
- No semantic confusion: an LLM will not confuse "ww close 3" with anything else
- The verbs match our existing command registry IDs (window.move, window.close)
  which means auto-generation from registry is trivial
- Agent tools already use these verbs (tui_close_window, tui_move_window)

Cons:
- Slightly less "Unix native" feeling
- Agents might not pattern-match as instinctively to pipe compositions
- Longer to type for humans (but humans will rarely type these)

### Strategy C: Hybrid — unique nouns, familiar patterns

```bash
ww win ls                 # noun first, then familiar verb
ww win mv 3 10 5          # positional args like real mv
ww win rm 3               # familiar verb
ww win cat 3              # familiar verb
ww theme ls               # list themes
ww theme set dark         # set theme
ww art open               # open art window
```

Pros: gets the noun-scoping benefit while keeping familiar verbs
Cons: two-word commands are less pipeable, more to parse

## Analysis: What Actually Causes LLM Hallucinations?

The risk is not the verb itself — it is the ARGUMENT PATTERN. Consider:

```bash
mv source dest            # Unix mv: two positional path args
ww mv 3 --x 10 --y 5     # ww mv: numeric ID + named coords
```

An LLM seeing "ww mv" will likely try: ww mv 3 /some/path (treating second
arg as destination, like Unix mv). This is a real hallucination vector.

But with unique verbs:
```bash
ww move 3 --x 10 --y 5   # no Unix tool called "move" — no confusion
```

The LLM has no competing pattern to hallucinate from.

## What The Research Shows

From the ranked CLI tools analysis:

- swaymsg uses unique domain verbs: focus, move, resize, kill (not rm)
- yabai uses unique domain verbs: --focus, --move, --resize, --close
- tmux uses unique verbs: send-keys, list-windows, select-window, kill-pane
- kubectl uses unique verbs: get, apply, describe, delete (not ls/mv/rm)
- wmctrl uses flags not verbs: -l (list), -r (target), -c (close), -a (activate)

NONE of them reuse Unix file-manipulation verbs. All of them invented their
own vocabulary. This is not an accident — it is because their domain (windows,
sessions, pods) is fundamentally different from files.

## Recommendation: Strategy B (Unique Domain Verbs)

Reasons:
1. Eliminates hallucination vectors entirely
2. Maps directly to CommandRegistry IDs (auto-generation is trivial)
3. Consistent with every successful CLI tool in our research
4. Self-documenting for agents who read --help output
5. The "ww" prefix already provides namespace isolation

The one concession to Unix familiarity: OUTPUT FORMAT.
- Default to JSON (like jq-friendly tools)
- Support --table for human readability
- Support --quiet/-q for one-ID-per-line (pipeable)
- Use stdout for data, stderr for errors (Unix convention)
- Use exit codes properly (0 success, 1 error, 2 not found)

This gives agents Unix PLUMBING without Unix VOCABULARY confusion.

## Specific Verb Choices

| Action | Recommended | Rejected alternatives | Why |
|--------|-------------|----------------------|-----|
| List windows | windows | ls, list | "windows" is a noun command (like kubectl get pods) |
| Show one window | window 3 | get, show, cat | "window" + ID is natural |
| Open something | open | new, create, spawn | "open" matches our registry (*.open commands) |
| Close a window | close | rm, kill, delete | "close" is what it does. Not destructive. |
| Move a window | move | mv, relocate | "move" is unambiguous |
| Resize a window | resize | scale, size | "resize" matches registry |
| Focus a window | focus | select, activate | "focus" matches registry |
| Desktop state | state | status, info | "state" matches /state endpoint |
| Screenshot | screenshot | capture, snap | "screenshot" matches registry |
| Run any command | cmd | run, exec | "cmd" is short, "exec" clashes with bash exec |
| Stream events | watch | tail, follow | "watch" is familiar but not conflicting |
| Change theme | theme | style | "theme" matches registry |
| Tile windows | tile | arrange, layout | "tile" matches registry |

## Open Question

Should `ww` support BOTH styles with aliases?

```bash
ww close 3        # canonical
ww rm 3           # alias (with deprecation warning?)
```

Probably not. Aliases create documentation confusion and double the surface
area for hallucination. Pick one vocabulary and commit to it.

## Related

- autoresearch/unix-control/REFERENCE_CLI_TOOLS_RANKED.md
- autoresearch/unix-control/devnote-parity-problem-single-source-of-truth-zod-schema-auto-derive-cli-http-api.md
- .planning/epics/e039-unix-cli-surface/e039-brief.md
