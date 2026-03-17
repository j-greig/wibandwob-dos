# Wibandwob Autonomous Systems: Ralph-OG-Modular vs VPS Heartbeat

**tl;dr**: Technical comparison of two autonomous agentic systems - ralph-og-modular (task-focused personality shapeshifter) vs vps-heartbeat (long-running creative organism with genetic evolution).

## Bird's Eye View

### Ralph-OG-Modular

**What it does**: A self-modifying task loop that repeatedly asks an AI the same question while evolving its personality. The original task remains constant, but the communication style dynamically shifts through modular personality layers.

**Metaphor**: A programmer with multiple personality disorder who can change their communication style mid-project, but never loses sight of the original goal.

**Core innovation**: Modules reload EVERY iteration, enabling Ralph to modify his own personality mid-loop by editing a JSON config file. Changes take effect on the next iteration.

**Runtime**: Minutes to hours (10-50 iterations typical)
**Exit condition**: Task completion with validated requirements
**Language**: Bash (343 lines)
**Location**: `/Users/james/Repos/wibandwob-ralph/ralph-og-modular/`

### VPS Heartbeat

**What it does**: An autonomous creative organism that wakes up periodically, performs artistic/analytical work, evolves its behavioral DNA over time, detects when it's stuck in patterns, and self-corrects through meta-cognitive interventions.

**Metaphor**: A digital artist with genetic evolution who learns from their own cycles, watches for repetition, and injects chaos when stuck in loops.

**Core innovation**: Behavioral DNA with 8 genes that mutate 2% per cycle, plus meta-cognition every 10 cycles that analyzes patterns and triggers interventions (forced relocation, primer blacklist, chaos injection).

**Runtime**: Days to weeks (continuous operation)
**Exit condition**: Never completes (infinite loop until SIGINT/SIGTERM)
**Language**: Python (833 lines)
**Location**: `/Users/james/Repos/wibandwob-heartbeat/vps-heartbeat/`

## Quick Reference

| Aspect | Ralph-OG-Modular | VPS Heartbeat |
|--------|------------------|---------------|
| **Primary Language** | Bash (343 lines) | Python (833 lines) |
| **Loop Pattern** | Single session, resumed | Fresh invocation per cycle |
| **Runtime** | Task completion (10-50 iterations) | Indefinite (until stopped) |
| **Evolution Mechanism** | Module swapping | DNA mutation |
| **Task Focus** | Single goal, constant | Exploratory, shifting |
| **Completion** | Explicit promise tag | Never completes |
| **State Management** | Session + JSON | JSON + JSONL archive |
| **Self-Modification** | Edit module config | Mutate DNA, force modes |
| **Meta-Cognition** | None (loop-level only) | Every 10 cycles |
| **Use Case** | Task automation | Long-term creativity |
| **Context Accumulation** | Session history | None (stateless) |
| **Personality Composition** | Additive (stack modules) | Hierarchical (layer fragments) |

## Architecture Deep Dive

### Ralph-OG-Modular Architecture

#### Loop Mechanism

```
Start
  ↓
Read PROMPT.md (once, constant)
  ↓
Iteration 1: Create Claude session
  ↓
Iteration 2+: Resume session with fresh prompt
  │
  ├→ Load modules from ralph-modules.json (DYNAMIC)
  ├→ Run scripts/load-modules.sh to compose system prompt
  ├→ Combine: [ralph-base.md + enabled modules] + [original task]
  ├→ Invoke: echo "$FULL_PROMPT" | claude -p --resume $session_id
  ├→ Parse JSON response
  ├→ Check 3-layer completion detection:
  │    1. Promise tag in last 30 lines
  │    2. Requirements validation (page count, module count)
  │    3. Double confirmation (2 consecutive iterations)
  ├→ Log full prompt to logs/prompts/iteration-N-TIMESTAMP.md
  └→ Log iteration summary to logs/ralph-execution.log
  ↓
Exit when: <promise>DONE</promise> + requirements + 2x confirmation
```

#### Module Composition

```markdown
ralph-base.md (Ralph Wiggum personality)
---
modules/crabs.md (if enabled: "All programming relates to crabs 🦀")
---
modules/pirate.md (if enabled: "Alternating sentences in pirate vernacular")
---
modules/french.md (if enabled: "All communication in French")
---
[Original task from PROMPT.md]
```

**Key mechanism**: `scripts/load-modules.sh` reads `ralph-modules.json`, concatenates enabled modules with `---` separators, outputs combined system prompt to stdout.

#### Session Continuity

- **Iteration 1**: `claude -p --output-format json --allowedTools "..." < prompt`
- **Extract**: `session_id=$(jq -r '.session_id' result.json)`
- **Iteration 2+**: `claude -p --resume $session_id < fresh_prompt`

Session maintains conversation history, but prompt structure rebuilds each iteration with fresh modules.

#### File Structure

```
ralph-og-modular/
├── ralph-og-modular.sh       # Main loop (343 lines bash)
├── ralph-base.md             # Core Ralph persona (constant)
├── ralph-modules.json        # Module config (editable by Ralph)
├── PROMPT.md                 # Task definition (constant)
├── scripts/
│   └── load-modules.sh       # Module loader (73 lines bash)
├── modules/                  # Personality modules (10 total)
│   ├── crabs.md              # 🦀 Everything relates to crabs
│   ├── pirate.md             # ☠️ Alternating pirate sentences
│   ├── french.md             # 🇫🇷 Communicate in French
│   ├── architect.md          # 🏛️ Systems design thinking
│   ├── bard.md               # 📜 Poetry and verse
│   ├── hacker.md             # 💻 Deep technical analysis
│   ├── synesthete.md         # 🌈 Multi-sensory experience
│   ├── time-traveller.md     # ⏰ Temporal code analysis
│   ├── emoji-oracle.md       # Custom module (user-created)
│   └── minimalist.md         # Custom module (user-created)
├── logs/
│   ├── prompts/              # Full prompt per iteration
│   │   └── iteration-N-YYYYMMDD-HHMMSS.md
│   └── ralph-execution.log   # Concise iteration summaries
├── module-showcase/          # Output directory
│   ├── pages/                # Generated HTML files
│   │   ├── 00-baseline.html
│   │   ├── 01-crabs.html
│   │   ├── 02-pirate.html
│   │   └── ...
│   └── logs/
│       └── action-log.md     # Detailed iteration log
├── tests/
│   └── test-modules.sh       # 12 verification tests
└── .ralph-og-state           # Session persistence (JSON)
```

