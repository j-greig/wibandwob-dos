/**
 * FlowLang Parser - Generates Abstract Syntax Tree from tokens
 */

const { TokenType } = require('./lexer');

// AST Node Types
class ASTNode {
  constructor(type) {
    this.type = type;
  }
}

class Program extends ASTNode {
  constructor(statements) {
    super('Program');
    this.statements = statements;
  }
}

class ElementDeclaration extends ASTNode {
  constructor(name, properties) {
    super('ElementDeclaration');
    this.name = name;
    this.properties = properties;
  }
}

class FlowDeclaration extends ASTNode {
  constructor(name, target, keyframes, animProperties) {
    super('FlowDeclaration');
    this.name = name;
    this.target = target;
    this.keyframes = keyframes;
    this.animProperties = animProperties;
  }
}

class Keyframe extends ASTNode {
  constructor(time, properties) {
    super('Keyframe');
    this.time = time;
    this.properties = properties;
  }
}

class VariableDeclaration extends ASTNode {
  constructor(name, value) {
    super('VariableDeclaration');
    this.name = name;
    this.value = value;
  }
}

class FunctionDeclaration extends ASTNode {
  constructor(name, params, body) {
    super('FunctionDeclaration');
    this.name = name;
    this.params = params;
    this.body = body;
  }
}

class ParticlesDeclaration extends ASTNode {
  constructor(name, count, spawnProperties, flows) {
    super('ParticlesDeclaration');
    this.name = name;
    this.count = count;
    this.spawnProperties = spawnProperties;
    this.flows = flows;
  }
}

class SequenceStatement extends ASTNode {
  constructor(steps) {
    super('SequenceStatement');
    this.steps = steps;
  }
}

class ParallelStatement extends ASTNode {
  constructor(flows) {
    super('ParallelStatement');
    this.flows = flows;
  }
}

class TriggerStatement extends ASTNode {
  constructor(event, actions) {
    super('TriggerStatement');
    this.event = event;
    this.actions = actions;
  }
}

class ActionStatement extends ASTNode {
  constructor(action, target) {
    super('ActionStatement');
    this.action = action; // start, stop, toggle, play, spawn
    this.target = target;
  }
}

class WaitStatement extends ASTNode {
  constructor(duration) {
    super('WaitStatement');
    this.duration = duration;
  }
}

class ApplyStatement extends ASTNode {
  constructor(functionName, args) {
    super('ApplyStatement');
    this.functionName = functionName;
    this.args = args;
  }
}

class Property extends ASTNode {
  constructor(name, value) {
    super('Property');
    this.name = name;
    this.value = value;
  }
}

class BinaryExpression extends ASTNode {
  constructor(operator, left, right) {
    super('BinaryExpression');
    this.operator = operator;
    this.left = left;
    this.right = right;
  }
}

class UnaryExpression extends ASTNode {
  constructor(operator, operand) {
    super('UnaryExpression');
    this.operator = operator;
    this.operand = operand;
  }
}

class FunctionCall extends ASTNode {
  constructor(name, args) {
    super('FunctionCall');
    this.name = name;
    this.args = args;
  }
}

class MemberExpression extends ASTNode {
  constructor(object, property) {
    super('MemberExpression');
    this.object = object;
    this.property = property;
  }
}

class Identifier extends ASTNode {
  constructor(name) {
    super('Identifier');
    this.name = name;
  }
}

class Literal extends ASTNode {
  constructor(valueType, value) {
    super('Literal');
    this.valueType = valueType; // number, time, color, string, boolean
    this.value = value;
  }
}

class ArrayLiteral extends ASTNode {
  constructor(elements) {
    super('ArrayLiteral');
    this.elements = elements;
  }
}

