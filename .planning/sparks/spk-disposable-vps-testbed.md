# Spark — Disposable Fly.io Testbed

> **Status:** spark
> **Origin:** Human brief, 2026-03-17
> **Relation:** Lighter-weight precursor to E021 (VPS Multi-Agent World)
> **Goal:** Deploy WibWob-DOS to a disposable Fly.io machine for remote multi-agent testing. No VPS management, no Docker wrangling. Push code, machine runs, agents operate it, machine resets.

<human-prompt>
I want to deploy this to a hosting service. The Linux box. Not using Docker, just directly to Linux box that we can SSH and Tailscale into test. Using these commands via the internet, another agent using them. But using a disposable Linux box, so there's no file rest, like if it goes wrong or if it gets hacked, it doesn't matter. Maybe the instance resets every one hour or every 12 hours. That can be a configuration file that we do, but it's basically a test of before we turn this whole repo into an NPM package. We deploy it to this free VPS. So list rank possible solutions, VPS hosts we can do that with.
</human-prompt>

---

## Why Fly.io

- **GitHub integration already authorized** (`j-greig/wibandwob-dos`)
- **Inherently disposable** — machines have no persistent disk by default. Redeploy = clean slate.
- **Auto-stop/start** — machine sleeps when no requests, wakes on first hit. Free when idle.
- **Free tier** — $5/mo credit covers a shared-cpu-1x + 512MB machine easily (~$3.19/mo)
- **CLI-first** — `fly deploy`, `fly ssh console`, `fly logs`, `fly machine restart`
- **No Docker management** — yes, Fly uses containers under the hood, but you never touch Docker. You push code + a Dockerfile, Fly builds and runs it. This is different from "run Docker on a VPS."

---

## Architecture

```
Remote Agent                          Fly.io (ams region)
─────────────                         ──────────────────
                                      ┌─────────────────────┐
curl/wibwob ──── HTTPS ──────────────►│  Fly Proxy (TLS)    │
                                      │    ↓                 │
                                      │  WibWob-DOS          │
                                      │  (bun in tmux)       │
                                      │    ↓                 │
                                      │  Control API :8099   │
                                      │  bound 0.0.0.0       │
                                      └─────────────────────┘

fly ssh console ── WireGuard ────────► tmux attach -t wibwob
```

Two access paths:
1. **HTTPS → Control API** — remote agents hit `https://wibwob-dos.fly.dev/health`, `/state`, `/commands/run` etc. Fly terminates TLS, proxies to port 8099 inside the machine.
2. **`fly ssh console`** — interactive shell via Fly's WireGuard mesh. Attach to tmux for TUI access. No SSH keys to manage.

---

## Files Written

```
deploy/fly/
├── fly.toml          # Fly app config (region, VM size, health checks)
├── Dockerfile        # Container build (bun + tmux + blessed deps)
└── entrypoint.sh     # Starts app in tmux, waits for health, blocks
```

---

## Setup Steps

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# or universal
curl -L https://fly.io/install.sh | sh
```

### 2. Login

```bash
fly auth login
```

### 3. Create the app (one-time)

Don't use the dashboard — the CLI gives us more control:

```bash
cd ~/Repos/wibandwob-dos

# Create app in Amsterdam (closest to Hetzner wibwob1 for future cross-talk)
fly apps create wibwob-dos --org personal
```

### 4. Set secrets

Secrets are encrypted, never in the image, injected as env vars at runtime:

```bash
# OpenRouter key (use a disposable key with $5/day spend cap)
fly secrets set OPENROUTER_API_KEY=sk-or-v1-your-disposable-key \
  --app wibwob-dos

# Optional: PartyKit room chat (use test room, not production)
fly secrets set WIBWOB_PARTYKIT_URL=wss://wibwob-rooms.j-greig.partykit.dev \
  WIBWOB_PARTYKIT_ROOM=rchat-disposable \
  --app wibwob-dos
```

### 5. Deploy

```bash
fly deploy --config deploy/fly/fly.toml
```

That's it. Fly builds the Dockerfile, pushes the image, starts the machine.

### 6. Verify

```bash
# Health check
curl https://wibwob-dos.fly.dev/health

# Full state
curl https://wibwob-dos.fly.dev/state | jq .

# List commands
curl https://wibwob-dos.fly.dev/commands/list | jq '.[].id'

