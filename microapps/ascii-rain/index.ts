import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createHeaderBar,
  createStatusBar,
  createTextViewer,
  createTimer,
  clearTimers,
  registerMicroappHooks,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "ASCII Rain";

const CHARSETS = [
  "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ",
  "01",
  "abcdefghijklmnopqrstuvwxyz",
  "!@#$%^&*()<>[]{}|;:',./`~",
  "▀▁▂▃▄▅▆▇█▉▊▋▌▍▎▏░▒▓",
];

interface Drop {
  col: number;
  row: number;
  speed: number; // rows per tick
  length: number;
  chars: string[];
}

function randChar(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)]!;
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Matrix-style ASCII rain. Space: pause/resume, r: charset, +/-: speed.",
    menu: [{ category: "demos", order: 250, label: APP_TITLE }],
    palette: { order: 250, label: `Open ${APP_TITLE}` },
    action: () => {
      const timers = new Set<ReturnType<typeof setInterval>>();
      let paused = false;
      let charsetIdx = 0;
      let fps = 6;

      const win = host.createWindow({ title: APP_TITLE, width: 72, height: 26 });

      const header = createHeaderBar(win.body, { left: APP_TITLE, right: "running" });
      const canvas = createTextViewer(win.body, { top: 1, bottom: 1, wrap: false });
      const status = createStatusBar(win.body, {
        left: "space: pause  r: charset  +/-: speed",
        right: `${fps}fps`,
      });

      // State: one Drop per column
      let drops: Drop[] = [];

      const initDrops = (cols: number, rows: number) => {
        drops = Array.from({ length: cols }, (_, col) => ({
          col,
          row: Math.floor(Math.random() * rows),
          speed: 1,
          length: 4 + Math.floor(Math.random() * 8),
          chars: [],
        }));
      };

      const render = () => {
        const w = Math.max(20, (canvas.element.width as number) || 70);
        const h = Math.max(6, (canvas.element.height as number) || 22);
        const charset = CHARSETS[charsetIdx]!;

        if (drops.length !== w) initDrops(w, h);

        // Build char grid
        const grid: string[][] = Array.from({ length: h }, () =>
          Array.from({ length: w }, () => " "),
        );

        for (const drop of drops) {
          // Advance drop
          drop.row += drop.speed;
          if (drop.row - drop.length > h) {
            // Reset to top with new params
            drop.row = -drop.length + Math.floor(Math.random() * 4);
            drop.length = 4 + Math.floor(Math.random() * 10);
            drop.speed = 1;
          }
          // Refresh head char each tick
          drop.chars[0] = randChar(charset);

          // Paint trail
          for (let i = 0; i < drop.length; i++) {
            const r = Math.floor(drop.row) - i;
            if (r >= 0 && r < h) {
              if (!drop.chars[i]) drop.chars[i] = randChar(charset);
              grid[r]![drop.col] = drop.chars[i]!;
            }
          }
        }

        const content = grid.map((row) => row.join("")).join("\n");
        canvas.update({ content });
        host.screen.render();
      };

      const startTimer = () => {
        clearTimers(timers);
        createTimer(render, Math.round(1000 / fps), timers);
      };

      startTimer();
      initDrops(70, 22);

      canvas.element.key(["space"], () => {
        paused = !paused;
        if (paused) {
          clearTimers(timers);
          header.update({ right: "paused" });
        } else {
          startTimer();
          header.update({ right: "running" });
        }
        host.screen.render();
      });

      canvas.element.key(["r"], () => {
        charsetIdx = (charsetIdx + 1) % CHARSETS.length;
        drops = []; // force reinit
        host.flash(`Charset: ${charsetIdx + 1}/${CHARSETS.length}`);
      });

      canvas.element.key(["+", "="], () => {
        fps = Math.min(8, fps + 1);
        status.update({ right: `${fps}fps` });
        if (!paused) startTimer();
      });

      canvas.element.key(["-"], () => {
        fps = Math.max(1, fps - 1);
        status.update({ right: `${fps}fps` });
        if (!paused) startTimer();
      });

      registerMicroappHooks(win, {
        captureText: () => canvas.getContent(),
        describeState: () => ({
          summary: `ASCII Rain — ${paused ? "paused" : "running"} ${fps}fps charset:${charsetIdx + 1}`,
          paused,
          fps,
          charsetIdx,
        }),
        onCleanup: () => {
          clearTimers(timers);
          header.destroy();
          canvas.destroy();
          status.destroy();
        },
        onRestyle: () => {
          header.update({});
          canvas.update({});
          status.update({});
          host.screen.render();
        },
      });

      win.setFocusTarget(canvas.element);
      win.focus();

      return { ok: true, windowId: win.id };
    },
  });
}
