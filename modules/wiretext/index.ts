/**
 * Wiretext — ASCII art diagramming microapp for WibWob-DOS.
 *
 * Inspired by https://github.com/mualat/wiretext
 * Unicode box-drawing wireframes directly in the terminal.
 */
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";

// ── Types ──────────────────────────────────────────────────────────────

type BoxStyle = "single" | "double" | "rounded" | "heavy";
type Tool = "select" | "box" | "text" | "line" | "arrow" | "pencil" | "eraser";

interface Position { col: number; row: number; }

interface CanvasObject {
  id: string;
  type: "box" | "text" | "line" | "arrow" | "pencil";
  position: Position;
  width: number;
  height: number;
  zIndex: number;
  borderStyle?: BoxStyle;
  fill?: "solid" | "transparent";
  label?: string;
  content?: string;
  endPosition?: Position;
  points?: Position[];
}

type Grid = string[][];

interface DragState {
  type: "none" | "drawing" | "moving" | "resizing";
  startCol?: number;
  startRow?: number;
  objectId?: string;
  offsetCol?: number;
  offsetRow?: number;
  handle?: string;
}

// ── Box Drawing Characters ─────────────────────────────────────────────

const BOX = {
  single:  { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", tr2: "├", tl2: "┤" },
  double:  { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║", tr2: "╠", tl2: "╣" },
  rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", tr2: "├", tl2: "┤" },
  heavy:   { tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃", tr2: "┣", tl2: "┫" },
};

const ARROWS = { right: "→", left: "←", up: "↑", down: "↓" };

// ── ANSI helpers ───────────────────────────────────────────────────────

const A = { r: "\x1b[0m", b: "\x1b[1m", d: "\x1b[2m", i: "\x1b[3m", rev: "\x1b[7m" };

function ansiColour(name: string): string {
  const map: Record<string, string> = {
    black: "\x1b[30m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
    blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
    gray: "\x1b[90m", grey: "\x1b[90m",
    "light-red": "\x1b[91m", "light-green": "\x1b[92m", "light-yellow": "\x1b[93m",
    "light-blue": "\x1b[94m", "light-magenta": "\x1b[95m", "light-cyan": "\x1b[96m",
    "light-white": "\x1b[97m",
  };
  if (map[name]) return map[name];
  if (name.startsWith("#")) {
    const n = parseInt(name.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  return "\x1b[37m";
}

function ansiBgColour(name: string): string {
  const map: Record<string, string> = {
    black: "\x1b[40m", red: "\x1b[41m", green: "\x1b[42m", yellow: "\x1b[43m",
    blue: "\x1b[44m", magenta: "\x1b[45m", cyan: "\x1b[46m", white: "\x1b[47m",
    gray: "\x1b[100m", grey: "\x1b[100m",
    "light-blue": "\x1b[104m",
  };
  if (map[name]) return map[name];
  if (name.startsWith("#")) {
    const n = parseInt(name.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return `\x1b[48;2;${r};${g};${b}m`;
  }
  return "\x1b[40m";
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ── Grid Engine (adapted from wiretext boxDrawing.ts) ──────────────────

function createGrid(cols: number, rows: number): Grid {
  const grid: Grid = [];
  for (let r = 0; r < rows; r++) grid.push(Array(cols).fill(" "));
  return grid;
}

function setChar(grid: Grid, col: number, row: number, ch: string): void {
  if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
    if (ch !== " " || grid[row][col] === " ") grid[row][col] = ch;
  }
}

function drawChar(grid: Grid, col: number, row: number, ch: string): void {
  if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
    grid[row][col] = ch;
  }
}

function drawBoxBorder(grid: Grid, col: number, row: number, w: number, h: number, style: BoxStyle): void {
  const c = BOX[style];
  if (!c || w < 2 || h < 2) return;
  setChar(grid, col, row, c.tl);
  setChar(grid, col + w - 1, row, c.tr);
  setChar(grid, col, row + h - 1, c.bl);
  setChar(grid, col + w - 1, row + h - 1, c.br);
  for (let x = 1; x < w - 1; x++) {
    setChar(grid, col + x, row, c.h);
    setChar(grid, col + x, row + h - 1, c.h);
  }
  for (let y = 1; y < h - 1; y++) {
    setChar(grid, col, row + y, c.v);
    setChar(grid, col + w - 1, row + y, c.v);
  }
}

function fillRect(grid: Grid, col: number, row: number, w: number, h: number): void {
  for (let r = row + 1; r < row + h - 1 && r < grid.length; r++) {
    for (let c = col + 1; c < col + w - 1 && c < grid[0].length; c++) {
      drawChar(grid, c, r, " ");
    }
  }
}

function placeCenteredText(grid: Grid, col: number, row: number, w: number, h: number, text: string): void {
  if (!text) return;
  const cy = row + Math.floor(h / 2);
  const maxLen = w - 4;
  const display = text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
  const sx = col + Math.floor((w - display.length) / 2);
  for (let i = 0; i < display.length; i++) setChar(grid, sx + i, cy, display[i]);
}

function* linePoints(x0: number, y0: number, x1: number, y1: number) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    yield { col: x0, row: y0 };
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function renderObjectsToGrid(objects: CanvasObject[], cols: number, rows: number): Grid {
  const grid = createGrid(cols, rows);
  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

  for (const obj of sorted) {
    const { col, row } = obj.position;
    switch (obj.type) {
      case "box": {
        if (obj.fill !== "transparent") fillRect(grid, col, row, obj.width, obj.height);
        drawBoxBorder(grid, col, row, obj.width, obj.height, obj.borderStyle || "single");
        if (obj.label) placeCenteredText(grid, col, row, obj.width, obj.height, obj.label);
        break;
      }
      case "text": {
        const lines = (obj.content || "").split("\n");
        for (let i = 0; i < lines.length; i++) {
          for (let j = 0; j < lines[i].length; j++) {
            setChar(grid, col + j, row + i, lines[i][j]);
          }
        }
        break;
      }
      case "line": {
        if (!obj.endPosition) break;
        const ec = obj.endPosition.col, er = obj.endPosition.row;
        if (row === er) {
          const s = Math.min(col, ec), e = Math.max(col, ec);
          for (let c = s; c <= e; c++) setChar(grid, c, row, "─");
        } else if (col === ec) {
          const s = Math.min(row, er), e = Math.max(row, er);
          for (let r = s; r <= e; r++) setChar(grid, col, r, "│");
        } else {
          const dir = (ec - col > 0 && er - row > 0) || (ec - col < 0 && er - row < 0) ? "╲" : "╱";
          for (const p of linePoints(col, row, ec, er)) setChar(grid, p.col, p.row, dir);
        }
        break;
      }
      case "arrow": {
        if (!obj.endPosition) break;
        const ec = obj.endPosition.col, er = obj.endPosition.row;
        const dx = ec - col, dy = er - row;
        if (row === er) {
          const s = Math.min(col, ec), e = Math.max(col, ec);
          for (let c = s; c <= e; c++) setChar(grid, c, row, "─");
          setChar(grid, ec, er, dx > 0 ? ARROWS.right : ARROWS.left);
        } else if (col === ec) {
          const s = Math.min(row, er), e = Math.max(row, er);
          for (let r = s; r <= e; r++) setChar(grid, col, r, "│");
          setChar(grid, ec, er, dy > 0 ? ARROWS.down : ARROWS.up);
        } else {
          const dir = (dx > 0 && dy > 0) || (dx < 0 && dy < 0) ? "╲" : "╱";
          for (const p of linePoints(col, row, ec, er)) setChar(grid, p.col, p.row, dir);
          let head = ARROWS.right;
          if (dx > 0 && dy < 0) head = "↗";
          else if (dx > 0 && dy > 0) head = "↘";
          else if (dx < 0 && dy > 0) head = "↙";
          else if (dx < 0 && dy < 0) head = "↖";
          setChar(grid, ec, er, head);
        }
        break;
      }
      case "pencil": {
        for (const p of obj.points || []) drawChar(grid, p.col, p.row, "█");
        break;
      }
    }
  }
  return grid;
}

function hitTest(objects: CanvasObject[], col: number, row: number): CanvasObject | null {
  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  for (const obj of sorted) {
    if (obj.type === "box" || obj.type === "text") {
      const bb = getBBox(obj);
      if (col >= bb.col && col < bb.col + bb.w && row >= bb.row && row < bb.row + bb.h) return obj;
    } else if (obj.type === "line" || obj.type === "arrow") {
      if (!obj.endPosition) continue;
      for (const p of linePoints(obj.position.col, obj.position.row, obj.endPosition.col, obj.endPosition.row)) {
        if (p.col === col && p.row === row) return obj;
      }
    } else if (obj.type === "pencil") {
      for (const p of obj.points || []) {
        if (p.col === col && p.row === row) return obj;
      }
    }
  }
  return null;
}

function getBBox(obj: CanvasObject): { col: number; row: number; w: number; h: number } {
  if (obj.type === "text") {
    const lines = (obj.content || "").split("\n");
    return { col: obj.position.col, row: obj.position.row, w: Math.max(...lines.map(l => l.length), 1), h: lines.length || 1 };
  }
  if (obj.type === "line" || obj.type === "arrow") {
    if (!obj.endPosition) return { col: obj.position.col, row: obj.position.row, w: 1, h: 1 };
    const c1 = Math.min(obj.position.col, obj.endPosition.col);
    const r1 = Math.min(obj.position.row, obj.endPosition.row);
    return { col: c1, row: r1, w: Math.max(obj.position.col, obj.endPosition.col) - c1 + 1, h: Math.max(obj.position.row, obj.endPosition.row) - r1 + 1 };
  }
  if (obj.type === "pencil") {
    const pts = obj.points || [];
    if (!pts.length) return { col: obj.position.col, row: obj.position.row, w: 1, h: 1 };
    let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
    for (const p of pts) { minC = Math.min(minC, p.col); minR = Math.min(minR, p.row); maxC = Math.max(maxC, p.col); maxR = Math.max(maxR, p.row); }
    return { col: minC, row: minR, w: maxC - minC + 1, h: maxR - minR + 1 };
  }
  return { col: obj.position.col, row: obj.position.row, w: obj.width, h: obj.height };
}

let nextId = 1;
function genId(): string { return "obj-" + (nextId++); }

// ── Module Setup ───────────────────────────────────────────────────────

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Wiretext",
    description: "Open Wiretext — ASCII art diagramming tool.",
    menu: [{ category: "applications", order: 16, label: "Wiretext" }],
    palette: { order: 16, label: "Open Wiretext" },
    action: () => openWiretext(host),
  });
}

function openWiretext(host: MicroappHost) {
  const win = host.createWindow({ title: "Wiretext", width: 120, height: 40 });
  const timers = new Set<ReturnType<typeof setInterval>>();
  const th = host.theme();

  // ── State ──
  let tool: Tool = "select";
  let boxStyle: BoxStyle = "single";
  let objects: CanvasObject[] = [];
  let selectedId: string | null = null;
  let drag: DragState = { type: "none" };
  let scrollCol = 0, scrollRow = 0;
  const GRID_COLS = 200, GRID_ROWS = 100;
  let undoStack: CanvasObject[][] = [];
  let redoStack: CanvasObject[][] = [];
  let cursorCol = 0, cursorRow = 0;
  let textEditId: string | null = null; // inline text editing
  let statusMessage = "";
  let statusTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Layout constants ──
  const SIDEBAR_W = 20;
  const HEADER_H = 1;
  const STATUS_H = 1;

  // ── ANSI colour cache ──
  const accent = ansiColour(th.accent.fg);
  const muted = ansiColour(th.muted.fg);
  const bright = ansiColour(th.body.fg);
  const selBg = ansiBgColour(th.selected.bg);
  const selFg = ansiColour(th.selected.fg);
  const warnC = ansiColour(th.warning?.fg || "yellow");

  // ── Tool definitions ──
  const TOOLS: Array<{ id: Tool; label: string; icon: string; key: string }> = [
    { id: "select",  label: "Select",    icon: "<>", key: "V" },
    { id: "box",     label: "Box",       icon: "□",  key: "B" },
    { id: "text",    label: "Text",      icon: "Aa", key: "T" },
    { id: "line",    label: "Line",      icon: "--", key: "L" },
    { id: "arrow",   label: "Arrow",     icon: "→",  key: "A" },
    { id: "pencil",  label: "Pencil",    icon: "✎",  key: "N" },
    { id: "eraser",  label: "Eraser",    icon: "⌫",  key: "E" },
  ];

  const STYLES: Array<{ id: BoxStyle; label: string; preview: string; num: string }> = [
    { id: "single",  label: "Single",  preview: "[ ]", num: "1" },
    { id: "double",  label: "Double",  preview: "╔═╗", num: "2" },
    { id: "rounded", label: "Rounded", preview: "( )", num: "3" },
    { id: "heavy",   label: "Heavy",   preview: "┏━┓", num: "4" },
  ];

  // ── Widgets ──

  const headerBar = blessed.box({
    parent: win.body, top: 0, left: 0, right: 0, height: 1,
    style: { fg: th.titleBarFocused.fg, bg: th.titleBarFocused.bg },
  });

  const sidebarBox = blessed.box({
    parent: win.body, top: HEADER_H, left: 0, width: SIDEBAR_W, bottom: STATUS_H,
    style: { fg: th.body.fg, bg: th.body.bg }, tags: false, mouse: true,
  });

  const divider = blessed.box({
    parent: win.body, top: HEADER_H, left: SIDEBAR_W, width: 1, bottom: STATUS_H,
    style: { fg: th.muted.fg, bg: th.body.bg },
  });

  const canvasBox = blessed.box({
    parent: win.body, top: HEADER_H, left: SIDEBAR_W + 1, right: 0, bottom: STATUS_H,
    style: { fg: th.body.fg, bg: th.body.bg }, tags: false, mouse: true,
  });

  const statusBar = blessed.box({
    parent: win.body, bottom: 0, left: 0, right: 0, height: 1,
    style: { fg: th.titleBarFocused.fg, bg: th.titleBarFocused.bg },
  });

  // ── Undo/Redo ──
  function pushUndo() {
    undoStack.push(JSON.parse(JSON.stringify(objects)));
    redoStack = [];
    if (undoStack.length > 50) undoStack.shift();
  }

  function showStatus(msg: string, duration = 3000) {
    statusMessage = msg;
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => { statusMessage = ""; render(); }, duration);
    render();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.parse(JSON.stringify(objects)));
    objects = undoStack.pop()!;
    selectedId = null;
    render();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.parse(JSON.stringify(objects)));
    objects = redoStack.pop()!;
    selectedId = null;
    render();
  }

  // ── Render ──

  function render() {
    const bodyW = (win.body as any).width as number || 80;
    const bodyH = (win.body as any).height as number || 30;
    const canvasW = Math.max(1, bodyW - SIDEBAR_W - 1);
    const canvasH = Math.max(1, bodyH - HEADER_H - STATUS_H);

    // Render grid
    const grid = renderObjectsToGrid(objects, GRID_COLS, GRID_ROWS);

    // Find cells belonging to selected object for highlighting
    const selCells = new Set<string>();
    if (selectedId) {
      const selObj = objects.find(o => o.id === selectedId);
      if (selObj) {
        const bb = getBBox(selObj);
        if (selObj.type === "box") {
          // Border cells only
          for (let x = bb.col; x < bb.col + bb.w; x++) { selCells.add(`${x},${bb.row}`); selCells.add(`${x},${bb.row + bb.h - 1}`); }
          for (let y = bb.row; y < bb.row + bb.h; y++) { selCells.add(`${bb.col},${y}`); selCells.add(`${bb.col + bb.w - 1},${y}`); }
        } else if (selObj.type === "line" || selObj.type === "arrow") {
          if (selObj.endPosition) {
            for (const p of linePoints(selObj.position.col, selObj.position.row, selObj.endPosition.col, selObj.endPosition.row)) {
              selCells.add(`${p.col},${p.row}`);
            }
          }
        } else if (selObj.type === "pencil") {
          for (const p of selObj.points || []) selCells.add(`${p.col},${p.row}`);
        } else {
          for (let y = bb.row; y < bb.row + bb.h; y++) {
            for (let x = bb.col; x < bb.col + bb.w; x++) selCells.add(`${x},${y}`);
          }
        }
      }
    }

    // Canvas rendering
    const canvasLines: string[] = [];

    // Welcome screen for empty canvas
    if (objects.length === 0) {
      const p = "       "; // padding
      const welcome = [
        "",
        `${p}${accent}${A.b}+${"-".repeat(36)}+${A.r}`,
        `${p}${accent}${A.b}|${A.r}    ${bright}${A.b}W I R E T E X T${A.r}              ${accent}${A.b}|${A.r}`,
        `${p}${accent}${A.b}|${A.r}    ${muted}${A.i}ASCII wireframing in the terminal${A.r} ${accent}${A.b}|${A.r}`,
        `${p}${accent}${A.b}+${"-".repeat(36)}+${A.r}`,
        "",
        `${p}${bright}${A.b}Getting Started${A.r}`,
        `${p}${muted}Select a tool, then click-drag on the canvas.${A.r}`,
        "",
        `${p}${bright}${A.b}Tools${A.r}`,
        `${p}  ${accent}B${A.r} ${muted}Box${A.r}      ${accent}T${A.r} ${muted}Text${A.r}     ${accent}L${A.r} ${muted}Line${A.r}`,
        `${p}  ${accent}A${A.r} ${muted}Arrow${A.r}    ${accent}N${A.r} ${muted}Pencil${A.r}   ${accent}E${A.r} ${muted}Eraser${A.r}`,
        `${p}  ${accent}V${A.r} ${muted}Select (move and resize objects)${A.r}`,
        "",
        `${p}${bright}${A.b}Box Styles${A.r}`,
        `${p}  ${accent}1${A.r} ${muted}Single   ${A.r}${accent}2${A.r} ${muted}Double   ${A.r}${accent}3${A.r} ${muted}Rounded  ${A.r}${accent}4${A.r} ${muted}Heavy${A.r}`,
        "",
        `${p}${bright}${A.b}Actions${A.r}`,
        `${p}  ${accent}^Z${A.r} ${muted}Undo${A.r}       ${accent}^Y${A.r} ${muted}Redo${A.r}`,
        `${p}  ${accent}^E${A.r} ${muted}Export${A.r}     ${accent}^X${A.r} ${muted}Clear all${A.r}`,
        `${p}  ${accent}Del${A.r} ${muted}Delete selected${A.r}`,
        "",
        `${p}${muted}${A.i}designed for thinking in text${A.r}`,
      ];
      for (let y = 0; y < canvasH; y++) {
        if (y < welcome.length) {
          canvasLines.push(welcome[y]);
        } else {
          canvasLines.push("");
        }
      }
    } else {
      for (let y = 0; y < canvasH; y++) {
        let line = "";
        for (let x = 0; x < canvasW; x++) {
          const gc = scrollCol + x;
          const gr = scrollRow + y;
          const ch = (gr < GRID_ROWS && gc < GRID_COLS) ? grid[gr][gc] : " ";
          const isCursor = gc === cursorCol && gr === cursorRow;
          const isSel = selCells.has(`${gc},${gr}`);

          if (isCursor) {
            line += `${ansiBgColour(th.body.fg)}${ansiColour(th.body.bg)}${ch}${A.r}`;
          } else if (isSel) {
            line += `${selBg}${selFg}${ch}${A.r}`;
          } else if (ch !== " ") {
            line += `${accent}${ch}${A.r}`;
          } else {
            // Grid dots every 4 cells
            if ((gc % 4 === 0) && (gr % 4 === 0)) {
              line += `${muted}.${A.r}`;
            } else {
              line += " ";
            }
          }
        }
        canvasLines.push(line);
      }
    }
    canvasBox.setContent(canvasLines.join("\n"));

    // Sidebar
    renderSidebar(canvasH);

    // Divider
    const dH = Math.max(1, canvasH);
    divider.setContent(("|\n").repeat(dH).trim());

    // Header
    const headerLeft = ` ${accent}${A.b}WIRETEXT${A.r} ${muted}│${A.r} ${bright}${tool.toUpperCase()}${A.r}`;
    const headerBtns = `${muted}^Z${A.r}${bright}Undo ${A.r}${muted}^Y${A.r}${bright}Redo ${A.r}${muted}^E${A.r}${bright}Export ${A.r}${muted}^X${A.r}${bright}Clear${A.r} `;
    const hlp = stripAnsi(headerLeft).length;
    const hrp = stripAnsi(headerBtns).length;
    const hgap = Math.max(1, bodyW - hlp - hrp);
    headerBar.setContent(headerLeft + " ".repeat(hgap) + headerBtns);

    // Status bar
    const selObj = selectedId ? objects.find(o => o.id === selectedId) : null;
    const selInfo = selObj
      ? ` ${muted}|${A.r} ${accent}${selObj.type}${A.r} ${muted}${Math.round(getBBox(selObj).w)}x${Math.round(getBBox(selObj).h)}${A.r}`
      : "";
    let statusLeft: string;
    if (statusMessage) {
      statusLeft = ` ${warnC}${statusMessage}${A.r}`;
    } else {
      statusLeft = ` ${accent}${cursorCol},${cursorRow}${A.r} ${muted}|${A.r} ${bright}${boxStyle}${A.r}${selInfo}`;
    }
    const statusRight = `${muted}${objects.length} obj${A.r} ${muted}|${A.r} ${muted}${GRID_COLS}x${GRID_ROWS}${A.r} `;
    const slp = stripAnsi(statusLeft).length;
    const srp = stripAnsi(statusRight).length;
    const sgap = Math.max(1, bodyW - slp - srp);
    statusBar.setContent(statusLeft + " ".repeat(sgap) + statusRight);

    host.screen.render();
  }

  function renderSidebar(viewH: number) {
    const lines: string[] = [];

    // DRAW section
    lines.push(`${accent}${A.b} DRAW${A.r}`);
    for (const t of TOOLS) {
      const active = t.id === tool;
      if (active) {
        lines.push(`${selBg}${selFg} ${t.icon.padEnd(3)}${t.label.padEnd(12)}${t.key} ${A.r}`);
      } else {
        lines.push(` ${muted}${t.icon.padEnd(3)}${A.r}${bright}${t.label.padEnd(12)}${muted}${t.key}${A.r}`);
      }
    }

    lines.push("");
    lines.push(`${accent}${A.b} STYLE${A.r}`);
    for (const s of STYLES) {
      const active = s.id === boxStyle;
      if (active) {
        lines.push(`${selBg}${selFg} ${s.num} ${s.preview} ${s.label.padEnd(8)} ${A.r}`);
      } else {
        lines.push(` ${muted}${s.num}${A.r} ${muted}${s.preview}${A.r} ${bright}${s.label}${A.r}`);
      }
    }

    // Selected object info
    lines.push("");
    if (selectedId) {
      const selObj2 = objects.find(o => o.id === selectedId);
      if (selObj2) {
        lines.push(`${accent}${A.b} SELECTED${A.r}`);
        lines.push(` ${bright}${selObj2.type}${A.r} ${muted}${selObj2.id}${A.r}`);
        const bb = getBBox(selObj2);
        lines.push(` ${muted}pos${A.r} ${bright}${bb.col},${bb.row}${A.r}`);
        lines.push(` ${muted}size${A.r} ${bright}${bb.w}x${bb.h}${A.r}`);
        if (selObj2.borderStyle) lines.push(` ${muted}style${A.r} ${bright}${selObj2.borderStyle}${A.r}`);
        if (selObj2.content) lines.push(` ${muted}text${A.r} ${bright}${selObj2.content.slice(0, 12)}${A.r}`);
      }
    } else {
      lines.push(`${accent}${A.b} INFO${A.r}`);
      lines.push(` ${muted}${objects.length} objects${A.r}`);
      lines.push(` ${muted}^E export${A.r}`);
      lines.push(` ${muted}^X clear all${A.r}`);
    }

    // Pad to fill sidebar
    while (lines.length < viewH) lines.push("");
    sidebarBox.setContent(lines.slice(0, viewH).join("\n"));
  }

  // ── Mouse handling ──
  // We need screen-level mouse tracking for drag operations because blessed
  // doesn't reliably fire mousemove on individual widgets during drags.

  function canvasCoords(data: { x: number; y: number }): { gc: number; gr: number } | null {
    const bx = (canvasBox as any).aleft || 0;
    const by = (canvasBox as any).atop || 0;
    const cw = Number(canvasBox.width) || 1;
    const ch = Number(canvasBox.height) || 1;
    const relX = data.x - bx;
    const relY = data.y - by;
    if (relX < 0 || relY < 0 || relX >= cw || relY >= ch) return null;
    return { gc: scrollCol + relX, gr: scrollRow + relY };
  }

  canvasBox.on("mousedown", (data: blessed.Widgets.Events.IMouseEventArg) => {
    const coords = canvasCoords(data);
    if (!coords) return;
    const { gc, gr } = coords;
    cursorCol = gc;
    cursorRow = gr;

    if (tool === "select") {
      const hit = hitTest(objects, gc, gr);
      if (hit) {
        selectedId = hit.id;
        pushUndo();
        drag = { type: "moving", objectId: hit.id, offsetCol: gc - hit.position.col, offsetRow: gr - hit.position.row };
      } else {
        selectedId = null;
        drag = { type: "none" };
      }
    } else if (tool === "box" || tool === "line" || tool === "arrow") {
      pushUndo();
      drag = { type: "drawing", startCol: gc, startRow: gr };
      const id = genId();
      const obj: CanvasObject = {
        id, type: tool === "box" ? "box" : tool === "line" ? "line" : "arrow",
        position: { col: gc, row: gr }, width: 1, height: 1,
        zIndex: objects.length,
        borderStyle: boxStyle, fill: "solid",
      };
      if (tool === "line" || tool === "arrow") {
        obj.endPosition = { col: gc, row: gr };
      }
      objects.push(obj);
      selectedId = id;
      drag.objectId = id;
    } else if (tool === "text") {
      pushUndo();
      const id = genId();
      const obj: CanvasObject = {
        id, type: "text", position: { col: gc, row: gr },
        width: 1, height: 1, zIndex: objects.length,
        content: "",
      };
      objects.push(obj);
      selectedId = id;
      textEditId = id;
    } else if (tool === "pencil") {
      pushUndo();
      const id = genId();
      const obj: CanvasObject = {
        id, type: "pencil", position: { col: gc, row: gr },
        width: 1, height: 1, zIndex: objects.length,
        points: [{ col: gc, row: gr }],
      };
      objects.push(obj);
      selectedId = id;
      drag = { type: "drawing", objectId: id, startCol: gc, startRow: gr };
    } else if (tool === "eraser") {
      const hit = hitTest(objects, gc, gr);
      if (hit) {
        pushUndo();
        objects = objects.filter(o => o.id !== hit.id);
        if (selectedId === hit.id) selectedId = null;
      }
    }
    render();
  });

  // Screen-level mouse handler for drag tracking
  function handleScreenMouse(data: blessed.Widgets.Events.IMouseEventArg) {
    if (drag.type === "none") return;

    const coords = canvasCoords(data);
    if (!coords) {
      if (data.action === "mouseup") { drag = { type: "none" }; render(); }
      return;
    }
    const { gc, gr } = coords;
    cursorCol = gc;
    cursorRow = gr;

    if (data.action === "mousemove") {
      if (drag.type === "drawing" && drag.objectId) {
        const obj = objects.find(o => o.id === drag.objectId);
        if (obj) {
          if (obj.type === "box") {
            const sc = drag.startCol!, sr = drag.startRow!;
            obj.position = { col: Math.min(sc, gc), row: Math.min(sr, gr) };
            obj.width = Math.max(2, Math.abs(gc - sc) + 1);
            obj.height = Math.max(2, Math.abs(gr - sr) + 1);
          } else if (obj.type === "line" || obj.type === "arrow") {
            obj.endPosition = { col: gc, row: gr };
          } else if (obj.type === "pencil") {
            if (!obj.points) obj.points = [];
            obj.points.push({ col: gc, row: gr });
          }
        }
        render();
      } else if (drag.type === "moving" && drag.objectId) {
        const obj = objects.find(o => o.id === drag.objectId);
        if (obj) {
          const newCol = gc - (drag.offsetCol || 0);
          const newRow = gr - (drag.offsetRow || 0);
          const dc = newCol - obj.position.col;
          const dr = newRow - obj.position.row;
          obj.position = { col: newCol, row: newRow };
          if (obj.endPosition) {
            obj.endPosition = { col: obj.endPosition.col + dc, row: obj.endPosition.row + dr };
          }
          if (obj.points) {
            obj.points = obj.points.map(p => ({ col: p.col + dc, row: p.row + dr }));
          }
        }
        render();
      }
    } else if (data.action === "mouseup") {
      if (drag.type === "drawing" && drag.objectId) {
        const obj = objects.find(o => o.id === drag.objectId);
        if (obj && obj.type === "box" && (obj.width < 2 || obj.height < 2)) {
          obj.width = Math.max(2, obj.width);
          obj.height = Math.max(2, obj.height);
        }
      }
      drag = { type: "none" };
      render();
    }
  }

  host.screen.on("mouse", handleScreenMouse);

  // Sidebar mouse clicks for tool/style selection
  sidebarBox.on("mouse", (data: blessed.Widgets.Events.IMouseEventArg) => {
    if (data.action !== "mousedown") return;
    const by = (sidebarBox as any).atop || 0;
    const relY = data.y - by;

    // DRAW section starts at line 1, one tool per line
    if (relY >= 1 && relY < 1 + TOOLS.length) {
      tool = TOOLS[relY - 1].id;
      render();
      return;
    }

    // STYLE section starts after TOOLS + 2 blank lines
    const styleStart = TOOLS.length + 3;
    if (relY >= styleStart && relY < styleStart + STYLES.length) {
      boxStyle = STYLES[relY - styleStart].id;
      render();
      return;
    }
  });

  // ── Keyboard handling ──

  canvasBox.on("keypress", (_ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg) => {
    const ctrl = key.ctrl ?? false;

    // Text editing mode
    if (textEditId) {
      const obj = objects.find(o => o.id === textEditId);
      if (!obj) { textEditId = null; return; }
      if (key.name === "escape" || key.name === "return") {
        textEditId = null;
        render();
        return;
      }
      if (key.name === "backspace") {
        obj.content = (obj.content || "").slice(0, -1);
        render();
        return;
      }
      if (_ch && _ch.length === 1 && _ch.charCodeAt(0) >= 32 && !ctrl) {
        obj.content = (obj.content || "") + _ch;
        render();
        return;
      }
      return;
    }

    // Tool shortcuts
    if (!ctrl && _ch) {
      const upper = _ch.toUpperCase();
      const t = TOOLS.find(t => t.key === upper);
      if (t) { tool = t.id; render(); return; }
      // Number keys for box style
      if (upper === "1") { boxStyle = "single"; render(); return; }
      if (upper === "2") { boxStyle = "double"; render(); return; }
      if (upper === "3") { boxStyle = "rounded"; render(); return; }
      if (upper === "4") { boxStyle = "heavy"; render(); return; }
    }

    // Ctrl combos
    if (ctrl && key.name === "z") { undo(); return; }
    if (ctrl && key.name === "y") { redo(); return; }
    if (ctrl && key.name === "e") { exportToClipboard(); return; }
    if (ctrl && key.name === "x") { pushUndo(); const n = objects.length; objects = []; selectedId = null; showStatus(`Cleared ${n} objects`); return; }

    // Delete selected
    if (key.name === "delete" || key.name === "backspace") {
      if (selectedId) {
        pushUndo();
        objects = objects.filter(o => o.id !== selectedId);
        selectedId = null;
        render();
      }
      return;
    }

    // Arrow keys — scroll canvas
    if (key.name === "left") { scrollCol = Math.max(0, scrollCol - 1); render(); return; }
    if (key.name === "right") { scrollCol = Math.min(GRID_COLS - 10, scrollCol + 1); render(); return; }
    if (key.name === "up") { scrollRow = Math.max(0, scrollRow - 1); render(); return; }
    if (key.name === "down") { scrollRow = Math.min(GRID_ROWS - 10, scrollRow + 1); render(); return; }

    // Tab to focus sidebar
    if (key.name === "tab") { sidebarBox.focus(); return; }
  });

  sidebarBox.on("keypress", (_ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (key.name === "tab") { canvasBox.focus(); return; }
  });

  function exportToClipboard() {
    const grid = renderObjectsToGrid(objects, GRID_COLS, GRID_ROWS);
    // Trim to content bounds
    let minR = GRID_ROWS, maxR = 0, minC = GRID_COLS, maxC = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (grid[r][c] !== " ") {
          minR = Math.min(minR, r); maxR = Math.max(maxR, r);
          minC = Math.min(minC, c); maxC = Math.max(maxC, c);
        }
      }
    }
    if (minR > maxR) return; // empty
    const lines: string[] = [];
    for (let r = minR; r <= maxR; r++) {
      let line = "";
      for (let c = minC; c <= maxC; c++) line += grid[r][c];
      lines.push(line.trimEnd());
    }
    const text = lines.join("\n");
    host.screen.copyToClipboard(text);
    showStatus(`Exported ${lines.length} lines to clipboard`);
  }

  // ── Lifecycle ──

  win.describeState(() => ({
    summary: `Wiretext — ${tool} tool, ${objects.length} objects, style: ${boxStyle}`,
    tool, objectCount: objects.length, boxStyle,
    cursor: { col: cursorCol, row: cursorRow },
    selectedObject: selectedId,
  }));

  win.captureText(() => {
    const grid = renderObjectsToGrid(objects, GRID_COLS, GRID_ROWS);
    const lines: string[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const line = grid[r].join("").trimEnd();
      if (line) lines.push(line);
    }
    return lines.join("\n");
  });

  win.onRestyle(() => {
    const t = host.theme();
    headerBar.style = { fg: t.titleBarFocused.fg, bg: t.titleBarFocused.bg };
    statusBar.style = { fg: t.titleBarFocused.fg, bg: t.titleBarFocused.bg };
    sidebarBox.style = { fg: t.body.fg, bg: t.body.bg };
    canvasBox.style = { fg: t.body.fg, bg: t.body.bg };
    divider.style = { fg: t.muted.fg, bg: t.body.bg };
    render();
  });

  win.onResize(() => render());
  win.onCleanup(() => {
    clearTimers(timers);
    host.screen.removeListener("mouse", handleScreenMouse);
    if (statusTimeout) clearTimeout(statusTimeout);
  });

  canvasBox.focus();
  win.setFocusTarget(canvasBox);
  render();
  win.focus();
}
