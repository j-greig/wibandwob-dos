# OpenAPI→CLI Tools: Detailed Comparison Matrix

Generated March 13, 2026

---

## Quick Reference Table

| Tool | Type | Language | Stars | Maintained | TS/Bun | Learning Curve | Auto-Gen | Best For |
|------|------|----------|-------|-----------|--------|-----------------|----------|----------|
| **oclif** | Framework | TS | 8k | ✅ Yes | ✅ Excellent | Medium | No | Large CLIs, plugins |
| **commander.js** | Library | JS/TS | 27k | ✅ Yes | ✅ Full | Low | No | Dynamic/simple CLIs |
| **yargs** | Library | JS/TS | 3.5k | ✅ Yes | ✅ Full | Low | No | Advanced parsing |
| **httpie** | Tool | Python | 32k | ✅ Yes | ❌ No | None | No | Manual API exploration |
| **OpenAPI Gen** | Generator | Java | 20k | ✅ Yes | ✅ Partial | High | ✅ Yes | Multi-language SDK |
| **Prism** | Mock/Proxy | TS | 4.5k | ✅ Yes | ✅ Excellent | Medium | No | API validation |
| **curlie** | Tool | Go | 2.5k | ⚠️ Limited | ❌ No | None | No | Manual exploration |
| **q** | Tool | Go | 200 | ⚠️ Limited | ❌ No | None | No | Query-based REST |

---

## Detailed Feature Matrix

### Code Generation Capabilities
```
Tool                 | OpenAPI→Client | OpenAPI→CLI | OpenAPI→Types | Runtime Parsing |
---------------------|----------------|-------------|----------------|-----------------|
oclif                | ❌ No          | ❌ No       | ❌ No          | 🟡 Via plugin   |
commander.js         | ❌ No          | ❌ No       | ❌ No          | ✅ Easy (manual)|
yargs                | ❌ No          | ❌ No       | ❌ No          | ✅ Easy (manual)|
OpenAPI Generator    | ✅ Yes         | ❌ No       | ✅ Yes         | ❌ No           |
Prism                | ❌ No          | ❌ No       | ❌ No          | ✅ Server mode  |
httpie               | ❌ No          | ❌ No       | ❌ No          | ✅ Ad-hoc       |
```

### TypeScript/Bun Compatibility
```
Tool                 | Native TS | Bun Runtime | Type Defs | Async/Await |
---------------------|-----------|-------------|-----------|------------|
oclif                | ✅ Yes    | ✅ Yes      | ✅ Full   | ✅ Yes     |
commander.js         | ✅ Yes    | ✅ Yes      | ✅ Full   | ✅ Yes     |
yargs                | ✅ Yes    | ✅ Yes      | ✅ Full   | ✅ Yes     |
OpenAPI Generator    | 🟡 Partial| ✅ Yes      | ✅ Yes    | ✅ Yes     |
Prism                | ✅ Yes    | ✅ Yes      | ✅ Full   | ✅ Yes     |
httpie               | ❌ No     | 🟡 Subprocess| ❌ No    | N/A        |
```

---

## Code Example Comparison

All examples: calling `GET /commands/list` from WibWob-DOS API

### 1. commander.js (Simplest)

**File:** `cli.ts`

```typescript
import { program } from 'commander';

async function main() {
  // Load OpenAPI spec
  const spec = await fetch('http://localhost:8099/openapi.json')
    .then(r => r.json());
  
  // For each path in spec, register a command
  for (const [path, methods] of Object.entries(spec.paths)) {
    const pathParts = path.split('/').filter(Boolean);
    const commandName = pathParts.join('-');
    
    for (const [method, operation] of Object.entries(methods)) {
      const cmd = program
        .command(`${method.toLowerCase()} ${path}`)
        .description(operation.summary || 'API call')
        .option('-j, --json', 'Pretty-print JSON')
        .action(async (options) => {
          const url = `http://localhost:8099${path}`;
          const response = await fetch(url, {
            method: method.toUpperCase()
          });
          const data = await response.json();
          
          if (options.json) {
            console.log(JSON.stringify(data, null, 2));
          } else {
            console.log(data);
          }
        });
    }
  }
  
  program.parse(process.argv);
}

