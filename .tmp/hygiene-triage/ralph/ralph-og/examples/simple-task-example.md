# Ralph Task: Build User Registration API

## Context Files

```
@README.md       # Project overview
@package.json    # Dependencies
```

## Your Task

Create something fun inspired by wibandwob.com and turn it into a website / web experience in a subdir of this project as a standalone thing. Not just simple web pages. 



### Choose the Most Important Thing

Each iteration, pick what's most important:
<example>
1. First: Set up Express server?
2. Then: Add validation?
3. Then: Implement JWT?
4. Then: Write tests?
5. Finally: Ensure all tests pass?
</example>

**Trust yourself to decide!**

## Implementation Guidelines

### One Thing Per Loop
Focus on ONE concrete step each iteration. Don't try to do everything at once.

### Before Making Changes
- Check if package.json exists
- Search for existing server.js or similar
- Don't assume nothing exists

### After Implementation
1. Run `npm test` (or create tests if they don't exist)
2. Fix any failures
3. When all tests pass, commit:
   ```bash
   git add -A
   git commit -m "Add user registration - iteration complete"
   ```

### Quality Standards
- No placeholder implementations
- Full error handling
- Clear variable names
- Tests must actually pass

## Completion

When the API works correctly and ALL tests pass, output:

<promise>API_COMPLETE</promise>

**Only output this when you're genuinely done!**

## Example Session Flow

### Iteration 1
- Creates `server.js` with Express setup
- Adds `/api/register` route stub
- No tests yet

### Iteration 2
- Adds email/password validation
- Creates basic tests
- Tests fail (JWT not implemented)

### Iteration 3
- Implements JWT token generation
- Tests now pass for valid input
- Missing tests for invalid input

### Iteration 4
- Adds tests for invalid email
- Adds tests for short password
- All tests pass ✓
- Outputs: `<promise>API_COMPLETE</promise>`

## Notes

- Keep it simple - this is a learning example
- Use Express (or your preferred framework)
- JWT library: `jsonwebtoken` is fine
- Validation: Can use `validator` package or write your own

## Rules

- **One item per loop** - Small focused changes
- **Test after changes** - Run `npm test` every iteration
- **Commit when tests pass** - Build git history
- **No placeholders** - Full implementations only
