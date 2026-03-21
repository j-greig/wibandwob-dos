import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createAnimationClock,
  blankGrid,
  paintText,
  paintCentered,
  gridToText,
  createCanvas,
  createHeaderBar,
  createStatusBar,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Step Sequencer";
const STEPS = 16;
const TRACKS = ["Kick", "Snare", "HiHat", "Clap", "Tom", "Rim", "Cymbal", "Cowbell"];
const TRACK_SYMBOLS = ["◆", "◇", "△", "○", "□", "▽", "☆", "♦"];

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "16-step drum sequencer grid. Space: toggle, p: play/pause, ←→↑↓: navigate, c: clear, +/-: BPM.",
    menu: [{ category: "applications", order: 209, label: APP_TITLE }],
    palette: { order: 209, label: `Open ${APP_TITLE}` },
    action: () => {
      // State
      const pattern: boolean[][] = TRACKS.map(() => Array(STEPS).fill(false) as boolean[]);
      let cursorTrack = 0;
      let cursorStep = 0;
      let playhead = 0;
      let bpm = 120;
      let playing = false;

      const win = host.createWindow({ title: APP_TITLE, width: 72, height: TRACKS.length + 8 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: `${bpm} BPM  STOPPED`,
      });

      const canvas = createCanvas(win.body, {
        topOffset: 1,
        bottomOffset: 1,
      });

      const status = createStatusBar(win.body, {
        left: "space: toggle  p: play  ←→↑↓: move  c: clear  +/-: BPM",
        right: "",
      });

      // Animation clock — starts paused, only runs during playback
      const CLOCK_FPS = 8;
      const clock = createAnimationClock(CLOCK_FPS);
      clock.pause(); // start paused
      let tickAccum = 0;
      const ticksPerStep = () => Math.max(1, Math.round(CLOCK_FPS / (bpm / 60) / 4));

      const render = () => {
        const size = canvas.getSize();
        const grid = blankGrid(size.width, size.height);
        const labelW = 10;

        // Header row — step numbers
        let stepHeader = " ".repeat(labelW);
        for (let s = 0; s < STEPS; s++) {
          const isPlayhead = playing && s === playhead;
          const marker = isPlayhead ? "▼" : ((s + 1) % 4 === 1 ? `${Math.floor(s / 4) + 1}` : "·");
          stepHeader += ` ${marker} `;
        }
        paintText(grid, 0, 0, stepHeader);

        // Separator
        paintText(grid, 0, 1, "─".repeat(Math.min(size.width, labelW + STEPS * 3)));

        // Track rows
        for (let t = 0; t < TRACKS.length; t++) {
          const y = t + 2;
          if (y >= size.height - 1) break;

          // Track label
          const label = TRACKS[t]!.padEnd(labelW - 1);
          const prefix = t === cursorTrack ? ">" : " ";
          paintText(grid, 0, y, `${prefix}${label}`);

          // Steps — plain characters for performance
          for (let s = 0; s < STEPS; s++) {
            const active = pattern[t]![s];
            const isCursor = t === cursorTrack && s === cursorStep;
            const isPlayhead = playing && s === playhead;

            let cell: string;
            if (active) {
              cell = isPlayhead ? `[${TRACK_SYMBOLS[t]}]` : isCursor ? `<${TRACK_SYMBOLS[t]}>` : ` ${TRACK_SYMBOLS[t]} `;
            } else {
              cell = isCursor ? "<·>" : isPlayhead ? "[·]" : " · ";
            }
            paintText(grid, labelW + s * 3, y, cell);
          }
        }

        // Bottom info
        const infoY = Math.min(TRACKS.length + 2, size.height - 1);
        paintText(grid, 0, infoY, "─".repeat(Math.min(size.width, labelW + STEPS * 3)));

        const activeCount = pattern.flat().filter(Boolean).length;
        const infoLine = `  Steps: ${activeCount}/${STEPS * TRACKS.length}  |  Track: ${TRACKS[cursorTrack]}  |  Step: ${cursorStep + 1}`;
        if (infoY + 1 < size.height) {
          paintText(grid, 0, infoY + 1, infoLine);
        }

        canvas.setContent(gridToText(grid));
        header.update({ right: `${bpm} BPM  ${playing ? "▶ PLAYING" : "■ STOPPED"}` });
        host.screen.render();
      };

      // Playback via animation clock
      const unsub = clock.subscribe(() => {
        if (!playing) return;
        tickAccum++;
        if (tickAccum >= ticksPerStep()) {
          tickAccum = 0;
          playhead = (playhead + 1) % STEPS;
          render();
        }
      });

      // Key bindings
      canvas.element.key(["up"], () => { cursorTrack = Math.max(0, cursorTrack - 1); render(); });
      canvas.element.key(["down"], () => { cursorTrack = Math.min(TRACKS.length - 1, cursorTrack + 1); render(); });
      canvas.element.key(["left"], () => { cursorStep = Math.max(0, cursorStep - 1); render(); });
      canvas.element.key(["right"], () => { cursorStep = Math.min(STEPS - 1, cursorStep + 1); render(); });
      canvas.element.key(["space"], () => {
        pattern[cursorTrack]![cursorStep] = !pattern[cursorTrack]![cursorStep];
        render();
      });
      canvas.element.key(["p"], () => {
        playing = !playing;
        if (playing) { playhead = 0; tickAccum = 0; clock.play(); } else { clock.pause(); }
        render();
      });
      canvas.element.key(["c"], () => {
        for (const track of pattern) track.fill(false);
        render();
      });
      canvas.element.key(["+", "="], () => { bpm = Math.min(300, bpm + 5); tickAccum = 0; render(); });
      canvas.element.key(["-", "_"], () => { bpm = Math.max(40, bpm - 5); tickAccum = 0; render(); });

      // Fill a random preset
      canvas.element.key(["r"], () => {
        // Classic four-on-the-floor
        for (let s = 0; s < STEPS; s++) {
          pattern[0]![s] = s % 4 === 0; // Kick on 1,5,9,13
          pattern[1]![s] = s % 8 === 4; // Snare on 5,13
          pattern[2]![s] = s % 2 === 0; // HiHat on every other
          pattern[3]![s] = s === 4 || s === 12; // Clap
        }
        render();
      });

      win.describeState(() => ({
        summary: `Step Sequencer — ${bpm} BPM, ${playing ? "playing" : "stopped"}, ${pattern.flat().filter(Boolean).length} active steps`,
        bpm,
        playing,
        playhead,
        activeSteps: pattern.flat().filter(Boolean).length,
        pattern: TRACKS.map((name, i) => ({
          name,
          steps: pattern[i]!.map(v => v ? 1 : 0),
        })),
      }));

      win.captureText(() => {
        const lines = TRACKS.map((name, i) => {
          const steps = pattern[i]!.map(v => v ? "X" : ".").join("");
          return `${name.padEnd(10)}${steps}`;
        });
        return `BPM: ${bpm}  ${playing ? "PLAYING" : "STOPPED"}\n\n${lines.join("\n")}`;
      });

      win.onRestyle(() => {
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        unsub(); // unsubscribe from clock
        clock.destroy();
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
