# Ralph Loop Examples

Practical examples of using Ralph for real-world tasks.

## Basic Examples

### Example 1: Build a Simple API

```bash
/ralph-loop "Build a REST API in Node.js with these endpoints: GET /users, POST /users, DELETE /users/:id. Include basic validation and tests. Use Express." --max-iterations 20 --completion-promise "ALL_TESTS_PASS"
```

**What Ralph does:**
1. Creates package.json and installs Express
2. Writes server.js with routes
3. Writes tests
4. Runs tests, sees failures
5. Fixes bugs iteratively
6. Outputs `<promise>ALL_TESTS_PASS</promise>` when done

### Example 2: Fix Failing Tests

```bash
/ralph-loop "Run the test suite and fix all failing tests. Keep running until all tests pass." --max-iterations 30 --completion-promise "ALL_GREEN"
```

**What Ralph does:**
1. Runs `npm test`
2. Reads test output
3. Fixes first failing test
4. Runs tests again
5. Repeats until completion promise

### Example 3: Refactor Code

```bash
/ralph-loop "Refactor the auth.js file to use async/await instead of callbacks. Ensure all tests still pass after refactoring." --max-iterations 15 --completion-promise "REFACTOR_COMPLETE"
```

## Advanced Examples

### Example 4: Multi-Module Creative Writing

```bash
# Enable french + pirate modules
jq '.enabled_modules = ["french", "pirate"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

/ralph-loop "Write a technical README for a database migration tool" --max-iterations 5 --completion-promise "DONE"
```

**Result:** Technical documentation written in French with alternating pirate speak!

### Example 5: Create Custom Module for Task

```bash
/ralph-loop "First, create a 'security-focused' module that makes you paranoid about security issues. Then audit the codebase for security vulnerabilities and fix them." --max-iterations 25 --completion-promise "SECURITY_AUDIT_COMPLETE"
```

**What Ralph does:**
1. Creates `prompts/modules/security-focused.md`
2. Enables the module
3. Audits code with security mindset
4. Fixes vulnerabilities iteratively

## Real-World Use Cases

### Use Case 1: Test-Driven Development

```bash
/ralph-loop "Implement feature X following TDD:
1. Write failing tests first
2. Implement minimal code to pass tests
3. Refactor
4. Repeat until complete
Output <promise>TDD_COMPLETE</promise> when all tests pass and code is clean." --max-iterations 40 --completion-promise "TDD_COMPLETE"
```

### Use Case 2: Debug Production Issue

```bash
/ralph-loop "Debug why the login endpoint is returning 500 errors. Check logs, add debug statements, fix the bug, verify with tests." --max-iterations 20 --completion-promise "BUG_FIXED"
```

### Use Case 3: Documentation Generation

```bash
# Enable verbose module for detailed explanations
jq '.enabled_modules = ["verbose"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json

/ralph-loop "Generate comprehensive API documentation from the source code. Include examples, error codes, and usage patterns." --max-iterations 10 --completion-promise "DOCS_COMPLETE"
```

## Prompt Engineering Tips

### Good Prompts

✅ **Specific completion criteria:**
```bash
/ralph-loop "Build API with tests. Complete when: (1) all endpoints work, (2) tests pass, (3) coverage >80%" --completion-promise "DONE"
```

✅ **Clear success metrics:**
```bash
/ralph-loop "Fix bugs until: npm test passes with 0 failures" --completion-promise "ALL_TESTS_PASS"
```

✅ **Iterative approach:**
```bash
/ralph-loop "Refactor gradually. Run tests after each change. Stop when code is clean AND tests pass." --completion-promise "REFACTOR_COMPLETE"
```

### Bad Prompts

❌ **Vague completion:**
```bash
/ralph-loop "Make the code better" --completion-promise "DONE"
# What does "better" mean?
```

❌ **No verification:**
```bash
/ralph-loop "Fix the bug" --completion-promise "FIXED"
# How do we know it's fixed?
```

❌ **Impossible task:**
```bash
/ralph-loop "Make the app infinitely scalable" --max-iterations 10
# Can't complete in 10 iterations, will fail
```

## Module Combination Ideas

### Strict Code Reviewer
```json
{
  "enabled_modules": ["verbose", "security-focused"]
}
```
Result: Extremely detailed, security-paranoid code review

### Friendly Beginner Teacher
```json
{
  "enabled_modules": ["verbose", "encouraging"]
}
```
Result: Patient, detailed explanations

### Chaotic Fun
```json
{
  "enabled_modules": ["pirate", "crabs", "french"]
}
```
Result: Bilingual pirate crab discussing code

## Tips for Success

1. **Use --max-iterations as safety net**: Always set a reasonable max
2. **Make completion promises specific**: "ALL_TESTS_PASS" > "DONE"
3. **Include verification in prompt**: "Run tests to verify" helps Ralph check work
4. **Start simple**: Test with small tasks before complex ones
5. **Watch the iterations**: `grep '^iteration:' .claude/ralph-loop.local.md`
6. **Let Ralph create modules**: If task needs specific behavior, let Ralph make a module

## Monitoring Active Loops

```bash
# Check current iteration
grep '^iteration:' .claude/ralph-loop.local.md

# View full state
head -20 .claude/ralph-loop.local.md

# See active modules
jq '.enabled_modules' .claude/ralph-modules.json

# Cancel if needed
/cancel-ralph
```

## Common Patterns

### Pattern: Test-Fix Loop
```bash
/ralph-loop "Run tests, fix failures, repeat until all pass" --max-iterations 30 --completion-promise "ALL_GREEN"
```

### Pattern: Build-Verify-Deploy
```bash
/ralph-loop "Build the project, run tests, deploy if tests pass" --max-iterations 10 --completion-promise "DEPLOYED"
```

### Pattern: Iterative Improvement
```bash
/ralph-loop "Optimize performance. Measure before/after each change. Stop when 50% faster." --max-iterations 25 --completion-promise "PERFORMANCE_TARGET_MET"
```

---

Have a great example? Submit a PR to add it here!
