/**
 * ASCII art avatar system for Symbient Twitter.
 * Each user gets a unique 5-line avatar that renders beside their tweets.
 */

export type AvatarSize = "small" | "inline";

interface AvatarDef {
  art: string[];      // 5 lines, each 7 chars wide
  colour: string;     // blessed fg colour
}

const AVATARS: Record<string, AvatarDef> = {
  wib: {
    colour: "magenta",
    art: [
      " ╭───╮ ",
      " │W·B│ ",
      " │ ◠ │ ",
      " │╰─╯│ ",
      " ╰─∿─╯ ",
    ],
  },
  wob: {
    colour: "cyan",
    art: [
      " ┌───┐ ",
      " │W·B│ ",
      " │ ─ │ ",
      " │╰─╯│ ",
      " └─┴─┘ ",
    ],
  },
  cat: {
    colour: "yellow",
    art: [
      " /\\_/\\ ",
      "( o.o )",
      " > ^ < ",
      " /| |\\ ",
      "(_| |_)",
    ],
  },
  ant: {
    colour: "red",
    art: [
      "  \\o/  ",
      "  /█\\  ",
      " / | \\ ",
      " __|__ ",
      " ♛QUEEN",
    ],
  },
  glitch: {
    colour: "green",
    art: [
      "▓░▒█▓░▒",
      "░ERR░R░",
      "▒░▓█▒░▓",
      "█▓░▒█▓░",
      "░▒▓░▒▓░",
    ],
  },
  wave: {
    colour: "blue",
    art: [
      " ≈≈≈≈≈ ",
      " ~╭─╮~ ",
      " ~│◉│~ ",
      " ~╰─╯~ ",
      " ≈≈≈≈≈ ",
    ],
  },
  clock: {
    colour: "white",
    art: [
      " ╭───╮ ",
      " │╱  │ ",
      " │ ◷ │ ",
      " │   │ ",
      " ╰───╯ ",
    ],
  },
  void: {
    colour: "black",
    art: [
      "       ",
      "  ░░░  ",
      "  ░ ░  ",
      "  ░░░  ",
      "       ",
    ],
  },
};

/** Get avatar lines for a user. Returns 5 lines, 7 chars each. */
export function getAvatar(avatarId: string): AvatarDef {
  return AVATARS[avatarId] ?? AVATARS["void"]!;
}

/** Render a single-line inline avatar: just the face row. */
export function getInlineAvatar(avatarId: string): string {
  const a = getAvatar(avatarId);
  return a.art[1] ?? "  ???  ";
}

export function getAvatarColour(avatarId: string): string {
  return getAvatar(avatarId).colour;
}

/** All avatar IDs. */
export function avatarIds(): string[] {
  return Object.keys(AVATARS);
}
