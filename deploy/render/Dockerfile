FROM oven/bun:1-debian

RUN apt-get update && apt-get install -y \
    figlet \
    curl \
    tmux \
    ncurses-term \
    jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY src ./src
COPY microapps ./microapps
COPY docs ./docs
COPY assets ./assets
COPY tsconfig.json ./

RUN mkdir -p scratch/workspaces
COPY deploy/fly/agent-welcome-workspace.json scratch/workspaces/agent-welcome.json
COPY deploy/fly/agent-readme.txt /app/agent-readme.txt

COPY deploy/render/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 10000
CMD ["/usr/local/bin/entrypoint.sh"]
