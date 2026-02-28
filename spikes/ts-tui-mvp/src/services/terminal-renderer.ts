import type { TerminalBuffer, TerminalCell, TerminalCellStyle } from "./terminal-buffer.js";

function escapeTags(value: string): string {
  return value.replace(/[{}]/g, "\\$&");
}

function normalizeColor(color?: string): string | undefined {
  return color?.replace("bright-", "light-");
}

function openTags(style: TerminalCellStyle): string {
  const tags: string[] = [];
  const fg = normalizeColor(style.fg);
  const bg = normalizeColor(style.bg);
  if (fg) {
    tags.push(`{${fg}-fg}`);
  }
  if (bg) {
    tags.push(`{${bg}-bg}`);
  }
  if (style.bold) {
    tags.push("{bold}");
  }
  if (style.inverse) {
    tags.push("{inverse}");
  }
  return tags.join("");
}

function closeTags(style: TerminalCellStyle): string {
  const tags: string[] = [];
  if (style.inverse) {
    tags.push("{/inverse}");
  }
  if (style.bold) {
    tags.push("{/bold}");
  }
  const bg = normalizeColor(style.bg);
  if (bg) {
    tags.push(`{/${bg}-bg}`);
  }
  const fg = normalizeColor(style.fg);
  if (fg) {
    tags.push(`{/${fg}-fg}`);
  }
  return tags.join("");
}

function styleKey(style: TerminalCellStyle): string {
  return [style.fg ?? "", style.bg ?? "", style.bold ? "1" : "0", style.inverse ? "1" : "0"].join("|");
}

function sameStyle(left: TerminalCellStyle, right: TerminalCellStyle): boolean {
  return styleKey(left) === styleKey(right);
}

function styleWithCursor(cell: TerminalCell, isCursor: boolean): TerminalCellStyle {
  if (!isCursor) {
    return {
      fg: cell.fg,
      bg: cell.bg,
      bold: cell.bold,
      inverse: cell.inverse
    };
  }
  return {
    fg: cell.fg,
    bg: cell.bg,
    bold: cell.bold,
    inverse: !cell.inverse
  };
}

export function renderTerminalBuffer(buffer: TerminalBuffer, showCursor: boolean): string {
  const cursor = buffer.getCursor();
  const viewportTop = buffer.getViewportTop();
  const rows = buffer.getVisibleLines();
  const renderedRows = rows.map((row, rowIndex) => {
    let currentStyle: TerminalCellStyle = {};
    let output = "";
    row.forEach((cell, columnIndex) => {
      const isCursor = showCursor && buffer.isCursorVisible() && cursor.y === viewportTop + rowIndex && cursor.x === columnIndex;
      const nextStyle = styleWithCursor(cell, isCursor);
      if (!sameStyle(currentStyle, nextStyle)) {
        output += closeTags(currentStyle);
        output += openTags(nextStyle);
        currentStyle = nextStyle;
      }
      output += escapeTags(cell.char);
    });
    output += closeTags(currentStyle);
    return output.replace(/\s+$/g, "");
  });
  return renderedRows.join("\n");
}
