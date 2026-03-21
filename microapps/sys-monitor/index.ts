import os from "node:os";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
  createStack,
  createHeaderBar,
  createStatusBar,
  createProgressBar,
  createKeyValuePanel,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "System Monitor";

function getCpuUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
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

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Live system monitor with CPU, memory, and OS info.",
    menu: [{ category: "applications", order: 204, label: APP_TITLE }],
    palette: { order: 204, label: `Open ${APP_TITLE}` },
    action: () => {
      const timers = new Set<ReturnType<typeof setInterval>>();

      const win = host.createWindow({ title: APP_TITLE, width: 60, height: 18 });

      const header = createHeaderBar(win.body);
      const cpuBar = createProgressBar({ label: "CPU", value: 0, max: 100 });
      const memBar = createProgressBar({ label: "MEM", value: 0, max: 100 });
      const info = createKeyValuePanel({
        entries: [
          { key: "Hostname", value: os.hostname() },
          { key: "Platform", value: `${os.platform()} ${os.arch()}` },
          { key: "CPUs", value: `${os.cpus().length} cores` },
          { key: "Uptime", value: formatUptime(os.uptime()) },
          { key: "Node", value: process.version },
        ],
        border: true,
        label: "System Info",
      });
      const statusBar = createStatusBar(win.body);

      const root = createStack(win.body, [
        { key: "header", basis: 1, part: header },
        { key: "cpu", basis: 1, part: cpuBar },
        { key: "mem", basis: 1, part: memBar },
        { key: "info", basis: "1fr" as const, part: info },
        { key: "status", basis: 1, part: statusBar },
      ]);

      let cpuPct = 0;
      let memInfo = getMemUsage();

      const refresh = () => {
        cpuPct = getCpuUsage();
        memInfo = getMemUsage();

        header.update({ left: APP_TITLE, right: new Date().toLocaleTimeString() });
        cpuBar.update({ value: cpuPct });
        memBar.update({ value: memInfo.pct });
        info.update({
          entries: [
            { key: "Hostname", value: os.hostname() },
            { key: "Platform", value: `${os.platform()} ${os.arch()}` },
            { key: "CPUs", value: `${os.cpus().length} cores` },
            { key: "Uptime", value: formatUptime(os.uptime()) },
            { key: "Memory", value: `${memInfo.used}MB / ${memInfo.total}MB` },
          ],
        });
        statusBar.update({
          left: `CPU: ${cpuPct}%  MEM: ${memInfo.pct}%`,
          right: formatUptime(os.uptime()),
        });
        host.screen.render();
      };

      const doLayout = () => {
        const w = Math.max(1, Number(win.body.width) || 0);
        const h = Math.max(1, Number(win.body.height) || 0);
        root.layout({ top: 0, left: 0, width: w, height: h });
      };

      createTimer(refresh, 2000, timers);
      refresh();

      win.onResize(doLayout);

      win.describeState(() => ({
        summary: `System Monitor — CPU ${cpuPct}%, MEM ${memInfo.pct}%`,
        cpu: cpuPct,
        memoryUsedMB: memInfo.used,
        memoryTotalMB: memInfo.total,
        memoryPercent: memInfo.pct,
        uptime: formatUptime(os.uptime()),
      }));

      win.captureText(() =>
        `CPU: ${cpuPct}%\nMemory: ${memInfo.used}MB / ${memInfo.total}MB (${memInfo.pct}%)\nUptime: ${formatUptime(os.uptime())}`
      );

      win.onRestyle(() => {
        root.restyle();
        host.screen.render();
      });

      win.onCleanup(() => {
        clearTimers(timers);
        root.destroy();
      });

      win.focus();
      doLayout();

      return { ok: true, windowId: win.id };
    },
  });
}
