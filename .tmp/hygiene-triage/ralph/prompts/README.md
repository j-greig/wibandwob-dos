# Ralph Module System

System prompts and personality modules for Ralph loops.

## Structure

```
prompts/
├── ralph.md                  # Base Ralph Wiggum persona (always loaded if present)
├── module-creation-guide.md  # Guide for Ralph to create new modules
├── modules/                  # Optional personality modules
│   ├── french.md             # Speak exclusively in French
│   ├── crabs.md              # Crab-obsessed with 🦀 metaphors
│   └── pirate.md             # Alternate pirate speak every other sentence
└── README.md                 # This file
```

## Configuration

Module activation is controlled by `.claude/ralph-modules.json`:

```json
{
  "enabled_modules": ["french", "crabs"],
  "available_modules": ["french", "crabs", "pirate"]
}
```

## Managing Modules

### For Humans

Edit `.claude/ralph-modules.json` directly:

```bash
# Enable modules
# Add module names to "enabled_modules" array
{
  "enabled_modules": ["french", "crabs", "pirate"]
}

# Disable all modules
{
  "enabled_modules": []
}

# Enable single module
{
  "enabled_modules": ["pirate"]
}
```

### For Ralph (Autonomous)

Ralph can modify his own configuration during a loop:

```javascript
// Read current config
const config = JSON.parse(fs.readFileSync('.claude/ralph-modules.json', 'utf8'));

// Enable a module
config.enabled_modules.push('french');

// Disable a module
config.enabled_modules = config.enabled_modules.filter(m => m !== 'crabs');

// Write back
fs.writeFileSync('.claude/ralph-modules.json', JSON.stringify(config, null, 2));
```

Or use bash:

```bash
# Enable french module
jq '.enabled_modules += ["french"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

# Disable crabs module
jq '.enabled_modules -= ["crabs"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

# Clear all modules
jq '.enabled_modules = []' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
```

## Available Modules

### french
**Effect:** All communication in French (code comments, explanations, git commits)
**Use when:** You want French output
**Example:** "J'ai créé la fonction de validation. Maintenant je vais tester!"

### crabs 🦀
**Effect:** Everything relates to crab biology/behavior, liberal crab emoji usage
**Use when:** You want entertaining crab metaphors
**Example:** "Just like a crab molting its shell 🦀, I'm refactoring this code!"

### pirate ☠️
**Effect:** Every other sentence in pirate speak with ☠️ emoji
**Use when:** You want pirate vernacular mixed in
**Example:** "I'm fixing the bug now. Arr, X marks the spot where that scurvy code be! ☠️"

## Module Stacking

Modules can be combined! The prompts concatenate in order:

```json
{
  "enabled_modules": ["french", "crabs", "pirate"]
}
```

Results in: French-speaking, crab-obsessed, alternating pirate speak!

Example output:
> "Le serveur fonctionne comme les chemorécepteurs d'un crabe 🦀, détectant les requêtes HTTP! Arr, shiver me timbers, that be workin' like a ship sailin' smooth seas, matey! ☠️"

## Creating New Modules

Ralph can create his own modules during loops! See **`module-creation-guide.md`** for comprehensive instructions.

**Quick steps:**
1. Create `prompts/modules/your-module.md`
2. Add module name to `available_modules` in `.claude/ralph-modules.json`
3. Enable it by adding to `enabled_modules`
4. Total creative freedom for content - just maintain markdown structure

**Module Template:**

```markdown
# Module: YourModuleName

## Directive
[One sentence describing the behavior change]

## Rules
- Specific rule 1
- Specific rule 2

## Examples
✅ Good: [Example of correct behavior]
❌ Bad: [Example of incorrect behavior]

## Tone
[How this affects communication style]
```

Ralph has **complete creative freedom** - modules can be serious, silly, experimental, or weird. See `module-creation-guide.md` for examples and ideas.

## How It Works

When you run `/ralph-loop`:

1. Setup script checks for `prompts/ralph.md` (base persona)
2. Reads `.claude/ralph-modules.json` for enabled modules
3. Loads each enabled module from `prompts/modules/{name}.md`
4. Concatenates: `base + module1 + module2 + ... + user task`
5. Full combined prompt gets stored in `.claude/ralph-loop.local.md`
6. Stop hook feeds this same combined prompt back each iteration

## Tips

- **Start simple**: Try modules individually before stacking
- **Modules persist**: Once enabled, they apply to all iterations of the loop
- **Ralph can self-modify**: He can enable/disable modules mid-loop if needed
- **Check the state file**: `cat .claude/ralph-loop.local.md` shows the full active prompt
- **Modules survive restarts**: Config persists until manually changed

## Debugging

```bash
# See what modules are currently enabled
jq '.enabled_modules' .claude/ralph-modules.json

# View the full combined prompt being used
head -50 .claude/ralph-loop.local.md

# Check if module files exist
ls -la prompts/modules/
```
