import blessed from "blessed";

import type { Box, Textbox } from "./types.js";

export class OverlayManager {
  private readonly notification: Box;

  constructor(
    private readonly screen: blessed.Widgets.Screen,
    private readonly restoreWindowFocus: () => void
  ) {
    this.notification = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "shrink",
      height: "shrink",
      border: "line",
      padding: { left: 1, right: 1 },
      hidden: true,
      style: {
        fg: "white",
        bg: "black",
        border: {
          fg: "yellow"
        }
      }
    });
  }

  flash(message: string): void {
    this.notification.setContent(` ${message} `);
    this.notification.show();
    this.screen.render();
    setTimeout(() => {
      this.notification.hide();
      this.screen.render();
    }, 2200);
  }

  openValuePrompt(label: string, initialValue: string, onSubmit: (value: string) => void): void {
    const modal = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "70%",
      height: 7,
      border: "line",
      label: ` ${label} `,
      mouse: true,
      keys: true,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "cyan" }
      }
    });
    const input: Textbox = blessed.textbox({
      parent: modal,
      top: 1,
      left: 1,
      right: 1,
      height: 1,
      inputOnFocus: true,
      mouse: true,
      keys: true,
      style: {
        fg: "white",
        bg: "blue"
      }
    });

    const closePrompt = () => {
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    input.setValue(initialValue);
    input.on("submit", (value) => {
      closePrompt();
      const nextValue = (value ?? "").trim();
      if (nextValue) {
        onSubmit(nextValue);
      }
    });
    input.on("keypress", (_, key) => {
      if (key.name === "escape") {
        closePrompt();
      }
    });

    this.screen.render();
    input.focus();
    input.readInput();
  }

  openPathPrompt(
    label: string,
    initialValue: string,
    completePath: (value: string) => string,
    onSubmit: (value: string) => void
  ): void {
    const modal = blessed.box({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "80%",
      height: 7,
      border: "line",
      label: ` ${label} `,
      tags: true,
      mouse: true,
      keys: true,
      style: {
        fg: "white",
        bg: "black",
        border: { fg: "cyan" }
      }
    });
    const input: Textbox = blessed.textbox({
      parent: modal,
      top: 1,
      left: 1,
      right: 1,
      height: 1,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      style: {
        fg: "white",
        bg: "blue"
      }
    });
    blessed.box({
      parent: modal,
      bottom: 1,
      left: 1,
      right: 1,
      height: 1,
      content: " Enter open/save  Tab complete  Esc cancel ",
      style: {
        fg: "black",
        bg: "white"
      }
    });

    const closePrompt = () => {
      input.removeAllListeners("submit");
      input.removeAllListeners("cancel");
      input.removeAllListeners("keypress");
      modal.destroy();
      this.restoreWindowFocus();
      this.screen.render();
    };

    input.setValue(initialValue);
    input.key(["tab"], () => {
      const currentValue = input.getValue();
      const completedValue = completePath(currentValue);
      if (completedValue !== currentValue) {
        input.setValue(completedValue);
        this.screen.render();
      }
    });
    input.on("submit", (value) => {
      const nextValue = (value ?? "").trim();
      closePrompt();
      if (nextValue) {
        onSubmit(nextValue);
      }
    });
    input.on("cancel", closePrompt);
    input.on("keypress", (_, key) => {
      if (key.name === "escape") {
        closePrompt();
      }
    });

    this.screen.render();
    input.focus();
    input.readInput();
  }
}
