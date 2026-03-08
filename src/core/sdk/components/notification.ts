/**
 * Notification — ephemeral message toast.
 * Wib mode: slide-in from edge, bounce settle.
 * Wob mode: static bar, auto-dismiss.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface NotificationProps {
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
  onDismiss?: () => void;
}

export function createNotification(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<NotificationProps>,
): UiPart<Partial<NotificationProps>> {
  let props: NotificationProps = {
    message: initial?.message ?? "",
    type: initial?.type ?? "info",
    duration: initial?.duration ?? 3000,
    onDismiss: initial?.onDismiss,
  };

  const node = blessed.box({
    parent,
    clickable: true,
    mouse: true,
  });

  let timer: ReturnType<typeof setTimeout> | null = null;

  function startTimer() {
    if (timer) clearTimeout(timer);
    if (props.duration && props.duration > 0) {
      timer = setTimeout(() => {
        node.hide();
        if (props.onDismiss) props.onDismiss();
      }, props.duration);
    }
  }

  node.on("click", () => {
    if (timer) clearTimeout(timer);
    node.hide();
    if (props.onDismiss) props.onDismiss();
  });

  const TYPE_ICONS: Record<string, string> = {
    info: "ℹ",
    success: "✓",
    warning: "⚠",
    error: "✗",
  };

  function render() {
    const t = theme();
    const icon = TYPE_ICONS[props.type ?? "info"] ?? "·";
    node.setContent(` ${icon} ${props.message} `);
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
    node.show();
    startTimer();
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.message !== undefined) props.message = next.message;
      if (next.type !== undefined) props.type = next.type;
      if (next.duration !== undefined) props.duration = next.duration;
      if (next.onDismiss !== undefined) props.onDismiss = next.onDismiss;
      render();
    },
    restyle() { render(); },
    destroy() {
      if (timer) clearTimeout(timer);
      node.destroy();
    },
  };
}
