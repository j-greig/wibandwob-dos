import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

type NodeId = "gen" | "text" | "input" | "mix";

type ThemeColorName =
  | "body"
  | "bodyAlt"
  | "selected"
  | "accent"
  | "highlight"
  | "warning"
  | "success"
  | "error"
  | "muted";

type BlendMode = "overwrite" | "mask";

type NestedNode = {
  id: NodeId;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  fg: ThemeColorName;
  bg: ThemeColorName;
  frame: blessed.Widgets.BoxElement;
  titleBar: blessed.Widgets.BoxElement;
  content: blessed.Widgets.BoxElement;
  resizeGrip: blessed.Widgets.BoxElement;
};

type PaletteSlot = {
  key: ThemeColorName;
  box: blessed.Widgets.BoxElement;
};

const TEXT_PHRASES = [
  "signal patch",
  "terminal garden",
  "world chat drift",
  "modular moon",
];

const FG_OPTIONS: ThemeColorName[] = [
  "body",
  "accent",
  "highlight",
  "warning",
  "success",
  "error",
  "muted",
  "selected",
];

const BG_OPTIONS: ThemeColorName[] = [
  "body",
  "bodyAlt",
  "selected",
  "accent",
  "highlight",
  "warning",
  "success",
  "error",
  "muted",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function blankGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => " "));
}

function gridToText(grid: string[][]): string {
  return grid.map((row) => row.join("")).join("\n");
}

function paintText(grid: string[][], x: number, y: number, text: string): void {
  if (y < 0 || y >= grid.length) return;
  const row = grid[y];
  if (!row) return;
  for (let i = 0; i < text.length && x + i < row.length; i += 1) {
    if (x + i >= 0) row[x + i] = text[i] ?? " ";
  }
}

function waveSource(width: number, height: number, phase: number): string {
  const grid = blankGrid(width, height);
  for (let x = 0; x < width; x += 1) {
    const y = Math.floor((Math.sin((x + phase) / 2.8) + 1) * 0.5 * Math.max(0, height - 1));
    grid[y]![x] = x % 2 === 0 ? "~" : "^";
  }
  return gridToText(grid);
}

function textSource(width: number, height: number, phase: number): string {
  const grid = blankGrid(width, height);
  const word = TEXT_PHRASES[phase % TEXT_PHRASES.length] ?? "signal patch";
  const top = Math.floor(height / 2);
  paintText(grid, 0, top, word.slice(0, width));
  paintText(grid, 0, Math.min(height - 1, top + 1), `${phase}`);
  return gridToText(grid);
}

function inputSource(width: number, height: number, value: string): string {
  const grid = blankGrid(width, height);
  paintText(grid, 0, 0, "INPUT");
  paintText(grid, 0, 2, value.slice(0, width));
  paintText(grid, 0, Math.min(height - 1, 4), ":)".slice(0, width));
  return gridToText(grid);
}

function composite(width: number, height: number, layers: string[], mode: BlendMode): string {
  const grid = blankGrid(width, height);
  for (const layer of layers) {
    const rows = layer.split("\n");
    for (let y = 0; y < Math.min(height, rows.length); y += 1) {
      const row = rows[y] ?? "";
      for (let x = 0; x < Math.min(width, row.length); x += 1) {
        const ch = row[x];
        if (!ch || ch === " ") continue;
        if (mode === "overwrite") {
          grid[y]![x] = ch;
        } else {
          grid[y]![x] = grid[y]![x] === " " ? "." : ch;
        }
      }
    }
  }
  return gridToText(grid);
}

