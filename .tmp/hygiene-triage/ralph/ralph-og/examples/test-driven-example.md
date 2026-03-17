# Ralph Task: Build Calculator with TDD

## Context Files

```
@README.md       # Project overview
@test/*.test.js  # Existing tests
```

## Your Task

Build a calculator library using Test-Driven Development (TDD).

### Requirements

Implement a Calculator class with methods:
- `add(a, b)` - Addition
- `subtract(a, b)` - Subtraction
- `multiply(a, b)` - Multiplication
- `divide(a, b)` - Division (handle divide by zero)

**Approach: Test First, Then Implement**

## Test-Driven Development Flow

### The Red-Green-Refactor Cycle

Each iteration should follow:

1. **RED**: Write a failing test
2. **GREEN**: Make it pass (simplest implementation)
3. **REFACTOR**: Improve the code (optional)

### Choose Your Next Test

Each iteration, pick the next test to write:
1. Test for `add()` basic case?
2. Test for `add()` with negatives?
3. Test for `subtract()`?
4. Test for `multiply()`?
5. Test for `divide()`?
6. Test for divide by zero error?

**Trust yourself to pick the right test!**

## Implementation Guidelines

### One Test Per Loop

Focus on ONE test each iteration:

#### Iteration 1 Example:
```javascript
// Write test
test('add two positive numbers', () => {
  const calc = new Calculator();
  expect(calc.add(2, 3)).toBe(5);
});

// Run test → FAILS (Calculator doesn't exist)
// Implement just enough to pass
class Calculator {
  add(a, b) { return a + b; }
}
// Run test → PASSES ✓
```

#### Iteration 2 Example:
```javascript
// Write test
test('add negative numbers', () => {
  const calc = new Calculator();
  expect(calc.add(-5, 3)).toBe(-2);
});

// Run test → PASSES (implementation already handles it)
// No changes needed!
```

### After Writing Each Test

1. **Run tests**: `npm test`
2. **If RED (failing)**:
   - Implement simplest code to make it pass
   - Run tests again
3. **If GREEN (passing)**:
   - Optionally refactor
   - Commit if all tests still pass
4. **Move to next test**

### Quality Standards

- Tests should be clear and focused
- One assertion per test
- Test names describe what they test
- Implementation should be simple
- No over-engineering

## Completion

When you have comprehensive tests for all operations and they all pass, output:

<promise>TESTS_GREEN</promise>

**Only output this when:**
- ✅ All four operations implemented
- ✅ Edge cases tested (negatives, zero, divide by zero)
- ✅ All tests passing
- ✅ No pending or skipped tests

## Example Session Flow

### Iteration 1: Setup
- Creates `calculator.js`
- Creates `calculator.test.js`
- Writes first test for `add()`
- Test fails (no Calculator class)

### Iteration 2: Make Add Work
- Implements Calculator class with `add()`
- Test passes ✓
- Commits: "Add basic addition"

### Iteration 3: Test Negatives
- Writes test for `add(-5, 3)`
- Test passes (already works!)
- No changes needed

### Iteration 4: Add Subtract
- Writes test for `subtract(10, 3)`
- Test fails (method doesn't exist)
- Implements `subtract()`
- Test passes ✓

### Iteration 5: Add Multiply
- Writes test for `multiply(4, 5)`
- Test fails
- Implements `multiply()`
- Test passes ✓

### Iteration 6: Add Divide
- Writes test for `divide(10, 2)`
- Test fails
- Implements `divide()`
- Test passes ✓

### Iteration 7: Test Divide by Zero
- Writes test for `divide(10, 0)` should throw error
- Test fails (no error handling)
- Adds error handling to `divide()`
- Test passes ✓

### Iteration 8: Review
- All operations implemented
- All tests passing
- Commits: "Complete calculator with all operations"
- Outputs: `<promise>TESTS_GREEN</promise>`

## Testing Best Practices

### Good Test Names

```javascript
✅ test('add two positive numbers', ...)
✅ test('add negative and positive number', ...)
✅ test('divide by zero throws error', ...)

❌ test('test1', ...)
❌ test('it works', ...)
❌ test('addition', ...)  // too vague
```

### Good Assertions

```javascript
✅ expect(calc.add(2, 3)).toBe(5);
✅ expect(() => calc.divide(10, 0)).toThrow();

❌ expect(calc.add(2, 3)).toBeTruthy();  // too loose
❌ expect(result).toBe(result);  // meaningless
```

### Test Structure

```javascript
// Arrange
const calc = new Calculator();

// Act
const result = calc.add(2, 3);

// Assert
expect(result).toBe(5);
```

## Notes

- This demonstrates TDD applied to a simple problem
- Each iteration adds one test and makes it pass
- The prompt stays the same, but tests accumulate
- Git history shows the progression clearly

## Rules

- **Red first** - Write failing test before implementation
- **Green next** - Simplest code to pass
- **Refactor optionally** - Improve while staying green
- **One test per loop** - Focus and clarity
- **Commit when green** - Track progress
- **No skipping tests** - Keep them all running
