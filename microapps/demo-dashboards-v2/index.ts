/**
 * Dashboards V2 — combined responsive dashboard hub.
 *
 * Merges ideas from:
 *   - dashboard: 7-tab blessed-contrib dashboard (charts, gauges, maps, creative)
 *   - dashboard-xxl: pannable virtual canvas with mosaic/figlet typography
 *
 * Three views in one microapp:
 *   1. Overview  — compact system+network+app metrics with contrib widgets
 *   2. XXL       — virtual pannable mosaic canvas (800×200 char virtual surface)
 *   3. Creative  — figlet clock, animated gradient art, emoji unicode test grid
 *
 * Responsive: lg (3-col / full grid) | md (2-col) | sm (single-column tabbed)
 *
 * SDK primitives: createTimer, clearTimers, renderFiglet, PATTERNS,
 *                 sinWave, randHistory, xLabels, ansiGradientLine,
 *                 createScrollbar, scrollableStyle
 */

import blessed from "blessed";
import contrib from "blessed-contrib";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
  renderFiglet,
  applyRect,
  toEvenCellWidth,
} from "../../src/services/microapp-sdk.js";
import {
  sinWave,
  randHistory,
  xLabels,
  ansiGradientLine,
} from "../../src/ui/patterns.js";

// ── types ─────────────────────────────────────────────────────

type Mode = "lg" | "md" | "sm";

function pickMode(w: number): Mode {
  if (w >= 100) return "lg";
  if (w >= 60)  return "md";
  return "sm";
}

// ── constants ─────────────────────────────────────────────────

const H = 30;
const XL = xLabels(H);
const CANVAS_W = 800;
const CANVAS_H = 200;

// ── helpers ──────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function applyContribRect(
  widget: any,
  rect: { top: number; left: number; width: number; height: number },
) {
  // drawille-based contrib widgets crash on odd widths — clamp to even.
  const evenRect = {
    ...rect,
    width: toEvenCellWidth(rect.width),
    height: Math.max(2, rect.height),
  };
  applyRect(widget, evenRect);
  if (widget && typeof widget.emit === "function") widget.emit("resize");
}

function nodeSize(node: blessed.Widgets.Node) {
  return {
    w: Math.max(1, Number(node.width) || 0),
    h: Math.max(1, Number(node.height) || 0),
  };
}

function innerSize(node: blessed.Widgets.Node) {
  const { w, h } = nodeSize(node);
  return { w: Math.max(1, w - 2), h: Math.max(1, h - 2) };
}

// ── Virtual canvas (from dashboard-xxl) ───────────────────────

type VCanvas = string[][];

