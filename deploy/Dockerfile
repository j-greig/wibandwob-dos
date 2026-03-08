FROM oven/bun:1-debian

# Install figlet + curl via apt, ttyd via GitHub release (not in Debian trixie)
RUN apt-get update && apt-get install -y \
    figlet \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install ttyd binary for aarch64 (arm64) from GitHub releases
RUN ARCH=$(dpkg --print-architecture) && \
    case "$ARCH" in \
      amd64) TTYD_ARCH=x86_64 ;; \
      arm64) TTYD_ARCH=aarch64 ;; \
      *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${TTYD_ARCH}" \
      -o /usr/local/bin/ttyd && \
    chmod +x /usr/local/bin/ttyd && \
    ttyd --version

# Create non-root user — Claude CLI --permission-mode bypassPermissions is
# blocked for root; all app processes must run as wibwob.
RUN useradd -m -s /bin/bash wibwob

WORKDIR /app

# Deps layer (cached unless package files change)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile && chown -R wibwob:wibwob /app

# Source
COPY --chown=wibwob:wibwob src ./src
COPY --chown=wibwob:wibwob tsconfig.json ./
COPY --chown=wibwob:wibwob config ./config

# Session + token proxy
COPY deploy/session.sh /usr/local/bin/wibwob-session
COPY deploy/token-proxy.ts /app/deploy/token-proxy.ts
RUN chmod +x /usr/local/bin/wibwob-session \
    && chown wibwob:wibwob /app/deploy/token-proxy.ts

USER wibwob

EXPOSE 7681 8080
