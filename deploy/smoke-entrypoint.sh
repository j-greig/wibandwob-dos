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

echo "[smoke] container ready. tmux session: wibwob. ssh port: 22"

# Keep alive — exit when tmux session dies (app crashed) or sshd dies
while su -c "tmux has-session -t wibwob" wibwob 2>/dev/null && kill -0 "$SSHD_PID" 2>/dev/null; do
  sleep 5
done

echo "[smoke] session ended. last stderr:"
tail -20 /opt/wibandwob-dos/scratch/app-stderr.log 2>/dev/null || echo "(no stderr log)"
