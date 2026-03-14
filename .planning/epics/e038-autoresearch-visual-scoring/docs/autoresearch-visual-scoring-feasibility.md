# Autoresearch with Visual/LLM Scoring — Feasibility Study

Date: 2025-03-13
Updated: 2025-03-13

## TL;DR

Yes, it is doable. Two viable architectures exist. Both are confirmed
working in proof-of-concept. The main trade-off is cost vs objectivity.

---

## Key Files Reference

### Autoresearch Extension (pi-autoresearch)

Source: `~/.pi/agent/git/github.com/davebcn87/pi-autoresearch/extensions/pi-autoresearch/index.ts`

| Line(s)  | What                                | Why it matters                              |
|----------|-------------------------------------|---------------------------------------------|
| 815-876  | `init_experiment` registerTool      | Sets metric name, unit, direction. Call once per session. |
| 898-1110 | `run_experiment` registerTool       | Runs command, times it, captures stdout/stderr as `tailOutput`. Exit code determines pass/crash. |
| 941-968  | Checks flow inside run_experiment   | If `autoresearch.checks.sh` exists, runs it after a passing benchmark. `checksPass` bool gates `keep`. |
| 1113-1280| `log_experiment` registerTool       | Agent provides `metric` (number) and `status` (keep/discard/crash/checks_failed). `keep` auto-commits via git. `discard`/`crash` reverts. |
| 1123     | Auto-commit on keep                 | `git add -A && git commit` — agent must NOT commit manually before calling log_experiment. |
| 1133     | Checks gate on keep                 | If checks failed, `keep` is rejected and forced to `checks_failed`. |
| 1206-1210| Metric comparison                   | Uses `isBetter()` (L184) to compare against baseline. Agent decides keep/discard but extension shows delta. |
| 483-490  | `autoresearchExtension` entry       | Main export. Sets up state, tools, widget, context injection. |
| 787-790  | Context injection (before_agent_start) | Injects autoresearch.md content + tool instructions into agent system prompt every turn. |
| 241-475  | `renderDashboardLines`              | Pure function rendering the experiment dashboard table (Ctrl+X toggle). |

KEY INSIGHT (L1113-1130): The agent manually provides the `metric` number
to `log_experiment`. The extension does NOT parse METRIC lines from stdout.
This means the metric can come from anywhere — the agent's own judgement,
an external scorer, a parsed file, anything. This is what makes visual
scoring possible without modifying the extension.

### Skill Definition

`~/.pi/agent/git/github.com/davebcn87/pi-autoresearch/skills/autoresearch-create/SKILL.md`

Defines the loop rules, setup process, autoresearch.md/autoresearch.sh
templates, and the "never stop" loop contract.

### WibWob-DOS Screenshot & Restart Scripts

| File                          | What                                              |
|-------------------------------|---------------------------------------------------|
| `scripts/capture-tui-png.sh` | macOS screencapture to PNG. Flags: `--display N`, `--out path`, `--list-displays`. Only valid if TUI is visible on that display. |
| `scripts/restart.sh`         | SIGTERM old process, wait for clean exit, launch via tmux send-keys, poll `/health` until ready. Returns new session ID. |
| `scripts/screenshot-window.sh` | Text-mode crop of a single window (not PNG). |
| `scripts/minimap.sh`         | Spatial ASCII overview of all open windows. |

### Pi Read Tool (image support)

Pi's built-in `Read` tool supports images: jpg, png, gif, webp. Images
are sent as attachments at reduced resolution (e.g. 5120x2880 displayed
at 2000x1125). This is how the self-scoring agent sees the screenshot.

---

## The Idea

Use autoresearch to optimise how "good" a TUI looks, where "good" is
scored by an LLM looking at a screenshot of the running app. The loop:

1. Agent makes UI changes (layout, theme, content, module tweaks)
2. App restarts in tmux
3. Screenshot captured as PNG
4. LLM scores the screenshot 1-10
5. Score becomes the primary metric in autoresearch
6. keep/discard based on whether score improved

---

## Confirmed Working Pieces

### Screenshot capture
- `scripts/capture-tui-png.sh` — macOS screencapture to PNG
- Needs correct `--display N` flag (display 2 was wrong in test, got blank VS Code)
- Output: 5120x2880 PNG, ~350KB, takes <1s
- CAVEAT: only works if tmux-attached TUI is visible on that display

### Image reading by pi agent (this agent)
- pi's `Read` tool supports images (jpg, png, gif, webp)
- Images sent as attachments, displayed at reduced resolution
- Confirmed: Read tool on PNG works, image visible in context

### Image scoring by claude -p (external scorer)
- `claude -p "score this" --allowedTools "Read" --dangerously-skip-permissions`
- Confirmed working: claude reads PNG via Read tool, outputs SCORE=N
- Latency: ~12 seconds per scoring call
- Cost: one API call per experiment iteration

