export function createScrollbar(): { ch: string; style: { bg: string } } {
  return { ch: " ", style: { bg: "white" } };
}

export function isRightClick(data?: { button?: string | number; buttons?: string | number } | null): boolean {
  if (!data) {
    return false;
  }
  return data.button === "right" || data.button === 2 || data.buttons === "right" || data.buttons === 2;
}
