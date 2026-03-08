# Agent + Human Dual-Track Model

How an AI agent and a human companion co-inhabit WibWob-DOS — what each can see,
what each can do, and how the two tracks interlock.

---

## The two tracks

```
AGENT TRACK                           HUMAN TRACK
──────────────────────────────        ──────────────────────────────
reads wibwobdos SKILL.md              opens SSH tunnel or browser URL
runs connect.sh → sets WIBWOB_API     sees live TUI in xterm.js
calls scripts/* → HTTP API :8099      watches windows open/change
reads state, opens windows            reads agent chat window
sends input, reads content            types back in chat
posts screenshots to Discord          checks Discord for shares
                                      reads logs if something breaks
```

Both tracks run simultaneously. By convention the agent drives — but this is a
workflow default, not a runtime privilege. Both tracks have equal API access.
The human can take over at any point by typing in the chat window or calling the
API directly.

---

## Canon rule: scripts vs raw API

The `scripts/*` wrappers are convenience shells around the HTTP control API.
The real source of truth is the API + command registry at `$WIBWOB_API`.

Rule: **use wrapper scripts for common hosted flows; fall back to raw API only when
a wrapper does not cover the task.** Do not invent parallel patterns — the scripts
and the API must stay in sync or agents fragment.

If a script behaves unexpectedly, check the raw API response first:
```bash
curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" "$WIBWOB_API/state"
curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" "$WIBWOB_API/commands/list"
```

---

## Agent stories

### AS-1: Cold start from skill

Agent receives a task. It has the `wibwobdos` skill injected.

1. Reads `SKILL.md` — learns the connect/state/open/send/export/screenshot pattern.
2. Runs `eval "$(bash scripts/connect.sh)"` — establishes SSH tunnel, sets `WIBWOB_API`,
   confirms `/health` responds with correct `deployProfile` and `sessionId`.
3. Runs `bash scripts/state.sh` — reads live desktop: what windows are open, their IDs,
   focus, positions. Gets real window IDs (never guesses).
4. Runs `bash scripts/open.sh --list` — sees every available command with description.
   Picks the right one for the task.
5. Proceeds with the task using `open.sh`, `send.sh`, `export.sh` as building blocks.

**What can break:** SSH key not provisioned, `WIBWOB_SSH_KEY` not set, profile not loaded
(check `deployProfile` in health response — if null when a profile is expected, stop).

---

### AS-2: Opening and reading a window

Agent wants to see WibWobWorld terrain.

1. `bash scripts/open.sh microapp.wibwobworld.open`
2. `bash scripts/state.sh` — finds new window ID, e.g. `win-4`
3. Poll until ready — do NOT sleep arbitrarily:
```bash
for i in $(seq 1 20); do
  RESP=$(curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" \
    "$WIBWOB_API/windows/text?id=win-4")
  OK=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok','false'))")
  TEXT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('text',''))" 2>/dev/null)
  [[ "$OK" == "True" && -n "$TEXT" ]] && break
  sleep 0.5
done
```
  Ready signal: `ok === true` AND `text` is non-empty. No ready field exists — this is the only poll target.
4. `bash scripts/export.sh win-4` — reads text content.
5. Optionally: `bash scripts/png.sh win-4 world.png` — captures as PNG.

---

### AS-3: Sending a message to the agent chat

Agent wants to communicate something to Wib & Wob (or inject a user message).

1. `bash scripts/state.sh` — finds the agent chat window ID.
2. `bash scripts/send.sh <chat-window-id> "Hello from external agent"`
3. Reads response: `bash scripts/export.sh <chat-window-id>` after a few seconds.

---

### AS-4: Sharing a screenshot to Discord

Agent completes a visual task and wants to share the result.

1. `bash scripts/png.sh [window-id] output.png` — renders TUI cell-by-cell to PNG.
2. `bash scripts/discord.sh png output.png` — posts to configured Discord webhook.