### Metric flow in autoresearch
- run_experiment just runs a command, times it, captures stdout
- The AGENT provides the metric value manually in log_experiment
- No METRIC line parsing from stdout — agent decides the number
- This means the agent can score images itself OR read a score from autoresearch.sh

---

## Two Architectures

### Architecture A: External Scorer (claude -p in autoresearch.sh)

```
autoresearch.sh:
  1. bash scripts/restart.sh          # restart app in tmux
  2. sleep 2 && curl /health           # wait for ready
  3. screencapture to /tmp/shot.png    # capture display
  4. claude -p "score this UI" \       # LLM-as-judge
       --allowedTools "Read" \
       --dangerously-skip-permissions
  5. parse SCORE=N from output
  6. echo "METRIC ui_score=$N"         # pi agent reads this
```

Pi agent reads METRIC line from run_experiment output, passes to log_experiment.

PROS:
- Clean separation: creator agent != scorer agent
- Less bias (separate context, no memory of what it changed)
- autoresearch.sh is self-contained, any agent can run the loop
- Scoring prompt can be tuned independently

CONS:
- ~12s extra per iteration (claude -p call)
- Extra API cost per experiment (one full claude call per iteration)
- claude -p has no memory/consistency across calls
- Scoring criteria must be fully specified in the prompt each time
- Two separate Claude billing contexts

### Architecture B: Self-Scoring (pi agent uses Read tool)

```
autoresearch.sh:
  1. bash scripts/restart.sh
  2. sleep 2 && curl /health
  3. screencapture to scratch/current-screenshot.png
  4. exit 0  (no scoring — agent does it)
```

Then in the autoresearch loop, after run_experiment:
```
  pi agent calls Read("scratch/current-screenshot.png")
  pi agent sees the image in its own context
  pi agent decides score 1-10
  pi agent calls log_experiment with that score
```

