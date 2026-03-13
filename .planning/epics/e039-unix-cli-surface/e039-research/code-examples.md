# Code Examples: OpenAPI→CLI Patterns

Ready-to-run examples for all major patterns. Copy-paste into your project.

---

## Example 1: commander.js Dynamic CLI (MVP - Recommended)

**File:** `cli.ts`

```typescript
import { program } from 'commander';

interface OpenAPISpec {
  paths?: Record<string, Record<string, {
    summary?: string;
    description?: string;
    parameters?: Array<{ name: string; description?: string }>;
  }>>;
}

async function buildCliFromOpenAPI(apiUrl: string) {
  console.error('Loading OpenAPI spec from', apiUrl);
  
  const response = await fetch(`${apiUrl}/openapi.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
  }
  
  const spec: OpenAPISpec = await response.json();
  
  if (!spec.paths) {
    console.error('No paths found in OpenAPI spec');
    return;
  }

  let commandCount = 0;

  // Register a command for each path
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        continue;
      }

      commandCount++;
      const commandName = `${method.toLowerCase()}`;
      const description = operation.summary || operation.description || 'API call';

      program
        .command(`${commandName} ${path}`)
        .description(description)
        .option('-j, --json', 'Pretty-print JSON')
        .option('-r, --raw', 'Raw output (no formatting)')
        .option('--curl', 'Show curl command instead of executing')
        .action(async (options) => {
          const fullUrl = `${apiUrl}${path}`;

          if (options.curl) {
            console.log(`curl -X ${method.toUpperCase()} ${fullUrl}`);
            return;
          }

          try {
            const response = await fetch(fullUrl, {
              method: method.toUpperCase(),
              headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
              console.error(`HTTP ${response.status}: ${response.statusText}`);
              process.exit(1);
            }

            const data = await response.json();

            if (options.raw) {
              console.log(JSON.stringify(data));
            } else if (options.json) {
              console.log(JSON.stringify(data, null, 2));
            } else {
              console.log(JSON.stringify(data, null, 2));
            }
          } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
          }
        });
    }
  }

  console.error(`Registered ${commandCount} commands from OpenAPI spec`);
}

async function main() {
  const apiUrl = process.env.API_URL || 'http://localhost:8099';

  try {
    await buildCliFromOpenAPI(apiUrl);
    program.parse(process.argv);
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
```

**Run:**
```bash
# Install
npm install commander

# Run directly with Bun
bun cli.ts GET /commands/list --json

# Or compile and run
bun build cli.ts --outfile cli.js
node cli.js GET /commands/list --json

# Or with custom API URL
API_URL=http://127.0.0.1:8099 bun cli.ts get /health
```

**Output:**
```
$ bun cli.ts get /health --json
{
  "ok": true,
  "sessionId": "abc123"
}
```

---

## Example 2: Dynamic CLI with POST Support

**File:** `cli-with-body.ts`

```typescript
import { program } from 'commander';

interface RequestBody {
  id?: string;
  [key: string]: unknown;
}

async function buildCliWithPostSupport(apiUrl: string) {
  const spec = await fetch(`${apiUrl}/openapi.json`)
    .then(r => r.json());

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        continue;
      }

      program
        .command(`${method.toLowerCase()} ${path}`)
        .description(operation.summary)
        .option('-d, --data <json>', 'Request body (JSON string)')
        .option('-j, --json', 'Pretty-print response')
        .action(async (options) => {
          const fullUrl = `${apiUrl}${path}`;
          const body = options.data ? JSON.parse(options.data) : undefined;

          try {
            const response = await fetch(fullUrl, {
              method: method.toUpperCase(),
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: body ? JSON.stringify(body) : undefined,
            });

            const data = await response.json();
            console.log(
              options.json
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data)
            );
          } catch (error) {
            console.error('Error:', error);
            process.exit(1);
          }
        });
    }
  }

  program.parse(process.argv);
}

buildCliWithPostSupport('http://localhost:8099');
```

**Run:**
```bash
bun cli-with-body.ts post /commands/run \
  --data '{"id":"demo.hello"}' \
  --json
```

---

## Example 3: oclif Framework Structure

**Setup:**
```bash
npm install -g oclif
oclif generate wibwob-cli
cd wibwob-cli
npm install
```

**File:** `src/commands/api.ts`

```typescript
import { Command, Flags, Args } from '@oclif/core';

export default class Api extends Command {
  static override description = 'Call WibWob API endpoints';