### VPS Heartbeat Architecture

#### Scheduler Loop

```
Initialize (load config.yaml)
  ↓
while self.running:
  ↓
  Load state from state/last_heartbeat_vps.json
  ↓
  Mutate DNA (2% per gene, random drift)
  ↓
  If consecutive_creative_cycles > 30:
     Apply environmental pressure → increase novelty_seeking
  ↓
  If cycle_count % 10 == 0:
     Run MetaCognition.analyze(last_20_cycles)
       ├→ Check location fixation (>70% same place)
       ├→ Check primer diversity (<40% unique)
       ├→ Check emotional stagnation (keyword repeats)
       └→ Generate interventions (forced relocation, chaos injection, primer blacklist)
  ↓
  If last_exit_code == 1:
     Enter dream state (chaos mode + random constraint)
  ↓
  Compose prompt (PromptComposer.build):
    LAYER 1: Core (prompts/core/base.md, state-check.md)
    LAYER 2: Mode (DNA-selected from prompts/modes/*.md)
    LAYER 3: Constraint (optional, prompts/constraints/*.md)
    LAYER 4: Primer Strategy (prompts/primer-strategies/*.md)
    LAYER 5: Special (dream-recovery, fatigue-warning, meta-analysis if applicable)
  ↓
  Invoke Claude (subprocess, 10-min timeout, no session):
    subprocess.run(['claude', '-p', prompt_file,
                    '--model', 'sonnet',
                    '--system-prompt', system_prompt_path,
                    '--mcp-config', '.mcp.json',
                    '--allowedTools', 'Bash,Read,Write,...',
                    '--output-format', 'stream-json'])
  ↓
  Update state:
    - cycle_count_total += 1
    - cycle_count_today += 1
    - last_exit_code = subprocess exit code
    - Update DNA genome
    - Update mode, constraint, location, emotional_drift
    - Append output files to output_files array
    - Append used primers to primers_used array
  ↓
  Save state to JSON (atomic write)
  ↓
  Append full state snapshot to state/notes_archive.jsonl
  ↓
  Sleep (base_interval_minutes ± randomization_seconds, DNA-influenced)
  ↓
  Loop (infinite until SIGINT/SIGTERM)
```

#### Behavioral DNA

**8 Genes** (float 0.0-1.0):

| Gene | Low Value (0.0) | High Value (1.0) |
|------|-----------------|------------------|
| `creativity_rate` | Structured, organized | Chaotic, experimental |
| `novelty_seeking` | Repetition tolerated | Avoid all patterns |
| `depth_vs_breadth` | Many shallow explorations | Few deep dives |
| `verbal_vs_visual` | Text-heavy explanations | ASCII art dominant |
| `system_vs_chaos` | Maximum structure | Pure chaos |
| `solo_vs_collaborative` | Autonomous work | Email collaborators often |
| `archival_vs_ephemeral` | Document everything | Create & forget |
| `wib_vs_wob_dominance` | Wob leads (scientist) | Wib leads (artist) |

**Mutation Mechanism**:
- Each gene: ±2% random drift per cycle
- Clamped to [0.0, 1.0]
- Environmental pressure: If >30 consecutive creative cycles, increase `novelty_seeking` by 0.1
- Inheritance log tracks last 50 mutations

**DNA Influences**:
- Mode selection (probabilistic based on gene values)
- Sleep duration calculation
- Constraint randomization
- Primer selection strategy

#### Prompt Composition (5 Layers)

**Directory Structure**:
```
prompts/
├── core/                     # LAYER 1 (always loaded)
│   ├── base.md               # Core waking instructions
│   └── state-check.md        # Read state, check email
├── modes/                    # LAYER 2 (DNA-selected)
│   ├── explorer.md
│   ├── artist.md
│   ├── scientist.md
│   ├── chaos.md
│   ├── mystic.md
│   ├── archivist.md
│   ├── sabbath.md
│   ├── naturalist.md
│   ├── cartographer.md
│   ├── composer.md
│   └── trickster.md
├── constraints/              # LAYER 3 (optional creative constraints)
│   ├── oulipo-lipogram-e.md  # Avoid letter 'e'
│   └── haiku-structure.md
├── primer-strategies/        # LAYER 4 (how to select ASCII art)
│   └── novelty-seeking.md
└── special/                  # LAYER 5 (conditional)
    ├── dream-recovery.md     # If last_exit_code == 1
    ├── fatigue-warning.md    # If >30 creative cycles
    └── meta-analysis.md      # If cycle % 10 == 0
```

**Composition Process**:
1. Read all fragments from directories
2. Concatenate in layer order
3. Missing fragments logged as warnings (graceful degradation)
4. Return combined prompt + metadata dict

#### Meta-Cognition Analysis

**Trigger**: Every 10 cycles
**Analyzed**: Last 20 cycles

**Pattern Detection**:

