import blessed from "blessed";
import stringWidth from "string-width";

import { appFlags } from "./cli.js";
import { theme, themeName } from "./theme/resolver.js";
import type { DesktopState } from "./types.js";

interface ShellChromeDeps {
  screen: blessed.Widgets.Screen;
  menuBar: blessed.Widgets.BoxElement;
  desktop: blessed.Widgets.BoxElement;
  statusLine: blessed.Widgets.BoxElement;
  getInstanceDisplayLabel: () => string;
  getDesktopState: () => DesktopState;
  getScrambleFace: () => string;
  onResize: () => void;
  onRestart: () => void;
}

/**
 * Owns shell-only chrome: desktop wallpaper, top identity widgets, dev restart
 * button, status line, resize repaint, and chromeless toggling.
 */
export class ShellChromeController {
  private statusKaomoji?: blessed.Widgets.BoxElement;
  private statusIdentity?: blessed.Widgets.BoxElement;
  private restartButton?: blessed.Widgets.BoxElement;
  private kaomojiBlink = false;
  private kaomojiTimer?: NodeJS.Timeout;
  private desktopChromeless = false;

  constructor(private readonly deps: ShellChromeDeps) {}

  init(): void {
    this.updateStatusLine();
    this.repaintDesktop();
    if (appFlags().dev) {
      this.renderDevControls();
    }
    this.renderTopIdentity();
    this.renderTopKaomoji();
    this.startKaomojiBlink();
    this.deps.screen.on("resize", () => {
      this.repaintDesktop();
      this.deps.onResize();
      this.renderTopIdentity();
      this.renderTopKaomoji();
      this.deps.screen.render();
    });
  }

  updateStatusLine(): void {
    const current = this.deps.getDesktopState();
    const focus = current.windows.find((window) => window.focused);
    const focusSummary = focus
      ? ` Focus ${focus.id}:${focus.kind} ${focus.width ?? "?"}x${focus.height ?? "?"}@${focus.left ?? 0},${focus.top ?? 0}`
      : " Focus none";
    const left = `Alt-F File  Alt-E Edit  Alt-V View  Alt-W Window  Alt-A Applications  Alt-D Demos  Tab Next  Shift-Tab Prev  Alt-Shift-Arrows Resize  Ctrl-S Save  Ctrl-Q Quit (=^=)  |  Term ${current.screen.width}x${current.screen.height}  Theme ${themeName()}  Windows ${current.screen.openWindowCount}${focusSummary}`;
    const scrLabel = ` ${this.deps.getScrambleFace()}`;
    const width = Math.max(1, Number(this.deps.screen.width));
    const trimLeft = left.slice(0, width - scrLabel.length);
    this.deps.statusLine.setContent(trimLeft.padEnd(width - scrLabel.length) + scrLabel);
  }

  applyTheme(): void {
    this.deps.menuBar.style = theme().menuBar;
    this.deps.desktop.style = theme().desktop;
    this.deps.statusLine.style = theme().statusLine;
    if (this.restartButton) {
      this.restartButton.style = { ...theme().menuBar, hover: theme().selected };
    }
    this.renderTopIdentity();
    this.renderTopKaomoji();
    this.repaintDesktop();
  }

  repaintDesktop(): void {
    const width = Math.max(1, Number(this.deps.screen.width));
    const height = Math.max(1, Number(this.deps.screen.height) - 2);
    const pattern = theme().desktopPattern;
    if (pattern && pattern.length > 0) {
      const rows: string[] = [];
      for (let y = 0; y < height; y++) {
        const patRow = pattern[y % pattern.length];
        let line = "";
        while (line.length < width) line += patRow;
        rows.push(line.slice(0, width));
      }
      this.deps.desktop.setContent(rows.join("\n"));
      return;
    }
    const fill = theme().desktopFillChar || " ";
    const line = fill.repeat(width);
    this.deps.desktop.setContent(
      Array.from({ length: height }, () => line).join("\n"),
    );
  }

  toggleDesktopChrome(): void {
    this.desktopChromeless = !this.desktopChromeless;
    if (this.desktopChromeless) {
      this.deps.menuBar.hide();
      this.deps.statusLine.hide();
      this.deps.desktop.top = 0 as any;
      this.deps.desktop.bottom = 0 as any;
    } else {
      this.deps.menuBar.show();
      this.deps.statusLine.show();
      this.deps.desktop.top = 1 as any;
      this.deps.desktop.bottom = 1 as any;
    }
    this.deps.screen.render();
  }

  destroy(): void {
    if (this.kaomojiTimer) {
      clearTimeout(this.kaomojiTimer);
      this.kaomojiTimer = undefined;
    }
  }

