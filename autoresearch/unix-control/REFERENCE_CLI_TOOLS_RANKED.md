# Reference CLI Tools: Ranked for WibWob-DOS Design Influence

Ranked list of Unix-style CLI tools that control desktop, window, or session
state — evaluated as design references for the `ww` command (E039).

Ranking criteria:
- COMPOSABILITY: How well does output pipe to other tools?
- AGENT FIT: How naturally would an LLM use this tool?
- ARCHITECTURE MATCH: How close is the system model to WibWob-DOS?
- MATURITY: Track record, community, maintenance.
- RELEVANCE: How much can we directly steal from this design?

Scale: 1-5 per axis. Total out of 25.

---

## Tier 1 — Primary Design References

### 1. swaymsg / i3-msg (score: 23/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 5 | All output is JSON. Pipes to jq trivially. |
| Agent fit | 5 | Atomic commands, clear verbs, JSON responses. |
| Architecture match | 5 | Local window manager with command registry + IPC socket. Nearly identical model to WibWob-DOS. |
| Maturity | 4 | i3: 15+ years, 10.2k stars. sway: active, Wayland-native. |
| Relevance | 4 | JSON-RPC over Unix socket is our target transport. Command grammar is close to what we want. |

Why #1: sway/i3 solved exactly our problem — exposing a local window manager
to scriptable control. Their JSON-over-socket protocol with a thin CLI wrapper
(swaymsg) is the direct architectural template for `ww`.

Key patterns: `swaymsg -t get_tree` (JSON hierarchy), `swaymsg '[title="Firefox"] focus'`
(criteria selectors), `swaymsg -t subscribe '["window"]'` (event stream).
Repos: https://github.com/swaywm/sway, https://github.com/i3/i3

---

### 2. yabai (score: 22/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 5 | JSON output, designed for jq pipelines. |
| Agent fit | 5 | Explicitly designed for scripting and automation. |
| Architecture match | 4 | macOS window manager (closer to our platform) but uses Accessibility API, not custom renderer. |
| Maturity | 4 | 7.8k stars, active development, large scripting community. |
| Relevance | 4 | Command grammar and JSON output format are directly reusable patterns. |

Why #2: yabai is the macOS-native proof that CLI window control works. Its
community builds complex automation scripts that are exactly the kind of
agent workflows we want to enable.

Key patterns: `yabai -m query --windows` (JSON array), `yabai -m window --focus east`
(directional), `--window` defaulting to focused (no ID for common case).
Repo: https://github.com/koekeishiya/yabai

---

### 3. tmux (score: 21/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 4 | Format strings (-F) are powerful but idiosyncratic. Not pure JSON. |
| Agent fit | 4 | Agents already use tmux heavily (it is in our own workflow). Verb-noun grammar is natural. |
| Architecture match | 5 | Client-server over Unix socket. Server holds state, client sends commands. This IS our model. |
| Maturity | 5 | 20+ years, ubiquitous, battle-tested at massive scale. |
| Relevance | 3 | Session/pane model is less relevant than window model, but the IPC pattern is gold. |

Why #3: tmux proves that a local socket server with a CLI client can handle
extremely complex state management reliably for decades. Same architecture as ours.

Key patterns: `-t session:window.pane` target syntax, `-F` format strings,
`capture-pane -p` (piping content to stdout — maps to `ww screenshot`).
Repo: https://github.com/tmux/tmux

---

## Tier 2 — Useful Pattern References

### 4. wmctrl (score: 17/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 4 | Text output, one window per line, greppable. |
| Agent fit | 3 | Simple but limited flag vocabulary. |
| Architecture match | 3 | X11-specific, uses EWMH protocol. Different layer but same concept. |
| Maturity | 3 | Stable but essentially unmaintained. Last release 2012. Still works. |
| Relevance | 4 | The original "control windows from command line" tool. Vocabulary is well-known to LLMs. |

Key patterns: `-r "Firefox"` (target by title regex), `-e 0,x,y,w,h`
(combined move+resize), `-l` (simple greppable list).
Repo: https://github.com/Conservatory/wmctrl

---

