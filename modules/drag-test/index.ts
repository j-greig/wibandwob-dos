/**
 * drag-test — Minimal module: one box in a window, arrow keys move it.
 * 
 * FINDINGS:
 * - blessed sends mousedown (NOT mousemove) during drag
 * - win.onInput only receives string text, never key events
 * - Arrow keys must be handled at screen level, gated by window focus
 */

import blessed from "blessed";
import fs from "node:fs";
import path from "node:path";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

const LOG_PATH = path.resolve(import.meta.dir, "../../scratch/drag-test.log");
function log(msg: string) {
  fs.appendFileSync(LOG_PATH, `${Date.now()} ${msg}\n`);
}

export default function setup(host: MicroappHost) {
  function openDragTest() {
    fs.writeFileSync(LOG_PATH, `=== DRAG TEST OPENED ${new Date().toISOString()} ===\n`);

    const win = host.createWindow({
      title: "Drag Test",
      width: 60,
      height: 30,
      left: 10,
      top: 5,
    });

    const container = blessed.box({
      parent: win.body,
      top: 0, left: 0, right: 0, bottom: 1,
      style: host.theme().body,
    });

    let boxX = 5;
    let boxY = 5;

    const panel = blessed.box({
      parent: container,
      top: boxY, left: boxX,
      width: 20, height: 7,
      border: "line",
      mouse: true,
      content: "DRAG ME\nor arrows",
      style: { ...host.theme().body, border: { fg: "yellow" } },
    });
    (panel as any).focusable = false;

    const status = blessed.box({
      parent: win.body,
      bottom: 0, left: 0, right: 0, height: 1,
      style: host.theme().header,
      content: ` pos: ${boxX},${boxY}`,
    });

    function updatePos(x: number, y: number) {
      const cw = Number(container.width) || 60;
      const ch = Number(container.height) || 30;
      boxX = Math.max(0, Math.min(x, cw - 20 - 2));
      boxY = Math.max(0, Math.min(y, ch - 7 - 2));
      panel.left = boxX;
      panel.top = boxY;
      status.setContent(` pos: ${boxX},${boxY}`);
      host.screen.render();
    }

    // === KEYBOARD: screen-level, gated by window focus ===
    const screenKeyHandler = (ch: any, key: any) => {
      // Only act when our window is focused
      const focused = (host.screen as any).focused;
      const isOurs = focused === container || focused === win.body ||
                     focused === panel || focused === status;
      if (!isOurs) return;

      const speed = key?.shift ? 5 : 1;
      if (key?.name === "up") { log("[KEY] up"); updatePos(boxX, boxY - speed); }
      if (key?.name === "down") { log("[KEY] down"); updatePos(boxX, boxY + speed); }
      if (key?.name === "left") { log("[KEY] left"); updatePos(boxX - speed, boxY); }
      if (key?.name === "right") { log("[KEY] right"); updatePos(boxX + speed, boxY); }
    };
    host.screen.on("keypress", screenKeyHandler);

    // === MOUSE DRAG: handle mousedown during drag (blessed doesn't send mousemove) ===
    let dragging: { offsetX: number; offsetY: number } | undefined;
    let dragMoved = false;

    panel.on("mousedown", (data: any) => {
      const pl = (panel as any).aleft ?? 0;
      const pt = (panel as any).atop ?? 0;
      dragging = { offsetX: data.x - pl, offsetY: data.y - pt };
      dragMoved = false;
      log(`[DRAG START] x=${data.x} y=${data.y}`);
    });

    const screenMouseHandler = (data: any) => {
      if (!dragging) return;

      if (data.action === "mouseup") {
        log(`[DRAG END] moved=${dragMoved}`);
        dragging = undefined;
        dragMoved = false;
        return;
      }

      // blessed sends mousedown (not mousemove!) during drag
      if (data.action === "mousedown" || data.action === "mousemove") {
        const cl = (container as any).aleft ?? 0;
        const ct = (container as any).atop ?? 0;
        const newX = Math.max(0, data.x - dragging.offsetX - cl);
        const newY = Math.max(0, data.y - dragging.offsetY - ct);
        if (newX !== boxX || newY !== boxY) {
          dragMoved = true;
          log(`[DRAG MOVE] ${newX},${newY}`);
          updatePos(newX, newY);
        }
      }
    };
    host.screen.on("mouse", screenMouseHandler);

    // Focus poll for debugging
    const focusTimer = setInterval(() => {
      const focused = (host.screen as any).focused;
      const tp = focused?.type ?? "none";
      const isContainer = focused === container;
      const isBody = focused === win.body;
      log(`[focus] type=${tp} isContainer=${isContainer} isBody=${isBody}`);
    }, 5000);

    win.onCleanup(() => {
      host.screen.removeListener("keypress", screenKeyHandler);
      host.screen.removeListener("mouse", screenMouseHandler);
      clearInterval(focusTimer);
    });

    container.focus();
    host.screen.render();
  }

  host.registerCommand({
    id: "open",
    label: "Drag Test",
    description: "Minimal drag test — one box, arrow keys move it.",
    action: openDragTest,
    multiInstance: false,
    direct: true,
    palette: { order: 99, label: "Drag Test" },
  });
}