class ObjectLiteral extends ASTNode {
  constructor(properties) {
    super('ObjectLiteral');
    this.properties = properties;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  // Get current token
  current() {
    return this.tokens[this.pos];
  }

  // Peek ahead
  peek(offset = 1) {
    return this.tokens[this.pos + offset];
  }

  // Consume and return current token
  advance() {
    return this.tokens[this.pos++];
  }

  // Check if current token matches type
  match(...types) {
    return types.includes(this.current().type);
  }

  // Consume token if it matches, otherwise error
  expect(type, message) {
    if (this.current().type !== type) {
      this.error(message || `Expected ${type}, got ${this.current().type}`);
    }
    return this.advance();
  }

  // Error reporting
  error(message) {
    const token = this.current();
    throw new Error(`Parse error at ${token.line}:${token.column}: ${message}`);
  }

  // Parse entire program
  parse() {
    const statements = [];

    while (!this.match(TokenType.EOF)) {
      statements.push(this.parseStatement());
    }

    return new Program(statements);
  }

  // Parse a statement
  parseStatement() {
    if (this.match(TokenType.ELEMENT)) {
      return this.parseElementDeclaration();
    }

    if (this.match(TokenType.FLOW)) {
      return this.parseFlowDeclaration();
    }

    if (this.match(TokenType.PARTICLES)) {
      return this.parseParticlesDeclaration();
    }

    if (this.match(TokenType.LET)) {
      return this.parseVariableDeclaration();
    }

    if (this.match(TokenType.FN)) {
      return this.parseFunctionDeclaration();
    }

    if (this.match(TokenType.ON)) {
      return this.parseTriggerStatement();
    }

    if (this.match(TokenType.SEQUENCE)) {
      return this.parseSequenceStatement();
    }

    if (this.match(TokenType.APPLY)) {
      return this.parseApplyStatement();
    }

    this.error(`Unexpected token: ${this.current().type}`);
  }

  // Parse element declaration
  parseElementDeclaration() {
    this.expect(TokenType.ELEMENT);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACE);

    const properties = [];
    while (!this.match(TokenType.RBRACE)) {
      properties.push(this.parseProperty());
    }

    this.expect(TokenType.RBRACE);
    return new ElementDeclaration(name, properties);
  }

