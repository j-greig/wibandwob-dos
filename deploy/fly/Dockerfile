FROM oven/bun:1-debian

# System deps for blessed TUI + figlet banners
RUN apt-get update && apt-get install -y \
    figlet \
    curl \
    tmux \
    ncurses-term \
    jq \
    && rm -rf /var/lib/apt/lists/*

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

# Control API on 8099, exposed to Fly's internal network
EXPOSE 8099

# blessed needs a PTY — tmux provides one
# Process: tmux creates session → runs bun inside it → foreground waits
COPY deploy/fly/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

CMD ["/usr/local/bin/entrypoint.sh"]
