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
      target.on("click", () => {
        // If this menu is already open, close it (toggle). Otherwise open it.
        if (this.openMenuLabel === menu.label) {
          this.closeMenu();
        } else {
          openMenu(menu.label);
        }
      });
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
    const width =
      Math.max(
        ...visibleItems.filter((item) => !item.separator).map((item) => item.label.length),
        10,
      ) + 4;
    const height = visibleItems.length + 2;
    const separatorLabel = "─".repeat(Math.max(1, width - 4));
    const findNextSelectable = (startIndex: number, direction: 1 | -1, wrap: boolean): number => {
      if (visibleItems.length === 0) {
        return -1;
      }
      let candidate = startIndex;
      for (let steps = 0; steps < visibleItems.length; steps += 1) {
        if (wrap) {
          candidate = (candidate + visibleItems.length) % visibleItems.length;
        } else if (candidate < 0 || candidate >= visibleItems.length) {
          return -1;
        }
        if (!visibleItems[candidate]?.separator) {
          return candidate;
        }
        candidate += direction;
      }
      return -1;
    };
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
      items: visibleItems.map((item) => (item.separator ? separatorLabel : item.label))
    });
    this.menuList.setFront();
    this.openMenuLabel = label;
    this.menuList.focus();
    const initialIndex = findNextSelectable(0, 1, false);
    this.menuList.select(initialIndex >= 0 ? initialIndex : 0);
    this.menuList.on("select", (_, index) => {
      const selectedItem = visibleItems[index];
      if (!selectedItem) {
        return;
      }
      if (selectedItem.separator) {
        const nextSelectable = findNextSelectable(index + 1, 1, true);
        if (nextSelectable >= 0) {
          (this.menuList as any).select(nextSelectable);
          this.screen.render();
        }
        return;
      }
      this.closeMenu();
      selectedItem.action();
    });
    this.menuList.on("keypress", (_, key) => {
      if (key.name === "escape") {
        this.closeMenu();
        return;
      }
      if (key.name !== "up" && key.name !== "down" && key.name !== "k" && key.name !== "j") {
        return;
      }
      const direction: 1 | -1 = key.name === "up" || key.name === "k" ? -1 : 1;
      setTimeout(() => {
        if (!this.menuList) {
          return;
        }
        const idx = (this.menuList as any).selected as number;
        if (!visibleItems[idx]?.separator) {
          return;
        }
        const nextSelectable = findNextSelectable(idx + direction, direction, true);
        if (nextSelectable >= 0) {
          (this.menuList as any).select(nextSelectable);
          this.screen.render();
        }
      }, 0);
    });
    // Click anywhere outside the menu list closes it.
    // Capture this list instance so the timeout doesn't fire against a newer menu.
    const thisMenuList = this.menuList;
    thisMenuList.on("blur", () => {
      setTimeout(() => {
        // Only close if this is still the active menu list (not already replaced)
        if (this.menuList === thisMenuList) {
          this.closeMenu();
        }
      }, 80);
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
    const width =
      Math.max(
        ...items.filter((item) => !item.separator).map((item) => item.label.length),
        10,
      ) + 4;
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
      items: items.map((item) =>
        item.separator ? "─".repeat(Math.max(1, width - 4)) : item.label,
      )
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
