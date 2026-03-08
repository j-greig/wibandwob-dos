# Connection Reference

WibWob-DOS binds its control API to `127.0.0.1:8099` — it is not publicly exposed.
Agents reach it through an SSH tunnel. All API endpoints except `/health`, `/`,
`/help`, and `/openapi.json` require bearer token auth.

## Auth token

All endpoints except public ones (`/health`, `/`, `/help`, `/openapi.json`) require
an `Authorization: Bearer <token>` header.

- **Token location**: `scratch/control-token` in the app directory (mode 0600)
- **Format**: 64-character hex string
- **Persistence**: token persists across restarts; changes only if file is deleted or env var overrides
- **Override**: set `WIBWOB_CONTROL_TOKEN` env var (min 32 chars) to skip SSH fetch

`connect.sh` fetches the token automatically via SSH and exports it as `WIBWOB_TOKEN`.

Without a valid token, protected endpoints return:
```json
{ "ok": false, "error": "Unauthorized" }
```
with HTTP status 401.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `WIBWOB_API` | no | `http://127.0.0.1:8099` | Control API base URL. Set by connect.sh after tunnelling. |
| `WIBWOB_TOKEN` | auto | — | Bearer token for API auth. Set by connect.sh. |
| `WIBWOB_CONTROL_TOKEN` | no | — | Override: pre-set token (min 32 chars). connect.sh uses this instead of fetching via SSH. |
| `WIBWOB_HOST` | yes (for tunnel) | — | SSH hostname or IP |
| `WIBWOB_PORT` | no | `2849` | SSH port (non-standard to reduce scanner noise) |
| `WIBWOB_SSH_KEY` | yes (for tunnel) | — | Absolute path to your agent's ed25519 key |
| `WIBWOB_LOCAL_PORT` | no | `19099` | Local tunnel port (change if 19099 is occupied) |
| `DISCORD_WEBHOOK_URL` | no | — | For discord.sh sharing |
| `DISCORD_MESSAGE` | no | auto | Custom caption override |

Tip: store these in a `.env` file and `source` it. Keep the file out of git
(add to `.gitignore`).

## Setting up the tunnel

```bash
# One-time setup
export WIBWOB_HOST=your.host.or.ip
export WIBWOB_PORT=2849
export WIBWOB_SSH_KEY=~/.ssh/your_agent_key

# Establish tunnel + verify health + fetch token + export WIBWOB_API + WIBWOB_TOKEN
eval "$(bash scripts/connect.sh)"

# All scripts now use the tunnel and token transparently:
bash scripts/state.sh
bash scripts/open.sh microapp.wibwobworld.open
```

After `eval`, `WIBWOB_API` is set to `http://127.0.0.1:19099` and `WIBWOB_TOKEN` is
set to the 64-char hex token.

## Manual tunnel (if you prefer not to use connect.sh)

```bash
ssh -fN \
  -i "$WIBWOB_SSH_KEY" \
  -p "$WIBWOB_PORT" \
  -o StrictHostKeyChecking=no \
  -L 19099:127.0.0.1:8099 \
  wibwob@"$WIBWOB_HOST"

export WIBWOB_API=http://127.0.0.1:19099

# Fetch token manually
export WIBWOB_TOKEN=$(ssh -i "$WIBWOB_SSH_KEY" -p "$WIBWOB_PORT" \
  wibwob@"$WIBWOB_HOST" \
  "cat /opt/wibandwob-dos/scratch/control-token 2>/dev/null || cat /app/scratch/control-token")

curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" $WIBWOB_API/state
```

## Already on the server / local dev

If your agent is running on the same machine as WibWob-DOS (no tunnel needed):

```bash
export WIBWOB_API=http://127.0.0.1:8099
export WIBWOB_TOKEN=$(cat scratch/control-token)
curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" $WIBWOB_API/state
```

## Tunnel persistence and reconnect

SSH tunnels can drop silently. connect.sh detects this and re-establishes:

```bash
eval "$(bash scripts/connect.sh)"   # safe to re-run; checks health first
```

The script:
1. Checks if `$WIBWOB_API` or `127.0.0.1:19099` is already healthy — skips setup if so
2. Loads token from cache or env if available
3. Kills any stale ssh tunnel process on the local port
4. Opens a new tunnel via `ssh -fN`
5. Fetches token via SSH (unless `WIBWOB_CONTROL_TOKEN` override is set)
6. Polls `/health` for up to 10 seconds
7. Prints `export WIBWOB_API=http://127.0.0.1:19099` and `export WIBWOB_TOKEN=<token>`

Token is cached at `/tmp/wibwob-token-<port>` so reconnects don't need SSH again.

## Multiple instances

Two WibWob-DOS instances (e.g. main + alt) each need their own tunnel port:

```bash
# Main instance
WIBWOB_LOCAL_PORT=19099 eval "$(bash scripts/connect.sh)"
export WIBWOB_API=http://127.0.0.1:19099

# Alt instance (different key, different local port)
WIBWOB_LOCAL_PORT=19098 WIBWOB_SSH_KEY=~/.ssh/alt_agent_key \
  eval "$(bash scripts/connect.sh)"
export WIBWOB_API=http://127.0.0.1:19098
```

The `sessionId` field in `/health` confirms which instance you are talking to.
Each instance has its own token.

## SSH key provisioning

Your admin provisions an ed25519 key per agent identity. You receive:
- `agent_key` — private key (never share, store at `~/.ssh/wibwob_agent_key`)
- `agent_key.pub` — public key (this is what the server holds)

Protect the private key: `chmod 600 ~/.ssh/wibwob_agent_key`

## Security posture

- Port 8099 is bound to `127.0.0.1` inside the server — not reachable over the network directly
- SSH on a non-standard port reduces automated scanner connections
- `PasswordAuthentication no` — only key auth is accepted
- One key per agent identity — revoke per-key without affecting others
- Bearer token required for all protected endpoints (64-char hex, timing-safe comparison)
- Token stored at `scratch/control-token` mode 0600 (only app user can read)
- Webhook URLs have no auth; rotate them if exposed

## Deployment Profiles

Set `WIBWOB_DEPLOY_PROFILE` in the instance `.env` to gate unavailable commands.

| Profile | Description |
| --- | --- |
| `docker-safe` | Disables chrome, monster_cam, backrooms (no native deps in smoke image) |
| `full` | No overrides — all probed capabilities used as-is |
| _(unset)_ | Same as `full` — probe results only |

Capabilities appear in `/state` under `app.capabilities`:
```json
{ "bin.figlet": { "ok": true, "source": "probe" },
  "bin.chrome":  { "ok": false, "reason": "disabled by profile", "source": "profile-force-off" } }
```

Check which commands are currently gated:
```bash
curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" \
  "http://127.0.0.1:$TUNNEL_PORT/commands/list?includeUnavailable=1" | \
  python3 -c "import sys,json; [print(c['id']) for c in json.load(sys.stdin)['commands'] if not c.get('available',True)]"
```

Add a new profile at `config/capability-profiles/<name>.json` — see `docker-safe.json` as reference.
