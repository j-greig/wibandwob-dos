/**
 * Dashboard v2 — blessed-contrib powered multi-tab dashboard.
 *
 * Uses SDK primitives: createTabs, createTimer/clearTimers, renderFiglet,
 * PATTERNS, sinWave, randHistory, xLabels, ansiGradientLine.
 *
 * Tab 1: System Overview — line charts, bar, sparklines, donut, gauge, log, table
 * Tab 2: Network Monitor — stacked bars, sparklines, connection log
 * Tab 3: Application Metrics — LCD counters, gauge list, multi-line charts
 * Tab 4: World Map — geo markers, event log, gauges
 * Tab 5: Creative Lab — figlet clock, animated ASCII art, colour gradients
 * Tab 6: Mosaic — figlet + pattern grid
 * Tab 7: Emoji — unicode rendering test grid
 */

import blessed from "blessed";
import contrib from "blessed-contrib";
import type {
  MicroappHost,
  TabbedContainerHandle,
  PatternGenerator,
} from "../../src/services/microapp-sdk.js";
import {
  createTabs,
  createTimer,
  clearTimers,
  renderFiglet,
  PATTERNS,
  sinWave,
  randHistory,
  xLabels,
  ansiGradientLine,
} from "../../src/services/microapp-sdk.js";

// ── constants ────────────────────────────────────────────────

const H = 40; // history length for all charts
const XL = xLabels(H);

// ── Tab 1: System Overview ───────────────────────────────────

function buildSystemTab(container: blessed.Widgets.BoxElement) {
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

  const line = grid.set(0, 0, 4, 6, contrib.line, {
    label: " CPU & Memory ", showLegend: true, legend: { width: 12 },
    style: { line: "cyan", text: "white", baseline: "white" },
  }) as any;
  const bar = grid.set(0, 6, 4, 6, contrib.bar, {
    label: " Network I/O (KB/s) ", barWidth: 6, barSpacing: 2, maxHeight: 100,
    style: { fg: "green" },
  }) as any;
  const spark = grid.set(4, 0, 2, 6, contrib.sparkline, {
    label: " Load Average ", tags: true, style: { fg: "cyan" },
  }) as any;
  const donut = grid.set(4, 6, 2, 3, contrib.donut, {
    label: " Disk Usage ", radius: 8, arcWidth: 3, remainColor: "black", yPadding: 1,
  }) as any;
  const gauge = grid.set(4, 9, 2, 3, contrib.gauge, {
    label: " Uptime Health ", stroke: "green", fill: "white",
  }) as any;
  const log = grid.set(6, 0, 3, 6, contrib.log, {
    label: " System Log ", fg: "green", selectedFg: "green", bufferLength: 30,
  }) as any;
  const table = grid.set(6, 6, 3, 6, contrib.table, {
    label: " Process Table ", columnSpacing: 2, columnWidth: [18, 8, 8, 10],
    fg: "white", selectedFg: "white", selectedBg: "blue",
  }) as any;
  const line2 = grid.set(9, 0, 3, 12, contrib.line, {
    label: " Request Latency (ms) ",
    style: { line: "yellow", text: "white", baseline: "white" },
    xLabelPadding: 3, xPadding: 5,
  }) as any;

  let cpu = randHistory(H, 20, 80), mem = randHistory(H, 40, 90), lat = randHistory(H, 5, 120);
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

  return { line, bar, spark, donut, gauge, log, table, line2, cpu, mem, lat, logMsgs, procs };
}

