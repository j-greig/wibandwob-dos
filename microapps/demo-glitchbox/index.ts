import blessed from "blessed";
import { Agent } from "@mariozechner/pi-agent-core";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { renderSkeletonAt, landmarksFromPreset, gridToBlessedContent, type NormalisedLandmarks, type WebcamCell } from "../../src/services/microapp-sdk.js";
import {
  blankGrid,
  gridToText,
  createTimer,
  clearTimers,
  tween,
  createButtonBar,
  createCanvas,
  type MicroappHost,
} from "../../src/services/microapp-sdk.js";

const FIELD_MOODS: Record<string, string[]> = {
  calm:  [" ", " ", " ", ".", "·", " "],
  pulse: ["·", ":", "+", "~", ":", "·"],
  chaos: ["░", "▒", ":", "+", "~", "▒"],
  drift: [" ", "·", " ", "~", " ", "·"],
};
const FIELD_MOOD_CYCLE = ["calm", "pulse", "chaos", "drift"] as const;
type FieldMood = typeof FIELD_MOOD_CYCLE[number];

const POSES = ["idle", "arms-raised", "step-left", "jump", "wave"] as const;
type Pose = typeof POSES[number];

// Animation sequences per pose — frames cycle at tick rate
// High energy = fast cycle through all frames. Low energy = holds first frame longer.
const POSE_ANIM: Record<Pose, string[]> = {
  "idle":        ["idle", "idle-b", "idle", "idle-b"],
  "arms-raised": ["arms-raised", "arms-raised-b", "arms-raised-c", "arms-raised-b"],
  "step-left":   ["step-left", "step-left-b", "step-left-c", "step-left-b"],
  "jump":        ["jump", "jump-b", "jump-b", "jump-c"],
  "wave":        ["wave", "wave-b", "wave-c", "wave-b"],
};

// Full dance sequence — all frames of all poses in order, flattened.
// PLAY mode runs this end-to-end on loop.
const DANCE_SEQUENCE: string[] = [
  "idle", "idle-b",
  "step-left", "step-left-b", "step-left-c", "step-left-b", "step-left",
  "arms-raised", "arms-raised-b", "arms-raised-c", "arms-raised-b", "arms-raised",
  "wave", "wave-b", "wave-c", "wave-b", "wave",
  "jump", "jump-b", "jump-b", "jump-c",
  "arms-raised-c", "arms-raised-b",
  "idle-b", "idle",
];

type DancerState = {
  agentId: string;
  label: string;
  color: string;
  x: number;
  y: number;
  preset: Pose;
  energy: number;
  mood: string;
  paused: boolean;
  playing: boolean;  // PLAY mode — runs full DANCE_SEQUENCE on loop
};

