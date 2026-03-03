/**
 * Token Proxy — wibwob-dos
 *
 * Sits in front of ttyd. Generates single-use share links with 30-min TTL.
 * Each valid token proxies HTTP + WebSocket through to ttyd.
 *
 * POST /admin/token          → { token, url }   (requires ADMIN_SECRET header)
 * GET  /s/:token             → proxy to ttyd (HTML + WebSocket)
 * GET  /health               → { ok: true }
 *
 * Env vars:
 *   ADMIN_SECRET   — secret for token generation endpoint (required)
 *   TTYD_URL       — ttyd base URL (default: http://localhost:7681)
 *   TOKEN_TTL_MS   — token lifetime in ms (default: 1800000 = 30 min)
 *   PORT           — listen port (default: 8080)
 *   PUBLIC_URL     — public base URL for generated links (e.g. https://dos.wibandwob.com)
 */

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const TTYD_URL     = (process.env.TTYD_URL ?? "http://localhost:7681").replace(/\/$/, "");
const TOKEN_TTL_MS = parseInt(process.env.TOKEN_TTL_MS ?? "1800000");
const PORT         = parseInt(process.env.PORT ?? "8080");
const PUBLIC_URL   = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");

if (!ADMIN_SECRET) {
  console.error("ADMIN_SECRET env var required");
  process.exit(1);
}

// token → expiry timestamp
const tokens = new Map<string, number>();

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [t, exp] of tokens) {
    if (now > exp) tokens.delete(t);
  }
}

function isValid(token: string): boolean {
  pruneExpired();
  const exp = tokens.get(token);
  return exp !== undefined && Date.now() <= exp;
}

async function proxyHttp(req: Request, token: string): Promise<Response> {
  const url = new URL(req.url);
  // Strip /s/:token prefix, forward the rest to ttyd
  const upstream = TTYD_URL + (url.pathname.replace(`/s/${token}`, "") || "/") + url.search;
  const headers = new Headers(req.headers);
  headers.delete("host");

  const res = await fetch(upstream, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
  });

  const resHeaders = new Headers(res.headers);
  // Rewrite any absolute redirects to go via our token path
  const location = resHeaders.get("location");
  if (location?.startsWith(TTYD_URL)) {
    resHeaders.set("location", location.replace(TTYD_URL, `${PUBLIC_URL}/s/${token}`));
  }

  return new Response(res.body, { status: res.status, headers: resHeaders });
}

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // Health
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    // Token generation (admin only)
    if (req.method === "POST" && url.pathname === "/admin/token") {
      const secret = req.headers.get("x-admin-secret") ?? "";
      if (secret !== ADMIN_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      pruneExpired();
      const token = generateToken();
      tokens.set(token, Date.now() + TOKEN_TTL_MS);
      const link = `${PUBLIC_URL}/s/${token}`;
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      console.log(`[token] generated ${token} expires ${expiresAt}`);
      return Response.json({ token, url: link, expiresAt });
    }

    // Token-gated proxy
    const match = url.pathname.match(/^\/s\/([a-f0-9]{16})(\/.*)?$/);
    if (match) {
      const token = match[1];
      if (!isValid(token)) {
        return new Response(
          `<!doctype html><html><body style="font-family:monospace;padding:2rem">
          <h2>Session expired or invalid.</h2>
          <p>This link has expired. Ask for a new one.</p>
          </body></html>`,
          { status: 410, headers: { "content-type": "text/html" } }
        );
      }
      return proxyHttp(req, token);
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    async message(ws, msg) {
      // @ts-ignore
      ws.upstream?.send(msg);
    },
    close(ws) {
      // @ts-ignore
      ws.upstream?.close();
    },
    open(ws) {
      // @ts-ignore - token stored on ws.data by upgrade handler
    }
  },
});

console.log(`token-proxy listening on :${PORT}  ttyd=${TTYD_URL}  ttl=${TOKEN_TTL_MS / 1000}s`);
