/**
 * ui-parts-forms.ts — Form control primitives.
 *
 * Module authors: import from ../../src/services/microapp-sdk.js
 * All components follow the component contract (.agents/module-dev/component-contract.md)
 * All return LayoutPart for composition with createStack/createRow/createGrid.
 */
import blessed from "blessed";
import { theme } from "./theme/resolver.js";
import type { Rect, LayoutPart } from "./ui-parts.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ChangeEvent<T> = {
  value: T;
  previousValue?: T;
};

export type SelectEvent<T> = ChangeEvent<T> & {
  index: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// createButton
// ═══════════════════════════════════════════════════════════════════════════

export interface ButtonOptions {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

export type ButtonHandle = LayoutPart<Partial<ButtonOptions>>;

/**
 * A focusable button. Press Enter or Space to activate.
 * Returns LayoutPart for composition.
 *
 * @example
 * const btn = createButton({ label: "Submit", onPress: () => save() });
 * const root = createStack(parent, [{ key: "btn", basis: 1, part: btn }]);
 */
export function createButton(opts: ButtonOptions): ButtonHandle {
  let { label, onPress, disabled = false } = opts;

  const node = blessed.box({
    width: 0,
    height: 1,
    content: renderLabel(),
    focusable: !disabled,
    mouse: true,
    keys: true,
    style: getStyle(false),
  });

  function renderLabel(): string {
    return ` [ ${label} ]`;
  }

  function getStyle(focused: boolean) {
    const t = theme();
    if (disabled) return { fg: t.muted.fg, bg: t.muted.bg ?? t.body.bg };
    if (focused) return { fg: t.body.bg, bg: t.body.fg, bold: true };
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function applyVisuals() {
    const focused = node.screen?.focused === node;
    node.style = getStyle(focused);
    node.setContent(renderLabel());
  }

  node.on("focus", applyVisuals);
  node.on("blur", applyVisuals);

  node.on("keypress", (_ch: string, key: { name: string; full: string }) => {
    if (disabled || !key) return;
    if (key.name === "enter" || key.name === "space" || key.full === "enter" || key.full === "space") {
      onPress?.();
    }
  });

  node.on("click", () => {
    if (disabled) return;
    node.focus();
    onPress?.();
  });

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = 1;
    },
    restyle() {
      applyVisuals();
    },
    destroy() {
      node.destroy();
    },
    update(props: Partial<ButtonOptions>) {
      if (props.label !== undefined) label = props.label;
      if (props.onPress !== undefined) onPress = props.onPress;
      if (props.disabled !== undefined) {
        disabled = props.disabled;
        node.focusable = !disabled;
      }
      applyVisuals();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createCheckbox
// ═══════════════════════════════════════════════════════════════════════════

export interface CheckboxOptions {
  label: string;
  checked?: boolean;
  onChange?: (event: ChangeEvent<boolean>) => void;
  disabled?: boolean;
}

export type CheckboxHandle = LayoutPart<Partial<CheckboxOptions>> & {
  checked(): boolean;
};

/**
 * A toggleable checkbox. Press Space to toggle.
 * Returns LayoutPart for composition.
 *
 * @example
 * const cb = createCheckbox({ label: "Enable sound", onChange: (e) => setSoundEnabled(e.value) });
 */
export function createCheckbox(opts: CheckboxOptions): CheckboxHandle {
  let { label, onChange, disabled = false } = opts;
  let checked = opts.checked ?? false;

  const node = blessed.box({
    width: 0,
    height: 1,
    content: renderContent(),
    focusable: !disabled,
    mouse: true,
    keys: true,
    style: getStyle(false),
  });

  function renderContent(): string {
    const box = checked ? "[x]" : "[ ]";
    return ` ${box} ${label}`;
  }

  function getStyle(focused: boolean) {
    const t = theme();
    if (disabled) return { fg: t.muted.fg, bg: t.muted.bg ?? t.body.bg };
    if (focused) return { fg: t.body.bg, bg: t.body.fg, bold: true };
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function applyVisuals() {
    const focused = node.screen?.focused === node;
    node.style = getStyle(focused);
    node.setContent(renderContent());
  }

  function toggle() {
    if (disabled) return;
    const prev = checked;
    checked = !checked;
    applyVisuals();
    onChange?.({ value: checked, previousValue: prev });
  }

  node.on("focus", applyVisuals);
  node.on("blur", applyVisuals);

  node.on("keypress", (_ch: string, key: { name: string; full: string }) => {
    if (disabled || !key) return;
    if (key.name === "space" || key.full === "space") {
      toggle();
    }
  });

  node.on("click", () => {
    if (disabled) return;
    node.focus();
    toggle();
  });

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = 1;
    },
    restyle() {
      applyVisuals();
    },
    destroy() {
      node.destroy();
    },
    update(props: Partial<CheckboxOptions>) {
      if (props.label !== undefined) label = props.label;
      if (props.onChange !== undefined) onChange = props.onChange;
      if (props.disabled !== undefined) {
        disabled = props.disabled;
        node.focusable = !disabled;
      }
      if (props.checked !== undefined) checked = props.checked;
      applyVisuals();
    },
    checked() { return checked; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createRadioGroup
// ═══════════════════════════════════════════════════════════════════════════

export interface RadioOption {
  label: string;
  value: string;
}

export interface RadioGroupOptions {
  options: RadioOption[];
  selected?: string;
  onChange?: (event: SelectEvent<string>) => void;
  disabled?: boolean;
}

export type RadioGroupHandle = LayoutPart<Partial<RadioGroupOptions>> & {
  selected(): string | undefined;
};

/**
 * A vertical radio button group. Arrow keys navigate, Enter/Space selects.
 * Height = number of options.
 *
 * @example
 * const radio = createRadioGroup({
 *   options: [{ label: "Small", value: "sm" }, { label: "Large", value: "lg" }],
 *   onChange: (e) => setSize(e.value),
 * });
 */
export function createRadioGroup(opts: RadioGroupOptions): RadioGroupHandle {
  let { options, onChange, disabled = false } = opts;
  let selectedValue = opts.selected ?? (options.length > 0 ? options[0]!.value : undefined);
  let focusIndex = Math.max(0, options.findIndex(o => o.value === selectedValue));

  // node declared as let so renderContent can reference it during initial construction
  let node: blessed.Widgets.BoxElement;

  function renderContent(): string {
    return options.map((opt, i) => {
      const bullet = opt.value === selectedValue ? "(o)" : "( )";
      const pointer = i === focusIndex && node?.screen?.focused === node ? ">" : " ";
      return `${pointer}${bullet} ${opt.label}`;
    }).join("\n");
  }

  node = blessed.box({
    width: 0,
    height: options.length,
    content: renderContent(),
    focusable: !disabled,
    mouse: true,
    keys: true,
    style: getStyle(),
  });

  function getStyle() {
    const t = theme();
    if (disabled) return { fg: t.muted.fg, bg: t.muted.bg ?? t.body.bg };
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function applyVisuals() {
    node.style = getStyle();
    node.setContent(renderContent());
  }

  function selectCurrent() {
    if (disabled || options.length === 0) return;
    const prev = selectedValue;
    selectedValue = options[focusIndex]!.value;
    applyVisuals();
    onChange?.({ value: selectedValue, previousValue: prev, index: focusIndex });
  }

  node.on("focus", applyVisuals);
  node.on("blur", applyVisuals);

  node.on("keypress", (_ch: string, key: { name: string; full: string }) => {
    if (disabled || !key || options.length === 0) return;
    if (key.name === "up") {
      focusIndex = (focusIndex - 1 + options.length) % options.length;
      applyVisuals();
    } else if (key.name === "down") {
      focusIndex = (focusIndex + 1) % options.length;
      applyVisuals();
    } else if (key.name === "enter" || key.name === "space") {
      selectCurrent();
    }
  });

  node.on("click", () => {
    if (disabled) return;
    node.focus();
  });

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = Math.min(rect.height, options.length);
    },
    restyle() { applyVisuals(); },
    destroy() { node.destroy(); },
    update(props: Partial<RadioGroupOptions>) {
      if (props.options !== undefined) {
        options = props.options;
        focusIndex = Math.min(focusIndex, options.length - 1);
      }
      if (props.selected !== undefined) {
        selectedValue = props.selected;
        focusIndex = Math.max(0, options.findIndex(o => o.value === selectedValue));
      }
      if (props.onChange !== undefined) onChange = props.onChange;
      if (props.disabled !== undefined) {
        disabled = props.disabled;
        node.focusable = !disabled;
      }
      applyVisuals();
    },
    selected() { return selectedValue; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createSelect
// ═══════════════════════════════════════════════════════════════════════════

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectOptions {
  options: SelectOption[];
  selected?: string;
  onChange?: (event: SelectEvent<string>) => void;
  placeholder?: string;
  disabled?: boolean;
}

export type SelectHandle = LayoutPart<Partial<SelectOptions>> & {
  selected(): string | undefined;
};

/**
 * An inline select picker. Arrow Left/Right cycles through options.
 * Single-row control (not a dropdown — blessed terminal constraint).
 *
 * @example
 * const sel = createSelect({
 *   options: [{ label: "Red", value: "red" }, { label: "Blue", value: "blue" }],
 *   placeholder: "Pick a colour",
 *   onChange: (e) => setColour(e.value),
 * });
 */
export function createSelect(opts: SelectOptions): SelectHandle {
  let { options, onChange, placeholder = "-- select --", disabled = false } = opts;
  let selectedIndex = opts.selected
    ? options.findIndex(o => o.value === opts.selected)
    : -1;

  const node = blessed.box({
    width: 0,
    height: 1,
    content: renderContent(),
    focusable: !disabled,
    mouse: true,
    keys: true,
    style: getStyle(false),
  });

  function renderContent(): string {
    if (selectedIndex < 0 || selectedIndex >= options.length) {
      return ` < ${placeholder} >`;
    }
    const opt = options[selectedIndex]!;
    return ` < ${opt.label} >`;
  }

  function getStyle(focused: boolean) {
    const t = theme();
    if (disabled) return { fg: t.muted.fg, bg: t.muted.bg ?? t.body.bg };
    if (focused) return { fg: t.body.bg, bg: t.body.fg, bold: true };
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function applyVisuals() {
    const focused = node.screen?.focused === node;
    node.style = getStyle(focused);
    node.setContent(renderContent());
  }

  function navigate(dir: number) {
    if (disabled || options.length === 0) return;
    const prev = selectedIndex >= 0 ? options[selectedIndex]!.value : undefined;
    if (selectedIndex < 0) {
      selectedIndex = dir > 0 ? 0 : options.length - 1;
    } else {
      selectedIndex = ((selectedIndex + dir) + options.length) % options.length;
    }
    applyVisuals();
    onChange?.({
      value: options[selectedIndex]!.value,
      previousValue: prev,
      index: selectedIndex,
    });
  }

  node.on("focus", applyVisuals);
  node.on("blur", applyVisuals);

  node.on("keypress", (_ch: string, key: { name: string; full: string }) => {
    if (disabled || !key) return;
    if (key.name === "left" || key.name === "up") navigate(-1);
    else if (key.name === "right" || key.name === "down") navigate(1);
    else if (key.name === "enter" || key.name === "space") {
      // Enter/Space confirms current or selects first if nothing picked
      if (selectedIndex < 0 && options.length > 0) navigate(1);
    }
  });

  node.on("click", () => {
    if (disabled) return;
    node.focus();
    navigate(1);
  });

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = 1;
    },
    restyle() { applyVisuals(); },
    destroy() { node.destroy(); },
    update(props: Partial<SelectOptions>) {
      if (props.options !== undefined) {
        options = props.options;
        selectedIndex = Math.min(selectedIndex, options.length - 1);
      }
      if (props.selected !== undefined) {
        selectedIndex = options.findIndex(o => o.value === props.selected);
      }
      if (props.onChange !== undefined) onChange = props.onChange;
      if (props.placeholder !== undefined) placeholder = props.placeholder;
      if (props.disabled !== undefined) {
        disabled = props.disabled;
        node.focusable = !disabled;
      }
      applyVisuals();
    },
    selected() { return selectedIndex >= 0 ? options[selectedIndex]!.value : undefined; },
  };
}
