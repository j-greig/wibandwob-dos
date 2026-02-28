const FIGLET_FONT: Record<string, string[]> = {
  A: ["  A  ", " A A ", "AAAAA", "A   A", "A   A"],
  B: ["BBBB ", "B   B", "BBBB ", "B   B", "BBBB "],
  C: [" CCCC", "C    ", "C    ", "C    ", " CCCC"],
  D: ["DDDD ", "D   D", "D   D", "D   D", "DDDD "],
  E: ["EEEEE", "E    ", "EEE  ", "E    ", "EEEEE"],
  F: ["FFFFF", "F    ", "FFF  ", "F    ", "F    "],
  G: [" GGGG", "G    ", "G GGG", "G   G", " GGG "],
  H: ["H   H", "H   H", "HHHHH", "H   H", "H   H"],
  I: ["IIIII", "  I  ", "  I  ", "  I  ", "IIIII"],
  J: ["JJJJJ", "   J ", "   J ", "J  J ", " JJ  "],
  K: ["K  K ", "K K  ", "KK   ", "K K  ", "K  K "],
  L: ["L    ", "L    ", "L    ", "L    ", "LLLLL"],
  M: ["M   M", "MM MM", "M M M", "M   M", "M   M"],
  N: ["N   N", "NN  N", "N N N", "N  NN", "N   N"],
  O: [" OOO ", "O   O", "O   O", "O   O", " OOO "],
  P: ["PPPP ", "P   P", "PPPP ", "P    ", "P    "],
  Q: [" QQQ ", "Q   Q", "Q   Q", "Q  QQ", " QQQQ"],
  R: ["RRRR ", "R   R", "RRRR ", "R  R ", "R   R"],
  S: [" SSSS", "S    ", " SSS ", "    S", "SSSS "],
  T: ["TTTTT", "  T  ", "  T  ", "  T  ", "  T  "],
  U: ["U   U", "U   U", "U   U", "U   U", " UUU "],
  V: ["V   V", "V   V", "V   V", " V V ", "  V  "],
  W: ["W   W", "W   W", "W W W", "WW WW", "W   W"],
  X: ["X   X", " X X ", "  X  ", " X X ", "X   X"],
  Y: ["Y   Y", " Y Y ", "  Y  ", "  Y  ", "  Y  "],
  Z: ["ZZZZZ", "   Z ", "  Z  ", " Z   ", "ZZZZZ"],
  "0": [" 000 ", "0  00", "0 0 0", "00  0", " 000 "],
  "1": ["  1  ", " 11  ", "  1  ", "  1  ", "11111"],
  "2": [" 222 ", "2   2", "   2 ", "  2  ", "22222"],
  "3": ["3333 ", "    3", " 333 ", "    3", "3333 "],
  "4": ["4  4 ", "4  4 ", "44444", "   4 ", "   4 "],
  "5": ["55555", "5    ", "5555 ", "    5", "5555 "],
  "6": [" 666 ", "6    ", "6666 ", "6   6", " 666 "],
  "7": ["77777", "   7 ", "  7  ", " 7   ", "7    "],
  "8": [" 888 ", "8   8", " 888 ", "8   8", " 888 "],
  "9": [" 999 ", "9   9", " 9999", "    9", " 999 "],
  " ": ["  ", "  ", "  ", "  ", "  "],
  "-": ["     ", "     ", "-----", "     ", "     "],
  "!": ["  !  ", "  !  ", "  !  ", "     ", "  !  "],
  ".": ["     ", "     ", "     ", "     ", "  .  "]
};

export function renderFiglet(text: string): string {
  const upper = text.toUpperCase();
  const rows = Array.from({ length: 5 }, () => "");
  for (const char of upper) {
    const glyph = FIGLET_FONT[char] ?? FIGLET_FONT[" "];
    for (let row = 0; row < rows.length; row += 1) {
      rows[row] += `${glyph[row] ?? "     "} `;
    }
  }
  return `${rows.join("\n")}\n\n${text}`;
}