main().catch(console.error);
```

**Run:**
```bash
bun cli.ts get /commands/list --json
# Output: { commands: [ ... ], ... }
```

**Pros:** 5-minute implementation, works immediately, fully dynamic
**Cons:** No compile-time validation, startup overhead

---

### 2. oclif (Framework Approach)

**Setup:**
```bash
npx oclif generate my-cli
cd my-cli
npm install
```

**File:** `src/commands/api.ts`

```typescript
import { Command, Flags, Args } from '@oclif/core';
import fetch from 'node-fetch';

export default class ApiCommand extends Command {
  static override description = 'Call WibWob API endpoints';

  static override args = {
    method: Args.string({
      required: true,
      description: 'HTTP method (GET, POST, etc)',
    }),
    path: Args.string({
      required: true,
      description: 'API path',
    }),
  };

  static override flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Pretty-print JSON output',
    }),
    data: Flags.string({
      char: 'd',
      description: 'Request body (JSON)',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ApiCommand);
    
    const url = `http://localhost:8099${args.path}`;
    const response = await fetch(url, {
      method: args.method.toUpperCase(),
      headers: flags.data ? { 'Content-Type': 'application/json' } : undefined,
      body: flags.data,
    });
    
    const data = await response.json();
    
    if (flags.json) {
      this.log(JSON.stringify(data, null, 2));
    } else {
      this.log(JSON.stringify(data));
    }
  }
}
```

**Run:**
```bash
my-cli api GET /commands/list --json
# Output with help text, colors, etc.
```

**Pros:** Professional CLI tool, plugin system, great help, widely used
**Cons:** More boilerplate, requires command files per endpoint (or dynamic registration)

---

### 3. OpenAPI Generator (Multi-Language)

**Setup:**
```bash
npm install @openapitools/openapi-generator-cli

# Download WibWob spec
curl http://localhost:8099/openapi.json > spec.json

# Generate TypeScript client
openapi-generator-cli generate \
  -i spec.json \
  -g typescript-axios \
  -o generated-client
```

**Generated Client Usage:**
```typescript
import { DefaultApi } from './generated-client';
import { AxiosBasicAuth } from 'axios';

async function main() {
  const api = new DefaultApi(undefined, 'http://localhost:8099');
  
  const commands = await api.commandsList();
  console.log(JSON.stringify(commands, null, 2));
}

main().catch(console.error);
```

**Pros:** Type-safe, works with many languages, IDE autocomplete
**Cons:** Generated code can be large, requires offline spec, build step

---

### 4. httpie (Subprocess)

**From WibWob module:**
```typescript
import { spawn } from 'child_process';

async function callApi(method: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('http', [
      method.toUpperCase(),
      `http://localhost:8099${path}`
    ]);
    
    let output = '';
    proc.stdout.on('data', (data) => output += data);
    proc.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`http exited with code ${code}`));
    });
  });
}

// Usage
const result = await callApi('GET', '/commands/list');
console.log(result); // Pretty-printed JSON with colors
```

**Pros:** Immediate, no integration needed, familiar syntax
**Cons:** Subprocess overhead, not a "generated" CLI

---

### 5. Prism (API Validation)

**Setup:**
```bash
npm install -g @stoplight/prism-cli

# Download spec
curl http://localhost:8099/openapi.json > spec.json

# Start mock server with validation
prism mock spec.json --port 4010
```

**Usage:**
```bash
# Now you can call the mock server (validates all requests)
http GET http://localhost:4010/commands/list

# Original API calls also get validated by Prism if running as proxy
```

**Pros:** Runtime validation, good for testing API contracts
**Cons:** Requires separate service, not a CLI generator per se

---

## Cloud Provider Patterns (Documentation)

### AWS CLI v2 Architecture

**How AWS does it:**

1. **Spec Definition (YAML/JSON)**
   ```yaml
   # botocore/data/ec2/2016-11-15/service-2.json
   operations:
     DescribeInstances:
       name: DescribeInstances
       http:
         method: POST
         requestUri: /
       input:
         shape: DescribeInstancesRequest
   ```

2. **Code Generation (Build Time)**
   ```bash
   # Internal generator reads botocore specs
   # Outputs: awscli/commands/*.py
   # Each command maps to a service operation
   ```

3. **Command Structure**
   ```bash
   aws ec2 describe-instances --instance-ids i-1234567890abcdef0
   # ^ service ^ operation/resource ^ parameters
   ```

4. **Registration (Python)**
   ```python
   # awscli/commands/ec2.py
   class EC2(BaseCommand):
       def __init__(self):
           # Load botocore service definition
           # Register all operations as subcommands
   ```

---

### gcloud (Google Cloud) Pattern

**Nested Command Structure:**
```bash
gcloud compute instances create my-instance \
  --zone=us-central1-a \
  --machine-type=n1-standard-1