  private renderDevControls(): void {
    this.restartButton = blessed.box({
      parent: this.deps.screen,
      top: 0,
      right: 0,
      height: 1,
      width: 5,
      tags: true,
      content: " ↻  ",
      style: { ...theme().menuBar, hover: theme().selected },
      mouse: true,
      clickable: true,
    });
    this.restartButton.on("click", () => this.deps.onRestart());
    this.deps.screen.key(["C-r"], () => this.deps.onRestart());
  }

  // ── Kaomoji mood rotation ───────────────────────────────────────────
  // Cycles through emotional states every ~5 minutes with a brief blink
  // transition. Each mood has a resting face and a blink (eyes-closed) face.

  private static readonly MOODS: Array<{ rest: string; blink: string }> = [
    { rest: "༼ﾂ◕‿◕‿◕༽ﾂ",   blink: "༼ﾂ-‿-‿-༽ﾂ"    },  // content
    { rest: "(ﾉ◕ヮ◕)ﾉ*:・ﾟ✧", blink: "(ﾉ-ヮ-)ﾉ*:・ﾟ✧"  },  // excited
    { rest: "( ˘ ³˘)♥",       blink: "( ˘ -˘)♥"       },  // affectionate
    { rest: "ʕ•ᴥ•ʔ",         blink: "ʕ-ᴥ-ʔ"          },  // bearish
    { rest: "(づ｡◕‿‿◕｡)づ",   blink: "(づ｡-‿‿-｡)づ"    },  // huggy
    { rest: "٩(◕‿◕｡)۶",      blink: "٩(-‿-｡)۶"       },  // celebratory
    { rest: "( ͡° ͜ʖ ͡°)",     blink: "( ͡- ͜ʖ ͡-)"     },  // mischievous
    { rest: "(⊙_⊙)",         blink: "(-_-)"           },  // surprised
    { rest: "◖⚆ᴥ⚆◗",        blink: "◖-ᴥ-◗"          },  // watchful
    { rest: "♪(´ε` )",       blink: "♪(´- ` )"        },  // musical
    { rest: "(ᵔᴥᵔ)",         blink: "(-ᴥ-)"           },  // puppy
    { rest: "⸜(｡˃ ᵕ ˂ )⸝♡",  blink: "⸜(｡- ᵕ - )⸝♡"   },  // smitten
  ];

  private moodIndex = Math.floor(Math.random() * ShellChromeController.MOODS.length);

  private getStatusKaomoji(): string {
    const mood = ShellChromeController.MOODS[this.moodIndex];
    return this.kaomojiBlink ? mood.blink : mood.rest;
  }

  private startKaomojiBlink(): void {
    if (this.kaomojiTimer) return;
    const scheduleNext = () => {
      // Change mood every 4-6 minutes
      const delay = 240_000 + Math.random() * 120_000;
      this.kaomojiTimer = setTimeout(() => {
        // Blink transition
        this.kaomojiBlink = true;
        this.renderTopKaomoji();
        this.deps.screen.render();
        setTimeout(() => {
          // Pick a new mood (different from current)
          const prev = this.moodIndex;
          const moods = ShellChromeController.MOODS;
          do {
            this.moodIndex = Math.floor(Math.random() * moods.length);
          } while (moods.length > 1 && this.moodIndex === prev);
          this.kaomojiBlink = false;
          this.renderTopKaomoji();
          this.deps.screen.render();
          scheduleNext();
        }, 300);
      }, delay);
    };
    scheduleNext();
  }

  private renderTopKaomoji(): void {
    const text = this.getStatusKaomoji();
    const identityWidth = stringWidth(` ${this.deps.getInstanceDisplayLabel()} `);
    const baseOffset = appFlags().dev ? 6 : 1;
    const rightOffset = Math.max(0, baseOffset + identityWidth);
    const width = Math.max(1, stringWidth(text));
    if (!this.statusKaomoji) {
      this.statusKaomoji = blessed.box({
        parent: this.deps.menuBar,
        top: 0,
        right: rightOffset,
        height: 1,
        width,
        tags: true,
        content: text,
        style: theme().menuBar,
      });
      return;
    }
    this.statusKaomoji.right = rightOffset;
    this.statusKaomoji.width = width;
    this.statusKaomoji.setContent(text);
    this.statusKaomoji.style = theme().menuBar;
  }

  private renderTopIdentity(): void {
    const text = ` ${this.deps.getInstanceDisplayLabel()} `;
    const rightOffset = Math.max(0, appFlags().dev ? 6 : 1);
    const width = Math.max(1, stringWidth(text));
    if (!this.statusIdentity) {
      this.statusIdentity = blessed.box({
        parent: this.deps.menuBar,
        top: 0,
        right: rightOffset,
        height: 1,
        width,
        tags: true,
        content: text,
        style: theme().menuBar,
      });
      return;
    }
    this.statusIdentity.right = rightOffset;
    this.statusIdentity.width = width;
    this.statusIdentity.setContent(text);
    this.statusIdentity.style = theme().menuBar;
  }
}
