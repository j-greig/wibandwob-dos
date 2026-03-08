import blessed from "blessed";

import type { WindowFacade } from "./window-facade.js";
import { theme } from "./theme/resolver.js";
import { safeSetStyle } from "./ui-primitives.js";
import type { Box, DragState, ResizeState, WindowKind, WindowRecord } from "./types.js";

/** Called when an editor window receives input text. Return true if handled. */
export type EditorWriteHook = (id: number, text: string) => boolean;
/** Called when an editor window saves. Returns the resolved file path after save. */
export type EditorSaveHook = (id: number, filePath: string) => string;

/** Manages live window records, z-order stack, focus, drag/resize, and layout. Implements WindowFacade. */
export class WindowManager implements WindowFacade {
  private readonly windows: WindowRecord[] = [];
  private focusedWindow?: WindowRecord;
  private nextWindowId = 1;
  private dragState?: DragState;
  private resizeState?: ResizeState;
  private suppressClickWindowId?: number;
  private suppressClickUntil = 0;
  private lastTitleClickTime = 0;
  private lastTitleClickWindowId = -1;
  private editorWriteHook?: EditorWriteHook;

  constructor(
    private readonly screen: blessed.Widgets.Screen,
    private readonly desktop: Box,
    private readonly onChange?: () => void,
    private readonly onWindowContextMenu?: (window: WindowRecord, x?: number, y?: number) => void
  ) {}

  /** Set the editor write hook. Called by AppController after construction. */
  setEditorWriteHook(hook: EditorWriteHook): void {
    this.editorWriteHook = hook;
  }

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

  getLastWindow(): WindowRecord | undefined {
    return this.windows.at(-1);
  }

  getWindowAtPosition(x?: number, y?: number): WindowRecord | undefined {
    if (typeof x !== "number" || typeof y !== "number") {
      return undefined;
    }
    return [...this.windows]
      .reverse()
      .find((window) => {
        const left = Number(window.frame.left);
        const top = Number(window.frame.top);
        const width = Number(window.frame.width);
        const height = Number(window.frame.height);
        return x >= left && x < left + width && y >= top && y < top + height;
      });
  }

  /** Create canonical window chrome (frame, shadow, titlebar, body) and base WindowRecord with event wiring. */
  createFrame(title: string, kind: WindowKind): WindowRecord {
    const offset = this.windows.length * 2;
    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frameWidth = Math.min(screenWidth - 6, 72);
    const frameHeight = Math.min(screenHeight - 6, 20);
    const sh = theme().windowShadow;
    const shadow = blessed.box({
      parent: this.desktop,
      top: offset + 1,
      left: 2 + offset + 2,
      width: frameWidth,
      height: frameHeight,
      content: Array.from({ length: frameHeight }, () => sh.char.repeat(frameWidth)).join("\n"),
      style: { fg: sh.fg, bg: sh.bg },
    });
    const frame = blessed.box({
      parent: this.desktop,
      top: offset,
      left: 2 + offset,
      width: frameWidth,
      height: frameHeight,
      border: "line",
      tags: true,
      mouse: true,
      style: {
        ...theme().windowFrame,
        border: theme().windowBorderUnfocused
      }
    });
    const titleBar = blessed.box({
      parent: frame,
      top: 0,
      left: 2,
      right: 4,
      height: 1,
      tags: true,
      content: ` ${title} `,
      style: theme().titleBarUnfocused
    });
    const body = blessed.box({
      parent: frame,
      top: 1,
      left: 2,
      right: 2,
      bottom: 1,
      style: theme().body
    });
    const closeHint = blessed.box({
      parent: frame,
      top: 0,
      right: 2,
      width: 3,
      height: 1,
      mouse: true,
      clickable: true,
      content: " x ",
      style: theme().closeButton
    });
    const resizeGrip = blessed.box({
      parent: frame,
      bottom: 0,
      right: 0,
      width: 2,
      height: 1,
      mouse: true,
      clickable: true,
      content: " +",
      style: theme().resizeGrip
    });

    const record: WindowRecord = {
      id: this.nextWindowId++,
      kind,
      title,
      frame,
      body,
      titleBar,
      closeHint,
      resizeGrip,
      shadow,
      close: () => {
        record.cleanup?.();
        shadow.destroy();
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
        this.focusWindowInternal(record);
        body.focus();
      },
      openContextMenu: (x, y) => this.onWindowContextMenu?.(record, x, y)
    };

    closeHint.on("click", () => {
      if (this.shouldSuppressClick(record)) {
        return;
      }
      record.close();
    });
    frame.on("click", () => {
      if (this.shouldSuppressClick(record)) {
        return;
      }
      this.focusWindowInternal(record);
    });
    frame.on("mousedown", (data) => {
      this.focusWindowInternal(record);
      if (this.isRightClick(data)) {
        record.openContextMenu?.(data.x, data.y);
      }
    });
    titleBar.on("click", () => {
      if (this.shouldSuppressClick(record)) {
        return;
      }
      this.focusWindowInternal(record);

      const now = Date.now();
      if (this.lastTitleClickWindowId === record.id && now - this.lastTitleClickTime < 400) {
        this.toggleMaximize(record);
        this.lastTitleClickTime = 0;
        this.lastTitleClickWindowId = -1;
      } else {
        this.lastTitleClickTime = now;
        this.lastTitleClickWindowId = record.id;
      }
    });
    titleBar.on("mousedown", (data) => {
      this.focusWindowInternal(record);
      if (this.isRightClick(data)) {
        record.openContextMenu?.(data.x, data.y);
        return;
      }
      this.startDrag(record, data);
    });
    body.on("mousedown", (data) => {
      this.focusWindowInternal(record);
      if (this.isRightClick(data)) {
        record.openContextMenu?.(data.x, data.y);
      }
    });
    resizeGrip.on("mousedown", (data) => {
      this.focusWindowInternal(record);
      if (this.isRightClick(data)) {
        record.openContextMenu?.(data.x, data.y);
        return;
      }
      this.startResize(record, data);
    });

    return record;
  }

