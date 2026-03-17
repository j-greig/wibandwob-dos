/**
 * FlowLang Transpiler - Converts AST to JavaScript
 */

const { Lexer } = require('./lexer');
const { Parser } = require('./parser');

class Transpiler {
  constructor(ast, options = {}) {
    this.ast = ast;
    this.options = {
      standalone: true, // Generate standalone HTML
      includeRuntime: true,
      ...options
    };
    this.elements = new Map(); // Track all declared elements
    this.flows = new Map(); // Track all declared flows
    this.indent = 0;
  }

  // Generate JavaScript code
  transpile() {
    const code = this.generateProgram(this.ast);

    if (this.options.standalone) {
      return this.wrapInHTML(code);
    }

    return code;
  }

  // Generate code for entire program
  generateProgram(node) {
    const parts = [];

    // Initialize runtime
    parts.push('// FlowLang Runtime Initialization');
    parts.push('const FlowLang = {');
    parts.push('  elements: new Map(),');
    parts.push('  flows: new Map(),');
    parts.push('  timeline: [],');
    parts.push('  particles: new Map(),');
    parts.push('  easing: {');
    parts.push('    linear: t => t,');
    parts.push('    smooth: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,');
    parts.push('    bounce: t => {');
    parts.push('      const n1 = 7.5625, d1 = 2.75;');
    parts.push('      if (t < 1 / d1) return n1 * t * t;');
    parts.push('      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;');
    parts.push('      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;');
    parts.push('      return n1 * (t -= 2.625 / d1) * t + 0.984375;');
    parts.push('    },');
    parts.push('    elastic: (t, amplitude = 1, period = 0.3) => {');
    parts.push('      if (t === 0 || t === 1) return t;');
    parts.push('      const s = period / 4;');
    parts.push('      return amplitude * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / period) + 1;');
    parts.push('    },');
    parts.push('    spring: (t, stiffness = 100, damping = 10) => {');
    parts.push('      const w = Math.sqrt(stiffness);');
    parts.push('      const z = damping / (2 * Math.sqrt(stiffness));');
    parts.push('      if (z < 1) {');
    parts.push('        const wd = w * Math.sqrt(1 - z * z);');
    parts.push('        return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));');
    parts.push('      }');
    parts.push('      return 1 - Math.exp(-w * t) * (1 + w * t);');
    parts.push('    }');
    parts.push('  }');
    parts.push('};');
    parts.push('');

    // Generate code for each statement
    for (const statement of node.statements) {
      parts.push(this.generateStatement(statement));
    }

    return parts.join('\n');
  }

  // Generate code for a statement
  generateStatement(node) {
    switch (node.type) {
      case 'ElementDeclaration':
        return this.generateElement(node);
      case 'FlowDeclaration':
        return this.generateFlow(node);
      case 'ParticlesDeclaration':
        return this.generateParticles(node);
      case 'VariableDeclaration':
        return this.generateVariable(node);
      case 'TriggerStatement':
        return this.generateTrigger(node);
      case 'SequenceStatement':
        return this.generateSequence(node);
      default:
        return `// Unsupported statement: ${node.type}`;
    }
  }

  // Generate element
  generateElement(node) {
    this.elements.set(node.name, node);

    const props = {};
    for (const prop of node.properties) {
      props[prop.name] = this.generateExpression(prop.value);
    }

    const parts = [];
    parts.push(`// Element: ${node.name}`);
    parts.push(`{`);
    parts.push(`  const el = document.createElement('div');`);
    parts.push(`  el.id = '${node.name}';`);
    parts.push(`  el.style.position = 'absolute';`);

    // Apply properties
    for (const [key, value] of Object.entries(props)) {
      switch (key) {
        case 'x':
          parts.push(`  el.style.left = ${value} + 'px';`);
          break;
        case 'y':
          parts.push(`  el.style.top = ${value} + 'px';`);
          break;
        case 'width':
          parts.push(`  el.style.width = ${value} + 'px';`);
          break;
        case 'height':
          parts.push(`  el.style.height = ${value} + 'px';`);
          break;
        case 'color':
          parts.push(`  el.style.backgroundColor = ${value};`);
          break;
        case 'opacity':
          parts.push(`  el.style.opacity = ${value};`);
          break;
        case 'shape':
          if (value === "'circle'") {
            parts.push(`  el.style.borderRadius = '50%';`);
          }
          break;
        case 'content':
          parts.push(`  el.textContent = ${value};`);
          break;
        case 'fontSize':
          parts.push(`  el.style.fontSize = ${value} + 'px';`);
          break;
        case 'rotation':
          parts.push(`  el.style.transform = 'rotate(' + ${value} + 'deg)';`);
          break;
        case 'scale':
          parts.push(`  el.style.transform = 'scale(' + ${value} + ')';`);
          break;
      }
    }

    parts.push(`  document.body.appendChild(el);`);
    parts.push(`  FlowLang.elements.set('${node.name}', { el, props: ${JSON.stringify(props)} });`);
    parts.push(`}`);

    return parts.join('\n');
  }

