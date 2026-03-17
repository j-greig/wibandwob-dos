FROM oven/bun:1-debian

# System deps for blessed TUI + figlet banners + ttyd (web terminal)
RUN apt-get update && apt-get install -y \
    figlet \
    curl \
    tmux \
    ncurses-term \
    jq \
    && rm -rf /var/lib/apt/lists/*

# ttyd — streams tmux PTY to browser via xterm.js
RUN ARCH=$(dpkg --print-architecture) && \
    case "$ARCH" in \
      amd64) TTYD_ARCH=x86_64 ;; \
      arm64) TTYD_ARCH=aarch64 ;; \
      *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${TTYD_ARCH}" \
      -o /usr/local/bin/ttyd && \
    chmod +x /usr/local/bin/ttyd

WORKDIR /app

# Deps layer (cached unless package files change)
COPY package.json bun.lock ./
# --ignore-scripts: skip native builds (node-pty, canvas) — not needed
# for headless control API operation. blessed is pure JS.
RUN bun install --frozen-lockfile --ignore-scripts

# Full source (microapps, docs, primers needed at runtime)
COPY src ./src
COPY microapps ./microapps
COPY docs ./docs
COPY tsconfig.json ./

# WELCOME.md is optional — app runs fine without it
COPY WELCOME.m[d] ./

# Scratch dir (ephemeral — lost on redeploy, that's the point)
RUN mkdir -p scratch/workspaces

# Pre-seed default workspace (restored on boot)
COPY deploy/fly/agent-welcome-workspace.json scratch/workspaces/agent-welcome.json

# Agent readme — served at /readme
COPY deploy/fly/agent-readme.txt /app/agent-readme.txt

# Control API on 8099, exposed to Fly's internal network
EXPOSE 8099

# blessed needs a PTY — tmux provides one
# Process: tmux creates session → runs bun inside it → foreground waits
COPY deploy/fly/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

CMD ["/usr/local/bin/entrypoint.sh"]