  /** Insert a fully wired record into the managed stack, sync shadow/z-order, and focus it. */
  registerWindow(record: WindowRecord): void {
    if (!record.describeState) {
      // Contract: every registered user-visible window should expose semantic state.
      // This warning catches drift early. Target: make describeState mandatory.
      console.warn(`[window-manager] Window "${record.title}" (kind=${record.kind}) registered without describeState`);
    }
    this.windows.push(record);
    this.syncShadow(record);
    this.onChange?.();
    this.focusWindowInternal(record);
  }

  /** Internal: focus a window by record reference. Used by click/register/drag handlers. */
  focusWindowInternal(record: WindowRecord): void {
    const index = this.windows.findIndex((window) => window.id === record.id);
    if (index >= 0) {
      const [active] = this.windows.splice(index, 1);
      this.windows.push(active);
    }
    this.focusedWindow = record;
    this.syncZOrder();
    for (const window of this.windows) {
      const active = window.id === record.id;
      window.frame.style.border = active ? theme().windowBorderFocused : theme().windowBorderUnfocused;
      if (window.titleBar) {
        window.titleBar.style = active ? theme().titleBarFocused : theme().titleBarUnfocused;
      }
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

  resizeFocusedWindow(deltaWidth: number, deltaHeight: number): boolean {
    const record = this.focusedWindow;
    if (!record) {
      return false;
    }
    return this.resizeWindow(
      record.id,
      Number(record.frame.width) + deltaWidth,
      Number(record.frame.height) + deltaHeight
    );
  }

  /** Move a window to absolute coordinates. Clears maximize state, clamps to desktop bounds. */
  moveWindow(id: number, left: number, top: number): boolean {
    const record = this.getWindowById(id);
    if (!record) {
      return false;
    }
    this.clearMaximize(record);
    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const frameWidth = Number(record.frame.width);
    const frameHeight = Number(record.frame.height);
    record.frame.left = this.clamp(left, 0, Math.max(0, screenWidth - frameWidth));
    record.frame.top = this.clamp(top, 0, Math.max(0, screenHeight - 2 - frameHeight));
    this.syncShadow(record);
    this.onChange?.();
    this.screen.render();
    return true;
  }

  /** Resize a window. Clears maximize state, enforces minimum size. */
  resizeWindow(id: number, width: number, height: number): boolean {
    const record = this.getWindowById(id);
    if (!record) {
      return false;
    }
    this.clearMaximize(record);
    const screenWidth = Number(this.screen.width);
    const screenHeight = Number(this.screen.height);
    const maxWidth = Math.max(24, screenWidth - Number(record.frame.left));
    const maxHeight = Math.max(8, screenHeight - 2 - Number(record.frame.top));
    record.frame.width = this.clamp(width, 24, maxWidth);
    record.frame.height = this.clamp(height, 8, maxHeight);
    this.syncShadow(record);
    record.refresh?.();
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

  // -- WindowFacade aliases --

  /** Focus a window by id (WindowFacade contract) or by record (internal use). */
  focusWindow(idOrRecord: number | WindowRecord): boolean {
    if (typeof idOrRecord === "number") {
      return this.focusWindowById(idOrRecord);
    }
    this.focusWindowInternal(idOrRecord);
    return true;
  }

  /** WindowFacade: closeWindow by id */
  closeWindow(id: number): boolean {
    return this.closeWindowById(id);
  }

  /** WindowFacade: send input to a window */
  sendInput(id: number, input: string, sender?: string): boolean {
    const record = this.getWindowById(id);
    if (!record?.writeInput) return false;
    record.writeInput(input, sender);
    return true;
  }

  /** WindowFacade: write text to an editor window (with dirty marking) */
  writeEditorText(id: number, text: string): boolean {
    if (this.editorWriteHook) {
      return this.editorWriteHook(id, text);
    }
    // No hook set — refuse rather than silently bypass dirty marking
    return false;
  }

  /** WindowFacade: capture raw text from a window */
  captureText(id: number): string | undefined {
    const record = this.getWindowById(id);
    return record?.captureText?.();
  }

  /** Restyle all open windows to match the current theme tokens. */
  restyleAll(): void {
    for (const window of this.windows) {
      const active = this.focusedWindow?.id === window.id;
      window.frame.style = { ...theme().windowFrame, border: active ? theme().windowBorderFocused : theme().windowBorderUnfocused };
      if (window.titleBar) {
        window.titleBar.style = active ? theme().titleBarFocused : theme().titleBarUnfocused;
      }
      if (window.closeHint) {
        window.closeHint.style = theme().closeButton;
      }
      if (window.resizeGrip) {
        window.resizeGrip.style = theme().resizeGrip;
      }
      safeSetStyle(window.body, theme().body);
      if (window.shadow) {
        const sh = theme().windowShadow;
        window.shadow.style = { fg: sh.fg, bg: sh.bg };
      }
      window.onRestyle?.();
    }
    this.screen.render();
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

  /** Arrange all windows in a grid tile layout. Columns = ceil(sqrt(count)). */
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
      this.clearMaximize(window);
      const column = index % columns;
      const row = Math.floor(index / columns);
      const left = column * cellWidth;
      const top = row * cellHeight;
      const width = column === columns - 1 ? desktopWidth - left : cellWidth;
      const height = row === rows - 1 ? desktopHeight - row * cellHeight : cellHeight;
      window.frame.left = Math.max(0, left);
      window.frame.top = Math.max(0, top);
      window.frame.width = Math.max(24, width);
      window.frame.height = Math.max(8, height);
      this.syncShadow(window);
    }

    this.onChange?.();
    this.screen.render();
  }

  /** Arrange all windows in a diagonal cascade with uniform size and 2-cell offset. */
  cascadeWindows(): void {
    const desktopWidth = Math.max(40, Number(this.screen.width));
    const desktopHeight = Math.max(12, Number(this.screen.height) - 2);
    const width = Math.min(desktopWidth - 4, 72);
    const height = Math.min(desktopHeight - 2, 20);
    for (const [index, window] of this.windows.entries()) {
      this.clearMaximize(window);
      const offset = index * 2;
      window.frame.left = this.clamp(1 + offset, 1, Math.max(1, desktopWidth - width));
      window.frame.top = this.clamp(offset, 0, Math.max(0, desktopHeight - height));
      window.frame.width = width;
      window.frame.height = height;
      this.syncShadow(window);
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
      if (dragState.moved) {
        this.suppressClickWindowId = dragState.windowId;
        this.suppressClickUntil = Date.now() + 150;
      }
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
    const nextLeft = this.clamp(
      dragState.originLeft + (data.x - dragState.startX),
      0,
      Math.max(0, screenWidth - frameWidth)
    );
    const nextTop = this.clamp(
      dragState.originTop + (data.y - dragState.startY),
      0,
      Math.max(0, screenHeight - 2 - frameHeight)
    );

    record.frame.left = nextLeft;
    record.frame.top = nextTop;
    this.syncShadow(record);
    if (nextLeft !== dragState.originLeft || nextTop !== dragState.originTop) {
      dragState.moved = true;
    }
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
    this.syncShadow(record);
    record.refresh?.();
    this.onChange?.();
    this.screen.render();
  }

  private startDrag(record: WindowRecord, data: blessed.Widgets.Events.IMouseEventArg): void {
    this.dragState = {
      windowId: record.id,
      originLeft: Number(record.frame.left),
      originTop: Number(record.frame.top),
      startX: data.x,
      startY: data.y,
      moved: false
    };
  }

  private syncZOrder(): void {
    for (const window of this.windows) {
      window.shadow?.setFront();
      window.frame.setFront();
    }
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

  private syncShadow(record: WindowRecord): void {
    if (!record.shadow) return;
    const w = Number(record.frame.width);
    const h = Number(record.frame.height);
    record.shadow.left = Number(record.frame.left) + 2;
    record.shadow.top = Number(record.frame.top) + 1;
    record.shadow.width = w;
    record.shadow.height = h;
    // Rebuild shadow content to match current dimensions
    const sh = theme().windowShadow;
    record.shadow.setContent(Array.from({ length: h }, () => sh.char.repeat(w)).join("\n"));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private isRightClick(data?: blessed.Widgets.Events.IMouseEventArg): boolean {
    if (!data) {
      return false;
    }
    const mouseData = data as blessed.Widgets.Events.IMouseEventArg & { button?: string | number; buttons?: string | number };
    return mouseData.button === "right" || mouseData.button === 2 || mouseData.buttons === "right" || mouseData.buttons === 2;
  }

  /** WindowFacade: toggleMaximize by id */
  toggleMaximize(idOrRecord: number | WindowRecord): boolean {
    const record = typeof idOrRecord === "number"
      ? this.getWindowById(idOrRecord)
      : idOrRecord;
    if (!record) return false;
    this.toggleMaximizeInternal(record);
    return true;
  }

  /** Toggle maximize: save bounds before maximizing, restore and clamp on un-maximize. Hides shadow when maximized. */
  private toggleMaximizeInternal(record: WindowRecord): void {
    if (record.savedBounds) {
      // Restore — clamp to current desktop bounds
      const b = record.savedBounds;
      const sw = Number(this.desktop.width) || Number(this.screen.width);
      const sh = Number(this.desktop.height) || (Number(this.screen.height) - 2);
      record.frame.left = this.clamp(b.left, 0, Math.max(0, sw - b.width));
      record.frame.top = this.clamp(b.top, 0, Math.max(0, sh - b.height));
      record.frame.width = Math.min(b.width, sw);
      record.frame.height = Math.min(b.height, sh);
      record.savedBounds = undefined;
      if (record.shadow) record.shadow.show();
    } else {
      // Maximize
      const w = Number(this.screen.width);
      const h = Number(this.screen.height);
      record.savedBounds = {
        left: Number(record.frame.left),
        top: Number(record.frame.top),
        width: Number(record.frame.width),
        height: Number(record.frame.height),
      };
      const dw = Number(this.desktop.width) || w;
      const dh = Number(this.desktop.height) || (h - 2);
      record.frame.left = 0;
      record.frame.top = 0;
      record.frame.width = dw;
      record.frame.height = dh;
    }
    this.syncShadow(record);
    if (record.savedBounds && record.shadow) record.shadow.hide();
    record.refresh?.();
    this.onChange?.();
    this.screen.render();
  }

  /** Clear maximize state — call before any manual geometry mutation. */
  private clearMaximize(record: WindowRecord): void {
    if (record.savedBounds) {
      record.savedBounds = undefined;
      if (record.shadow) record.shadow.show();
    }
  }

  private shouldSuppressClick(record: WindowRecord): boolean {
    // Suppress clicks while actively dragging (blessed fires click before our mouseup handler)
    if (this.dragState?.windowId === record.id && this.dragState.moved) {
      return true;
    }
    // Post-drag one-shot suppression: consume and clear on first check
    if (this.suppressClickWindowId === record.id) {
      this.suppressClickWindowId = undefined;
      this.suppressClickUntil = 0;
      return true;
    }
    return false;
  }
}
