FROM oven/bun:1-debian

RUN apt-get update && apt-get install -y \
    ttyd \
    figlet \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Deps layer (cached unless package files change)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Source
COPY src ./src
COPY tsconfig.json ./

# Session + token proxy
COPY deploy/session.sh /usr/local/bin/wibwob-session
COPY deploy/token-proxy.ts /app/deploy/token-proxy.ts
RUN chmod +x /usr/local/bin/wibwob-session

EXPOSE 7681 8080
