import blessed from "blessed";

import { theme } from "./theme/resolver.js";
import type { Box, List, MenuConfig, MenuItem } from "./types.js";

export class MenuOverlayManager {
  private menuList?: List;
  private popupMenu?: List;
  private menuShadow?: Box;
  private popupShadow?: Box;
  private openMenuLabel?: string;
  private menuTargets: Box[] = [];

  constructor(
    private readonly screen: blessed.Widgets.Screen,
    private readonly menuBar: Box,
    private readonly menus: MenuConfig[],
    private readonly restoreWindowFocus: () => void,
    private readonly onChange: () => void,
    private readonly getFocusedAppType: () => string | undefined
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
    if (this.menuList) {
      this.menuList.style = {
        ...theme().body,
        border: theme().windowBorderFocused,
        selected: theme().selected
      };
      this.syncShadow(this.menuList, this.menuShadow);
    }
    if (this.popupMenu) {
      this.popupMenu.style = {
        ...theme().body,
        border: theme().windowBorderFocused,
        selected: theme().selected
      };
      this.syncShadow(this.popupMenu, this.popupShadow);
    }
  }

  openMenu(label: string): void {
    this.closeMenus();
    const menu = this.menus.find((entry) => entry.label === label);
    if (!menu) {
      return;
    }
    const focusedAppType = this.getFocusedAppType();
    const visibleItems = menu.items.filter(
      (item) =>
        !item.appTypes || (!!focusedAppType && item.appTypes.includes(focusedAppType)),
    );
    const width = Math.max(...visibleItems.map((item) => item.label.length)) + 4;
    const height = visibleItems.length + 2;
    this.menuShadow = this.createShadow(menu.left, 1, width, height);
    this.menuList = blessed.list({
      parent: this.screen,
      top: 1,
      left: menu.left,
      width,
      height,
      border: "line",
      keys: true,
      vi: true,
      mouse: true,
      style: {
        ...theme().body,
        border: theme().windowBorderFocused,
        selected: theme().selected
      },
      items: visibleItems.map((item) => item.label)
    });
    this.menuList.setFront();
    this.openMenuLabel = label;
    this.menuList.focus();
    this.menuList.select(0);
    this.menuList.on("select", (_, index) => {
      this.closeMenu();
      visibleItems[index].action();
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
    this.destroyShadow(this.menuShadow);
    this.menuShadow = undefined;
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
    this.destroyShadow(this.popupShadow);
    this.popupShadow = undefined;
    this.restoreWindowFocus();
    this.screen.render();
  }

  closeMenus(): void {
    this.closeMenu();
    this.closePopupMenu();
  }

  private createShadow(left: number, top: number, width: number, height: number): Box {
    const sh = theme().windowShadow;
    const shadow = blessed.box({
      parent: this.screen,
      top: top + 1,
      left: left + 2,
      width,
      height,
      tags: false,
      style: {
        fg: sh.fg,
        bg: sh.bg
      },
      content: Array.from({ length: height }, () => sh.char.repeat(width)).join("\n")
    });
    return shadow;
  }

  private syncShadow(list: List, shadow?: Box): void {
    if (!shadow) return;
    const left = Number(list.left);
    const top = Number(list.top);
    const width = Number(list.width);
    const height = Number(list.height);
    const sh = theme().windowShadow;
    shadow.left = left + 2;
    shadow.top = top + 1;
    shadow.width = width;
    shadow.height = height;
    shadow.style = { fg: sh.fg, bg: sh.bg };
    shadow.setContent(Array.from({ length: height }, () => sh.char.repeat(width)).join("\n"));
  }

  private destroyShadow(shadow?: Box): void {
    shadow?.destroy();
  }

  openPopupMenu(items: MenuItem[], x?: number, y?: number): void {
    this.closeMenus();
    if (items.length === 0) {
      return;
    }
    const width = Math.max(...items.map((item) => item.label.length)) + 4;
    const left = Math.max(0, Math.min((x ?? 2) - 1, Math.max(0, Number(this.screen.width) - width - 1)));
    const top = Math.max(1, Math.min(y ?? 2, Math.max(1, Number(this.screen.height) - items.length - 3)));
    const height = items.length + 2;
    this.popupShadow = this.createShadow(left, top, width, height);
    this.popupMenu = blessed.list({
      parent: this.screen,
      top,
      left,
      width,
      height,
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
    this.popupMenu.setFront();
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