Or: `bash scripts/discord.sh both` — posts minimap + full PNG in one call.

---

### AS-5: Verifying hosted command availability (after deploy)

Agent wants to confirm capability profile is active and only safe commands are exposed.

```bash
curl -s "$WIBWOB_API/health"                        # check deployProfile field
curl -s -H "Authorization: Bearer $TOKEN" "$WIBWOB_API/commands/list" \
  | python3 -c "import json,sys; cmds=json.load(sys.stdin)['commands']; \
    print(len(cmds), 'commands'); \
    [print('UNAVAIL', c['id']) for c in cmds if not c.get('available', True)]"
```

If `deployProfile` is null when expected → stop, alert human, do not proceed.
If `chrome.open` or `monster_cam.open` appear as available → profile not loaded correctly.

---

### AS-6: Full gate run (smoke verification)

Agent runs after every deploy to confirm 8 gates pass:

```bash
bash scripts/connect.sh              # Gate 1+2: SSH key auth, password blocked
curl -s $WIBWOB_API/health           # Gate 4: health with deployProfile
curl -H "Authorization: Bearer $TOKEN" $WIBWOB_API/commands/list   # Gate 6
bash scripts/open.sh microapp.wibwobworld.open && sleep 4           # Gate 7
bash scripts/state.sh | python3 -c "..."   # verify window appeared
```

---

## Human companion stories

### HS-1: Watching the agent work in real time

Human wants to see what the agent is doing on the desktop as it happens.

```bash
ssh -N -L 17681:127.0.0.1:7681 -p 2849 root@89.167.18.207
```

Open `http://localhost:17681` in browser → live xterm.js TUI. Every window the
agent opens, every cursor move, every render update — visible in real time.

**Proper hosted path (when Caddy is set up):**
`https://dos.wibandwob.com` → basic-auth password → same live view.

---

### HS-2: Watching without interfering

Human wants to observe but not accidentally type into the TUI.

Browser ttyd is `--writable` and tmux prefix keybindings are stripped (SEC-C1 fix),
so `Ctrl-b c` and tmux escape sequences do nothing. However: this is still a live
interactive input surface. Normal keystrokes reach the blessed TUI. The human can
perturb the TUI — type in the wrong window, dismiss dialogs, move focus. Reduced
shell escape risk, not zero-input isolation.

**Future:** read-only browser view mode (separate ttyd endpoint, `--readonly`,
different URL) — not yet built.

---

### HS-3: Checking the Discord feed

Agent has been running. Human wants a summary of what happened without SSH-ing in.

Agent posts screenshots to Discord via `discord.sh`. Human reads the Discord channel:
- Minimap shows spatial layout of all open windows
- Full PNG shows rendered TUI state
- Message includes timestamp, sessionId, deployed instance label

---

### HS-4: Checking logs when something went wrong

Human sees the agent failed silently. Where to look:

```bash
# PRIMARY: structured app log — APP/CMD/MSG/SYS/API/ERR categories, one file per day
# This is where command runs, window events, API calls, and errors land.
docker exec wibwob-smoke cat /opt/wibandwob-dos/logs/tui-app/$(date +%Y-%m-%d).log

# STARTUP ONLY: stderr captures profile load warnings, token generation, pre-logger errors
docker exec wibwob-smoke cat /opt/wibandwob-dos/scratch/app-stderr.log

# CONTAINER: entrypoint, sshd, ttyd events
docker logs wibwob-smoke --tail 50

# DIRECT SYSTEMD DEPLOY:
journalctl -u wibwob-dos -n 100 --no-pager
```

Log categories in `logs/tui-app/YYYY-MM-DD.log`:
| Tag | Content |
|-----|---------|
| `APP` | Lifecycle — startup, shutdown, theme change |
| `CMD` | Command registry — run, unknown command |
| `MSG` | Agent messages — inbound user/sender text |
| `SYS` | System ops — prompt reload, session init |
| `API` | Control API — POST requests |
| `ERR` | Failures |