function drawArrow(grid: string[][], fromX: number, fromY: number, toX: number, toY: number): void {
  const minX = Math.min(fromX, toX);
  const maxX = Math.max(fromX, toX);
  for (let x = minX; x <= maxX && fromY >= 0 && fromY < grid.length; x += 1) {
    if (x >= 0 && x < grid[fromY]!.length) {
      grid[fromY]![x] = x === toX ? ">" : "-";
    }
  }
  const minY = Math.min(fromY, toY);
  const maxY = Math.max(fromY, toY);
  for (let y = minY; y <= maxY; y += 1) {
    if (toX >= 0 && toX < grid[y]!.length) {
      grid[y]![toX] = y === toY ? ">" : "|";
    }
  }
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open TouchLab MVP",
    description: "Open the minimal nested-window composition proof.",
    menu: [{ category: "applications", order: 48, label: "TouchLab MVP" }],
    palette: { order: 218, label: "TouchLab MVP" },
    action: () => {
      const win = host.createWindow({
        title: "TouchLab MVP",
        width: 104,
        height: 36,
        left: 6,
        top: 2,
      });

      const root = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        keys: true,
        mouse: true,
        clickable: true,
        style: host.theme().body,
      });

      const inspector = blessed.box({
        parent: root,
        top: 0,
        right: 0,
        width: 26,
        height: "100%",
        keys: true,
        mouse: true,
        clickable: true,
        border: "line",
        style: {
          ...host.theme().bodyAlt,
          border: { fg: host.theme().accent.fg },
        },
      });

      const canvas = blessed.box({
        parent: root,
        top: 0,
        left: 0,
        right: 26,
        bottom: 0,
        keys: true,
        mouse: true,
        clickable: true,
        style: host.theme().body,
      });

      const overlay = blessed.box({
        parent: canvas,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        mouse: true,
        tags: false,
        style: host.theme().muted,
      });

      const paletteTitle = blessed.box({
        parent: inspector,
        top: 23,
        left: 1,
        width: 22,
        height: 1,
        mouse: true,
        clickable: true,
        style: host.theme().bodyAlt,
      });
      const fgPaletteLabel = blessed.box({
        parent: inspector,
        top: 24,
        left: 1,
        width: 4,
        height: 1,
        mouse: true,
        clickable: true,
        style: host.theme().bodyAlt,
      });
      const bgPaletteLabel = blessed.box({
        parent: inspector,
        top: 26,
        left: 1,
        width: 4,
        height: 1,
        mouse: true,
        clickable: true,
        style: host.theme().bodyAlt,
      });
      const fgPaletteSlots: PaletteSlot[] = [];
      const bgPaletteSlots: PaletteSlot[] = [];

      const nodes = new Map<NodeId, NestedNode>();
      let selectedNode: NodeId = "gen";
      let blendMode: BlendMode = "overwrite";
      let textInput = "human signal";
      let phase = 0;
      let inspectorCollapsed = false;
      let dragging:
        | { id: NodeId; offsetX: number; offsetY: number }
        | undefined;
      let resizing:
        | { id: NodeId; startW: number; startH: number; anchorX: number; anchorY: number }
        | undefined;
      let mouseDragAttempts = 0;

      const colorPair = (name: ThemeColorName) => {
        const tokens = host.theme();
        return tokens[name] ?? tokens.body;
      };

      const compactLabel = (name: ThemeColorName) =>
        name === "bodyAlt" ? "ba" : name.slice(0, 2);

      const initial: Array<Pick<NestedNode, "id" | "title" | "x" | "y" | "w" | "h" | "z" | "fg" | "bg">> = [
        { id: "gen", title: "GEN A", x: 2, y: 1, w: 26, h: 9, z: 0, fg: "highlight", bg: "body" },
        { id: "text", title: "TEXT B", x: 34, y: 2, w: 24, h: 8, z: 1, fg: "accent", bg: "body" },
        { id: "input", title: "INPUT C", x: 12, y: 12, w: 22, h: 8, z: 2, fg: "success", bg: "body" },
        { id: "mix", title: "MIX D", x: 40, y: 12, w: 38, h: 12, z: 3, fg: "body", bg: "bodyAlt" },
      ];

      for (const item of initial) {
        const frame = blessed.box({
          parent: canvas,
          mouse: true,
          clickable: true,
          border: "line",
          style: {
            ...host.theme().body,
            border: { fg: host.theme().muted.fg },
          },
        });
        const titleBar = blessed.box({
          parent: frame,
          top: 0,
          left: 1,
          right: 1,
          height: 1,
          mouse: true,
          clickable: true,
          style: host.theme().selected,
        });
        const content = blessed.box({
          parent: frame,
          top: 1,
          left: 1,
          right: 1,
          bottom: 1,
          mouse: true,
          clickable: true,
          tags: false,
          style: host.theme().body,
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
          style: host.theme().selected,
        });
        nodes.set(item.id, { ...item, frame, titleBar, content, resizeGrip });
      }

      FG_OPTIONS.forEach((key, index) => {
        const box = blessed.box({
          parent: inspector,
          top: 24,
          left: 5 + index * 2,
          width: 2,
          height: 1,
          mouse: true,
          clickable: true,
          tags: false,
        });
        fgPaletteSlots.push({ key, box });
        box.on("click", () => {
          const node = currentNode();
          if (!node) return;
          node.fg = key;
          renderNodes();
          host.screen.render();
        });
      });

      BG_OPTIONS.forEach((key, index) => {
        const box = blessed.box({
          parent: inspector,
          top: 26,
          left: 5 + index * 2,
          width: 2,
          height: 1,
          mouse: true,
          clickable: true,
          tags: false,
        });
        bgPaletteSlots.push({ key, box });
        box.on("click", () => {
          const node = currentNode();
          if (!node) return;
          node.bg = key;
          renderNodes();
          host.screen.render();
        });
      });

      const currentNode = () => nodes.get(selectedNode);

      const cycleColor = (
        current: ThemeColorName,
        options: ThemeColorName[],
        direction: 1 | -1,
      ): ThemeColorName => {
        const idx = options.indexOf(current);
        const next = idx < 0 ? 0 : (idx + direction + options.length) % options.length;
        return options[next] ?? current;
      };

      const orderNodes = () => {
        [...nodes.values()]
          .sort((a, b) => a.z - b.z)
          .forEach((node) => node.frame.setFront());
      };

      const renderOverlay = () => {
        const width = Math.max(1, Number(canvas.width) || 1);
        const height = Math.max(1, Number(canvas.height) || 1);
        const grid = blankGrid(width, height);
        const mix = nodes.get("mix");
        if (!mix) return;
        for (const node of ["gen", "text", "input"] as const) {
          const source = nodes.get(node);
          if (!source) continue;
          drawArrow(
            grid,
            source.x + source.w,
            source.y + Math.floor(source.h / 2),
            mix.x - 2,
            mix.y + Math.floor(mix.h / 2),
          );
        }
        overlay.setContent(gridToText(grid));
      };

      const renderInspector = () => {
        const node = currentNode();
        if (!node) return;
        if (inspectorCollapsed) {
          paletteTitle.hide();
          fgPaletteLabel.hide();
          bgPaletteLabel.hide();
          fgPaletteSlots.forEach(({ box }) => box.hide());
          bgPaletteSlots.forEach(({ box }) => box.hide());
          inspector.setContent([
            " TL",
            "",
            ` ${node.id}`,
            ` ${blendMode === "overwrite" ? "ow" : "mk"}`,
            "",
            " i",
          ].join("\n"));
          return;
        }
        paletteTitle.show();
        fgPaletteLabel.show();
        bgPaletteLabel.show();
        fgPaletteSlots.forEach(({ box }) => box.show());
        bgPaletteSlots.forEach(({ box }) => box.show());
        inspector.setContent([
          " TouchLab Inspector",
          "",
          ` node: ${node.id}`,
          ` blend: ${blendMode}`,
          ` fg: ${node.fg}`,
          ` bg: ${node.bg}`,
          ` pos: ${node.x},${node.y}`,
          "",
          " keys:",
          " 1/2/3/4 select",
          " h/j/k/l move",
          " [/] fg cycle",
          " -/= bg cycle",
          " ,/. width  n/m height",
          " b blend mode",
          " i inspector",
          " t phrase cycle",
          " type in INPUT C",
          " mouse: drag pane or +",
          "",
          " sources:",
          ` text: ${TEXT_PHRASES[phase % TEXT_PHRASES.length]}`,
          ` input: ${textInput.slice(0, 16)}`,
          "",
          ` mouse drags: ${mouseDragAttempts}`,
        ].join("\n"));
        paletteTitle.setContent(" Palette");
        fgPaletteLabel.setContent(" FG ");
        bgPaletteLabel.setContent(" BG ");
        fgPaletteSlots.forEach(({ key, box }) => {
          const active = node.fg === key;
          const token = colorPair(key);
          box.style = {
            fg: active ? host.theme().body.bg : token.fg,
            bg: active ? host.theme().highlight.bg : token.bg,
            bold: active,
            inverse: false,
          };
          box.setContent(active ? "[]" : compactLabel(key));
        });
        bgPaletteSlots.forEach(({ key, box }) => {
          const active = node.bg === key;
          const token = colorPair(key);
          box.style = {
            fg: active ? host.theme().body.bg : token.fg,
            bg: active ? host.theme().highlight.bg : token.bg,
            bold: active,
            inverse: false,
          };
          box.setContent(active ? "[]" : compactLabel(key));
        });
      };

      const renderNodes = () => {
        const canvasWidth = Math.max(1, Number(canvas.width) || 1);
        const canvasHeight = Math.max(1, Number(canvas.height) || 1);
        const inspectorWidth = inspectorCollapsed ? 8 : 26;
        inspector.width = inspectorWidth;
        canvas.right = inspectorWidth;
        const gen = waveSource(24, 6, phase);
        const text = textSource(22, 5, phase);
        const input = inputSource(18, 5, textInput);
        const mix = composite(34, 8, [gen, text, input], blendMode);

        for (const node of nodes.values()) {
          node.frame.left = clamp(node.x, 0, Math.max(0, canvasWidth - node.w));
          node.frame.top = clamp(node.y, 0, Math.max(0, canvasHeight - node.h));
          node.frame.width = node.w;
          node.frame.height = node.h;
          const fg = colorPair(node.fg);
          const bg = colorPair(node.bg);
          node.frame.style = {
            fg: fg.fg,
            bg: bg.bg,
            border: { fg: selectedNode === node.id ? host.theme().highlight.fg : host.theme().muted.fg },
          };
          node.titleBar.style = selectedNode === node.id
            ? host.theme().highlight
            : { fg: fg.fg, bg: host.theme().bodyAlt.bg };
          node.titleBar.setContent(` ${selectedNode === node.id ? "●" : " "} ${node.title} `);
          node.content.style = { fg: fg.fg, bg: bg.bg };
          node.resizeGrip.style = selectedNode === node.id ? host.theme().highlight : host.theme().selected;
        }

        nodes.get("gen")?.content.setContent(gen);
        nodes.get("text")?.content.setContent(text);
        nodes.get("input")?.content.setContent(input);
        nodes.get("mix")?.content.setContent(mix);
        renderOverlay();
        renderInspector();
        orderNodes();
      };

      const bringToFront = (id: NodeId) => {
        selectedNode = id;
        const maxZ = Math.max(...[...nodes.values()].map((node) => node.z));
        const node = nodes.get(id);
        if (!node) return;
        node.z = maxZ + 1;
        renderNodes();
      };

      const selectNode = (id: NodeId) => {
        bringToFront(id);
        root.focus();
        host.screen.render();
      };

      const pointerToCanvas = (data: blessed.Widgets.Events.IMouseEventArg) => {
        const lpos = canvas.lpos;
        if (!lpos) return undefined;
        return {
          x: data.x - lpos.xi,
          y: data.y - lpos.yi,
        };
      };

      for (const node of nodes.values()) {
        const startNodeDrag = (data: blessed.Widgets.Events.IMouseEventArg) => {
          const point = pointerToCanvas(data);
          if (!point) return;
          resizing = undefined;
          dragging = {
            id: node.id,
            offsetX: point.x - node.x,
            offsetY: point.y - node.y,
          };
          mouseDragAttempts += 1;
          selectNode(node.id);
        };
        const startNodeResize = (data: blessed.Widgets.Events.IMouseEventArg) => {
          const point = pointerToCanvas(data);
          if (!point) return;
          dragging = undefined;
          resizing = {
            id: node.id,
            startW: node.w,
            startH: node.h,
            anchorX: point.x,
            anchorY: point.y,
          };
          selectNode(node.id);
        };
        node.frame.on("mousedown", (data) => startNodeDrag(data));
        node.content.on("mousedown", (data) => startNodeDrag(data));
        node.titleBar.on("mousedown", (data) => startNodeDrag(data));
        node.resizeGrip.on("mousedown", (data) => startNodeResize(data));
      }

      const onMouseMove = (data: blessed.Widgets.Events.IMouseEventArg) => {
        const point = pointerToCanvas(data);
        if (!point) return;
        if (dragging) {
          const node = nodes.get(dragging.id);
          if (!node) return;
          node.x = point.x - dragging.offsetX;
          node.y = point.y - dragging.offsetY;
          renderNodes();
          host.screen.render();
          return;
        }
        if (resizing) {
          const node = nodes.get(resizing.id);
          if (!node) return;
          node.w = clamp(resizing.startW + (point.x - resizing.anchorX), 16, 56);
          node.h = clamp(resizing.startH + (point.y - resizing.anchorY), 6, 18);
          renderNodes();
          host.screen.render();
        }
      };

      const stopDragging = () => {
        dragging = undefined;
        resizing = undefined;
      };

      const moveSelected = (dx: number, dy: number) => {
        const node = currentNode();
        if (!node) return;
        node.x += dx;
        node.y += dy;
        renderNodes();
        host.screen.render();
      };

      const cycleSelectedFg = (direction: 1 | -1) => {
        const node = currentNode();
        if (!node) return;
        node.fg = cycleColor(node.fg, FG_OPTIONS, direction);
        renderNodes();
        host.screen.render();
      };

      const cycleSelectedBg = (direction: 1 | -1) => {
        const node = currentNode();
        if (!node) return;
        node.bg = cycleColor(node.bg, BG_OPTIONS, direction);
        renderNodes();
        host.screen.render();
      };

      const resizeSelected = (dw: number, dh: number) => {
        const node = currentNode();
        if (!node) return;
        node.w = clamp(node.w + dw, 16, 56);
        node.h = clamp(node.h + dh, 6, 18);
        renderNodes();
        host.screen.render();
      };

      const handleInputToken = (input: string) => {
        if (input === "1") selectedNode = "gen";
        if (input === "2") selectedNode = "text";
        if (input === "3") selectedNode = "input";
        if (input === "4") selectedNode = "mix";
        if (input === "h") moveSelected(-1, 0);
        if (input === "j") moveSelected(0, 1);
        if (input === "k") moveSelected(0, -1);
        if (input === "l") moveSelected(1, 0);
        if (input === "[") cycleSelectedFg(-1);
        if (input === "]") cycleSelectedFg(1);
        if (input === "-") cycleSelectedBg(-1);
        if (input === "=") cycleSelectedBg(1);
        if (input === "b") blendMode = blendMode === "overwrite" ? "mask" : "overwrite";
        if (input === "i") inspectorCollapsed = !inspectorCollapsed;
        if (input === "t") {
          phase = (phase + 1) % TEXT_PHRASES.length;
        }
        if (input === ",") resizeSelected(-2, 0);
        if (input === ".") resizeSelected(2, 0);
        if (input === "n") resizeSelected(0, -1);
        if (input === "m") resizeSelected(0, 1);
        if (selectedNode === "input" && input === "\b") {
          textInput = textInput.slice(0, -1);
        } else if (selectedNode === "input" && input.length === 1 && input >= " " && input !== "\u007f") {
          textInput = `${textInput}${input}`.slice(-18);
        }
      };

      const appendInputText = (value: string) => {
        const printable = [...value]
          .filter((char) => char >= " " && char !== "\u007f")
          .join("");
        if (printable.length === 0) return;
        textInput = `${textInput}${printable}`.slice(-18);
      };

      const handleInputSequence = (value: string) => {
        if (value.length <= 1) {
          handleInputToken(value);
          return;
        }

        const [first, ...restChars] = [...value];
        const rest = restChars.join("");
        if (first) {
          handleInputToken(first);
        }
        if (selectedNode === "input" && rest.length > 0) {
          appendInputText(rest);
          return;
        }
        for (const token of restChars) {
          handleInputToken(token);
        }
      };

      const handleKeypress = (ch: string, key?: blessed.Widgets.Events.IKeyEventArg) => {
        if (host.windows.getFocusedWindow()?.id !== win.id) {
          return;
        }
        if (key?.name === "left") {
          moveSelected(-1, 0);
          return;
        }
        if (key?.name === "right") {
          moveSelected(1, 0);
          return;
        }
        if (key?.name === "up") {
          moveSelected(0, -1);
          return;
        }
        if (key?.name === "down") {
          moveSelected(0, 1);
          return;
        }
        if (key?.name === "backspace") {
          handleInputSequence("\b");
          renderNodes();
          host.screen.render();
          return;
        }
        if (ch) {
          handleInputSequence(ch);
          renderNodes();
          host.screen.render();
        }
      };

      host.screen.on("keypress", handleKeypress);
      host.screen.on("mousemove", onMouseMove);
      host.screen.on("mouseup", stopDragging);

      win.onInput((input) => {
        handleInputSequence(input);
        renderNodes();
        host.screen.render();
      });

      win.describeState(() => ({
        summary: "TouchLab MVP — 3 sources feeding one composite.",
        contentPreview: "nested drag + composite ascii pipeline",
        selectedNode,
        blendMode,
        textInput,
        pipeline: ["gen", "text", "input", "mix"],
        nodes: [...nodes.values()].map((node) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
          fg: node.fg,
          bg: node.bg,
        })),
      }));

      win.captureText(() => {
        const mix = nodes.get("mix")?.content.getContent() ?? "";
        return `TouchLab MVP\nblend=${blendMode}\nselected=${selectedNode}\n\n${mix}`;
      });

      win.onRestyle(() => {
        root.style = host.theme().body;
        inspector.style = {
          ...host.theme().bodyAlt,
          border: { fg: host.theme().accent.fg },
        };
        overlay.style = host.theme().muted;
        renderNodes();
      });

      win.onResize(() => {
        renderNodes();
      });

      win.onCleanup(() => {
        host.screen.off("keypress", handleKeypress);
        host.screen.off("mousemove", onMouseMove);
        host.screen.off("mouseup", stopDragging);
      });

      renderNodes();
      root.focus();
      win.focus();
    },
  });
}
