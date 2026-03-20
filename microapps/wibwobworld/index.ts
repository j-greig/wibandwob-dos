import type blessed from "blessed";
import fs from "node:fs";
import path from "node:path";

import {
  createSavedTerrainArtifact,
  createTerrainMap,
  getTerrainFocusPoint,
  type SavedTerrainArtifact,
  type TerrainMap,
  type TerrainPoint,
} from "../../src/services/terrain-model.js";
import {
  renderTerrainMap,
  findTerrainPeak,
  type TerrainRenderMode,
} from "../../src/services/terrain-render.js";
import { terrainNames } from "../../src/services/contour-engine.js";
import {
  clamp,
  createCanvas,
  applyRect,
  createNodePart,
  resolveSidebarWidth,
} from "../../src/services/microapp-sdk.js";
import { debugWibWobWorld, debugWibWobWorldError } from "./debug.js";
import type {
  MicroappHost,
  MicroappSnapshotWindow,
  Rect,
  FlexChild,
  LayoutPart,
} from "../../src/services/microapp-sdk.js";
import { renderIso } from "./render-iso.js";

type WorldRenderMode = TerrainRenderMode | "iso";

const RENDER_MODES: WorldRenderMode[] = ["terrain", "contours", "iso", "hybrid", "firstperson"];
const MODE_BUTTONS = [
  { mode: "terrain", label: "TERRAIN" },
  { mode: "contours", label: "CNTRS" },
  { mode: "iso", label: "ISO" },
  { mode: "hybrid", label: "HYBRID" },
  { mode: "firstperson", label: "3D" },
] as const;
const DEFAULT_TERRAIN = Math.max(0, terrainNames.indexOf("archipelago"));
const FP_STEP = 4; // map cells per WASD keypress
const FP_TURN = Math.PI / 8; // radians per arrow-key press (22.5°)

/** 8-direction compass arrow from yaw (radians, east=0, south=π/2). */
function yawArrow(yaw: number): string {
  const ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"] as const;
  const norm = ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return ARROWS[Math.round(norm / (Math.PI / 4)) % 8]!;
}

/** Terrain-cell offset for compass arrow around a 3×3 sprite, cell_aspect=2 (chars are 2× taller than wide). */
const COMPASS_OFFSET: Record<string, [number, number]> = {
  "→":  [ 2,  0],
  "↘":  [ 2,  1],
  "↓":  [ 0,  2],
  "↙":  [-2,  1],
  "←":  [-2,  0],
  "↖":  [-2, -1],
  "↑":  [ 0, -2],
  "↗":  [ 2, -1],
};

function compassMarker(px: number, py: number, yaw: number): { x: number; y: number; glyph: string; color: string } {
  const arrow = yawArrow(yaw);
  const [dx, dy] = COMPASS_OFFSET[arrow] ?? [0, -2];
  return { x: px + dx, y: py + dy, glyph: arrow, color: "magenta" };
}
const PLAYER_LABEL = "つ◕‿◕‿◕༽つ";
const PLAYER_GLYPH = "◕";
const PLAYER_SPRITE = [
  "◕◕◕",
  "╰█╯",
  "╱ ╲",
];


function viewportOf(node: { width?: number | string; height?: number | string }) {
  return {
    width: Math.max(1, Math.floor(Number(node.width) || 0)),
    height: Math.max(1, Math.floor(Number(node.height) || 0)),
  };
}

function summarizeWater(percent: number): string {
  return `${Math.round(percent * 100)}% water`;
}

function worldDimensions(viewport: { width: number; height: number }) {
  return {
    width: Math.max(viewport.width + 12, Math.floor(viewport.width * 1.8)),
    height: Math.max(viewport.height + 8, Math.floor(viewport.height * 1.7)),
  };
}

function captureDir() {
  return path.join(process.cwd(), "scratch", "captures");
}

function saveTerrainArtifact(args: {
  map: TerrainMap;
  focus: TerrainPoint;
  renderMode: TerrainRenderMode;
  levels: number;
}): { fileName: string; artifact: SavedTerrainArtifact } {
  const dir = captureDir();
  fs.mkdirSync(dir, { recursive: true });
  const artifact = createSavedTerrainArtifact({
    map: args.map,
    focus: args.focus,
    renderMode: args.renderMode,
    levels: args.levels,
    playerLabel: PLAYER_LABEL,
    playerGlyph: PLAYER_GLYPH,
    playerSprite: PLAYER_SPRITE,
  });
  const fileName = `wibwobworld_${args.map.terrainName}_${args.map.seed}_${Date.now()}.json`;
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(artifact, null, 2), "utf8");
  return { fileName, artifact };
}

