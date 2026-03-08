#!/bin/bash
set -e

echo "[smoke] starting sshd..."
/usr/sbin/sshd -D &
SSHD_PID=$!

echo "[smoke] starting wibwob-dos as wibwob user in tmux..."

# Write a locked-down tmux config for the web-facing session.
# Removes ALL keybindings so browser users cannot escape the TUI into a shell.
# Operator/SSH access uses a separate default tmux server (no socket arg).
TMUX_SOCKET="/opt/wibandwob-dos/scratch/tmux-web.sock"
TMUX_LOCK_CONF="/opt/wibandwob-dos/scratch/tmux-lockdown.conf"
mkdir -p /opt/wibandwob-dos/scratch
chown wibwob:wibwob /opt/wibandwob-dos/scratch
cat > "$TMUX_LOCK_CONF" <<'TMUXEOF'
# SEC-C1: strip all tmux keybindings — browser users cannot Ctrl-b c into a shell
set -g prefix None
set -g prefix2 None
set -g mouse off
set -g status off
unbind-key -a -T prefix
unbind-key -a -T root
TMUXEOF
chown wibwob:wibwob "$TMUX_LOCK_CONF" "$TMUX_SOCKET" 2>/dev/null || true
chmod 600 "$TMUX_LOCK_CONF"

su -c "
  cd /opt/wibandwob-dos
  mkdir -p /opt/wibandwob-dos/scratch
  # Source .env so capability profile + instance label are picked up by the app
  set -a; [ -f /opt/wibandwob-dos/.env ] && . /opt/wibandwob-dos/.env; set +a
  TERM=xterm-256color \
  tmux -S $TMUX_SOCKET -f $TMUX_LOCK_CONF \
    new-session -d -s wibwob -x 320 -y 79 \
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
  su -c "tmux -S $TMUX_SOCKET attach -t wibwob" wibwob &
TTYD_PID=$!
sleep 1 && curl -sf http://127.0.0.1:7681/ > /dev/null \
  && echo "[smoke] ttyd OK — TUI at http://localhost:7681/" \
  || echo "[smoke] ttyd WARN: not yet ready"

echo "[smoke] container ready. ssh port: 22, web TUI port: 7681"

# Keep alive — exit when tmux session dies (app crashed) or sshd dies
while su -c "tmux -S $TMUX_SOCKET has-session -t wibwob" wibwob 2>/dev/null && kill -0 "$SSHD_PID" 2>/dev/null; do
  sleep 5
done
kill "$TTYD_PID" 2>/dev/null || true

echo "[smoke] session ended. last stderr:"
tail -20 /opt/wibandwob-dos/scratch/app-stderr.log 2>/dev/null || echo "(no stderr log)"