### 5. xdotool (score: 16/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 3 | Text output, window IDs as integers, pipeable. |
| Agent fit | 3 | Verb-first grammar is natural. But X11-specific concepts leak through. |
| Architecture match | 2 | Synthetic input injection (mouse, keyboard). Different concern than our command dispatch. |
| Maturity | 4 | 3.5k stars, widely used in automation scripts. |
| Relevance | 4 | The `search` + `action` pattern is powerful and maps to our filter+act pipeline concept. |

Key patterns: `search --name "Firefox" windowfocus` (search + act chaining),
`getactivewindow` (focused window query).
Repo: https://github.com/jordansissel/xdotool

---

### 6. jq (score: 15/25 — different category but essential companion)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 5 | THE pipe companion tool. Defines the standard. |
| Agent fit | 4 | LLMs write jq filters confidently. Massive training data. |
| Architecture match | 1 | Not a window manager. JSON processor. |
| Maturity | 5 | Ubiquitous. 30k+ stars. |
| Relevance | 5 | Our JSON output will be consumed via jq. Design output FOR jq. |

Why listed: jq is a design constraint, not a competitor. Every JSON structure
from `ww` must be jq-friendly: arrays of objects, consistent field names,
IDs as top-level fields.
Repo: https://github.com/jqlang/jq

---

## Tier 3-4 — Additional References (Compressed)

| Tool | Score | Key Pattern to Steal |
|------|-------|---------------------|
| herbstclient | 14/25 | Attribute path model: `attr clients.focus.title` (Plan 9 as CLI) |
| bspc (bspwm) | 14/25 | Event subscription: `bspc subscribe node_add` (maps to `ww watch`) |
| aerospace | 13/25 | TOML config with keybinding-to-command mapping |
| wlr-randr | 10/25 | Display management only — irrelevant unless multi-display |
| llm (Willison) | N/A | stdin as input, `--json` flag, plugin extensibility |
| kubectl | N/A | `-o jsonpath` inline filtering, `api-resources` runtime discovery, `apply -f` declarative state |

---

## Naming Strategy: Unique Domain Verbs (Not Unix Aliases)

Decision: use domain-specific verbs (close, move, focus) not Unix file
verbs (rm, mv, cat). Reasons:

1. Eliminates hallucination — LLMs won't confuse `ww move` with `mv`
2. Maps directly to CommandRegistry IDs (auto-generation is trivial)
3. Every ranked tool above uses domain verbs, not Unix file verbs
4. The `ww` prefix already provides namespace isolation

Output format follows Unix conventions: JSON to stdout, errors to stderr,
exit codes (0 success, 1 error), `--quiet` for one-ID-per-line piping.

| Action | Verb | Rejected | Why |
|--------|------|----------|-----|
| List windows | windows | ls | Noun command like `kubectl get pods` |
| Show one window | window ID | cat | ID is natural |
| Open | open | new, spawn | Matches registry |
| Close | close | rm, kill | Not destructive |
| Move | move | mv | Unambiguous |
| Resize | resize | scale | Matches registry |
| Focus | focus | select | Matches registry |
| Desktop state | state | status | Matches /state endpoint |
| Run command | cmd | exec | "exec" clashes with bash |
| Stream events | watch | tail | Familiar, not conflicting |

No aliases. One vocabulary, one surface area.

---

## Proposed `ww` Command Grammar (Synthesised from Above)

Drawing from the best patterns above:

```
ww <noun> [<verb>] [<target>] [--flags]

Nouns:       windows, window, theme, workspace, command, overlay, screenshot
Verbs:       list, get, open, close, move, resize, focus, set, watch, pipe
Targets:     <id>, --title "X", --kind editor, --focused (default)
Output:      --json (default), --table, --quiet, --format "template"
```

Examples mapping to ranked tools:

```bash
# swaymsg-inspired: criteria selection
ww window --kind editor close          # close all editors
ww window --title "Primer*" focus      # focus by title glob

# yabai-inspired: focused-window default
ww window resize --w 80 --h 30        # resize focused window (no ID needed)
ww window move --x 0 --y 0            # move focused to origin

# tmux-inspired: format strings
ww windows --format '{id} {title} {w}x{h}'

# xdotool-inspired: search + act
ww windows --kind editor --quiet | xargs -I{} ww window {} close

# kubectl-inspired: declarative state
ww workspace apply layout.json

# llm-inspired: stdin as content
echo "HELLO WORLD" | ww open figlet --stdin
cat art.txt | ww open primer --stdin
```