PROS:
- No extra API calls (scoring is part of the agent's normal turn)
- Agent has full context: what it changed, why, what it expected
- Faster (no 12s claude -p overhead)
- Agent can give richer reasoning about the score
- Can use secondary metrics (layout_balance, colour_harmony, etc.)

CONS:
- Self-grading bias: the agent scores its own work
- Context window fills up with images over many iterations
- Agent might anchor to previous scores
- Less reproducible (scoring depends on agent's current context)

---

## Recommended Architecture: B (Self-Scoring) with Calibration

Architecture B is simpler, faster, cheaper, and more practical. The bias
concern is real but manageable:

### Mitigations for self-scoring bias

1. RUBRIC: Define explicit scoring criteria in autoresearch.md so the
   agent grades against a fixed rubric, not vibes
2. BASELINE IMAGE: Keep the initial screenshot as a reference point.
   Agent compares current vs baseline each time.
3. PERIODIC EXTERNAL AUDIT: Every N iterations, run Architecture A as
   a checks step (autoresearch.checks.sh) to cross-validate
4. SECONDARY METRICS: Track sub-scores (layout, colour, readability)
   to force granular rather than holistic scoring

---

## Modifications Needed to Autoresearch

### No code changes to the extension needed

The extension already supports this pattern because of how `log_experiment`
works (index.ts L1113-1130): the agent provides the metric value, not the
benchmark script. Specifically:

- `run_experiment` (L898) runs any command and captures output — our
  screenshot script just needs to exit 0 with a PNG on disk
- `log_experiment` (L1113) accepts any numeric `metric` from the agent —
  the agent reads the PNG via pi's `Read` tool, scores it, passes the number
- The `isBetter()` function (L184) compares against baseline automatically
- Auto-commit on `keep` (L1237-1248) and revert on `discard` (L1275) work
  as normal — code changes get committed or rolled back
- `checksPass` gate (L1133) still works if we add `autoresearch.checks.sh`
  for typecheck validation
- Image `Read` is already a pi tool — no new tools needed

### What needs to be created

1. `autoresearch.sh` — launches app, waits for health, captures screenshot
2. `autoresearch.md` — defines the objective, rubric, scoring criteria
3. `autoresearch.checks.sh` (optional) — typecheck + optional external score audit

### autoresearch.sh sketch

```bash
#!/bin/bash
set -euo pipefail

SCREENSHOT_PATH="scratch/autoresearch-screenshot.png"
DISPLAY_NUM="${DISPLAY_NUM:-1}"

# Pre-check: typecheck the changes
bun run typecheck 2>&1 | tail -5

# Restart the app
bash scripts/restart.sh

# Wait for health
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Let the UI settle (animations, primer loading, etc.)
sleep 3

# Capture screenshot
./scripts/capture-tui-png.sh "$SCREENSHOT_PATH" --display "$DISPLAY_NUM"

echo "Screenshot saved to $SCREENSHOT_PATH"
echo "Agent should Read this file and score it."
```

### Scoring rubric sketch (for autoresearch.md)

Score the TUI screenshot on these axes (each 1-10, average = primary metric):

- LAYOUT: Window arrangement, use of space, balance, no overlaps
- READABILITY: Text legibility, appropriate contrast, clear hierarchy
- AESTHETIC: Colour harmony, visual interest, "does it look good?"
- COHERENCE: Does it feel like one designed thing, not random windows?
- CHARACTER: Does it feel like WibWob-DOS? Personality, charm, weirdness?

---

## Open Questions

1. WHICH DISPLAY? RESOLVED: Display 2 (laptop built-in). Confirmed
   via dual-capture test 2025-03-13.

2. WHAT IS BEING OPTIMISED? RESOLVED: LLM Orch Studio window only.
   File in scope: `microapps/llm-orch-studio/index.ts`.
   See section "Additions" item 7 for full scoping.

3. SCORING CONSISTENCY: LLMs are notoriously inconsistent at numeric
   scoring. Strategies: use relative comparison ("better or worse than
   baseline?") instead of absolute scores. Or use binary keep/discard
   with the agent explaining WHY.

4. COST: Each iteration that uses claude -p for external scoring costs
   an API call. At 12s per call and ~100 iterations, that is 20 minutes
   of scoring time plus API costs. Self-scoring (Arch B) avoids this.

5. TMUX VISIBILITY: screencapture requires the tmux pane to be visually
   displayed on a macOS screen. If running headless or on a hidden
   display, this breaks. Alternative: tmux capture-pane gives text-only
   (no colours/visual fidelity) but works headless.
   CONFIRMED: Display 2 = laptop built-in screen = where Ghostty/iTerm2
   runs the TUI. Display 1 = external monitor = VS Code/pi.

6. TEXT-ONLY ALTERNATIVE: Instead of PNG screenshots, use tmux
   capture-pane -p for a text dump. Less visual fidelity but:
   - Works headless
   - Much smaller context (text vs image tokens)
   - Faster
   - Agent can "see" actual characters and layout
   - Loses colour/visual styling information

---

## Next Steps (if proceeding)

1. ~~Decide the optimisation target~~ DONE: LLM Orch Studio (item 7)
2. ~~Confirm correct display number~~ DONE: Display 2
3. Write autoresearch.md with full rubric (use items 1-6 above)
4. Write autoresearch.sh (display 2, fixed tmux geometry, screenshot)
5. Write autoresearch.checks.sh (typecheck + module-load verify, item 4)
6. init_experiment with metric "ui_score", direction "higher"
7. Capture baseline screenshot, store as reference (item 6)
8. Run baseline scoring, start looping

---

## Cost Estimate

Per iteration (Architecture B, self-scoring):
- restart.sh: ~5s
- health wait: ~2s
- screenshot: ~1s
- Agent scoring (part of normal turn): ~0s extra
- Total overhead: ~8s per iteration

Per iteration (Architecture A, external scorer):
- All the above plus claude -p: ~12s
- Total overhead: ~20s per iteration
- Extra API cost: ~$0.01-0.05 per call depending on model

---

## Extension Method Call Flow (for reference)

```
Agent turn starts
  → before_agent_start injects autoresearch.md into context (L787)
  → Agent reads code, makes changes to files
  → Agent calls run_experiment(command="./autoresearch.sh")
    → Extension spawns shell process (L898-940)
    → Command runs: restart app, capture screenshot
    → If exit 0 AND autoresearch.checks.sh exists:
        → Extension runs checks (L941-968)
        → checksPass = true/false stored
    → Extension returns: { passed, tailOutput, durationSeconds, checksPass }
  → Agent uses Read("scratch/autoresearch-screenshot.png") to see result
  → Agent scores the image (self-scoring) or reads SCORE from tailOutput (external)
  → Agent calls log_experiment(metric=score, status="keep"|"discard", ...)
    → Extension compares metric via isBetter() (L184, L1206)
    → If keep: git add -A && git commit (L1237-1248)
    → If discard/crash: no commit, agent should git checkout (L1275)
    → Result appended to autoresearch.jsonl (L1278)
    → Dashboard updated (renderDashboardLines, L241)
  → Agent loops: next change, next run_experiment, next score...
```

---

## Additions: Giving the Agent a Fair Chance

Things missing from the above that the autoresearch agent needs to
produce meaningful UI improvements and consistent scores.

### 1. SDK component catalogue in scoring context

The scorer cannot judge implementation quality without knowing what
SDK components exist. "You used a raw blessed box where
createKeyValuePanel would be better" requires knowing createKeyValuePanel
exists. The autoresearch.md must include or reference the SDK component
families table.

Source: `.agents/microapp-dev/sdk-reference.md` (Component families table,
Forms section, Data Display section, Navigation section, Feedback section)

### 2. Terminal-adapted design principles

The Anthropic frontend-design skill has excellent aesthetic principles
but they are web-native. Terminal UI needs an adapted version:

- TYPOGRAPHY: figlet font choices, alignment, spacing between sections
- COLOUR: theme token usage (never hardcoded), contrast within the
  16-colour palette, muted vs accent hierarchy
- COMPOSITION: createStack/createRow/createGrid for layout, responsive
  breakpoints via pickBreakpoint, information density per character cell
- RHYTHM: consistent gutters, deliberate whitespace, visual breathing room
- DISTINCTIVENESS: does it feel crafted or scaffolded? personality, not polish

Source: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
Adapt the "Design Thinking" and "Frontend Aesthetics Guidelines" sections
for blessed/terminal constraints (no real fonts, no gradients, character
cells, scrollbar quirks, theme tokens not CSS variables).

### 3. Fixed tmux geometry

If tmux geometry varies between runs, screenshots are not comparable.
Lock it before each capture:

```bash
tmux resize-window -t wibwob -x 230 -y 62
```

Or create with fixed size:

```bash
tmux new-session -d -s wibwob -x 230 -y 62 'bun run start'
```

### 4. Module-load verification in checks

autoresearch.checks.sh must not just typecheck. It must confirm the
module actually loaded and the window can be opened:

```bash
#!/bin/bash
set -euo pipefail

# Typecheck
bun run typecheck 2>&1 | grep -i error || true

# Confirm module loaded — open the window, check /state
curl -sf http://127.0.0.1:8099/commands/run \
  -X POST -H 'Content-Type: application/json' \
  -d '{"command":"llm-orch-studio.open"}' > /dev/null

sleep 1

# Verify window exists in state
curl -sf http://127.0.0.1:8099/state | grep -q "LLM Orch Studio" \
  || { echo "ERROR: LLM Orch Studio window not found in /state"; exit 1; }
```

A module that typechecks but crashes on import is a silent failure.
The checks script catches this.

### 5. Scoring granularity to reduce noise

Self-scoring is noisy if holistic. Force granularity by requiring
per-axis sub-scores in the rubric:

```
Score each axis 1-10, then average for the primary metric:
  LAYOUT:      [1-10]  — use of space, balance, no dead zones
  READABILITY: [1-10]  — text legibility, contrast, hierarchy
  AESTHETIC:   [1-10]  — colour harmony, visual interest
  COHERENCE:   [1-10]  — feels like one designed thing
  CHARACTER:   [1-10]  — personality, charm, WibWob-ness

ui_score = average of all five
```

Track sub-scores as secondary metrics in log_experiment so the
dashboard shows which axes improved or degraded.

### 6. Reference examples for calibration

The scorer benefits from seeing what good looks like. Include in
autoresearch.md:

- Path to baseline screenshot (captured before any changes)
- Names of well-designed modules to study for patterns:
  `microapps/demo-e026-demo/` (SDK sampler, many component patterns),
  `microapps/dashboard-xxl/` (figlet + grid + animation),
  `microapps/demo-wibwob-poetry-clock/` (AI integration, modes, snapshot)

The agent should Read these module source files before its first
iteration to calibrate its sense of "good terminal UI".

### 7. Scoping the optimisation target

For this specific run: optimise the rendering and layout of the
LLM Orch Studio window ONLY. Not theme files, not desktop arrangement,
not other modules.

- Files in scope: `microapps/llm-orch-studio/index.ts`
- Window title to screenshot: "LLM Orch Studio"
- Score what THIS window looks like, not the whole desktop
- Use `scripts/screenshot-window.sh "LLM Orch Studio"` for text crop
  alongside the PNG for dual-mode scoring (visual + structural)

### Reference Links

- pi-autoresearch skill: `~/.pi/agent/git/github.com/davebcn87/pi-autoresearch/skills/autoresearch-create/SKILL.md`
- pi-autoresearch extension: `~/.pi/agent/git/github.com/davebcn87/pi-autoresearch/extensions/pi-autoresearch/index.ts`
- Anthropic frontend-design skill: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
- SDK reference (component catalogue): `.agents/microapp-dev/sdk-reference.md`
- Module examples by tier: `.agents/microapp-dev/examples-by-tier.md`
- WibWob-DOS screenshot scripts: `scripts/screenshot-window.sh`, `scripts/capture-tui-png.sh`
- WibWob-DOS restart: `scripts/restart.sh`