export default function setup(host: MicroappHost) {
  let activeWindow: ReturnType<typeof host.createWindow> | undefined;
  let activeDancer: DancerState | undefined;
  let activeRenderAll: (() => void) | undefined;
  let fieldMood: FieldMood = "calm";
  let variantTick = 0;
  let lastUserAction = 0;
  let genArtEnabled = false;
  const HAIKU_COOLDOWN_MS = 15_000; // skip haiku tick if user acted within 15s
  const touchUser = () => { lastUserAction = Date.now(); };

  // ── Generative art background — slow cellular automata ────────────────
  const GEN_CHARS = " ·∙·:;░▒▓█▓▒░";
  let genGrid: number[][] = []; // heat values 0-12
  function genArtInit(w: number, h: number) {
    genGrid = [];
    for (let y = 0; y < h; y++) {
      const row: number[] = [];
      for (let x = 0; x < w; x++) {
        // seed with organic blobs — sine interference pattern
        const v = Math.sin(x * 0.15) * Math.sin(y * 0.2) * 4
                + Math.sin(x * 0.07 + y * 0.09) * 3
                + (Math.random() < 0.08 ? 5 + Math.random() * 6 : 0);
        row.push(Math.max(0, Math.min(12, v)));
      }
      genGrid.push(row);
    }
  }
  function genArtStep(w: number, h: number, energy = 5) {
    const next: number[][] = [];
    const sparkRate = 0.003 + energy * 0.004;  // 0.003 at e0, 0.043 at e10
    const decay = 0.08 - energy * 0.005;       // 0.08 at e0, 0.03 at e10
    const reaction = 0.15 + energy * 0.03;     // more reactive at high energy
    for (let y = 0; y < h; y++) {
      const row: number[] = [];
      for (let x = 0; x < w; x++) {
        const cur = genGrid[y]?.[x] ?? 0;
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const v = genGrid[(y + dy + h) % h]?.[(x + dx + w) % w] ?? 0;
            sum += v; count++;
          }
        }
        const avg = sum / count;
        let v = cur * 0.7 + avg * 0.3 - decay;
        if (avg > 1.2 && cur > 0.3) v += reaction;
        if (Math.random() < sparkRate) v += 4 + Math.random() * 6;
        row.push(Math.max(0, Math.min(12, v)));
      }
      next.push(row);
    }
    genGrid = next;
  }
  function genArtRender(w: number, h: number): string {
    const lines: string[] = [];
    for (let y = 0; y < h; y++) {
      let line = "";
      for (let x = 0; x < w; x++) {
        const idx = Math.round(genGrid[y]?.[x] ?? 0);
        line += GEN_CHARS[Math.min(idx, GEN_CHARS.length - 1)] ?? " ";
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  function nextFieldMood(): FieldMood {
    const i = FIELD_MOOD_CYCLE.indexOf(fieldMood);
    return FIELD_MOOD_CYCLE[(i + 1) % FIELD_MOOD_CYCLE.length] ?? "calm";
  }
  function nextPose(current: Pose): Pose {
    const i = POSES.indexOf(current);
    return POSES[(i + 1) % POSES.length] ?? "idle";
  }
  function statusText(d: DancerState): string {
    const state = d.paused ? "⏸ PAUSED" : d.playing ? "▶ PLAYING" : d.preset;
    const bg = genArtEnabled ? "gen" : fieldMood;
    return `${d.label}  ${state}  energy:${d.energy}  mood:${d.mood}  field:${bg}`;
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  host.registerCommand({
    id: "open",
    label: "Open GlitchBox",
    menu: [{ category: "demos", order: 55, label: "GlitchBox" }],
    palette: { order: 255, label: "GlitchBox — Symbient Dance Floor" },
    action: () => openGlitchBox(),
  });

  host.registerCommand({
    id: "pose", direct: true,
    label: "Set GlitchBox Pose",
    description: "Set dancer pose. Args: preset (idle|arms-raised|step-left|jump|wave)",
    action: (args: Record<string, unknown>) => {
      if (!activeDancer) return { ok: false, error: "No dancer on floor" };
      touchUser();
      const p = String(args.preset ?? "idle") as Pose;
      activeDancer.preset = POSES.includes(p) ? p : "idle";
      activeRenderAll?.();
      return { ok: true, preset: activeDancer.preset };
    },
  });

  host.registerCommand({
    id: "move", direct: true,
    label: "Move GlitchBox Dancer",
    description: "Smoothly tween dancer to new x,y. Args: x, y",
    action: (args: Record<string, unknown>) => {
      if (!activeDancer) return { ok: false, error: "No dancer on floor" };
      touchUser();
      const tx = Number(args.x ?? activeDancer.x);
      const ty = Number(args.y ?? activeDancer.y);
      const sx = activeDancer.x, sy = activeDancer.y;
      tween({
        from: 0, to: 1,
        duration: 400,
        easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,
        onUpdate: (p) => {
          if (!activeDancer) return;
          activeDancer.x = Math.round(sx + (tx-sx)*p);
          activeDancer.y = Math.round(sy + (ty-sy)*p);
          activeRenderAll?.();
        },
        onComplete: () => {
          if (!activeDancer) return;
          activeDancer.x = tx; activeDancer.y = ty;
          activeRenderAll?.();
        },
      });
      return { ok: true, from: {x:sx,y:sy}, to: {x:tx,y:ty} };
    },
  });

  host.registerCommand({
    id: "state", direct: true,
    label: "Set GlitchBox Dancer State",
    description: "Set energy (0-10) and/or mood. Args: energy, mood",
    action: (args: Record<string, unknown>) => {
      if (!activeDancer) return { ok: false, error: "No dancer on floor" };
      touchUser();
      if (args.energy !== undefined) activeDancer.energy = Math.max(0, Math.min(10, Number(args.energy)));
      if (args.mood   !== undefined) activeDancer.mood = String(args.mood);
      activeRenderAll?.();
      return { ok: true, energy: activeDancer.energy, mood: activeDancer.mood };
    },
  });

  host.registerCommand({
    id: "gen", direct: true,
    label: "Toggle GlitchBox Generative Art",
    description: "Toggle generative art background on/off",
    action: () => {
      genArtEnabled = !genArtEnabled;
      activeRenderAll?.();
      return { ok: true, genArt: genArtEnabled };
    },
  });

  host.registerCommand({
    id: "field", direct: true,
    label: "Set GlitchBox Field Mood",
    description: "Set background field mood. Args: mood (calm|pulse|chaos|drift)",
    action: (args: Record<string, unknown>) => {
      const m = String(args.mood ?? "calm") as FieldMood;
      if (FIELD_MOODS[m]) fieldMood = m;
      activeRenderAll?.();
      return { ok: true, mood: fieldMood };
    },
  });

  // ── Window ─────────────────────────────────────────────────────────────────

  function openGlitchBox() {
    if (activeWindow) { activeWindow.focus(); return; }

    const sw = Math.max(80,  Number(host.screen.width));
    const sh = Math.max(24, Number(host.screen.height));
    const win = host.createWindow({
      title: "GlitchBox",
      width:  Math.min(110, sw - 4),
      height: Math.min(34,  sh - 3),
    });
    activeWindow = win;

    const timers = new Set<ReturnType<typeof setInterval>>();
    let tick = 0;

    if (!activeDancer) {
      activeDancer = {
        agentId: "wibwob", label: "Wib&Wob", color: "cyan",
        x: 0, y: 2, preset: "idle", energy: 5, mood: "chill", paused: false,
      };
    }
    const dancer = activeDancer;

    // ── Layout ──────────────────────────────────────────────────────────────
    const root = blessed.box({
      parent: win.body, top: 0, left: 0, right: 0, bottom: 0,
      keys: true, mouse: true, clickable: true, style: host.theme().body,
    });

    // Field background
    const fieldLayer = createCanvas(root, { bottomOffset: 3, tags: false });

    // Skeleton foreground
    const skeletonLayer = createCanvas(root, { bottomOffset: 3, tags: true });

    // Pose button bar  (row -3 from bottom)
    const poseBar = createButtonBar(root, {
      buttons: [
        { label: "▶", action: () => {
          touchUser();
          dancer.playing = !dancer.playing;
          dancer.paused = false;
          if (dancer.playing) variantTick = 0;
          renderAll();
          host.screen.render();
        } },
        { label: "⏸", action: () => {
          touchUser();
          dancer.paused = !dancer.paused;
          dancer.playing = false;
          renderAll();
          host.screen.render();
        } },
        { label: "IDLE", action: () => {
          touchUser();
          dancer.preset = "idle";
          dancer.paused = false;
          dancer.playing = false;
          renderAll();
          host.screen.render();
        } },
        { label: "\\O/", action: () => {
          touchUser();
          dancer.preset = "arms-raised";
          dancer.paused = false;
          dancer.playing = false;
          renderAll();
          host.screen.render();
        } },
        { label: "STEP", action: () => {
          touchUser();
          dancer.preset = "step-left";
          dancer.paused = false;
          dancer.playing = false;
          renderAll();
          host.screen.render();
        } },
        { label: "JUMP", action: () => {
          touchUser();
          dancer.preset = "jump";
          dancer.paused = false;
          dancer.playing = false;
          renderAll();
          host.screen.render();
        } },
        { label: "WAVE", action: () => {
          touchUser();
          dancer.preset = "wave";
          dancer.paused = false;
          dancer.playing = false;
          renderAll();
          host.screen.render();
        } },
      ],
    });

    // Energy + mood button bar (row -2 from bottom)
    const moodBar = createButtonBar(root, {
      buttons: [
        { label: "E-", action: () => {
          touchUser();
          dancer.energy = Math.max(0, dancer.energy - 1);
          renderAll();
          host.screen.render();
        } },
        { label: "E+", action: () => {
          touchUser();
          dancer.energy = Math.min(10, dancer.energy + 1);
          renderAll();
          host.screen.render();
        } },
        { label: "CALM", action: () => {
          touchUser();
          fieldMood = "calm";
          genArtEnabled = false;
          renderAll();
          host.screen.render();
        } },
        { label: "PULSE", action: () => {
          touchUser();
          fieldMood = "pulse";
          genArtEnabled = false;
          renderAll();
          host.screen.render();
        } },
        { label: "CHAOS", action: () => {
          touchUser();
          fieldMood = "chaos";
          genArtEnabled = false;
          renderAll();
          host.screen.render();
        } },
        { label: "DRIFT", action: () => {
          touchUser();
          fieldMood = "drift";
          genArtEnabled = false;
          renderAll();
          host.screen.render();
        } },
        { label: "GEN", action: () => {
          touchUser();
          genArtEnabled = !genArtEnabled;
          renderAll();
          host.screen.render();
        } },
      ],
    });

    // Status bar (bottom row)
    const statusBar = blessed.box({
      parent: root, left: 0, right: 0, bottom: 0, height: 1,
      tags: false, style: host.theme().header,
    });

    skeletonLayer.element.setFront();

    // Wire layout (ButtonBarHandle is bottom-pinned; offset bars above status row)
    poseBar.element.bottom = 2;
    moodBar.element.bottom = 1;

    // ── Render ───────────────────────────────────────────────────────────────

    function canvasSize() {
      const lpos = (fieldLayer.element as any).lpos;
      if (lpos && Number.isFinite(lpos.xi) && Number.isFinite(lpos.xl)) {
        return { w: Math.max(1, lpos.xl-lpos.xi), h: Math.max(1, lpos.yl-lpos.yi) };
      }
      return {
        w: Math.max(1, Number(root.width)  || Number(host.screen.width)  - 6),
        h: Math.max(1, (Number(root.height)|| Number(host.screen.height) - 6) - 3),
      };
    }

    function renderField() {
      const { w, h } = canvasSize();
      if (genArtEnabled) {
        if (genGrid.length !== h || (genGrid[0]?.length ?? 0) !== w) genArtInit(w, h);
        genArtStep(w, h, dancer.energy);
        fieldLayer.setContent(genArtRender(w, h));
        return;
      }
      const chars = FIELD_MOODS[fieldMood] ?? [" "];
      const bias = Math.floor(dancer.energy / 3);
      const grid = blankGrid(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          grid[y]![x] = chars[(x*3 + y*7 + tick + bias) % chars.length] ?? " ";
      fieldLayer.setContent(gridToText(grid));
    }

    function renderDancer() {
      const { w, h } = canvasSize();
      const grid: WebcamCell[][] = blankGrid(w, h).map(row => row.map(ch => ({ ch })));
      dancer.x = Math.max(0, Math.min(dancer.x || Math.floor(w/2)-5, w-12));
      dancer.y = Math.max(0, Math.min(dancer.y, h-20));
      // PLAY mode: run full DANCE_SEQUENCE on loop
      // Normal mode: cycle frames of current pose
      let frameName: string;
      if (dancer.playing) {
        const seqIdx = variantTick % DANCE_SEQUENCE.length;
        frameName = DANCE_SEQUENCE[seqIdx] ?? "idle";
      } else {
        const frames = POSE_ANIM[dancer.preset] ?? [dancer.preset];
        const frameIdx = dancer.energy <= 3
          ? Math.floor(variantTick / 3) % frames.length
          : variantTick % frames.length;
        frameName = frames[frameIdx] ?? dancer.preset;
      }
      const lm: NormalisedLandmarks = landmarksFromPreset(frameName);
      renderSkeletonAt(grid, lm, dancer.x, dancer.y, w, h, dancer.color);
      skeletonLayer.setContent(gridToBlessedContent(grid));
    }

    function renderAll() {
      if (!dancer.paused) renderField();
      renderDancer();
      statusBar.setContent(statusText(dancer));
      poseBar.update({ leftText: "", activeId: dancer.paused ? "pause" : dancer.preset });
      moodBar.update({ leftText: `energy:${dancer.energy}`, activeId: fieldMood });
    }
    activeRenderAll = renderAll;

    // Tick speed scales with energy: 150ms (energy 10) → 800ms (energy 0)
    function tickMs() { return Math.round(800 - dancer.energy * 65); }

    let tickTimer: ReturnType<typeof setInterval> | undefined;
    function restartTick() {
      if (tickTimer) { clearInterval(tickTimer); timers.delete(tickTimer); }
      tickTimer = setInterval(() => {
        if (!dancer.paused) { tick++; variantTick++; }
        renderAll();
        host.screen.render();
      }, tickMs());
      timers.add(tickTimer);
    }
    restartTick();

    // Recheck tick speed every 2s (when energy changes via button)
    createTimer(() => restartTick(), 2000, timers);

    // ── Haiku autonomous tick ───────────────────────────────────────────────
    // Every ~60s, a haiku-class model picks the next move. ~50 input tokens,
    // ~30 output tokens per tick. Skips if user acted within HAIKU_COOLDOWN_MS.
    const HAIKU_TICK_MS = 60_000;
    let haikuAgent: Agent | undefined;
    let haikuBusy = false;

    async function ensureHaikuAgent(): Promise<Agent | undefined> {
      if (haikuAgent) return haikuAgent;
      try {
        const auth = AuthStorage.create();
        const reg = new ModelRegistry(auth);
        const avail = reg.getAvailable();
        const model =
          avail.find(m => m.id.toLowerCase().includes("haiku-4-5")) ??
          avail.find(m => m.id.toLowerCase().includes("haiku")) ??
          avail[0];
        if (!model) return undefined;
        haikuAgent = new Agent({
          initialState: {
            systemPrompt: "Reply ONLY with JSON. No markdown, no text, no explanation.",
            model,
            thinkingLevel: "off",
            tools: [],
            messages: [],
          },
          getApiKey: (provider) => auth.getApiKey(provider),
        });
        return haikuAgent;
      } catch { return undefined; }
    }

    async function haikuTick() {
      if (haikuBusy || dancer.paused || !activeWindow) return;
      if (Date.now() - lastUserAction < HAIKU_COOLDOWN_MS) return;
      const agent = await ensureHaikuAgent();
      if (!agent) return;
      haikuBusy = true;
      try {
        const { w, h } = canvasSize();
        // ~50 tokens prompt. Pose names are short. JSON response ~30 tokens.
        const prompt =
          `dancer x:${dancer.x} y:${dancer.y} e:${dancer.energy} mood:${dancer.mood} pose:${dancer.preset} field:${fieldMood} w:${w} h:${h}\n` +
          `pick next: {"x":int,"y":int,"e":0-10,"mood":str,"pose":"${POSES.join('"|"')}","field":"${FIELD_MOOD_CYCLE.join('"|"')}"}`;
        const result = await agent.run(prompt);
        const text = result.messages
          .filter((m: any) => m.role === "assistant")
          .map((m: any) => typeof m.content === "string" ? m.content : (m.content?.[0]?.text ?? ""))
          .join("");
        // Extract JSON from response (tolerant of wrapping text)
        const match = text.match(/\{[^}]+\}/);
        if (!match) return;
        const parsed = JSON.parse(match[0]);
        // Apply — clamp values, validate pose/mood
        if (typeof parsed.x === "number") dancer.x = Math.max(0, Math.min(parsed.x, w - 12));
        if (typeof parsed.y === "number") dancer.y = Math.max(0, Math.min(parsed.y, h - 20));
        if (typeof parsed.e === "number") dancer.energy = Math.max(0, Math.min(10, Math.round(parsed.e)));
        if (typeof parsed.mood === "string") dancer.mood = parsed.mood;
        if (typeof parsed.pose === "string" && POSES.includes(parsed.pose as Pose)) dancer.preset = parsed.pose as Pose;
        if (typeof parsed.field === "string" && FIELD_MOODS[parsed.field]) fieldMood = parsed.field as FieldMood;
        renderAll();
        host.screen.render();
      } catch { /* silent — haiku tick is best-effort */ }
      finally { haikuBusy = false; }
    }

    createTimer(() => { void haikuTick(); }, HAIKU_TICK_MS, timers);

    // Keys
    const handleKey = (ch: string) => {
      touchUser();
      if (ch === "q" || ch === "\x1b") { win.close(); return; }
      if (ch === " ") { dancer.paused = !dancer.paused; renderAll(); host.screen.render(); }
      if (ch === "p") { dancer.preset = nextPose(dancer.preset); renderAll(); host.screen.render(); }
      if (ch === "m") { fieldMood = nextFieldMood(); renderAll(); host.screen.render(); }
      if (ch === "g") { genArtEnabled = !genArtEnabled; renderAll(); host.screen.render(); }
      if (ch === "+") { dancer.energy = Math.min(10, dancer.energy+1); restartTick(); renderAll(); host.screen.render(); }
      if (ch === "-") { dancer.energy = Math.max(0,  dancer.energy-1); restartTick(); renderAll(); host.screen.render(); }
    };
    root.key(["q","escape","space","p","m","g","+","-"], handleKey);
    win.onInput(handleKey);

    win.onResize(() => {
      poseBar.element.bottom = 2;
      moodBar.element.bottom = 1;
      renderAll();
    });

    win.onRestyle(() => {
      root.style = host.theme().body;
      fieldLayer.element.style = host.theme().body;
      skeletonLayer.element.style = { ...host.theme().body, bg: "default", transparent: true };
      statusBar.style = host.theme().header;
      poseBar.update({});
      moodBar.update({});
      renderAll();
    });

    win.describeState(() => ({
      appType: "glitchbox",
      summary: `GlitchBox — 1 dancer  ${dancer.paused ? "paused" : "dancing"}`,
      fieldMood,
      dancers: [{ agentId: dancer.agentId, label: dancer.label, x: dancer.x, y: dancer.y,
                  preset: dancer.preset, energy: dancer.energy, mood: dancer.mood, paused: dancer.paused }],
    }));

    win.captureText(() =>
      `GlitchBox\n${dancer.label}:${dancer.preset} energy:${dancer.energy} mood:${dancer.mood}\n${statusText(dancer)}`
    );

    win.onCleanup(() => {
      clearTimers(timers);
      if (haikuAgent) { haikuAgent.abort(); haikuAgent = undefined; }
      poseBar.destroy(); moodBar.destroy();
      activeWindow = undefined;
      activeRenderAll = undefined;
    });

    renderAll();
    root.focus();
    win.focus();
  }
}
