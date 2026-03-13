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

Key commands to study:
```bash
swaymsg -t get_tree              # full window hierarchy as JSON
swaymsg -t get_workspaces        # workspace list
swaymsg '[title="Firefox"] focus' # criteria-based window selection
swaymsg 'move container to workspace 3'
swaymsg -t subscribe '["window"]' # event stream (!)
```

What to steal:
- Criteria selectors: `[title="X"]`, `[app_id="Y"]` — we could do `[kind="editor"]`
- Event subscription via socket — maps to our `ww watch` concept
- Command chaining with semicolons: `focus left; move right`
- Machine-first JSON, human formatting in the wrapper

Repo: https://github.com/swaywm/sway (sway), https://github.com/i3/i3

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

Key commands to study:
```bash
yabai -m query --windows          # all windows as JSON array
yabai -m query --windows --window # focused window
yabai -m window --focus east      # directional focus
yabai -m window --move abs:100:200 # absolute move
yabai -m window --resize abs:800:600
yabai -m window --close
yabai -m space --layout bsp       # change layout mode
yabai -m signal --add event=window_created action='echo new window'
```

What to steal:
- Query subcommand pattern: `yabai -m query --windows` vs `yabai -m window --focus`
- Signal/event system for reactive automation
- The `--window` flag defaulting to focused window (no ID required for common case)
- Community scripting patterns as evidence of what agents will try to do

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
extremely complex state management (sessions, windows, panes, buffers) reliably
for decades. The architecture is identical to what we are building.

Key commands to study:
```bash
tmux list-windows -F '#{window_id} #{window_name} #{window_width}x#{window_height}'
tmux send-keys -t session:window.pane 'command' Enter
tmux capture-pane -t 0 -p          # capture pane content to stdout
tmux select-window -t :3            # focus window by index
tmux resize-pane -t 0 -x 80 -y 24
tmux display-message -p '#{session_name}'
```

What to steal:
- Target syntax: `-t session:window.pane` for addressing specific surfaces
- Format strings for flexible output without requiring jq
- `send-keys` pattern (we already use this via scripts)
- `capture-pane -p` piping content to stdout (maps to `ww screenshot`)

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

Key commands:
```bash
wmctrl -l                          # list windows (ID, desktop, title)
wmctrl -r "Firefox" -e 0,100,200,800,600  # move+resize by title
wmctrl -a "Terminal"               # activate (focus + raise)
wmctrl -c "Editor"                 # close by title
wmctrl -s 2                        # switch to desktop 2
```

What to steal:
- `-r` (target by title regex) is more ergonomic than numeric IDs
- Combined move+resize in one flag (`-e gravity,x,y,w,h`)
- Simple list format that greps well without jq

Repo: https://github.com/Conservatory/wmctrl (community fork)

---

### 5. xdotool (score: 16/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 3 | Text output, window IDs as integers, pipeable. |
| Agent fit | 3 | Verb-first grammar is natural. But X11-specific concepts leak through. |
| Architecture match | 2 | Synthetic input injection (mouse, keyboard). Different concern than our command dispatch. |
| Maturity | 4 | 3.5k stars, widely used in automation scripts. |
| Relevance | 4 | The `search` + `action` pattern is powerful and maps to our filter+act pipeline concept. |

Key commands:
```bash
xdotool search --name "Firefox"    # find windows by criteria → IDs to stdout
xdotool getactivewindow            # focused window ID
xdotool windowfocus 0x12345        # focus by ID
xdotool windowmove 0x12345 100 200
xdotool windowsize 0x12345 800 600
xdotool key ctrl+c                 # synthetic keypress
# Composition:
xdotool search --name "Editor" windowfocus  # search + act in one call
```

What to steal:
- `search` command that outputs IDs, then piped to action commands
- Chaining: `xdotool search --name X windowfocus` (find + act in one invocation)
- `getactivewindow` — simple "what am I looking at?" query

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

Why listed: jq is not a competitor but a design constraint. Every JSON
structure we output from `ww` must be jq-friendly:
- Arrays of objects (not nested trees) for `.[].field` access
- Consistent field names across commands
- IDs as top-level fields (not buried in nested objects)

What to steal:
- Design our JSON output to be jq-ergonomic
- Test every output format with common jq patterns
- Consider shipping a few built-in jq-like filters (`ww windows --field id`)

Repo: https://github.com/jqlang/jq

---

## Tier 3 — Niche / Partial References

### 7. herbstluftwm (herbstclient) (score: 14/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 4 | Simple text output, one value per line. |
| Agent fit | 3 | Command grammar is unusual but consistent. |
| Architecture match | 3 | X11 tiling WM with IPC. |
| Maturity | 3 | 2k stars, active but niche. |
| Relevance | 1 | Niche. But the "attribute tree" concept (every property is a path) is interesting. |

