import blessed from "blessed";
import {
  blankGrid,
  gridToText,
  gridToBlessedContent,
  createTimer,
  clearTimers,
  renderSkeletonAt,
  landmarksFromPreset,
  tween,
  createButtonBar,
  type MicroappHost,
  type NormalisedLandmarks,
  type WebcamCell,
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
};

type PoseBtn  = Pose | "pause";
type MoodBtn  = FieldMood;
type EnergyBtn = "e-" | "e+";

export default function setup(host: MicroappHost) {
  let activeWindow: ReturnType<typeof host.createWindow> | undefined;
  let activeDancer: DancerState | undefined;
  let activeRenderAll: (() => void) | undefined;
  let fieldMood: FieldMood = "calm";
  let variantTick = 0;

  function nextFieldMood(): FieldMood {
    const i = FIELD_MOOD_CYCLE.indexOf(fieldMood);
    return FIELD_MOOD_CYCLE[(i + 1) % FIELD_MOOD_CYCLE.length] ?? "calm";
  }
  function nextPose(current: Pose): Pose {
    const i = POSES.indexOf(current);
    return POSES[(i + 1) % POSES.length] ?? "idle";
  }
  function statusText(d: DancerState): string {
    return `${d.label}  pose:${d.preset}  energy:${d.energy}  mood:${d.mood}  field:${fieldMood}${d.paused ? "  ⏸ PAUSED" : ""}`;
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  host.registerCommand({
    id: "glitchbox.open",
    label: "Open GlitchBox",
    menu: [{ category: "applications", order: 55, label: "GlitchBox" }],
    palette: { order: 255, label: "GlitchBox — Symbient Dance Floor" },
    action: () => openGlitchBox(),
  });

  host.registerCommand({
    id: "glitchbox.pose", direct: true,
    label: "Set GlitchBox Pose",
    description: "Set dancer pose. Args: preset (idle|arms-raised|step-left|jump|wave)",
    action: (args: Record<string, unknown>) => {
      if (!activeDancer) return { ok: false, error: "No dancer on floor" };
      const p = String(args.preset ?? "idle") as Pose;
      activeDancer.preset = POSES.includes(p) ? p : "idle";
      activeRenderAll?.();
      return { ok: true, preset: activeDancer.preset };
    },
  });

  host.registerCommand({
    id: "glitchbox.move", direct: true,
    label: "Move GlitchBox Dancer",
    description: "Smoothly tween dancer to new x,y. Args: x, y",
    action: (args: Record<string, unknown>) => {
      if (!activeDancer) return { ok: false, error: "No dancer on floor" };
      const tx = Number(args.x ?? activeDancer.x);
      const ty = Number(args.y ?? activeDancer.y);
      const sx = activeDancer.x, sy = activeDancer.y;
      tween({
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
    id: "glitchbox.state", direct: true,
    label: "Set GlitchBox Dancer State",
    description: "Set energy (0-10) and/or mood. Args: energy, mood",
    action: (args: Record<string, unknown>) => {
      if (!activeDancer) return { ok: false, error: "No dancer on floor" };
      if (args.energy !== undefined) activeDancer.energy = Math.max(0, Math.min(10, Number(args.energy)));
      if (args.mood   !== undefined) activeDancer.mood = String(args.mood);
      activeRenderAll?.();
      return { ok: true, energy: activeDancer.energy, mood: activeDancer.mood };
    },
  });

  host.registerCommand({
    id: "glitchbox.field", direct: true,
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
    const fieldLayer = blessed.box({
      parent: root, top: 0, left: 0, right: 0, bottom: 3,
      tags: false, style: host.theme().body,
    });

    // Skeleton foreground
    const skeletonLayer = blessed.box({
      parent: root, top: 0, left: 0, right: 0, bottom: 3,
      tags: true, style: { ...host.theme().body, bg: "default", transparent: true },
    });

    // Pose button bar  (row -3 from bottom)
    const poseBar = createButtonBar<PoseBtn>(
      root,
      [
        { id: "idle",        label: "IDLE"  },
        { id: "arms-raised", label: "\\O/"  },
        { id: "step-left",   label: "STEP"  },
        { id: "jump",        label: "JUMP"  },
        { id: "wave",        label: "WAVE"  },
        { id: "pause",       label: "⏸"    },
      ],
      (id) => {
        if (id === "pause") {
          dancer.paused = !dancer.paused;
        } else {
          dancer.preset = id as Pose;
          dancer.paused = false;
        }
        renderAll();
        host.screen.render();
      },
    );

    // Energy + mood button bar (row -2 from bottom)
    const moodBar = createButtonBar<MoodBtn | EnergyBtn>(
      root,
      [
        { id: "e-",    label: "E-"    },
        { id: "e+",    label: "E+"    },
        { id: "calm",  label: "CALM"  },
        { id: "pulse", label: "PULSE" },
        { id: "chaos", label: "CHAOS" },
        { id: "drift", label: "DRIFT" },
      ],
      (id) => {
        if (id === "e-") dancer.energy = Math.max(0, dancer.energy - 1);
        else if (id === "e+") dancer.energy = Math.min(10, dancer.energy + 1);
        else { fieldMood = id as FieldMood; }
        renderAll();
        host.screen.render();
      },
    );

    // Status bar (bottom row)
    const statusBar = blessed.box({
      parent: root, left: 0, right: 0, bottom: 0, height: 1,
      tags: false, style: host.theme().header,
    });

    skeletonLayer.setFront();

    // Wire layout
    poseBar.layout({ top: Number(win.body.height) - 3, left: 0, width: Number(win.body.width), height: 1 });
    moodBar.layout({ top: Number(win.body.height) - 2, left: 0, width: Number(win.body.width), height: 1 });

    // ── Render ───────────────────────────────────────────────────────────────

    function canvasSize() {
      const lpos = (fieldLayer as any).lpos;
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
      // Pick animation frame — high energy cycles faster through frames
      const frames = POSE_ANIM[dancer.preset] ?? [dancer.preset];
      // At energy ≤ 3: hold first frame (hold every 3 ticks). At energy > 3: advance each tick.
      const frameIdx = dancer.energy <= 3
        ? Math.floor(variantTick / 3) % frames.length
        : variantTick % frames.length;
      const frameName = frames[frameIdx] ?? dancer.preset;
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
      }, tickMs());
      timers.add(tickTimer);
    }
    restartTick();

    // Recheck tick speed every 2s (when energy changes via button)
    createTimer(() => restartTick(), 2000, timers);

    // Keys
    const handleKey = (ch: string) => {
      if (ch === "q" || ch === "\x1b") { win.close(); return; }
      if (ch === " ") { dancer.paused = !dancer.paused; renderAll(); host.screen.render(); }
      if (ch === "p") { dancer.preset = nextPose(dancer.preset); renderAll(); host.screen.render(); }
      if (ch === "m") { fieldMood = nextFieldMood(); renderAll(); host.screen.render(); }
      if (ch === "+") { dancer.energy = Math.min(10, dancer.energy+1); restartTick(); renderAll(); host.screen.render(); }
      if (ch === "-") { dancer.energy = Math.max(0,  dancer.energy-1); restartTick(); renderAll(); host.screen.render(); }
    };
    root.key(["q","escape","space","p","m","+","-"], handleKey);
    win.onInput(handleKey);

    win.onResize(() => {
      const bw = Number(win.body.width);
      const bh = Number(win.body.height);
      poseBar.layout({ top: bh-3, left: 0, width: bw, height: 1 });
      moodBar.layout({ top: bh-2, left: 0, width: bw, height: 1 });
      renderAll();
    });

    win.onRestyle(() => {
      root.style = host.theme().body;
      fieldLayer.style = host.theme().body;
      skeletonLayer.style = { ...host.theme().body, bg: "default", transparent: true };
      statusBar.style = host.theme().header;
      poseBar.restyle(); moodBar.restyle();
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
      poseBar.destroy(); moodBar.destroy();
      activeWindow = undefined;
      activeRenderAll = undefined;
    });

    renderAll();
    root.focus();
    win.focus();
  }
}
