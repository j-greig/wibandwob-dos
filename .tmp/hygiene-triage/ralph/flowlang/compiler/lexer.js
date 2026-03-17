/**
 * FlowLang Lexer - Tokenizes source code into tokens
 */

// Token types
const TokenType = {
  // Literals
  NUMBER: 'NUMBER',
  TIME: 'TIME',
  COLOR: 'COLOR',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',

  // Identifiers and keywords
  IDENTIFIER: 'IDENTIFIER',

  // Keywords
  ELEMENT: 'ELEMENT',
  FLOW: 'FLOW',
  ON: 'ON',
  LET: 'LET',
  FN: 'FN',
  IF: 'IF',
  ELSE: 'ELSE',
  FOR: 'FOR',
  WHILE: 'WHILE',
  RETURN: 'RETURN',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  FROM: 'FROM',
  APPLY: 'APPLY',
  START: 'START',
  STOP: 'STOP',
  TOGGLE: 'TOGGLE',
  PLAY: 'PLAY',
  WAIT: 'WAIT',
  PARALLEL: 'PARALLEL',
  SEQUENCE: 'SEQUENCE',
  SPAWN: 'SPAWN',
  EASE: 'EASE',
  REPEAT: 'REPEAT',
  YOYO: 'YOYO',
  DELAY: 'DELAY',
  WITH: 'WITH',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  INFINITE: 'INFINITE',
  SHAPE: 'SHAPE',
  PATH: 'PATH',
  PARTICLES: 'PARTICLES',

  // Operators
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  SLASH: 'SLASH',
  PERCENT: 'PERCENT',
  CARET: 'CARET',
  EQUAL: 'EQUAL',
  DOUBLE_EQUAL: 'DOUBLE_EQUAL',
  NOT_EQUAL: 'NOT_EQUAL',
  GREATER: 'GREATER',
  LESS: 'LESS',
  GREATER_EQUAL: 'GREATER_EQUAL',
  LESS_EQUAL: 'LESS_EQUAL',
  ARROW: 'ARROW',           // ->
  BIND: 'BIND',             // <~>
  ONE_WAY_BIND: 'ONE_WAY_BIND', // ~>
  RANGE: 'RANGE',           // ..

  // Delimiters
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  LBRACE: 'LBRACE',
  RBRACE: 'RBRACE',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  COMMA: 'COMMA',
  COLON: 'COLON',
  SEMICOLON: 'SEMICOLON',
  AT: 'AT',

  // Special
  NEWLINE: 'NEWLINE',
  EOF: 'EOF',
  INVALID: 'INVALID'
};

const KEYWORDS = {
  'element': TokenType.ELEMENT,
  'flow': TokenType.FLOW,
  'on': TokenType.ON,
  'let': TokenType.LET,
  'fn': TokenType.FN,
  'if': TokenType.IF,
  'else': TokenType.ELSE,
  'for': TokenType.FOR,
  'while': TokenType.WHILE,
  'return': TokenType.RETURN,
  'import': TokenType.IMPORT,
  'export': TokenType.EXPORT,
  'from': TokenType.FROM,
  'apply': TokenType.APPLY,
  'start': TokenType.START,
  'stop': TokenType.STOP,
  'toggle': TokenType.TOGGLE,
  'play': TokenType.PLAY,
  'wait': TokenType.WAIT,
  'parallel': TokenType.PARALLEL,
  'sequence': TokenType.SEQUENCE,
  'spawn': TokenType.SPAWN,
  'ease': TokenType.EASE,
  'repeat': TokenType.REPEAT,
  'yoyo': TokenType.YOYO,
  'delay': TokenType.DELAY,
  'with': TokenType.WITH,
  'and': TokenType.AND,
  'or': TokenType.OR,
  'not': TokenType.NOT,
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,
  'infinite': TokenType.INFINITE,
  'shape': TokenType.SHAPE,
  'path': TokenType.PATH,
  'particles': TokenType.PARTICLES
};

class Token {
  constructor(type, value, line, column) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }

  toString() {
    return `Token(${this.type}, ${JSON.stringify(this.value)}, ${this.line}:${this.column})`;
  }
}

class Lexer {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  // Peek at current character without consuming
  peek(offset = 0) {
    const pos = this.pos + offset;
    return pos < this.source.length ? this.source[pos] : null;
  }

  // Advance and return current character
  advance() {
    const char = this.peek();
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
    return char;
  }

  // Skip whitespace (but not newlines in some contexts)
  skipWhitespace() {
    while (this.peek() && /[ \t\r]/.test(this.peek())) {
      this.advance();
    }
  }

  // Skip single-line comment
  skipLineComment() {
    while (this.peek() && this.peek() !== '\n') {
      this.advance();
    }
  }

  // Skip multi-line comment
  skipBlockComment() {
    this.advance(); // consume /
    this.advance(); // consume *

    while (this.peek()) {
      if (this.peek() === '*' && this.peek(1) === '/') {
        this.advance(); // consume *
        this.advance(); // consume /
        break;
      }
      this.advance();
    }
  }

  // Read a number (integer or float)
  readNumber() {
    const startLine = this.line;
    const startColumn = this.column;
    let num = '';

    while (this.peek() && /[0-9.]/.test(this.peek())) {
      num += this.advance();
    }

    return new Token(TokenType.NUMBER, parseFloat(num), startLine, startColumn);
  }

