# Autoresearch Ideas: Journal Auto-Capture

## Extraction strategies
- **Tool-call clustering**: group tool calls into "episodes" (read→edit→test = one unit of work), summarise per episode
- **Diff-based body**: extract actual file diffs from tool results, include abbreviated diffs in body
- **Conversation arc detection**: find the user's intent shifts (new topic = new section in body)
- **Error recovery narrative**: when agent hits errors and fixes them, narrate the debugging arc

## Prompt engineering
- **Few-shot examples**: include 2-3 gold-standard journal entries as examples in the prompt
- **Chain of thought**: have the LLM first list key events, then compose the summary
- **Structured output**: use JSON mode / tool_use to force schema compliance
- **Persona priming**: "You are a meticulous technical writer summarising a pair-programming session"

## Tag extraction
- **File path → tag**: `src/core/window-chrome.ts` → `window-chrome`, `core`
- **Tool frequency → tag**: heavy `bash` usage → `ops`, heavy `edit` → `refactor`
- **Topic clustering**: extract nouns from user messages, deduplicate, pick top 3-5
- **Existing tag vocabulary**: load existing journal tags, prefer matching over inventing new ones

## Kind classification
- **Heuristic rules**: questions in user msgs → `question`, file edits → `note`, architectural discussion → `decision`
- **LLM classification**: ask model to pick kind with reasoning
- **Hybrid**: heuristic first, LLM override if confidence low

## Scoring improvements
- **Reference summaries**: hand-write 3-5 gold summaries, measure ROUGE/overlap
- **Tag recall**: check what % of files-touched appear in tags
- **Readability score**: Flesch-Kincaid or similar on the body text
- **De-duplication check**: don't create entries that duplicate existing journal content

## Pipeline architecture
- **Two-pass**: fast heuristic pass (no LLM) for metadata, then LLM pass for title+body
- **Streaming**: process session line-by-line, build context window incrementally
- **Caching**: hash session file, skip re-processing unchanged sessions
- **Batch mode**: process all new sessions since last capture in one run
