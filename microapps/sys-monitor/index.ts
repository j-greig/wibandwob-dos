import os from "node:os";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
  createHeaderBar,
  createStatusBar,
  createTextViewer,
  registerMicroappHooks,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "System Monitor";

function getCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times;
    totalTick += user + nice + sys + idle + irq;
    totalIdle += idle;
  }
  return Math.round((1 - totalIdle / totalTick) * 100);
}

function getMemUsage(): { used: number; total: number; pct: number } {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    used: Math.round(used / 1024 / 1024),
    total: Math.round(total / 1024 / 1024),
    pct: Math.round((used / total) * 100),
  };
}

function bar(pct: number, width = 30): string {
  const filled = Math.round((pct / 100) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + `] ${pct}%`;
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

function buildContent(cpuPct: number, mem: ReturnType<typeof getMemUsage>): string {
  return [
    `CPU      ${bar(cpuPct)}`,
    `Memory   ${bar(mem.pct)}`,
    `         ${mem.used}MB / ${mem.total}MB`,
    ``,
    `Hostname  ${os.hostname()}`,
    `Platform  ${os.platform()} ${os.arch()}`,
    `CPUs      ${os.cpus().length} cores`,
    `Uptime    ${formatUptime(os.uptime())}`,
    `Runtime   ${process.version}`,
  ].join("\n");
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Live system monitor — CPU, memory, OS info. Refreshes every 2s.",
    menu: [{ category: "applications", order: 204, label: APP_TITLE }],
    palette: { order: 204, label: `Open ${APP_TITLE}` },
    action: () => {
      const timers = new Set<ReturnType<typeof setInterval>>();

      const win = host.createWindow({ title: APP_TITLE, width: 60, height: 14 });

      // Pure CompositionHelpers — all self-position, no createStack needed
      const header = createHeaderBar(win.body, { left: APP_TITLE });
      const viewer = createTextViewer(win.body, { top: 1, bottom: 1 });
      const status = createStatusBar(win.body);

      let cpuPct = 0;
      let memInfo = getMemUsage();

      const refresh = () => {
        cpuPct = getCpuUsage();
        memInfo = getMemUsage();
        const content = buildContent(cpuPct, memInfo);
        header.update({ left: APP_TITLE, right: new Date().toLocaleTimeString() });
        viewer.update({ content });
        status.update({
          left: `CPU: ${cpuPct}%  MEM: ${memInfo.pct}%`,
          right: formatUptime(os.uptime()),
        });
        host.screen.render();
      };

      createTimer(refresh, 2000, timers);
      refresh();

      registerMicroappHooks(win, {
        captureText: () => buildContent(cpuPct, memInfo),
        describeState: () => ({
          summary: `System Monitor — CPU ${cpuPct}%, MEM ${memInfo.pct}%`,
          cpu: cpuPct,
          memoryUsedMB: memInfo.used,
          memoryTotalMB: memInfo.total,
          memoryPercent: memInfo.pct,
          uptime: formatUptime(os.uptime()),
        }),
        onCleanup: () => {
          clearTimers(timers);
          header.destroy();
          viewer.destroy();
          status.destroy();
        },
        onRestyle: () => {
          header.update({});
          viewer.update({});
          status.update({});
          host.screen.render();
        },
      });

      win.focus();
      return { ok: true, windowId: win.id };
    },
  });
}
