import path from "node:path";
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  blankGrid,
  paintText,
  gridToText,
  createCanvas,
  createHeaderBar,
  createStatusBar,
  safeWriteFile,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "ASCII Studio";
const BRUSH_CHARS = ["█", "▓", "▒", "░", "#", "*", ".", "~", "○", "●", "■", "□"];

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "ASCII art drawing studio. Arrow keys: move, Space: paint, b: brush, c: clear, s: save.",
    menu: [{ category: "applications", order: 206, label: APP_TITLE }],
    palette: { order: 206, label: `Open ${APP_TITLE}` },
    action: () => {
      let cursorX = 0;
      let cursorY = 0;
      let brushIdx = 0;
      let grid: string[][] = [];
      let gridW = 40;
      let gridH = 15;

      const win = host.createWindow({ title: APP_TITLE, width: 50, height: 22 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: `brush: ${BRUSH_CHARS[brushIdx]}`,
      });

      const canvas = createCanvas(win.body, {
        topOffset: 1,
        bottomOffset: 1,
      });

      const status = createStatusBar(win.body, {
        left: "arrows: move  space: paint  b: brush  c: clear  s: save",
        right: "(0,0)",
      });

      const initGrid = () => {
        const size = canvas.getSize();
        gridW = Math.max(10, size.width);
        gridH = Math.max(5, size.height);
        grid = blankGrid(gridW, gridH);
        cursorX = Math.min(cursorX, gridW - 1);
        cursorY = Math.min(cursorY, gridH - 1);
      };

      const render = () => {
        // Create a display copy with cursor overlay
        const displayGrid = grid.map(row => [...row]);
        if (cursorY >= 0 && cursorY < displayGrid.length) {
          const row = displayGrid[cursorY];
          if (row && cursorX >= 0 && cursorX < row.length) {
            // Show cursor as inverted character
            const ch = row[cursorX] === " " ? "▏" : row[cursorX];
            row[cursorX] = `\x1b[7m${ch}\x1b[0m`;
          }
        }
        canvas.setContent(gridToText(displayGrid));
        status.update({ right: `(${cursorX},${cursorY}) ${BRUSH_CHARS[brushIdx]}` });
        host.screen.render();
      };

      const paint = () => {
        paintText(grid, cursorX, cursorY, BRUSH_CHARS[brushIdx]);
        render();
      };

      const move = (dx: number, dy: number) => {
        cursorX = Math.max(0, Math.min(gridW - 1, cursorX + dx));
        cursorY = Math.max(0, Math.min(gridH - 1, cursorY + dy));
        render();
      };

      const cycleBrush = () => {
        brushIdx = (brushIdx + 1) % BRUSH_CHARS.length;
        header.update({ right: `brush: ${BRUSH_CHARS[brushIdx]}` });
        render();
      };

      const clearCanvas = () => {
        grid = blankGrid(gridW, gridH);
        render();
      };

      const saveArt = () => {
        const text = gridToText(grid);
        const filePath = path.join(host.repoRoot, "scratch", "ascii-art", `art_${Date.now()}.txt`);
        const ok = safeWriteFile(filePath, text);
        const name = path.basename(filePath);
        host.flash(ok ? `Saved: ${name}` : "Save failed");
        status.update({ left: ok ? `saved: ${name}` : "save failed" });
        host.screen.render();
      };

      // Erase under cursor
      const erase = () => {
        paintText(grid, cursorX, cursorY, " ");
        render();
      };

      canvas.element.key(["up"], () => move(0, -1));
      canvas.element.key(["down"], () => move(0, 1));
      canvas.element.key(["left"], () => move(-1, 0));
      canvas.element.key(["right"], () => move(1, 0));
      canvas.element.key(["space"], paint);
      canvas.element.key(["b"], cycleBrush);
      canvas.element.key(["c"], clearCanvas);
      canvas.element.key(["s"], saveArt);
      canvas.element.key(["e"], erase);

      initGrid();

      win.describeState(() => ({
        summary: `ASCII Studio — ${gridW}x${gridH}, cursor: (${cursorX},${cursorY}), brush: ${BRUSH_CHARS[brushIdx]}`,
        gridWidth: gridW,
        gridHeight: gridH,
        cursorX,
        cursorY,
        brush: BRUSH_CHARS[brushIdx],
      }));

      win.captureText(() => {
        const content = gridToText(grid).trim();
        return content.length > 0
          ? content
          : `ASCII Studio — ${gridW}x${gridH} blank canvas. brush: ${BRUSH_CHARS[brushIdx]}`;
      });

      win.onResize(() => {
        // Preserve existing art on resize
        const oldGrid = grid;
        initGrid();
        for (let y = 0; y < Math.min(oldGrid.length, grid.length); y++) {
          for (let x = 0; x < Math.min(oldGrid[y]!.length, grid[y]!.length); x++) {
            grid[y]![x] = oldGrid[y]![x]!;
          }
        }
        render();
      });

      win.onRestyle(() => {
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        header.destroy();
        canvas.destroy();
        status.destroy();
      });

      win.setFocusTarget(canvas.element);
      win.focus();
      render();

      return { ok: true, windowId: win.id };
    },
  });
}
