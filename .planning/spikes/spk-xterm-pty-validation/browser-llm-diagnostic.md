# Browser LLM Diagnostic — What's broken and why

**Date:** 2026-02-17
**Branch:** `spike/xterm-pty-validation`
**Symptom:** Chat in browser (ttyd @ localhost:7681) hangs after user types message. No response after 15s+.

---

## What actually happens (from debug log)

### 1. Config file not found
```
DEBUG: Config file load result: FAILED
ERROR: Failed to load llm/config/llm_config.json
```
The app runs from ttyd's working dir, not the repo root. Config path is hardcoded as relative:
```cpp
// wibwob_engine.cpp:228
const std::vector<std::string> cfgPaths = { "app/llm/config/llm_config.json" };
```
When ttyd spawns the app, CWD is wherever ttyd was started, not the repo root. So `app/llm/config/llm_config.json` doesn't resolve. **The app falls back to a hardcoded default config.**

### 2. Default config uses claude_code_sdk as activeProvider
The fallback default (in `llm_config.cpp:366`) also has `claude_code_sdk` as active. Even though we enabled `anthropic_api` in the JSON file, that file is never read.

### 3. Provider cascade: sdk → api → cli
```
claude_code_sdk → FAIL (bridge script path also relative: "llm/sdk_bridge/..." not found)
anthropic_api   → FAIL (isAvailable() returns false because apiKey is empty)
claude_code     → PASS (claude CLI binary exists on this machine)
```

### 4. Runtime key injection hits wrong provider
```
DEBUG: Switching to anthropic_api for runtime key
DEBUG: Attempting to initialize provider: anthropic_api
INFO: Anthropic API key not in env (ANTHROPIC_API_KEY) — can be set at runtime via setApiKey()
DEBUG: Provider anthropic_api is not available    <-- THIS IS THE BUG
ERROR: Failed to switch to anthropic_api provider
DEBUG: API key injected into provider claude_code  <-- Falls back, key goes to wrong provider
```

The `initializeProvider("anthropic_api")` chain is:
1. Create provider instance ✓
2. Call `configure(configJson)` → sets endpoint/model, looks for env key, doesn't find it → returns true (our fix)
3. Call `isAvailable()` → checks `!apiKey.empty()` → apiKey IS empty → **returns false**
4. Provider rejected

**The key hasn't been set yet when isAvailable() is checked.** The sequence is:
```
initializeProvider() → configure() → isAvailable() → FAIL
                                                        ↓
                                        setApiKey() never reached
```

### 5. Chat falls through to claude_code (CLI)
```
DEBUG: [streaming] Command: claude -p --output-format stream-json "hiya" 2>&1
```
The `claude` CLI probably isn't authed in the ttyd session context, or hangs waiting for OAuth.

---

## Root causes (3 of them)

### RC1: Relative config paths break in ttyd
All paths are relative to repo root. ttyd doesn't guarantee CWD is repo root. The `exec` command runs from wherever the shell starts.

**Fix:** Either use absolute paths, or have the ttyd launch script `cd` to repo root first.

### RC2: anthropic_api provider rejects itself when apiKey is empty
`isAvailable()` returns `!apiKey.empty()`. But we WANT the provider to be available for runtime key injection. The key arrives AFTER `initializeProvider()` completes.

**Fix:** `isAvailable()` should return true if `configure()` succeeded (endpoint + model set). The key can arrive later. OR: inject the key BEFORE calling initializeProvider, by passing it through configure().

### RC3: setApiKey flow is backwards
Current: create provider → configure → isAvailable check → THEN try to set key
Needed: set key first → THEN create provider (or: create provider, set key, skip isAvailable)

**Fix options:**
- A) Add the key to the config JSON before calling `initializeProvider()`
- B) Remove `isAvailable()` gate from `initializeProvider()` for providers that support runtime keys
- C) Have `setApiKey()` bypass `initializeProvider()` entirely — just create the provider, set key, assign it directly

---

## Simplest fix (option C)

```cpp
void WibWobEngine::setApiKey(const std::string& key) {
    // Create anthropic_api provider directly, bypassing isAvailable() gate
    auto provider = LLMProviderFactory::getInstance().createProvider("anthropic_api");
    if (provider) {
        // Configure it
        if (config) {
            ProviderConfig pc = config->getProviderConfig("anthropic_api");
            provider->configure(generateProviderConfigJson(pc));
        }
        // Inject key BEFORE the availability check
        provider->setApiKey(key);
        // Now it's available
        if (provider->isAvailable()) {
            currentProvider = std::move(provider);
        }
    }
}
```

### Also fix CWD
The ttyd launch command should be:
```bash
ttyd --port 7681 --writable -t fontSize=14 \
  bash -c 'cd /path/to/repo && TERM=xterm-256color exec ./build/app/test_pattern 2>/tmp/wibwob_ttyd_debug.log'
```

---

## Files involved

| File | Role |
|------|------|
| `app/wibwob_engine.cpp` | Provider init, setApiKey(), loadConfiguration() |
| `app/llm/providers/anthropic_api_provider.cpp` | configure(), isAvailable(), setApiKey() |
| `app/llm/base/illm_provider.h` | Virtual setApiKey()/needsApiKey() interface |
| `app/llm/config/llm_config.json` | Provider config (never loaded due to CWD issue) |
| `app/llm/base/llm_config.cpp` | Default config fallback, getDefaultConfigJson() |
| `app/test_pattern_app.cpp` | Dialog, runtimeApiKey static, getAppRuntimeApiKey() |
| `app/wibwob_view.cpp` | Chat engine init, key injection, auto-prompt |

---

## What was tried this session

1. Added `setApiKey()`/`needsApiKey()` to provider interface ✓
2. Built TUI dialog (Tools > API Key) ✓
3. Wired menu item + auto-prompt ✓
4. Enabled anthropic_api in llm_config.json ✓ (but file never read)
5. Made configure() return true without key ✓ (but isAvailable still blocks)
6. Changed setApiKey() to force provider switch ✓ (but blocked by isAvailable)

## What hasn't been tried

- Fix CWD in ttyd launch (cd to repo root)
- Option C: bypass initializeProvider in setApiKey
- Test with ANTHROPIC_API_KEY exported in ttyd env
