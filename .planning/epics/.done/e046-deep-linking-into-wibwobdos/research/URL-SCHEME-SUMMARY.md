# macOS URL Schemes & File Associations: Summary for WibWob-DOS

**Status:** Research complete. Implementation-ready.  
**Key Finding:** Non-.app (Bun script) cannot register URL schemes directly, but a lightweight `.app` wrapper is a simple 30-minute setup.

---

## Quick Answers to Your Questions

### Q1: How does a CLI app register a custom URL scheme like `wibwob://open?path=/foo/bar.md`?

**A:** Only via `.app` bundle + `Info.plist`.

```xml
<!-- Inside WibWob.app/Contents/Info.plist -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>wibwob</string>
    </array>
  </dict>
</array>
```

macOS LaunchServices reads this at app launch, then routes all `wibwob://` URLs to that bundle.

---

### Q2: How do .app bundles register UTI/file associations?

**A:** Via `CFBundleDocumentTypes` and `UTExportedTypeDeclarations` in `Info.plist`:

```xml
<!-- Claim support for Markdown files -->
<key>CFBundleDocumentTypes</key>
<array>
  <dict>
    <key>CFBundleTypeName</key>
    <string>Markdown Document</string>
    <key>LSItemContentTypes</key>
    <array>
      <string>net.daringfireball.markdown</string>
    </array>
  </dict>
</array>

<!-- Define a custom file type -->
<key>UTExportedTypeDeclarations</key>
<array>
  <dict>
    <key>UTTypeIdentifier</key>
    <string>com.wibandwob.wibwob-project</string>
    <key>UTTypeTagSpecification</key>
    <dict>
      <key>public.filename-extension</key>
      <array>
        <string>wibwob</string>
      </array>
    </dict>
  </dict>
</array>
```

Then double-clicking `foo.md` or `bar.wibwob` will open them in WibWob-DOS.

---

### Q3: Can a non-.app (like a Bun script) register URL schemes?

**A:** No. URL schemes are only readable from `.app` bundles.

**But:** A lightweight `.app` wrapper is trivial:

```
WibWob.app/
├── Contents/
│   ├── Info.plist           ← declares URL schemes
│   ├── PkgInfo              ← 8 bytes: APPL????
│   └── MacOS/
│       └── wibwob-launcher  ← shell script that runs: bun run src/app.ts
```

The launcher is just:
```bash
#!/bin/bash
exec bun run /path/to/wibandwob-dos/src/app.ts "$@"
```

---

### Q4: Is there a way via LSRegisterURL or a lightweight .app wrapper?

**A:** LSRegisterURL is a **private C API** (risky for production). **Use the `.app` wrapper** — it's public, stable, and simple.

**Effort:** 30 minutes via `scripts/create-wibwob-app.sh`.

---

### Q5: How do Ghostty action scripts work?

**A:** Ghostty config can bind keystrokes to shell commands:

```ini
# ~/.config/ghostty/config
keybind = cmd+shift+p=action "send_text" with "bash /path/to/shader-switcher.sh"
```

When you press Cmd+Shift+P, Ghostty sends that text to the terminal (simulating typing).