  // Generate flow (animation)
  generateFlow(node) {
    this.flows.set(node.name, node);

    const parts = [];
    parts.push(`// Flow: ${node.name}`);
    parts.push(`FlowLang.flows.set('${node.name}', {`);
    parts.push(`  target: '${node.target}',`);
    parts.push(`  keyframes: [`);

    for (const kf of node.keyframes) {
      const time = this.generateExpression(kf.time);
      const props = kf.properties.map(p =>
        `    { property: '${p.name}', value: ${this.generateExpression(p.value)} }`
      ).join(',\n');
      parts.push(`    { time: ${time}, properties: [\n${props}\n    ] },`);
    }

    parts.push(`  ],`);

    // Animation properties
    let ease = 'linear';
    let repeat = 1;
    let yoyo = false;
    let delay = 0;

    for (const prop of node.animProperties) {
      if (prop.name === 'ease') {
        ease = this.generateExpression(prop.value).replace(/'/g, '');
      } else if (prop.name === 'repeat') {
        const repeatValue = this.generateExpression(prop.value);
        repeat = repeatValue === 'Infinity' ? -1 : repeatValue;
      } else if (prop.name === 'yoyo') {
        yoyo = this.generateExpression(prop.value);
      } else if (prop.name === 'delay') {
        delay = this.generateExpression(prop.value);
      }
    }

    parts.push(`  ease: '${ease}',`);
    parts.push(`  repeat: ${repeat},`);
    parts.push(`  yoyo: ${yoyo},`);
    parts.push(`  delay: ${delay}`);
    parts.push(`});`);

    return parts.join('\n');
  }

  // Generate particles
  generateParticles(node) {
    const parts = [];
    parts.push(`// Particles: ${node.name}`);
    parts.push(`{`);
    parts.push(`  const particles = [];`);
    parts.push(`  const count = ${this.generateExpression(node.count)};`);
    parts.push(`  for (let i = 0; i < count; i++) {`);
    parts.push(`    const p = document.createElement('div');`);
    parts.push(`    p.style.position = 'absolute';`);

    // Apply spawn properties
    for (const prop of node.spawnProperties) {
      const value = this.generateExpression(prop.value);
      switch (prop.name) {
        case 'x':
          parts.push(`    p.style.left = ${value} + 'px';`);
          break;
        case 'y':
          parts.push(`    p.style.top = ${value} + 'px';`);
          break;
        case 'width':
          parts.push(`    p.style.width = ${value} + 'px';`);
          break;
        case 'height':
          parts.push(`    p.style.height = ${value} + 'px';`);
          break;
        case 'color':
          parts.push(`    p.style.backgroundColor = ${value};`);
          break;
        case 'opacity':
          parts.push(`    p.style.opacity = ${value};`);
          break;
        case 'shape':
          if (value === "'circle'") {
            parts.push(`    p.style.borderRadius = '50%';`);
          }
          break;
      }
    }

    parts.push(`    p.dataset.initial = JSON.stringify({ x: p.style.left, y: p.style.top });`);
    parts.push(`    document.body.appendChild(p);`);
    parts.push(`    particles.push(p);`);
    parts.push(`  }`);
    parts.push(`  FlowLang.particles.set('${node.name}', particles);`);
    parts.push(`}`);

    return parts.join('\n');
  }

  // Generate variable
  generateVariable(node) {
    return `const ${node.name} = ${this.generateExpression(node.value)};`;
  }

  // Generate trigger
  generateTrigger(node) {
    const parts = [];

    if (node.event === 'load') {
      parts.push(`window.addEventListener('DOMContentLoaded', () => {`);
    } else if (node.event === 'click') {
      parts.push(`document.addEventListener('click', () => {`);
    } else {
      parts.push(`// Event: ${node.event}`);
      parts.push(`document.addEventListener('${node.event}', () => {`);
    }

    for (const action of node.actions) {
      if (action.action === 'start' || action.action === 'play') {
        parts.push(`  FlowLang.animate('${action.target}');`);
      } else if (action.action === 'spawn') {
        parts.push(`  // Spawn particles: ${action.target}`);
      }
    }

    parts.push(`});`);

    return parts.join('\n');
  }

  // Generate sequence
  generateSequence(node) {
    // For now, simplified
    return `// Sequence: ${node.name || 'anonymous'}`;
  }

  // Generate expression
  generateExpression(node) {
    if (!node) return 'undefined';

    switch (node.type) {
      case 'Literal':
        return this.generateLiteral(node);
      case 'Identifier':
        return node.name;
      case 'BinaryExpression':
        return `(${this.generateExpression(node.left)} ${node.operator} ${this.generateExpression(node.right)})`;
      case 'UnaryExpression':
        return `(${node.operator}${this.generateExpression(node.operand)})`;
      case 'FunctionCall':
        return this.generateFunctionCall(node);
      case 'MemberExpression':
        return `${this.generateExpression(node.object)}.${this.generateExpression(node.property)}`;
      case 'ArrayLiteral':
        return `[${node.elements.map(e => this.generateExpression(e)).join(', ')}]`;
      default:
        return `/* ${node.type} */`;
    }
  }

  // Generate literal
  generateLiteral(node) {
    switch (node.valueType) {
      case 'number':
        return String(node.value);
      case 'time':
        return String(node.value); // Already in milliseconds
      case 'color':
        return `'${node.value}'`;
      case 'string':
        return `'${node.value}'`;
      case 'boolean':
        return String(node.value);
      default:
        return 'null';
    }
  }

  // Generate function call
  generateFunctionCall(node) {
    const args = node.args.map(arg => this.generateExpression(arg)).join(', ');

    // Map FlowLang functions to JS
    if (node.name === 'random') {
      return `(Math.random() * (${node.args[1] ? this.generateExpression(node.args[1]) : 1} - ${this.generateExpression(node.args[0])}) + ${this.generateExpression(node.args[0])})`;
    }

    return `${node.name}(${args})`;
  }

  // Wrap in HTML
  wrapInHTML(jsCode) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlowLang Output</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body>
  <script>
${jsCode}

// FlowLang Animation Engine
FlowLang.animate = function(flowName) {
  const flow = FlowLang.flows.get(flowName);
  if (!flow) {
    console.error('Flow not found:', flowName);
    return;
  }

  const targetData = FlowLang.elements.get(flow.target);
  if (!targetData) {
    console.error('Element not found:', flow.target);
    return;
  }

  const el = targetData.el;
  const keyframes = flow.keyframes;
  const easeFn = FlowLang.easing[flow.ease] || FlowLang.easing.linear;

  // Simple animation using Web Animations API
  const cssKeyframes = [];

  for (const kf of keyframes) {
    const frame = {};
    const offset = kf.time / Math.max(...keyframes.map(k => k.time));

    for (const prop of kf.properties) {
      const cssProperty = {
        'opacity': 'opacity',
        'x': 'left',
        'y': 'top',
        'rotation': 'transform',
        'scale': 'transform'
      }[prop.property] || prop.property;

      if (cssProperty === 'left' || cssProperty === 'top') {
        frame[cssProperty] = prop.value + 'px';
      } else if (cssProperty === 'transform' && prop.property === 'rotation') {
        frame[cssProperty] = \`rotate(\${prop.value}deg)\`;
      } else if (cssProperty === 'transform' && prop.property === 'scale') {
        frame[cssProperty] = \`scale(\${prop.value})\`;
      } else {
        frame[cssProperty] = prop.value;
      }
    }

    frame.offset = offset;
    cssKeyframes.push(frame);
  }

  const duration = Math.max(...keyframes.map(k => k.time));
  const iterations = flow.repeat === -1 ? Infinity : flow.repeat;

  el.animate(cssKeyframes, {
    duration: duration,
    iterations: iterations,
    easing: flow.ease === 'smooth' ? 'ease-in-out' :
            flow.ease === 'bounce' ? 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' :
            'linear',
    delay: flow.delay || 0,
    direction: flow.yoyo ? 'alternate' : 'normal',
    fill: 'forwards'
  });
};
  </script>
</body>
</html>`;
  }
}

// Compile FlowLang source to JavaScript/HTML
function compile(source, options = {}) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const transpiler = new Transpiler(ast, options);
  return transpiler.transpile();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Transpiler, compile };
}