export default function setup(host: MicroappHost) {
  debugWibWobWorld("setup");
  let control:
    | {
        setTerrain: (idx: number) => void;
        setMode: (mode: WorldRenderMode) => void;
        reseed: () => void;
        setSeaLevel: (value: number) => void;
        toggleVegetation: () => void;
        setLevels: (value: number) => void;
        toggleSidebar: () => void;
        saveCapture: () => void;
        saveTerrainExport: () => string | undefined;
        joinNearestChatspot: () => string | undefined;
        /** Absolute camera placement — switches to firstperson if needed. */
        setCameraPosition: (x: number, y: number, yaw?: number) => void;
        /** Relative camera step — direction mirrors keyboard bindings. */
        moveCameraStep: (direction: "forward" | "back" | "strafe-left" | "strafe-right" | "turn-left" | "turn-right", steps?: number) => void;
      }
    | undefined;

  function openWorld(args?: Record<string, unknown>) {
    debugWibWobWorld("openWorld", args ?? {});
    const requestedRenderMode =
      typeof args?.renderMode === "string" && RENDER_MODES.includes(args.renderMode as WorldRenderMode)
        ? (args.renderMode as WorldRenderMode)
        : undefined;
    let seed = typeof args?.seed === "number" ? Math.floor(args.seed) : Math.floor(Math.random() * 100000);
    let terrainIdx = typeof args?.terrainIdx === "number" ? Math.floor(args.terrainIdx) : DEFAULT_TERRAIN;
    let renderMode: WorldRenderMode = requestedRenderMode ?? "hybrid";
    let seaLevel = typeof args?.seaLevel === "number" ? clamp(args.seaLevel, 0.08, 0.82) : 0.34;
    let levels = typeof args?.levels === "number" ? clamp(Math.floor(args.levels), 2, 12) : 6;
    let vegetationEnabled = args?.vegetationEnabled !== false;
    let sidebarOpen = args?.sidebarOpen !== false;
    let lastCaptureName = "";
    let lastTerrainExportName = "";
    let lastText = "";
    let latestTerrain: TerrainMap | undefined;
    let latestFocus: TerrainPoint | undefined;
    let latestJoinedChannelId = "";
    let hybridCacheKey = "";
    let hybridArtifact: SavedTerrainArtifact | undefined;
    // Separate cache for the hybrid iso pane — sized to the half-window, not the contour world.
    let hybridIsoCacheKey = "";
    let hybridIsoArtifact: SavedTerrainArtifact | undefined;
    // Terrain cache — keyed on the params that actually change the map.
    // Camera moves (fpCamX/fpCamY/fpYaw) never affect terrain, so we skip
    // createTerrainMap on every camera-only render. Zero visual difference.
    let terrainCacheKey = "";
    let terrainCache: TerrainMap | undefined;
    // First-person camera — seed initial position from args if provided
    // First-person camera state (independent of focus/terrain generation)
    let fpYaw: number | undefined =
      typeof args?.cameraYaw === "number" ? args.cameraYaw : undefined;
    let fpCamX: number | undefined =
      typeof args?.cameraX === "number" ? Math.round(args.cameraX) : undefined;
    let fpCamY: number | undefined =
      typeof args?.cameraY === "number" ? Math.round(args.cameraY) : undefined;

    function resetFpCamera() { fpYaw = undefined; fpCamX = undefined; fpCamY = undefined; }

    function initFpYaw() {
      if (fpYaw !== undefined) return;
      const t = latestTerrain; const f = latestFocus;
      if (!t || !f) return;
      const peak = findTerrainPeak(t);
      fpYaw = Math.atan2(peak.y - f.y, peak.x - f.x);
    }

    function moveFpCamera(angleOffset: number) {
      initFpYaw();
      const yaw = fpYaw ?? 0;
      const moveYaw = yaw + angleOffset;
      const t = latestTerrain; const f = latestFocus;
      if (!t || !f) return;
      const baseX = fpCamX ?? f.x;
      const baseY = fpCamY ?? f.y;
      fpCamX = clamp(Math.round(baseX + Math.cos(moveYaw) * FP_STEP), 0, t.width - 1);
      fpCamY = clamp(Math.round(baseY + Math.sin(moveYaw) * FP_STEP), 0, t.height - 1);
      render();
      scheduleRenderFp();
    }

    let fpRenderTimer: ReturnType<typeof setTimeout> | undefined;
    function scheduleRenderFp() {
      if (fpRenderTimer) clearTimeout(fpRenderTimer);
      fpRenderTimer = setTimeout(renderFp, 1000);
    }

    const desktopWidth = Math.max(40, Math.floor(host.geometry.width));
    const desktopHeight = Math.max(16, Math.floor(host.geometry.height));
    const initialWidth = Math.max(40, desktopWidth - 6);
    const initialHeight = Math.max(16, desktopHeight - 4);

    const win = host.createWindow({
      title: "WibWobWorld",
      width: initialWidth,
      height: initialHeight,
    });

    const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
    const bodyNode = createCanvas(win.body, { tags: true }).element;
    bodyNode.style = host.theme().body;
    const infoBlock = host.ui.createTextBlock(bodyNode, { paddingLeft: 1, paddingTop: 0 });

    const mapBox = createCanvas(bodyNode, { tags: true }).element;
    mapBox.style = host.theme().body;

    const mapPart = createNodePart(mapBox, { restyle: () => { mapBox.style = host.theme().body; } });

    const fpBox = createCanvas(bodyNode, { tags: true }).element;
    fpBox.style = host.theme().body;
    const fpPart = createNodePart(fpBox, { restyle: () => { fpBox.style = host.theme().body; } });
    const isoBox = createCanvas(bodyNode, { tags: true }).element;
    isoBox.style = host.theme().body;
    const isoPart = createNodePart(isoBox, { restyle: () => { isoBox.style = host.theme().body; } });
    const modeBarPart = host.ui.createButtonBar(
      win.body,
      MODE_BUTTONS.map(b => ({ id: b.mode, label: b.label })),
      (mode) => {
        renderMode = mode;
        if (mode === "firstperson") {
          initFpYaw();
          render();
          renderFp();
          return;
        }
        render();
      },
    );

    const body: LayoutPart<void> = {
      node: bodyNode,
      layout(rect) {
        applyRect(bodyNode, rect);

        if (renderMode === "firstperson") {
          applyRect(mapBox, { top: 0, left: rect.width, width: 0, height: 0 });
          applyRect(isoBox, { top: 0, left: rect.width, width: 0, height: 0 });
          fpPart.layout({ top: 0, left: 0, width: rect.width, height: rect.height });
          applyRect(infoBlock.node, { top: 0, left: rect.width, width: 0, height: 0 });
          return;
        }

        if (renderMode === "iso") {
          applyRect(mapBox, { top: 0, left: rect.width, width: 0, height: 0 });
          applyRect(fpBox, { top: 0, left: rect.width, width: 0, height: 0 });
          isoPart.layout({ top: 0, left: 0, width: rect.width, height: rect.height });
          applyRect(infoBlock.node, { top: 0, left: rect.width, width: 0, height: 0 });
          return;
        }

        applyRect(fpBox, { top: 0, left: rect.width, width: 0, height: 0 });

        if (renderMode === "hybrid") {
          const leftW = Math.max(1, Math.floor(rect.width / 2));
          const rightW = Math.max(1, rect.width - leftW);
          mapPart.layout({ top: 0, left: 0, width: leftW, height: rect.height });
          isoPart.layout({ top: 0, left: leftW, width: rightW, height: rect.height });
          applyRect(infoBlock.node, { top: 0, left: rect.width, width: 0, height: 0 });
          return;
        }

        applyRect(isoBox, { top: 0, left: rect.width, width: 0, height: 0 });

        if (!sidebarOpen) {
          mapPart.layout({ top: 0, left: 0, width: rect.width, height: rect.height });
          // No .hide()/.show() — use rect collapse only to avoid blessed resize event storms
          applyRect(infoBlock.node, { top: 0, left: rect.width, width: 0, height: 0 });
          return;
        }

        const sidebarWidth = resolveSidebarWidth(
          rect.width,
          { percent: 1 / 6, min: 14 },
          false, // no divider between map and info panel
          12,    // main (map) minimum width
        );
        const mapWidth = Math.max(1, rect.width - sidebarWidth);
        mapPart.layout({ top: 0, left: 0, width: mapWidth, height: rect.height });
        infoBlock.layout({ top: 0, left: mapWidth, width: sidebarWidth, height: rect.height });
      },
      update() {},
      restyle() {
        bodyNode.style = host.theme().body;
        mapPart.restyle();
        fpPart.restyle();
        isoPart.restyle();
        infoBlock.restyle();
      },
      destroy() {
        if (fpRenderTimer) clearTimeout(fpRenderTimer);
        mapPart.destroy();
        fpPart.destroy();
        isoPart.destroy();
        infoBlock.destroy();
        bodyNode.destroy();
      },
    };

    const root = host.ui.createStack(win.body, [
      { key: "header", basis: 1, part: headerBar },
      { key: "body", basis: "1fr", part: body },
      { key: "status", basis: 1, part: modeBarPart },
    ]);

    function renderFp() {
      if (renderMode !== "firstperson" || !latestTerrain || !latestFocus) return;
      const fpW = Math.max(8, Math.floor(Number(fpBox.width) || 0));
      const fpH = Math.max(4, Math.floor(Number(fpBox.height) || 0));
      if (fpW < 8 || fpH < 4) return;
      const camX = fpCamX ?? latestFocus.x;
      const camY = fpCamY ?? latestFocus.y;
      const rows = renderTerrainMap(latestTerrain, {
        mode: "firstperson", levels, tags: true,
        camera: { centerX: camX, centerY: camY, width: fpW, height: fpH },
        firstPersonCamera: { x: camX, y: camY, yaw: fpYaw },
      });
      fpBox.setContent(rows.join("\n"));
      lastText = rows.map((row) => row.replace(/\{\/?[^}]+\}/g, "")).join("\n");
      host.screen.render();
    }

    let isRendering = false;
    const render = () => {
      if (isRendering) return;
      isRendering = true;
      try {
        const frame = (win.body as any).parent;
        const innerW = Number(frame?.width) - 6;
        const innerH = Number(frame?.height) - 4;
        if (innerW < 1 || innerH < 1) return;
        root.layout({ top: 0, left: 0, width: innerW, height: innerH });
        const isoBodyH = Math.max(4, innerH - 2);
        const isoBodyW = Math.max(8, innerW);
        const hybridLeftW = Math.max(1, Math.floor(innerW / 2));
        const hybridRightW = Math.max(1, innerW - hybridLeftW);
        const hybridIsoViewportW = Math.max(1, Math.floor(hybridRightW * 0.95));
        const hybridIsoViewportH = Math.max(1, Math.floor(isoBodyH * 0.95));

        const targetViewport =
          renderMode === "firstperson" ? viewportOf(fpBox) :
          renderMode === "iso" ? { width: isoBodyW, height: isoBodyH } :
          viewportOf(mapBox);
        const mapViewport = {
          width: Math.max(8, targetViewport.width),
          height: Math.max(4, targetViewport.height),
        };
        // ISO mode: world sized so iso diamond fills canvas at scale≈1.
        // At scale=1: iso width = (mapW+mapH)*2, iso height = mapW+mapH+ISO_EXAGGERATION+2.
        // For a square map of N×N: need W=4N, H=2N+10. Solve: N=min(W/4, (H-10)/2).
        // Hybrid mode: use worldDimensions so contour map fills the left pane fully;
        // the iso renderer strides/scales to fit the right pane independently.
        const worldSize = renderMode === "iso"
          ? (() => {
              const n = Math.max(12, Math.min(Math.floor(isoBodyW / 3), Math.floor((isoBodyH - 6) / 1.5)));
              return { width: n, height: n };
            })()
          : worldDimensions(mapViewport);
        const newTerrainKey = `${seed}:${terrainIdx}:${seaLevel.toFixed(4)}:${vegetationEnabled}:${worldSize.width}x${worldSize.height}`;
        if (newTerrainKey !== terrainCacheKey || !terrainCache) {
          terrainCache = createTerrainMap({
            width: worldSize.width,
            height: worldSize.height,
            seed,
            terrainIdx,
            seaLevel,
            vegetationEnabled,
          });
          terrainCacheKey = newTerrainKey;
        }
        const terrain = terrainCache;
        const focus = getTerrainFocusPoint(terrain);
        latestTerrain = terrain;
        latestFocus = focus;
        // worldKey must NOT include viewport dimensions — resize would flush channels and participants.
        // Terrain identity = terrainName + seed only; chatspot positions are recalculated each call.
        const worldKey = `${terrain.terrainName}:${seed}`;
        const chatspots = host.worldChat.ensureWorld(worldKey, terrain.width, terrain.height);
        const nearestChatspot = host.worldChat.nearestChatspot(focus.x, focus.y);
        debugWibWobWorld("render:focus", { mapViewport, worldSize, focus });
        const camX = fpCamX ?? focus.x;
        const camY = fpCamY ?? focus.y;
        const sprite = PLAYER_SPRITE;
        const mapMode: TerrainRenderMode =
          renderMode === "firstperson"
            ? "firstperson"
            : renderMode === "terrain" || renderMode === "contours"
              ? renderMode
              : "contours";
        const mapRows = renderTerrainMap(terrain, {
          mode: mapMode,
          levels,
          tags: true,
          camera: {
            centerX: camX,
            centerY: camY,
            width: Math.max(1, mapViewport.width - 1),
            height: Math.max(1, mapViewport.height - 1),
          },
          firstPersonCamera: { x: camX, y: camY, yaw: fpYaw },
          player: renderMode === "firstperson"
            ? undefined
            : {
                x: camX,
                y: camY,
                glyph: PLAYER_GLYPH,
                color: "magenta",
                sprite,
              },
          markers: renderMode === "firstperson"
            ? undefined
            : [
                ...(fpYaw !== undefined ? [compassMarker(camX, camY, fpYaw)] : []),
                ...chatspots.map((spot) => ({
                  x: spot.x,
                  y: spot.y,
                  glyph: "C",
                  color: nearestChatspot?.id === spot.id ? "yellow" : "light-yellow",
                })),
              ],
        });
        let isoRows: string[] = [];
        if (renderMode === "iso") {
          const cacheKey = `${seed}|${seaLevel.toFixed(4)}|${levels}|${terrainIdx}`;
          if (cacheKey !== hybridCacheKey || !hybridArtifact) {
            hybridArtifact = createSavedTerrainArtifact({
              map: terrain,
              focus,
              renderMode,
              levels,
              playerLabel: PLAYER_LABEL,
              playerGlyph: PLAYER_GLYPH,
              playerSprite: PLAYER_SPRITE,
            });
            hybridCacheKey = cacheKey;
          }
          const isoRows = renderIso(hybridArtifact, isoBodyW, isoBodyH);
          isoBox.setContent(isoRows.join("\n"));
          mapBox.setContent("");
          fpBox.setContent("");
          lastText = isoRows.map((row) => row.replace(/\{\/?[^}]+\}/g, "")).join("\n");
        } else if (renderMode === "firstperson") {
          fpBox.setContent(mapRows.join("\n"));
          mapBox.setContent("");
          isoBox.setContent("");
          lastText = mapRows.map((row) => row.replace(/\{\/?[^}]+\}/g, "")).join("\n");
        } else if (renderMode === "hybrid") {
          const mapPaneW = Math.max(0, Math.floor(Number(mapBox.width) || 0));
          const mapPaneH = Math.max(0, Math.floor(Number(mapBox.height) || 0));
          const isoPaneW = hybridRightW;
          const isoPaneH = Math.max(0, Math.floor(Number(isoBox.height) || 0));

          if (mapPaneW >= 1 && mapPaneH >= 1) {
            mapBox.setContent(mapRows.join("\n"));
          } else {
            mapBox.setContent("");
          }
          if (isoPaneW >= 1 && isoPaneH >= 1) {
            // Size the iso world to the pane (same formula as standalone ISO mode),
            // not the large contour world — avoids stride compression in the right pane.
            const isoN = Math.max(12, Math.min(
              Math.floor(hybridIsoViewportW / 3),
              Math.floor((hybridIsoViewportH - 6) / 1.5),
            ));
            const isoCacheKey = `${seed}|${seaLevel.toFixed(4)}|${levels}|${terrainIdx}|${isoN}`;
            if (isoCacheKey !== hybridIsoCacheKey || !hybridIsoArtifact) {
              const isoTerrain = createTerrainMap({
                width: isoN, height: isoN, seed, terrainIdx, seaLevel, vegetationEnabled,
              });
              const isoFocus = getTerrainFocusPoint(isoTerrain);
              hybridIsoArtifact = createSavedTerrainArtifact({
                map: isoTerrain,
                focus: isoFocus,
                renderMode: "iso",
                levels,
                playerLabel: PLAYER_LABEL,
                playerGlyph: PLAYER_GLYPH,
                playerSprite: PLAYER_SPRITE,
              });
              hybridIsoCacheKey = isoCacheKey;
            }
            isoRows = renderIso(hybridIsoArtifact, hybridIsoViewportW, hybridIsoViewportH);
            isoBox.setContent(isoRows.join("\n"));
          } else {
            isoBox.setContent("");
          }
          fpBox.setContent("");
          const plainMapRows = mapRows.map((row) => row.replace(/\{\/?[^}]+\}/g, ""));
          const plainIsoRows = isoRows.map((row) => row.replace(/\{\/?[^}]+\}/g, ""));
          lastText = [...plainMapRows, "", ...plainIsoRows].join("\n");
        } else {
          mapBox.setContent(mapRows.join("\n"));
          fpBox.setContent("");
          isoBox.setContent("");
          lastText = mapRows.map((row) => row.replace(/\{\/?[^}]+\}/g, "")).join("\n");
        }

        headerBar.update({
          left: `WibWobWorld  ${terrain.terrainName}  #${seed}`,
          right: `${renderMode.toUpperCase()}  sea:${terrain.seaLevel.toFixed(2)}`,
        });
        if (sidebarOpen && Number(infoBlock.node.width) > 0) {
          infoBlock.update({
            text: [
              `Terrain: ${terrain.terrainName}`,
              `Seed: ${seed}`,
              `Render: ${renderMode}`,
              `Contours: ${levels}`,
              `Sea level: ${terrain.seaLevel.toFixed(2)}`,
              `Water: ${summarizeWater(terrain.waterCoverage)}`,
              `Vegetation: ${vegetationEnabled ? "on" : "off"}`,
              `Min elevation: ${terrain.minElevation.toFixed(2)}`,
              `Max elevation: ${terrain.maxElevation.toFixed(2)}`,
              `Player: ${PLAYER_LABEL}`,
              `Marker: ${PLAYER_GLYPH}  ${focus.x},${focus.y}`,
              `Focus biome: ${focus.biome}`,
              `Nearest chatspot: ${nearestChatspot?.label ?? "none"}`,
              `Nearest channel: ${nearestChatspot?.channelId ?? "none"}`,
              `Joined channel: ${latestJoinedChannelId || "none"}`,
              `World size: ${terrain.width}x${terrain.height}`,
              `Sidebar: open`,
              "",
              "Keys",
              " m  mode",
              " t  terrain",
              " r  reseed",
              " [ ] sea",
              " + - contours",
              " v  vegetation",
              " i  sidebar",
              " s  save capture",
              " c  join nearest chatspot",
              " q  close",
              "",
              "Game direction",
              " desktop-visible world surface",
              " agent-playable",
              " stream-friendly",
            ].join("\n"),
          });
        }
        // Tile inspect — read the cell under the cursor (camX/camY = player/cursor position)
        const cursorCell = terrain.cells[camY]?.[camX];
        const focusCell  = terrain.cells[focus.y]?.[focus.x];
        const moveCost = (cursorCell && focusCell && (camX !== focus.x || camY !== focus.y))
          ? (1 + Math.abs(cursorCell.elevation - focusCell.elevation) * 10).toFixed(1)
          : null;
        const tileInfo = cursorCell
          ? `${cursorCell.biome}  elev:${cursorCell.elevation.toFixed(2)}${cursorCell.isWater ? `  depth:${cursorCell.waterDepth.toFixed(2)}` : ""}${moveCost ? `  cost:${moveCost}` : ""}`
          : "";

        modeBarPart.update({
          leftText: renderMode === "firstperson"
            ? `←→:turn  ↑↓/ws:move  ad:strafe  m:mode  r:reseed  ${yawArrow(fpYaw ?? 0)}`
            : `↑↓←→ move  ${tileInfo}${lastCaptureName ? `  saved:${lastCaptureName}` : ""}`,
          activeId: renderMode,
        });

        win.describeState(() => ({
          summary: `WibWobWorld terrain surface — ${terrain.terrainName}, ${renderMode}${renderMode === "firstperson" ? ` ${yawArrow(fpYaw ?? 0)}` : ""}, ${summarizeWater(terrain.waterCoverage)}`,
          contentPreview: lastText.split("\n").slice(0, 10).join("\n"),
          renderMode,
          terrain: terrain.terrainName,
          terrainIdx,
          seed,
          levels,
          seaLevel: terrain.seaLevel,
          waterCoverage: terrain.waterCoverage,
          minElevation: terrain.minElevation,
          maxElevation: terrain.maxElevation,
          vegetationEnabled,
          sidebarOpen,
          playerLabel: PLAYER_LABEL,
          playerGlyph: PLAYER_GLYPH,
          playerSprite: PLAYER_SPRITE.join("\n"),
          playerX: focus.x,
          playerY: focus.y,
          playerBiome: focus.biome,
          playerElevation: focus.elevation,
          cameraX: camX,
          cameraY: camY,
          cameraYaw: fpYaw,
          chatspotsVisible: chatspots.length,
          nearestChatspotId: nearestChatspot?.id,
          nearestChatspotLabel: nearestChatspot?.label,
          nearestChannelId: nearestChatspot?.channelId,
          joinedChannelId: latestJoinedChannelId || undefined,
          worldWidth: terrain.width,
          worldHeight: terrain.height,
          hybridLeftWidth: renderMode === "hybrid" ? Math.max(0, Math.floor(Number(mapBox.width) || 0)) : undefined,
          hybridRightWidth: renderMode === "hybrid" ? Math.max(0, Math.floor(Number(isoBox.width) || 0)) : undefined,
          latestCaptureName: lastCaptureName || undefined,
          latestTerrainExportName: lastTerrainExportName || undefined,
          // Cursor / tile inspect (agent-readable)
          cursorX: camX,
          cursorY: camY,
          cursorBiome: cursorCell?.biome,
          cursorElevation: cursorCell?.elevation,
          cursorIsWater: cursorCell?.isWater,
          cursorWaterDepth: cursorCell?.waterDepth,
          cursorMoveCostFromPlayer: moveCost ? Number(moveCost) : 0,
        }));

        host.screen.render();
        debugWibWobWorld("render:end", { playerX: focus.x, playerY: focus.y, waterCoverage: terrain.waterCoverage });
      } catch (error) {
        debugWibWobWorldError("render:error", error, { seed, terrainIdx, renderMode, seaLevel, levels, vegetationEnabled, sidebarOpen });
      } finally {
        isRendering = false;
      }
    };

    let resizeRenderTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleResizeRender = () => {
      if (resizeRenderTimer !== undefined) return;
      resizeRenderTimer = setTimeout(() => {
        resizeRenderTimer = undefined;
        render();
      }, 16);
    };

    const cycleMode = () => {
      const next = RENDER_MODES[(RENDER_MODES.indexOf(renderMode) + 1) % RENDER_MODES.length] ?? "hybrid";
      renderMode = next;
      if (next === "firstperson") { initFpYaw(); render(); renderFp(); }
      else render();
    };
    const cycleTerrain = () => {
      terrainIdx = (terrainIdx + 1) % terrainNames.length;
      resetFpCamera();
      render();
    };
    const reseed = () => {
      seed = Math.floor(Math.random() * 100000);
      resetFpCamera();
      render();
    };
    const setSea = (value: number) => {
      seaLevel = clamp(value, 0.08, 0.82);
      render();
    };
    const toggleVegetation = () => {
      debugWibWobWorld("toggleVegetation", { next: !vegetationEnabled });
      vegetationEnabled = !vegetationEnabled;
      render();
    };
    const toggleSidebar = () => {
      debugWibWobWorld("toggleSidebar", { next: !sidebarOpen });
      sidebarOpen = !sidebarOpen;
      render();
    };
    const setContourLevels = (value: number) => {
      levels = clamp(Math.floor(value), 2, 12);
      render();
    };
    const saveCapture = () => {
      const dir = captureDir();
      fs.mkdirSync(dir, { recursive: true });
      lastCaptureName = `wibwobworld_${terrainNames[terrainIdx]}_${seed}_${Date.now()}.txt`;
      fs.writeFileSync(path.join(dir, lastCaptureName), lastText, "utf8");
      debugWibWobWorld("saveCapture", { lastCaptureName });
      render();
    };
    const saveTerrainExport = () => {
      if (!latestTerrain || !latestFocus) return undefined;
      const saved = saveTerrainArtifact({
        map: latestTerrain,
        focus: latestFocus,
        renderMode,
        levels,
      });
      lastTerrainExportName = saved.fileName;
      debugWibWobWorld("saveTerrainExport", { lastTerrainExportName });
      render();
      return saved.fileName;
    };
    const joinNearestChatspot = () => {
      if (!latestFocus) return undefined;
      const nearest = host.worldChat.nearestChatspot(latestFocus.x, latestFocus.y);
      if (!nearest) return undefined;
      const sender = "wibwob-player";
      host.worldChat.joinChannel(sender, nearest.channelId);
      latestJoinedChannelId = nearest.channelId;
      debugWibWobWorld("joinNearestChatspot", { channelId: latestJoinedChannelId, chatspotId: nearest.id });
      host.runCommand("microapp.world-chatroom.set-channel", {
        channelId: nearest.channelId,
        sender,
      });
      render();
      return latestJoinedChannelId;
    };

    control = {
      setTerrain(idx) {
        terrainIdx = ((Math.floor(idx) % terrainNames.length) + terrainNames.length) % terrainNames.length;
        render();
      },
      setMode(mode) {
        renderMode = mode;
        render();
      },
      reseed,
      setSeaLevel(value) {
        setSea(value);
      },
      toggleVegetation,
      setLevels(value) {
        setContourLevels(value);
      },
      toggleSidebar,
      saveCapture,
      saveTerrainExport,
      joinNearestChatspot,
      setCameraPosition(x, y, yaw) {
        if (renderMode !== "firstperson") { renderMode = "firstperson"; initFpYaw(); }
        const t = latestTerrain;
        fpCamX = t ? clamp(Math.round(x), 0, t.width  - 1) : Math.round(x);
        fpCamY = t ? clamp(Math.round(y), 0, t.height - 1) : Math.round(y);
        if (yaw !== undefined) fpYaw = yaw;
        render();
        scheduleRenderFp();
      },
      moveCameraStep(direction, steps = 1) {
        if (renderMode !== "firstperson") { renderMode = "firstperson"; initFpYaw(); }
        const n = Math.max(1, Math.round(steps));
        for (let i = 0; i < n; i++) {
          if (direction === "turn-left")  { initFpYaw(); fpYaw = (fpYaw ?? 0) - FP_TURN; }
          else if (direction === "turn-right") { initFpYaw(); fpYaw = (fpYaw ?? 0) + FP_TURN; }
          else {
            const offset = direction === "forward" ? 0
              : direction === "back"         ? Math.PI
              : direction === "strafe-left"  ? -Math.PI / 2
              : Math.PI / 2; // strafe-right
            moveFpCamera(offset);
          }
        }
        render();
        scheduleRenderFp();
      },
    };

    const bindKeys = (node: blessed.Widgets.Node) => {
      node.key(["m"], cycleMode);
      node.key(["t", "tab"], cycleTerrain);
      node.key(["r"], reseed);
      node.key(["[", "{"], () => setSea(seaLevel - 0.03));
      node.key(["]", "}"], () => setSea(seaLevel + 0.03));
      node.key(["+", "="], () => setContourLevels(levels + 1));
      node.key(["-"], () => setContourLevels(levels - 1));
      node.key(["v"], toggleVegetation);
      node.key(["i"], toggleSidebar);
      node.key(["s"], () => { if (renderMode !== "firstperson") saveCapture(); else moveFpCamera(Math.PI); });
      node.key(["e"], saveTerrainExport);
      node.key(["c"], joinNearestChatspot);
      node.key(["q", "escape"], () => win.close());
      // Arrow keys: move cursor in map modes, rotate/move in firstperson
      node.key(["left"],  () => {
        if (renderMode === "firstperson") { initFpYaw(); fpYaw = (fpYaw ?? 0) - FP_TURN; render(); scheduleRenderFp(); }
        else { fpCamX = clamp((fpCamX ?? latestFocus?.x ?? 0) - 1, 0, (latestTerrain?.width ?? 1) - 1); render(); }
      });
      node.key(["right"], () => {
        if (renderMode === "firstperson") { initFpYaw(); fpYaw = (fpYaw ?? 0) + FP_TURN; render(); scheduleRenderFp(); }
        else { fpCamX = clamp((fpCamX ?? latestFocus?.x ?? 0) + 1, 0, (latestTerrain?.width ?? 1) - 1); render(); }
      });
      node.key(["up"], () => {
        if (renderMode === "firstperson") moveFpCamera(0);
        else { fpCamY = clamp((fpCamY ?? latestFocus?.y ?? 0) - 1, 0, (latestTerrain?.height ?? 1) - 1); render(); }
      });
      node.key(["down"], () => {
        if (renderMode === "firstperson") moveFpCamera(Math.PI);
        else { fpCamY = clamp((fpCamY ?? latestFocus?.y ?? 0) + 1, 0, (latestTerrain?.height ?? 1) - 1); render(); }
      });
      // WASD: move camera in firstperson only
      node.key(["w"], () => { if (renderMode === "firstperson") moveFpCamera(0);            });
      node.key(["a"], () => { if (renderMode === "firstperson") moveFpCamera(-Math.PI / 2); });
      node.key(["d"], () => { if (renderMode === "firstperson") moveFpCamera(Math.PI / 2);  });
    };

    bindKeys(win.body);
    bindKeys(mapBox);
    bindKeys(isoBox);
    bindKeys(fpBox); // firstperson mode focuses fpBox — must handle all keys including m to escape

    win.onInput((input) => {
      debugWibWobWorld("onInput", { input });
      const text = input.replace(/\r/g, "");
      for (const ch of text) {
        if (ch === "m") cycleMode();
        else if (ch === "t") cycleTerrain();
        else if (ch === "r") reseed();
        else if (ch === "[") setSea(seaLevel - 0.03);
        else if (ch === "]") setSea(seaLevel + 0.03);
        else if (ch === "+" || ch === "=") setContourLevels(levels + 1);
        else if (ch === "-") setContourLevels(levels - 1);
        else if (ch === "v") toggleVegetation();
        else if (ch === "i") toggleSidebar();
        else if (ch === "s") saveCapture();
        else if (ch === "e") saveTerrainExport();
        else if (ch === "c") joinNearestChatspot();
      }
    });

    win.onResize(() => { scheduleResizeRender(); });
    win.onRestyle(() => {
      debugWibWobWorld("onRestyle");
      root.restyle();
      mapBox.style = host.theme().body;
      isoBox.style = host.theme().body;
      bodyNode.style = host.theme().body;
      host.screen.render();
    });
    win.onCleanup(() => {
      if (resizeRenderTimer !== undefined) {
        clearTimeout(resizeRenderTimer);
        resizeRenderTimer = undefined;
      }
      debugWibWobWorld("onCleanup");
      root.destroy();
      control = undefined;
    });
    win.captureText(() => lastText);

    // bodyNode and infoBlock.node are not covered by bindKeys — they need explicit c binding.
    // mapBox and fpBox ARE covered by bindKeys above, so omit them here to avoid double-invoke.
    const handleJoinKey = (ch: string, key?: blessed.Widgets.Events.IKeyEventArg) => {
      const direct = key?.sequence ?? ch ?? "";
      if (direct === "c") joinNearestChatspot();
    };
    bodyNode.on("keypress", handleJoinKey);
    infoBlock.node.on("keypress", handleJoinKey);
    mapBox.on("click", () => win.focus());
    isoBox.on("click", () => win.focus());
    fpBox.on("click", () => win.focus());
    bodyNode.on("click", () => win.focus());

    // Defer initial render by one tick so blessed screen is fully initialised
    // before setContent is called. Without this, calling setContent during
    // workspace restore (before renderChrome()) hangs the process.
    setTimeout(() => { render(); }, 0);
    win.focus();
  }

  host.registerCommand({
    id: "open",
    label: "Open WibWobWorld",
    description: "Open the WibWobWorld terrain surface.",
    menu: [{ category: "applications", order: 88, label: "WibWobWorld" }],
    palette: { order: 58, label: "WibWobWorld" },
    action: (args) => {
      debugWibWobWorld("command:open", args ?? {});
      openWorld(args);
    },
  });

  host.registerCommand({
    id: "set-render-mode",
    label: "WibWobWorld: Set Render Mode",
    description: 'Args: { mode: "terrain"|"contours"|"iso"|"hybrid"|"firstperson" }',
    direct: true,
    action: (args) => {
      debugWibWobWorld("command:set-render-mode", args ?? {});
      const mode = args?.mode;
      if (typeof mode === "string" && RENDER_MODES.includes(mode as WorldRenderMode) && control) {
        control.setMode(mode as WorldRenderMode);
      } else if (typeof mode === "string" && RENDER_MODES.includes(mode as WorldRenderMode)) {
        openWorld({ renderMode: mode });
      }
    },
  });

  host.registerCommand({
    id: "set-sea-level",
    label: "WibWobWorld: Set Sea Level",
    description: "Args: { value: number }",
    direct: true,
    action: (args) => {
      debugWibWobWorld("command:set-sea-level", args ?? {});
      const value = Number(args?.value);
      if (!Number.isFinite(value)) return;
      if (control) control.setSeaLevel(value);
      else openWorld({ seaLevel: value });
    },
  });

  host.registerCommand({
    id: "reseed",
    label: "WibWobWorld: Reseed",
    description: "Generate a new world seed.",
    direct: true,
    action: () => {
      debugWibWobWorld("command:reseed");
      if (control) control.reseed();
      else openWorld();
    },
  });

  host.registerCommand({
    id: "toggle-vegetation",
    label: "WibWobWorld: Toggle Vegetation",
    description: "Toggle vegetation overlay.",
    direct: true,
    action: () => {
      debugWibWobWorld("command:toggle-vegetation");
      if (control) control.toggleVegetation();
      else openWorld();
    },
  });

  host.registerCommand({
    id: "toggle-sidebar",
    label: "WibWobWorld: Toggle Sidebar",
    description: "Open or close the WibWobWorld info sidebar.",
    direct: true,
    action: () => {
      debugWibWobWorld("command:toggle-sidebar");
      if (control) control.toggleSidebar();
      else openWorld();
    },
  });

  host.registerCommand({
    id: "save-capture",
    label: "WibWobWorld: Save Capture",
    description: "Save the current terrain text capture to scratch/captures.",
    direct: true,
    action: () => {
      debugWibWobWorld("command:save-capture");
      if (control) control.saveCapture();
      else openWorld();
    },
  });

  host.registerCommand({
    id: "join-nearest-chatspot",
    label: "WibWobWorld: Join Nearest Chatspot",
    description: "Join the nearest world chatspot channel for the current WibWobWorld focus point.",
    direct: true,
    action: () => {
      debugWibWobWorld("command:join-nearest-chatspot");
      if (control) control.joinNearestChatspot();
      else openWorld();
    },
  });

  host.registerCommand({
    id: "save-terrain-export",
    label: "WibWobWorld: Save Terrain Export",
    description: "Save the current terrain as structured JSON to scratch/captures.",
    direct: true,
    action: () => {
      debugWibWobWorld("command:save-terrain-export");
      if (control) control.saveTerrainExport();
      else openWorld();
    },
  });

  host.registerCommand({
    id: "set-camera",
    label: "WibWobWorld: Set Camera Position",
    description: "Teleport the 3D camera to an absolute position. Args: { x: number, y: number, yaw?: number (radians) }. Switches to firstperson mode if needed.",
    direct: true,
    action: (args) => {
      debugWibWobWorld("command:set-camera", args ?? {});
      const x = Number(args?.x);
      const y = Number(args?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const yaw = typeof args?.yaw === "number" ? args.yaw : undefined;
      if (control) control.setCameraPosition(x, y, yaw);
      else openWorld({ renderMode: "firstperson", cameraX: x, cameraY: y, cameraYaw: yaw });
    },
  });

  host.registerCommand({
    id: "move-camera",
    label: "WibWobWorld: Move Camera",
    description: 'Move or rotate the 3D camera. Args: { direction: "forward"|"back"|"strafe-left"|"strafe-right"|"turn-left"|"turn-right", steps?: number }. Switches to firstperson mode if needed.',
    direct: true,
    action: (args) => {
      debugWibWobWorld("command:move-camera", args ?? {});
      const dir = args?.direction as string | undefined;
      const validDirs = ["forward", "back", "strafe-left", "strafe-right", "turn-left", "turn-right"];
      if (!dir || !validDirs.includes(dir)) return;
      const steps = typeof args?.steps === "number" ? Math.max(1, Math.round(args.steps)) : 1;
      if (control) {
        control.moveCameraStep(dir as Parameters<typeof control.moveCameraStep>[0], steps);
      } else {
        openWorld({ renderMode: "firstperson" });
      }
    },
  });

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() ?? {};
      if (state.appType !== "wibwob.world") {
        return undefined;
      }
      return {
        seed: state.seed,
        terrainIdx: state.terrainIdx,
        renderMode: state.renderMode,
        seaLevel: state.seaLevel,
        levels: state.levels,
        vegetationEnabled: state.vegetationEnabled,
        sidebarOpen: state.sidebarOpen,
      };
    },
    restore: (_snapshot, payload) => {
      debugWibWobWorld("snapshot:restore", payload);
      host.runCommand("open", { ...payload });
    },
  });
}
