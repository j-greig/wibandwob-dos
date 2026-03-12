# Component Contract

Every SDK component (create* function) follows this contract.
Module authors can rely on these guarantees. SDK contributors must enforce them.

## Return type

All components return `LayoutPart` or an extension of it.
This ensures every component composes with `createStack`, `createRow`,
`createGrid`, and `createNodePart`.

```ts
interface LayoutPart<Props = void> {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  restyle(): void;
  destroy(): void;
  update?: (props: Props) => void;
}
```

## Lifecycle hooks

| Hook | When | Required |
|------|------|----------|
| `layout(rect)` | Parent assigns position/size | Yes |
| `restyle()` | Theme changes | Yes |
| `destroy()` | Window closes or component removed | Yes |
| `update(props)` | Value/state changes from outside | If stateful |

### Cleanup rules

`destroy()` must:
- Remove all blessed nodes from parent
- Clear all timers and intervals
- Remove all event listeners
- Be safe to call twice (idempotent)

## Focus and keyboard

### Tab order

- `Tab` moves focus to the next sibling control
- `Shift-Tab` moves focus to the previous sibling control
- Controls that accept focus set `focusable: true` on their node

### Focus ring

Focused controls must be visually distinct from unfocused controls.
Use theme tokens for focus styling — never hardcode colours.

### Common key bindings

| Key | Behaviour |
|-----|-----------|
| `Enter` / `Space` | Activate (buttons, checkboxes, select confirm) |
| `Arrow Up/Down` | Navigate within multi-option controls (radio, select, list) |
| `Escape` | Cancel / close overlay (if applicable) |

## Disabled state

When `disabled: true`:
- Control is visually muted (use `theme().muted`)
- Keyboard input is ignored
- Focus is skipped during Tab traversal
- `update({ disabled })` toggles at runtime

## Variants

Controls support these visual states as relevant:

| Variant | Meaning |
|---------|---------|
| `default` | Normal idle state |
| `focus` | Has keyboard focus |
| `disabled` | Non-interactive |
| `error` | Validation failure (form fields) |
| `success` | Validation pass (form fields) |

Not all variants apply to all controls. Buttons have default/focus/disabled.
Form fields add error/success.

## Controlled vs uncontrolled

**Controlled**: caller owns state, passes value via `update({ value })`.
Component renders what it is told. onChange fires but does not auto-update.

**Uncontrolled**: component owns internal state. onChange fires AND
component auto-updates its display. No `update()` needed.

**Policy**: SDK form controls default to **uncontrolled** (simpler for
module authors). Controlled mode available by passing `controlled: true`
in options — then `update({ value })` is required to change display.

## Event payloads

All onChange callbacks receive a consistent payload:

```ts
type ChangeEvent<T> = {
  value: T;           // new value
  previousValue?: T;  // old value (if trackable)
};
```

For selection controls (radio, select, list):
```ts
type SelectEvent<T> = ChangeEvent<T> & {
  index: number;      // selected index
};
```

## Restyle

`restyle()` must re-read `theme()` and apply current tokens to all
visual elements. Never cache theme references at creation time.

Use `safeSetStyle` for scrollable/list components to avoid blessed crashes.

## Design tokens

### Spacing scale

| Token | Value | Use |
|-------|-------|-----|
| `xs` | 0 | Tight packing |
| `sm` | 1 | Between related controls |
| `md` | 2 | Between groups |
| `lg` | 3 | Section separation |

### Control heights

| Control | Height |
|---------|--------|
| Button | 1 row |
| Checkbox | 1 row |
| Radio option | 1 row per option |
| Select (closed) | 1 row |
| Input line | 1 row |
| Text area | `rows` option (default 3) |
| Progress bar | 1 row |
| Spinner | 1 row |

### Density

Controls are single-row by default. Multi-row controls (textarea,
radio group, select expanded) state their height in options.
Layout parents (createStack, createGrid) assign actual dimensions.

## Composition

Every component works inside layout containers:

```ts
const root = createStack(win.body, [
  { key: "name",   basis: 1,     part: createFormField({ ... }) },
  { key: "submit", basis: 1,     part: createButton({ ... }) },
  { key: "status", basis: 1,     part: createProgressBar({ ... }) },
  { key: "log",    basis: "1fr", part: createLogView({ ... }) },
]);
```

Components never set their own position. Parents assign rects via `layout()`.
