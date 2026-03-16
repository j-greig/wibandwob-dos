import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  applyRect,
  createRestyleBundle,
  createStack,
  createRow,
  createNodePart,
  createHeaderBar,
  createStatusBar,
  createTextBlock,
  createRule,
  createCanvas,
} from "../../src/services/microapp-sdk.js";
import {
  createPlasmaPlayer,
  moodNames,
  RENDER_MODES,
  extractMoodFromText,
  type PlasmaModifiers,
  type PlasmaRenderMode,
} from "./plasma-engine.js";

import fs from "node:fs";
import path from "node:path";

// ANSI colour codes for sidebar
const A = {
  r:   "\x1b[0m",
  b:   "\x1b[1m",
  dim: "\x1b[2m",
  cyn: "\x1b[96m",
  grn: "\x1b[92m",
  yel: "\x1b[93m",
  wht: "\x1b[97m",
  gry: "\x1b[90m",
  mag: "\x1b[95m",
  red: "\x1b[91m",
  blu: "\x1b[94m",
} as const;

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Plasma",
    description: "Open animated plasma colour-field screensaver. Args: mood, renderMode.",
    action: (args) => {
      const mood = args?.mood as string | undefined;
      const renderMode = args?.renderMode as PlasmaRenderMode | undefined;
      openPlasma({ mood, renderMode });
    },
    palette: { order: 52, label: "Plasma" },
    menu: [{ category: "applications", order: 82, label: "Plasma" }],
    direct: true,
  });

  host.registerCommand({
    id: "from-primer",
    label: "Plasma: From Primer",
    description: "Open a plasma screensaver tuned to a primer file's mood. Args: filePath.",
    action: (args) => {
      const filePath = args?.filePath as string | undefined;
      if (filePath) {
        spawnForFile(filePath);
      } else {
        // Interactive: use host file picker
        host.pickFile("Open Primer for Plasma", host.repoRoot, (picked) => {
          spawnForFile(picked);
        });
      }
    },
    palette: { order: 53, label: "Plasma: From Primer" },
    menu: [{ category: "applications", order: 83, label: "Plasma: From Primer" }],
    direct: true,
  });

  function spawnForFile(filePath: string) {
    try {
      const text = fs.readFileSync(filePath, "utf8");
      const analysis = extractMoodFromText(text);
      openPlasma({
        mood: analysis.mood.name,
        primerName: path.basename(filePath),
        primerText: text,
        reason: analysis.reason,
        modifiers: {
          density: analysis.density,
          entropy: analysis.entropy,
          dominantRatio: analysis.dominantRatio,
        },
      });
      host.flash(`Plasma: ${analysis.mood.name} — ${analysis.reason}`);
    } catch {
      openPlasma({});
    }
  }

  function openPlasma(options: {
    mood?: string;
    renderMode?: PlasmaRenderMode;
    primerName?: string;
    primerText?: string;
    reason?: string;
    modifiers?: PlasmaModifiers;
  }) {
    const initialMood = options.mood ?? "aurora";
    const initialMode = options.renderMode ?? "plain";
    const primerName = options.primerName;
    const primerText = options.primerText;
    const reason = options.reason;

    const win = host.createWindow({ title: "Plasma", width: 100, height: 35 });

    const canvasHandle = createCanvas(win.body);
    const canvas = canvasHandle.element;

    const infoBlock = createTextBlock(win.body, { paddingLeft: 1, paddingTop: 0 });
    const header = createHeaderBar(win.body);
    const divider = createRule(win.body, { axis: "vertical" });
    const statusBar = createStatusBar(win.body);

    let infoText = "";
    let currentSpeed = 0;

    const readViewport = () => {
      const w = Math.max(4, Number(canvas.width) || 40);
      const h = Math.max(2, Number(canvas.height) || 15);
      return { width: w, height: h };
    };

    const player = createPlasmaPlayer({
      mood: initialMood,
      renderMode: initialMode,
      modifiers: options.modifiers,
      primerText,
      fps: 10,
      getViewport: readViewport,
      onFrame: (content) => {
        canvas.setContent(content);
        host.screen.render();
      },
      onStatus: (s) => {
        currentSpeed = s.speed;
        header.update({
          left: `Plasma: ${s.mood}`,
          right: s.renderMode.toUpperCase(),
        });

        const sep = `  ${A.gry}${"─".repeat(22)}${A.r}`;
        const label = (icon: string, text: string) => `  ${A.cyn}${icon} ${text}${A.r}`;
        const key = (k: string, desc: string) => `  ${A.yel}${k.padEnd(4)}${A.gry}${desc}${A.r}`;
        const bar = (v: number, mx: number, w: number) => {
          const f = Math.round((v / Math.max(0.001, mx)) * w);
          return `${A.cyn}${"▮".repeat(Math.min(f, w))}${A.gry}${"▯".repeat(Math.max(0, w - f))}${A.r}`;
        };

        const moodCols: Record<string, string> = {
          circuit: A.grn, void: A.gry, chaos: A.red, aurora: A.cyn,
          sunset: A.yel, acid: A.grn, "deep-space": A.blu, chrome: A.wht,
        };

        const moodList = moodNames.map(m => {
          const active = m === s.mood;
          const col = moodCols[m] ?? A.wht;
          return active
            ? `  ${col}\u25B6 ${A.b}${m}${A.r}`
            : `  ${A.gry}  ${m}${A.r}`;
        }).join("\n");

        const renderLine = RENDER_MODES.map(rm => {
          const active = rm === s.renderMode;
          return active
            ? `${A.wht}${A.b}[${rm.toUpperCase()}]${A.r}`
            : `${A.gry} ${rm} ${A.r}`;
        }).join(" ");

        const srcLines: string[] = [];
        if (primerName) srcLines.push(`  ${A.gry}source  ${A.wht}${primerName}${A.r}`);
        if (reason) srcLines.push(`  ${A.gry}reason  ${A.wht}${reason}${A.r}`);

        const infoLines = [
          "",
          label("\u2248", "MOOD"),
          moodList,
          sep,
          label("\u25A3", "RENDER"),
          `  ${renderLine}`,
          sep,
          label("\u2699", "ENGINE"),
          `  ${A.gry}speed${A.r} ${bar(s.speed, 0.12, 10)} ${A.wht}${s.speed.toFixed(3)}${A.r}`,
          `  ${A.gry}smear${A.r} ${bar(player.mood.displacement, 8, 10)} ${A.wht}${player.mood.displacement}${A.r}`,
          `  ${A.gry}fps${A.r}   ${A.wht}${s.fps}${A.r}`,
          ...(srcLines.length ? [sep, label("\u2197", "SOURCE"), ...srcLines] : []),
          sep,
          label("\u2328", "CONTROLS"),
          key("m", "next mood"),
          key("r", "render mode"),
          key("p", player.paused ? "resume" : "pause"),
          key("s", "save capture"),
          sep,
          label("\u2261", "ABOUT"),
          `  ${A.gry}Procedural colour-field${A.r}`,
          `  ${A.gry}animation engine with${A.r}`,
          `  ${A.gry}displacement blur and${A.r}`,
          `  ${A.gry}phase-shifted waves.${A.r}`,
        ];
        infoText = infoLines.join("\n");
        (infoBlock.node as any).setContent(infoText);
        statusBar.update({
          left: "m:mood  r:render  p:pause  s:save",
          right: `${s.mood} \u2502 ${s.renderMode} \u2502 ${s.speed.toFixed(3)}`,
        });
      },
    });

    const canvasPart = createNodePart(canvas, {
      restyle: () => { canvas.style = host.theme().body; },
    });

    const bodyColumns = createRow(win.body, [
      { key: "canvas", basis: "3fr" as const, part: canvasPart },
      { key: "divider", basis: 1, part: divider },
      { key: "info", basis: "1fr" as const, part: infoBlock },
    ]);

    const root = createStack(win.body, [
      { key: "header", basis: 1, part: header },
      { key: "body", basis: "1fr" as const, part: bodyColumns },
      { key: "status", basis: 1, part: statusBar },
    ]);

    const doLayout = () => {
      const w = Math.max(1, Number(win.body.width) || 0);
      const h = Math.max(1, Number(win.body.height) || 0);
      root.layout({ top: 0, left: 0, width: w, height: h });
    };

    const saveFrame = () => {
      const text = canvas.getContent();
      if (!text) return;
      const dir = path.join(host.repoRoot, "scratch", "captures");
      fs.mkdirSync(dir, { recursive: true });
      const name = `plasma_${player.mood.name}_${player.renderMode}_${Date.now()}.txt`;
      fs.writeFileSync(path.join(dir, name), text, "utf8");
      statusBar.update({ left: `saved: ${name}` });
      host.screen.render();
    };

    // Key bindings on canvas
    canvas.key(["m"], () => player.nextMood());
    canvas.key(["r"], () => player.nextRenderMode());
    canvas.key(["p"], () => player.togglePause());
    canvas.key(["s"], saveFrame);

    // SDK hooks
    win.describeState(() => ({
      summary: `Plasma screensaver — ${player.mood.name} mood, ${player.renderMode} render.`,
      appType: "plasma",
      mood: player.mood.name,
      renderMode: player.renderMode,
      speed: currentSpeed,
      paused: player.paused,
      primerName,
      reason,
    }));

    win.captureText(() => `${canvas.getContent()}\n\n${infoText}`);

    win.onResize(() => doLayout());

    win.onRestyle(() => {
      canvas.style = host.theme().body;
      root.restyle();
      host.screen.render();
    });

    win.onCleanup(() => {
      player.destroy();
      root.destroy();
    });

    win.setFocusTarget(canvas);
    win.focus();
    doLayout();
    player.play();
  }
}