function updateSystemTab(s: ReturnType<typeof buildSystemTab>, tick: number) {
  s.cpu.push(Math.max(5, Math.min(100, s.cpu[s.cpu.length-1]! + (Math.random()-0.48)*12))); s.cpu.shift();
  s.mem.push(Math.max(20, Math.min(100, s.mem[s.mem.length-1]! + (Math.random()-0.5)*6))); s.mem.shift();
  s.line.setData([
    { title: "CPU %", x: XL, y: s.cpu.map(Math.round), style: { line: "cyan" } },
    { title: "Mem %", x: XL, y: s.mem.map(Math.round), style: { line: "magenta" } },
  ]);
  const nl = ["eth0↓","eth0↑","lo↓","lo↑","wg0↓","wg0↑"];
  s.bar.setData({ titles: nl, data: nl.map(() => Math.round(Math.random()*80+5)) });
  s.spark.setData(["1m","5m"], [
    sinWave(tick,30,2,0.2).map(v => Math.round(Math.abs(v)*10+10)),
    sinWave(tick*0.5,30,1.5,0.15).map(v => Math.round(Math.abs(v)*10+8)),
  ]);
  const du = 55 + Math.round(Math.sin(tick*0.05)*15);
  s.donut.setData([{ label: "Used", percent: du, color: du>80?"red":"cyan" }]);
  s.gauge.setPercent(Math.min(100, Math.max(0, 92+Math.round(Math.sin(tick*0.03)*8))));
  if (tick%3===0) s.log.log(`${new Date().toISOString().slice(11,19)} ${s.logMsgs[Math.floor(Math.random()*s.logMsgs.length)]}`);
  const sh = [...s.procs].sort(()=>Math.random()-0.5).slice(0,5).map(([n,u,m,c])=>[n,u,`${parseInt(m as string)+Math.round((Math.random()-0.5)*20)}MB`,`${(parseFloat(c as string)+(Math.random()-0.5)*1.5).toFixed(1)}%`]);
  s.table.setData({ headers: ["Process","User","Memory","CPU"], data: sh });
  s.lat.push(Math.max(1, Math.min(200, s.lat[s.lat.length-1]! + (Math.random()-0.5)*30))); s.lat.shift();
  s.line2.setData([{ title: "p99", x: XL, y: s.lat.map(Math.round), style: { line: "yellow" } }]);
}

// ── Tab 2: Network Monitor ───────────────────────────────────

function buildNetworkTab(container: blessed.Widgets.BoxElement) {
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

  const bw = grid.set(0, 0, 5, 8, contrib.line, {
    label: " Bandwidth (Mbps) ", showLegend: true, legend: { width: 14 },
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
    label: " Open Ports ", columnSpacing: 2, columnWidth: [8, 12, 10, 14],
    fg: "white", selectedFg: "white", selectedBg: "blue",
  }) as any;
  const errLine = grid.set(9, 0, 3, 12, contrib.line, {
    label: " Error Rate (per min) ",
    style: { line: "red", text: "white", baseline: "white" },
  }) as any;

  let dlHist = randHistory(H, 10, 90), ulHist = randHistory(H, 5, 40), errHist = randHistory(H, 0, 30);
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

  return { bw, connGauge, pktSpark, connLog, portTable, errLine, dlHist, ulHist, errHist, connMsgs, ports };
}

function updateNetworkTab(s: ReturnType<typeof buildNetworkTab>, tick: number) {
  s.dlHist.push(Math.max(0, Math.min(100, s.dlHist[s.dlHist.length-1]!+(Math.random()-0.5)*15))); s.dlHist.shift();
  s.ulHist.push(Math.max(0, Math.min(60, s.ulHist[s.ulHist.length-1]!+(Math.random()-0.5)*10))); s.ulHist.shift();
  s.bw.setData([
    { title: "Download", x: XL, y: s.dlHist.map(Math.round), style: { line: "green" } },
    { title: "Upload", x: XL, y: s.ulHist.map(Math.round), style: { line: "yellow" } },
  ]);
  s.connGauge.setPercent(Math.min(100, Math.max(10, 45+Math.round(Math.sin(tick*0.08)*30))));
  s.pktSpark.setData(["IN","OUT"], [
    sinWave(tick,20,500,0.3).map(v => Math.round(Math.abs(v)+200)),
    sinWave(tick*0.7,20,300,0.25).map(v => Math.round(Math.abs(v)+100)),
  ]);
  if (tick%2===0) s.connLog.log(`${new Date().toISOString().slice(11,19)} ${s.connMsgs[Math.floor(Math.random()*s.connMsgs.length)]}`);
  const sp = [...s.ports].sort(()=>Math.random()-0.5).slice(0,6);
  s.portTable.setData({ headers: ["Port","Service","State","Address"], data: sp });
  s.errHist.push(Math.max(0, Math.min(50, s.errHist[s.errHist.length-1]!+(Math.random()-0.5)*8))); s.errHist.shift();
  s.errLine.setData([{ title: "5xx", x: XL, y: s.errHist.map(Math.round), style: { line: "red" } }]);
}

