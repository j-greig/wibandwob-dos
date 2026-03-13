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

### 1. swaymsg / i3-msg — 23/25
Solved our exact problem: scriptable local WM control via JSON-RPC over Unix
socket with a thin CLI wrapper. Nearly identical architecture to WibWob-DOS.
15+ year track record (i3), active Wayland port (sway).

Key patterns: `swaymsg -t get_tree` (JSON), `'[title="X"] focus'` (criteria),
`-t subscribe '["window"]'` (event stream).

### 2. yabai — 22/25
macOS-native proof that CLI window control works. Designed for scripting,
JSON output, large automation community. Focused-window default (no ID needed
for common case) is an ergonomic win.

Key patterns: `query --windows` (JSON array), `window --focus east` (directional).

### 3. tmux — 21/25
Proves local socket + CLI client handles complex state (sessions, windows,
panes, buffers) reliably for 20+ years. Same client-server architecture as ours.

Key patterns: `-t session:window.pane` targeting, `-F` format strings,
`capture-pane -p` (content to stdout).

---

## Tier 2 — Useful Pattern References

### 4. wmctrl — 17/25
The original "control windows from CLI" tool. Title-based targeting (`-r`),
combined move+resize (`-e`), simple greppable list (`-l`). Unmaintained since
2012 but still works — testament to Unix tool longevity.

### 5. xdotool — 16/25
Search+act chaining pattern: `search --name "Firefox" windowfocus`. The
`getactivewindow` query maps to our focused-window concept.

### 6. jq — 15/25 (design constraint, not competitor)
Every JSON structure from `ww` must be jq-friendly: arrays of objects,
consistent field names, IDs as top-level fields. LLMs write jq filters
confidently (massive training data).

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