Interesting concept — attribute paths:
```bash
herbstclient attr clients.focus.title        # read attribute
herbstclient set_attr theme.active.color '#ff0000'  # write attribute
herbstclient list_monitors                   # list resources
```

What to steal:
- Attribute path model: `ww attr windows.3.title` — read any property as a path
- This is the Plan 9 /proc filesystem idea expressed as CLI

Repo: https://github.com/herbstluftwm/herbstluftwm

---

### 8. bspc (bspwm) (score: 14/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 4 | JSON queries, text commands. |
| Agent fit | 3 | Terse grammar takes learning. |
| Architecture match | 3 | Binary tree window layout + IPC socket. |
| Maturity | 3 | 7.7k stars but low recent activity. |
| Relevance | 1 | Layout model is too different. But the subscribe/event pattern is useful. |

Key pattern:
```bash
bspc subscribe node_add node_remove  # stream events
bspc query -N -n focused             # query focused node ID
bspc node -f east                    # focus directional
```

What to steal:
- Event subscription command that streams events (like `ww watch`)

Repo: https://github.com/baskerville/bspwm

---

### 9. aerospace (score: 13/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 4 | JSON output for queries. |
| Agent fit | 3 | Clean verb-noun grammar. |
| Architecture match | 3 | macOS tiling WM (like yabai but newer). |
| Maturity | 2 | New (2024), 8k stars, rapidly growing. |
| Relevance | 2 | Modern take but less battle-tested than yabai. |

Interesting: aerospace uses a TOML config with keybinding-to-command mapping,
similar to our command catalog concept.

Repo: https://github.com/nikitabobko/AeroSpace

---

### 10. wlr-randr / kanshi (score: 10/25)

| Axis | Score | Notes |
|------|-------|-------|
| Composability | 3 | Text output for display config. |
| Agent fit | 2 | Very narrow scope (display management). |
| Architecture match | 1 | Display/output management, not window management. |
| Maturity | 3 | Wayland ecosystem standard tools. |
| Relevance | 1 | Only relevant if we add multi-display support. |

Listed for completeness. These handle the layer below window management.

---

## Tier 4 — Non-WM Tools With Relevant CLI Patterns

### 11. Simon Willison's `llm` (score: N/A — different category)

Not a window manager but the best example of Unix philosophy applied to
AI tool interfaces. Every design decision is instructive:

```bash
llm "summarise this" < document.txt        # stdin as input
llm -m claude-3 "translate to French"      # model selection as flag
llm logs -n 5 --json                       # structured output
cat urls.txt | llm -m gpt-4 "classify"     # pipe composition
llm keys set openai                        # config management
llm plugins                                # extensibility
```

What to steal:
- stdin as implicit content input
- `-m` for model/mode selection
- `--json` as universal structured output flag
- Plugin system for extensibility
- `logs` subcommand for introspection

Repo: https://github.com/simonw/llm

---

### 12. kubectl (score: N/A — different category)

Not a window manager but the most sophisticated CLI-to-API bridge in
production. Key patterns:

```bash
kubectl get pods -o json                   # flexible output
kubectl get pods -o jsonpath='{.items[*].metadata.name}'  # inline query
kubectl apply -f manifest.yaml             # declarative state
kubectl describe pod my-pod                # human-friendly detail view
kubectl api-resources                      # runtime discovery
```

What to steal:
- `-o jsonpath` for inline filtering (alternative to piping through jq)
- `describe` as a human-friendly counterpart to JSON `get`
- `api-resources` for runtime command discovery
- `apply -f` for declarative state (maps to `ww workspace load file.json`)

Repo: https://github.com/kubernetes/kubernetes

---

## Summary: Design Influence Map

What `ww` should steal from each tool:

| Source | Pattern to steal |
|--------|-----------------|
| swaymsg | JSON-RPC over Unix socket. Criteria selectors. Event subscription. |
| yabai | Query/command split. Focused-window default. Signal system. |
| tmux | Target syntax. Format strings. capture-pane to stdout. |
| wmctrl | Title-based targeting. Combined move+resize. Simple list output. |
| xdotool | Search+act chaining. getactivewindow. |
| jq | Design output FOR jq consumption. Test with common jq patterns. |
| herbstclient | Attribute path model (Plan 9 style). |
| bspwm | Event subscription streaming. |
| llm | stdin as input. --json flag. Plugin extensibility. |
| kubectl | Output format flags. Runtime discovery. Declarative apply. |

## Proposed `ww` Command Grammar (Synthesised)

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