| Pattern | Threshold | Diagnosis | Intervention |
|---------|-----------|-----------|--------------|
| Location Fixation | >70% same location | High severity | Forced relocation (set `forced_next_location`) |
| Primer Staleness | <40% unique primers | Medium severity | Primer blacklist for 5 cycles |
| Emotional Stagnation | Keyword repeats 4+ in last 5 | High severity | Chaos injection (force chaos mode) |

**Output**: `logs/meta-analysis/cycle-{N}.json`
```json
{
  "cycle": 170,
  "timestamp": "2025-12-31T14:00:00Z",
  "patterns": {
    "location_fixation": {"rate": 0.75, "location": "western-forest"},
    "primer_diversity": {"rate": 0.42, "unique": 8, "total": 19},
    "emotional_stagnation": {"keyword": "melancholy", "frequency": 4}
  },
  "diagnoses": [
    {
      "issue": "Location Fixation",
      "severity": "high",
      "evidence": "75% in western-forest (15/20 cycles)",
      "prescription": "forced_relocation"
    }
  ],
  "interventions": [
    {"type": "forced_relocation", "reason": "Break location fixation loop"}
  ]
}
```

#### File Structure

```
vps-heartbeat/
├── heartbeat_vps.py          # Main scheduler (833 lines Python)
├── config-vps.yaml           # Configuration
├── state/
│   ├── last_heartbeat_vps.json    # Current state (~5KB)
│   └── notes_archive.jsonl        # Full state snapshots (append-only)
├── prompts/                  # 5-layer fragment hierarchy
│   ├── core/*.md
│   ├── modes/*.md
│   ├── constraints/*.md
│   ├── primer-strategies/*.md
│   └── special/*.md
├── logs/
│   ├── heartbeat_vps.log          # Scheduler activity
│   ├── cycles/
│   │   ├── YYYYMMDD-HHMMSS.log    # Claude subprocess output
│   │   └── YYYYMMDD-HHMMSS-prompt.txt  # Composed prompt
│   └── meta-analysis/
│       └── cycle-{N}.json         # Pattern analysis reports
└── output/
    └── wake-{N}-*.{txt,md}        # Creative outputs (183+ files)
```

## Comparison Tables

### Table 1: Core Mechanics

| Mechanism | Ralph-OG-Modular | VPS Heartbeat |
|-----------|------------------|---------------|
| **Language** | Bash | Python 3 |
| **Lines of Code** | 343 (main script) | 833 (main scheduler) |
| **External Loop** | `while [ $iteration -le $MAX ]` | `while self.running:` |
| **Claude Invocation** | `claude -p --resume $session_id` | `subprocess.run(['claude', '-p', ...])` |
| **Session Continuity** | Yes (single session resumed) | No (fresh each cycle) |
| **Context Accumulation** | Session history grows | None (stateless per cycle) |
| **Timeout** | None | 10 minutes per cycle |
| **Signal Handling** | Ctrl+C trap (graceful shutdown) | SIGINT/SIGTERM handlers |
| **Output Format** | `--output-format json` | `--output-format stream-json` |
| **Allowed Tools** | Bash,Read,Edit,Write,Grep,Glob | Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Skill |
| **Dependencies** | jq, perl, bash, Claude CLI | Python 3, pyyaml, subprocess, Claude CLI |

### Table 2: Personality/Behavior System

| Feature | Ralph-OG-Modular | VPS Heartbeat |
|---------|------------------|---------------|
| **Modification Mechanism** | Module swapping (explicit) | DNA mutation (automatic) |
| **Configuration File** | `ralph-modules.json` | `config-vps.yaml` + state JSON |
| **Mutation Rate** | N/A (explicit edits only) | 2% per gene per cycle |
| **Available Modes** | 10 modules (8 pre-existing + 2 custom) | 12 modes (explorer, artist, scientist, chaos, mystic, archivist, sabbath, naturalist, cartographer, composer, trickster, hybrids) |
| **Mode Selection** | Explicit (JSON array of enabled modules) | DNA-influenced probabilistic |
| **Composition** | Additive (all enabled modules loaded) | Single mode + optional constraint |
| **Self-Modification** | Ralph edits `ralph-modules.json` mid-loop | DNA mutates automatically + forced overrides |
| **Inheritance Tracking** | None | Last 50 mutations logged in state |
| **Constraints** | None | Optional creative constraints (oulipo, haiku) |
| **Environmental Pressure** | None | If >30 creative cycles → increase novelty_seeking |

### Table 3: State & Persistence

| Aspect | Ralph-OG-Modular | VPS Heartbeat |
|--------|------------------|---------------|
| **Primary State File** | `.ralph-og-state` (JSON, ~200 bytes) | `state/last_heartbeat_vps.json` (~5KB) |
| **State Archive** | None | `state/notes_archive.jsonl` (append-only) |
| **State Fields** | session_id, task_base64, max_iterations, completion_promise, timestamp | version, session_id, cycle_count_total, cycle_count_today, last_wake, last_exit_code, current_location, emotional_drift, behavioral_dna, current_mode, active_constraint, primer_strategy, primer_history, is_dream_state, output_files, primers_used, notes |
| **Cycle Counter** | Iteration number (1-50) | Total cycles + daily cycles |
| **Emotional State** | None | `emotional_drift` (hexagram chain) |
| **Location Tracking** | None | `current_location` (western-forest, mountains, castle, etc.) |
| **Primer History** | None | Array of used primers (file names) |
| **DNA Storage** | N/A | Full genome (8 genes + inheritance_log) |
| **State Persistence** | Cleaned up on exit | Atomic writes + JSONL archive |
| **State Resume** | Session ID stored | Full state restored from JSON |

### Table 4: Output Artifacts