  // Parse flow declaration
  parseFlowDeclaration() {
    this.expect(TokenType.FLOW);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.ON);
    const target = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACE);

    const keyframes = [];
    const animProperties = [];

    while (!this.match(TokenType.RBRACE)) {
      if (this.match(TokenType.TIME)) {
        keyframes.push(this.parseKeyframe());
      } else {
        animProperties.push(this.parseProperty());
      }
    }

    this.expect(TokenType.RBRACE);
    return new FlowDeclaration(name, target, keyframes, animProperties);
  }

  // Parse keyframe
  parseKeyframe() {
    // Lexer combines @ and time into single TIME token
    if (!this.match(TokenType.TIME)) {
      this.error('Expected time literal');
    }
    const time = this.advance();

    this.expect(TokenType.ARROW);

    // Parse properties (can be single or object)
    let properties = [];

    if (this.match(TokenType.LBRACE)) {
      this.advance();
      while (!this.match(TokenType.RBRACE)) {
        properties.push(this.parseProperty());
      }
      this.expect(TokenType.RBRACE);
    } else {
      properties.push(this.parseProperty());
    }

    return new Keyframe(new Literal('time', time.value), properties);
  }

  // Parse particles declaration
  parseParticlesDeclaration() {
    this.expect(TokenType.PARTICLES);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACE);

    let count = null;
    let spawnProperties = [];
    const flows = [];

    while (!this.match(TokenType.RBRACE)) {
      if (this.match(TokenType.IDENTIFIER)) {
        const propName = this.current().value;

        if (propName === 'count') {
          this.advance();
          this.expect(TokenType.COLON);
          count = this.parseExpression();
        } else {
          this.error(`Unexpected property in particles: ${propName}`);
        }
      } else if (this.match(TokenType.SPAWN)) {
        // "spawn" is a keyword token
        this.advance();
        this.expect(TokenType.COLON);
        this.expect(TokenType.LBRACE);
        while (!this.match(TokenType.RBRACE)) {
          spawnProperties.push(this.parseProperty());
        }
        this.expect(TokenType.RBRACE);
      } else if (this.match(TokenType.FLOW)) {
        flows.push(this.parseFlowDeclaration());
      } else {
        this.error('Expected count, spawn, or flow in particles declaration');
      }
    }

    this.expect(TokenType.RBRACE);
    return new ParticlesDeclaration(name, count, spawnProperties, flows);
  }

  // Parse variable declaration
  parseVariableDeclaration() {
    this.expect(TokenType.LET);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.EQUAL);
    const value = this.parseExpression();
    return new VariableDeclaration(name, value);
  }

  // Parse function declaration
  parseFunctionDeclaration() {
    this.expect(TokenType.FN);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LPAREN);

    const params = [];
    while (!this.match(TokenType.RPAREN)) {
      params.push(this.expect(TokenType.IDENTIFIER).value);
      if (this.match(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RPAREN);
    this.expect(TokenType.LBRACE);

    const body = [];
    while (!this.match(TokenType.RBRACE)) {
      body.push(this.parseStatement());
    }

    this.expect(TokenType.RBRACE);
    return new FunctionDeclaration(name, params, body);
  }

  // Parse trigger statement (on event { ... })
  parseTriggerStatement() {
    this.expect(TokenType.ON);
    const event = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACE);

    const actions = [];
    while (!this.match(TokenType.RBRACE)) {
      if (this.match(TokenType.START, TokenType.STOP, TokenType.TOGGLE, TokenType.PLAY, TokenType.SPAWN)) {
        const action = this.advance().value;
        const target = this.expect(TokenType.IDENTIFIER).value;
        actions.push(new ActionStatement(action, target));
      } else {
        this.error('Expected action (start, stop, toggle, play, spawn)');
      }
    }

    this.expect(TokenType.RBRACE);
    return new TriggerStatement(event, actions);
  }

  // Parse sequence statement
  parseSequenceStatement() {
    this.expect(TokenType.SEQUENCE);
    const name = this.match(TokenType.IDENTIFIER) ? this.advance().value : null;
    this.expect(TokenType.LBRACE);

    const steps = [];
    while (!this.match(TokenType.RBRACE)) {
      if (this.match(TokenType.PLAY)) {
        this.advance();
        const target = this.expect(TokenType.IDENTIFIER).value;
        steps.push(new ActionStatement('play', target));
      } else if (this.match(TokenType.WAIT)) {
        this.advance();
        const duration = this.expect(TokenType.TIME);
        steps.push(new WaitStatement(new Literal('time', duration.value)));
      } else if (this.match(TokenType.PARALLEL)) {
        steps.push(this.parseParallelStatement());
      } else {
        this.error('Expected play, wait, or parallel in sequence');
      }
    }

    this.expect(TokenType.RBRACE);
    const seq = new SequenceStatement(steps);
    if (name) seq.name = name;
    return seq;
  }

  // Parse parallel statement
  parseParallelStatement() {
    this.expect(TokenType.PARALLEL);
    this.expect(TokenType.LBRACE);

    const flows = [];
    while (!this.match(TokenType.RBRACE)) {
      if (this.match(TokenType.PLAY)) {
        this.advance();
        const target = this.expect(TokenType.IDENTIFIER).value;
        flows.push(new ActionStatement('play', target));
      } else {
        this.error('Expected play in parallel block');
      }
    }

    this.expect(TokenType.RBRACE);
    return new ParallelStatement(flows);
  }

  // Parse apply statement
  parseApplyStatement() {
    this.expect(TokenType.APPLY);
    const funcCall = this.parseFunctionCall();
    return new ApplyStatement(funcCall.name, funcCall.args);
  }

  // Parse property (name: value)
  parseProperty() {
    // Allow keywords as property names (e.g., "ease:", "repeat:")
    let name;
    if (this.match(TokenType.IDENTIFIER)) {
      name = this.advance().value;
    } else {
      // Accept keywords as property names
      name = this.advance().value;
    }
    this.expect(TokenType.COLON);
    const value = this.parseExpression();
    return new Property(name, value);
  }

  // Parse expression
  parseExpression() {
    return this.parseLogicalOr();
  }

  // Parse logical OR
  parseLogicalOr() {
    let left = this.parseLogicalAnd();

    while (this.match(TokenType.OR)) {
      const op = this.advance().value;
      const right = this.parseLogicalAnd();
      left = new BinaryExpression(op, left, right);
    }

    return left;
  }

  // Parse logical AND
  parseLogicalAnd() {
    let left = this.parseEquality();

    while (this.match(TokenType.AND)) {
      const op = this.advance().value;
      const right = this.parseEquality();
      left = new BinaryExpression(op, left, right);
    }

    return left;
  }

  // Parse equality
  parseEquality() {
    let left = this.parseComparison();

    while (this.match(TokenType.DOUBLE_EQUAL, TokenType.NOT_EQUAL)) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = new BinaryExpression(op, left, right);
    }

    return left;
  }

  // Parse comparison
  parseComparison() {
    let left = this.parseAddition();

    while (this.match(TokenType.GREATER, TokenType.LESS, TokenType.GREATER_EQUAL, TokenType.LESS_EQUAL)) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = new BinaryExpression(op, left, right);
    }

    return left;
  }

  // Parse addition/subtraction
  parseAddition() {
    let left = this.parseMultiplication();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = new BinaryExpression(op, left, right);
    }

    return left;
  }

  // Parse multiplication/division
  parseMultiplication() {
    let left = this.parseUnary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = new BinaryExpression(op, left, right);
    }

    return left;
  }

  // Parse unary expressions
  parseUnary() {
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const op = this.advance().value;
      const operand = this.parseUnary();
      return new UnaryExpression(op, operand);
    }

    return this.parsePrimary();
  }

  // Parse primary expressions
  parsePrimary() {
    // Literals
    if (this.match(TokenType.NUMBER)) {
      const val = this.advance().value;
      return new Literal('number', val);
    }

    if (this.match(TokenType.TIME)) {
      const val = this.advance().value;
      return new Literal('time', val);
    }

    if (this.match(TokenType.COLOR)) {
      const val = this.advance().value;
      return new Literal('color', val);
    }

    if (this.match(TokenType.STRING)) {
      const val = this.advance().value;
      return new Literal('string', val);
    }

    if (this.match(TokenType.BOOLEAN)) {
      const val = this.advance().value;
      return new Literal('boolean', val);
    }

    if (this.match(TokenType.INFINITE)) {
      this.advance();
      return new Literal('number', Infinity);
    }

    // Array literal
    if (this.match(TokenType.LBRACKET)) {
      return this.parseArrayLiteral();
    }

    // Object literal (inline)
    if (this.match(TokenType.LBRACE)) {
      return this.parseObjectLiteral();
    }

    // Parenthesized expression
    if (this.match(TokenType.LPAREN)) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    // Identifier or function call
    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.advance().value;

      // Function call
      if (this.match(TokenType.LPAREN)) {
        this.pos--; // Back up
        return this.parseFunctionCall();
      }

      // Member access
      let expr = new Identifier(name);
      while (this.match(TokenType.DOT)) {
        this.advance();
        const property = this.expect(TokenType.IDENTIFIER).value;
        expr = new MemberExpression(expr, new Identifier(property));
      }

      return expr;
    }

    this.error(`Unexpected token in expression: ${this.current().type}`);
  }

  // Parse function call
  parseFunctionCall() {
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LPAREN);

    const args = [];
    while (!this.match(TokenType.RPAREN)) {
      args.push(this.parseExpression());
      if (this.match(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RPAREN);
    return new FunctionCall(name, args);
  }

  // Parse array literal
  parseArrayLiteral() {
    this.expect(TokenType.LBRACKET);
    const elements = [];

    while (!this.match(TokenType.RBRACKET)) {
      elements.push(this.parseExpression());
      if (this.match(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACKET);
    return new ArrayLiteral(elements);
  }

  // Parse object literal
  parseObjectLiteral() {
    this.expect(TokenType.LBRACE);
    const properties = [];

    while (!this.match(TokenType.RBRACE)) {
      properties.push(this.parseProperty());
      if (this.match(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE);
    return new ObjectLiteral(properties);
  }
}

// Add DOT token type for member access (missed earlier)
TokenType.DOT = 'DOT';

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Parser,
    // Export all AST node types
    ASTNode,
    Program,
    ElementDeclaration,
    FlowDeclaration,
    Keyframe,
    VariableDeclaration,
    FunctionDeclaration,
    ParticlesDeclaration,
    SequenceStatement,
    ParallelStatement,
    TriggerStatement,
    ActionStatement,
    WaitStatement,
    ApplyStatement,
    Property,
    BinaryExpression,
    UnaryExpression,
    FunctionCall,
    MemberExpression,
    Identifier,
    Literal,
    ArrayLiteral,
    ObjectLiteral
  };
}