// ── Tab 3: Application Metrics ───────────────────────────────

function buildAppMetricsTab(container: blessed.Widgets.BoxElement) {
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

  const lcdOpts = (label: string, elems: number, color: string) => ({
    label: ` ${label} `, segmentWidth: 0.06, segmentInterval: 0.11, strokeWidth: 0.1,
    elements: elems, display: "0".repeat(elems), elementSpacing: 4, elementPadding: 2, color,
  });
  const lcd = grid.set(0, 0, 3, 4, contrib.lcd, lcdOpts("Requests/sec", 5, "green")) as any;
  const lcd2 = grid.set(0, 4, 3, 4, contrib.lcd, lcdOpts("Active Users", 4, "cyan")) as any;
  const lcd3 = grid.set(0, 8, 3, 4, contrib.lcd, lcdOpts("Queue Depth", 3, "yellow")) as any;

  const gaugeList = grid.set(3, 0, 3, 6, contrib.gaugeList, {
    label: " Service Health ",
    gauges: [{ stack: [95] }, { stack: [88] }, { stack: [99] }, { stack: [72] }],
    style: { fg: "white" },
  }) as any;
  const respLine = grid.set(3, 6, 3, 6, contrib.line, {
    label: " Response Times (ms) ", showLegend: true, legend: { width: 10 },
    style: { line: "cyan", text: "white", baseline: "white" },
  }) as any;
  const deployLog = grid.set(6, 0, 3, 6, contrib.log, {
    label: " Deploy Log ", fg: "magenta", selectedFg: "magenta", bufferLength: 30,
  }) as any;
  const featureTable = grid.set(6, 6, 3, 6, contrib.table, {
    label: " Feature Flags ", columnSpacing: 2, columnWidth: [22, 10, 10, 12],
    fg: "white", selectedFg: "white", selectedBg: "blue",
  }) as any;
  const throughput = grid.set(9, 0, 3, 12, contrib.line, {
    label: " Throughput (req/min) ",
    style: { line: "green", text: "white", baseline: "white" },
  }) as any;

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

  return { lcd, lcd2, lcd3, gaugeList, respLine, deployLog, featureTable, throughput,
    p50, p95, p99, tput, rps, users, queue, deployMsgs, features };
}

function updateAppMetricsTab(s: ReturnType<typeof buildAppMetricsTab>, tick: number) {
  s.rps = Math.max(100, Math.min(9999, s.rps + Math.round((Math.random()-0.5)*200)));
  s.users = Math.max(10, Math.min(9999, s.users + Math.round((Math.random()-0.5)*50)));
  s.queue = Math.max(0, Math.min(999, s.queue + Math.round((Math.random()-0.5)*5)));
  s.lcd.setDisplay(String(s.rps).padStart(5, "0"));
  s.lcd2.setDisplay(String(s.users).padStart(4, "0"));
  s.lcd3.setDisplay(String(s.queue).padStart(3, "0"));

  s.gaugeList.setGauges([
    { stack: [Math.min(100, Math.max(50, 95+Math.round((Math.random()-0.5)*10)))] },
    { stack: [Math.min(100, Math.max(50, 88+Math.round((Math.random()-0.5)*15)))] },
    { stack: [Math.min(100, Math.max(70, 99+Math.round((Math.random()-0.5)*5)))] },
    { stack: [Math.min(100, Math.max(30, 72+Math.round((Math.random()-0.5)*20)))] },
  ]);

  s.p50.push(Math.max(1,Math.min(80,s.p50[s.p50.length-1]!+(Math.random()-0.5)*10))); s.p50.shift();
  s.p95.push(Math.max(10,Math.min(200,s.p95[s.p95.length-1]!+(Math.random()-0.5)*20))); s.p95.shift();
  s.p99.push(Math.max(30,Math.min(400,s.p99[s.p99.length-1]!+(Math.random()-0.5)*40))); s.p99.shift();
  s.respLine.setData([
    { title: "p50", x: XL, y: s.p50.map(Math.round), style: { line: "green" } },
    { title: "p95", x: XL, y: s.p95.map(Math.round), style: { line: "yellow" } },
    { title: "p99", x: XL, y: s.p99.map(Math.round), style: { line: "red" } },
  ]);

  if (tick%4===0) s.deployLog.log(`${new Date().toISOString().slice(11,19)} ${s.deployMsgs[Math.floor(Math.random()*s.deployMsgs.length)]}`);
  const sf = [...s.features].sort(()=>Math.random()-0.5).slice(0,6);
  s.featureTable.setData({ headers: ["Feature","Status","Rollout","Type"], data: sf });

  s.tput.push(Math.max(100,Math.min(3000,s.tput[s.tput.length-1]!+(Math.random()-0.5)*200))); s.tput.shift();
  s.throughput.setData([{ title: "req/min", x: XL, y: s.tput.map(Math.round), style: { line: "green" } }]);
}