**More powerful:** Ghostty 1.3+ (PR #11208) added AppleScript support:

```applescript
tell application "Ghostty"
  tell terminal 1 of selected tab of front window
    perform action "reload_config"   # Hot-reload config without restart
    perform action "send_text" with "hello"  # Send text to terminal
    perform action "close_terminal"  # Close the terminal
  end tell
end tell
```

**For WibWob-DOS:** Use AppleScript to hot-swap shaders (no restart needed).

---

## Architecture: How It All Fits Together

```
User clicks: wibwob://shader?name=glow
       ↓
   macOS LaunchServices
       ↓
   Finds WibWob.app (from Info.plist)
       ↓
   Launches: /Applications/WibWob.app/Contents/MacOS/wibwob-launcher "wibwob://shader?name=glow"
       ↓
   Launcher script runs: bun run src/app.ts [URL in argv or env]
       ↓
   src/app.ts extracts URL, parses params
       ↓
   Routes to command: commandRegistry.run('ghostty.shader.set', { name: 'glow' })
       ↓
   GhosttyShaderService updates config file
       ↓
   Runs AppleScript: perform action "reload_config"
       ↓
   Ghostty hot-swaps shader (instant visual change)
```

---

## What We Found in the Repo

### Existing Ghostty Integration

1. **`scripts/ghostty-shader.sh`** — CLI shader toggle (on/off/list/status)
   - Uses shell script + `config-file = ?/path/to/scratch/.ghostty-shaders`
   - Calls `osascript` to send `Cmd+Shift+,` (manual reload)

2. **`scripts/lib/find-ghostty-window.c`** — CoreGraphics window detection
   - Finds Ghostty window IDs for screenshot pipeline
   - Used by `capture-tui-png.sh`

3. **`.planning/spikes/spk-ghostty-shader-menu/`** — Proposed shader picker microapp
   - Wants to build TUI shader browser (lists all shaders, live preview)
   - Would use AppleScript `perform action "reload_config"` for hot-swap

4. **`src/app.ts`** — Already detects & integrates Ghostty
   ```typescript
   const ghosttyShader = process.env.WIBWOB_GHOSTTY_SHADER;
   const isGhostty = !!process.env.GHOSTTY_RESOURCES_DIR;
   // Activates shader on startup, deactivates on exit
   ```

### What's Missing

- **URL scheme registration** — `.app` wrapper with `Info.plist`
- **URL handler** — `extractLaunchURL()`, route to commands
- **Ghostty API integration** — `ghostty-shader-service.ts` with AppleScript reload
- **File association** — `.md`, `.txt` → WibWob-DOS

---

## Implementation Roadmap

### Phase 1: Minimal .app Wrapper (30 min)
- Create `~/Applications/WibWob.app` bundle structure
- Write `Info.plist` with `CFBundleURLSchemes = ["wibwob"]`
- Create launcher script that runs `bun run src/app.ts`
- Test: `open "wibwob://open?path=/etc/hosts"`

### Phase 2: URL Handler (15 min)
- Add `src/services/url-handler.ts` — parse `wibwob://ACTION?args`
- Call `extractLaunchURL()` in `src/app.ts` startup
- Route to command registry

### Phase 3: Commands (20 min)
- Register `app.handle-url`, `ghostty.shader.set` commands
- Add `src/services/ghostty-shader-service.ts`
- Implement AppleScript reload

### Phase 4: Testing (10 min)
- URL scheme: `open "wibwob://open?path=..."`
- Shader switching: `open "wibwob://shader?name=glow"`
- File associations: double-click `.md` file

### Phase 5: Polish (10 min)
- Update README with URL scheme docs
- Add to `package.json` as `setup:url-scheme` script

**Total time: ~90 minutes end-to-end.**

---

## Key Technical Details

| Topic | Finding |
|-------|---------|
| **Bundle structure** | `.app` is a directory with `Contents/MacOS/` + `Contents/Info.plist` |
| **Registration** | macOS reads `Info.plist` at app launch; no runtime API needed |
| **URL passing** | App receives URL in `argv[0]` or `WIBWOB_LAUNCH_URL` env var |
| **Multi-instance** | Check PID file; if running, route via HTTP API (avoid double-launch) |
| **Ghostty reload** | `perform action "reload_config"` (requires v1.3+) |
| **Shader path** | macOS: `~/Library/Application Support/com.mitchellh.ghostty/config` |
| **File types** | Use standard UTIs (`public.plain-text`, `net.daringfireball.markdown`) |
| **Code signing** | Optional for dev; recommended for distribution |

---

## Integration with Existing Systems

### HTTP API vs URL Scheme

| Use Case | Recommended |
|----------|-------------|
| User clicks link in browser/email | URL scheme |
| Complex args (nested JSON, large payloads) | HTTP API |
| Automations, scripts | HTTP API |
| File manager → app | File association |
| Remote control (same machine) | Either (URL simpler) |

**Recommendation:** Both coexist. URL schemes for simple operations, HTTP API for complex workflows.

---

### Ghostty Shader Microapp

The proposed `spk-ghostty-shader-menu` would become more powerful with URL schemes:

1. **TUI shader picker** (from microapp) → highlights shader name
2. **User presses Enter** → runs command `ghostty.shader.set`
3. **Command** → updates config → calls AppleScript → instant visual feedback

Or, from outside:
```bash
# Browser bookmarklet, Finder quick action, Spotlight shortcut, etc.
open "wibwob://shader?name=glow"
```

---

## Security Considerations

1. **Local-only:** URL schemes are same-machine only. No network exposure.
2. **No authentication needed** on localhost (port 8099 is local-only by default).
3. **Command validation:** Command registry validates all `id` and `args`.
4. **File path validation:** Should validate file paths to prevent escape attacks.

```typescript
// Add before opening file:
const resolved = path.resolve(params.path);
if (!resolved.startsWith(process.env.HOME)) {
  throw new Error('File path outside home directory');
}
```

---

## Browser Compatibility

URL schemes work in:
- ✅ Safari (all versions)
- ✅ Chrome/Arc (all versions)
- ✅ Firefox (all versions)
- ✅ Email apps (Mail, Outlook, Spark)
- ✅ Finder (Open URL dialog)

**Example:** In Safari, create a bookmark:
```javascript
javascript:void(open('wibwob://open?path=/Users/james/notes.md'))
```

---

## Troubleshooting Checklist

| Problem | Solution |
|---------|----------|
| URL doesn't open app | `plutil -lint ~/Applications/WibWob.app/Contents/Info.plist` |
| File double-click doesn't work | Update `CFBundleDocumentTypes`, then delete and rebuild bundle |
| Ghostty shader doesn't switch | Verify `GHOSTTY_RESOURCES_DIR` is set; check AppleScript with `osascript -l AppleScript` |
| Two instances launch | Add PID check + HTTP API routing in startup |
| Launcher script not found | Check `Contents/MacOS/wibwob-launcher` is executable and path is correct |

---

## Next Steps

1. **Read detailed research:** `research/macos-url-schemes-uti-research.md`
2. **Follow implementation guide:** `research/wibwob-url-scheme-implementation.md`
3. **Run Phase 1 setup:**
   ```bash
   bash scripts/create-wibwob-app.sh
   ```
4. **Test URL scheme:**
   ```bash
   open "wibwob://open?path=/etc/hosts"
   ```
5. **If in Ghostty, test shader:**
   ```bash
   open "wibwob://shader?name=glow"
   ```

---

## Reference Files

- **Main research:** `research/macos-url-schemes-uti-research.md` (12 sections, 24KB)
- **Implementation guide:** `research/wibwob-url-scheme-implementation.md` (6 phases, 16KB)
- **This summary:** Quick reference for decisions and architecture

---

## Credits & Sources

- [macOS LaunchServices documentation](https://developer.apple.com/documentation/coreservices/launch_services)
- [Ghostty AppleScript PR #11208](https://github.com/ghostty-org/ghostty/pull/11208)
- [Uniform Type Identifiers](https://developer.apple.com/documentation/uniformtypeidentifiers)
- WibWob-DOS codebase: existing Ghostty integration, command registry, HTTP API
