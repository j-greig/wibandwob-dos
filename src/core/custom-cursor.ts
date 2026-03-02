import blessed from "blessed";
import { theme } from "./theme/resolver.js";

/**
 * Custom TUI cursor — a single-cell overlay that tracks mouse movement.
 * Hides the system cursor and shows a themed character at the mouse position.
 */
export class CustomCursor {
  private readonly cursor: blessed.Widgets.BoxElement;
  private readonly screen: blessed.Widgets.Screen;
  private visible = true;

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;

    this.cursor = blessed.box({
      parent: screen,
      width: 1,
      height: 1,
      top: 0,
      left: 0,
      content: "▓",
      style: { fg: "white", bg: "transparent", bold: true },
      // Transparent to input — clicks pass through
      clickable: false,
      keyable: false,
      focusable: false,
    });

    // Always on top
    this.cursor.setIndex(1000);

    // Hide the system terminal cursor — do it on every render
    // because blessed/widgets can re-show it
    screen.program.hideCursor();
    screen.on("render", () => {
      if (this.visible) screen.program.hideCursor();
    });

    // Track mouse movement
    screen.on("mouse", (data) => {
      if (!this.visible) return;
      this.cursor.top = data.y;
      this.cursor.left = data.x;
      // Keep on top after any z-order changes
      this.cursor.setIndex(1000);
      screen.render();
    });
  }

  restyle(): void {
    const accent = theme().accent;
    this.cursor.style.fg = accent?.fg ?? "white";
  }

  show(): void {
    this.visible = true;
    this.cursor.show();
    this.screen.program.hideCursor();
  }

  hide(): void {
    this.visible = false;
    this.cursor.hide();
    this.screen.program.showCursor();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }
}