# SSH in and attach TUI
fly ssh console --app wibwob-dos
# then: tmux attach -t wibwob
```

---

## Operating from a Remote Agent

Once deployed, any agent with internet access can operate WibWob-DOS:

### Core reads
```bash
BASE=https://wibwob-dos.fly.dev

curl -s $BASE/health                    # alive?
curl -s $BASE/state | jq .             # full desktop state
curl -s $BASE/commands/list | jq '.[].id'  # all available commands
curl -s $BASE/screenshot/text          # text screenshot of TUI
curl -s "$BASE/windows/text?id=5"      # read a specific window
curl -s $BASE/help                     # endpoint catalogue
curl -s $BASE/openapi.json             # OpenAPI 3.0 spec (self-documenting)
```

### Core writes
```bash
# Run any command
curl -s -X POST $BASE/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.open"}'

# Batch window operations (move, resize, close)
curl -s -X POST $BASE/windows/batch \
  -H 'Content-Type: application/json' \
  -d '{"ops":[{"id":5,"left":10,"top":2,"width":120,"height":40}]}'

# Open specific views
curl -s -X POST $BASE/view/primer/open \
  -H 'Content-Type: application/json' \
  -d '{"filePath":"/app/microapps/primer/examples/cave.txt"}'

curl -s -X POST $BASE/view/figlet/open-default \
  -H 'Content-Type: application/json' \
  -d '{"text":"HELLO FLY"}'
```

### Interactive TUI access
```bash
fly ssh console --app wibwob-dos -C "tmux attach -t wibwob"
# or read-only:
fly ssh console --app wibwob-dos -C "tmux attach -t wibwob -r"
```

---

## Disposable Reset Model

Fly machines are inherently ephemeral. No persistent disk = no state to corrupt.

| Reset method | Command | What happens |
|-------------|---------|--------------|
| **Redeploy** | `fly deploy --config deploy/fly/fly.toml` | Builds fresh image, replaces machine. Clean slate. |
| **Restart machine** | `fly machine restart --app wibwob-dos` | Same image, fresh process. Scratch dir wiped. |
| **Destroy + recreate** | `fly apps destroy wibwob-dos && fly apps create ...` | Nuclear option. New app, new URL. |
| **Auto-stop** | Automatic after idle timeout | Machine stops when no HTTP requests for ~5min. Wakes on next request. Free when stopped. |

### Scheduled reset (optional)

If you want forced resets every N hours, a cron job on your Mac or wibwob1 can do it:

```bash
# crontab -e on wibwob1 or local machine
0 */12 * * * fly machine restart --app wibwob-dos
```

Or use a GitHub Action on a schedule:

```yaml
# .github/workflows/reset-fly.yml
on:
  schedule:
    - cron: '0 */12 * * *'
jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsSL https://fly.io/install.sh | sh
          fly machine restart --app wibwob-dos
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## Multi-Agent Configuration

### What works out of the box

The control API is **COAT-compliant** — everything that works in the TUI works via the API. A remote agent doesn't need special configuration:

- **`/openapi.json`** — agent can self-discover the entire API surface
- **`/state`** — full desktop state, window list, geometry, content metadata
- **`/screenshot/text`** — clean text representation of the TUI (no ANSI escapes)
- **`describeState()`** — every window reports semantic content, not just pixel data
- **`/commands/list`** — all registered commands with descriptions
- **`/commands/run`** — execute any command by ID

### What's different on Fly vs local

| Concern | Local | Fly |
|---------|-------|-----|
| **Access** | Unix socket + localhost:8099 | HTTPS via `wibwob-dos.fly.dev` |
| **Identity** | `instanceLabel` from env | Set to `fly-disposable` |
| **wibwob CLI** | Works via socket discovery | Not available — use raw HTTP |
| **TUI attachment** | `tmux attach` directly | `fly ssh console -C "tmux attach"` |
| **Persistence** | `scratch/` survives restart | Lost on every redeploy/restart |
| **API auth** | None (localhost only) | None — **public endpoint** (see security below) |

### Security: Intentionally Minimal

This is a disposable testbed. The control API is public at `wibwob-dos.fly.dev`. Anyone who finds the URL can operate the desktop. This is fine because:

- **No secrets at rest** — OpenRouter key is in Fly secrets (encrypted), not in the image
- **No persistent data** — machine resets on redeploy
- **API key has spend cap** — $5/day on the disposable OpenRouter key
- **Worst case** — someone opens a bunch of windows. Machine restart fixes it.

