# Fly.io Runbook (WibWob Hosting Smoke)

Primary docs:
- https://fly.io/docs/flyctl/
- https://fly.io/docs/flyctl/deploy/
- https://fly.io/docs/flyctl/launch/
- https://fly.io/docs/flyctl/status/
- https://fly.io/docs/flyctl/proxy/
- https://fly.io/docs/flyctl/ssh/

This runbook is the Fly-specific companion to `wibwob-hosting-smoke`.
Use it when running or debugging the `flyio` adapter path.

## Preconditions

- `flyctl` installed
- authenticated session (`fly auth login` already done)
- `FLY_APP_NAME` set to target app

```bash
export FLY_APP_NAME="<your-app-name>"
```

## Core operator commands

### 1) Confirm auth + app context

```bash
fly auth whoami
fly apps list | grep "$FLY_APP_NAME"
```

### 2) Inspect app health and machines

```bash
fly status --app "$FLY_APP_NAME"
fly status --app "$FLY_APP_NAME" --json | jq '.Name,.Status'
fly machine list --app "$FLY_APP_NAME" --json | jq '.[] | {id:.id,state:.state,region:.region}'
```

### 3) Stream logs

```bash
fly logs --app "$FLY_APP_NAME"
# one-shot snapshot
fly logs --app "$FLY_APP_NAME" --no-tail | tail -n 200
```

### 4) Open remote shell

```bash
fly ssh console --app "$FLY_APP_NAME"
```

### 5) Proxy control API locally (dynamic port)

Pick a free local port dynamically (collision-safe):

```bash
PORT=$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)
echo "Using local proxy port: $PORT"
fly proxy ${PORT}:8099 --app "$FLY_APP_NAME"
# then in another terminal:
curl -sS --max-time 5 "http://127.0.0.1:${PORT}/health" | jq .
```

### 6) Deploy / rollback basics

```bash
fly deploy --app "$FLY_APP_NAME"
fly releases --app "$FLY_APP_NAME"
# rollback target version example:
fly deploy --image <previous-image-ref> --app "$FLY_APP_NAME"
```

## Fly smoke workflow

From repo root:

```bash
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh flyio
```

Current runner:
- `.pi/skills/wibwob-hosting-smoke/scripts/fly-smoke.sh`

Artifacts:
- `scratch/captures/fly-smoke-<timestamp>/report.md`
- `scratch/captures/fly-smoke-<timestamp>/checks.jsonl`
- `scratch/captures/fly-smoke-<timestamp>/raw.log`

## Rate limiting (restore-time operations)

Current code has both ingress and command rate limiting enabled by default.

Restore rollout recommendation:

1. **stabilize first (monitor-only)**
   - `WIBWOB_RL_ENABLED=true`
   - `WIBWOB_RL_ENFORCE=false`
2. Observe `/runtime/inspection` counters (`wouldLimit`, `denied`, bucket stats).
3. **enforce after stable**
   - `WIBWOB_RL_ENFORCE=true`

Emergency debug mode (temporary only):

- `WIBWOB_RL_ENABLED=false`

Quick probes after deploy:

- `GET /health`
- `GET /runtime/inspection` (must include rateLimit snapshot)
- burst ingress probe (expect 429 only when `ENFORCE=true`)
- burst command probe (`POST /commands/run`, expect `{error:"rate_limited"}` when enforced)

## Failure triage checklist

1. Validate `FLY_APP_NAME` env is set correctly.
2. Confirm machine state is healthy (`fly machine list`).
3. Check logs for boot/runtime errors.
4. Validate proxy/port path separately from app readiness.
5. Test external proof endpoints:
   - `https://<app>.fly.dev/health`
   - `https://<app>.fly.dev/help`
6. Confirm RL mode matches intent (`WIBWOB_RL_*`), so 429s are interpreted correctly.
7. Classify failures with taxonomy where available:
   - `tunnel_refused`
   - `app_not_ready`
   - `selector_ambiguous`
   - `command_error`

## Minimum debug bundle (when app crash-loops)

Capture these every incident:

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="scratch/captures/fly-incident-${STAMP}"
mkdir -p "$OUT"

fly status --app "$FLY_APP_NAME" > "$OUT/status.txt"
fly machine list --app "$FLY_APP_NAME" --json > "$OUT/machines.json"
MID=$(jq -r '.[0].id' "$OUT/machines.json")
fly machine status "$MID" --app "$FLY_APP_NAME" > "$OUT/machine-status.txt"
fly logs --app "$FLY_APP_NAME" --no-tail > "$OUT/logs.txt"

curl -sS --max-time 8 "https://${FLY_APP_NAME}.fly.dev/health" > "$OUT/health.txt" || true
curl -sS --max-time 8 "https://${FLY_APP_NAME}.fly.dev/help" > "$OUT/help.txt" || true
```

Optional (if SSH is reachable), capture tmux evidence from inside machine:

```bash
fly ssh console --app "$FLY_APP_NAME"
# inside machine:
tmux ls || true
tmux capture-pane -pt wibwob:0.0 -S -400 > /tmp/wibwob-pane.txt || true
```

## Notes

- Fly remains adapter-specific. Keep shared smoke semantics in `SKILL.md`.
- Do not introduce Fly-only semantics into core gate definitions.
