import blessed from "blessed";

import { theme } from "./theme/resolver.js";
import type { Box, List, MenuConfig, MenuItem } from "./types.js";

export class MenuOverlayManager {
  private menuList?: List;
  private popupMenu?: List;
  private openMenuLabel?: string;
  private menuTargets: Box[] = [];

  constructor(
    private readonly screen: blessed.Widgets.Screen,
    private readonly menuBar: Box,
    private readonly menus: MenuConfig[],
    private readonly restoreWindowFocus: () => void,
    private readonly onChange: () => void
  ) {}

  getOpenMenuLabel(): string | undefined {
    return this.openMenuLabel;
  }

  isAnyMenuOpen(): boolean {
    return Boolean(this.menuList || this.popupMenu);
  }

  bindMenuClicks(openMenu: (label: string) => void): void {
    for (const menu of this.menus) {
      const target = blessed.box({
        parent: this.menuBar,
        top: 0,
        left: menu.left,
        width: menu.label.length,
        height: 1,
        mouse: true,
        clickable: true,
        content: menu.label,
        style: {
          ...theme().menuBar,
          hover: theme().selected
        }
      });
      target.on("click", () => openMenu(menu.label));
      this.menuTargets.push(target);
    }
  }

  /** Restyle menu bar targets and any open menus to match current theme. */
  restyle(): void {
    for (const target of this.menuTargets) {
      target.style = { ...theme().menuBar, hover: theme().selected };
    }
  }

  openMenu(label: string): void {
    this.closeMenus();
    const menu = this.menus.find((entry) => entry.label === label);
    if (!menu) {
      return;
    }
    this.menuList = blessed.list({
      parent: this.screen,
      top: 1,
      left: menu.left,
      width: Math.max(...menu.items.map((item) => item.label.length)) + 4,
      height: menu.items.length + 2,
      border: "line",
      keys: true,
      vi: true,
      mouse: true,
      style: {
        ...theme().body,
        border: theme().windowBorderFocused,
        selected: theme().selected
      },
      items: menu.items.map((item) => item.label)
    });
    this.openMenuLabel = label;
    this.menuList.focus();
    this.menuList.select(0);
    this.menuList.on("select", (_, index) => {
      this.closeMenu();
      menu.items[index].action();
    });
    this.onChange();
    this.screen.render();
  }

  closeMenu(): void {
    if (!this.menuList) {
      return;
    }
    this.menuList.destroy();
    this.menuList = undefined;
    this.openMenuLabel = undefined;
    this.restoreWindowFocus();
    this.onChange();
    this.screen.render();
  }

  closePopupMenu(): void {
    if (!this.popupMenu) {
      return;
    }
    this.popupMenu.destroy();
    this.popupMenu = undefined;
    this.restoreWindowFocus();
    this.screen.render();
  }

  closeMenus(): void {
    this.closeMenu();
    this.closePopupMenu();
  }

  openPopupMenu(items: MenuItem[], x?: number, y?: number): void {
    this.closeMenus();
    if (items.length === 0) {
      return;
    }
    const width = Math.max(...items.map((item) => item.label.length)) + 4;
    const left = Math.max(0, Math.min((x ?? 2) - 1, Math.max(0, Number(this.screen.width) - width - 1)));
    const top = Math.max(1, Math.min(y ?? 2, Math.max(1, Number(this.screen.height) - items.length - 3)));
    this.popupMenu = blessed.list({
      parent: this.screen,
      top,
      left,
      width,
      height: items.length + 2,
      border: "line",
      keys: true,
      vi: true,
      mouse: true,
      style: {
        ...theme().body,
        border: theme().windowBorderFocused,
        selected: theme().selected
      },
      items: items.map((item) => item.label)
    });
    this.popupMenu.focus();
    this.popupMenu.select(0);
    this.popupMenu.on("select", (_, index) => {
      const item = items[index];
      this.closePopupMenu();
      item?.action();
    });
    this.popupMenu.on("keypress", (_, key) => {
      if (key.name === "escape") {
        this.closePopupMenu();
      }
    });
    this.screen.render();
  }
}
