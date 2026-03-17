# Contributing to Ralph Wiggum

Thanks for your interest in improving Ralph! Here's how to contribute.

## Ways to Contribute

### 1. Report Issues
- Found a bug in the Stop hook? Open an issue.
- Module not loading? Let us know.
- Documentation unclear? Tell us where.

### 2. Create New Modules
The easiest way to contribute! Share your creative personality modules:

```bash
# Create your module
cat > prompts/modules/your-module.md <<'EOF'
# Module: YourModule

## Directive
Your behavior modification here

## Rules
- Rule 1
- Rule 2
EOF

# Test it
jq '.enabled_modules += ["your-module"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
/ralph-loop "test task" --max-iterations 2

# Submit a PR!
```

**Module ideas we'd love to see:**
- Language modules (Spanish, Japanese, Klingon)
- Personality modules (zen, chaos, methodical)
- Domain-specific modules (legal, medical, academic)
- Entertainment modules (song lyrics, movie quotes)

### 3. Improve Documentation
- Add examples to README
- Create tutorial videos
- Write blog posts about your Ralph experiences
- Improve module-creation-guide.md

### 4. Enhance the Plugin
- Better error handling in Stop hook
- Module auto-discovery
- Interactive module selection
- Module marketplace/registry

## Pull Request Process

1. **Fork the repo**
2. **Create a branch**: `git checkout -b feature/amazing-module`
3. **Make your changes**
4. **Test thoroughly**:
   ```bash
   # Test the Stop hook doesn't break
   /ralph-loop "simple test" --max-iterations 2 --completion-promise "DONE"

   # Test module loading
   jq '.enabled_modules += ["your-module"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
   ```
5. **Commit with emoji**: `git commit -m "✨🦀 Add crab-themed haiku module"`
6. **Push and create PR**

## Commit Message Format

Use emoji prefixes for clarity:

- `✨` New feature or module
- `🐛` Bug fix
- `📝` Documentation
- `🎨` Code style/formatting
- `♻️` Refactoring
- `🧪` Tests
- `🦀` Crab-related (obviously important)
- `☠️` Pirate-related

**Examples:**
```bash
git commit -m "✨ Add haiku module"
git commit -m "🐛 Fix Stop hook JSON parsing"
git commit -m "📝 Update module creation guide with examples"
git commit -m "🦀☠️ Add pirate-crab crossover module"
```

## Code Style

**Bash scripts:**
- Use `set -euo pipefail`
- Validate inputs before use
- Provide helpful error messages
- Comment complex logic

**Markdown:**
- Use clear headers
- Include examples
- Add emoji sparingly (unless it's a module requirement)
- Keep line length reasonable

**Modules:**
- Must have `# Module:` header
- Must have `## Directive` section
- Should have examples
- Can be as creative as you want

## Testing

Before submitting:

```bash
# Basic smoke test
/ralph-loop "echo 'test' > test.txt" --max-iterations 1

# Module loading test
jq '.enabled_modules = ["french", "crabs"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
/ralph-loop "test multi-module" --max-iterations 1

# Stop hook completion promise test
/ralph-loop "echo 'done'; echo '<promise>COMPLETE</promise>'" --completion-promise "COMPLETE"
```

## Module Guidelines

Modules should:
- ✅ Be fun, useful, or experimental
- ✅ Have clear behavior rules
- ✅ Include examples
- ✅ Work when stacked with other modules
- ❌ Not break markdown syntax
- ❌ Not conflict with core Ralph behavior (honesty, persistence)

**We especially want:**
- Language/locale modules
- Domain expertise modules (legal, medical, academic writing)
- Code review style modules (strict, lenient, security-focused)
- Communication style modules (technical, beginner-friendly, academic)

## License

By contributing, you agree your contributions will be licensed under the MIT License (same as the project).

## Questions?

- Open an issue for general questions
- Tag issues with `question` label
- Check existing issues first

## Remember

Ralph says: "I'm helping!" - and so are you. Thanks for contributing!

---

*"Me fail English? That's unpossible!"* - Ralph Wiggum