function createCanvas(w: number, h: number, fill = " "): VCanvas {
  const c: VCanvas = [];
  for (let y = 0; y < h; y++) { c[y] = []; for (let x = 0; x < w; x++) c[y]![x] = fill; }
  return c;
}
function blit(c: VCanvas, ox: number, oy: number, lines: string[]) {
  const cw = c[0]?.length ?? 0, ch = c.length;
  for (let ly = 0; ly < lines.length; ly++) {
    const cy = oy + ly;
    if (cy < 0 || cy >= ch) continue;
    const line = lines[ly]!;
    for (let lx = 0; lx < line.length; lx++) {
      const cx = ox + lx;
      if (cx < 0 || cx >= cw) continue;
      c[cy]![cx] = line[lx]!;
    }
  }
}
function viewport(c: VCanvas, vx: number, vy: number, vw: number, vh: number): string {
  const ch = c.length, cw = c[0]?.length ?? 0;
  const lines: string[] = [];
  for (let row = 0; row < vh; row++) {
    const cy = vy + row;
    let line = "";
    for (let col = 0; col < vw; col++) {
      const cx = vx + col;
      line += (cy >= 0 && cy < ch && cx >= 0 && cx < cw) ? c[cy]![cx]! : "·";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
function drawBorder(c: VCanvas, ox: number, oy: number, bw: number, bh: number, label?: string) {
  if (bw < 2 || bh < 2) return;
  const cw = c[0]?.length ?? 0, ch = c.length;
  const set = (cx: number, cy: number, ch2: string) => {
    if (cx >= 0 && cx < cw && cy >= 0 && cy < ch) c[cy]![cx] = ch2;
  };
  set(ox, oy, "┌"); set(ox + bw - 1, oy, "┐");
  set(ox, oy + bh - 1, "└"); set(ox + bw - 1, oy + bh - 1, "┘");
  for (let x = 1; x < bw - 1; x++) { set(ox + x, oy, "─"); set(ox + x, oy + bh - 1, "─"); }
  for (let y = 1; y < bh - 1; y++) { set(ox, oy + y, "│"); set(ox + bw - 1, oy + y, "│"); }
  if (label && bw > 4) {
    const lbl = ` ${label} `;
    for (let i = 0; i < lbl.length && i + 2 < bw - 2; i++) set(ox + 2 + i, oy, lbl[i]!);
  }
}

// ── Pattern generators (from dashboard-xxl) ───────────────────

type Pat = (w: number, h: number, t: number) => string[];
const pats: Pat[] = [
  (w,h,t) => { const c="░▒▓█▓▒"; return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>c[(x+y+t)%c.length]).join("")); },
  (w,h,t) => Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>(x+y+t)%2===0?"╱":"╲").join("")),
  (w,h,t) => { const c="<>v^*+.o"; return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>c[(x+y+t)%c.length]).join("")); },
  (w,h,t) => { const b="⠁⠂⠄⡀⢀⠠⠐⠈"; return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>b[(x*3+y*7+t*2)%b.length]).join("")); },
  (w,h,t) => Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=> ((x+t)%4===0&&(y+t)%3===0)?"┼":(y+t)%3===0?"─":(x+t)%4===0?"│":" ").join("")),
  (w,h,t) => Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>{ const v=Math.sin((x+Math.floor(Math.sin((y+t)*0.5)*3)+t)*0.4); return v>0.3?"~":v>-0.3?"-":"_"; }).join("")),
  (w,h,t) => { const c="#=:.|"; return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>c[(x*3+y*7+t)%c.length]).join("")); },
  (w,h,t) => Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>(x+y+t)%2===0?"▄":"▀").join("")),
  (w,h,t) => { const c=" .,:;!|#@"; const cx=w/2,cy=h/2; return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>c[Math.floor(Math.sqrt((x-cx)**2+((y-cy)*2)**2)+t)%c.length]).join("")); },
  (w,h,t) => { const d="⣿⣷⣶⣦⣤⣄⣀⡀ "; return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>{ const v=Math.sin((x+t)*0.4)*Math.cos((y+t)*0.3); return d[Math.max(0,Math.min(d.length-1,Math.floor((v+1)*0.5*(d.length-1))))]; }).join("")); },
  (w,h,t) => { const c="+-|.+-|:"; return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>c[(x*3+y*5+t)%c.length]).join("")); },
];

// ── Mosaic layout for XXL view ────────────────────────────────

interface MCell { x:number; y:number; w:number; h:number; type:"figlet"|"pattern"; text?:string; font?:string; patIdx?:number; }
const GRID_R=8, GRID_C=6;
const g=(row:number,col:number,rs:number,cs:number)=>({x:col/GRID_C,y:row/GRID_R,w:cs/GRID_C,h:rs/GRID_R});
const mosaicCells:MCell[]=[
  {...g(0,0,2,3),type:"figlet",text:"SYMBIENT",font:"slant"},
  {...g(0,3,1,1),type:"pattern",patIdx:0},{...g(0,4,1,1),type:"pattern",patIdx:1},{...g(0,5,1,1),type:"pattern",patIdx:2},
  {...g(1,3,1,1),type:"pattern",patIdx:3},{...g(1,4,1,1),type:"pattern",patIdx:4},{...g(1,5,1,1),type:"pattern",patIdx:5},
  {...g(2,0,1,1),type:"pattern",patIdx:6},
  {...g(2,1,2,3),type:"figlet",text:"WIBWOB",font:"big"},
  {...g(2,4,1,1),type:"pattern",patIdx:7},{...g(2,5,1,1),type:"pattern",patIdx:8},
  {...g(3,0,1,1),type:"pattern",patIdx:9},{...g(3,4,1,1),type:"pattern",patIdx:10},{...g(3,5,1,1),type:"pattern",patIdx:0},
  {...g(4,0,1,1),type:"pattern",patIdx:1},{...g(4,1,1,1),type:"pattern",patIdx:2},
  {...g(4,2,2,3),type:"figlet",text:"DOS",font:"banner3"},
  {...g(4,5,1,1),type:"pattern",patIdx:3},
  {...g(5,0,1,1),type:"pattern",patIdx:4},{...g(5,1,1,1),type:"pattern",patIdx:5},{...g(5,5,1,1),type:"pattern",patIdx:6},
  {...g(6,0,2,2),type:"figlet",text:"BLESSED",font:"small"},
  {...g(6,2,1,1),type:"pattern",patIdx:7},{...g(6,3,1,1),type:"pattern",patIdx:8},
  {...g(6,4,2,2),type:"figlet",text:"CONTRIB",font:"small"},
  {...g(7,2,1,1),type:"pattern",patIdx:9},{...g(7,3,1,1),type:"pattern",patIdx:10},
];

