#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=/opt/wibwob-dos
APP_USER=wibwob
APP_HOME=/home/${APP_USER}
APP_LOG_DIR=${APP_ROOT}/scratch
APP_ERR_LOG=${APP_LOG_DIR}/app-stderr.log

mkdir -p /run/sshd
mkdir -p "${APP_LOG_DIR}"
chown -R ${APP_USER}:${APP_USER} "${APP_HOME}" "${APP_LOG_DIR}" || true

ssh-keygen -A >/dev/null 2>&1 || true
/usr/sbin/sshd

echo "[smoke] sshd started"

su - ${APP_USER} -c "
  mkdir -p ${APP_HOME}/.wibwob
  tmux kill-session -t wibwob >/dev/null 2>&1 || true
  tmux new-session -d -s wibwob -x 220 -y 70 \
    'cd ${APP_ROOT} && TERM=xterm-256color WIBWOB_INSTANCE_LABEL=smoke WIBWOB_DATA_DIR=${APP_HOME}/.wibwob bun run src/app.ts --dev 2>${APP_ERR_LOG}'
"

echo "[smoke] tmux session launched"

for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8099/health >/dev/null 2>&1 || curl -sf http://127.0.0.1:8100/health >/dev/null 2>&1; then
    echo "[smoke] health endpoint responding"
    break
  fi
  sleep 1
done

if ! (curl -sf http://127.0.0.1:8099/health >/dev/null 2>&1 || curl -sf http://127.0.0.1:8100/health >/dev/null 2>&1); then
  echo "[smoke] WARN: health endpoint still not responding"
fi

tail -n +1 -F "${APP_ERR_LOG}" &
TAIL_PID=$!

trap 'kill ${TAIL_PID} >/dev/null 2>&1 || true' EXIT

wait -n