---

### HS-5: Handing off to a different agent mid-session

Human wants to swap which agent is driving, without restarting the desktop.

1. Note the current `sessionId` from `/health` — desktop state is tied to this.
2. New agent reads SKILL.md, runs `connect.sh` → same `WIBWOB_API`.
3. Runs `state.sh` → sees exactly what the previous agent left open.
4. Continues from there — no restart needed, state persists.

The `sessionId` changes only on app restart. Desktop layout, open windows, scratch
state all survive agent handoffs as long as the container is running.

**Port continuity ≠ session continuity.** The tunnel port (e.g. 19099) stays the same
across app restarts, but `sessionId` changes. A new agent connecting to the same port
after a restart will see a fresh desktop, not the previous one. Always check `sessionId`
in `/health` when resuming a handoff — if it changed, the desktop was reset.

---

## What the logs capture

| Event | Captured where |
|-------|---------------|
| App startup + profile load | `scratch/app-stderr.log` |
| Control API token source | `scratch/app-stderr.log` |
| Every command run via API | `scratch/app-stderr.log` (log.cmd) |
| Capability probe results | `scratch/app-stderr.log` on startup |
| SSH connections to container | sshd logs (inside container, not persisted) |
| ttyd browser connections | ttyd stdout → docker logs |
| Agent connect.sh tunnel | Local only — not on server |
| Discord posts | Discord channel + webhook delivery log |
| Window open/close events | `scratch/app-stderr.log` (log.app) |
| Health check polls | Not logged (GET /health is silent) |

**What is NOT captured:**
- Which human was looking at the browser (ttyd has no auth log, just IP)
- Contents of what was typed into the TUI from browser
- Agent's reasoning / chain-of-thought (stays in agent's context, not server)
- Session history between agent turns (agent context window only)
- Module reload attempts and unload failures (partially visible, not yet structured)
- Runtime ownership events for microapps (no audit trail yet)

**Gaps to close:**
- Structured request log for the control API (caller IP, timestamp, command ID, result, 401s)
- Module/runtime event log (load, unload, reload, failure per microapp)
- `/modules/list` endpoint — no hosted module inspection exists today

---

## The interlock

```
AGENT                     DESKTOP                   HUMAN
──────                    ───────                   ─────
connect.sh ──────────────▶ /health                  
state.sh ────────────────▶ /state ──────────────────▶ sees windows in browser
open.sh ─────────────────▶ /commands/run            
                           window appears ───────────▶ watches it render
send.sh ─────────────────▶ /windows/{id}/input      
                           TUI updates ──────────────▶ reads response in chat
                           agent posts PNG ──────────▶ checks Discord
                                                      types steer in chat ──▶
                           /windows/{id}/input ◀──────
export.sh ◀───────────────  reads result            
```

Neither track requires the other to be present. The agent can run fully headless.
The human can watch without interfering. When both are present, the agent acts and
the human observes — or types in chat to redirect.

---

## Minimum safe agent loop

Every agent operating WibWob-DOS should internalize this loop before acting:

```
1. connect    eval "$(bash scripts/connect.sh)"
              → sets WIBWOB_API + WIBWOB_TOKEN

2. verify     HEALTH=$(curl -s "$WIBWOB_API/health")
   profile    deployProfile=$(echo $HEALTH | python3 -c "import json,sys; print(json.load(sys.stdin).get('deployProfile','MISSING'))")
              [[ "$deployProfile" == "MISSING" || "$deployProfile" == "null" ]] && echo "STOP: profile not loaded" && exit 1

3. verify     curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" "$WIBWOB_API/state" | python3 -c "import json,sys; json.load(sys.stdin)" > /dev/null
   auth       # if 401 → token wrong, re-run connect.sh

4. read       bash scripts/state.sh
   state      # get real window IDs, desktop dimensions, focus — never guess

5. list       bash scripts/open.sh --list
   commands   # confirm expected commands are available under current profile

6. act        bash scripts/open.sh <command-id>
              bash scripts/send.sh <window-id> <text>

7. verify     poll /windows/text?id=N until ok+text non-empty (max 10s)
   result     # do not sleep; poll
```

