# CLI-to-API Bridge Pattern Research

**Research Date:** March 13, 2026  
**Projects Analyzed:** 7 production systems (Docker, Kubernetes, GitHub, Stripe, Vercel, tmux, i3/sway)  
**Focus:** How successful projects implement CLI-to-API boundaries, and what WibWob-DOS can learn

---

## Executive Summary

All seven projects studied make similar architectural choices despite different languages, scales, and domains:

1. **Commands are hand-written**, never auto-generated (only SDK clients are auto-generated from specs)
2. **State models vary**: REST systems use request-response; local systems (tmux, i3) use server state + command protocol
3. **Output formatting** splits into two philosophies:
   - **Human-first** (Docker, GitHub, Vercel): readable table by default + `--json` escape hatch
   - **Machine-first** (Stripe, i3/sway): JSON by default, pretty-printing as separate layer
4. **Command registration** uses one of three patterns: static table, framework auto-discovery, or dynamic discovery API
5. **Extensibility** favors simple command tables over magic auto-discovery

**For WibWob-DOS:** Your current architecture is better than most of these projects. You already have:
- Structured state service (state-service.ts)
- Single command source of truth (command-catalog.ts)
- Control API (port 8099)
- Proper separation of concerns

The main opportunity is to **lean harder into the state-query model** and adopt **machine-first output formatting**.

---

## Part 1: Individual Project Architectures

### 1. Docker CLI → Docker Engine REST API

**Technology:** Go  
**Repository:** docker/cli (separate from docker/moby engine)  
**Commands:** Hand-written  
**SDK:** Auto-generated from OpenAPI spec (stripe-go is similar pattern)

**Structure:**
```
docker/cli/cmd/docker/
├── container/
│   ├── run.go      # explicit RunCommand handler
│   ├── ps.go
│   └── ...
├── image/
│   ├── build.go
│   └── ...
└── docker.go       # command registry: map[name]Command
```

**Command Registration:**
```go
// Each command is a function that implements:
type Command interface {
    Run() error
}

// Registry is a global map:
var Commands = map[string]Command{
    "container run": &ContainerRunCommand{},
    "image build": &ImageBuildCommand{},
}
```

**API Mapping:**
- Uses docker/docker/client library
- Calls like: `client.ContainerList()`, `client.ContainerCreate()`
- **Important:** API calls are NOT one-to-one with CLI commands
  - `docker run` actually calls ContainerCreate + ContainerStart + ContainerLogs
  - The command decides which API methods to chain

**Output Formatting:**
```go
// Formatter interface:
type Formatter interface {
    Format(context.Context, items []interface{}) error
}

// Implementations: TableFormatter, JSONFormatter, RawFormatter
// Usage: docker ps --format=json, docker ps --format=table, docker ps --quiet
```

**Adding New Commands:**
1. Create `cmd/docker/YOUR_COMMAND/command.go` with `Command` interface
2. Register in `docker.go`
3. Call client methods
4. Implement formatter if needed
**Friction:** Moderate — straightforward pattern but repetitive boilerplate

**Composability:**
- Piping works with `--quiet` (removes formatting) or `--format=raw`
- JSON output with `--format=json` for jq piping
- Human-centric by default

---

### 2. Kubernetes kubectl → Kubernetes API Server

**Technology:** Go  
**Repository:** kubernetes/kubernetes (monolithic)  
**Commands:** Hand-written BUT heavily systematic  
**Auto-generation:** YES — via code-gen tools, but not of commands themselves

**Key Innovation: Dynamic Discovery**

Instead of pre-registering all possible commands, kubectl discovers them at runtime:

```bash
$ kubectl api-resources          # Queries /openapis/v1
pod
service
deployment
namespace
cronjob
...

$ kubectl get <resource>         # Works for ANY resource (including CRDs)
$ kubectl apply -f <yaml>        # Same command structure for all
```

**Architecture:**
```
cmd/kubectl/
├── cmd/
│   ├── apply/
│   ├── get/
│   ├── describe/
│   └── ... (action commands)
├── discovery/ (fetches /openapis from apiserver)
└── discovery.go (caches available resources)
```

**Command Registration:**
- Not a static table
- Commands are registered with `Command.NewCmd()` reflection pattern
- Each command (get, apply, describe) has internal resource type handling

**API Mapping:**
```go
// kubectl doesn't map directly to OpenAPI operations
// Instead, it constructs REST requests dynamically:
req := client.APIForResource(resource).
    For(namespace).
    Get().
    Name(name).
    Do()
```

