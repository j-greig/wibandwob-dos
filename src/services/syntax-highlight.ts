/**
 * syntax-highlight.ts — Terminal syntax highlighter (Rich/Monokai-inspired palette).
 *
 * Ported from pi-markdown-reader prototype (wibwob-sdk/modules/pi-markdown-reader/highlight.ts).
 * Regex-based tokeniser per language. Covers Python, TypeScript/JavaScript, Bash/Shell.
 * Returns ANSI-styled lines ready for setContent on a Blessed box with tags:false.
 */

const R = "\x1b[0m";

const C = {
  comment:   "\x1b[38;5;242m\x1b[3m",
  string:    "\x1b[38;5;114m",
  fstring:   "\x1b[38;5;150m",
  number:    "\x1b[38;5;215m",
  keyword:   "\x1b[38;5;75m",
  constant:  "\x1b[38;5;141m",
  decorator: "\x1b[38;5;178m",
  builtin:   "\x1b[38;5;141m",
  funcname:  "\x1b[38;5;228m",
  classname: "\x1b[38;5;81m",
  type:      "\x1b[38;5;81m",
  operator:  "\x1b[38;5;204m",
  punct:     "\x1b[38;5;247m",
  special:   "\x1b[38;5;219m",
} as const;

// ── Python ─────────────────────────────────────────────────────────────────────

const PY_KW = /\b(?:import|from|def|class|return|if|elif|else|for|while|with|as|async|await|yield|lambda|try|except|finally|raise|pass|break|continue|and|or|not|in|is|del|global|nonlocal|assert)\b/;
const PY_CONST = /\b(?:None|True|False)\b/;
const PY_BUILTIN = /\b(?:print|len|range|list|dict|str|int|float|bool|type|isinstance|issubclass|enumerate|zip|map|filter|sorted|reversed|sum|min|max|abs|round|open|input|repr|id|dir|vars|hasattr|getattr|setattr|delattr|callable|iter|next|hash|hex|bin|oct|chr|ord|format|eval|exec|compile|super|property|staticmethod|classmethod|object)\b/;

const PY_RE = new RegExp([
  "(#[^\\n]*)",
  `((?:[fFbBrR]{0,2})?"""[^"]*"""|(?:[fFbBrR]{0,2})?'''[^']*''')`,
  `((?:[fF][rR]?|[rR][fF]?)(?:"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'))`,
  `([bBrRuU]*(?:"[^"\\\\\\n]*(?:\\\\.[^"\\\\\\n]*)*"|'[^'\\\\\\n]*(?:\\\\.[^'\\\\\\n]*)*'))`,
  "(\\b0x[0-9a-fA-F][0-9a-fA-F_]*|0b[01][01_]*|0o[0-7][0-7_]*|\\d[\\d_]*\\.?[\\d_]*(?:[eE][+-]?\\d+)?[jJ]?\\b)",
  "(@\\w+(?:\\.\\w+)*)",
  "(?<=def\\s)(\\w+)",
  "(?<=class\\s)(\\w+)",
  "(?<!['\"])\\b(self|cls)\\b(?!['\"])",
  `(${PY_KW.source})`,
  `(${PY_CONST.source})`,
  `(${PY_BUILTIN.source})`,
  "([+\\-*/%&|^~<>=!]+)",
  "([(){}\\[\\],.;:])",
].join("|"), "g");

function applyPython(line: string): string {
  PY_RE.lastIndex = 0;
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = PY_RE.exec(line)) !== null) {
    if (m.index > last) result += line.slice(last, m.index);
    const [full, comment, triple, fstr, str, num, dec, fname, cname, selfcls, kw, cst, blt, op, pct] = m;
    if (comment) result += C.comment + full + R;
    else if (triple) result += C.string + full + R;
    else if (fstr) result += C.fstring + full + R;
    else if (str) result += C.string + full + R;
    else if (num) result += C.number + full + R;
    else if (dec) result += C.decorator + full + R;
    else if (fname) result += C.funcname + full + R;
    else if (cname) result += C.classname + full + R;
    else if (selfcls) result += C.special + full + R;
    else if (kw) result += C.keyword + full + R;
    else if (cst) result += C.constant + full + R;
    else if (blt) result += C.builtin + full + R;
    else if (op) result += C.operator + full + R;
    else if (pct) result += C.punct + full + R;
    else result += full;
    last = m.index + full.length;
  }
  return result + line.slice(last);
}

// ── TypeScript / JavaScript ────────────────────────────────────────────────────