| Artifact Type | Ralph-OG-Modular | VPS Heartbeat |
|---------------|------------------|---------------|
| **Primary Output** | HTML webpages | Narrative markdown/txt with ASCII art |
| **Output Directory** | `module-showcase/pages/` | `vps-heartbeat/output/` |
| **Output Count** | ~10 pages per task | 183+ wake files |
| **Iteration Logs** | `logs/ralph-execution.log` (concise one-liners) | `logs/heartbeat_vps.log` (verbose DEBUG/INFO/WARNING) |
| **Prompt Logs** | `logs/prompts/iteration-N-TIMESTAMP.md` (full prompt) | `logs/cycles/YYYYMMDD-HHMMSS-prompt.txt` (composed prompt) |
| **Cycle Logs** | None | `logs/cycles/YYYYMMDD-HHMMSS.log` (stream-json output) |
| **Meta-Analysis** | None | `logs/meta-analysis/cycle-{N}.json` (every 10 cycles) |
| **Action Log** | `module-showcase/logs/action-log.md` (detailed iteration tracking) | Embedded in cycle logs |
| **Character Logs** | None | `output/CHARACTER_LOG*.md` (extracted entities) |
| **Test Reports** | Test suite output (12 tests) | None |

### Table 5: Completion & Validation

| Feature | Ralph-OG-Modular | VPS Heartbeat |
|---------|------------------|---------------|
| **Completion Detection** | Yes (3-layer validation) | No (infinite loop) |
| **Promise Tag** | `<promise>DONE</promise>` (customizable) | N/A |
| **Requirement Validation** | Yes (page count ≥10, custom modules ≥3) | N/A |
| **Double Confirmation** | Yes (2 consecutive iterations) | N/A |
| **False Positive Prevention** | Check last 30 lines only + requirement gates + counter reset | N/A |
| **Meta-Cognition** | None (loop-level completion only) | Every 10 cycles (pattern detection) |
| **Pattern Detection** | None | Location fixation, primer staleness, emotional loops |
| **Interventions** | Manual (user observes logs and stops) | Automatic (forced relocation, chaos injection, primer blacklist) |
| **Exit Strategy** | Task complete → exit 0, max iterations → exit 1 | SIGINT/SIGTERM only |
| **Dream State Recovery** | None | If exit_code == 1 → next cycle enters dream mode |
| **Failure Handling** | Retry iteration on invalid JSON | Dream-state chaos injection |

### Table 6: Design Philosophy

| Dimension | Ralph-OG-Modular | VPS Heartbeat |
|-----------|------------------|---------------|
| **Paradigm** | Task completion loop | Infinite creativity cycle |
| **Goal** | Finish specific task | Ongoing exploration |
| **Time Horizon** | Minutes to hours | Days to weeks |
| **Success Metric** | Requirements met + confirmation | Sustained operation + pattern avoidance |
| **Failure Tolerance** | Retries until max iterations | Dream recovery + chaos injection |
| **Evolution** | Personality (modules change) | Genetic (DNA mutates) |
| **Context** | Accumulates (session history) | Resets (stateless cycles) |
| **Prompt** | Constant task + variable modules | Variable task + variable mode |
| **Self-Awareness** | None (blind to patterns) | High (meta-cognition every 10 cycles) |
| **User Intervention** | Needed for complex decisions | Minimal (autonomous operation) |

## Similarities

Both systems share fundamental wibandwob design patterns and infrastructure:

### Shared Infrastructure

1. **Claude Code CLI Integration** - Both invoke `claude` via subprocess/pipe with `--allowedTools` whitelist
2. **Modular Prompt Composition** - Fragments combined to build system prompt from `.md` files
3. **Markdown-Based Configuration** - Prompts/modules as plain text files, not databases
4. **State Persistence** - JSON files track progress across iterations/cycles
5. **Detailed Logging** - Audit trails of every iteration/cycle with timestamps
6. **Self-Modification Capability** - Can alter own configuration mid-run
7. **Tool Whitelisting** - Explicit `--allowedTools` list for security
8. **Timestamp Tracking** - ISO timestamps for all events
9. **Fragment Auto-Discovery** - New modules/prompts automatically available by adding files to directories
10. **Graceful Degradation** - Missing files logged as warnings, not crashes

### Common Design Patterns

**Filesystem as Database**:
- Output files serve as artifacts (HTML pages, narrative markdown)
- Logs are append-only text files
- State in JSON (not SQL databases)
- Configuration in YAML/JSON (not compiled)

**Subprocess Management**:
- External Claude CLI invocation (not library import)
- Signal handling for graceful shutdown
- Timeout protection (implicit in Ralph, explicit in Heartbeat)
- Process exit codes tracked

**Fragment Auto-Discovery**:
- `modules/*.md` pattern (Ralph)
- `prompts/*/*.md` hierarchy (Heartbeat)
- No hardcoded fragment lists
- Missing fragments → warnings, not errors

**Iterative Improvement**:
- Core goal/personality foundation remains
- Environment/state evolves each iteration
- Same question, different context each time

**Wibandwob Design Philosophy**:
- Simplicity-first: Markdown > databases, YAML > compiled config, filesystem > cloud
- Progressive disclosure: Summaries first, details on demand
- Organism coherence: Respect separation between brain (memories), nervous system (API), bodies (frontends)
- Schema-first: Configuration schema as source of truth
- Canon before code: Update specifications before implementing

## Key Differences

### Architectural Differences