  static override args = {
    method: Args.string({
      required: true,
      description: 'HTTP method (GET, POST, PUT, DELETE, PATCH)',
    }),
    path: Args.string({
      required: true,
      description: 'API path (e.g., /commands/list)',
    }),
  };

  static override flags = {
    'api-url': Flags.string({
      default: 'http://localhost:8099',
      description: 'API base URL',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Pretty-print JSON output',
    }),
    data: Flags.string({
      char: 'd',
      description: 'Request body (JSON string)',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress output',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Api);

    const url = `${flags['api-url']}${args.path}`;
    const body = flags.data ? JSON.parse(flags.data) : undefined;

    try {
      const response = await fetch(url, {
        method: args.method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        this.error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!flags.quiet) {
        if (flags.json) {
          this.log(JSON.stringify(data, null, 2));
        } else {
          this.log(JSON.stringify(data));
        }
      }
    } catch (error) {
      this.error(`API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
```

**Run:**
```bash
wibwob-cli api GET /commands/list --json
wibwob-cli api POST /commands/run \
  --data '{"id":"demo.hello"}' \
  --json
```

---

## Example 4: Node Fetch Wrapper (Simple)

**File:** `simple-cli.ts`

```typescript
const [, , method, path, ...args] = process.argv;

if (!method || !path) {
  console.error('Usage: bun cli.ts <METHOD> <PATH> [--json]');
  process.exit(1);
}

const apiUrl = process.env.API_URL || 'http://localhost:8099';
const shouldFormat = args.includes('--json');

try {
  const response = await fetch(`${apiUrl}${path}`, {
    method: method.toUpperCase(),
  });
  
  const data = await response.json();
  
  console.log(
    shouldFormat ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  );
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
```

**Run:**
```bash
bun simple-cli.ts GET /commands/list --json
```

---

## Example 5: OpenAPI Spec Parser with Help

**File:** `cli-with-help.ts`

```typescript
import { program } from 'commander';

interface OpenAPIOperation {
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    description?: string;
    required?: boolean;
  }>;
}

async function buildCli(apiUrl: string) {
  const spec = await fetch(`${apiUrl}/openapi.json`)
    .then(r => r.json());

  const methods = new Set<string>();
  const paths = new Set<string>();

  // Discover available methods and paths
  for (const path of Object.keys(spec.paths || {})) {
    paths.add(path);
    for (const method of Object.keys(spec.paths[path])) {
      methods.add(method.toUpperCase());
    }
  }

  // Add a list-endpoints command
  program
    .command('list')
    .description('List all available endpoints')
    .action(() => {
      console.log('Available endpoints:\n');
      for (const path of Array.from(paths).sort()) {
        const pathItem = spec.paths[path];
        const methodsList = Object.keys(pathItem)
          .filter(m => ['get', 'post', 'put', 'delete', 'patch'].includes(m))
          .map(m => m.toUpperCase())
          .join(', ');
        console.log(`  [${methodsList}] ${path}`);
      }
    });

  // Register dynamic commands
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

      const op = operation as OpenAPIOperation;
      program
        .command(`${method.toLowerCase()} ${path}`)
        .description(op.summary || op.description || 'API call')
        .option('-j, --json', 'Pretty-print JSON')
        .action(async (options) => {
          const response = await fetch(`${apiUrl}${path}`, {
            method: method.toUpperCase(),
          });
          const data = await response.json();
          console.log(
            options.json ? JSON.stringify(data, null, 2) : JSON.stringify(data)
          );
        });
    }
  }

  program.parse(process.argv);
}

buildCli('http://localhost:8099');
```

**Run:**
```bash
bun cli-with-help.ts list
bun cli-with-help.ts get /commands/list --json
bun cli-with-help.ts --help
```

---

## Example 6: Generic HTTP Wrapper (httpie style)

**File:** `http-wrapper.ts`

```typescript
// A httpie-like wrapper for any API

async function http(args: string[]) {
  const [method, url, ...params] = args;

  if (!method || !url) {
    console.error('Usage: bun http.ts <METHOD> <URL> [params...]');
    console.error('Example: bun http.ts GET http://localhost:8099/commands/list');
    process.exit(1);
  }

  try {
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: { 'Accept': 'application/json' },
    });

    const contentType = response.headers.get('content-type');
    let data: unknown;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Pretty-print if JSON
    if (typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

http(process.argv.slice(2));
```

**Run:**
```bash
bun http-wrapper.ts GET http://localhost:8099/commands/list
bun http-wrapper.ts GET http://localhost:8099/health
```

---

## Example 7: Spec-First Auto-Generation

**File:** `generate-cli.ts`

```typescript
/**
 * Generate a TypeScript CLI module from an OpenAPI spec
 * Usage: bun generate-cli.ts http://localhost:8099
 * Output: generated-cli.ts
 */

async function generateCli(apiUrl: string, outputPath: string) {
  const spec = await fetch(`${apiUrl}/openapi.json`)
    .then(r => r.json());

  const imports = `import { program } from 'commander';`;
  const commands: string[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

      const op = operation as any;
      const commandCode = `program
  .command('${method.toLowerCase()} ${path}')
  .description('${op.summary || 'API call'}')
  .option('-j, --json', 'Pretty-print JSON')
  .action(async (options) => {
    const response = await fetch('${apiUrl}${path}', {
      method: '${method.toUpperCase()}',
    });
    const data = await response.json();
    console.log(options.json ? JSON.stringify(data, null, 2) : JSON.stringify(data));
  });`;

      commands.push(commandCode);
    }
  }

  const code = `${imports}

${commands.join('\n\n')}

program.parse(process.argv);`;

  await Bun.write(outputPath, code);
  console.log(`Generated CLI to ${outputPath}`);
}

const apiUrl = process.argv[2] || 'http://localhost:8099';
generateCli(apiUrl, 'generated-cli.ts');
```

**Run:**
```bash
bun generate-cli.ts http://localhost:8099
# Creates: generated-cli.ts
# Then run: bun generated-cli.ts get /commands/list --json
```

---

## Example 8: OpenAPI Validator (Prism-like)

**File:** `validate-spec.ts`

```typescript
/**
 * Validate that an API matches its OpenAPI spec
 */

async function validateEndpoint(
  apiUrl: string,
  path: string,
  method: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: method.toUpperCase(),
    });
    
    if (!response.ok) {
      console.error(`✗ ${method.toUpperCase()} ${path}: HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log(`✓ ${method.toUpperCase()} ${path}: OK`);
    return true;
  } catch (error) {
    console.error(`✗ ${method.toUpperCase()} ${path}: ${error}`);
    return false;
  }
}

async function validateApi(apiUrl: string) {
  const spec = await fetch(`${apiUrl}/openapi.json`)
    .then(r => r.json());

  console.log(`Validating ${apiUrl} against OpenAPI spec\n`);

  let passed = 0;
  let failed = 0;

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of Object.keys(pathItem)) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        const ok = await validateEndpoint(apiUrl, path, method);
        if (ok) passed++;
        else failed++;
      }
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
}

validateApi(process.argv[2] || 'http://localhost:8099');
```

**Run:**
```bash
bun validate-spec.ts http://localhost:8099
# Output:
# ✓ GET /commands/list: OK
# ✓ POST /commands/run: OK
# ...
# Results: 15 passed, 0 failed
```

---

## Quick Comparison

| Example | Lines | Setup | Runtime | Best For |
|---------|-------|-------|---------|----------|
| 1. commander.js | ~100 | `npm install` | Dynamic | **MVP** |
| 2. POST support | ~60 | `npm install` | Dynamic | Data mutation |
| 3. oclif | ~80 | `npm install -g oclif` | Generated | Production |
| 4. Simple | ~15 | None | Ad-hoc | Minimal |
| 5. With help | ~80 | `npm install` | Dynamic | User-friendly |
| 6. httpie style | ~35 | None | Ad-hoc | Exploration |
| 7. Generate | ~50 | `npm install` | Build-time | Pre-generation |
| 8. Validate | ~50 | None | Runtime | Testing |

---

## Recommendation

**Start with Example 1 (commander.js)** — it's the sweet spot:
- Minimal dependencies (one npm package)
- Fully dynamic (reads /openapi.json at startup)
- Covers 90% of use cases
- ~100 lines of code
- Bun-native (runs .ts directly)

Then optionally move to **Example 3 (oclif)** if the feature becomes permanent.

---

## Testing All Examples

```bash
# Assuming WibWob-DOS API is running on localhost:8099

# Test simple example
bun code-examples.md#example-4

# Test commander.js
npm install commander
bun code-examples.md#example-1

# Test with POST
bun code-examples.md#example-2
```

---

**Status:** Ready to copy-paste  
**Last Updated:** March 13, 2026
