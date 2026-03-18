#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE_DIR="$ROOT/scratch/devops/docker-human-view"
STATE_FILE="$STATE_DIR/latest.env"
mkdir -p "$STATE_DIR"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/devops/docker-human-view.sh start
  bash scripts/devops/docker-human-view.sh attach-cmd
  bash scripts/devops/docker-human-view.sh attach
  bash scripts/devops/docker-human-view.sh copy-attach
  bash scripts/devops/docker-human-view.sh stop
  bash scripts/devops/docker-human-view.sh status

Purpose:
  Launch and operate a human-in-loop WibWob-DOS TUI view container.
  Persists latest connection vars in scratch/devops/docker-human-view/latest.env.
EOF
}

require_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "No state file found: $STATE_FILE" >&2
    echo "Run: bash scripts/devops/docker-human-view.sh start" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$STATE_FILE"
}

pick_ssh_port() {
  local port
  for port in $(seq 2849 2899); do
    if ! lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
  done
  echo "No free SSH port found in 2849-2899" >&2
  exit 1
}

attach_cmd() {
  require_state
  cat <<EOF
ssh -i '$KEY' -p '$SSH_PORT' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -t wibwob@127.0.0.1 "TERM=xterm-256color tmux -2 attach -t wibwob"
EOF
}

cmd_start() {
  local stamp out_dir key pubkey image_tag container_name ssh_port
  stamp="$(date +%Y%m%d-%H%M%S)"
  out_dir="$ROOT/scratch/captures/docker-human-view-$stamp"
  key="$out_dir/view_id_ed25519"
  image_tag="wibwob-ssh-smoke:$stamp"
  container_name="wibwob-human-view-$stamp"
  ssh_port="$(pick_ssh_port)"

  mkdir -p "$out_dir"
  ssh-keygen -t ed25519 -N '' -f "$key" >/dev/null
  pubkey="$(cat "$key.pub")"

  echo "Building image: $image_tag"
  docker build -t "$image_tag" -f "$ROOT/deploy/Dockerfile.ssh-smoke" --build-arg SSH_PUBKEY="$pubkey" "$ROOT" >/dev/null

  echo "Starting container: $container_name (ssh:$ssh_port)"
  docker run -d --name "$container_name" \
    -p 127.0.0.1:${ssh_port}:22 \
    -p 127.0.0.1:8099:8099 \
    -p 127.0.0.1:8100:8100 \
    -v "$out_dir/data-root:/home/wibwob/.wibwob" \
    "$image_tag" >/dev/null

  echo "Waiting for SSH readiness..."
  local ready=0
  for _ in $(seq 1 80); do
    if ssh -i "$key" -p "$ssh_port" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null wibwob@127.0.0.1 "echo ok" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done

  cat > "$STATE_FILE" <<EOF
STAMP='$stamp'
OUT_DIR='$out_dir'
KEY='$key'
IMAGE_TAG='$image_tag'
CONTAINER_NAME='$container_name'
SSH_PORT='$ssh_port'
EOF

  if [[ $ready -ne 1 ]]; then
    echo "SSH did not become ready; check container logs:" >&2
    echo "docker logs --tail 200 $container_name" >&2
    exit 1
  fi

  echo "Ready. State saved to: $STATE_FILE"
  local cmd
  cmd="$(attach_cmd)"
  echo "Attach with:"
  echo "$cmd"
  if command -v pbcopy >/dev/null 2>&1; then
    printf '%s\n' "$cmd" | pbcopy
    echo "(attach command copied to clipboard)"
  fi
}

cmd_attach_cmd() {
  attach_cmd
}

cmd_attach() {
  local cmd
  cmd="$(attach_cmd)"
  eval "$cmd"
}

cmd_copy_attach() {
  local cmd
  cmd="$(attach_cmd)"
  if ! command -v pbcopy >/dev/null 2>&1; then
    echo "pbcopy not available on this system" >&2
    exit 1
  fi
  printf '%s\n' "$cmd" | pbcopy
  echo "Copied attach command to clipboard"
}

cmd_stop() {
  require_state
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  echo "Stopped container: $CONTAINER_NAME"
}

cmd_status() {
  require_state
  echo "State file: $STATE_FILE"
  echo "Container: $CONTAINER_NAME"
  echo "SSH port: $SSH_PORT"
  echo "Key: $KEY"
  if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    echo "Running: yes"
  else
    echo "Running: no"
  fi
}

case "${1:-}" in
  start) cmd_start ;;
  attach-cmd) cmd_attach_cmd ;;
  attach) cmd_attach ;;
  copy-attach) cmd_copy_attach ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  *) usage; exit 1 ;;
esac
