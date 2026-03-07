#!/bin/bash
set -e

echo "[smoke] starting sshd..."
/usr/sbin/sshd -D &
SSHD_PID=$!

echo "[smoke] starting wibwob-dos as wibwob user in tmux..."
su -c "
  cd /opt/wibandwob-dos
  mkdir -p /opt/wibandwob-dos/scratch
  WIBWOB_INSTANCE_LABEL=smoke \
  TERM=xterm-256color \
  tmux new-session -d -s wibwob -x 320 -y 79 \
    'exec /usr/local/bin/bun run /opt/wibandwob-dos/src/app.ts 2>/opt/wibandwob-dos/scratch/app-stderr.log'
" wibwob

echo "[smoke] app started. waiting for health..."
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8099/health > /dev/null 2>&1 || \
     curl -sf http://127.0.0.1:8100/health > /dev/null 2>&1; then
    echo "[smoke] /health OK"
    break
  fi
  sleep 1
done

echo "[smoke] starting ttyd on port 7681..."
# ttyd serves the tmux session over WebSocket + xterm.js
# --writable: browser can type into the TUI (not read-only)
# Binds 0.0.0.0 in container — host publish controls actual exposure
ttyd --writable -p 7681 \
  su -c "tmux attach -t wibwob" wibwob &
TTYD_PID=$!
sleep 1 && curl -sf http://127.0.0.1:7681/ > /dev/null \
  && echo "[smoke] ttyd OK — TUI at http://localhost:7681/" \
  || echo "[smoke] ttyd WARN: not yet ready"

echo "[smoke] container ready. ssh port: 22, web TUI port: 7681"

# Keep alive — exit when tmux session dies (app crashed) or sshd dies
while su -c "tmux has-session -t wibwob" wibwob 2>/dev/null && kill -0 "$SSHD_PID" 2>/dev/null; do
  sleep 5
done
kill "$TTYD_PID" 2>/dev/null || true

echo "[smoke] session ended. last stderr:"
tail -20 /opt/wibandwob-dos/scratch/app-stderr.log 2>/dev/null || echo "(no stderr log)"