const TS_KW = /\b(?:const|let|var|function|class|interface|type|enum|import|export|from|return|if|else|for|while|do|switch|case|default|break|continue|new|delete|typeof|keyof|instanceof|as|in|of|async|await|yield|try|catch|finally|throw|extends|implements|super|this|null|undefined|true|false|void|never|readonly|public|private|protected|abstract|static|declare|namespace|module|satisfies|infer|override)\b/;
const TS_TYPE = /\b(?:string|number|boolean|object|symbol|bigint|any|unknown|Record|Array|Promise|Map|Set|WeakMap|WeakSet|Partial|Required|Readonly|Omit|Pick|Exclude|Extract|ReturnType|Parameters|InstanceType|Awaited|NonNullable)\b/;
const TS_BUILTIN = /\b(?:console|process|Math|JSON|Object|Array|String|Number|Boolean|Date|RegExp|Error|Promise|fetch|setTimeout|setInterval|clearTimeout|clearInterval|parseInt|parseFloat|isNaN|isFinite|encodeURIComponent|decodeURIComponent|structuredClone)\b/;

const TS_RE = new RegExp([
  "(\\/\\/[^\\n]*)",
  "(\\/\\*[\\s\\S]*?\\*\\/)",
  "(`[^`\\\\]*(?:\\\\.[^`\\\\]*)*`)",
  `("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*')`,
  "((?:^|(?<=[=,(;!&|?:+\\-*[{}]))\\s*)(\\/(?:[^\\/\\\\\\n]|\\\\.)+\\/[gimsuy]*)",
  "(\\b0x[0-9a-fA-F][0-9a-fA-F_]*n?|0b[01][01_]*n?|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?n?\\b)",
  "(@\\w+(?:\\.\\w+)*)",
  "(?<=function\\s)(\\w+)",
  `(${TS_KW.source})`,
  `(${TS_TYPE.source})`,
  `(${TS_BUILTIN.source})`,
  "((?<=:\\s*)\\b[A-Z]\\w*\\b)",
  "([+\\-*/%&|^~<>=!?:]+|=>|\\.\\.\\.|\\?\\?|\\?\\.|&&|\\|\\|)",
  "([(){}\\[\\],.;])",
].join("|"), "gm");

function applyTypeScript(line: string): string {
  TS_RE.lastIndex = 0;
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TS_RE.exec(line)) !== null) {
    if (m.index > last) result += line.slice(last, m.index);
    const full = m[0];
    const [, lineC, blockC, tmpl, str, , , num, dec, fname, kw, tsType, blt, capType, op, pct] = m;
    if (lineC || blockC) result += C.comment + full + R;
    else if (tmpl) result += C.fstring + full + R;
    else if (str) result += C.string + full + R;
    else if (num) result += C.number + full + R;
    else if (dec) result += C.decorator + full + R;
    else if (fname) result += C.funcname + full + R;
    else if (kw) result += C.keyword + full + R;
    else if (tsType) result += C.type + full + R;
    else if (blt) result += C.builtin + full + R;
    else if (capType) result += C.classname + full + R;
    else if (op) result += C.operator + full + R;
    else if (pct) result += C.punct + full + R;
    else result += full;
    last = m.index + full.length;
  }
  return result + line.slice(last);
}

// ── Bash / Shell ───────────────────────────────────────────────────────────────

const SH_KW = /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|in|return|export|local|readonly|declare|typeset|unset|shift|set|source|trap|exit|break|continue)\b/;
const SH_RE = new RegExp([
  "(#[^\\n]*)",
  `("(?:[^"\\\\]|\\\\.)*"|'[^']*')`,
  "(\\$[{(]?\\w+[})]?)",
  "(\\b\\d+\\b)",
  `(${SH_KW.source})`,
  "([|&;><(){}]+)",
].join("|"), "g");

function applyBash(line: string): string {
  SH_RE.lastIndex = 0;
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = SH_RE.exec(line)) !== null) {
    if (m.index > last) result += line.slice(last, m.index);
    const [full, comment, str, variable, num, kw, op] = m;
    if (comment) result += C.comment + full + R;
    else if (str) result += C.string + full + R;
    else if (variable) result += C.special + full + R;
    else if (num) result += C.number + full + R;
    else if (kw) result += C.keyword + full + R;
    else if (op) result += C.operator + full + R;
    else result += full;
    last = m.index + full.length;
  }
  return result + line.slice(last);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Syntax-highlight a block of code for terminal output.
 * Returns ANSI-styled lines (no trailing newlines).
 * Falls back to plain lines for unknown languages.
 */
export function highlightCode(code: string, lang?: string): string[] {
  const l = (lang ?? "").toLowerCase().trim();
  if (l === "python" || l === "py") return code.split("\n").map(applyPython);
  if (["typescript","ts","javascript","js","tsx","jsx"].includes(l)) return code.split("\n").map(applyTypeScript);
  if (["bash","sh","shell","zsh"].includes(l)) return code.split("\n").map(applyBash);
  return code.split("\n");
}

/** Languages with active syntax highlighting. */
export const HIGHLIGHTED_LANGUAGES = new Set(["python","py","typescript","ts","javascript","js","tsx","jsx","bash","sh","shell","zsh"]);
