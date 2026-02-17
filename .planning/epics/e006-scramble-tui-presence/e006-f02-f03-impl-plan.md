# E006 F02+F03 Implementation Plan

> tl;dr — ScrambleEngine: keyword KB from local docs (F02) + Haiku LLM client (F03). KB answers system questions without API calls. Haiku handles open questions with Scramble voice. Both feed into ScrambleView.say().

## F02: Knowledge Base

### What
- `ScrambleKnowledgeBase` class: loads README.md, CLAUDE.md, command registry at startup
- Keyword-to-response index: categories for build, architecture, commands, identity
- Query method: extract keywords from input, find best category match, return response
- Scramble voice filter: responses are terse, lowercase, kaomoji signoff

### Files
- NEW: `app/scramble_engine.h` — ScrambleKnowledgeBase + ScrambleEngine classes
- NEW: `app/scramble_engine.cpp` — implementation
- NEW: `app/scramble_engine_test.cpp` — ctest for KB queries
- MOD: `app/CMakeLists.txt` — add to build + test

### KB Categories
| Category | Keywords | Source | Response pattern |
|----------|----------|--------|------------------|
| build | build, compile, cmake, make | README.md | build commands |
| run | run, start, launch, execute | README.md | run commands |
| architecture | architecture, how, work, structure | CLAUDE.md | brief arch summary |
| commands | command, commands, what can, api | command_registry | list capabilities |
| identity | who, scramble, you, cat | hardcoded | scramble canon |
| api | api, server, endpoint, port | CLAUDE.md | api server info |
| llm | llm, provider, haiku, claude | CLAUDE.md | llm config info |

### Test (ctest)
- Create KB, load docs
- Query "how do i build" -> response contains "cmake"
- Query "what commands are there" -> response contains command names
- Query "who are you" -> response contains scramble identity
- Query garbage -> returns empty/fallback

## F03: Haiku Brain

### What
- `ScrambleHaikuClient` inside ScrambleEngine
- Uses curl-based HTTP to Anthropic API (same pattern as anthropic_api_provider)
- System prompt: compressed Scramble personality
- Token budget: 200 tokens max
- Rate limit: 1 call per 30s
- Fallback: if no API key or unavailable, return empty (KB takes over)

### Files
- Same files as F02 (engine.h/cpp)
- MOD: `app/llm/config/llm_config.json` — add scramble_haiku provider config

### Flow
```
query("what is the meaning of life")
  -> KB lookup: no match
  -> Haiku call: send with system prompt + query
  -> response: "substrate. (=^..^=)"
  -> ScrambleView.say(response)
```

### Test
- Build test only (no live API without key)
- Test rate limiter logic
- Test fallback when no key

## Wiring

### ScrambleView integration
- ScrambleView gets pointer to ScrambleEngine
- Idle pose changes: instead of hardcoded "mrrp!", ask engine for idle observation
- Engine picks from KB topics or generates via Haiku

## Verification
1. `ctest` passes scramble_engine test
2. Build clean
3. Run app, F8, verify idle observations come from KB
4. Hardcoded strings replaced with engine-sourced content
