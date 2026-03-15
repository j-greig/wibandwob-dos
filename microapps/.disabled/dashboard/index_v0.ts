/**
 * Dashboard — blessed-contrib powered multi-tab dashboard.
 *
 * Tab 1: System Overview — line charts, bar, sparklines, donut, gauge, log, table
 * Tab 2: Network Monitor — stacked bars, sparklines, connection log
 * Tab 3: Application Metrics — LCD counters, gauge list, multi-line charts
 * Tab 4: World Map — geo markers, event log, gauges
 * Tab 5: Creative Lab — figlet clock, animated ASCII art, colour gradients
 */

import blessed from "blessed";
import contrib from "blessed-contrib";
import { spawnSync } from "node:child_process";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

// ── helpers ──────────────────────────────────────────────────

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

function figlet(text: string, font = "small"): string {
  const r = spawnSync("figlet", ["-f", font, text], { encoding: "utf8" });
  return r.status === 0 ? r.stdout : `  ${text}\n`;
}

function ansiGradientLine(width: number, hueStart: number, hueEnd: number): string {
  let line = "";
  for (let i = 0; i < width; i++) {
    const t = i / Math.max(1, width - 1);
    const h = hueStart + t * (hueEnd - hueStart);
    const [r, g, b] = hslToRgb(h / 360, 0.8, 0.5);
    line += `\x1b[38;2;${r};${g};${b}m█`;
  }
  return line + "\x1b[0m";
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// ── tab infrastructure ───────────────────────────────────────

interface Tab {
  name: string;
  container: blessed.Widgets.BoxElement;
  setup: () => void;
  update: () => void;
  cleanup: () => void;
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
        height: 48,
      });

      const body = win.body;
      const screen = host.screen;
      let tick = 0;
      let activeTab = 0;
      const tabs: Tab[] = [];
      const timers: ReturnType<typeof setInterval>[] = [];

      // ── tab bar ──────────────────────────────────────

      const tabBar = blessed.box({
        parent: body,
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        tags: true,
        style: { fg: "white", bg: "black" },
      });

      const contentArea = blessed.box({
        parent: body,
        top: 1,
        left: 0,
        right: 0,
        bottom: 0,
      });

      function renderTabBar() {
        const names = tabs.map((t, i) =>
          i === activeTab ? `{inverse} ${i + 1}:${t.name} {/inverse}` : ` ${i + 1}:${t.name} `
        );
        tabBar.setContent(`{bold}${names.join("│")}{/bold}  {gray-fg}[1-5] switch tabs{/gray-fg}`);
        tabBar.tags = true;
      }

      function switchTab(idx: number) {
        if (idx < 0 || idx >= tabs.length || idx === activeTab) return;
        tabs[activeTab]!.container.hide();
        activeTab = idx;
        tabs[activeTab]!.container.show();
        renderTabBar();
        try { tabs[activeTab]?.update(); } catch {}
        screen.render();
      }

      function createTabContainer(): blessed.Widgets.BoxElement {
        return blessed.box({
          parent: contentArea,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        });
      }

      // ═══════════════════════════════════════════════════
      // TAB 1: System Overview
      // ═══════════════════════════════════════════════════

      (() => {
        const container = createTabContainer();
        const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

        const line = grid.set(0, 0, 4, 6, contrib.line, {
          label: " CPU & Memory ",
          showLegend: true,
          legend: { width: 12 },
          style: { line: "cyan", text: "white", baseline: "white" },
        }) as any;

        const bar = grid.set(0, 6, 4, 6, contrib.bar, {
          label: " Network I/O (KB/s) ",
          barWidth: 6, barSpacing: 2, maxHeight: 100,
          style: { fg: "green" },
        }) as any;

        const spark = grid.set(4, 0, 2, 6, contrib.sparkline, {
          label: " Load Average ", tags: true, style: { fg: "cyan" },
        }) as any;

        const donut = grid.set(4, 6, 2, 3, contrib.donut, {
          label: " Disk Usage ", radius: 8, arcWidth: 3,
          remainColor: "black", yPadding: 1,
        }) as any;

        const gauge = grid.set(4, 9, 2, 3, contrib.gauge, {
          label: " Uptime Health ", stroke: "green", fill: "white",
        }) as any;

        const log = grid.set(6, 0, 3, 6, contrib.log, {
          label: " System Log ", fg: "green", selectedFg: "green", bufferLength: 30,
        }) as any;

        const table = grid.set(6, 6, 3, 6, contrib.table, {
          label: " Process Table ", columnSpacing: 2,
          columnWidth: [18, 8, 8, 10],
          fg: "white", selectedFg: "white", selectedBg: "blue",
        }) as any;

        const line2 = grid.set(9, 0, 3, 12, contrib.line, {
          label: " Request Latency (ms) ",
          style: { line: "yellow", text: "white", baseline: "white" },
          xLabelPadding: 3, xPadding: 5,
        }) as any;

        const H = 40;
        let cpu = randHistory(H, 20, 80), mem = randHistory(H, 40, 90);
        let lat = randHistory(H, 5, 120);
        const xl = xLabels(H);

        const logMsgs = [
          "sshd: accepted publickey for admin", "nginx: GET /api/health 200 2ms",
          "cron: scheduled backup started", "docker: container wibwob-web healthy",
          "postgres: checkpoint complete", "redis: background save finished",
          "bun: hot reload triggered", "k8s: pod wibwob-api-7f ready",
        ];
        const procs = [
          ["wibwob-api","node","148MB","2.3%"], ["postgres","postgres","312MB","1.1%"],
          ["nginx","root","24MB","0.4%"], ["redis-server","redis","86MB","0.2%"],
          ["bun","bun","96MB","3.7%"], ["dockerd","root","204MB","0.8%"],
        ];

        tabs.push({
          name: "System",
          container,
          setup: () => {},
          update: () => {
            cpu.push(Math.max(5, Math.min(100, cpu[cpu.length-1]! + (Math.random()-0.48)*12))); cpu.shift();
            mem.push(Math.max(20, Math.min(100, mem[mem.length-1]! + (Math.random()-0.5)*6))); mem.shift();
            line.setData([
              { title: "CPU %", x: xl, y: cpu.map(Math.round), style: { line: "cyan" } },
              { title: "Mem %", x: xl, y: mem.map(Math.round), style: { line: "magenta" } },
            ]);
            const nl = ["eth0↓","eth0↑","lo↓","lo↑","wg0↓","wg0↑"];
            bar.setData({ titles: nl, data: nl.map(() => Math.round(Math.random()*80+5)) });
            spark.setData(["1m","5m"], [
              sinWave(tick,30,2,0.2).map(v => Math.round(Math.abs(v)*10+10)),
              sinWave(tick*0.5,30,1.5,0.15).map(v => Math.round(Math.abs(v)*10+8)),
            ]);
            const du = 55 + Math.round(Math.sin(tick*0.05)*15);
            donut.setData([{ label: "Used", percent: du, color: du>80?"red":"cyan" }]);
            gauge.setPercent(Math.min(100, Math.max(0, 92+Math.round(Math.sin(tick*0.03)*8))));
            if (tick%3===0) log.log(`${new Date().toISOString().slice(11,19)} ${logMsgs[Math.floor(Math.random()*logMsgs.length)]}`);
            const sh = [...procs].sort(()=>Math.random()-0.5).slice(0,5).map(([n,u,m,c])=>[n,u,`${parseInt(m as string)+Math.round((Math.random()-0.5)*20)}MB`,`${(parseFloat(c as string)+(Math.random()-0.5)*1.5).toFixed(1)}%`]);
            table.setData({ headers: ["Process","User","Memory","CPU"], data: sh });
            lat.push(Math.max(1, Math.min(200, lat[lat.length-1]! + (Math.random()-0.5)*30))); lat.shift();
            line2.setData([{ title: "p99", x: xl, y: lat.map(Math.round), style: { line: "yellow" } }]);
          },
          cleanup: () => {},
        });
      })();

      // ═══════════════════════════════════════════════════
      // TAB 2: Network Monitor
      // ═══════════════════════════════════════════════════

      (() => {
        const container = createTabContainer();
        container.hide();
        const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

        const bw = grid.set(0, 0, 5, 8, contrib.line, {
          label: " Bandwidth (Mbps) ",
          showLegend: true, legend: { width: 14 },
          style: { line: "green", text: "white", baseline: "white" },
        }) as any;

        const connGauge = grid.set(0, 8, 2, 4, contrib.gauge, {
          label: " Active Connections ", stroke: "cyan", fill: "white",
        }) as any;

        const pktSpark = grid.set(2, 8, 3, 4, contrib.sparkline, {
          label: " Packets/sec ", tags: true, style: { fg: "green" },
        }) as any;

        const connLog = grid.set(5, 0, 4, 6, contrib.log, {
          label: " Connection Log ", fg: "cyan", selectedFg: "cyan", bufferLength: 40,
        }) as any;

        const portTable = grid.set(5, 6, 4, 6, contrib.table, {
          label: " Open Ports ",
          columnSpacing: 2, columnWidth: [8, 12, 10, 14],
          fg: "white", selectedFg: "white", selectedBg: "blue",
        }) as any;

        const errLine = grid.set(9, 0, 3, 12, contrib.line, {
          label: " Error Rate (per min) ",
          style: { line: "red", text: "white", baseline: "white" },
        }) as any;

        const H = 40, xl = xLabels(H);
        let dlHist = randHistory(H, 10, 90), ulHist = randHistory(H, 5, 40);
        let errHist = randHistory(H, 0, 30);
        const connMsgs = [
          "TCP 192.168.1.42:443 ESTABLISHED", "UDP 10.0.0.1:53 → dns.google",
          "TCP 172.16.0.5:8080 SYN_RECV", "TCP 192.168.1.100:22 ESTABLISHED",
          "ICMP 8.8.8.8 echo reply 14ms", "TCP 10.0.0.50:3000 FIN_WAIT",
          "UDP 224.0.0.1:5353 mDNS", "TCP 172.16.0.12:443 TIME_WAIT",
        ];
        const ports = [
          ["80","nginx","LISTEN","0.0.0.0:80"], ["443","nginx","LISTEN","0.0.0.0:443"],
          ["22","sshd","LISTEN","0.0.0.0:22"], ["5432","postgres","LISTEN","127.0.0.1:5432"],
          ["6379","redis","LISTEN","127.0.0.1:6379"], ["3000","bun","LISTEN","0.0.0.0:3000"],
          ["8099","wibwob","LISTEN","127.0.0.1:8099"], ["9222","chrome","LISTEN","127.0.0.1:9222"],
        ];

        tabs.push({
          name: "Network",
          container,
          setup: () => {},
          update: () => {
            dlHist.push(Math.max(0, Math.min(100, dlHist[dlHist.length-1]!+(Math.random()-0.5)*15))); dlHist.shift();
            ulHist.push(Math.max(0, Math.min(60, ulHist[ulHist.length-1]!+(Math.random()-0.5)*10))); ulHist.shift();
            bw.setData([
              { title: "Download", x: xl, y: dlHist.map(Math.round), style: { line: "green" } },
              { title: "Upload", x: xl, y: ulHist.map(Math.round), style: { line: "yellow" } },
            ]);
            connGauge.setPercent(Math.min(100, Math.max(10, 45+Math.round(Math.sin(tick*0.08)*30))));
            pktSpark.setData(["IN","OUT"], [
              sinWave(tick,20,500,0.3).map(v => Math.round(Math.abs(v)+200)),
              sinWave(tick*0.7,20,300,0.25).map(v => Math.round(Math.abs(v)+100)),
            ]);
            if (tick%2===0) connLog.log(`${new Date().toISOString().slice(11,19)} ${connMsgs[Math.floor(Math.random()*connMsgs.length)]}`);
            const sp = [...ports].sort(()=>Math.random()-0.5).slice(0,6);
            portTable.setData({ headers: ["Port","Service","State","Address"], data: sp });
            errHist.push(Math.max(0, Math.min(50, errHist[errHist.length-1]!+(Math.random()-0.5)*8))); errHist.shift();
            errLine.setData([{ title: "5xx", x: xl, y: errHist.map(Math.round), style: { line: "red" } }]);
          },
          cleanup: () => {},
        });
      })();

      // ═══════════════════════════════════════════════════
      // TAB 3: Application Metrics
      // ═══════════════════════════════════════════════════

      (() => {
        const container = createTabContainer();
        container.hide();
        const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

        const lcd = grid.set(0, 0, 3, 4, contrib.lcd, {
          label: " Requests/sec ",
          segmentWidth: 0.06, segmentInterval: 0.11, strokeWidth: 0.1,
          elements: 5, display: "00000", elementSpacing: 4, elementPadding: 2,
          color: "green",
        }) as any;

        const lcd2 = grid.set(0, 4, 3, 4, contrib.lcd, {
          label: " Active Users ",
          segmentWidth: 0.06, segmentInterval: 0.11, strokeWidth: 0.1,
          elements: 4, display: "0000", elementSpacing: 4, elementPadding: 2,
          color: "cyan",
        }) as any;

        const lcd3 = grid.set(0, 8, 3, 4, contrib.lcd, {
          label: " Queue Depth ",
          segmentWidth: 0.06, segmentInterval: 0.11, strokeWidth: 0.1,
          elements: 3, display: "000", elementSpacing: 4, elementPadding: 2,
          color: "yellow",
        }) as any;

        const gaugeList = grid.set(3, 0, 3, 6, contrib.gaugeList, {
          label: " Service Health ",
          gauges: [
            { stack: [95] },
            { stack: [88] },
            { stack: [99] },
            { stack: [72] },
          ],
          style: { fg: "white" },
        }) as any;

        const respLine = grid.set(3, 6, 3, 6, contrib.line, {
          label: " Response Times (ms) ",
          showLegend: true, legend: { width: 10 },
          style: { line: "cyan", text: "white", baseline: "white" },
        }) as any;

        const deployLog = grid.set(6, 0, 3, 6, contrib.log, {
          label: " Deploy Log ", fg: "magenta", selectedFg: "magenta", bufferLength: 30,
        }) as any;

        const featureTable = grid.set(6, 6, 3, 6, contrib.table, {
          label: " Feature Flags ",
          columnSpacing: 2, columnWidth: [22, 10, 10, 12],
          fg: "white", selectedFg: "white", selectedBg: "blue",
        }) as any;

        const throughput = grid.set(9, 0, 3, 12, contrib.line, {
          label: " Throughput (req/min) ",
          style: { line: "green", text: "white", baseline: "white" },
        }) as any;

        const H = 40, xl = xLabels(H);
        let p50 = randHistory(H, 5, 50), p95 = randHistory(H, 20, 150), p99 = randHistory(H, 50, 300);
        let tput = randHistory(H, 500, 2000);
        let rps = 1200, users = 340, queue = 12;

        const deployMsgs = [
          "v2.14.3 deployed to production", "canary: 10% traffic shifted",
          "rollback: v2.14.2 restored", "feature: dark-mode enabled 50%",
          "hotfix: memory leak patched", "scale: +2 pods (CPU > 80%)",
          "build: image wibwob:latest pushed", "test: 847/847 passed",
        ];
        const features = [
          ["dark-mode","enabled","50%","experiment"], ["new-editor","enabled","100%","released"],
          ["ai-assist","enabled","25%","canary"], ["v3-api","disabled","0%","dev"],
          ["websockets","enabled","100%","released"], ["markdown-v2","enabled","75%","rollout"],
          ["image-cache","enabled","100%","released"], ["lazy-load","disabled","0%","planned"],
        ];

        tabs.push({
          name: "App Metrics",
          container,
          setup: () => {},
          update: () => {
            rps = Math.max(100, Math.min(9999, rps + Math.round((Math.random()-0.5)*200)));
            users = Math.max(10, Math.min(9999, users + Math.round((Math.random()-0.5)*50)));
            queue = Math.max(0, Math.min(999, queue + Math.round((Math.random()-0.5)*5)));
            lcd.setDisplay(String(rps).padStart(5, "0"));
            lcd2.setDisplay(String(users).padStart(4, "0"));
            lcd3.setDisplay(String(queue).padStart(3, "0"));

            gaugeList.setGauges([
              { stack: [Math.min(100, Math.max(50, 95+Math.round((Math.random()-0.5)*10)))] },
              { stack: [Math.min(100, Math.max(50, 88+Math.round((Math.random()-0.5)*15)))] },
              { stack: [Math.min(100, Math.max(70, 99+Math.round((Math.random()-0.5)*5)))] },
              { stack: [Math.min(100, Math.max(30, 72+Math.round((Math.random()-0.5)*20)))] },
            ]);

            p50.push(Math.max(1,Math.min(80,p50[p50.length-1]!+(Math.random()-0.5)*10))); p50.shift();
            p95.push(Math.max(10,Math.min(200,p95[p95.length-1]!+(Math.random()-0.5)*20))); p95.shift();
            p99.push(Math.max(30,Math.min(400,p99[p99.length-1]!+(Math.random()-0.5)*40))); p99.shift();
            respLine.setData([
              { title: "p50", x: xl, y: p50.map(Math.round), style: { line: "green" } },
              { title: "p95", x: xl, y: p95.map(Math.round), style: { line: "yellow" } },
              { title: "p99", x: xl, y: p99.map(Math.round), style: { line: "red" } },
            ]);

            if (tick%4===0) deployLog.log(`${new Date().toISOString().slice(11,19)} ${deployMsgs[Math.floor(Math.random()*deployMsgs.length)]}`);
            const sf = [...features].sort(()=>Math.random()-0.5).slice(0,6);
            featureTable.setData({ headers: ["Feature","Status","Rollout","Type"], data: sf });

            tput.push(Math.max(100,Math.min(3000,tput[tput.length-1]!+(Math.random()-0.5)*200))); tput.shift();
            throughput.setData([{ title: "req/min", x: xl, y: tput.map(Math.round), style: { line: "green" } }]);
          },
          cleanup: () => {},
        });
      })();

      // ═══════════════════════════════════════════════════
      // TAB 4: World Map + Geo Events
      // ═══════════════════════════════════════════════════

      (() => {
        const container = createTabContainer();
        container.hide();
        const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

        const map = grid.set(0, 0, 6, 8, contrib.map, {
          label: " Global Traffic ",
          style: { shapeColor: "cyan" },
        }) as any;

        const regionGauge = grid.set(0, 8, 3, 4, contrib.gaugeList, {
          label: " Region Load ",
          gauges: [
            { stack: [65] },
            { stack: [82] },
            { stack: [45] },
          ],
          style: { fg: "white" },
        }) as any;

        const regionSpark = grid.set(3, 8, 3, 4, contrib.sparkline, {
          label: " Latency by Region ", tags: true, style: { fg: "yellow" },
        }) as any;

        const geoLog = grid.set(6, 0, 3, 6, contrib.log, {
          label: " Geo Events ", fg: "green", selectedFg: "green", bufferLength: 30,
        }) as any;

        const cdnTable = grid.set(6, 6, 3, 6, contrib.table, {
          label: " CDN Nodes ",
          columnSpacing: 2, columnWidth: [14, 10, 10, 12],
          fg: "white", selectedFg: "white", selectedBg: "blue",
        }) as any;

        const globalLine = grid.set(9, 0, 3, 12, contrib.line, {
          label: " Global Requests/sec ",
          showLegend: true, legend: { width: 10 },
          style: { line: "cyan", text: "white", baseline: "white" },
        }) as any;

        const cities = [
          { lon: -73.94, lat: 40.67, name: "New York" },
          { lon: -0.12, lat: 51.5, name: "London" },
          { lon: 139.69, lat: 35.68, name: "Tokyo" },
          { lon: -122.41, lat: 37.77, name: "San Francisco" },
          { lon: 2.35, lat: 48.85, name: "Paris" },
          { lon: 13.40, lat: 52.52, name: "Berlin" },
          { lon: 151.21, lat: -33.87, name: "Sydney" },
          { lon: 103.85, lat: 1.35, name: "Singapore" },
          { lon: -46.63, lat: -23.55, name: "São Paulo" },
        ];
        const geoMsgs = cities.map(c => `${c.name}: ${Math.round(Math.random()*500+100)} req/s`);
        const cdnNodes = [
          ["us-east-1","Virginia","active","32ms"], ["eu-west-1","Ireland","active","18ms"],
          ["ap-northeast-1","Tokyo","active","45ms"], ["ap-southeast-1","Singapore","active","52ms"],
          ["sa-east-1","São Paulo","active","78ms"], ["eu-central-1","Frankfurt","active","22ms"],
        ];

        const H = 40, xl = xLabels(H);
        let euHist = randHistory(H, 200, 800), usHist = randHistory(H, 300, 1200), apHist = randHistory(H, 100, 500);

        tabs.push({
          name: "World Map",
          container,
          setup: () => {},
          update: () => {
            // Animate markers — different cities light up each tick
            const active = [0,1,2].map(() => cities[Math.floor(Math.random()*cities.length)]!);
            const markers = active.map(c => ({
              lon: c.lon + (Math.random()-0.5)*2,
              lat: c.lat + (Math.random()-0.5)*2,
              color: "red",
              char: "X",
            }));
            map.clearMarkers();
            for (const m of markers) map.addMarker(m);

            regionGauge.setGauges([
              { stack: [Math.min(100, Math.max(20, 65+Math.round((Math.random()-0.5)*30)))] },
              { stack: [Math.min(100, Math.max(20, 82+Math.round((Math.random()-0.5)*25)))] },
              { stack: [Math.min(100, Math.max(20, 45+Math.round((Math.random()-0.5)*20)))] },
            ]);

            regionSpark.setData(["EU","US","AP"], [
              sinWave(tick,20,30,0.2).map(v => Math.round(Math.abs(v)+15)),
              sinWave(tick*0.8,20,25,0.25).map(v => Math.round(Math.abs(v)+20)),
              sinWave(tick*0.6,20,40,0.15).map(v => Math.round(Math.abs(v)+30)),
            ]);

            if (tick%2===0) geoLog.log(`${new Date().toISOString().slice(11,19)} ${geoMsgs[Math.floor(Math.random()*geoMsgs.length)]}`);
            const sn = [...cdnNodes].map(([id,loc,st,lat]) => [id,loc,st,`${parseInt(lat)+Math.round((Math.random()-0.5)*10)}ms`]);
            cdnTable.setData({ headers: ["Node","Location","Status","Latency"], data: sn });

            euHist.push(Math.max(50,Math.min(1000,euHist[euHist.length-1]!+(Math.random()-0.5)*100))); euHist.shift();
            usHist.push(Math.max(100,Math.min(1500,usHist[usHist.length-1]!+(Math.random()-0.5)*120))); usHist.shift();
            apHist.push(Math.max(50,Math.min(800,apHist[apHist.length-1]!+(Math.random()-0.5)*80))); apHist.shift();
            globalLine.setData([
              { title: "EU", x: xl, y: euHist.map(Math.round), style: { line: "cyan" } },
              { title: "US", x: xl, y: usHist.map(Math.round), style: { line: "green" } },
              { title: "AP", x: xl, y: apHist.map(Math.round), style: { line: "yellow" } },
            ]);
          },
          cleanup: () => {},
        });
      })();

      // ═══════════════════════════════════════════════════
      // TAB 5: Creative Lab — figlet, gradients, animation
      // ═══════════════════════════════════════════════════

      (() => {
        const container = createTabContainer();
        container.hide();

        // Top: figlet clock
        const clockBox = blessed.box({
          parent: container,
          top: 0, left: 0, right: 0, height: 8,
          label: " Figlet Clock ",
          border: { type: "line" },
          style: { fg: "cyan", border: { fg: "cyan" } },
        });

        // Middle: gradient bands
        const gradientBox = blessed.box({
          parent: container,
          top: 8, left: 0, width: "50%", height: 12,
          label: " Colour Gradients ",
          border: { type: "line" },
          style: { fg: "white", border: { fg: "magenta" } },
          tags: false,
        });

        // Middle right: ASCII art animation
        const artBox = blessed.box({
          parent: container,
          top: 8, left: "50%", right: 0, height: 12,
          label: " Animated Art ",
          border: { type: "line" },
          style: { fg: "green", border: { fg: "green" } },
          tags: false,
        });

        // Bottom: figlet marquee
        const marqueeBox = blessed.box({
          parent: container,
          top: 20, left: 0, right: 0, bottom: 0,
          label: " Figlet Marquee ",
          border: { type: "line" },
          style: { fg: "yellow", border: { fg: "yellow" } },
        });

        // Pre-render some figlet words for marquee
        const words = ["WIBWOB", "DOS", "SYMBIENT", "DASHBOARD", "BLESSED", "CONTRIB"];
        let marqueeIdx = 0;

        // ASCII art frames — simple animation
        const artFrames = [
          [
            "    ╔══╗    ",
            "    ║◉◉║    ",
            "    ║──║    ",
            "    ╚══╝    ",
            "   /│  │\\   ",
            "  / │  │ \\  ",
            " ╱  └──┘  ╲ ",
          ],
          [
            "    ╔══╗    ",
            "    ║◉ ║    ",
            "    ║──║    ",
            "    ╚══╝    ",
            "  ─/│  │\\─  ",
            "  / │  │ \\  ",
            " ╱  └──┘  ╲ ",
          ],
          [
            "    ╔══╗    ",
            "    ║ ◉║    ",
            "    ║──║    ",
            "    ╚══╝    ",
            "   /│  │\\   ",
            "  ─ │  │ ─  ",
            " ╱  └──┘  ╲ ",
          ],
          [
            "    ╔══╗    ",
            "    ║◉◉║    ",
            "    ║▬▬║    ",
            "    ╚══╝    ",
            "   /│  │\\   ",
            "  / │  │ \\  ",
            " ╱  └──┘  ╲ ",
          ],
        ];
        let artFrame = 0;

        tabs.push({
          name: "Creative",
          container,
          setup: () => {},
          update: () => {
            // Figlet clock
            const now = new Date();
            const timeStr = now.toTimeString().slice(0, 8);
            const clockFig = figlet(timeStr, "big");
            clockBox.setContent(clockFig);

            // Gradient bands — shifting hues
            const w = (gradientBox.width as number || 50) - 2;
            const lines: string[] = [];
            for (let row = 0; row < 8; row++) {
              const hueStart = (tick * 5 + row * 40) % 360;
              lines.push(ansiGradientLine(w, hueStart, hueStart + 180));
            }
            gradientBox.setContent(lines.join("\n"));

            // ASCII art animation
            artFrame = (artFrame + 1) % artFrames.length;
            const frame = artFrames[artFrame]!;
            artBox.setContent("\n" + frame.join("\n"));

            // Figlet marquee — cycle through words
            if (tick % 5 === 0) {
              marqueeIdx = (marqueeIdx + 1) % words.length;
            }
            const word = words[marqueeIdx]!;
            const marqueeFig = figlet(word, "slant");
            marqueeBox.setContent(marqueeFig);
          },
          cleanup: () => {},
        });
      })();

      // ═══════════════════════════════════════════════════
      // TAB 6: Maximalist Grid — figlet + pattern mosaic
      // ═══════════════════════════════════════════════════

      (() => {
        const container = createTabContainer();
        container.hide();

        // 6×8 grid of boxes — some large (figlet), some small (patterns)
        // Layout (rows 0-47, cols 0-139 approx):
        //
        //  ┌─────────────SYMBIENT──────────────┐┌──pattern──┐┌──pattern──┐┌──pattern──┐
        //  │          (figlet slant)            ││  ░▒▓█▓▒░  ││  ╱╲╱╲╱╲  ││  ◆◇◆◇◆◇  │
        //  │                                   ││           ││          ││           │
        //  ├────────────────────────────────────┤├───────────┤├──────────┤├───────────┤
        //  ┌──pattern──┐┌────────WIBWOB─────────────────────┐┌──pattern──┐┌──pattern──┐
        //  │  ⣿⣶⣤⣀⣀⣤⣶⣿ ││       (figlet big)              ││  ┼┼┼┼┼┼  ││  ∴∵∴∵∴∵  │
        //  ├───────────┤├───────────────────────────────────┤├──────────┤├───────────┤
        //  ┌──pattern──┐┌──pattern──┐┌─────────DOS──────────────────────┐┌──pattern──┐
        //  │  ▄▀▄▀▄▀▄▀ ││  ☰☱☲☳☴☵  ││     (figlet banner3)           ││  ≈≈≈≈≈≈  │
        //  ├───────────┤├──────────┤├──────────────────────────────────┤├───────────┤
        //  ┌─────────BLESSED────────────────────┐┌──pattern──┐┌──────────CONTRIB─────┐
        //  │        (figlet small)              ││  ⠿⠿⠿⠿⠿⠿ ││    (figlet small)    │
        //  └────────────────────────────────────┘└───────────┘└──────────────────────┘

        const patterns = [
          // Each is a function: (w, h, tick) => string[]
          (w: number, h: number, t: number) => {
            // Shifting block gradient ░▒▓█
            const chars = "░▒▓█▓▒";
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Diagonal hatching ╱╲
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "╱" : "╲";
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Diamond grid
            const chars = "<>v^*+.o";
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) line += chars[(x + y + t) % chars.length];
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Braille animation
            const braille = "⠁⠂⠄⡀⢀⠠⠐⠈";
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) line += braille[(x * 3 + y * 7 + t * 2) % braille.length];
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Cross-stitch ┼─│
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) {
                if ((x + t) % 4 === 0 && (y + t) % 3 === 0) line += "┼";
                else if ((y + t) % 3 === 0) line += "─";
                else if ((x + t) % 4 === 0) line += "│";
                else line += " ";
              }
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Wave
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              const phase = Math.floor(Math.sin((y + t) * 0.5) * 3);
              for (let x = 0; x < w; x++) {
                const v = Math.sin((x + phase + t) * 0.4);
                line += v > 0.3 ? "~" : v > -0.3 ? "-" : "_";
              }
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Hash interference
            const chars = "#=:.|";
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) line += chars[(x * 3 + y * 7 + t) % chars.length];
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Checkerboard ▄▀
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) line += (x + y + t) % 2 === 0 ? "▄" : "▀";
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Pipe maze
            const c = "+-|.+-|:";
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) line += c[(x * 3 + y * 5 + t) % c.length];
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Dense dots ⣿⣶⣤⣀ descending density
            const dots = "⣿⣷⣶⣦⣤⣄⣀⡀ ";
            const lines: string[] = [];
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) {
                const d = Math.sin((x + t) * 0.4) * Math.cos((y + t) * 0.3);
                const idx = Math.floor((d + 1) * 0.5 * (dots.length - 1));
                line += dots[Math.max(0, Math.min(dots.length - 1, idx))];
              }
              lines.push(line);
            }
            return lines;
          },
          (w: number, h: number, t: number) => {
            // Concentric rings
            const chars = " .,:;!|#@";
            const lines: string[] = [];
            const cx = w / 2, cy = h / 2;
            for (let y = 0; y < h; y++) {
              let line = "";
              for (let x = 0; x < w; x++) {
                const dist = Math.sqrt((x - cx) ** 2 + ((y - cy) * 2) ** 2);
                const idx = Math.floor(dist + t) % chars.length;
                line += chars[idx];
              }
              lines.push(line);
            }
            return lines;
          },
        ];

        // Layout: 8 rows × 6 cols conceptual grid
        // Each cell is a blessed box, some span multiple cells
        interface Cell {
          row: number; col: number;
          rowSpan: number; colSpan: number;
          type: "figlet" | "pattern";
          // figlet cells
          text?: string; font?: string;
          // pattern cells
          patternIdx?: number;
        }

        const layout: Cell[] = [
          // Row 0-1: big figlet left, 3 patterns right
          { row: 0, col: 0, rowSpan: 2, colSpan: 3, type: "figlet", text: "SYMBIENT", font: "slant" },
          { row: 0, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 0 },
          { row: 0, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 1 },
          { row: 0, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 2 },
          { row: 1, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 3 },
          { row: 1, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 4 },
          { row: 1, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 5 },

          // Row 2-3: pattern left, big figlet center, 2 patterns right
          { row: 2, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 6 },
          { row: 2, col: 1, rowSpan: 2, colSpan: 3, type: "figlet", text: "WIBWOB", font: "big" },
          { row: 2, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 7 },
          { row: 2, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 8 },
          { row: 3, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 9 },
          { row: 3, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 10 },
          { row: 3, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 0 },

          // Row 4-5: 2 patterns left, big figlet center-right, pattern far right
          { row: 4, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 1 },
          { row: 4, col: 1, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 2 },
          { row: 4, col: 2, rowSpan: 2, colSpan: 3, type: "figlet", text: "DOS", font: "banner3" },
          { row: 4, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 3 },
          { row: 5, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 4 },
          { row: 5, col: 1, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 5 },
          { row: 5, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 6 },

          // Row 6-7: figlet left, pattern center, figlet right
          { row: 6, col: 0, rowSpan: 2, colSpan: 2, type: "figlet", text: "BLESSED", font: "small" },
          { row: 6, col: 2, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 7 },
          { row: 6, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 8 },
          { row: 6, col: 4, rowSpan: 2, colSpan: 2, type: "figlet", text: "CONTRIB", font: "small" },
          { row: 7, col: 2, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 9 },
          { row: 7, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 10 },
        ];

        const ROWS = 8, COLS = 6;
        const boxes: Array<{ box: blessed.Widgets.BoxElement; cell: Cell }> = [];

        for (const cell of layout) {
          const top = `${(cell.row / ROWS * 100).toFixed(1)}%`;
          const left = `${(cell.col / COLS * 100).toFixed(1)}%`;
          const height = `${(cell.rowSpan / ROWS * 100).toFixed(1)}%`;
          const width = `${(cell.colSpan / COLS * 100).toFixed(1)}%`;

          const isFiglet = cell.type === "figlet";
          const box = blessed.box({
            parent: container,
            top, left, height, width,
            border: { type: "line" },
            style: {
              fg: isFiglet ? "cyan" : "white",
              border: { fg: isFiglet ? "cyan" : "gray" },
            },
            tags: false,
          });
          boxes.push({ box, cell });
        }

        // Pre-render figlet texts (they don't change, just the patterns animate)
        const figletCache = new Map<string, string>();
        for (const { cell } of boxes) {
          if (cell.type === "figlet" && cell.text && cell.font) {
            const key = `${cell.text}|${cell.font}`;
            if (!figletCache.has(key)) {
              figletCache.set(key, figlet(cell.text, cell.font));
            }
          }
        }

        tabs.push({
          name: "Mosaic",
          container,
          setup: () => {},
          update: () => {
            for (const { box, cell } of boxes) {
              if (cell.type === "figlet") {
                const key = `${cell.text}|${cell.font}`;
                box.setContent(figletCache.get(key) ?? cell.text ?? "");
              } else {
                const pIdx = (cell.patternIdx ?? 0) % patterns.length;
                const fn = patterns[pIdx]!;
                const bw = Math.max(1, (box.width as number || 10) - 2);
                const bh = Math.max(1, (box.height as number || 5) - 2);
                const lines = fn(bw, bh, tick);
                box.setContent(lines.join("\n"));
              }
            }
          },
          cleanup: () => {},
        });
      })();

      // ═══════════════════════════════════════════════════
      // TAB 7: Emoji Mosaic — unicode rendering test grid
      // ═══════════════════════════════════════════════════

      (() => {
        const container = createTabContainer();
        container.hide();

        // Test categories — each is a labelled grid cell showing
        // how blessed handles different unicode/emoji classes
        interface EmojiTest {
          label: string;
          note: string; // expected behaviour
          chars: string[]; // test strings
          fill?: boolean; // fill the cell with repeating chars
        }

        const tests: EmojiTest[] = [
          {
            label: "Basic Emoji",
            note: "EAW:W — should be 2 cols each",
            chars: ["😀", "😎", "🔥", "💀", "👻", "🎉", "🚀", "⭐", "❤️", "🌈"],
            fill: true,
          },
          {
            label: "Skin Tone Modifiers",
            note: "Base + modifier = 1 glyph, 2 cols",
            chars: ["👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿", "👍🏻", "👍🏿"],
          },
          {
            label: "ZWJ Sequences",
            note: "Multiple codepoints, 1 glyph, 2 cols",
            chars: ["👨‍👩‍👧‍👦", "👩‍💻", "🏳️‍🌈", "👨‍🎤", "🧑‍🚀", "👩‍🔬"],
          },
          {
            label: "Variation Selectors",
            note: "VS16 makes text emoji render as graphic",
            chars: ["☺️", "☺", "❤️", "❤", "✨", "⭐", "☠️", "☠"],
          },
          {
            label: "CJK Ideographs",
            note: "EAW:W — 2 cols, well-supported",
            chars: ["漢", "字", "日", "本", "語", "中", "文", "東", "京", "道"],
            fill: true,
          },
          {
            label: "Hangul Syllables",
            note: "EAW:W — 2 cols",
            chars: ["한", "글", "가", "나", "다", "라", "마", "바", "사", "아"],
            fill: true,
          },
          {
            label: "Box Drawing",
            note: "EAW:N — 1 col, safe",
            chars: ["┌", "─", "┐", "│", "└", "┘", "├", "┤", "┬", "┴", "┼", "═", "║", "╔", "╗", "╚", "╝"],
            fill: true,
          },
          {
            label: "Block Elements",
            note: "EAW:A — ambiguous, usually 1 col",
            chars: ["░", "▒", "▓", "█", "▀", "▄", "▌", "▐", "▍", "▎", "▏", "▊", "▋"],
            fill: true,
          },
          {
            label: "Braille Patterns",
            note: "EAW:N — 1 col, safe",
            chars: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠿", "⣿", "⣶", "⣤", "⣀"],
            fill: true,
          },
          {
            label: "Misc Symbols",
            note: "EAW:N/A — width varies by terminal",
            chars: ["♠", "♣", "♥", "♦", "♪", "♫", "☆", "★", "○", "●", "◎", "□", "■"],
            fill: true,
          },
          {
            label: "Dingbats",
            note: "EAW:N — but some terminals render wide",
            chars: ["✓", "✗", "✦", "✧", "✩", "✪", "✫", "✬", "✭", "✮", "✯", "✰"],
            fill: true,
          },
          {
            label: "Math Symbols",
            note: "EAW:A/N — usually 1 col",
            chars: ["∀", "∃", "∅", "∇", "∈", "∉", "∋", "∏", "∑", "√", "∞", "∧", "∨"],
            fill: true,
          },
          {
            label: "Arrows",
            note: "EAW:N — 1 col",
            chars: ["←", "→", "↑", "↓", "↔", "↕", "⇐", "⇒", "⇑", "⇓", "⇔", "➜", "➤"],
            fill: true,
          },
          {
            label: "Trigrams (EAW:W!)",
            note: "EAW:W — these BREAK blessed layout",
            chars: ["☰", "☱", "☲", "☳", "☴", "☵", "☶", "☷"],
          },
          {
            label: "Flags",
            note: "Regional indicators, 2 codepoints each",
            chars: ["🇬🇧", "🇺🇸", "🇯🇵", "🇫🇷", "🇩🇪", "🇧🇷", "🇦🇺"],
          },
          {
            label: "Keycaps",
            note: "Digit + VS16 + combining enclosing keycap",
            chars: ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "#️⃣", "*️⃣"],
          },
          {
            label: "Animal Emoji",
            note: "EAW:W — fill test",
            chars: ["🐱", "🐶", "🐸", "🐙", "🦊", "🐝", "🦋", "🐢", "🐬", "🐧"],
            fill: true,
          },
          {
            label: "Food Emoji",
            note: "EAW:W — fill test",
            chars: ["🍕", "🍔", "🌮", "🍣", "🍩", "🎂", "🍺", "☕", "🧁", "🥐"],
            fill: true,
          },
          {
            label: "Weather/Nature",
            note: "Mix of EAW:W and N",
            chars: ["🌞", "🌙", "⛅", "🌧️", "❄️", "⚡", "🌊", "🍃", "🌸", "🌻"],
            fill: true,
          },
          {
            label: "fullUnicode:false",
            note: "Control — plain ASCII baseline",
            chars: ["A", "B", "C", "1", "2", "3", "#", "@", "&", "%", "!", "?"],
            fill: true,
          },
        ];

        // Layout: 5 cols × 4 rows grid of test cells
        const GCOLS = 5, GROWS = 4;
        const cellBoxes: Array<{ box: blessed.Widgets.BoxElement; test: EmojiTest }> = [];

        for (let i = 0; i < tests.length && i < GCOLS * GROWS; i++) {
          const test = tests[i]!;
          const row = Math.floor(i / GCOLS);
          const col = i % GCOLS;

          const box = blessed.box({
            parent: container,
            top: `${(row / GROWS * 100).toFixed(1)}%`,
            left: `${(col / GCOLS * 100).toFixed(1)}%`,
            width: `${(100 / GCOLS).toFixed(1)}%`,
            height: `${(100 / GROWS).toFixed(1)}%`,
            border: { type: "line" },
            label: ` ${test.label} `,
            tags: false,
            style: {
              fg: "white",
              border: { fg: "gray" },
            },
          });
          cellBoxes.push({ box, test });
        }

        tabs.push({
          name: "Emoji",
          container,
          setup: () => {},
          update: () => {
            for (const { box, test } of cellBoxes) {
              const bw = Math.max(1, (box.width as number || 20) - 2);
              const bh = Math.max(1, (box.height as number || 8) - 2);

              const lines: string[] = [];
              // Line 1: note
              lines.push(test.note);
              lines.push("");

              if (test.fill) {
                // Fill remaining rows with repeating chars
                for (let y = 0; y < bh - 2; y++) {
                  let line = "";
                  let col = 0;
                  while (col < bw) {
                    const ch = test.chars[(col + y + tick) % test.chars.length]!;
                    line += ch;
                    col++; // assume 1 col — blessed will show the breakage
                  }
                  lines.push(line);
                }
              } else {
                // Show chars spaced out with labels
                let line = "";
                for (const ch of test.chars) {
                  line += ch + " ";
                  if (line.length > bw - 4) {
                    lines.push(line);
                    line = "";
                  }
                }
                if (line) lines.push(line);
              }

              box.setContent(lines.join("\n"));
            }
          },
          cleanup: () => {},
        });
      })();

      // ── keyboard ─────────────────────────────────────

      body.key(["1"], () => switchTab(0));
      body.key(["2"], () => switchTab(1));
      body.key(["3"], () => switchTab(2));
      body.key(["4"], () => switchTab(3));
      body.key(["5"], () => switchTab(4));
      body.key(["6"], () => switchTab(5));
      body.key(["7"], () => switchTab(6));
      (body as any).input = true;
      (body as any).keys = true;

      // ── tick loop ────────────────────────────────────

      renderTabBar();

      const mainTimer = setInterval(() => {
        tick++;
        // Only update active tab — hidden contrib widgets crash on missing canvas
        try { tabs[activeTab]?.update(); } catch {}
        screen.render();
      }, 1000);
      timers.push(mainTimer);

      // Initial render
      try { tabs[activeTab]?.update(); } catch {}
      screen.render();

      // ── lifecycle ────────────────────────────────────

      win.onCleanup(() => {
        for (const t of timers) clearInterval(t);
        for (const t of tabs) t.cleanup();
      });

      win.describeState(() => ({
        summary: `Dashboard tab ${activeTab + 1}/${tabs.length}: ${tabs[activeTab]?.name ?? "?"} — tick ${tick}`,
      }));

      win.captureText(() => `Dashboard — ${tabs[activeTab]?.name ?? "?"} — tick ${tick}`);

      win.onRestyle(() => screen.render());

      win.focus();
    },
  });
}