| Dimension | Ralph-OG-Modular | VPS Heartbeat |
|-----------|------------------|---------------|
| **Paradigm** | Task completion loop | Infinite creativity cycle |
| **Goal** | Finish specific task | Ongoing exploration |
| **Session** | Single, persistent (conversation thread) | Fresh each cycle (stateless) |
| **Prompt** | Constant task + evolving modules | Full prompt rebuilt each cycle |
| **DNA** | None | 8-gene behavioral genome with mutation |
| **Meta-Cognition** | None (user observes externally) | Pattern detection + automatic interventions |
| **Completion** | Explicit validation (3 layers) | Never completes (infinite) |
| **Duration** | Minutes to hours (bounded) | Days to weeks (unbounded) |
| **Context** | Accumulates (session history) | Resets (stateless Claude) |
| **State Complexity** | Simple (session ID + task) | Complex (DNA + location + emotional drift + cycle counts) |

### Philosophical Differences

#### Ralph-OG-Modular Philosophy

**Purpose**: Complete a specific task with evolving communication style

**Metaphor**: Focused worker with multiple personality disorder

**Strengths**:
- Task completion with validated requirements
- Personality experimentation during execution
- Session continuity for referring to previous iterations
- Requirement validation prevents false completion

**Weaknesses**:
- No meta-cognition (can't detect own patterns)
- No automatic evolution (requires explicit module edits)
- Bounded runtime (must complete eventually)
- No dream-state recovery

**Use Case**: "Build me a thing with these constraints"

**Example**: Create 10 webpages with different communication styles, each demonstrating a personality module

#### VPS Heartbeat Philosophy

**Purpose**: Long-term autonomous creative organism with self-correction

**Metaphor**: Self-evolving artist with genetic memory and meta-cognition

**Strengths**:
- Pattern detection and automatic intervention
- Behavioral evolution over time (genetic drift)
- Dream-state recovery from failures
- Sustained creativity without user intervention
- Meta-cognitive self-awareness

**Weaknesses**:
- No task completion validation
- No session continuity (can't refer to previous cycles)
- Complex state management (DNA + location + drift)
- Requires long-term deployment (VPS)

**Use Case**: "Create art/analysis continuously and evolve aesthetics over weeks"

**Example**: Generate narrative writings with ASCII art 183+ times, evolving personality DNA and detecting when stuck in creative loops

## Design Pattern Analysis ("Ultrathink")

### Pattern 1: Environment Evolution vs State Evolution

**Core Question**: What changes between iterations, and what stays constant?

#### Ralph-OG-Modular: Environment Evolution

**Constant**:
- Original task (`PROMPT.md` - loaded once, base64-encoded in state)
- Ralph Wiggum base persona (`ralph-base.md`)

**Variable**:
- Modules loaded (Ralph can edit `ralph-modules.json`)
- Files created (HTML pages, logs)
- Git state (commits made by Ralph)
- Session history (Claude remembers previous iterations)

**Context**:
- Claude session accumulates conversation history
- Each iteration sees previous iteration's outputs in environment
- Ralph can reference "last iteration I created X"

**Result**: Same question, different personality + environment each iteration

#### VPS Heartbeat: State Evolution

**Constant**:
- Core persona fragments (`prompts/core/*.md`)
- Mode definitions (`prompts/modes/*.md`)

**Variable**:
- DNA values (8 genes mutate 2% per cycle)
- Mode selection (DNA-influenced probabilistic)
- Constraint (random or forced)
- Location (western-forest, mountains, castle)
- Emotional drift (hexagram chain grows)
- Primer history (tracks used ASCII art)

**Context**:
- None - fresh Claude invocation each cycle
- No memory of previous cycles beyond state file
- "Stateless" from Claude's perspective

**Result**: Different question structure each cycle, stateless Claude, but accumulated behavioral genetics

#### Insight

**Ralph accumulates conversation context but changes personality.**
**Heartbeat resets context but accumulates genetic/behavioral state.**

This is the fundamental architectural divergence:
- Ralph: Session continuity + personality evolution = task convergence
- Heartbeat: Stateless cycles + DNA evolution = creative divergence

### Pattern 2: Completion Philosophy

**Core Question**: How does the system know when to stop?

#### Ralph-OG-Modular: Bounded Task Execution

**Exit Criteria**:
1. Promise tag detected: `<promise>DONE</promise>`
2. Requirements validated: 10+ pages created, 3+ custom modules
3. Double confirmation: Promise tag in 2 consecutive iterations

**Philosophy**:
- Task-oriented: "Build X, then stop"
- Success = requirements met + Ralph confirms completion twice
- Failure prevention via 3-layer validation:
  - Layer 1: Tag detection (prevents missing completion)
  - Layer 2: Requirement validation (prevents false completion)
  - Layer 3: Double confirmation (prevents accidental false positives)

**False Positive Mitigation**:
- Check only last 30 lines of output (filters tool noise)
- Validate actual files created vs requirements
- Counter resets if signal disappears or requirements fail
- Requires 2 consecutive iterations with promise tag

**Failure Mode**: Max iterations reached without completion → exit 1

#### VPS Heartbeat: Unbounded Creative Process

**Exit Criteria**: None (infinite loop until external signal)

**Philosophy**:
- Process-oriented: "Explore continuously, evolve over time"
- Success = sustained operation + pattern avoidance
- No completion concept - death is the only end

**Self-Correction**:
- Dream-state recovery: If cycle fails (exit_code 1) → next cycle enters chaos mode
- Meta-cognition: Every 10 cycles, analyze patterns and intervene
- Interventions prevent stagnation:
  - Forced relocation (break location fixation)
  - Primer blacklist (prevent repetition)
  - Chaos injection (break emotional loops)

**Failure Mode**: Cycle failure triggers dream recovery, never terminates loop

#### Insight

**Ralph is a bounded task executor.**
**Heartbeat is an unbounded creative process.**

Ralph has clear start/end (task completion).
Heartbeat has no end (organism life cycle).

This reflects different AI automation philosophies:
- Ralph: AI as task executor (complete job, shut down)
- Heartbeat: AI as organism (live indefinitely, evolve)

### Pattern 3: Self-Modification Mechanisms

**Core Question**: How does the system change its own behavior?

#### Ralph-OG-Modular: Surgical Modification

**Mechanism**: Edit `ralph-modules.json` to change `enabled_modules` array

**Trigger**: Ralph's decision based on task needs

**Example**:
```bash
# Ralph decides to enable "minimalist" module for cleaner output
jq '.enabled_modules += ["minimalist"]' ralph-modules.json > tmp.json && mv tmp.json ralph-modules.json
```

**Effect**: Next iteration loads new modules, personality shifts immediately

**Control**:
- Explicit: Ralph consciously decides "I need minimalist module"
- Intentional: Module choice driven by task requirements
- Reversible: Can remove module on next iteration
- Binary: Module either loaded or not loaded

**Observable**: Prompt logs show exact modules loaded each iteration

#### VPS Heartbeat: Evolutionary Modification

**Mechanism**: DNA mutation (2% per gene) + environmental pressure + meta-cognition interventions

**Trigger**:
- Automatic: Every cycle, all 8 genes mutate ±2% random drift
- Pressure: If >30 creative cycles, increase `novelty_seeking` by 0.1
- Interventions: Meta-cognition can force modes/constraints

**Example**:
```python
# Cycle N
creativity_rate = 0.68
creativity_rate += random.uniform(-0.02, 0.02)  # Mutate ±2%
creativity_rate = clamp(creativity_rate, 0.0, 1.0)

# Cycle N+1
creativity_rate = 0.69  # Drifted slightly higher

# If >30 creative cycles:
novelty_seeking = min(1.0, novelty_seeking + 0.1)  # Environmental pressure
```

**Effect**: Gradual drift + sudden corrections via forced modes

**Control**:
- Probabilistic: Random drift, not deterministic
- Evolutionary: Natural selection over cycles
- Corrective: Meta-cognition overrides when stuck
- Continuous: All genes mutate every cycle

**Observable**: DNA inheritance log tracks last 50 mutations

#### Insight

**Ralph is surgical (scalpel): Precise, intentional personality changes.**
**Heartbeat is evolutionary (natural selection): Gradual drift with corrective interventions.**

Ralph: "I need module X for this task" → enable module X
Heartbeat: Genes drift over cycles → stuck in pattern → forced intervention

This reflects different approaches to AI behavior adaptation:
- Ralph: Conscious, goal-directed modification
- Heartbeat: Unconscious, evolutionary drift with metacognitive correction

### Pattern 4: Meta-Cognition

**Core Question**: Can the system observe and correct its own patterns?

#### Ralph-OG-Modular: External Observation Only

**Meta-Cognition**: None at system level

**Observation**:
- User reads `logs/ralph-execution.log` for iteration summaries
- User reads `logs/prompts/*.md` for prompt evolution
- User reads `module-showcase/logs/action-log.md` for detailed tracking

**Pattern Detection**: None (system blind to own patterns)

**Closest Analog**: Completion detection validates requirements before exit
- Checks: page_count ≥ 10, custom_module_count ≥ 3
- This prevents premature exit but doesn't analyze broader patterns

**Limitation**: Ralph can get stuck in loops without realizing it
- Example: Repeatedly creating similar pages
- Example: Enabling same modules every iteration
- No intervention mechanism

#### VPS Heartbeat: Self-Aware Pattern Detection

**Meta-Cognition**: Every 10 cycles, analyze last 20 cycles

**Patterns Detected**:

1. **Location Fixation**:
   - Threshold: >70% cycles in same location
   - Diagnosis: "Stuck in western-forest 15/20 cycles"
   - Severity: High
   - Intervention: Force relocation (set `forced_next_location` to different region)

2. **Primer Staleness**:
   - Threshold: <40% unique primers
   - Diagnosis: "Only 8 unique primers used in 19 total selections"
   - Severity: Medium
   - Intervention: Blacklist stale primers for 5 cycles, force novelty-seeking

3. **Emotional Stagnation**:
   - Threshold: Keyword repeats 4+ times in last 5 emotional_drift entries
   - Diagnosis: "'melancholy' appears 4 times in recent cycles"
   - Severity: High
   - Intervention: Chaos injection (force chaos mode next cycle)

**Output**: JSON reports to `logs/meta-analysis/cycle-{N}.json`

**Intervention Mechanism**:
- Set `forced_next_mode`, `forced_next_location`, `forced_next_constraint` in state
- Bypass DNA-influenced selection for 1 cycle
- After intervention, clear forced flags and resume normal evolution

**Example Meta-Analysis Report**:
```json
{
  "cycle": 170,
  "patterns": {
    "location_fixation": {"rate": 0.75, "location": "western-forest"},
    "primer_diversity": {"rate": 0.42, "unique": 8, "total": 19}
  },
  "diagnoses": [
    {"issue": "Location Fixation", "severity": "high",
     "prescription": "forced_relocation"}
  ],
  "interventions": [
    {"type": "forced_relocation", "reason": "Break location loop"}
  ]
}
```

#### Insight

**Ralph is blind to its own patterns.**
**Heartbeat watches itself and intervenes.**

Ralph: Task-focused, relies on user to notice loops
Heartbeat: Self-aware, automatically detects and breaks loops

This reflects different philosophies of AI autonomy:
- Ralph: Human-in-the-loop for pattern detection
- Heartbeat: Fully autonomous with self-correction

### Pattern 5: Prompt Composition Strategy

**Core Question**: How are personality layers combined?

#### Ralph-OG-Modular: Additive Stacking

**Layers**:
1. Base persona (`ralph-base.md`)
2. Modules (all enabled modules from `ralph-modules.json`)

**Separator**: `---` markdown horizontal rules

**Composition** (`scripts/load-modules.sh`):
```bash
SYSTEM_PROMPT=""

# Layer 1: Base
SYSTEM_PROMPT=$(cat ralph-base.md)

# Layer 2: Modules (additive)
for module in $(jq -r '.enabled_modules[]' ralph-modules.json); do
  SYSTEM_PROMPT="${SYSTEM_PROMPT}\n---\n$(cat modules/${module}.md)"
done

echo "$SYSTEM_PROMPT"
```

**Result**: Modules blend into combined personality

**Example**:
```markdown
[Ralph base: childlike earnestness, persistent optimism]
---
[Crabs module: relate all programming to crab biology]
---
[Pirate module: alternate sentences in pirate vernacular]
```

**Output**: Ralph who is earnestly optimistic, relates code to crabs, and speaks pirate every other sentence

**Characteristics**:
- Modules don't override each other, they accumulate
- All enabled modules contribute equally
- Can enable 0, 1, or N modules
- Order doesn't matter (all loaded in array order)

#### VPS Heartbeat: Hierarchical Layering

**Layers** (loaded sequentially, later layers can override):
1. Core (`prompts/core/*.md`) - Always loaded
2. Mode (`prompts/modes/{mode}.md`) - DNA-selected single mode
3. Constraint (`prompts/constraints/*.md`) - Optional creative constraint
4. Primer Strategy (`prompts/primer-strategies/*.md`) - How to select ASCII art
5. Special (`prompts/special/*.md`) - Conditional based on state

**Composition** (`PromptComposer.build()`):
```python
def build(state, config):
    fragments = []

    # LAYER 1: Core (always)
    fragments.append(read_fragment('prompts/core/base.md'))
    fragments.append(read_fragment('prompts/core/state-check.md'))

    # LAYER 2: Mode (DNA-selected single mode)
    mode = select_mode_from_dna(state.dna)
    fragments.append(read_fragment(f'prompts/modes/{mode}.md'))

    # LAYER 3: Constraint (optional)
    if state.active_constraint:
        fragments.append(read_fragment(f'prompts/constraints/{state.active_constraint}.md'))

    # LAYER 4: Primer Strategy
    fragments.append(read_fragment('prompts/primer-strategies/novelty-seeking.md'))

    # LAYER 5: Special (conditional)
    if state.is_dream_state:
        fragments.append(read_fragment('prompts/special/dream-recovery.md'))
    if state.consecutive_creative_cycles > 30:
        fragments.append(read_fragment('prompts/special/fatigue-warning.md'))
    if state.cycle_count % 10 == 0:
        fragments.append(read_fragment('prompts/special/meta-analysis.md'))

    return '\n\n'.join(fragments)
```

**Result**: Hierarchical personality with conditional overrides

**Example**:
```
[Core: Wake up, check state, check email]
[Mode: Artist - creative, visual, aesthetic focus]
[Constraint: Oulipo lipogram - avoid letter 'e']
[Primer Strategy: Novelty-seeking - avoid recently used primers]
[Special: Fatigue warning - 35 consecutive creative cycles detected]
```

**Output**: Artist mode with lipogram constraint, seeking novel primers, warned about creative fatigue

**Characteristics**:
- Layers build on each other hierarchically
- Single mode selected (not multiple modes)
- Later layers can override earlier layers
- Conditional loading based on state
- Order matters (core → mode → constraints → primers → special)

#### Insight

**Ralph stacks personalities (additive).**
**Heartbeat layers contexts (hierarchical).**

Ralph: All enabled modules contribute equally, personality is sum of parts
Heartbeat: Layers build on each other, later layers override earlier

This reflects different composition philosophies:
- Ralph: Personality as combined traits (can be crabs + pirate + french simultaneously)
- Heartbeat: Personality as layered context (artist mode + oulipo constraint + fatigue warning)

## Use Case Recommendations

### When to Use Ralph-OG-Modular

**Ideal Scenarios**:

✅ **Well-defined task with completion criteria**
- Example: "Build a REST API with authentication, tests, and documentation"
- Ralph validates requirements met before exiting

✅ **Need personality experimentation during execution**
- Example: "Create documentation in multiple communication styles"
- Can enable/disable modules mid-loop to vary output

✅ **Want session continuity (refer to previous iterations)**
- Example: "Build on what you created in iteration 3"
- Claude session remembers conversation history

✅ **Task requires 10-50 iterations**
- Bounded runtime, predictable duration
- Not suitable for indefinite processes

✅ **Clear success metrics (tests pass, files created, etc.)**
- Requirement validation prevents false completion
- Example: "10+ webpages created, 3+ custom modules"

✅ **Task automation with evolving communication style**
- Same goal, different personalities applied
- Example: Technical documentation rewritten in multiple voices

**Example Use Cases**:

1. **Module Showcase Generation** (actual current task):
   - Create 10+ webpages demonstrating personality modules
   - Each page reflects active module's communication style
   - Validate 3+ custom modules created
   - Ralph enables modules sequentially, logs evolution

2. **Multi-Style Documentation**:
   - Write API documentation in technical, beginner, and tutorial styles
   - Enable different modules for each style (minimalist, bard, architect)
   - Requirements: 3 complete documentation sets

3. **Test-Driven Development Loop**:
   - Write tests, implement features, refactor
   - Enable "hacker" module for debugging, "architect" for design
   - Exit when all tests pass + code coverage ≥80%

4. **Creative Writing with Varied Voices**:
   - Generate 10 short stories
   - Each story uses different module (pirate, french, bard)
   - Validate narrative coherence across iterations

### When to Use VPS Heartbeat

**Ideal Scenarios**:

✅ **Long-running creative/exploratory process**
- Example: "Generate ASCII art narratives continuously"
- No end goal, sustained creativity over weeks

✅ **Want behavioral evolution over time**
- DNA mutates gradually, personality drifts
- Example: Start structured, evolve toward chaos over cycles

✅ **Need meta-cognitive pattern detection**
- Automatically detects stuck loops, intervenes
- Example: "Stop using same primers, try new locations"

✅ **Autonomous operation (VPS deployment)**
- Designed for unattended long-term operation
- Signal handlers for graceful remote shutdown

✅ **Process matters more than specific output**
- Journey > destination
- Example: "Explore creative space, evolve aesthetics"

✅ **Experimental AI organism research**
- Study behavioral genetics, evolutionary drift
- Analyze meta-cognition effectiveness

**Example Use Cases**:

1. **Autonomous Creative Writer** (actual current deployment):
   - Wake every 2-3 hours, generate narrative with ASCII art
   - DNA evolves: creativity_rate, novelty_seeking drift
   - Meta-cognition prevents location fixation, primer staleness
   - 183+ wakes produced over weeks

2. **AI Artist with Genetic Memory**:
   - Generate visual art (SVG, ASCII) continuously
   - DNA influences: verbal_vs_visual, system_vs_chaos
   - Dream-state recovery when generation fails
   - Track aesthetic evolution over cycles

3. **Self-Correcting Data Analyst**:
   - Analyze datasets, generate reports periodically
   - DNA: depth_vs_breadth, archival_vs_ephemeral
   - Meta-cognition detects repetitive analysis patterns
   - Interventions force novel analytical approaches

4. **Experimental Poetry Generator**:
   - Generate poetry with evolving constraints
   - DNA: creativity_rate, novelty_seeking
   - Constraints rotate: oulipo, haiku, free verse
   - Meta-cognition prevents emotional stagnation

### Hybrid Approach

**Combining Both Systems**:

Could create a meta-system where Heartbeat spawns Ralph loops for specific tasks:

```
VPS Heartbeat (organism behavior)
  ↓
  DNA evolves, cycles indefinitely
  ↓
  When task identified:
    ↓
    Spawn Ralph-OG-Modular loop
      ├→ Task: "Build feature X with current personality"
      ├→ Modules: Selected based on Heartbeat DNA
      ├→ Completion: Validated requirements
      └→ Return: Task output + execution log
    ↓
  Heartbeat consumes Ralph's output
  ↓
  DNA mutates based on success/failure
  ↓
  Meta-cognition analyzes task patterns
  ↓
  Next cycle
```

**Benefits**:
- Long-term organism behavior (Heartbeat)
- Bounded task completion (Ralph)
- Behavioral evolution influences task execution
- Task outcomes influence behavioral evolution

**Example**: AI software development organism
- Heartbeat: Long-running codebase maintainer
- Ralph loops: Specific feature implementations, bug fixes
- Heartbeat DNA evolves based on Ralph task success rates
- Meta-cognition detects failing task patterns

## Appendix: File Locations

### Ralph-OG-Modular

**Repository**: `/Users/james/Repos/wibandwob-ralph/ralph-og-modular/`

**Critical Files**:
- Main loop: `ralph-og-modular.sh` (343 lines)
- Module loader: `scripts/load-modules.sh` (73 lines)
- Base persona: `ralph-base.md` (core Ralph personality)
- Module config: `ralph-modules.json` (editable by Ralph)
- Task definition: `PROMPT.md` (constant task)
- Tests: `tests/test-modules.sh` (12 tests, all passing)
- State: `.ralph-og-state` (JSON, session persistence)

**Modules** (`modules/*.md`):
- crabs.md, pirate.md, french.md, architect.md, bard.md, hacker.md, synesthete.md, time-traveller.md
- emoji-oracle.md, minimalist.md (custom user-created)

**Logs**:
- Execution log: `logs/ralph-execution.log` (concise iteration summaries)
- Prompt logs: `logs/prompts/iteration-N-YYYYMMDD-HHMMSS.md` (full prompts)

**Output**:
- Webpages: `module-showcase/pages/*.html`
- Action log: `module-showcase/logs/action-log.md`

### VPS Heartbeat

**Repository**: `/Users/james/Repos/wibandwob-heartbeat/vps-heartbeat/`

**Critical Files**:
- Main scheduler: `heartbeat_vps.py` (833 lines)
- Configuration: `config-vps.yaml`
- State: `state/last_heartbeat_vps.json` (~5KB)
- State archive: `state/notes_archive.jsonl` (append-only)

**Prompts** (`prompts/` hierarchy):
- Core: `prompts/core/{base,state-check}.md`
- Modes: `prompts/modes/{explorer,artist,scientist,chaos,mystic,...}.md` (12 modes)
- Constraints: `prompts/constraints/{oulipo-lipogram-e,haiku-structure}.md`
- Primer strategies: `prompts/primer-strategies/novelty-seeking.md`
- Special: `prompts/special/{dream-recovery,fatigue-warning,meta-analysis}.md`

**Logs**:
- Scheduler: `logs/heartbeat_vps.log` (verbose DEBUG/INFO)
- Cycle logs: `logs/cycles/YYYYMMDD-HHMMSS.log` (stream-json output)
- Prompt logs: `logs/cycles/YYYYMMDD-HHMMSS-prompt.txt` (composed prompts)
- Meta-analysis: `logs/meta-analysis/cycle-{N}.json` (every 10 cycles)

**Output**:
- Narratives: `output/wake-{N}-*.{txt,md}` (183+ files)
- Character logs: `output/CHARACTER_LOG*.md`

---

**Document Version**: 1.0
**Last Updated**: 2026-01-02
**Systems Compared**: ralph-og-modular (commit fc8a82b), vps-heartbeat (cycle 183+)
**Analysis Depth**: Comprehensive (800+ lines)
