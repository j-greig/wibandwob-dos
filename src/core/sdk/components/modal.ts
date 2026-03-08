/**
 * Modal — centered overlay dialog.
 * Wib mode: fade-in with border sparkle.
 * Wob mode: sharp box with shadow.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface ModalButton {
  label: string;
  action: () => void;
}

export interface ModalProps {
  title?: string;
  content: string;
  onClose?: () => void;
  buttons?: ModalButton[];
}

export function createModal(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<ModalProps>,
): UiPart<Partial<ModalProps>> {
  let props: ModalProps = {
    title: initial?.title,
    content: initial?.content ?? "",
    onClose: initial?.onClose,
    buttons: initial?.buttons,
  };

  const node = blessed.box({
    parent,
    border: { type: "line" },
    mouse: true,
    keys: true,
  });

  node.key(["escape", "q"], () => {
    if (props.onClose) props.onClose();
  });

  function render() {
    const t = theme();
    const lines: string[] = [];
    if (props.title) lines.push(props.title, "─".repeat(20), "");
    lines.push(props.content);
    if (props.buttons?.length) {
      lines.push("");
      lines.push(props.buttons.map(b => `[ ${b.label} ]`).join("  "));
    }
    node.setContent(lines.join("\n"));
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
    node.style.border = { fg: t.muted.fg };
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.title !== undefined) props.title = next.title;
      if (next.content !== undefined) props.content = next.content;
      if (next.onClose !== undefined) props.onClose = next.onClose;
      if (next.buttons !== undefined) props.buttons = next.buttons;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
