/**
 * ui-parts-forms.ts — Form control primitives.
 *
 * Module authors: import from ../../src/services/microapp-sdk.js
 * All components follow the component contract (.agents/microapp-dev/component-contract.md)
 * All return LayoutPart for composition with createStack/createRow/createGrid.
 */
import blessed from "blessed";
import { theme } from "./theme/resolver.js";
import type { Rect, LayoutPart } from "./ui-parts-types.js";

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

// ═══════════════════════════════════════════════════════════════════════════
// createFilterableList
// ═══════════════════════════════════════════════════════════════════════════

export interface FilterableItem {
  label: string;
  value: string;
}

export interface FilterableListOptions {
  items: FilterableItem[];
  onSelect?: (event: SelectEvent<string>) => void;
  onHighlight?: (event: SelectEvent<string>) => void;
  onCancel?: () => void;
  initialIndex?: number;
  placeholder?: string;
  disabled?: boolean;
}

export type FilterableListHandle = LayoutPart<Partial<FilterableListOptions>> & {
  filter(): string;
  selected(): string | undefined;
};

/**
 * A combined search + select list. Type to filter, arrows navigate, Enter selects.
 * Height = 1 (search row) + visible item count.
 *
 * @example
 * const list = createFilterableList({
 *   items: [{ label: "Apple", value: "apple" }, { label: "Banana", value: "banana" }],
 *   placeholder: "Search fruit...",
 *   onSelect: (e) => console.log("Picked:", e.value),
 * });
 */