---

## Open gaps (not yet built)

- ~~`WIBWOB_CONTROL_TOKEN` not threaded into connect.sh~~ — **DONE** (merged to main 2026-03-08)
- Read-only browser URL (separate ttyd `--readonly` endpoint for pure observation)
- Structured request log for control API (caller IP, timestamp, command ID, result, 401s)
- `deployProfile` verification step in `connect.sh` — agent should assert profile name,
  not just check ok=true
- `/modules/list` endpoint — hosted module inspection does not exist; `GET /state` has
  no module info; `module-loader.ts` has no `listModules()` method
- Module/runtime audit log — load, unload, reload, failure events not yet structured

<codex-notes>
Questions / concerns:

1. The doc still treats `state.sh`, `open.sh`, `send.sh`, `export.sh`, and `png.sh`
as if they are the canon agent surface, but after the newer module/runtime work we
should be careful not to let helper scripts become a parallel control plane. The
real source of truth is still the control API plus command registry. I would make
that explicit near the top so agents understand the scripts are convenience wrappers,
not a second architecture.

2. AS-2 currently uses a guessed wait: "Waits 2–3s for render." That is exactly the
kind of pattern agents cargo-cult forever. Better pattern: poll `/state` or verify
`/windows/text` / screenshot readiness instead of sleeping unless a given surface is
known to stream or animate.

3. The examples mix raw API and wrapper scripts somewhat loosely. That is fine for a
human-facing explainer, but for agent reliability I would add one short canon rule:
"use wrapper scripts for common hosted flows; fall back to raw API only when the
wrapper does not cover the task." Otherwise different agents will fragment.

4. The doc says "Both tracks run simultaneously. The agent drives." That is a useful
operational default, but I would clarify that this is a workflow convention, not a
runtime privilege model. Otherwise people may read "drives" as implying exclusive
ownership or precedence in the system itself.

5. HS-2 still sounds a bit safer than it really is. If the browser endpoint is
`--writable`, then humans can still perturb the TUI even with tmux escapes stripped.
I would sharpen the wording from "type safely" to something like "reduced shell escape
risk, but still an interactive input surface." That is more honest.

6. The "What the logs capture" table needs a newer split between:
   - app log file (`logs/tui-app/...`)
   - scratch stderr
   - docker logs / journalctl
Right now it over-indexes on `scratch/app-stderr.log`, but newer runtime/module
events may already be landing in the app logger instead. If that drift is real, this
doc will send humans to the wrong place during incidents.

7. The "What is NOT captured" section should explicitly add: module reload attempts,
module unload failures, and runtime ownership events may be partially visible today
but not yet structured enough for good incident forensics. That matters because hosted
multi-agent work and local module-runtime work are starting to intersect.

8. I would add one short note about session identity instability across restarts.
There are now multiple places where humans/agents may confuse "the same desktop" with
"the same port". The doc already mentions `sessionId`, but a stronger sentence like
"port continuity does not imply session continuity" would prevent sloppy handoffs.

9. The open gap list is missing one thing that feels increasingly important:
hosted-visible module/runtime inspection. Once microapp runtime reload and agent-
authored modules matter, hosted operators will need `/modules/list`-style visibility
and probably a hosted-safe subset of runtime controls.

10. The document is good as an operational overview, but if it is meant to guide
agents directly I would consider adding one final "minimum safe loop":
connect -> verify profile -> verify auth -> read state -> list commands -> act -> verify
state changed. That loop is the thing I would want every agent to internalize.
</codex-notes>
