/**
 * TextInput — single-line text entry.
 * Wib mode: cursor blinks with rhythm.
 * Wob mode: static underscore cursor.
 */

import blessed from "blessed";
import type { Rect, UiPart } from "../../ui-parts.js";
import { applyRect } from "../../ui-parts.js";
import { theme } from "../../theme/resolver.js";

export interface TextInputProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  width?: number;
}

export function createTextInput(
  parent: blessed.Widgets.BoxElement,
  initial?: Partial<TextInputProps>,
): UiPart<Partial<TextInputProps>> {
  let props: TextInputProps = {
    value: initial?.value ?? "",
    onChange: initial?.onChange,
    placeholder: initial?.placeholder ?? "",
    width: initial?.width,
  };

  const node = blessed.box({
    parent,
    inputOnFocus: true,
    clickable: true,
    mouse: true,
    keys: true,
  });

  node.on("keypress", (_ch: string, key: { full: string; name: string }) => {
    if (key.name === "backspace") {
      props.value = props.value.slice(0, -1);
    } else if (key.name === "return" || key.name === "escape") {
      // submit or blur — no-op here, consumer handles
    } else if (key.full && key.full.length === 1) {
      props.value += key.full;
    }
    if (props.onChange) props.onChange(props.value);
    render();
  });

  function render() {
    const t = theme();
    const display = props.value || `{gray-fg}${props.placeholder}{/gray-fg}`;
    node.setContent(`${display}_`);
    node.style.fg = t.body.fg;
    node.style.bg = t.body.bg;
  }

  render();

  return {
    node,
    layout(rect: Rect) { applyRect(node, rect); },
    update(next) {
      if (next.value !== undefined) props.value = next.value;
      if (next.onChange !== undefined) props.onChange = next.onChange;
      if (next.placeholder !== undefined) props.placeholder = next.placeholder;
      if (next.width !== undefined) props.width = next.width;
      render();
    },
    restyle() { render(); },
    destroy() { node.destroy(); },
  };
}
