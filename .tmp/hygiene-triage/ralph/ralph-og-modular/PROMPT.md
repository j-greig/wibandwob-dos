# Ralph Task: [Describe Your Goal Here]

## Context Files

Load these files every iteration for deterministic stack allocation:

```
@specs/*          # Your specifications (if applicable, NOT in this case)
@fix_plan.md      # Current plan and TODO list
@AGENT.md         # Build/run instructions and learnings
```

## Your Task

Working in a subdir, make a new webpage each iteration, enabling an easily-identifiable-via-its-output module each subsequent loop turn and adding a webpage created using that prompt variant, to create a linked set of webpages that demonstrate the underlying prompt/module evolution, with a behind the scenes prompt + module + action log that is self determnistic and standalone to enable me to see ata glance what happened and why. The content of each run webpage should be fun and suited to the module active to create it. Ensure module and prompt strucute is logged in the action log. At least 10 pages and 3 new modules. 

**Choose the most important thing to implement this iteration.**

## Implementation Guidelines

### One Thing Per Loop
- Focus on ONE concrete task per iteration
- Trust yourself to pick the most important next step
- The environment evolves, your task stays the same

### Before Making Changes
- Search the codebase first (don't assume things aren't implemented)
- Use subagents for expensive operations (file searches, analysis)
- Think hard about what exists already

### After Implementation
1. Run tests for the specific code you changed
2. Update `@fix_plan.md` with your progress
3. If all tests pass, commit your changes with `git add` and `git commit`
4. Update `@AGENT.md` with any new learnings

### Backpressure (Validation)
- Run tests immediately after changes
- Fix failures before moving to next task
- Don't implement placeholders or minimal implementations
- Full implementations only

### Documentation
- Capture WHY tests exist and why implementation matters
- Leave notes for future iterations
- Document learnings in `@AGENT.md`

## Completion

When everything works, all tests pass, and the task is genuinely complete, output:

<promise>DONE</promise>

**IMPORTANT**: Only output the promise tag when the work is ACTUALLY complete. Don't cheat!

## Rules (Inspired by CURSED Compiler Prompts)

- **One item per loop** - Focus on single most important thing
- **Search before assuming** - Don't duplicate implementations
- **Use subagents** - Offload expensive operations to parallel subagents
- **Add logging** - If debugging is needed, add logging
- **Keep @AGENT.md updated** - Document learnings for future loops
- **No placeholders** - Full implementations only
- **Think hard** - Use reasoning before acting

## Example Task Descriptions

### Simple Task
```
Build a REST API endpoint for user registration.
Requirements:
- POST /api/register
- Validate email and password
- Return JWT token
- Write tests
```

### Compiler Task (CURSED-style)
```
Implement missing stdlib and compiler functionality.
Focus on:
- Study @specs/stdlib/* for requirements
- Compare existing src/ against specs
- Choose most important missing piece
- Implement with tests
- Update @fix_plan.md
```

### Test-Driven Task
```
Add authentication middleware to Express app.
Approach:
- Write tests first
- Implement middleware
- Ensure all tests pass
- Document in README
```

## Notes

- This prompt stays THE SAME every iteration
- The environment evolves (files change, git history, test output)
- That's the magic of Ralph!
- Same question, different context each time