// ── Emoji test data ───────────────────────────────────────────

interface EmojiTest { label:string; note:string; chars:string[]; fill?:boolean; }
const EMOJI_TESTS:EmojiTest[]=[
  {label:"Basic",note:"EAW:W — 2 cols",chars:["😀","😎","🔥","💀","👻","🎉","🚀","⭐","❤️","🌈"],fill:true},
  {label:"Skin Tone",note:"1 glyph 2 cols",chars:["👋🏻","👋🏼","👋🏽","👋🏾","👋🏿","👍🏻","👍🏿"]},
  {label:"ZWJ",note:"1 glyph 2 cols",chars:["👨‍👩‍👧‍👦","👩‍💻","🏳️‍🌈","👨‍🎤","🧑‍🚀","👩‍🔬"]},
  {label:"CJK",note:"EAW:W — 2 cols",chars:["漢","字","日","本","語","中","文","東","京","道"],fill:true},
  {label:"Box Draw",note:"EAW:N — 1 col",chars:["┌","─","┐","│","└","┘","├","┤","┼","═","║","╔","╗","╚","╝"],fill:true},
  {label:"Block Elem",note:"EAW:A",chars:["░","▒","▓","█","▀","▄","▌","▐","▍","▎","▏"],fill:true},
  {label:"Arrows",note:"EAW:N",chars:["←","→","↑","↓","↔","⇐","⇒","➜","➤"],fill:true},
  {label:"Trigrams!",note:"EAW:W — BREAKS layout",chars:["☰","☱","☲","☳","☴","☵","☶","☷"]},
];