# gcloud [service] [resource] [action] [flags]
```

**Generated from discovery doc:**
```json
{
  "resources": {
    "compute": {
      "resources": {
        "instances": {
          "methods": {
            "create": { ... }
          }
        }
      }
    }
  }
}
```

---

### Azure CLI Pattern

**Approach:**
```bash
az vm create --resource-group mygroup --name myvm
# az [service] [command] [flags]
```

**Generation:**
```python
# Auto-generated from Azure REST API specs
# azure-cli/command_modules/vm/commands.py
class VmCreateCommand(CLICommandsLoader):
    def _load_commands(self):
        # Registers 'create' operation
```

---

## Practical Decision Tree

```
Do you need a CLI tool right now?
├─ YES
│  ├─ Small/simple (<10 endpoints)?
│  │  └─→ Use commander.js + dynamic builder (1 file, 50 lines)
│  │
│  ├─ Medium/complex (10-50 endpoints)?
│  │  ├─ Want framework support (plugins, help)?
│  │  │  └─→ Use oclif (scaffold + hand-wire commands)
│  │  └─ Want minimal boilerplate?
│  │     └─→ Use commander.js + generator script
│  │
│  └─ Large (50+ endpoints)?
│     ├─ Multi-language clients needed?
│     │  └─→ Use OpenAPI Generator + oclif wrapper
│     └─ TypeScript only?
│        └─→ Use oclif + custom generator plugin
│
└─ NO
   └─→ Use httpie/curlie for ad-hoc exploration
```

---

## Recommendation for WibWob-DOS

### MVP (Week 1)
**Tool:** commander.js  
**Approach:** Dynamic registration at startup  
**Effort:** 1 file, ~100 lines of TypeScript  
**Result:** Full CLI covering all /openapi.json endpoints

### v2 (If CLI becomes core feature)
**Tool:** oclif  
**Approach:** Scaffold + hand-wire key commands  
**Effort:** ~500 lines total  
**Result:** Professional CLI with plugins, help, etc.

### Research Path
1. Implement commander.js MVP
2. Test with WibWob API
3. Document in `.agents/module-dev/openapi-cli-generator.md`
4. Evaluate oclif if CLI usage grows

---

## File Structure for MVP Implementation

```
modules/wibwob-api-cli/
├── index.ts              # Module entry point
├── cli-builder.ts        # OpenAPI→command registration
├── command-executor.ts   # Execute commands, format output
├── module.json           # Module metadata
└── README.md             # Usage guide
```

### Key File: `cli-builder.ts`

```typescript
import { program } from 'commander';
import type { OpenAPI3Spec } from './types';

export async function buildCLI(): Promise<void> {
  const spec: OpenAPI3Spec = await fetch(
    'http://localhost:8099/openapi.json'
  ).then(r => r.json());

  // Register commands from paths
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
      
      const commandName = `${method.toLowerCase()} ${path}`;
      
      program
        .command(commandName)
        .description(operation.summary)
        .action(async () => {
          const response = await fetch(`http://localhost:8099${path}`, {
            method: method.toUpperCase()
          });
          const data = await response.json();
          console.log(JSON.stringify(data, null, 2));
        });
    }
  }

  program.parse(process.argv);
}
```

---

## Conclusion

**No single "openapi-cli-generator" tool exists as a popular, maintained package.**

Instead, adopt **commander.js** as the MVP and scale to **oclif** if needed. Both are:
- TypeScript-native
- Bun-compatible
- Production-ready
- Widely adopted

The pattern used by cloud providers (AWS, gcloud, Azure) is:
- **Build-time code generation** from specs
- **Runtime command dispatch** via framework
- Not fully runtime-parsed (too slow)

For WibWob-DOS, **runtime parsing with commander.js** is acceptable because:
- Startup happens once per session
- CLI is optional/exploratory feature
- Reduces maintenance burden

---

**Last Updated:** March 13, 2026  
**Status:** Research Complete, MVP Path Clear
