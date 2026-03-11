#!/usr/bin/env bun
/**
 * Exhibition viewer for Dashboard XXL.
 *
 * Serves the hypermassive virtual canvas as a full-screen HTML page.
 * Any browser on the network can open http://<host>:8199 and see the
 * full 800×200 canvas rendered in monospace at whatever size the
 * display can handle.
 *
 * The page auto-refreshes via SSE (server-sent events) — no polling,
 * no flicker, sub-second updates.
 *
 * Usage:
 *   bun run scripts/xxl-viewer.ts
 *   bun run scripts/xxl-viewer.ts --port 8200
 *
 * Then open http://localhost:8199 on your exhibition display.
 * For a wall of screens: open it on each machine, use CSS zoom or
 * font-size to control how much of the canvas each screen shows.
 * URL params:
 *   ?zoom=0.5      — CSS zoom (default: fit to screen)
 *   ?fontSize=8    — override font size in px
 *   ?ox=0&oy=0     — canvas offset (top-left char) for tiled screens
 *   ?cols=200&rows=50 — viewport size in chars (for tiled screens)
 */

import { readFileSync, watchFile, unwatchFile, statSync } from "node:fs";
import { join } from "node:path";

const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--port") ?? "8199");
const CANVAS_PATH = join(import.meta.dir, "..", "scratch", "xxl-canvas.txt");

function readCanvas(): string {
  try {
    return readFileSync(CANVAS_PATH, "utf8");
  } catch {
    return "  (waiting for Dashboard XXL to start rendering...)";
  }
}

// ── SSE clients ──────────────────────────────────────────────

const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>();

// Watch the canvas file for changes and push to all SSE clients
let lastMtime = 0;
const checkInterval = setInterval(() => {
  try {
    const stat = statSync(CANVAS_PATH);
    const mtime = stat.mtimeMs;
    if (mtime > lastMtime) {
      lastMtime = mtime;
      const canvas = readCanvas();
      const data = `data: ${JSON.stringify(canvas)}\n\n`;
      const bytes = new TextEncoder().encode(data);
      for (const controller of sseClients) {
        try { controller.enqueue(bytes); } catch { sseClients.delete(controller); }
      }
    }
  } catch {}
}, 200);

// ── HTML page ────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>WibWob-DOS XXL Exhibition Viewer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #c0c0c0;
    font-family: 'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #canvas {
    white-space: pre;
    line-height: 1.15;
    letter-spacing: 0;
    /* Default: fit to screen. URL params can override. */
  }
  /* Scanline overlay for exhibition feel */
  body::after {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.08) 2px,
      rgba(0,0,0,0.08) 4px
    );
    pointer-events: none;
    z-index: 100;
  }
</style>
</head>
<body>
<pre id="canvas"></pre>
<script>
  const el = document.getElementById('canvas');
  const params = new URLSearchParams(location.search);

  // Viewport cropping for tiled screens
  const ox = parseInt(params.get('ox') || '0');
  const oy = parseInt(params.get('oy') || '0');
  const cols = parseInt(params.get('cols') || '0');
  const rows = parseInt(params.get('rows') || '0');

  function applyCanvas(text) {
    if (ox || oy || cols || rows) {
      // Crop to viewport for tiled display
      const lines = text.split('\\n');
      const cropped = lines.slice(oy, rows ? oy + rows : undefined)
        .map(l => cols ? l.slice(ox, ox + cols) : l.slice(ox));
      el.textContent = cropped.join('\\n');
    } else {
      el.textContent = text;
    }
  }

  // Auto-fit font size to fill the screen
  function autoFit() {
    const fontSize = params.get('fontSize');
    const zoom = params.get('zoom');
    if (fontSize) {
      el.style.fontSize = fontSize + 'px';
    } else if (zoom) {
      el.style.fontSize = '14px';
      document.body.style.zoom = zoom;
    } else {
      // Measure and fit
      const text = el.textContent || '';
      const lines = text.split('\\n');
      const maxCols = Math.max(...lines.map(l => l.length), 1);
      const numRows = lines.length || 1;
      // Fit to viewport with some margin
      const fw = (window.innerWidth * 0.98) / (maxCols * 0.6);  // ~0.6 ch width ratio
      const fh = (window.innerHeight * 0.98) / (numRows * 1.15); // line-height factor
      const fs = Math.min(fw, fh, 24);
      el.style.fontSize = Math.max(1, fs).toFixed(2) + 'px';
    }
  }

  // SSE connection
  const evtSource = new EventSource('/stream');
  evtSource.onmessage = (e) => {
    applyCanvas(JSON.parse(e.data));
    autoFit();
  };
  evtSource.onerror = () => {
    setTimeout(() => location.reload(), 2000);
  };

  // Initial load
  fetch('/canvas').then(r => r.text()).then(t => { applyCanvas(t); autoFit(); });
  window.addEventListener('resize', autoFit);
</script>
</body>
</html>`;

// ── Server ───────────────────────────────────────────────────

Bun.serve({
  port: PORT,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/canvas") {
      return new Response(readCanvas(), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname === "/stream") {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          sseClients.add(controller);
          // Send initial data
          const data = `data: ${JSON.stringify(readCanvas())}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        },
        cancel(controller) {
          sseClients.delete(controller as any);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`\n  ╔══════════════════════════════════════════════════╗`);
console.log(`  ║  WibWob-DOS XXL Exhibition Viewer                ║`);
console.log(`  ║                                                  ║`);
console.log(`  ║  http://localhost:${String(PORT).padEnd(5)}                        ║`);
console.log(`  ║                                                  ║`);
console.log(`  ║  Open on any screen on the network.              ║`);
console.log(`  ║  Canvas auto-updates via SSE.                    ║`);
console.log(`  ║                                                  ║`);
console.log(`  ║  URL params for tiled screens:                   ║`);
console.log(`  ║    ?ox=0&oy=0&cols=200&rows=50                   ║`);
console.log(`  ║    ?fontSize=8  or  ?zoom=0.5                    ║`);
console.log(`  ╚══════════════════════════════════════════════════╝\n`);
console.log(`  Reading canvas from: ${CANVAS_PATH}`);
console.log(`  Watching for changes every 200ms\n`);