**Output Formatting:**
```bash
kubectl get pod -o wide
kubectl get pod -o json
kubectl get pod -o yaml
kubectl get pod -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image
kubectl get pod -o jsonpath='{.items[*].metadata.name}'
```
All via `-o` / `--output` flag. Very powerful filtering without external tools.

**Adding New Commands:**
1. If adding API resource: define CRD YAML, controller-gen auto-generates types
2. If adding kubectl command: write handler in `cmd/`, integrates with discovery
3. **Friction:** Low for resources (just write YAML), moderate for new command types

**Key Insight:**
- kubectl's power comes from **server-side schema discovery**
- Client doesn't need to know what's available; server tells it
- Scales to thousands of custom resources (CRDs) without CLI code changes

**Composability:**
- JSON/YAML output excellent for piping
- Custom columns and jsonpath let you filter at source (don't need jq)
- VERY Unix-friendly design

---

### 3. GitHub CLI (gh) → GitHub REST/GraphQL API

**Technology:** Go  
**Repository:** cli/cli  
**Commands:** Hand-written  
**Queries:** Hand-written GraphQL and REST queries

**Structure:**
```
cmd/gh/
├── auth/
├── issue/
│   ├── create.go      # gh issue create
│   ├── list.go        # gh issue list
│   └── view.go
├── pr/
│   └── ...
└── ...
```

**Command Registration:**
```go
// Each command is a function:
func (cmd *IssueCreateCommand) Run(ctx context.Context, args []string) error {
    // Parse flags, call GraphQL, format output
}
// Registered in parent command: RootCmd.AddCommand(IssueCreateCommand)
```

**API Mapping:**
- **GraphQL for complex queries** (relationships, nested fields)
- **REST for simple operations** (auth, checking status)
- Queries hand-written because:
  - GraphQL doesn't auto-generate (unlike REST OpenAPI)
  - UX choice to use GraphQL over REST for better DX

**Example:**
```go
// gh issue list calls:
type IssueListQuery struct {
    Repository struct {
        Issues struct {
            Nodes []Issue
        } `graphql:"issues(first: $first)"`
    } `graphql:"repository(owner: $owner, name: $name)"`
}

// Hand-written GraphQL builder, then make request
client.Query(ctx, &q, variables)
```

**Output Formatting:**
```bash
gh issue list              # Human table (default)
gh issue list --json       # JSON (machine-readable)
gh issue list --template '{{.title}}'  # Go templates
```

**Adding New Commands:**
1. Create `cmd/gh/YOUR_COMMAND/root.go`
2. Write GraphQL query (if needed)
3. Implement formatter
4. Register in parent command group
**Friction:** Moderate-high — requires understanding GraphQL

**Composability:**
- `--json` flag good for piping to jq
- Less flexible than kubectl (fewer output formats)
- Designed more for human happiness than script-heavy workflows

**Key Insight:**
- gh chose GraphQL because REST API required too many round-trips
- Prioritized human UX (pretty tables, helpful errors) over Unix composability
- More opinionated than Docker or kubectl

---

### 4. Stripe CLI → Stripe REST API

**Technology:** Go  
**Repository:** stripe/stripe-cli  
**Commands:** Hand-written  
**SDK:** stripe-go is auto-generated from OpenAPI spec

**Structure:**
```
cmd/
├── resources/
│   ├── customers.go    # stripe customers list, stripe customers get
│   ├── charges.go
│   └── ...
├── samples/
└── trigger/            # unique: webhook testing
```

**Command Registration:**
```go
// Simple resources pattern:
type CustomerCommand struct{}
func (c *CustomerCommand) List(ctx context.Context) error {
    // Use stripe-go client: stripe.CustomerList()
}
```

**API Mapping:**
- Pure wrapper around stripe-go SDK
- stripe-go IS auto-generated from Stripe's OpenAPI spec
- But CLI commands themselves are hand-written

**Output Formatting:**
```bash
stripe customers list           # Colored JSON (default)
stripe customers list --raw     # Plain JSON
```
**Only JSON** — no table format. By design, meant to be composable.

**Adding New Commands:**
1. Create `cmd/resources/YOUR_RESOURCE.go`
2. Call stripe-go methods
3. JSON output (automatic)
**Friction:** Very low — minimal boilerplate

**Composability:**
- JSON-only = trivial to pipe to jq
- Very Unix-friendly
- Example: `stripe events list --raw | jq '.data[] | select(.type == "charge.succeeded")'`

**Key Insight:**
- Stripe's approach: **"API output = protocol, no formatting layer needed"**
- Opposite philosophy from Docker (human-first)
- Works because Stripe has a small, focused command set

---

### 5. Vercel CLI → Vercel Deployment API

**Technology:** Node.js/TypeScript  
**Framework:** oclif  
**Commands:** Hand-written  
**Includes:** Deployment engine (not just API wrapper)

**Structure:**
```
packages/cli/src/commands/
├── deploy.ts          # oclif Command subclass
├── env/
│   ├── list.ts
│   ├── pull.ts
│   └── set.ts
└── ...
```

**Command Registration (via oclif):**
```typescript
// Each command extends Command:
export default class Deploy extends Command {
  async run() {
    // Parse args, call API or deploy engine
  }
}
// oclif auto-discovers from file system
```

**API Mapping:**
- Uses @vercel/client library
- Methods like: `client.getUser()`, `client.createDeployment()`
- Bundled with actual deployment machinery (git integration, build steps)
- NOT a thin API wrapper

**Output Formatting:**
```bash
vercel                    # Interactive human experience
vercel --json            # Machine-readable
vercel --prod --quiet    # Minimal
```

**Adding New Commands:**
1. Create `packages/cli/src/commands/YOUR_COMMAND.ts`
2. Extend `Command` class
3. Parse flags, call API, output
4. oclif auto-discovers (no manual registration)
**Friction:** Low — oclif scaffolding helps a lot

**Composability:**
- `--json` flag available
- More human-centric UX (progress spinners, pretty tables)
- Deployment machinery makes it less of a pure API wrapper

**Key Insight:**
- oclif framework is ergonomic for adding commands (zero registration boilerplate)
- Framework handles boilerplate that Docker/Stripe do manually
- Still hand-written commands (framework doesn't auto-generate logic)

---

### 6. tmux → tmux Server IPC

**Technology:** C  
**Architecture:** VERY different from REST models  
**Commands:** Hand-written C functions  
**Protocol:** Binary, local socket

**Structure:**
- Monolithic tmux server with client connections
- Socket: `~/.tmux/default` or `$TMUX` env var
- Not HTTP, not REST — command-based architecture

**Command Pattern:**
```c
// cmd_send_keys.c:
int cmd_send_keys_exec(struct cmd_q *cmdq, struct cmd_entry *cme) {
    // State mutation: send keys to target session:window.pane
}

// cmd_list_windows.c:
int cmd_list_windows_exec(struct cmd_q *cmdq, struct cmd_entry *cme) {
    // State query: format windows as table, return to client
}
```

**Command Registration:**
```c
// cmd-queue.c:
struct cmd_entry cmd_send_keys_entry = {
    .name = "send-keys",
    .alias = "send",
    .args = { "t:", "l", "M" },  // args specification
    .exec = cmd_send_keys_exec,
};
// Table of all commands
```

**Execution Model (Different from REST):**
- Client sends command packet (binary: command code + args)
- Server executes command (state mutation OR state query)
- Server sends back output (if query) or status (if mutation)
- Client prints/renders output

**Output Formatting:**
```bash
tmux list-windows              # Formatted table
tmux list-windows -F "#{window_name}"  # Template
```
Very limited compared to Docker/kubectl. Mostly hard-coded formatting.

**IPC Protocol:**
Not REST-like at all. More like:
```
Client: [SEND_KEYS] ["session:window.pane"] ["command"]
Server: [OK]

Client: [LIST_WINDOWS] ["session"]
Server: [WINDOW] [window_id] [window_name] [...]
```

**Adding New Commands:**
1. Create `cmd_YOUR_COMMAND.c` with `cmd_YOUR_COMMAND_exec()`
2. Add to command entry table in `cmd-queue.c`
3. Parse arguments, implement execution
4. Rebuild entire tmux
**Friction:** High — C code, rebuild cycle, no framework help

**Composability:**
- Can pipe output: `tmux list-windows | grep active`
- Can call programmatically: `tmux send-keys -t session "command" Enter`
- But IPC protocol is opaque binary, not text/JSON

**Key Insight:**
- tmux is NOT a thin CLI wrapper over an API
- Rather, it's a **command-oriented server with local socket**
- Each command either mutates state or queries it
- Very different architecture from REST

---

### 7. i3 / sway IPC → Window Manager Protocol

**Technology:** C  
**Architecture:** Similar to tmux, but JSON-based instead of binary  
**Commands:** Hand-written C functions  
**Protocol:** Binary socket with JSON payloads

**Structure:**
- Monolithic window manager (i3 or sway)
- Socket: `~/.i3/ipc.sock` or `/run/user/1000/sway-ipc.*.sock`
- Protocol: binary framing + JSON payload

**IPC Protocol (Much cleaner than tmux):**
```
Message format: [magic="i3-ipc"][length:u32][type:u32][payload:json]

Types:
  1 = RUN_COMMAND ("focus left", "workspace 1")
  2 = GET_WORKSPACES (→ json array of workspaces)
  3 = SUBSCRIBE (→ event stream)
  4 = GET_OUTPUTS (→ json array of outputs)
  5 = GET_TREE (→ entire window hierarchy as json)
  ...
```

**Command Examples:**
```bash
# Via swaymsg CLI tool (wraps socket protocol):
swaymsg -t command "focus left"           # RUN_COMMAND
swaymsg -t get_workspaces                 # GET_WORKSPACES → JSON
swaymsg -t get_tree | jq '.nodes'        # GET_TREE → JSON → jq
```

**Architecture:**
- Commands in sway/commands/ (e.g., `focus.c`, `move.c`)
- Command parser tokenizes input, dispatches to handler
- Responses are structured JSON, not formatted strings

**Output Formatting:**
All responses are JSON. Pretty-printing happens in client tool (swaymsg).

**Adding New Commands:**
1. Create `sway/commands/YOUR_COMMAND.c`
2. Implement handler function
3. Register in command parser
4. Rebuild sway
**Friction:** High — C code, rebuild needed

**Composability:**
- Excellent! All responses are JSON
- Example: `swaymsg -t get_tree | jq '.nodes[] | select(.type == "workspace")'`
- Unlike tmux, responses are easily parseable

**Key Insight:**
- i3/sway nailed the **JSON-first protocol with CLI wrapper** model
- Client tool (swaymsg) translates JSON ↔ human
- Very clean separation: protocol is structured, display is separate layer

---

## Part 2: Comparative Analysis

### Command Authorship Patterns

| Project | Auto-Gen | Hand-Written | Notes |
|---------|----------|--------------|-------|
| Docker | ❌ CLI | ✅ REST client | Client SDK auto-generated, CLI is manual |
| kubectl | ✅ Some | ✅ Most | Framework scaffolding helps, discovery at runtime |
| GitHub | ❌ | ✅ CLI + GraphQL | Fully hand-written, including queries |
| Stripe | ❌ CLI | ✅ REST client | Client SDK auto-generated, CLI is manual |
| Vercel | ❌ | ✅ oclif scaffolding | Framework reduces boilerplate |
| tmux | ❌ | ✅ C functions | No framework, pure C |
| i3/sway | ❌ | ✅ C functions | No framework, pure C |

**Pattern:** Every project hand-writes its CLI commands. Auto-generation only happens for SDK/client libraries.

**Why?** Commands embed UX choices that can't be auto-generated:
- Which endpoints to chain (docker run = create + start + logs)
- Output formatting strategy (table vs json)
- Error handling and retries
- Human-friendly naming (might differ from API)

---

### Output Formatting Philosophies

**Philosophy A: Human-First (Docker, GitHub, Vercel)**
```
Default: Readable table with colors/progress
Escape: --json, --format, --raw flags
Rationale: "Most users are human, scripts use --json"
Problem: Developers forget --json, makes scripting hard
```

**Philosophy B: Machine-First (Stripe, i3/sway)**
```
Default: Structured output (JSON)
Display: Pretty-printing in client tool
Rationale: "Protocol is protocol, rendering is separate"
Problem: Harder to learn for humans
Benefit: Trivial to script
```

**Scorecard:**
| Philosophy | Stripe | Docker | GitHub | kubectl | tmux |
|------------|--------|--------|--------|---------|------|
| Human-First | ❌ | ✅ | ✅ | Medium | ❌ |
| Machine-First | ✅ | ❌ | ❌ | ✅ | ❌ |
| JSON-by-default | ✅ | ❌ | ❌ | Medium | ❌ |
| Pretty-printing | Colors only | Yes | Yes | Yes | Limited |

**Winner: kubectl** — offers both human-friendly tables AND structured output. Gives users choice.

---

### Command Registration Patterns

**Pattern A: Static Command Table (Docker, Stripe, tmux, i3/sway)**
```go
var Commands = map[string]Command{
    "container run": &RunCommand{},
    "image build": &BuildCommand{},
}
// At dispatch time: Commands[cmd_name].Run()
```
**Pros:** Simple, fast, explicit  
**Cons:** Boilerplate to register each command

**Pattern B: Framework Auto-Discovery (Vercel/oclif, GitHub/cobra)**
```bash
packages/cli/src/commands/
├── deploy.ts       # oclif auto-discovers
├── env/
│   ├── list.ts
│   └── set.ts
```
**Pros:** Zero registration boilerplate  
**Cons:** Framework lock-in

**Pattern C: Dynamic Discovery (kubectl)**
```
Client queries /openapis at runtime
Server responds with available resources + versions
Client builds commands on-the-fly
```
**Pros:** Scales to thousands of resources, CRDs  
**Cons:** Complex, requires server cooperation

---

### State Model: Request-Response vs State + Commands

**Model A: Request-Response (REST, Docker, Stripe, GitHub, Vercel)**
```
Client: GET /containers
Server: [{ id, name, state }, ...]
Client: POST /containers/abc/start
Server: { success: true }
```
- Each command = one or more HTTP calls
- Stateless server
- Used by cloud APIs

**Model B: State + Commands (tmux, i3/sway)**
```
Server: maintains authoritative state (windows, panes, workspace)
Client: sends command (focus left, move window)
Server: mutates state, returns status
Client: queries state, formats output
```
- Server-side state
- Commands are mutations
- Used by local services

**Which is WibWob-DOS?**
Currently **State + Commands** model:
- `state-service.ts` maintains authoritative window state
- Commands mutate state (`windows.move()`, `windows.close()`)
- API returns state snapshots (`GET /state`)

This is **correct choice** for a desktop shell!

---

### Extensibility: Adding New Commands

**Ranking by ease:**

1. **Stripe** — Create `.go` file, call SDK, done
2. **Vercel (oclif)** — Create `.ts` file, extends Command, auto-discovered
3. **Docker** — Create `.go` file, register in map
4. **GitHub** — Create directory, implement interface, write GraphQL query
5. **kubectl** — Define CRD or extend command tree
6. **tmux** — Edit C source, add command handler, rebuild
7. **i3/sway** — Edit C source, add command handler, rebuild

**Key Insight:** Framework-based (oclif, cobra) are most ergonomic IF you like the framework. Pure hand-written + static table is simpler but requires more boilerplate.

---

## Part 3: WibWob-DOS Specific Recommendations

### What You're Doing Right ✅

1. **Single source of truth for commands** (`command-catalog.ts`)
   - All commands registered in one place
   - Not scattered across modules

2. **Structured control API** (port 8099)
   - RESTful endpoints for commands, state, windows
   - Better than socket-based IPC for remote access

3. **State service** (`state-service.ts`)
   - Authoritative window state
   - Blessed windows read from state, not from command responses
   - Correct model!

4. **Clear separation**
   - Command registry (execution)
   - State service (data)
   - Windows (rendering)
   - Not mixing concerns

### Opportunities for Improvement 🚀

#### 1. **Machine-First Output Formatting**

**Current state:**
- Commands return formatted strings to Blessed windows
- Agents see pretty tables, not structured data
- Hard to programmatically parse responses

**Recommended pattern (i3/sway model):**
```typescript
// All commands return structured data
POST /commands/run → { status: "success", data: { windows: [...] }, errors: [] }

// Blessed windows format for display
displayFormatter.table(data.windows) → pretty table on TUI

// Agents use raw data
agent gets: { windows: [{ id: "123", name: "Editor", ... }] }
agent pipes to jq: .windows[] | select(.name | contains("Edit"))
```

**Action:** Update command handlers to return `CommandResult { status, data, errors }` instead of formatted strings.

#### 2. **API Discovery Endpoint**

**Like kubectl's `/openapis`:**

```bash
GET /commands/list → [{ 
  name: "windows.move",
  description: "Move window to position",
  args: [{ name: "id", type: "string" }, ...],
  output: { windows: [...] }
}]
```

Lets agents auto-discover available commands and their signatures.

**Action:** Create `GET /openapis` or `GET /commands/schema` returning command metadata.

#### 3. **Universal Output Formatting**

**Like Docker's `--format`:**

```bash
POST /commands/run?format=json
POST /commands/run?format=table  
POST /commands/run?format=raw
POST /commands/run?format=jsonpath=.windows[*].name
```

**Implementation:**
```typescript
interface Formatter {
  table(data: any): string
  json(data: any): string
  raw(data: any): string
  template(data: any, template: string): string
}

// All commands use same interface
const output = formatter.table(result.data)
```

**Action:** Create `src/core/formatter.ts` with Formatter interface. Update command outputs to use it.

#### 4. **Module Command Registration**

**Current:** Modules don't register their own commands  
**Target:** Like Kubernetes CRDs — modules explicitly export commands

```typescript
// In microapps/demo-hello-world/index.ts:
export const commands = [
  {
    name: "demo.hello.configure",
    handler: (args) => configureHello(args),
  }
]

// App loads modules, discovers commands
```

**Action:** Update module loader to call `module.getCommands?.()` and register.

#### 5. **Lean Into State Model**

**Pattern:** Some commands currently format + return display strings  
**Better:** Commands mutate state, response is just status

```typescript
// Before:
POST /commands/run { command: "windows.close", args: { id: "123" } }
→ { result: "Window closed successfully" }  // string

// After:
POST /commands/run { command: "windows.close", args: { id: "123" } }
→ { status: "success" }  // minimal
// Blessed reads from GET /state to render updated UI
```

**Benefit:** Clear separation of concerns. Mutations are fire-and-forget, state queries are explicit.

#### 6. **Command Composition & Piping**

Unlike REST CLIs, you can't really "pipe" JSON between commands in a TUI.  
But you CAN:

```bash
# Hypothetical agent workflow:
1. GET /state → returns window list
2. POST /commands/run { "windows.close", { id: 123 } }
3. GET /state → renders updated state

# Or in a script:
curl http://localhost:8099/state | jq '.windows[] | select(.type == "editor")' | ...
```

**Action:** Ensure `/state` and command responses are fully JSON-parseable. No formatted strings in API responses.

---

## Part 4: Implementation Priority

### P0 (High value, low effort)
1. Audit command-catalog.ts — ensure all commands return structured data, not strings
2. Create universal Formatter interface (table, json, raw, template)
3. Add `GET /openapis` endpoint for command discovery

### P1 (Needed, moderate effort)
4. Update output formatting throughout command handlers
5. Add `?format=` query param support to `/commands/run`
6. Module command registration system

### P2 (Nice to have, high effort)
7. Event subscription API (like i3 subscribe)
8. Template language for custom output (jsonpath, go-template)
9. Shell command completion generator

---

## Part 5: Code Patterns to Adopt

### From Docker: Output Formatters
```typescript
interface Formatter {
  format(data: any[]): string
}

class TableFormatter implements Formatter {
  format(data: any[]): string { /* ... */ }
}

class JSONFormatter implements Formatter {
  format(data: any[]): string { return JSON.stringify(data, null, 2) }
}

class RawFormatter implements Formatter {
  format(data: any[]): string { return data.map(d => d.id).join('\n') }
}
```

### From kubectl: Discovery-Based Commands
```typescript
// Endpoint that describes command schema
GET /openapis → {
  commands: [
    { 
      name: "windows.move",
      args: [{ name: "id", type: "string" }, ...],
      output: WindowRecord
    }
  ],
  types: [
    { name: "WindowRecord", fields: [...] }
  ]
}
```

### From i3/sway: JSON-First Protocol
```typescript
// All API responses follow same envelope:
{
  status: "success" | "error",
  data?: any,
  errors?: string[]
}

// Formatting happens at render layer, not API layer
```

### From tmux: Addressable Objects
You already have this! (`session:window.pane` = `windowId`)

```typescript
// You can target: windows/123, panes/abc, sessions/main
POST /windows/123/move → affects window 123
```

### From GitHub: Human-Friendly Errors
```typescript
{
  status: "error",
  message: "Cannot close window: no window with id '999'",
  code: "WINDOW_NOT_FOUND",
  suggestion: "Use GET /commands/list to see available windows"
}
```

---

## Conclusion

Your current architecture is **better than most of these projects** because:

1. You have a proper state service (not request-response)
2. You have clear separation of concerns (commands ≠ state ≠ rendering)
3. You're in TypeScript (can use reflection, decorators)
4. You already have an API layer (port 8099)

The main lever for improvement is:

**Adopt i3/sway's pattern: Machine-first output, pretty-printing as separate layer.**

This makes your system:
- **More composable** (agents can parse outputs)
- **More discoverable** (command schema endpoint)
- **More extensible** (modules can register commands)
- **Easier to test** (structured data, not strings)

Start with P0 items: audit command outputs, add universal formatter, expose command schema. The rest follows naturally.

