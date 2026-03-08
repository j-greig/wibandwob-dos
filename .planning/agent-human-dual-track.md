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

Both tracks run simultaneously. The agent drives. The human observes, steers,
and intervenes if needed.

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
3. Waits 2–3s for render.
4. `bash scripts/export.sh win-4` — reads the window's text content as ASCII.
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

Browser ttyd is `--writable` but tmux keybindings are stripped (SEC-C1 fix).
Normal typing still reaches the blessed TUI input, but `Ctrl-b c` and other
tmux escape sequences do nothing. Human can type safely in the agent chat window
to steer, without risk of shell escape.

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
# Stderr from the app (app crashes, startup errors, profile warnings)
docker exec wibwob-smoke cat /opt/wibandwob-dos/scratch/app-stderr.log

# Container events (entrypoint, sshd, ttyd)
docker logs wibwob-smoke --tail 50

# Control API token source (was profile loaded?)
docker exec wibwob-smoke grep "control-api\]" /opt/wibandwob-dos/scratch/app-stderr.log

# On direct systemd deploy:
journalctl -u wibwob-dos -n 100 --no-pager
```

---

### HS-5: Handing off to a different agent mid-session

Human wants to swap which agent is driving, without restarting the desktop.

1. Note the current `sessionId` from `/health` — desktop state is tied to this.
2. New agent reads SKILL.md, runs `connect.sh` → same `WIBWOB_API`.
3. Runs `state.sh` → sees exactly what the previous agent left open.
4. Continues from there — no restart needed, state persists.

The `sessionId` changes only on app restart. Desktop layout, open windows, scratch
state all survive agent handoffs as long as the container is running.

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

**Gap to close:** structured request log for the control API (who called what when).
Currently only `log.cmd` on successful runs. No 401 log, no caller IP log.

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

## Open gaps (not yet built)

- `WIBWOB_CONTROL_TOKEN` not yet threaded into `connect.sh` — skill scripts need updating
  to pass `Authorization: Bearer $TOKEN` header. Currently auth was just added (E021).
- Read-only browser URL (separate ttyd `--readonly` endpoint for pure observation).
- Structured request log for control API (caller IP, timestamp, command ID, result).
- `deployProfile` verification step in `connect.sh` — agent should assert profile name
  before proceeding, not just check health ok=true.