  // Read a time literal (@1s, @500ms, etc.)
  readTime() {
    const startLine = this.line;
    const startColumn = this.column;

    this.advance(); // consume @

    let num = '';
    while (this.peek() && /[0-9.]/.test(this.peek())) {
      num += this.advance();
    }

    let unit = '';
    while (this.peek() && /[a-z]/.test(this.peek())) {
      unit += this.advance();
    }

    // Convert to milliseconds
    const value = parseFloat(num);
    let ms = value;

    if (unit === 's') ms = value * 1000;
    else if (unit === 'ms') ms = value;
    else if (unit === 'm') ms = value * 60000;

    return new Token(TokenType.TIME, ms, startLine, startColumn);
  }

  // Read a color (#fff, #ff00ff, rgb(...))
  readColor() {
    const startLine = this.line;
    const startColumn = this.column;

    if (this.peek() === '#') {
      this.advance(); // consume #
      let hex = '#';
      while (this.peek() && /[0-9a-fA-F]/.test(this.peek())) {
        hex += this.advance();
      }
      return new Token(TokenType.COLOR, hex, startLine, startColumn);
    }

    // rgb(...) handled by identifier initially
    return null;
  }

  // Read a string literal
  readString() {
    const startLine = this.line;
    const startColumn = this.column;

    const quote = this.advance(); // consume opening quote
    let str = '';

    while (this.peek() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance(); // consume \
        const escaped = this.advance();
        // Handle escape sequences
        switch (escaped) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          case '\\': str += '\\'; break;
          case quote: str += quote; break;
          default: str += escaped;
        }
      } else {
        str += this.advance();
      }
    }

    this.advance(); // consume closing quote
    return new Token(TokenType.STRING, str, startLine, startColumn);
  }

  // Read an identifier or keyword
  readIdentifier() {
    const startLine = this.line;
    const startColumn = this.column;
    let ident = '';

    while (this.peek() && /[a-zA-Z0-9_]/.test(this.peek())) {
      ident += this.advance();
    }

    // Check if it's a keyword
    const type = KEYWORDS[ident] || TokenType.IDENTIFIER;

    // Convert true/false to boolean tokens
    if (type === TokenType.TRUE || type === TokenType.FALSE) {
      return new Token(TokenType.BOOLEAN, ident === 'true', startLine, startColumn);
    }

    return new Token(type, ident, startLine, startColumn);
  }

  // Main tokenization method
  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();

      if (this.pos >= this.source.length) break;

      const char = this.peek();
      const startLine = this.line;
      const startColumn = this.column;

      // Comments
      if (char === '/' && this.peek(1) === '/') {
        this.skipLineComment();
        continue;
      }

      if (char === '/' && this.peek(1) === '*') {
        this.skipBlockComment();
        continue;
      }

      // Newlines
      if (char === '\n') {
        this.advance();
        // this.tokens.push(new Token(TokenType.NEWLINE, '\n', startLine, startColumn));
        continue; // Skip newlines for now
      }

      // Time literals
      if (char === '@') {
        this.tokens.push(this.readTime());
        continue;
      }

      // Colors
      if (char === '#') {
        this.tokens.push(this.readColor());
        continue;
      }

      // Strings
      if (char === '"' || char === "'") {
        this.tokens.push(this.readString());
        continue;
      }

      // Numbers
      if (/[0-9]/.test(char)) {
        this.tokens.push(this.readNumber());
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(char)) {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      // Multi-character operators
      if (char === '-' && this.peek(1) === '>') {
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.ARROW, '->', startLine, startColumn));
        continue;
      }

      if (char === '<' && this.peek(1) === '~' && this.peek(2) === '>') {
        this.advance();
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.BIND, '<~>', startLine, startColumn));
        continue;
      }

      if (char === '~' && this.peek(1) === '>') {
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.ONE_WAY_BIND, '~>', startLine, startColumn));
        continue;
      }

      if (char === '.' && this.peek(1) === '.') {
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.RANGE, '..', startLine, startColumn));
        continue;
      }

      if (char === '=' && this.peek(1) === '=') {
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.DOUBLE_EQUAL, '==', startLine, startColumn));
        continue;
      }

      if (char === '!' && this.peek(1) === '=') {
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.NOT_EQUAL, '!=', startLine, startColumn));
        continue;
      }

      if (char === '>' && this.peek(1) === '=') {
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.GREATER_EQUAL, '>=', startLine, startColumn));
        continue;
      }

      if (char === '<' && this.peek(1) === '=') {
        this.advance();
        this.advance();
        this.tokens.push(new Token(TokenType.LESS_EQUAL, '<=', startLine, startColumn));
        continue;
      }

      // Single-character tokens
      const singleCharTokens = {
        '+': TokenType.PLUS,
        '-': TokenType.MINUS,
        '*': TokenType.STAR,
        '/': TokenType.SLASH,
        '%': TokenType.PERCENT,
        '^': TokenType.CARET,
        '=': TokenType.EQUAL,
        '>': TokenType.GREATER,
        '<': TokenType.LESS,
        '(': TokenType.LPAREN,
        ')': TokenType.RPAREN,
        '{': TokenType.LBRACE,
        '}': TokenType.RBRACE,
        '[': TokenType.LBRACKET,
        ']': TokenType.RBRACKET,
        ',': TokenType.COMMA,
        ':': TokenType.COLON,
        ';': TokenType.SEMICOLON
      };

      if (singleCharTokens[char]) {
        this.advance();
        this.tokens.push(new Token(singleCharTokens[char], char, startLine, startColumn));
        continue;
      }

      // Invalid character
      this.tokens.push(new Token(TokenType.INVALID, char, startLine, startColumn));
      this.advance();
    }

    // Add EOF token
    this.tokens.push(new Token(TokenType.EOF, null, this.line, this.column));

    return this.tokens;
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Lexer, Token, TokenType };
}