// ── Tab 4: World Map ─────────────────────────────────────────

function buildWorldMapTab(container: blessed.Widgets.BoxElement) {
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

  const map = grid.set(0, 0, 6, 8, contrib.map, {
    label: " Global Traffic ", style: { shapeColor: "cyan" },
  }) as any;
  const regionGauge = grid.set(0, 8, 3, 4, contrib.gaugeList, {
    label: " Region Load ",
    gauges: [{ stack: [65] }, { stack: [82] }, { stack: [45] }],
    style: { fg: "white" },
  }) as any;
  const regionSpark = grid.set(3, 8, 3, 4, contrib.sparkline, {
    label: " Latency by Region ", tags: true, style: { fg: "yellow" },
  }) as any;
  const geoLog = grid.set(6, 0, 3, 6, contrib.log, {
    label: " Geo Events ", fg: "green", selectedFg: "green", bufferLength: 30,
  }) as any;
  const cdnTable = grid.set(6, 6, 3, 6, contrib.table, {
    label: " CDN Nodes ", columnSpacing: 2, columnWidth: [14, 10, 10, 12],
    fg: "white", selectedFg: "white", selectedBg: "blue",
  }) as any;
  const globalLine = grid.set(9, 0, 3, 12, contrib.line, {
    label: " Global Requests/sec ", showLegend: true, legend: { width: 10 },
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
  let euHist = randHistory(H, 200, 800), usHist = randHistory(H, 300, 1200), apHist = randHistory(H, 100, 500);

  return { map, regionGauge, regionSpark, geoLog, cdnTable, globalLine, cities, geoMsgs, cdnNodes, euHist, usHist, apHist };
}

function updateWorldMapTab(s: ReturnType<typeof buildWorldMapTab>, tick: number) {
  const active = [0,1,2].map(() => s.cities[Math.floor(Math.random()*s.cities.length)]!);
  s.map.clearMarkers();
  for (const c of active) {
    s.map.addMarker({ lon: c.lon+(Math.random()-0.5)*2, lat: c.lat+(Math.random()-0.5)*2, color: "red", char: "X" });
  }
  s.regionGauge.setGauges([
    { stack: [Math.min(100, Math.max(20, 65+Math.round((Math.random()-0.5)*30)))] },
    { stack: [Math.min(100, Math.max(20, 82+Math.round((Math.random()-0.5)*25)))] },
    { stack: [Math.min(100, Math.max(20, 45+Math.round((Math.random()-0.5)*20)))] },
  ]);
  s.regionSpark.setData(["EU","US","AP"], [
    sinWave(tick,20,30,0.2).map(v => Math.round(Math.abs(v)+15)),
    sinWave(tick*0.8,20,25,0.25).map(v => Math.round(Math.abs(v)+20)),
    sinWave(tick*0.6,20,40,0.15).map(v => Math.round(Math.abs(v)+30)),
  ]);
  if (tick%2===0) s.geoLog.log(`${new Date().toISOString().slice(11,19)} ${s.geoMsgs[Math.floor(Math.random()*s.geoMsgs.length)]}`);
  const sn = [...s.cdnNodes].map(([id,loc,st,lat]) => [id,loc,st,`${parseInt(lat)+Math.round((Math.random()-0.5)*10)}ms`]);
  s.cdnTable.setData({ headers: ["Node","Location","Status","Latency"], data: sn });

  s.euHist.push(Math.max(50,Math.min(1000,s.euHist[s.euHist.length-1]!+(Math.random()-0.5)*100))); s.euHist.shift();
  s.usHist.push(Math.max(100,Math.min(1500,s.usHist[s.usHist.length-1]!+(Math.random()-0.5)*120))); s.usHist.shift();
  s.apHist.push(Math.max(50,Math.min(800,s.apHist[s.apHist.length-1]!+(Math.random()-0.5)*80))); s.apHist.shift();
  s.globalLine.setData([
    { title: "EU", x: XL, y: s.euHist.map(Math.round), style: { line: "cyan" } },
    { title: "US", x: XL, y: s.usHist.map(Math.round), style: { line: "green" } },
    { title: "AP", x: XL, y: s.apHist.map(Math.round), style: { line: "yellow" } },
  ]);
}

// ── Tab 5: Creative Lab ──────────────────────────────────────

function buildCreativeTab(container: blessed.Widgets.BoxElement) {
  const clockBox = blessed.box({
    parent: container, top: 0, left: 0, right: 0, height: 8,
    label: " Figlet Clock ", border: { type: "line" },
    style: { fg: "cyan", border: { fg: "cyan" } },
  });
  const gradientBox = blessed.box({
    parent: container, top: 8, left: 0, width: "50%", height: 12,
    label: " Colour Gradients ", border: { type: "line" },
    style: { fg: "white", border: { fg: "magenta" } }, tags: false,
  });
  const artBox = blessed.box({
    parent: container, top: 8, left: "50%", right: 0, height: 12,
    label: " Animated Art ", border: { type: "line" },
    style: { fg: "green", border: { fg: "green" } }, tags: false,
  });
  const marqueeBox = blessed.box({
    parent: container, top: 20, left: 0, right: 0, bottom: 0,
    label: " Figlet Marquee ", border: { type: "line" },
    style: { fg: "yellow", border: { fg: "yellow" } },
  });

  const words = ["WIBWOB", "DOS", "SYMBIENT", "DASHBOARD", "BLESSED", "CONTRIB"];
  const artFrames = [
    ["    ╔══╗    ","    ║◉◉║    ","    ║──║    ","    ╚══╝    ","   /│  │\\   ","  / │  │ \\  "," ╱  └──┘  ╲ "],
    ["    ╔══╗    ","    ║◉ ║    ","    ║──║    ","    ╚══╝    ","  ─/│  │\\─  ","  / │  │ \\  "," ╱  └──┘  ╲ "],
    ["    ╔══╗    ","    ║ ◉║    ","    ║──║    ","    ╚══╝    ","   /│  │\\   ","  ─ │  │ ─  "," ╱  └──┘  ╲ "],
    ["    ╔══╗    ","    ║◉◉║    ","    ║▬▬║    ","    ╚══╝    ","   /│  │\\   ","  / │  │ \\  "," ╱  └──┘  ╲ "],
  ];

  return { clockBox, gradientBox, artBox, marqueeBox, words, artFrames };
}

function updateCreativeTab(s: ReturnType<typeof buildCreativeTab>, tick: number) {
  s.clockBox.setContent(renderFiglet(new Date().toTimeString().slice(0, 8), "big"));

  const w = (s.gradientBox.width as number || 50) - 2;
  const lines: string[] = [];
  for (let row = 0; row < 8; row++) {
    const hueStart = (tick * 5 + row * 40) % 360;
    lines.push(ansiGradientLine(w, hueStart, hueStart + 180));
  }
  s.gradientBox.setContent(lines.join("\n"));

  const frame = s.artFrames[tick % s.artFrames.length]!;
  s.artBox.setContent("\n" + frame.join("\n"));

  const wordIdx = Math.floor(tick / 5) % s.words.length;
  s.marqueeBox.setContent(renderFiglet(s.words[wordIdx]!, "slant"));
}

// ── Tab 6: Mosaic ────────────────────────────────────────────

interface MosaicCell {
  box: blessed.Widgets.BoxElement;
  type: "figlet" | "pattern";
  text?: string;
  font?: string;
  patternIdx?: number;
}

function buildMosaicTab(container: blessed.Widgets.BoxElement): MosaicCell[] {
  interface CellDef {
    row: number; col: number; rowSpan: number; colSpan: number;
    type: "figlet" | "pattern"; text?: string; font?: string; patternIdx?: number;
  }

  const layout: CellDef[] = [
    { row: 0, col: 0, rowSpan: 2, colSpan: 3, type: "figlet", text: "SYMBIENT", font: "slant" },
    { row: 0, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 0 },
    { row: 0, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 1 },
    { row: 0, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 2 },
    { row: 1, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 3 },
    { row: 1, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 4 },
    { row: 1, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 5 },
    { row: 2, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 6 },
    { row: 2, col: 1, rowSpan: 2, colSpan: 3, type: "figlet", text: "WIBWOB", font: "big" },
    { row: 2, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 7 },
    { row: 2, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 8 },
    { row: 3, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 9 },
    { row: 3, col: 4, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 10 },
    { row: 3, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 0 },
    { row: 4, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 1 },
    { row: 4, col: 1, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 2 },
    { row: 4, col: 2, rowSpan: 2, colSpan: 3, type: "figlet", text: "DOS", font: "banner3" },
    { row: 4, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 3 },
    { row: 5, col: 0, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 4 },
    { row: 5, col: 1, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 5 },
    { row: 5, col: 5, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 6 },
    { row: 6, col: 0, rowSpan: 2, colSpan: 2, type: "figlet", text: "BLESSED", font: "small" },
    { row: 6, col: 2, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 7 },
    { row: 6, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 8 },
    { row: 6, col: 4, rowSpan: 2, colSpan: 2, type: "figlet", text: "CONTRIB", font: "small" },
    { row: 7, col: 2, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 9 },
    { row: 7, col: 3, rowSpan: 1, colSpan: 1, type: "pattern", patternIdx: 10 },
  ];

  const ROWS = 8, COLS = 6;
  const figletCache = new Map<string, string>();
  const cells: MosaicCell[] = [];

  for (const def of layout) {
    const isFiglet = def.type === "figlet";
    const box = blessed.box({
      parent: container,
      top: `${(def.row / ROWS * 100).toFixed(1)}%`,
      left: `${(def.col / COLS * 100).toFixed(1)}%`,
      height: `${(def.rowSpan / ROWS * 100).toFixed(1)}%`,
      width: `${(def.colSpan / COLS * 100).toFixed(1)}%`,
      border: { type: "line" },
      style: { fg: isFiglet ? "cyan" : "white", border: { fg: isFiglet ? "cyan" : "gray" } },
      tags: false,
    });
    if (isFiglet && def.text && def.font) {
      const key = `${def.text}|${def.font}`;
      if (!figletCache.has(key)) figletCache.set(key, renderFiglet(def.text, def.font));
      box.setContent(figletCache.get(key)!);
    }
    cells.push({ box, type: def.type, text: def.text, font: def.font, patternIdx: def.patternIdx });
  }

  return cells;
}

function updateMosaicTab(cells: MosaicCell[], tick: number) {
  for (const cell of cells) {
    if (cell.type === "pattern") {
      const fn = PATTERNS[(cell.patternIdx ?? 0) % PATTERNS.length]!;
      const bw = Math.max(1, (cell.box.width as number || 10) - 2);
      const bh = Math.max(1, (cell.box.height as number || 5) - 2);
      cell.box.setContent(fn(bw, bh, tick).join("\n"));
    }
    // figlet cells are static — set once at build time
  }
}

// ── Tab 7: Emoji ─────────────────────────────────────────────

interface EmojiTest {
  label: string;
  note: string;
  chars: string[];
  fill?: boolean;
}

const EMOJI_TESTS: EmojiTest[] = [
  { label: "Basic Emoji", note: "EAW:W — should be 2 cols each", chars: ["😀","😎","🔥","💀","👻","🎉","🚀","⭐","❤️","🌈"], fill: true },
  { label: "Skin Tone Modifiers", note: "Base + modifier = 1 glyph, 2 cols", chars: ["👋🏻","👋🏼","👋🏽","👋🏾","👋🏿","👍🏻","👍🏿"] },
  { label: "ZWJ Sequences", note: "Multiple codepoints, 1 glyph, 2 cols", chars: ["👨‍👩‍👧‍👦","👩‍💻","🏳️‍🌈","👨‍🎤","🧑‍🚀","👩‍🔬"] },
  { label: "Variation Selectors", note: "VS16 makes text emoji render as graphic", chars: ["☺️","☺","❤️","❤","✨","⭐","☠️","☠"] },
  { label: "CJK Ideographs", note: "EAW:W — 2 cols, well-supported", chars: ["漢","字","日","本","語","中","文","東","京","道"], fill: true },
  { label: "Hangul Syllables", note: "EAW:W — 2 cols", chars: ["한","글","가","나","다","라","마","바","사","아"], fill: true },
  { label: "Box Drawing", note: "EAW:N — 1 col, safe", chars: ["┌","─","┐","│","└","┘","├","┤","┬","┴","┼","═","║","╔","╗","╚","╝"], fill: true },
  { label: "Block Elements", note: "EAW:A — ambiguous, usually 1 col", chars: ["░","▒","▓","█","▀","▄","▌","▐","▍","▎","▏","▊","▋"], fill: true },
  { label: "Braille Patterns", note: "EAW:N — 1 col, safe", chars: ["⠁","⠂","⠄","⡀","⢀","⠿","⣿","⣶","⣤","⣀"], fill: true },
  { label: "Misc Symbols", note: "EAW:N/A — width varies by terminal", chars: ["♠","♣","♥","♦","♪","♫","☆","★","○","●","◎","□","■"], fill: true },
  { label: "Dingbats", note: "EAW:N — but some terminals render wide", chars: ["✓","✗","✦","✧","✩","✪","✫","✬","✭","✮","✯","✰"], fill: true },
  { label: "Math Symbols", note: "EAW:A/N — usually 1 col", chars: ["∀","∃","∅","∇","∈","∉","∋","∏","∑","√","∞","∧","∨"], fill: true },
  { label: "Arrows", note: "EAW:N — 1 col", chars: ["←","→","↑","↓","↔","↕","⇐","⇒","⇑","⇓","⇔","➜","➤"], fill: true },
  { label: "Trigrams (EAW:W!)", note: "EAW:W — these BREAK blessed layout", chars: ["☰","☱","☲","☳","☴","☵","☶","☷"] },
  { label: "Flags", note: "Regional indicators, 2 codepoints each", chars: ["🇬🇧","🇺🇸","🇯🇵","🇫🇷","🇩🇪","🇧🇷","🇦🇺"] },
  { label: "Keycaps", note: "Digit + VS16 + combining enclosing keycap", chars: ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","#️⃣","*️⃣"] },
  { label: "Animal Emoji", note: "EAW:W — fill test", chars: ["🐱","🐶","🐸","🐙","🦊","🐝","🦋","🐢","🐬","🐧"], fill: true },
  { label: "Food Emoji", note: "EAW:W — fill test", chars: ["🍕","🍔","🌮","🍣","🍩","🎂","🍺","☕","🧁","🥐"], fill: true },
  { label: "Weather/Nature", note: "Mix of EAW:W and N", chars: ["🌞","🌙","⛅","🌧️","❄️","⚡","🌊","🍃","🌸","🌻"], fill: true },
  { label: "ASCII Baseline", note: "Control — plain ASCII baseline", chars: ["A","B","C","1","2","3","#","@","&","%","!","?"], fill: true },
];

interface EmojiCell { box: blessed.Widgets.BoxElement; test: EmojiTest }

function buildEmojiTab(container: blessed.Widgets.BoxElement): EmojiCell[] {
  const GCOLS = 5, GROWS = 4;
  const cells: EmojiCell[] = [];
  for (let i = 0; i < EMOJI_TESTS.length && i < GCOLS * GROWS; i++) {
    const test = EMOJI_TESTS[i]!;
    const row = Math.floor(i / GCOLS), col = i % GCOLS;
    const box = blessed.box({
      parent: container,
      top: `${(row / GROWS * 100).toFixed(1)}%`,
      left: `${(col / GCOLS * 100).toFixed(1)}%`,
      width: `${(100 / GCOLS).toFixed(1)}%`,
      height: `${(100 / GROWS).toFixed(1)}%`,
      border: { type: "line" },
      label: ` ${test.label} `,
      tags: false,
      style: { fg: "white", border: { fg: "gray" } },
    });
    cells.push({ box, test });
  }
  return cells;
}

function updateEmojiTab(cells: EmojiCell[], tick: number) {
  for (const { box, test } of cells) {
    const bw = Math.max(1, (box.width as number || 20) - 2);
    const bh = Math.max(1, (box.height as number || 8) - 2);
    const lines: string[] = [test.note, ""];

    if (test.fill) {
      for (let y = 0; y < bh - 2; y++) {
        let line = "";
        let col = 0;
        while (col < bw) {
          line += test.chars[(col + y + tick) % test.chars.length]!;
          col++;
        }
        lines.push(line);
      }
    } else {
      let line = "";
      for (const ch of test.chars) {
        line += ch + " ";
        if (line.length > bw - 4) { lines.push(line); line = ""; }
      }
      if (line) lines.push(line);
    }
    box.setContent(lines.join("\n"));
  }
}

// ═════════════════════════════════════════════════════════════
// MODULE SETUP
// ═════════════════════════════════════════════════════════════

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Dashboard",
    menu: [{ category: "applications", order: 55, label: "Dashboard" }],
    palette: { order: 220, label: "Dashboard" },
    action: () => {
      const win = host.createWindow({ title: "Dashboard", width: 140, height: 48 });
      const screen = host.screen;
      const timers = new Set<ReturnType<typeof setInterval>>();
      let tick = 0;

      // Build tab state (lazily populated by build callbacks)
      let systemState: ReturnType<typeof buildSystemTab>;
      let networkState: ReturnType<typeof buildNetworkTab>;
      let appMetricsState: ReturnType<typeof buildAppMetricsTab>;
      let worldMapState: ReturnType<typeof buildWorldMapTab>;
      let creativeState: ReturnType<typeof buildCreativeTab>;
      let mosaicCells: MosaicCell[];
      let emojiCells: EmojiCell[];

      const tabHandle = createTabs(win.body, [
        {
          name: "System",
          build: (c) => { systemState = buildSystemTab(c); },
          update: () => updateSystemTab(systemState, tick),
        },
        {
          name: "Network",
          build: (c) => { networkState = buildNetworkTab(c); },
          update: () => updateNetworkTab(networkState, tick),
        },
        {
          name: "App Metrics",
          build: (c) => { appMetricsState = buildAppMetricsTab(c); },
          update: () => updateAppMetricsTab(appMetricsState, tick),
        },
        {
          name: "World Map",
          build: (c) => { worldMapState = buildWorldMapTab(c); },
          update: () => updateWorldMapTab(worldMapState, tick),
        },
        {
          name: "Creative",
          build: (c) => { creativeState = buildCreativeTab(c); },
          update: () => updateCreativeTab(creativeState, tick),
        },
        {
          name: "Mosaic",
          build: (c) => { mosaicCells = buildMosaicTab(c); },
          update: () => updateMosaicTab(mosaicCells, tick),
        },
        {
          name: "Emoji",
          build: (c) => { emojiCells = buildEmojiTab(c); },
          update: () => updateEmojiTab(emojiCells, tick),
        },
      ]);

      // Tick loop — SDK timer for safe cleanup
      createTimer(() => {
        tick++;
        tabHandle.tickActive();
        screen.render();
      }, 1000, timers);

      // Initial render
      tabHandle.tickActive();
      screen.render();

      // Lifecycle
      win.onCleanup(() => {
        clearTimers(timers);
        tabHandle.destroy();
      });

      win.describeState(() => ({
        summary: `Dashboard tab ${tabHandle.active + 1}/7 — tick ${tick}`,
      }));

      win.captureText(() => `Dashboard — tick ${tick}`);
      win.onRestyle(() => { tabHandle.renderBar(); screen.render(); });
      win.focus();
    },
  });
}
