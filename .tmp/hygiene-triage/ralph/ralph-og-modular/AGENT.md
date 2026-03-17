# AGENT.md - Build Instructions & Learnings

## How to Run

1. View the showcase: Open `module-showcase/pages/index.html` in a browser
2. Each page links to the next iteration's page
3. View logs: Check `module-showcase/logs/action-log.md`

## Project Structure

```
module-showcase/
├── pages/           # HTML pages (one per iteration)
├── logs/
│   └── action-log.md  # Detailed iteration log
└── index.html      # Navigation hub (to be created)
```

## Learnings

### Iteration 1
- **Setup**: Created project structure in `module-showcase/` subdir
- **Decision**: Start with baseline (no modules) to establish a control/reference page
- **Module System**: Modules are in `modules/*.md`, config in `ralph-modules.json`
- **Available modules**: crabs, pirate, french, architect, bard, hacker, synesthete, time-traveller
- **Note**: Each iteration should enable ONE module, create ONE page, log the changes
- **Files created**:
  - `module-showcase/pages/00-baseline.html` - Pure Ralph personality webpage
  - `module-showcase/index.html` - Navigation hub with page grid
  - `module-showcase/logs/action-log.md` - Detailed iteration tracking
  - `fix_plan.md` - TODO list and progress tracker
  - `AGENT.md` - This file
- **Next**: Enable "crabs" module for iteration 2

### Iteration 2
- **Module**: crabs 🦀
- **Page**: `module-showcase/pages/01-crabs.html`
- **Key learning**: Modules dramatically transform communication style while preserving core Ralph personality
- **Module config**: ralph-modules.json in root (not .claude/), contains enabled_modules array
- **Content approach**: Created crab-themed programming tutorial with biology analogies
  - Functions = claws (grabbing/manipulating)
  - Classes = species (inheritance/taxonomy)
  - Refactoring = molting (shedding old shell)
  - Async = waiting for tide
  - Real crab facts integrated throughout
- **Design**: Beach gradient background, animated sideways-walking crabs, fact boxes
- **Files updated**: Created 01-crabs.html, updated index.html navigation
- **Next**: Enable "pirate" module for iteration 3

### Iteration 3
- **Module**: pirate ☠️
- **Page**: `module-showcase/pages/02-pirate.html`
- **Key learning**: Alternating sentence patterns create rhythmic, engaging content while maintaining technical accuracy
- **Module mechanics**:
  - Sentence 1: Normal speech
  - Sentence 2: Pirate speak with ☠️ emoji
  - Repeat throughout entire response
  - Code blocks/bullets don't count as sentences
- **Content approach**: Created pirate-themed Git tutorial with nautical metaphors
  - git commit = drop anchor (mark safe point)
  - git push = send treasure to fleet (share with remote)
  - git branch = chart new course (create alternate path)
  - git merge = combine treasure maps (integrate changes)
  - Working dir/staging/repo = three ship decks
  - Real Git facts integrated with pirate voice
- **Design**: Dark nautical theme (night ocean, wood/gold), animated swaying skull + sailing ship
- **Pattern observation**: The alternating pattern forces careful sentence construction - had to ensure technical accuracy in both normal AND pirate sentences. Creates unique voice that's educational yet entertaining.
- **Files updated**: Created 02-pirate.html, updated index.html navigation, action-log.md
- **Next**: Enable "french" module for iteration 4

### Iteration 4
- **Module**: french 🇫🇷
- **Page**: `module-showcase/pages/03-french.html`
- **Key learning**: Language transformation modules can completely change communication style while maintaining technical accuracy and code compatibility
- **Module mechanics**:
  - ALL conversational text must be in French
  - Code comments in French
  - Code syntax remains standard (English keywords)
  - File paths and system commands remain in English
- **Content approach**: Created comprehensive CSS tutorial entirely in French
  - Selectors (sélecteurs)
  - Box model (modèle de boîte) with French diagram
  - Colors (couleurs) - multiple formats
  - Flexbox for layout
  - Animations and transitions
  - Responsive design with media queries
  - French vocabulary table mapping CSS terms to French
- **Design**: French flag colors (tricolor: #002395 blue, white, #ED2939 red), animated Eiffel Tower, rotating baguette emoji
- **Pattern observation**: Complete language switch demonstrates how personality modules can affect entire communication layer while preserving code functionality. Ralph's enthusiasm translates perfectly to French ("C'est comme être un artiste!"). Shows that technical concepts are universal - only the explanation language changes.
- **Files updated**: Created 03-french.html, updated index.html navigation, action-log.md, ralph-modules.json
- **Next**: Enable "architect" module for iteration 5