export function createFilterableList(opts: FilterableListOptions): FilterableListHandle {
  let { items, onSelect, onHighlight, onCancel, placeholder = "Search...", disabled = false } = opts;
  let query = "";
  let focusIndex = opts.initialIndex ?? 0;
  let filtered = items.slice();
  let lastHeight = 0;

  const node = blessed.box({
    width: 0,
    height: 0,
    content: "",
    focusable: !disabled,
    mouse: true,
    keys: true,
    inputOnFocus: false,
    style: getStyle(),
  });

  function getStyle() {
    const t = theme();
    if (disabled) return { fg: t.muted.fg, bg: t.muted.bg ?? t.body.bg };
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function refilter() {
    const q = query.toLowerCase();
    filtered = q ? items.filter(it => it.label.toLowerCase().includes(q)) : items.slice();
    focusIndex = Math.min(focusIndex, Math.max(0, filtered.length - 1));
  }

  function renderContent() {
    const isFocused = node.screen?.focused === node;
    const searchLine = query
      ? ` > ${query}_`
      : ` > ${isFocused ? "_" : placeholder}`;

    const maxItems = Math.max(0, lastHeight - 1);
    const visible = filtered.slice(0, maxItems);
    const lines = visible.map((it, i) => {
      const pointer = i === focusIndex && isFocused ? ">" : " ";
      return `${pointer} ${it.label}`;
    });

    node.setContent([searchLine, ...lines].join("\n"));
  }

  function emitHighlight() {
    if (filtered.length > 0 && focusIndex < filtered.length) {
      const item = filtered[focusIndex]!;
      onHighlight?.({ value: item.value, index: items.indexOf(item) });
    }
  }

  function applyVisuals() {
    node.style = getStyle();
    renderContent();
  }

  node.on("focus", applyVisuals);
  node.on("blur", applyVisuals);

  node.on("keypress", (ch: string, key: { name: string; full: string; ctrl?: boolean; sequence?: string }) => {
    if (disabled || !key) return;

    if (key.name === "up") {
      focusIndex = Math.max(0, focusIndex - 1);
      applyVisuals();
      emitHighlight();
    } else if (key.name === "down") {
      focusIndex = Math.min(filtered.length - 1, focusIndex + 1);
      applyVisuals();
      emitHighlight();
    } else if (key.name === "enter") {
      if (filtered.length > 0 && focusIndex < filtered.length) {
        const item = filtered[focusIndex]!;
        onSelect?.({ value: item.value, index: items.indexOf(item) });
      }
    } else if (key.name === "backspace") {
      if (query.length > 0) {
        query = query.slice(0, -1);
        refilter();
        applyVisuals();
        emitHighlight();
      }
    } else if (key.name === "escape") {
      if (query) {
        query = "";
        refilter();
        applyVisuals();
      } else {
        onCancel?.();
      }
    } else if (ch && ch.length === 1 && !key.ctrl && ch.charCodeAt(0) >= 32) {
      query += ch;
      refilter();
      applyVisuals();
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
      lastHeight = rect.height;
      node.height = rect.height;
      renderContent();
    },
    restyle() { applyVisuals(); },
    destroy() { node.destroy(); },
    update(props: Partial<FilterableListOptions>) {
      if (props.items !== undefined) {
        items = props.items;
        refilter();
      }
      if (props.onSelect !== undefined) onSelect = props.onSelect;
      if (props.onHighlight !== undefined) onHighlight = props.onHighlight;
      if (props.onCancel !== undefined) onCancel = props.onCancel;
      if (props.placeholder !== undefined) placeholder = props.placeholder;
      if (props.disabled !== undefined) {
        disabled = props.disabled;
        node.focusable = !disabled;
      }
      applyVisuals();
    },
    filter() { return query; },
    selected() {
      return filtered.length > 0 && focusIndex < filtered.length
        ? filtered[focusIndex]!.value
        : undefined;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createFormField
// ═══════════════════════════════════════════════════════════════════════════

export interface FormFieldOptions {
  label: string;
  help?: string;
  error?: string;
  child: LayoutPart;
}

export type FormFieldHandle = LayoutPart<Partial<Omit<FormFieldOptions, "child">>>;

/**
 * Wraps any LayoutPart child with a label row, optional help text, and
 * optional error text. Error state uses the error variant colour.
 *
 * Height = 1 (label) + child height + (1 if help) + (1 if error).
 *
 * @example
 * const field = createFormField({
 *   label: "Username",
 *   help: "Letters and numbers only",
 *   child: createCheckbox({ label: "Agree to terms" }),
 * });
 */
export function createFormField(opts: FormFieldOptions): FormFieldHandle {
  let { label, help = "", error = "" } = opts;
  const child = opts.child;

  const node = blessed.box({
    width: 0,
    height: 0,
    style: getStyle(),
  });

  const labelNode = blessed.box({
    parent: node,
    top: 0, left: 0, width: 0, height: 1,
    content: ` ${label}`,
    style: getLabelStyle(),
    tags: false,
  });

  // Ensure child is parented
  node.append(child.node);

  const helpNode = blessed.box({
    parent: node,
    top: 0, left: 0, width: 0, height: 1,
    content: "",
    style: getHelpStyle(),
    tags: false,
  });

  const errorNode = blessed.box({
    parent: node,
    top: 0, left: 0, width: 0, height: 1,
    content: "",
    style: getErrorStyle(),
    tags: false,
  });

  function getStyle() {
    const t = theme();
    return { fg: t.body.fg, bg: t.body.bg };
  }

  function getLabelStyle() {
    const t = theme();
    return { fg: t.body.fg, bg: t.body.bg, bold: true };
  }

  function getHelpStyle() {
    const t = theme();
    return { fg: t.muted.fg, bg: t.body.bg };
  }

  function getErrorStyle() {
    return { fg: "red", bg: theme().body.bg };
  }

  function computeHeight(availH: number): { labelH: number; childH: number; helpH: number; errorH: number } {
    const labelH = 1;
    const helpH = help ? 1 : 0;
    const errorH = error ? 1 : 0;
    const childH = Math.max(1, availH - labelH - helpH - errorH);
    return { labelH, childH, helpH, errorH };
  }

  return {
    node,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = rect.height;

      const { labelH, childH, helpH, errorH } = computeHeight(rect.height);
      let y = 0;

      labelNode.position.top = y; labelNode.width = rect.width; y += labelH;
      child.layout({ top: y, left: 0, width: rect.width, height: childH }); y += childH;

      if (helpH) {
        helpNode.position.top = y; helpNode.width = rect.width;
        helpNode.setContent(` ${help}`);
        helpNode.show();
        y += helpH;
      } else { helpNode.hide(); }

      if (errorH) {
        errorNode.position.top = y; errorNode.width = rect.width;
        errorNode.setContent(` ${error}`);
        errorNode.show();
      } else { errorNode.hide(); }
    },
    restyle() {
      node.style = getStyle();
      labelNode.style = getLabelStyle();
      helpNode.style = getHelpStyle();
      errorNode.style = getErrorStyle();
      child.restyle();
    },
    destroy() {
      child.destroy();
      node.destroy();
    },
    update(props: Partial<Omit<FormFieldOptions, "child">>) {
      if (props.label !== undefined) { label = props.label; labelNode.setContent(` ${label}`); }
      if (props.help !== undefined) help = props.help;
      if (props.error !== undefined) error = props.error;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// createTextArea
// ═══════════════════════════════════════════════════════════════════════════

export interface TextAreaOptions {
  value?: string;
  onChange?: (event: ChangeEvent<string>) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

export type TextAreaHandle = LayoutPart<Partial<TextAreaOptions>> & {
  value(): string;
};

/**
 * A multiline text input. Focus to type.
 * Height = rows option or fills available space.
 *
 * @example
 * const ta = createTextArea({
 *   placeholder: "Enter notes...",
 *   rows: 4,
 *   onChange: (e) => console.log(e.value),
 * });
 */
export function createTextArea(opts: TextAreaOptions = {}): TextAreaHandle {
  let { value = "", onChange, rows, placeholder = "", disabled = false } = opts;

  const node = blessed.textarea({
    width: 0,
    height: rows ?? 3,
    inputOnFocus: true,
    mouse: true,
    keys: true,
    border: "line",
    style: getStyle(false),
    value: value || undefined,
  } as any);

  function getStyle(focused: boolean) {
    const t = theme();
    if (disabled) return { fg: t.muted.fg, bg: t.muted.bg ?? t.body.bg, border: { fg: t.muted.fg } };
    if (focused) return { fg: t.body.fg, bg: t.body.bg, border: { fg: t.body.fg } };
    return { fg: t.body.fg, bg: t.body.bg, border: { fg: t.muted.fg } };
  }

  function applyVisuals() {
    const focused = node.screen?.focused === node;
    node.style = getStyle(focused);
    // Show placeholder when empty and not focused
    if (!value && !focused && placeholder) {
      node.setValue(placeholder);
    } else if ((node as any).getValue?.() === placeholder) {
      node.setValue(value);
    }
  }

  // Track value changes
  node.on("keypress", () => {
    if (disabled) return;
    // Defer to let blessed update internal value
    setTimeout(() => {
      const newVal = (node as any).getValue?.() ?? "";
      if (newVal !== value && newVal !== placeholder) {
        const prev = value;
        value = newVal;
        onChange?.({ value, previousValue: prev });
      }
    }, 0);
  });

  node.on("focus", () => {
    if (disabled) { node.screen?.focusNext?.(); return; }
    if ((node as any).getValue?.() === placeholder) {
      node.setValue(value);
    }
    applyVisuals();
  });

  node.on("blur", applyVisuals);

  return {
    node: node as any,
    layout(rect: Rect) {
      node.position.top = rect.top;
      node.position.left = rect.left;
      node.width = rect.width;
      node.height = rows ?? rect.height;
    },
    restyle() { applyVisuals(); },
    destroy() { node.destroy(); },
    update(props: Partial<TextAreaOptions>) {
      if (props.value !== undefined) { value = props.value; node.setValue(value); }
      if (props.onChange !== undefined) onChange = props.onChange;
      if (props.rows !== undefined) rows = props.rows;
      if (props.placeholder !== undefined) placeholder = props.placeholder;
      if (props.disabled !== undefined) {
        disabled = props.disabled;
        (node as any).focusable = !disabled;
      }
      applyVisuals();
    },
    value() { return value; },
  };
}
