/**
 * Theater — VT100 Terminal Theater for WibWob-DOS
 *
 * Port of https://github.com/orhun/theattyr
 * Plays VT100 art and animations from the 1960s–1990s ANSI art scene.
 *
 * Features:
 * - Sidebar with 93+ animations (Tab to toggle, letter-jump, wrap-around)
 * - Frame-by-frame playback via @xterm/headless VT100 parsing
 * - ANSI color rendering via blessed tags
 * - Playback controls: Enter, Space, R, N/P, A (auto-advance), S (shuffle)
 * - Scrub bar with << < [▓░░░] > >> — mouse-clickable seek + step
 * - Left/Right arrow keys for frame scrubbing, play/pause toggle
 * - Adjustable FPS (+/-, 1-120), speed display (1x/2x/0.5x)
 * - ? help overlay, API text input (onInput), centered 80-col content
 * - Includes dvd.vt — WibWob-DOS DVD screensaver as VT100 animation
 */
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createTimer,
  clearTimers,
} from "../../src/services/microapp-sdk.js";
import { Vt100Player, loadAnimationList } from "./vt100-parser.js";
import type { VtAnimation } from "./vt100-parser.js";
import { join } from "path";

const APP_TITLE = "Theater 🎥";
const VT_DIR = join(import.meta.dir, "vt100");

// Default terminal size for VT100 content
const VT_COLS = 80;
const VT_ROWS = 24;
const DEFAULT_FPS = 30;
const SIDEBAR_WIDTH = 28;

export default function setup(host: MicroappHost) {
  // Load animations once at setup time
  const animations = loadAnimationList(VT_DIR);

  host.registerCommand({
    id: "open",
    label: "Theater",
    description: "Open the VT100 terminal theater.",
    menu: [{ category: "applications", order: 160, label: "Theater 🎥" }],
    palette: { order: 160, label: "Open Theater" },
    action: () => openTheater(host, animations),
  });

  host.registerCommand({
    id: "play",
    direct: true,
    label: "Play Animation",
    description: "Play a specific VT100 animation by name.",
    action: (args?: { name?: string }) => {
      if (!args?.name) return { ok: false, error: "name required" };
      const anim = animations.find((a) => a.name === args.name);
      if (!anim) return { ok: false, error: `unknown animation: ${args.name}` };
      openTheater(host, animations, anim);
      return { ok: true, playing: args.name };
    },
  });

  host.registerCommand({
    id: "list",
    direct: true,
    label: "List Animations",
    description: "List all available VT100 animations.",
    action: () => ({
      ok: true,
      count: animations.length,
      animations: animations.map((a) => ({
        name: a.name,
        description: a.description,
        bytes: a.totalBytes,
        chunks: a.chunks.length,
      })),
    }),
  });

  host.registerCommand({
    id: "random",
    label: "Random Animation",
    description: "Play a random VT100 animation.",
    action: () => {
      const anim = animations[Math.floor(Math.random() * animations.length)];
      openTheater(host, animations, anim);
      return { ok: true, playing: anim.name, description: anim.description };
    },
  });

  host.registerSnapshot({
    serialize: (window) => {
      const state = window.describeState?.() as Record<string, unknown> | undefined;
      return {
        animation: state?.currentAnimation ?? null,
      };
    },
    restore: (_snapshot, payload) => {
      const name = payload.animation as string | null;
      if (name) {
        const anim = animations.find((a) => a.name === name);
        if (anim) {
          openTheater(host, animations, anim);
          return;
        }
      }
      openTheater(host, animations);
    },
  });
}

