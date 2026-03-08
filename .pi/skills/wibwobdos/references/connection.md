# Connection Reference

WibWob-DOS binds its control API to `127.0.0.1:8099` — it is not publicly exposed.
Agents reach it through an SSH tunnel. The API itself has no auth layer; the SSH key
is the access control mechanism.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `WIBWOB_API` | no | `http://127.0.0.1:8099` | Control API base URL. Set by connect.sh after tunnelling. |
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

# Establish tunnel + verify health + export WIBWOB_API
eval "$(bash scripts/connect.sh)"

# All scripts now use the tunnel transparently:
bash scripts/state.sh
bash scripts/open.sh microapp.wibwobworld.open
```

After `eval`, `WIBWOB_API` is set to `http://127.0.0.1:19099` in your shell.

## Manual tunnel (if you prefer not to use connect.sh)

```bash
ssh -fN \
  -i "$WIBWOB_SSH_KEY" \
  -p "$WIBWOB_PORT" \
  -o StrictHostKeyChecking=no \
  -L 19099:127.0.0.1:8099 \
  wibwob@"$WIBWOB_HOST"

export WIBWOB_API=http://127.0.0.1:19099
curl -s $WIBWOB_API/health  # verify
```

## Already on the server / local dev

If your agent is running on the same machine as WibWob-DOS (no tunnel needed):

```bash
export WIBWOB_API=http://127.0.0.1:8099
curl -s $WIBWOB_API/health
```

## Tunnel persistence and reconnect

SSH tunnels can drop silently. connect.sh detects this and re-establishes:

```bash
eval "$(bash scripts/connect.sh)"   # safe to re-run; checks health first
```

The script:
1. Checks if `$WIBWOB_API` or `127.0.0.1:19099` is already healthy — skips setup if so
2. Kills any stale ssh tunnel process on the local port
3. Opens a new tunnel via `ssh -fN`
4. Polls `/health` for up to 10 seconds
5. Prints `export WIBWOB_API=http://127.0.0.1:19099`

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
- Webhook URLs have no auth; rotate them if exposed
