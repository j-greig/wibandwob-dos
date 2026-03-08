#!/bin/bash
# Rebuild + restart local smoke container, re-establish tunnel, verify health.
# Usage:
#   bash scripts/smoke-restart.sh           # rebuild + restart
#   bash scripts/smoke-restart.sh --no-build  # restart from existing image only
#
# Config via env vars (all optional):
#   SMOKE_NAME        container name       (default: wibwob-smoke)
#   SMOKE_SSH_PORT    host SSH port        (default: 2849)
#   SMOKE_TTYD_PORT   host ttyd port       (default: 7681)
#   SMOKE_TUNNEL_PORT local tunnel port    (default: 19099)
#   SMOKE_SSH_KEY     path to agent key    (default: deploy/test_agent_key)
#   SMOKE_LABEL       instance label       (default: smoke)
#   ANTHROPIC_API_KEY if set, injected into container for MVPv2 features

set -e

SMOKE_NAME="${SMOKE_NAME:-wibwob-smoke}"
SMOKE_SSH_PORT="${SMOKE_SSH_PORT:-2849}"
SMOKE_TTYD_PORT="${SMOKE_TTYD_PORT:-7681}"
SMOKE_TUNNEL_PORT="${SMOKE_TUNNEL_PORT:-19099}"
SMOKE_SSH_KEY="${SMOKE_SSH_KEY:-deploy/test_agent_key}"
SMOKE_LABEL="${SMOKE_LABEL:-smoke}"
NO_BUILD="${1:-}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="$REPO_ROOT/$SMOKE_SSH_KEY"

echo "[smoke] === WibWob-DOS Smoke Restart ==="
echo "[smoke] container: $SMOKE_NAME  ssh: $SMOKE_SSH_PORT  ttyd: $SMOKE_TTYD_PORT  tunnel: $SMOKE_TUNNEL_PORT"

# Fix key permissions
chmod 600 "$KEY" 2>/dev/null || true

# Kill existing tunnel
pkill -f "${SMOKE_TUNNEL_PORT}:127.0.0.1:8099" 2>/dev/null || true

# Stop + remove old container
if docker ps -a --format '{{.Names}}' | grep -q "^${SMOKE_NAME}$"; then
  echo "[smoke] stopping existing container..."
  docker rm -f "$SMOKE_NAME" > /dev/null
fi

# Rebuild unless --no-build
if [ "$NO_BUILD" != "--no-build" ]; then
  echo "[smoke] building image..."
  if ! docker build --platform linux/arm64 -t wibwob-vps-smoke \
    -f "$REPO_ROOT/deploy/Dockerfile.smoke" "$REPO_ROOT"; then
    echo "[smoke] ERROR: build failed — fix Dockerfile then retry"
    exit 1
  fi
  echo "[smoke] build done"
fi

# Compose docker run args
DOCKER_ARGS=(
  -d -t
  -p "127.0.0.1:${SMOKE_SSH_PORT}:22"
  -p "127.0.0.1:${SMOKE_TTYD_PORT}:7681"
  --platform linux/arm64
  --name "$SMOKE_NAME"
)

# Inject API key if available (enables MVPv2 features: agent, poetry clock)
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "[smoke] ANTHROPIC_API_KEY detected — MVPv2 features will be available"
  DOCKER_ARGS+=(-e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
fi

# Start container
echo "[smoke] starting container..."
docker run "${DOCKER_ARGS[@]}" wibwob-vps-smoke > /dev/null

# Wait for sshd + app
echo "[smoke] waiting for app..."
ssh-keygen -R "[127.0.0.1]:${SMOKE_SSH_PORT}" 2>/dev/null | grep -v "^#" || true
for i in $(seq 1 30); do
  sleep 1
  printf "."
  if ssh -i "$KEY" -p "$SMOKE_SSH_PORT" \
      -o StrictHostKeyChecking=no \
      -o ConnectTimeout=2 \
      wibwob@127.0.0.1 'tmux has-session -t wibwob' 2>/dev/null; then
    echo " ready (${i}s)"
    break
  fi
  if [ "$i" -eq 30 ]; then echo " timeout"; exit 1; fi
done

# Establish tunnel
pkill -f "${SMOKE_TUNNEL_PORT}:127.0.0.1:8099" 2>/dev/null || true
echo "[smoke] establishing tunnel :${SMOKE_TUNNEL_PORT} → 8099..."
ssh -fN -i "$KEY" -p "$SMOKE_SSH_PORT" \
  -o StrictHostKeyChecking=no \
  -L "${SMOKE_TUNNEL_PORT}:127.0.0.1:8099" \
  wibwob@127.0.0.1

# Poll health (app may still be starting after tmux session exists)
HEALTH="unreachable"
for i in $(seq 1 15); do
  sleep 1
  HEALTH=$(curl -sf "http://127.0.0.1:${SMOKE_TUNNEL_PORT}/health" 2>/dev/null || echo "unreachable")
  if echo "$HEALTH" | grep -q '"ok":true'; then break; fi
done
echo "[smoke] health: $HEALTH"

if echo "$HEALTH" | grep -q '"ok":true'; then
  # Fetch control token from container scratch dir
  CONTROL_TOKEN=$(ssh -i "$SMOKE_SSH_KEY" -p "$SMOKE_SSH_PORT" \
    -o StrictHostKeyChecking=no wibwob@127.0.0.1 \
    'cat /opt/wibandwob-dos/scratch/control-token 2>/dev/null' 2>/dev/null || echo "")

  echo ""
  echo "[smoke] READY"
  echo "  TUI (browser): http://127.0.0.1:${SMOKE_TTYD_PORT}"
  echo "  SSH:           ssh -i $SMOKE_SSH_KEY -p $SMOKE_SSH_PORT wibwob@127.0.0.1"
  echo "  Control API:   http://127.0.0.1:${SMOKE_TUNNEL_PORT}"
  echo "  Attach tmux:   ssh -i $SMOKE_SSH_KEY -p $SMOKE_SSH_PORT wibwob@127.0.0.1 'tmux attach -t wibwob'"
  if [ -n "$CONTROL_TOKEN" ]; then
    echo "  Auth header:   Authorization: Bearer $CONTROL_TOKEN"
    echo "  Quick test:    curl -s -H \"Authorization: Bearer $CONTROL_TOKEN\" http://127.0.0.1:${SMOKE_TUNNEL_PORT}/state"
  else
    echo "  Auth token:    (not yet available — run: ssh -i $SMOKE_SSH_KEY -p $SMOKE_SSH_PORT wibwob@127.0.0.1 'cat scratch/control-token')"
  fi
else
  echo "[smoke] ERROR: health check failed — check docker logs $SMOKE_NAME"
  exit 1
fi