For production, E021 adds SSH tunnel + identity + authorization. This testbed deliberately skips all of that.

**Optional hardening** (if the URL gets scraped):
```bash
# Add a simple bearer token
fly secrets set WIBWOB_API_TOKEN=some-random-token --app wibwob-dos
```
Then add a middleware check in control-api.ts. But for now: don't bother.

---

## NPM Package Pre-Test Checklist

This testbed validates "can wibwob-dos run on a fresh Linux box and be operated remotely":

- [ ] **`bun install` succeeds** — no macOS-only native deps
- [ ] **App starts in tmux** — blessed renders correctly with PTY from tmux
- [ ] **`/health` responds** — control API binds and serves
- [ ] **`/state` returns desktop** — windows, geometry, metadata all present
- [ ] **`/commands/list` works** — all commands registered
- [ ] **`/commands/run` executes** — can open/close windows remotely
- [ ] **`/screenshot/text` readable** — text representation is useful for agents
- [ ] **WibWobWorld opens** — 3D world microapp initializes without GPU
- [ ] **Primer windows open** — ASCII art renders correctly
- [ ] **Figlet banners work** — figlet binary available, fonts render
- [ ] **No macOS assumptions** — no `pbcopy`, no `screencapture`, no Ghostty-specific code paths
- [ ] **No hardcoded paths** — `/app/` works as APP_ROOT (not `~/Repos/...`)
- [ ] **Graceful degradation** — missing ffplay (audio), xclip (clipboard) don't crash the app
- [ ] **Auto-stop/start works** — machine sleeps when idle, wakes on first request
- [ ] **Redeploy resets state** — no stale scratch data after `fly deploy`

---

## Relationship to E021

| Aspect | This Spark | E021 |
|--------|-----------|------|
| **Host** | Fly.io disposable machine | Persistent Hetzner VPS (wibwob1) |
| **Purpose** | Prove remote operation, pre-NPM validation | Production multi-agent world with filesystem binding |
| **Identity** | Anonymous — public API | Per-agent SSH keys, identity tracking |
| **Authorization** | None | Chatspot membership → folder ACLs |
| **Persistence** | None by design | systemd, workspace restore, state persistence |
| **Cost** | Free ($5/mo credit) | Already running on Hetzner |
| **Outcome** | "Can a remote agent operate WibWob-DOS?" | "Can multiple agents share a spatial filesystem?" |

If this spark succeeds, E021 S01–S03 are de-risked. The API patterns proven here transfer directly to the Hetzner deployment.

---

## Known Risks & Mitigations

### blessed + tmux PTY
blessed needs a real PTY for stdin/stdout. The entrypoint starts the app inside `tmux new-session -d`, which allocates a PTY. If tmux fails (missing terminfo, broken locale), the app won't render. Mitigation: `ncurses-term` package installed in Dockerfile, `TERM=xterm-256color` set explicitly.

### 256MB is too small
The Fly dashboard defaulted to 256MB. WibWob-DOS needs ~150–200MB for Bun + blessed + microapps. The `fly.toml` is set to **512MB** (`[[vm]] memory = "512mb"`). If WibWobWorld + multiple windows push past this, upgrade to 1GB ($6.38/mo, still covered by credit if usage is low).

### `dev:world` vs `start`
`bun run dev:world` expects a local IRC server on port 6667. The Fly machine doesn't have one. The entrypoint uses `bun run src/app.ts` directly (equivalent to `bun run start`). No IRC, no crash.

### No audio
`ffplay`/`ffmpeg` aren't installed. Music player and timeline playback will fail gracefully (they already handle missing binaries). Not a blocker for API testing.

### Public API
The control API is public on `wibwob-dos.fly.dev`. No auth. Acceptable for a disposable testbed. If it becomes a problem, add a bearer token via Fly secrets.

---

## Next Steps

1. ~~Write deploy files~~ ✅ `deploy/fly/` created
2. **Install `flyctl`** — `brew install flyctl`
3. **`fly auth login`** — authenticate CLI
4. **`fly apps create wibwob-dos`** — create the app
5. **`fly secrets set ...`** — inject OpenRouter key
6. **`fly deploy --config deploy/fly/fly.toml`** — ship it
7. **Run the checklist** — verify every item above
8. **Point a remote agent at it** — prove the COAT test passes over HTTPS
