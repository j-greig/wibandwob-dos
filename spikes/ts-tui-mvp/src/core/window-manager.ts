import blessed from "blessed";

import type { Box, DragState, ResizeState, WindowKind, WindowRecord } from "./types.js";

export class WindowManager {
  private readonly windows: WindowRecord[] = [];
  private focusedWindow?: WindowRecord;
  private nextWindowId = 1;
  private dragState?: DragState;
  private resizeState?: ResizeState;

  constructor(
    private readonly screen: blessed.Widgets.Screen,
    private readonly desktop: Box,
    private readonly onChange?: () => void
  ) {}

  getFocusedWindow(): WindowRecord | undefined {
    return this.focusedWindow;
  }

  getWindows(): WindowRecord[] {
    return [...this.windows];
  }

  restoreWindowFocus(): void {
    this.focusedWindow?.focus();
  }

  getWindowById(id: number): WindowRecord | undefined {
    return this.windows.find((window) => window.id === id);
  }

  createFrame(title: string, kind: WindowKind): WindowRecord {
    const offset = this.windows.length * 2;
    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frame = blessed.box({
      parent: this.desktop,
      top: 1 + offset,
      left: 2 + offset,
      width: Math.min(screenWidth - 6, 72),
      height: Math.min(screenHeight - 6, 20),
      border: "line",
      tags: true,
      mouse: true,
      shadow: true,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "white" }
      }
    });
    const titleBar = blessed.box({
      parent: frame,
      top: 0,
      left: 2,
      right: 2,
      height: 1,
      tags: true,
      content: ` ${title} `,
      style: {
        fg: "black",
        bg: "white"
      }
    });
    const body = blessed.box({
      parent: frame,
      top: 1,
      left: 1,
      right: 1,
      bottom: 1,
      style: {
        fg: "white",
        bg: "black"
      }
    });
    const closeHint = blessed.box({
      parent: frame,
      top: 0,
      right: 1,
      width: 3,
      height: 1,
      mouse: true,
      clickable: true,
      content: " x ",
      style: {
        fg: "white",
        bg: "red"
      }
    });
    const resizeGrip = blessed.box({
      parent: frame,
      bottom: 0,
      right: 1,
      width: 2,
      height: 1,
      mouse: true,
      clickable: true,
      content: "+>",
      style: {
        fg: "yellow",
        bg: "black"
      }
    });

    const record: WindowRecord = {
      id: this.nextWindowId++,
      kind,
      title,
      frame,
      body,
      titleBar,
      close: () => {
        record.cleanup?.();
        frame.destroy();
        const index = this.windows.findIndex((window) => window.id === record.id);
        if (index >= 0) {
          this.windows.splice(index, 1);
        }
        if (this.focusedWindow?.id === record.id) {
          this.focusedWindow = undefined;
          this.focusNextWindow(-1);
        }
        this.onChange?.();
        this.screen.render();
      },
      focus: () => {
        this.focusWindow(record);
        body.focus();
      }
    };

    closeHint.on("click", () => record.close());
    frame.on("click", () => this.focusWindow(record));
    frame.on("mousedown", () => this.focusWindow(record));
    titleBar.on("click", () => this.focusWindow(record));
    titleBar.on("mousedown", (data) => {
      this.focusWindow(record);
      this.startDrag(record, data);
    });
    resizeGrip.on("mousedown", (data) => {
      this.focusWindow(record);
      this.startResize(record, data);
    });

    return record;
  }

  registerWindow(record: WindowRecord): void {
    this.windows.push(record);
    this.onChange?.();
    this.focusWindow(record);
  }

  focusWindow(record: WindowRecord): void {
    const index = this.windows.findIndex((window) => window.id === record.id);
    if (index >= 0) {
      const [active] = this.windows.splice(index, 1);
      this.windows.push(active);
    }
    this.focusedWindow = record;
    record.frame.setFront();
    for (const window of this.windows) {
      const active = window.id === record.id;
      window.frame.style.border = { fg: active ? "cyan" : "white" };
    }
    this.onChange?.();
    this.screen.render();
  }

  focusNextWindow(direction: 1 | -1): void {
    if (this.windows.length === 0) {
      return;
    }
    const currentIndex = this.focusedWindow
      ? this.windows.findIndex((window) => window.id === this.focusedWindow?.id)
      : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + this.windows.length) % this.windows.length;
    this.windows[nextIndex].focus();
  }

  closeFocusedWindow(): void {
    this.focusedWindow?.close();
  }

  moveWindow(id: number, left: number, top: number): boolean {
    const record = this.getWindowById(id);
    if (!record) {
      return false;
    }
    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frameWidth = Number(record.frame.width);
    const frameHeight = Number(record.frame.height);
    record.frame.left = this.clamp(left, 0, Math.max(0, screenWidth - frameWidth));
    record.frame.top = this.clamp(top, 1, Math.max(1, screenHeight - 2 - frameHeight));
    this.onChange?.();
    this.screen.render();
    return true;
  }

  resizeWindow(id: number, width: number, height: number): boolean {
    const record = this.getWindowById(id);
    if (!record) {
      return false;
    }
    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const maxWidth = Math.max(24, screenWidth - Number(record.frame.left));
    const maxHeight = Math.max(8, screenHeight - 1 - Number(record.frame.top));
    record.frame.width = this.clamp(width, 24, maxWidth);
    record.frame.height = this.clamp(height, 8, maxHeight);
    this.onChange?.();
    this.screen.render();
    return true;
  }

  focusWindowById(id: number): boolean {
    const record = this.getWindowById(id);
    if (!record) {
      return false;
    }
    record.focus();
    return true;
  }

  closeWindowById(id: number): boolean {
    const record = this.getWindowById(id);
    if (!record) {
      return false;
    }
    record.close();
    return true;
  }

  handleMouse(data: blessed.Widgets.Events.IMouseEventArg): void {
    if (this.dragState) {
      this.handleDragMouse(data);
      return;
    }
    if (this.resizeState) {
      this.handleResizeMouse(data);
    }
  }

  tileWindows(): void {
    if (this.windows.length === 0) {
      return;
    }
    const desktopWidth = Math.max(40, Number(this.screen.width));
    const desktopHeight = Math.max(12, Number(this.screen.height) - 2);
    const columns = Math.max(1, Math.ceil(Math.sqrt(this.windows.length)));
    const rows = Math.max(1, Math.ceil(this.windows.length / columns));
    const cellWidth = Math.max(24, Math.floor(desktopWidth / columns));
    const cellHeight = Math.max(8, Math.floor(desktopHeight / rows));

    for (const [index, window] of this.windows.entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const left = column * cellWidth;
      const top = 1 + row * cellHeight;
      const width = column === columns - 1 ? desktopWidth - left : cellWidth;
      const height = row === rows - 1 ? desktopHeight - row * cellHeight : cellHeight;
      window.frame.left = Math.max(0, left);
      window.frame.top = Math.max(1, top);
      window.frame.width = Math.max(24, width);
      window.frame.height = Math.max(8, height);
    }

    this.onChange?.();
    this.screen.render();
  }

  cascadeWindows(): void {
    const desktopWidth = Math.max(40, Number(this.screen.width));
    const desktopHeight = Math.max(12, Number(this.screen.height) - 2);
    const width = Math.min(desktopWidth - 4, 72);
    const height = Math.min(desktopHeight - 2, 20);
    for (const [index, window] of this.windows.entries()) {
      const offset = index * 2;
      window.frame.left = this.clamp(offset, 0, Math.max(0, desktopWidth - width));
      window.frame.top = this.clamp(1 + offset, 1, Math.max(1, desktopHeight - height));
      window.frame.width = width;
      window.frame.height = height;
    }
    this.onChange?.();
    this.screen.render();
  }

  private handleDragMouse(data: blessed.Widgets.Events.IMouseEventArg): void {
    const dragState = this.dragState;
    if (!dragState) {
      return;
    }
    if (data.action === "mouseup") {
      this.dragState = undefined;
      return;
    }
    if (data.action !== "mousemove" && data.action !== "mousedown") {
      return;
    }
    const record = this.windows.find((window) => window.id === dragState.windowId);
    if (!record) {
      this.dragState = undefined;
      return;
    }

    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frameWidth = Number(record.frame.width);
    const frameHeight = Number(record.frame.height);
    const nextLeft = this.clamp(data.x - dragState.offsetX, 0, Math.max(0, screenWidth - frameWidth));
    const nextTop = this.clamp(
      data.y - dragState.offsetY,
      1,
      Math.max(1, screenHeight - 2 - frameHeight)
    );

    record.frame.left = nextLeft;
    record.frame.top = nextTop;
    this.onChange?.();
    this.screen.render();
  }

  private handleResizeMouse(data: blessed.Widgets.Events.IMouseEventArg): void {
    const resizeState = this.resizeState;
    if (!resizeState) {
      return;
    }
    if (data.action === "mouseup") {
      this.resizeState = undefined;
      return;
    }
    if (data.action !== "mousemove" && data.action !== "mousedown") {
      return;
    }
    const record = this.windows.find((window) => window.id === resizeState.windowId);
    if (!record) {
      this.resizeState = undefined;
      return;
    }

    const desktopWidth = Number(this.screen.width);
    const desktopHeight = Number(this.screen.height) - 2;
    const deltaX = data.x - resizeState.startX;
    const deltaY = data.y - resizeState.startY;
    const maxWidth = Math.max(24, desktopWidth - resizeState.originLeft);
    const maxHeight = Math.max(8, desktopHeight - resizeState.originTop);

    record.frame.width = this.clamp(resizeState.originWidth + deltaX, 24, maxWidth);
    record.frame.height = this.clamp(resizeState.originHeight + deltaY, 8, maxHeight);
    this.onChange?.();
    this.screen.render();
  }

  private startDrag(record: WindowRecord, data: blessed.Widgets.Events.IMouseEventArg): void {
    const coords = record.frame.lpos;
    if (!coords) {
      return;
    }
    this.dragState = {
      windowId: record.id,
      offsetX: data.x - coords.xi,
      offsetY: data.y - coords.yi
    };
  }

  private startResize(record: WindowRecord, data: blessed.Widgets.Events.IMouseEventArg): void {
    this.resizeState = {
      windowId: record.id,
      originLeft: Number(record.frame.left),
      originTop: Number(record.frame.top),
      originWidth: Number(record.frame.width),
      originHeight: Number(record.frame.height),
      startX: data.x,
      startY: data.y
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