// ── Module ───────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Dashboards V2",
    menu: [{ category: "applications", order: 57, label: "Dashboards V2" }],
    palette: { order: 222, label: "Dashboards V2" },
    action: () => {
      const win = host.createWindow({ title: "Dashboards V2", width: 140, height: 50 });
      const timers = new Set<ReturnType<typeof setInterval>>();
      let tick = 0;
      let mode: Mode = "lg";

      // ── Shell: header, tab strip, viewport ──────────────────
      const header = blessed.box({
        parent: win.body, top: 0, left: 0, width: 0, height: 2,
        tags: true,
        style: { fg: "white", bg: "blue" },
      });

      const tabStrip = blessed.box({
        parent: win.body, top: 0, left: 0, width: 0, height: 1,
        tags: true,
        style: { fg: "white", bg: "black" },
      });

      const viewport_ = blessed.box({
        parent: win.body, top: 0, left: 0, width: 0, height: 0,
        style: host.theme().body,
      });

      // Active view: 0=Overview, 1=XXL, 2=Creative
      let activeView = 0;

      function setActiveView(v: number) {
        activeView = v;
        updateTabs();
        render();
      }

      function updateTabs() {
        const tabs = ["[Overview]", "[XXL Canvas]", "[Creative Lab]"];
        let content = "";
        for (let i = 0; i < tabs.length; i++) {
          if (i === activeView) content += `{bold}{bg-white}{fg-black}${tabs[i]}{/}{/}`;
          else content += `{bg-gray}{fg-white}${tabs[i]}{/}`;
          if (i < tabs.length - 1) content += " | ";
        }
        tabStrip.setContent(content);
      }

      // ── Build Overview widgets ────────────────────────────────
      // Three mode-specific containers; only one is visible at a time.
      // No contrib.grid — manual positioning via applyRect for full responsive control.
      const overviewBox = blessed.box({
        parent: viewport_, top: 0, left: 0, width: "100%", height: "100%",
        style: { fg: "white", bg: "black" },
      });

      // ── LG/MD: contrib widgets ─────────────────────────────
      const contribBox = blessed.box({
        parent: overviewBox, top: 0, left: 0, width: "100%", height: "100%",
        style: { fg: "white", bg: "black" },
      });
      const cpuMemLine = contrib.line({
        parent: contribBox as any,
        label: " CPU & Memory ",
        showLegend: true,
        legend: { width: 10 },
        style: { line: "cyan", text: "white", baseline: "white" },
      }) as any;
      const netBar = contrib.bar({
        parent: contribBox as any,
        label: " Network I/O ",
        barWidth: 5, barSpacing: 2, maxHeight: 100,
        style: { fg: "green" },
      }) as any;
      const diskDonut = contrib.donut({
        parent: contribBox as any,
        label: " Disk ",
        radius: 8, arcWidth: 2, remainColor: "black",
      }) as any;
      const uptimeGauge = contrib.gauge({
        parent: contribBox as any,
        label: " Uptime ",
        stroke: "green", fill: "white",
      }) as any;
      const loadSpark = contrib.sparkline({
        parent: contribBox as any,
        label: " Load ",
        tags: true, style: { fg: "cyan" },
      }) as any;
      const sysLog = contrib.log({
        parent: contribBox as any,
        label: " System Log ",
        fg: "green", selectedFg: "green", bufferLength: 20,
      }) as any;
      const latLine = contrib.line({
        parent: contribBox as any,
        label: " Request Latency (ms) ",
        style: { line: "yellow", text: "white", baseline: "white" },
      }) as any;

      // Guard initial render race for contrib widgets.
      [cpuMemLine, netBar, diskDonut, uptimeGauge, loadSpark, sysLog, latLine].forEach(guardContribRender);

      // ── SM: stacked simple boxes ───────────────────────────
      const smBox = blessed.box({
        parent: overviewBox, top: 0, left: 0, width: "100%", height: "100%",
        style: { fg: "white", bg: "black" },
      });
      const smCpuMem = blessed.box({
        parent: smBox, top: 0, left: 0, right: 0,
        border: { type: "line" },
        label: " CPU & Memory ",
        tags: false, style: { fg: "cyan", border: { fg: "cyan" } },
      });
      const smNetBar = blessed.box({
        parent: smBox, top: 0, left: 0, right: 0,
        border: { type: "line" },
        label: " Network I/O ",
        tags: false, style: { fg: "green", border: { fg: "green" } },
      });
      const smBottom = blessed.box({
        parent: smBox, top: 0, left: 0, right: 0,
        border: { type: "line" },
        label: " Disk / Uptime / Load / Log ",
        tags: false, style: { fg: "white", border: { fg: "gray" } },
      });
      const smLat = blessed.box({
        parent: smBox, top: 0, left: 0, right: 0,
        border: { type: "line" },
        label: " Request Latency (ms) ",
        tags: false, style: { fg: "yellow", border: { fg: "yellow" } },
      });

      // ── State ────────────────────────────────────────────
      let cpu = randHistory(H, 20, 80), mem = randHistory(H, 40, 90), lat = randHistory(H, 5, 120);
      const logMsgs = [
        "sshd: accepted publickey","nginx: GET /api/health 200 2ms",
        "cron: backup started","docker: wibwob-web healthy",
        "postgres: checkpoint done","redis: bg save finished",
        "bun: hot reload triggered","k8s: pod wibwob-api-7f ready",
      ];

      function safeSet(widget: any, method: string, ...args: any[]) {
        try {
          if (widget && typeof (widget as any)[method] === "function") (widget as any)[method](...args);
        } catch { /* not on screen yet */ }
      }

      function guardContribRender(widget: any) {
        if (!widget || typeof widget.render !== "function") return;
        const original = widget.render.bind(widget);
        widget.render = function (...args: any[]) {
          // Some blessed-contrib widgets can render before attach sets ctx.
          // Guard to avoid crashing the whole shell on first paint race.
          if (!(this as any).ctx) return "";
          return original(...args);
        };
      }

      function positionLgMd(vw: number, vh: number) {
        const topH = Math.max(8, Math.floor(vh * 0.55));
        const netW = Math.max(20, Math.floor(vw / 3));
        const cpuW = Math.max(20, vw - netW - 1);
        applyContribRect(cpuMemLine as any, { top: 0, left: 0, width: cpuW, height: topH });
        applyContribRect(netBar as any,     { top: 0, left: cpuW + 1, width: netW, height: topH });

        // Middle row: 4 equal widgets (Disk | Uptime | Load | Log)
        const botH = vh - topH - 1;
        const midH = Math.max(6, Math.floor(botH * 0.35));
        const w4 = Math.max(10, Math.floor((vw - 3) / 4));
        applyContribRect(diskDonut as any,   { top: topH + 1, left: 0, width: w4, height: midH });
        applyContribRect(uptimeGauge as any, { top: topH + 1, left: w4 + 1, width: w4, height: midH });
        applyContribRect(loadSpark as any,   { top: topH + 1, left: (w4 + 1) * 2, width: w4, height: midH });
        applyContribRect(sysLog as any,      { top: topH + 1, left: (w4 + 1) * 3, width: Math.max(10, vw - (w4 + 1) * 3), height: midH });

        // Bottom: Latency line
        applyContribRect(latLine as any, { top: topH + midH + 1, left: 0, width: vw, height: Math.max(5, vh - topH - midH - 1) });
      }

      function positionSm(vw: number, vh: number) {
        // Stack vertically: CPU (30%) | Network (25%) | Bottom row (25%) | Latency (20%)
        const cpuH = Math.max(8, Math.floor(vh * 0.30));
        const netH = Math.max(6, Math.floor(vh * 0.25));
        const botH = Math.max(6, Math.floor(vh * 0.25));
        const latH = Math.max(5, vh - cpuH - netH - botH);
        let y = 0;
        applyRect(smCpuMem as any,  { top: y, left: 0, width: vw, height: cpuH }); y += cpuH + 1;
        applyRect(smNetBar as any,  { top: y, left: 0, width: vw, height: netH }); y += netH + 1;
        applyRect(smBottom as any,  { top: y, left: 0, width: vw, height: botH }); y += botH + 1;
        applyRect(smLat as any,     { top: y, left: 0, width: vw, height: latH });
      }

      function updateOverview(vw: number, vh: number) {
        if (mode === "sm") {
          // Simple text-based bars using box content
          const { w, h } = { w: Math.max(1, vw - 2), h: Math.max(1, Math.floor(vh * 0.30) - 2) };
          const cpuRow = Math.round(cpu[cpu.length - 1]! / 5);
          smCpuMem.setContent(
            Array.from({ length: Math.min(5, h) }, (_, i) => {
              const barH = Math.min(5, h);
              const filled = Math.round(cpuRow * barH / 20);
              return i < (barH - filled) ? " ".repeat(Math.min(w, 60)) :
                     "█".repeat(Math.min(filled * (w / barH), 60));
            }).join("\n") +
            `\nCPU: ${cpu.map(Math.round).join(", ")}` +
            `\nMem: ${mem.map(Math.round).join(", ")}`
          );
          const { w: nw, h: nh } = { w: Math.max(1, vw - 2), h: Math.max(1, Math.floor(vh * 0.25) - 2) };
          const bars = ["eth0-down","eth0-up","lo","wg0"].map(n =>
            `${n}: ${"█".repeat(Math.round(Math.random()*40+10))}`
          );
          smNetBar.setContent(bars.slice(0, Math.max(1, nh - 2)).join("\n") + `\n${vw}x${vh} sm-mode`);

          const diskPct = 55 + Math.round(Math.sin(tick*0.05)*15);
          smBottom.setContent(
            `Disk: ${"█".repeat(Math.round(diskPct/3))} ${diskPct}%` +
            `\nUptime: ${clamp(92+Math.round(Math.sin(tick*0.03)*8),0,100)}%` +
            `\nLoad: ${sinWave(tick,10,1,0.3).map(v=>Math.round(Math.abs(v)*20)).join(",")}`
          );

          const { w: lw, h: lh } = { w: Math.max(1, vw - 2), h: Math.max(1, Math.floor(vh * 0.20) - 2) };
          const latH = Math.round(lat[lat.length-1]! / 5);
          smLat.setContent(
            Array.from({ length: Math.min(5, lh) }, (_, i) => {
              const bh = Math.min(5, lh);
              const f = Math.round(latH * bh / 50);
              return i < (bh - f) ? " ".repeat(Math.min(lw, 80)) :
                     "▄".repeat(Math.min(f * (lw / bh), 80));
            }).join("\n") +
            `\np99: ${lat.map(Math.round).join(", ")}`
          );
        } else {
          // Contrib widgets update — safeSet guards against not-yet-on-screen
          cpu.push(clamp(cpu[cpu.length-1]!+(Math.random()-0.48)*12, 5, 100)); cpu.shift();
          mem.push(clamp(mem[mem.length-1]!+(Math.random()-0.5)*6, 20, 100)); mem.shift();
          safeSet(cpuMemLine, "setData", [
            { title: "CPU %", x: XL, y: cpu.map(Math.round), style: { line: "cyan" } },
            { title: "Mem %", x: XL, y: mem.map(Math.round), style: { line: "magenta" } },
          ]);
          const nl = ["eth0-down","eth0-up","lo-down","lo-up","wg0-down","wg0-up"];
          safeSet(netBar, "setData", { titles: nl, data: nl.map(() => Math.round(Math.random()*80+5)) });
          const du = 55 + Math.round(Math.sin(tick*0.05)*15);
          safeSet(diskDonut, "setData", [{ label: "Used", percent: du, color: du>80?"red":"cyan" }]);
          safeSet(uptimeGauge, "setPercent", clamp(92+Math.round(Math.sin(tick*0.03)*8), 0, 100));
          safeSet(loadSpark, "setData", ["1m","5m"], [
            sinWave(tick,30,2,0.2).map(v => Math.round(Math.abs(v)*10+10)),
            sinWave(tick*0.5,30,1.5,0.15).map(v => Math.round(Math.abs(v)*10+8)),
          ]);
          if (tick%3===0) safeSet(sysLog, "log", `${new Date().toISOString().slice(11,19)} ${logMsgs[Math.floor(Math.random()*logMsgs.length)]}`);
          lat.push(clamp(lat[lat.length-1]!+(Math.random()-0.5)*30, 1, 200)); lat.shift();
          safeSet(latLine, "setData", [{ title: "p99", x: XL, y: lat.map(Math.round), style: { line: "yellow" } }]);
        }
      }

      // ── Build XXL view ────────────────────────────────────────
      const xxlBox = blessed.box({
        parent: viewport_, top: 0, left: 0, width: "100%", height: "100%",
        style: { fg: "white", bg: "black" },
      });

      const xxlStatusBar = blessed.box({
        parent: xxlBox, bottom: 0, left: 0, right: 0, height: 1,
        tags: true, style: { fg: "white", bg: "black" },
      });
      const xxlCanvasBox = blessed.box({
        parent: xxlBox, top: 0, left: 0, right: 0, bottom: 1,
        tags: false, style: { fg: "white", bg: "black" },
      });

      const vcanvas = createCanvas(CANVAS_W, CANVAS_H);
      const figletCache = new Map<string,string[]>();
      let panX = 0, panY = 0;
      const PAN_STEP = 8, FAST_PAN = 40;

      function renderXxlCanvas() {
        for (let y = 0; y < CANVAS_H; y++) for (let x = 0; x < CANVAS_W; x++) vcanvas[y]![x] = " ";
        for (const cell of mosaicCells) {
          const ox = Math.floor(cell.x * CANVAS_W), oy = Math.floor(cell.y * CANVAS_H);
          const cw = Math.floor(cell.w * CANVAS_W), ch = Math.floor(cell.h * CANVAS_H);
          const label = cell.type === "figlet" ? cell.text : `P${cell.patIdx}`;
          drawBorder(vcanvas, ox, oy, cw, ch, label);
          const iw = cw-2, ih = ch-2;
          if (iw < 1 || ih < 1) continue;
          if (cell.type === "figlet") {
            const key = `${cell.text}|${cell.font}`;
            if (!figletCache.has(key)) figletCache.set(key, (renderFiglet(cell.text!, cell.font!)||"").split("\n"));
            const lines = figletCache.get(key)!;
            const startY = Math.max(0, Math.floor((ih-lines.length)/2));
            blit(vcanvas, ox+1, oy+1+startY, lines);
          } else {
            const fn = pats[(cell.patIdx ?? 0) % pats.length]!;
            blit(vcanvas, ox+1, oy+1, fn(iw, ih, tick));
          }
        }
      }

      function clampPan() {
        const vw = Math.max(1, (xxlCanvasBox.width as number)||80);
        const vh = Math.max(1, (xxlCanvasBox.height as number)||24);
        panX = clamp(panX, 0, CANVAS_W - vw);
        panY = clamp(panY, 0, CANVAS_H - vh);
      }

      function updateXxlView() {
        const vw = Math.max(1, (xxlCanvasBox.width as number)||80);
        const vh = Math.max(1, (xxlCanvasBox.height as number)||24);
        clampPan();
        xxlCanvasBox.setContent(viewport(vcanvas, panX, panY, vw, vh));
        const pctX = CANVAS_W > vw ? Math.round((panX/(CANVAS_W-vw))*100) : 0;
        const pctY = CANVAS_H > vh ? Math.round((panY/(CANVAS_H-vh))*100) : 0;
        xxlStatusBar.setContent(
          `{bold}VIRTUAL ${CANVAS_W}x${CANVAS_H}{/bold} vp=${vw}x${vh} pan=(${panX},${panY}) ${pctX}%x${pctY}%` +
          ` {gray-fg}arrows/hjkl: pan  Shift:fast  Home:origin{/gray-fg}`
        );
      }

      // ── Build Creative view ────────────────────────────────────
      const creativeBox = blessed.box({
        parent: viewport_, top: 0, left: 0, width: "100%", height: "100%",
        style: { fg: "white", bg: "black" },
      });

      // Sub-tabs within creative: Clock | Gradient | Emoji
      const creativeSubTab = blessed.box({
        parent: creativeBox, top: 0, left: 0, right: 0, height: 1,
        tags: true, style: { fg: "white", bg: "black" },
      });
      const creativeContent = blessed.box({
        parent: creativeBox, top: 1, left: 0, right: 0, bottom: 0,
        tags: false, style: { fg: "white", bg: "black" },
      });

      let creativeSub = 0;
      function setCreativeSub(v: number) { creativeSub = v; updateCreativeTabs(); render(); }

      function updateCreativeTabs() {
        const tabs = ["[Clock]", "[Gradient]", "[Emoji]"];
        let content = " Sub: ";
        for (let i = 0; i < tabs.length; i++) {
          if (i === creativeSub) content += `{bold}{bg-white}{fg-black}${tabs[i]}{/}{/}`;
          else content += `{bg-gray}{fg-white}${tabs[i]}{/}`;
          if (i < tabs.length-1) content += " | ";
        }
        creativeSubTab.setContent(content);
      }

      const clockBox = blessed.box({
        parent: creativeContent, top: 0, left: 0, width: 0, height: 0,
        label: " Figlet Clock ", border: { type: "line" },
        style: { fg: "cyan", border: { fg: "cyan" } },
      });
      const gradBox = blessed.box({
        parent: creativeContent, top: 0, left: 0, width: 0, height: 0,
        label: " Colour Gradients ", border: { type: "line" },
        style: { fg: "white", border: { fg: "magenta" } },
      });
      const emojiGridBox = blessed.box({
        parent: creativeContent, top: 0, left: 0, width: 0, height: 0,
        label: " Emoji Grid ", border: { type: "line" },
        style: { fg: "white", border: { fg: "yellow" } },
      });

      function positionCreative(vw: number, vh: number) {
        const contentH = Math.max(1, vh - 1);
        applyRect(creativeSubTab as any,   { top: 0, left: 0, width: vw, height: 1 });
        applyRect(creativeContent as any,  { top: 1, left: 0, width: vw, height: contentH });

        if (mode === "sm") {
          // Stack vertically: clock | gradient | emoji
          const clockH = Math.max(8, Math.floor(contentH * 0.40));
          const gradH  = Math.max(6, Math.floor(contentH * 0.30));
          const emojiH = Math.max(6, contentH - clockH - gradH - 2);
          applyRect(clockBox as any,      { top: 0, left: 0, width: vw, height: clockH });
          applyRect(gradBox as any,       { top: clockH + 1, left: 0, width: vw, height: gradH });
          applyRect(emojiGridBox as any,  { top: clockH + gradH + 2, left: 0, width: vw, height: emojiH });
        } else {
          // Side by side: clock (50%) | gradient+emoji stacked (50%)
          const cw2 = Math.max(10, Math.floor(vw / 2) - 1);
          const rh2 = vw - cw2 - 2;
          const gradH  = Math.max(6, Math.floor(contentH * 0.55));
          const emojiH = Math.max(4, contentH - gradH - 1);
          applyRect(clockBox as any,      { top: 0, left: 0, width: cw2, height: contentH });
          applyRect(gradBox as any,        { top: 0, left: cw2 + 1, width: rh2, height: gradH });
          applyRect(emojiGridBox as any,  { top: gradH + 1, left: cw2 + 1, width: rh2, height: emojiH });
        }
      }

      // Build emoji cells
      const emojiCells: { box: blessed.Widgets.BoxElement; test: EmojiTest }[] = [];
      const GCOLS = 4, GROWS = 2;
      for (let i = 0; i < EMOJI_TESTS.length && i < GCOLS * GROWS; i++) {
        const test = EMOJI_TESTS[i]!;
        const row = Math.floor(i / GCOLS), col = i % GCOLS;
        const box = blessed.box({
          parent: emojiGridBox,
          top: `${(row / GROWS * 100).toFixed(1)}%`,
          left: `${(col / GCOLS * 100).toFixed(1)}%`,
          width: `${(100 / GCOLS).toFixed(1)}%`,
          height: `${(100 / GROWS).toFixed(1)}%`,
          border: { type: "line" },
          label: ` ${test.label} `,
          tags: false,
          style: { fg: "white", border: { fg: "gray" } },
        });
        emojiCells.push({ box, test });
      }

      function updateCreative(vw: number, vh: number) {
        positionCreative(vw, vh);
        if (creativeSub === 0) {
          clockBox.setContent(renderFiglet(new Date().toTimeString().slice(0,8), "big") || new Date().toTimeString().slice(0,8));
        } else if (creativeSub === 1) {
          const { w, h } = innerSize(gradBox);
          const lines: string[] = [];
          for (let row = 0; row < Math.max(1, h-2); row++) {
            const hueStart = (tick * 5 + row * 40) % 360;
            lines.push(ansiGradientLine(Math.max(1, w), hueStart, hueStart+180));
          }
          gradBox.setContent(lines.join("\n"));
        } else {
          for (const { box, test } of emojiCells) {
            const { w, h } = innerSize(box);
            const lines: string[] = [test.note, ""];
            if (test.fill) {
              for (let y = 0; y < h-2; y++) {
                let line = "";
                for (let x = 0; x < w; x++) line += test.chars[(x+y+tick)%test.chars.length]!;
                lines.push(line);
              }
            } else {
              let line = "";
              for (const ch of test.chars) {
                line += ch + " ";
                if (line.length > w-4) { lines.push(line); line = ""; }
              }
              if (line) lines.push(line);
            }
            box.setContent(lines.join("\n"));
          }
        }
      }

      // ── Keyboard: tab navigation ────────────────────────────────
      viewport_.on("keypress", (ch: string, key: any) => {
        if (activeView === 1) {
          // XXL panning
          const fast = !!key.shift;
          const step = fast ? FAST_PAN : PAN_STEP;
          if (key.name === "left" || key.full === "h") panX -= step;
          else if (key.name === "right" || key.full === "l") panX += step;
          else if (key.name === "up" || key.full === "k") panY -= step;
          else if (key.name === "down" || key.full === "j") panY += step;
          else if (key.name === "home") { panX = 0; panY = 0; }
          else if (key.name === "end") { panX = CANVAS_W; panY = CANVAS_H; }
          else return;
          clampPan(); updateXxlView(); return;
        }
        if (key.name === "left" || key.full === "h") setActiveView(Math.max(0, activeView-1));
        else if (key.name === "right" || key.full === "l") setActiveView(Math.min(2, activeView+1));
        else if (activeView === 2 && (key.name === "up" || key.full === "k")) setCreativeSub(Math.max(0, creativeSub-1));
        else if (activeView === 2 && (key.name === "down" || key.full === "j")) setCreativeSub(Math.min(2, creativeSub+1));
      });

      // ── Layout ────────────────────────────────────────────────
      function render() {
        tick++; // advance animation clock
        const rawBw = Number(win.body.width) || 0;
        const rawBh = Number(win.body.height) || 0;
        if (rawBw < 20 || rawBh < 5) return; // wait for real window dimensions
        const bw = Math.ceil(rawBw / 2) * 2;
        const bh = rawBh;
        mode = pickMode(bw);

        // Explicit body dimensions so children with bottom/top work correctly
        applyRect(win.body as any, { top: 0, left: 0, width: bw, height: bh });

        // Shell layout: header(2) | tabStrip(1) | viewport(remaining)
        const shellH = 3; // header(2) + tabStrip(1)
        applyRect(header as any, { top: 0, left: 0, width: bw, height: 2 });
        applyRect(tabStrip as any, { top: 2, left: 0, width: bw, height: 1 });
        applyRect(viewport_ as any, { top: shellH, left: 0, width: bw, height: Math.max(1, bh - shellH) });

        updateTabs();
        header.setContent(
          `{bold}{bg-blue} Dashboards V2 {/bg-blue}{/bold}` +
          `  mode=${mode.toUpperCase()}  ${bw}x${bh}` +
          `{gray-fg}   <- ->:view  up-down:sub-tab{/gray-fg}`
        );

        // Show/hide views based on active tab
        const vw = Math.max(1, bw - 2);
        const vh = Math.max(1, Math.round(bh - 3) - 2); // minus shell + border

        overviewBox.hidden = activeView !== 0;
        xxlBox.hidden = activeView !== 1;
        creativeBox.hidden = activeView !== 2;

        if (activeView === 0) {
          // Responsive: show contrib boxes on lg/md, stacked text boxes on sm
          contribBox.hidden = mode === "sm";
          smBox.hidden = mode !== "sm";
          if (mode === "sm") {
            positionSm(vw, vh);
          } else {
            positionLgMd(vw, vh);
          }
          updateOverview(vw, vh);
        } else if (activeView === 1) {
          renderXxlCanvas();
          updateXxlView();
        } else {
          updateCreativeTabs();
          updateCreative(vw, vh);
        }

        host.screen.render();
      }

      createTimer(render, 1000, timers);
      setTimeout(() => { render(); render(); }, 200);

      win.onResize(() => render());
      win.onCleanup(() => {
        clearTimers(timers);
      });
      win.onRestyle(() => {
        overviewBox.style = host.theme().body;
        xxlBox.style = host.theme().body;
        creativeBox.style = host.theme().body;
        render();
      });

      win.describeState(() => ({
        summary: `Dashboards V2 — ${["Overview","XXL","Creative"][activeView]} | mode=${mode} | tick=${tick}`,
        view: ["Overview","XXL","Creative"][activeView],
        mode,
        tick,
        panX,
        panY,
      }));
      win.captureText(() => `Dashboards V2 — ${["Overview","XXL","Creative"][activeView]} tick=${tick}`);

      win.focus();
    },
  });
}
