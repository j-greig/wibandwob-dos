/**
 * Dashboard — blessed-contrib powered system dashboard.
 *
 * Shows live-updating charts, gauges, sparklines, logs, donut,
 * and a data table inside a single WibWob-DOS window.
 */

import blessed from "blessed";
import contrib from "blessed-contrib";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

// ── data generators ──────────────────────────────────────────

function sinWave(offset: number, len: number, amp: number, freq: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(amp * Math.sin(freq * (i + offset)));
  return out;
}

function randHistory(len: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  let v = lo + Math.random() * (hi - lo);
  for (let i = 0; i < len; i++) {
    v += (Math.random() - 0.5) * (hi - lo) * 0.15;
    v = Math.max(lo, Math.min(hi, v));
    out.push(Math.round(v));
  }
  return out;
}

function xLabels(len: number): string[] {
  return Array.from({ length: len }, (_, i) => `${i}`);
}

// ── module setup ─────────────────────────────────────────────

export default function setup(host: MicroappHost) {

  host.registerCommand({
    id: "open",
    label: "Dashboard",
    menu: [{ category: "applications", order: 55, label: "Dashboard" }],
    palette: { order: 220, label: "Dashboard" },
    action: () => {
      const win = host.createWindow({
        title: "Dashboard",
        width: 140,
        height: 45,
      });

      // ── grid layout ──────────────────────────────────

      const grid = new contrib.grid({
        rows: 12,
        cols: 12,
        screen: win.body as any,
      });

      // ── row 0: line chart (top half-left) ────────────

      const line = grid.set(0, 0, 4, 6, contrib.line, {
        label: " CPU & Memory ",
        showLegend: true,
        legend: { width: 12 },
        style: {
          line: "cyan",
          text: "white",
          baseline: "white",
        },
      }) as any;

      // ── row 0: bar chart (top half-right) ────────────

      const bar = grid.set(0, 6, 4, 6, contrib.bar, {
        label: " Network I/O (KB/s) ",
        barWidth: 6,
        barSpacing: 2,
        maxHeight: 100,
        style: { fg: "green" },
      }) as any;

      // ── row 4: sparklines ────────────────────────────

      const spark = grid.set(4, 0, 2, 6, contrib.sparkline, {
        label: " Load Average ",
        tags: true,
        style: { fg: "cyan" },
      }) as any;

      // ── row 4: donut ─────────────────────────────────

      const donut = grid.set(4, 6, 2, 3, contrib.donut, {
        label: " Disk Usage ",
        radius: 8,
        arcWidth: 3,
        remainColor: "black",
        yPadding: 1,
      }) as any;

      // ── row 4: gauge ─────────────────────────────────

      const gauge = grid.set(4, 9, 2, 3, contrib.gauge, {
        label: " Uptime Health ",
        stroke: "green",
        fill: "white",
      }) as any;

      // ── row 6: log ───────────────────────────────────

      const log = grid.set(6, 0, 3, 6, contrib.log, {
        label: " System Log ",
        fg: "green",
        selectedFg: "green",
        bufferLength: 30,
      }) as any;

      // ── row 6: table ─────────────────────────────────

      const table = grid.set(6, 6, 3, 6, contrib.table, {
        label: " Process Table ",
        columnSpacing: 2,
        columnWidth: [18, 8, 8, 10],
        fg: "white",
        selectedFg: "white",
        selectedBg: "blue",
        keys: true,
        interactive: true,
      }) as any;

      // ── row 9: second line chart (bottom) ────────────

      const line2 = grid.set(9, 0, 3, 12, contrib.line, {
        label: " Request Latency (ms) ",
        style: {
          line: "yellow",
          text: "white",
          baseline: "white",
        },
        xLabelPadding: 3,
        xPadding: 5,
      }) as any;

      // ── data state ───────────────────────────────────

      let tick = 0;
      const HISTORY = 40;
      let cpuHistory = randHistory(HISTORY, 20, 80);
      let memHistory = randHistory(HISTORY, 40, 90);
      let latencyHistory = randHistory(HISTORY, 5, 120);
      const labels = xLabels(HISTORY);

      const logMessages = [
        "sshd: accepted publickey for admin",
        "nginx: GET /api/health 200 2ms",
        "cron: scheduled backup started",
        "docker: container wibwob-web healthy",
        "systemd: reload complete",
        "postgres: checkpoint complete",
        "redis: background save finished",
        "certbot: certificate renewal OK",
        "ufw: ALLOW IN eth0 80/tcp",
        "node: worker 4 listening on :3000",
        "bun: hot reload triggered",
        "k8s: pod wibwob-api-7f ready",
        "grafana: alert resolved: CPU spike",
        "haproxy: backend web UP 3/3",
        "nginx: GET /dashboard 200 14ms",
        "docker: image prune freed 2.3GB",
        "sshd: session closed for admin",
        "postgres: autovacuum: pages removed 847",
        "systemd: wibwob-worker.service started",
        "nginx: GET /api/data 200 8ms",
      ];

      const processes = [
        ["wibwob-api", "node", "148MB", "2.3%"],
        ["postgres", "postgres", "312MB", "1.1%"],
        ["nginx", "root", "24MB", "0.4%"],
        ["redis-server", "redis", "86MB", "0.2%"],
        ["bun", "bun", "96MB", "3.7%"],
        ["dockerd", "root", "204MB", "0.8%"],
        ["sshd", "root", "4MB", "0.0%"],
        ["grafana-svr", "grafana", "178MB", "1.4%"],
        ["haproxy", "root", "16MB", "0.1%"],
        ["certbot", "root", "42MB", "0.0%"],
      ];

      // ── update loop ──────────────────────────────────

      const update = () => {
        tick++;

        // Line chart: CPU + Memory
        cpuHistory.push(Math.max(5, Math.min(100, cpuHistory[cpuHistory.length - 1]! + (Math.random() - 0.48) * 12)));
        cpuHistory.shift();
        memHistory.push(Math.max(20, Math.min(100, memHistory[memHistory.length - 1]! + (Math.random() - 0.5) * 6)));
        memHistory.shift();

        line.setData([
          { title: "CPU %", x: labels, y: cpuHistory.map(Math.round), style: { line: "cyan" } },
          { title: "Mem %", x: labels, y: memHistory.map(Math.round), style: { line: "magenta" } },
        ]);

        // Bar chart: network
        const netLabels = ["eth0↓", "eth0↑", "lo↓", "lo↑", "wg0↓", "wg0↑"];
        const netData = netLabels.map(() => Math.round(Math.random() * 80 + 5));
        bar.setData({ titles: netLabels, data: netData });

        // Sparklines
        const load1 = sinWave(tick, 30, 2, 0.2).map(v => Math.round(Math.abs(v) * 10 + 10));
        const load5 = sinWave(tick * 0.5, 30, 1.5, 0.15).map(v => Math.round(Math.abs(v) * 10 + 8));
        spark.setData(["1min", "5min"], [load1, load5]);

        // Donut
        const diskUsed = 55 + Math.round(Math.sin(tick * 0.05) * 15);
        donut.setData([
          { label: "Used", percent: diskUsed, color: diskUsed > 80 ? "red" : "cyan" },
        ]);

        // Gauge
        const health = Math.min(100, Math.max(0, 92 + Math.round(Math.sin(tick * 0.03) * 8)));
        gauge.setPercent(health);

        // Log — add a message every few ticks
        if (tick % 3 === 0) {
          const msg = logMessages[Math.floor(Math.random() * logMessages.length)]!;
          const ts = new Date().toISOString().slice(11, 19);
          log.log(`${ts} ${msg}`);
        }

        // Table
        const shuffled = [...processes].sort(() => Math.random() - 0.5).slice(0, 7);
        // Jitter the memory and CPU values
        const jittered = shuffled.map(([name, user, mem, cpu]) => {
          const memVal = parseInt(mem as string) + Math.round((Math.random() - 0.5) * 20);
          const cpuVal = (parseFloat(cpu as string) + (Math.random() - 0.5) * 1.5).toFixed(1);
          return [name, user, `${memVal}MB`, `${cpuVal}%`];
        });
        table.setData({
          headers: ["Process", "User", "Memory", "CPU"],
          data: jittered,
        });

        // Latency line
        latencyHistory.push(Math.max(1, Math.min(200, latencyHistory[latencyHistory.length - 1]! + (Math.random() - 0.5) * 30)));
        latencyHistory.shift();
        line2.setData([
          { title: "p99", x: labels, y: latencyHistory.map(Math.round), style: { line: "yellow" } },
        ]);

        host.screen.render();
      };

      // Initial render
      update();

      // Tick every second
      const timer = setInterval(update, 1000);

      // ── lifecycle ────────────────────────────────────

      win.cleanup(() => {
        clearInterval(timer);
      });

      win.describeState(() => ({
        summary: `System dashboard — tick ${tick}, CPU ~${Math.round(cpuHistory[cpuHistory.length - 1]!)}%, Mem ~${Math.round(memHistory[memHistory.length - 1]!)}%`,
      }));

      win.captureText(() => `Dashboard tick=${tick}`);

      win.onRestyle(() => {
        // blessed-contrib widgets don't support restyle well,
        // but at least re-render
        host.screen.render();
      });

      win.focus();
    },
  });
}
