// ─── Cat in Glasgow — module entry ──────────────────────────
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";
import { type Camera, hash2d } from "./types.js";
import { genCity, getCell, isWalkable, Tile } from "./city.js";
import { renderCity } from "./renderer.js";
import { placeNPCs, updateNPCs, nearestNPC, npcDialogue } from "./npcs.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Cat in Glasgow",
    description: "Be a cat exploring Glasgow tenements at night",
    menu: [{ category: "applications", order: 171, label: "Cat in Glasgow" }],
    palette: { order: 171, label: "Open Cat in Glasgow" },
    action: () => openGame(host),
  });
}

function openGame(host: MicroappHost) {
  const win = host.createWindow({ title: "Cat in Glasgow", width: 80, height: 32 });
  setTimeout(() => win.maximize(), 50);
  const timers = new Set<ReturnType<typeof setInterval>>();

  const canvas = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 2,
    style: host.theme().body, tags: false,
  });
  const status = blessed.box({
    parent: win.body,
    bottom: 0, left: 0, right: 0, height: 1,
    style: host.theme().muted
      ? { fg: host.theme().muted.fg, bg: host.theme().body.bg }
      : { fg: "grey", bg: host.theme().body.bg },
    tags: false,
  });
  const sep = blessed.box({
    parent: win.body,
    bottom: 1, left: 0, right: 0, height: 1,
    content: "", style: host.theme().body, tags: false,
  });

  // World
  const seed = Math.floor(Math.random() * 100000);
  const city = genCity(120, 120, seed);
  const npcs = placeNPCs(city, seed);

  // Find walkable start
  let px = 60, py = 60;
  for (let r = 0; r < 20; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (isWalkable(getCell(city, 60 + dx, 60 + dy).tile)) {
          px = 60 + dx; py = 60 + dy; r = 99; break;
        }
      }

  const cam: Camera = { x: px, y: py, z: 0, yaw: 45, zoom: 1.0 };
  let tick = 0;
  const keys = new Set<string>();

  // Weather — Glasgow: mostly rain
  let raining = true;
  let weatherTimer = 100;

  // Day/night — mostly night
  let isNight = true;
  let dayTimer = 400; // long nights

  // Messages
  let msg = "You are a cat. WASD to move. Q/E rotate. Space to interact.";
  let msgTimer = 60;

  // Cat actions
  let fishCount = 0;
  let binsKnocked = 0;

  function showMsg(text: string, dur = 40) { msg = text; msgTimer = dur; }

  function interact() {
    const cell = getCell(city, Math.floor(px), Math.floor(py));
    // Knock over bin
    if (cell.tile === Tile.BIN) {
      binsKnocked++;
      showMsg(`*knocks bin over* (${binsKnocked} total)`);
      return;
    }
    // Chip shop — steal fish
    let nearChip = false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (getCell(city, Math.floor(px) + dx, Math.floor(py) + dy).tile === Tile.CHIP_SHOP)
          nearChip = true;
    if (nearChip) {
      fishCount++;
      showMsg(`*steals fish from chip shop* (${fishCount} fish)`);
      return;
    }
    // Talk to NPC
    const npc = nearestNPC(npcs, px, py, 3);
    if (npc) {
      showMsg(npcDialogue(npc, tick));
      return;
    }
    // Puddle
    if (cell.tile === Tile.PUDDLE) {
      showMsg("*drinks from puddle*");
      return;
    }
    showMsg("*meows into the Glasgow night*");
  }

  function getSize() {
    return {
      w: Math.max(8, Number(canvas.width) || 60),
      h: Math.max(4, Number(canvas.height) || 24),
    };
  }

  function update() {
    const { w, h } = getSize();

    // Movement
    const yr = cam.yaw * Math.PI / 180;
    const cosY = Math.cos(yr), sinY = Math.sin(yr);
    let dx = 0, dy = 0;
    if (keys.has("w") || keys.has("up"))    { dx += sinY; dy -= cosY; }
    if (keys.has("s") || keys.has("down"))  { dx -= sinY; dy += cosY; }
    if (keys.has("d") || keys.has("right")) { dx += cosY; dy += sinY; }
    if (keys.has("a") || keys.has("left"))  { dx -= cosY; dy -= sinY; }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx = dx / len * 0.4; dy = dy / len * 0.4;
      const nx = Math.floor(px + dx), ny = Math.floor(py + dy);
      if (nx >= 1 && nx < city.w - 1 && ny >= 1 && ny < city.h - 1) {
        const target = getCell(city, nx, ny);
        if (isWalkable(target.tile)) {
          // Cats can climb — allow height changes up to building height
          const curH = getCell(city, Math.floor(px), Math.floor(py)).height;
          if (target.height <= curH + 2) {
            px += dx; py += dy;
          }
        }
      }
    }
    px = Math.max(1, Math.min(city.w - 2, px));
    py = Math.max(1, Math.min(city.h - 2, py));

    // Camera follow
    const ch = getCell(city, Math.floor(px), Math.floor(py)).height;
    cam.x += (px - cam.x) * 0.15;
    cam.y += (py - cam.y) * 0.15;
    cam.z += (ch * 1.5 - cam.z) * 0.1;

    // Weather
    weatherTimer--;
    if (weatherTimer <= 0) {
      raining = hash2d(tick, 77, 42) < 0.7; // 70% chance of rain. It's Glasgow.
      weatherTimer = 80 + Math.floor(hash2d(tick, 99, 11) * 120);
    }

    // Day/night
    dayTimer--;
    if (dayTimer <= 0) {
      isNight = !isNight;
      dayTimer = isNight ? 400 : 150; // long nights, short days
      showMsg(isNight ? "Night falls over Glasgow." : "Grey dawn breaks.");
    }

    // NPCs
    updateNPCs(npcs, city, tick);

    // Message timer
    if (msgTimer > 0) msgTimer--;

    // Render
    const pz = ch * 1.5;
    const ansi = renderCity(city, cam, w, h, px, py, pz, tick, isNight, npcs, raining);
    canvas.setContent(ansi);

    // Status
    sep.setContent("─".repeat(w));
    const cell = getCell(city, Math.floor(px), Math.floor(py));
    const tileNames: Record<number, string> = {
      0: "Street", 1: "Pavement", 2: "Close", 3: "Back Court",
      4: "Tenement", 5: "Tenement", 6: "Wall", 7: "Bin",
      8: "Chip Shop", 9: "Puddle", 10: "Grass", 11: "Rooftop",
    };
    const where = tileNames[cell.tile] ?? "???";
    const weather = raining ? "🌧 Rain" : isNight ? "🌙 Clear" : "☁ Overcast";
    const time = isNight ? "Night" : "Day";
    const msgDisp = msgTimer > 0 ? `  ${msg}` : "";
    status.setContent(
      ` 🐈 ${Math.floor(px)},${Math.floor(py)}  ${where}  ` +
      `${weather}  ${time}  🐟${fishCount} 🗑${binsKnocked}  ` +
      `WASD Q/E Space` + msgDisp,
    );

    host.screen.render();
    tick++;
  }

  const keyHandler = (_ch: string, key: { name?: string } | undefined) => {
    if (!key?.name) return;
    const n = key.name.toLowerCase();
    if (n === "q") cam.yaw = (cam.yaw + 15) % 360;
    else if (n === "e") cam.yaw = (cam.yaw + 345) % 360;
    else if (n === "=") cam.zoom = Math.min(3, cam.zoom + 0.15);
    else if (n === "-") cam.zoom = Math.max(0.4, cam.zoom - 0.15);
    else if (n === "space") interact();
    else if (["w", "a", "s", "d", "up", "down", "left", "right"].includes(n)) {
      keys.add(n); setTimeout(() => keys.delete(n), 200);
    }
  };

  host.screen.on("keypress", keyHandler);
  createTimer(() => update(), 125, timers);
  win.onResize(() => update());

  win.describeState(() => {
    const cell = getCell(city, Math.floor(px), Math.floor(py));
    return {
      summary: `Cat in Glasgow — ${Math.floor(px)},${Math.floor(py)}`,
      position: { x: Math.floor(px), y: Math.floor(py) },
      tile: cell.tile,
      isNight, raining,
      fish: fishCount, binsKnocked,
      npcCount: npcs.length,
      yaw: Math.floor(cam.yaw), zoom: cam.zoom,
      tick,
    };
  });

  win.captureText(() => {
    return `Cat in Glasgow — pos:${Math.floor(px)},${Math.floor(py)}\n\n${canvas.getContent()}`;
  });

  win.onRestyle(() => {
    const t = host.theme();
    canvas.style = { ...t.body };
    status.style = t.muted ? { fg: t.muted.fg, bg: t.body.bg } : { fg: "grey", bg: t.body.bg };
    sep.style = { ...t.body };
    host.screen.render();
  });

  win.onCleanup(() => {
    host.screen.removeListener("keypress", keyHandler);
    clearTimers(timers);
  });

  win.focus();
}