function openTheater(
  host: MicroappHost,
  animations: VtAnimation[],
  initialAnimation?: VtAnimation,
) {
  const timers = new Set<ReturnType<typeof setInterval>>();
  const player = new Vt100Player(VT_COLS, VT_ROWS);

  let selectedIndex = initialAnimation
    ? animations.indexOf(initialAnimation)
    : 0;
  if (selectedIndex < 0) selectedIndex = 0;

  let sidebarVisible = !initialAnimation;
  let fps = DEFAULT_FPS;
  let paused = false;
  let autoAdvance = false;
  let colorMode = true; // true = ANSI color, false = mono
  let frameCount = 0;
  let fpsDisplay = 0;
  let lastFpsTime = Date.now();
  let lastFpsFrames = 0;

  const TRANSPORT_HEIGHT = 2; // scrub bar + info bar

  // Window: wide enough for sidebar + VT100 content
  const winWidth = sidebarVisible ? SIDEBAR_WIDTH + VT_COLS + 4 : VT_COLS + 4;
  const winHeight = VT_ROWS + 5; // border + transport

  const win = host.createWindow({
    title: APP_TITLE,
    width: Math.min(winWidth, 120),
    height: Math.min(winHeight, 30),
  });

  // ── Sidebar (animation list) ──────────────────────────────────────────

  // Always create sidebar with full styling — blessed crashes if border is undefined.
  // Visibility is controlled by detach/append, never by nulling border.
  const sidebar = blessed.list({
    parent: sidebarVisible ? win.body : undefined,
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    bottom: TRANSPORT_HEIGHT,
    keys: true,
    mouse: true,
    vi: true,
    scrollable: true,
    alwaysScroll: true,
    items: animations.map((a) => ` ${a.name}`),
    scrollbar: { ch: "▐" },
    style: {
      ...host.theme().body,
      selected: { fg: host.theme().selected.fg, bg: host.theme().selected.bg },
      scrollbar: { bg: host.theme().scrollbar?.bg || "grey" },
    },
    border: { type: "line" as const },
    label: " VT100 Animations ",
  } as Record<string, unknown>);

  sidebar.select(selectedIndex);

  // ── Animation viewport ────────────────────────────────────────────────

  const viewport = blessed.box({
    parent: win.body,
    top: 0,
    left: sidebarVisible ? SIDEBAR_WIDTH : 0,
    right: 0,
    bottom: TRANSPORT_HEIGHT,
    tags: true,
    style: {
      fg: host.theme().body.fg,
      bg: host.theme().body.bg,
    },
  });

  // ── Transport: scrub bar (row -2) ─────────────────────────────────────

  const scrubBar = blessed.box({
    parent: win.body,
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    mouse: true,
    style: { fg: host.theme().footer.fg, bg: host.theme().footer.bg },
    content: "",
  });

  // ── Transport: info bar (row -1) ──────────────────────────────────────

  const infoBar = blessed.box({
    parent: win.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    mouse: true,
    style: { fg: host.theme().header.fg, bg: host.theme().header.bg },
    content: "",
  });

  // ── Scrub bar interaction ─────────────────────────────────────────────

  // Layout: " << < [▓▓▓▓░░░░░░░░░░░░░░░░] > >> "
  const SCRUB_L = " << < "; // 6 chars
  const SCRUB_R = " > >> "; // 6 chars

  function getScrubTrackWidth(): number {
    const barW = (scrubBar.width as number) || 40;
    return Math.max(4, barW - SCRUB_L.length - SCRUB_R.length - 2); // -2 for brackets
  }

  scrubBar.on("click", (_mouse: { x: number; y: number }) => {
    const barAbsLeft = (scrubBar.aleft as number) || 0;
    const clickX = _mouse.x - barAbsLeft;
    const trackW = getScrubTrackWidth();
    const trackStart = SCRUB_L.length + 1; // after "["
    const trackEnd = trackStart + trackW;

    if (clickX < 3) {
      // << skip to start
      player.seekTo(0);
      paused = true;
      renderFrame();
    } else if (clickX < SCRUB_L.length) {
      // < step back
      stepBack();
    } else if (clickX >= trackStart && clickX < trackEnd) {
      // Click on track — seek proportionally
      const ratio = (clickX - trackStart) / trackW;
      const targetChunk = Math.round(ratio * player.totalChunks);
      player.seekTo(targetChunk);
      renderFrame();
    } else if (clickX >= trackEnd + 1 && clickX < trackEnd + 1 + 3) {
      // > step forward
      stepForward();
    } else {
      // >> skip to end
      player.skipToEndSync();
      paused = true;
      renderFrame();
    }
  });

  // Click play/pause, color toggle, or ☰ sidebar toggle on info bar
  infoBar.on("click", (_mouse: { x: number; y: number }) => {
    const barAbsLeft = (infoBar.aleft as number) || 0;
    const barW = (infoBar.width as number) || 40;
    const clickX = _mouse.x - barAbsLeft;
    if (clickX < 5) {
      togglePause();
    } else if (clickX >= barW - 4) {
      // ☰ sidebar toggle (last 4 chars)
      toggleSidebar();
    } else if (clickX >= barW - 8 && clickX < barW - 4) {
      // C/M color toggle (4 chars before ☰)
      colorMode = !colorMode;
      renderFrame();
    }
  });

  // ── Transport helpers ─────────────────────────────────────────────────

  function togglePause() {
    if (player.isPlaying || player.isFinished) {
      if (player.isFinished) {
        player.restart();
        paused = false;
      } else {
        paused = !paused;
      }
      updateTransport();
      host.screen.render();
    }
  }

  /** Step back ~1% of total chunks (min 1) */
  function stepBack() {
    const step = Math.max(1, Math.floor(player.totalChunks * 0.01));
    const target = Math.max(0, player.currentChunk - step);
    player.seekTo(target);
    paused = true;
    renderFrame();
  }

  /** Step forward ~1% of total chunks (min 1) */
  function stepForward() {
    const step = Math.max(1, Math.floor(player.totalChunks * 0.01));
    const target = Math.min(player.totalChunks, player.currentChunk + step);
    player.seekTo(target);
    paused = true;
    renderFrame();
  }

  function updateTransport() {
    const anim = player.currentAnimation;
    const trackW = getScrubTrackWidth();
    const pct = player.progress;
    const filled = Math.round(pct * trackW);
    const track = "▓".repeat(filled) + "░".repeat(trackW - filled);

    scrubBar.setContent(
      `${SCRUB_L}[${track}]${SCRUB_R}`,
    );

    // Info bar: ▶/❚❚ + animation info + fps/speed + ☰ sidebar toggle
    const playIcon = paused || player.isFinished ? " ▶ " : " ❚❚";
    const animName = anim ? anim.name : "(none)";
    const desc = anim ? anim.description : "";
    const speedRatio = fps / DEFAULT_FPS;
    const speedStr = speedRatio === 1 ? "1x" : `${speedRatio.toFixed(1)}x`;
    const fpsStr = player.isPlaying && !paused
      ? `${fpsDisplay}fps ${speedStr}`
      : `${fps}fps ${speedStr}`;
    const pctStr = player.isFinished ? "done" : `${Math.round(pct * 100)}%`;
    const autoStr = autoAdvance ? " [auto]" : "";
    const colorBtn = colorMode ? " C " : " M ";
    const sidebarBtn = " ☰ ";

    const left = `${playIcon}  ${animName}: ${desc}`;
    const right = `${pctStr}  ${fpsStr}${autoStr}${colorBtn}${sidebarBtn}`;
    const barW = (infoBar.width as number) || 40;
    const gap = Math.max(1, barW - left.length - right.length);
    infoBar.setContent(`${left}${" ".repeat(gap)}${right}`);

    // Restyle
    const t = host.theme();
    scrubBar.style.fg = t.footer.fg;
    scrubBar.style.bg = t.footer.bg;
    infoBar.style.fg = t.header.fg;
    infoBar.style.bg = t.header.bg;
  }

  function renderFrame() {
    const lines = colorMode ? player.readScreenColored() : player.readScreen();
    const vpHeight = (viewport.height as number) || VT_ROWS;
    const vpWidth = (viewport.width as number) || VT_COLS;

    // Center the 80-col content horizontally when viewport is wider
    const padLeft = vpWidth > VT_COLS ? Math.floor((vpWidth - VT_COLS) / 2) : 0;
    const prefix = padLeft > 0 ? " ".repeat(padLeft) : "";

    let content = "";
    for (let i = 0; i < vpHeight; i++) {
      const line = lines[i] || "";
      content += prefix + line;
      if (i < vpHeight - 1) content += "\n";
    }
    viewport.setContent(content);
    updateTransport();
    host.screen.render();
  }

  function startAnimation(index: number) {
    selectedIndex = index;
    const anim = animations[index];
    if (!anim) return;
    player.load(anim);
    paused = false;
    frameCount = 0;
    fpsDisplay = 0;
    lastFpsTime = Date.now();
    lastFpsFrames = 0;
    renderFrame();
  }

  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    if (sidebarVisible) {
      win.body.append(sidebar);
      viewport.left = SIDEBAR_WIDTH;
      sidebar.focus();
    } else {
      sidebar.detach();
      viewport.left = 0;
    }
    updateTransport(); // update ☰ button state
    host.screen.render();
  }

  // ── Playback timer ────────────────────────────────────────────────────

  let playbackTimer: ReturnType<typeof setInterval> | null = null;

  function startPlaybackTimer() {
    if (playbackTimer) {
      clearInterval(playbackTimer);
      timers.delete(playbackTimer);
    }
    playbackTimer = setInterval(() => {
      if (paused) return;

      // Auto-advance: when finished, move to next animation after a brief pause
      if (player.isFinished && autoAdvance) {
        const next = (selectedIndex + 1) % animations.length;
        sidebar.select(next);
        startAnimation(next);
        return;
      }

      if (!player.isPlaying || player.isFinished) return;

      // Feed one chunk per tick
      const changed = player.tick();
      if (changed) {
        frameCount++;

        // Update FPS counter every second
        const now = Date.now();
        if (now - lastFpsTime >= 1000) {
          fpsDisplay = frameCount - lastFpsFrames;
          lastFpsFrames = frameCount;
          lastFpsTime = now;
        }

        renderFrame();
      }
    }, Math.round(1000 / fps));
    timers.add(playbackTimer);
  }

  startPlaybackTimer();

  // ── Key bindings ──────────────────────────────────────────────────────

  sidebar.on("select", (_item: unknown, index: number) => {
    startAnimation(index);
    if (!sidebarVisible) return;
    // Keep sidebar visible but shift focus hint
  });

  // Global key handler on the window body
  win.body.on("keypress", (_ch: string, key: { name: string; full: string }) => {
    if (!key) return;

    switch (key.name) {
      case "tab":
        toggleSidebar();
        break;
      case "space":
        togglePause();
        break;
      case "r":
        player.restart();
        paused = false;
        frameCount = 0;
        renderFrame();
        break;
      case "left":
        stepBack();
        break;
      case "right":
        stepForward();
        break;
      case "up":
        if (sidebarVisible) {
          const prev = selectedIndex <= 0 ? animations.length - 1 : selectedIndex - 1;
          sidebar.select(prev);
          startAnimation(prev);
        }
        break;
      case "down":
        if (sidebarVisible) {
          const next = selectedIndex >= animations.length - 1 ? 0 : selectedIndex + 1;
          sidebar.select(next);
          startAnimation(next);
        }
        break;
      case "enter":
      case "return":
        startAnimation(selectedIndex);
        break;
      case "n": {
        // Next animation (wraps)
        const ni = (selectedIndex + 1) % animations.length;
        sidebar.select(ni);
        startAnimation(ni);
        break;
      }
      case "p": {
        // Previous animation (wraps)
        const pi = selectedIndex <= 0 ? animations.length - 1 : selectedIndex - 1;
        sidebar.select(pi);
        startAnimation(pi);
        break;
      }
      case "?": {
        const help = [
          "Theater Controls:",
          "  Tab     — toggle sidebar",
          "  ↑/↓    — browse + play (sidebar)",
          "  ←/→    — scrub back/forward",
          "  Enter   — play selected",
          "  N/P     — next/prev animation",
          "  Space   — pause/resume",
          "  R       — restart animation",
          "  A       — toggle auto-advance",
          "  C       — toggle color/mono",
          "  S       — shuffle (random animation)",
          "  +/-     — adjust FPS",
          "  a-z     — jump to letter (sidebar)",
          "  ?       — this help",
          "",
          "  Mouse: click scrub bar to seek,",
          "  click ▶/❚❚, C/M, ☰ on info bar",
        ].join("\n");
        host.flash(help);
        break;
      }
      case "a":
        autoAdvance = !autoAdvance;
        updateTransport();
        host.screen.render();
        break;
      case "c":
        colorMode = !colorMode;
        renderFrame();
        break;
      case "s":
        // Shuffle: jump to a random animation
        {
          const ri = Math.floor(Math.random() * animations.length);
          sidebar.select(ri);
          startAnimation(ri);
        }
        break;
      case "=": // + key (unshifted =)
      case "+":
        fps = Math.min(120, fps + 5);
        startPlaybackTimer();
        updateTransport();
        host.screen.render();
        break;
      case "-":
        fps = Math.max(1, fps - 5);
        startPlaybackTimer();
        updateTransport();
        host.screen.render();
        break;
      default: {
        // Letter jump: press a letter to jump to the first animation starting with it
        // (only in sidebar mode, and only for letters not bound to commands)
        const ch = key.name?.toLowerCase();
        const boundKeys = new Set(["r", "n", "p", "a", "s", "c"]);
        if (sidebarVisible && ch && ch.length === 1 && /^[a-z]$/.test(ch) && !boundKeys.has(ch)) {
          const idx = animations.findIndex((a) => a.name.toLowerCase().startsWith(ch));
          if (idx >= 0) {
            sidebar.select(idx);
            startAnimation(idx);
          }
        }
        break;
      }
    }
  });

  // ── Lifecycle hooks ───────────────────────────────────────────────────

  win.describeState(() => {
    const anim = player.currentAnimation;
    return {
      summary: anim
        ? `Theater — ${anim.name}: ${anim.description}${player.isFinished ? " (finished)" : paused ? " (paused)" : " (playing)"}`
        : "Theater — idle",
      currentAnimation: anim?.name || null,
      animationCount: animations.length,
      progress: player.progress,
      paused,
      autoAdvance,
      sidebarVisible,
    };
  });

  win.captureText(() => {
    const header = `Theater — ${player.currentAnimation?.name || "idle"}\n`;
    if (colorMode && typeof player.readScreenAnsi === "function") {
      return header + player.readScreenAnsi().join("\n");
    }
    return header + player.readPlainText();
  });

  win.onRestyle(() => {
    const t = host.theme();
    viewport.style = { fg: t.body.fg, bg: t.body.bg };
    sidebar.style = {
      ...t.body,
      selected: { fg: t.selected.fg, bg: t.selected.bg },
    } as Record<string, unknown>;
    updateTransport();
    host.screen.render();
  });

  win.onInput((text: string) => {
    // Accept animation name via API text input
    const name = text.trim();
    const idx = animations.findIndex(
      (a) => a.name === name || a.name.startsWith(name),
    );
    if (idx >= 0) {
      sidebar.select(idx);
      startAnimation(idx);
    }
  });

  win.onCleanup(() => {
    clearTimers(timers);
    player.dispose();
  });

  win.onResize(() => {
    // VT100 art is authored for fixed 80×24 — do NOT resize the virtual terminal.
    // Just re-render the frame to fit the new viewport.
    renderFrame();
  });

  // ── Initial state ─────────────────────────────────────────────────────

  if (initialAnimation) {
    startAnimation(selectedIndex);
  } else {
    // Start first animation automatically
    startAnimation(0);
  }

  if (sidebarVisible) {
    sidebar.focus();
  }
  win.focus();
}
