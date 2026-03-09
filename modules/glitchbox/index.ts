import blessed from "blessed";
import {
  blankGrid,
  gridToText,
  gridToBlessedContent,
  renderWebcamFrame,
  createTimer,
  clearTimers,
  renderSkeletonAt,
  landmarksFromPreset,
  type MicroappHost,
  type NormalisedLandmarks,
  type WebcamCell,
} from "../../src/services/microapp-sdk.js";

const FIELD_CHARS = " .·:+~";

type DancerState = {
  agentId: string;
  label: string;
  color: string;
  x: number;
  y: number;
  preset: string;
  energy: number;
  mood: string;
};

export default function setup(host: MicroappHost) {
  let activeWindow: { focus: () => void } | undefined;

  host.registerCommand({
    id: "glitchbox.open",
    label: "Open GlitchBox",
    menu: [{ category: "applications", order: 55, label: "GlitchBox" }],
    palette: { order: 255, label: "GlitchBox — Symbient Dance Floor" },
    action: () => {
      if (activeWindow) {
        activeWindow.focus();
        return;
      }

      // Explicitly imported as part of the shared WebcamCell pipeline surface.
      void renderWebcamFrame;

      const sw = Math.max(80, Number(host.screen.width));
      const sh = Math.max(24, Number(host.screen.height));
      const win = host.createWindow({
        title: "GlitchBox",
        width: Math.min(110, sw - 4),
        height: Math.min(34, sh - 3),
      });
      activeWindow = win;

      const timers = new Set<ReturnType<typeof setInterval>>();
      let tick = 0;

      const dancer: DancerState = {
        agentId: "wibwob",
        label: "Wib&Wob",
        color: "cyan",
        x: 0,
        y: 4,
        preset: "idle",
        energy: 5,
        mood: "chill",
      };

      const root = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        keys: true,
        mouse: true,
        clickable: true,
        style: host.theme().body,
      });

      const fieldLayer = blessed.box({
        parent: root,
        top: 0,
        left: 0,
        right: 0,
        bottom: 1,
        tags: false,
        style: host.theme().body,
      });

      const skeletonLayer = blessed.box({
        parent: root,
        top: 0,
        left: 0,
        right: 0,
        bottom: 1,
        tags: true,
        style: {
          ...host.theme().body,
          bg: "default",
          transparent: true,
        },
      });

      const statusBar = blessed.box({
        parent: root,
        left: 0,
        right: 0,
        bottom: 0,
        height: 1,
        tags: false,
        style: host.theme().header,
        content: "GlitchBox  wibwob:idle  energy:5  /dance to join  q close",
      });

      skeletonLayer.setFront();

      function canvasSize(): { w: number; h: number } {
        const lpos = (fieldLayer as any).lpos;
        if (lpos && Number.isFinite(lpos.xi) && Number.isFinite(lpos.xl) && Number.isFinite(lpos.yi) && Number.isFinite(lpos.yl)) {
          return {
            w: Math.max(1, lpos.xl - lpos.xi),
            h: Math.max(1, lpos.yl - lpos.yi),
          };
        }
        return {
          w: Math.max(1, Number(root.width) || Number(host.screen.width) - 6),
          h: Math.max(1, (Number(root.height) || Number(host.screen.height) - 5) - 1),
        };
      }

      function renderField(seed: number): void {
        const { w, h } = canvasSize();
        const grid = blankGrid(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            grid[y]![x] = FIELD_CHARS[(x * 3 + y * 7 + seed) % FIELD_CHARS.length] ?? " ";
          }
        }
        fieldLayer.setContent(gridToText(grid));
      }

      function renderDancer(): void {
        const { w, h } = canvasSize();
        const grid: WebcamCell[][] = blankGrid(w, h).map((row) => row.map((ch) => ({ ch })));
        const landmarks: NormalisedLandmarks = landmarksFromPreset(dancer.preset);
        dancer.x = Math.max(0, Math.floor(w / 2) - 5);
        renderSkeletonAt(grid, landmarks, dancer.x, dancer.y, w, h, dancer.color);
        skeletonLayer.setContent(gridToBlessedContent(grid));
      }

      function renderAll(): void {
        renderField(tick);
        renderDancer();
        statusBar.setContent("GlitchBox  wibwob:idle  energy:5  /dance to join  q close");
        host.screen.render();
      }

      createTimer(() => {
        tick += 1;
        renderAll();
      }, 500, timers);

      const closeWindow = () => win.close();
      root.key(["q", "escape"], closeWindow);
      win.body.key(["q", "escape"], closeWindow);
      win.onInput((ch) => {
        if (ch === "q") closeWindow();
      });

      win.onResize(() => {
        renderAll();
      });

      win.onRestyle(() => {
        root.style = host.theme().body;
        fieldLayer.style = host.theme().body;
        skeletonLayer.style = {
          ...host.theme().body,
          bg: "default",
          transparent: true,
        };
        statusBar.style = host.theme().header;
        renderAll();
      });

      win.describeState(() => ({
        appType: "glitchbox",
        summary: "GlitchBox — 1 dancers on floor",
        dancers: [
          {
            agentId: dancer.agentId,
            label: dancer.label,
            x: dancer.x,
            y: dancer.y,
            preset: dancer.preset,
            energy: dancer.energy,
            mood: dancer.mood,
          },
        ],
      }));

      win.captureText(() => {
        return [
          "GlitchBox",
          `dancer:${dancer.label} preset:${dancer.preset} energy:${dancer.energy}`,
          statusBar.getContent(),
        ].join("\n");
      });

      win.onCleanup(() => {
        clearTimers(timers);
        statusBar.destroy();
        skeletonLayer.destroy();
        fieldLayer.destroy();
        root.destroy();
        activeWindow = undefined;
      });

      renderAll();
      win.focus();
    },
  });
}
