import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createStatusBar,
  createSplitView,
  createTextViewer,
} from "../../src/services/microapp-sdk.js";
import os from "node:os";

/**
 * Data Dashboard — live-updating system info panels.
 * Teaches: createSplitView, createTextViewer, createStatusBar,
 *          timers, describeState, captureText, onCleanup, onRestyle.
 */
export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open Data Dashboard",
    description: "Open a live system info dashboard.",
    action: () => {
      openDashboard();
      return { ok: true };
    },
  });

  function openDashboard() {
    const win = host.createWindow({
      title: "Data Dashboard",
      width: 70,
      height: 22,
    });

    const split = createSplitView(win.body, {
      direction: "horizontal",
      ratio: 0.5,
      bottomOffset: 1,
    });

    const leftPanel = createTextViewer(split.first, { wrap: true, vi: false });
    const rightPanel = createTextViewer(split.second, { wrap: true, vi: false });
    const status = createStatusBar(win.body);

    let tick = 0;
    let lastSnapshot = { system: "", runtime: "" };

    function formatBytes(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
      return `${(bytes / 1073741824).toFixed(1)} GB`;
    }

    function formatUptime(sec: number): string {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      return `${h}h ${m}m ${s}s`;
    }

    function refresh() {
      tick++;
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const load = os.loadavg();

      const systemInfo = [
        `  ┌─ System ──────────────┐`,
        `  │ Host: ${os.hostname().slice(0, 18).padEnd(18)}│`,
        `  │ OS:   ${os.platform()} ${os.arch()}`.padEnd(28) + `│`,
        `  │ CPUs: ${cpus.length} × ${(cpus[0]?.model ?? "?").slice(0, 12)}`.padEnd(28) + `│`,
        `  │ Mem:  ${formatBytes(usedMem)} / ${formatBytes(totalMem)}`.padEnd(28) + `│`,
        `  │ Free: ${formatBytes(freeMem)}`.padEnd(28) + `│`,
        `  └──────────────────────┘`,
        ``,
        `  Load: ${load.map(l => l.toFixed(2)).join("  ")}`,
        ``,
        `  ▓ ${("█".repeat(Math.round((usedMem / totalMem) * 20))).padEnd(20, "░")} mem`,
      ].join("\n");

      const runtimeInfo = [
        `  ┌─ Runtime ─────────────┐`,
        `  │ Bun ${Bun.version}`.padEnd(28) + `│`,
        `  │ PID: ${process.pid}`.padEnd(28) + `│`,
        `  │ Up:  ${formatUptime(process.uptime())}`.padEnd(28) + `│`,
        `  │ Heap: ${formatBytes(process.memoryUsage().heapUsed)}`.padEnd(28) + `│`,
        `  │ RSS:  ${formatBytes(process.memoryUsage().rss)}`.padEnd(28) + `│`,
        `  └──────────────────────┘`,
        ``,
        `  Tick: ${tick}`,
        ``,
        `  ${new Date().toLocaleTimeString()}`,
      ].join("\n");

      lastSnapshot = { system: systemInfo, runtime: runtimeInfo };
      leftPanel.update({ content: systemInfo });
      rightPanel.update({ content: runtimeInfo });
      status.update({
        left: ` Dashboard │ tick ${tick}`,
        right: `${new Date().toLocaleTimeString()} `,
      });
      host.screen.render();
    }

    refresh();
    const timer = setInterval(refresh, 2000);

    win.setFocusTarget(leftPanel.element);
    win.captureText(() => `${lastSnapshot.system}\n\n${lastSnapshot.runtime}`);

    win.describeState(() => ({
      appType: "wibwob.data-dashboard",
      tick,
      hostname: os.hostname(),
      cpuCount: os.cpus().length,
      memUsedMB: Math.round((os.totalmem() - os.freemem()) / 1048576),
      memTotalMB: Math.round(os.totalmem() / 1048576),
      uptimeSeconds: Math.round(process.uptime()),
    }));

    win.onRestyle(() => {
      leftPanel.update({ content: lastSnapshot.system });
      rightPanel.update({ content: lastSnapshot.runtime });
      status.update({});
    });

    win.onCleanup(() => {
      clearInterval(timer);
      leftPanel.destroy();
      rightPanel.destroy();
      status.destroy();
      split.destroy();
    });
  }
}
