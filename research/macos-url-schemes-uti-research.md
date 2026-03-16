# macOS Custom URL Schemes & UTI Registration Research

**Date:** 2026-03-16  
**Context:** Research for WibWob-DOS to support custom URL schemes (e.g., `wibwob://open?path=/foo/bar.md`) and file type associations, with focus on terminal app integration and Ghostty action scripts.

---

## 1. macOS URL Scheme Fundamentals

### 1.1 How URL Schemes Work

URL schemes on macOS are registered at the **bundle level** via `Info.plist`. The LaunchServices daemon (`launchd`) indexes all registered schemes system-wide during app launch or when the Finder detects bundle changes.

**URL scheme flow:**
```
wibwob://open?path=/foo/bar.md
    ↓
macOS route through LaunchServices
    ↓
Find bundle registered for "wibwob://"
    ↓
Launch bundle with `--url-handler` or `LSOpenURLsWithRole()`
    ↓
App receives URL in environment or argv (depends on launch style)
```

---

### 1.2 Registration: .app Bundle (Info.plist)

The **canonical and only system-supported way** to register a URL scheme is via a `.app` bundle's `Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
         "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>WibWob</string>
    
    <key>CFBundleIdentifier</key>
    <string>com.wibandwob.wibwob-dos</string>
    
    <key>CFBundleVersion</key>
    <string>0.2.0</string>
    
    <key>CFBundleExecutable</key>
    <string>wibwob</string>
    
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    
    <!-- URL SCHEME REGISTRATION -->
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>WibWob Desktop URI</string>
            
            <key>CFBundleURLSchemes</key>
            <array>
                <string>wibwob</string>
            </array>
            
            <!-- Optional: role description for OpenWith menus -->
            <key>CFBundleTypeRole</key>
            <string>Viewer</string>
        </dict>
    </array>
    
    <!-- FILE TYPE ASSOCIATIONS (UTI) -->
    <key>UTExportedTypeDeclarations</key>
    <array>
        <dict>
            <key>UTTypeIdentifier</key>
            <string>com.wibandwob.wibwob-project</string>
            
            <key>UTTypeDescription</key>
            <string>WibWob Project File</string>
            
            <key>UTTypeConformsTo</key>
            <array>
                <string>public.json</string>
            </array>
            
            <key>UTTypeTagSpecification</key>
            <dict>
                <key>com.apple.ostype</key>
                <string>WiWo</string>
                
                <key>public.filename-extension</key>
                <array>
                    <string>wibwob</string>
                </array>
            </dict>
        </dict>
    </array>
    
    <!-- DECLARE SUPPORT FOR OTHER FILE TYPES -->
    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Markdown</string>
            
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            
            <key>LSItemContentTypes</key>
            <array>
                <string>net.daringfireball.markdown</string>
            </array>
        </dict>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Text File</string>
            
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            
            <key>LSItemContentTypes</key>
            <array>
                <string>public.plain-text</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

**Key fields:**
- **`CFBundleURLSchemes`** — array of scheme strings (`wibwob`, `wibwob-dev`, etc.)
- **`CFBundleURLName`** — human-readable name shown in OpenWith dialogs
- **`CFBundleTypeRole`** — "Editor" (can open/edit), "Viewer" (read-only), "Shell" (command line)
- **`UTExportedTypeDeclarations`** — define new UTIs (Uniform Type Identifiers)
- **`CFBundleDocumentTypes`** — declare support for existing file types

---

### 1.3 How the App Receives the URL

When a URL scheme is activated, **macOS launches the app**. The URL is passed via one of:

#### Option A: Environment variable (simplest)
```bash
# macOS may set:
export LAUNCH_URL="wibwob://open?path=/foo/bar.md"
```

#### Option B: Command-line argument
```bash
/Applications/WibWob.app/Contents/MacOS/wibwob --url wibwob://open?path=/foo/bar.md
```

#### Option C: NSEvent or native Cocoa API
Apps using native Cocoa can implement `application(_:open:options:)` to handle URLs in real time.

**For a Bun/Node.js app**, the simplest approach is to check `process.argv` or environment:

```typescript
// Check for URL in args
const urlArg = process.argv.find(arg => arg.startsWith('wibwob://'));

if (urlArg) {
  const url = new URL(urlArg);
  const path = url.searchParams.get('path');
  const action = url.pathname.slice(1); // 'open', 'jump', etc.
  
  // Route to command handler
  await commandRegistry.run(`wibwob.${action}`, { path });
}
```

---

### 1.4 Registration at Runtime (LaunchServices API)

If you need to register a scheme **without restarting**, use the LaunchServices private C API:

```c
// macOS 10.6+
#include <CoreServices/CoreServices.h>

// Register bundle for URL scheme
OSStatus LSSetDefaultHandlerForURLScheme(
    CFStringRef inURLScheme,      // "wibwob"
    CFStringRef inBundleID        // "com.wibandwob.wibwob-dos"
);

// Query registered handler
CFStringRef bundleID = LSCopyDefaultHandlerForURLScheme(CFSTR("wibwob"));
```

**Limitation:** This is a **private API** and may break between macOS versions. Use `Info.plist` registration instead for production.

---

## 2. Non-.app (Bun Script) URL Scheme Registration

### 2.1 Can a Bun Script Register Directly?

**No.** macOS only reads URL schemes from `.app` bundles. A raw Bun script (`wibwob.mjs`) cannot:
- Register itself with LaunchServices
- Be listed in OpenWith dialogs
- Receive URL callbacks from system

### 2.2 Lightweight .app Wrapper Solution

The **practical solution** is a minimal `.app` wrapper that launches your Bun script:

```
WibWob.app/
├── Contents/
│   ├── Info.plist              ← declares URL schemes
│   ├── PkgInfo                 ← "APPL????" (8 bytes)
│   ├── MacOS/
│   │   └── wibwob              ← shell script or binary stub
│   ├── Resources/
│   │   └── AppIcon.icns        ← (optional)
│   └── _CodeSignature/
│       └── CodeResources       ← (optional)
```

**Minimal `WibWob.app/Contents/MacOS/wibwob` launcher:**

```bash
#!/bin/bash
# Wrapper that finds the repo and launches the Bun app
REPO_ROOT="/Users/james/Repos/wibandwob-dos"
exec bun run "${REPO_ROOT}/src/app.ts" "$@"
```

**Key points:**
- The `MacOS/wibwob` file must be **executable** (`chmod +x`)
- macOS requires the `PkgInfo` file (though it's often optional)
- The `Info.plist` is what LaunchServices reads
- When a `wibwob://` URL is clicked, macOS **launches this wrapper**, passing the URL as an argument

---

## 3. Code Signing & Notarization

For distributed `.app` bundles:

```bash
# Sign the app
codesign -s - WibWob.app

# Notarize (Apple's virus scan + auto-staple)
xcrun notarytool submit WibWob.app/... --apple-id <email> --password <app-specific-pass>
```

For **local development**, code signing is optional. Unsigned apps will work with a one-time user approval ("Open Anyway").

---

## 4. File Type Associations & UTI (Uniform Type Identifiers)

### 4.1 How File Associations Work

macOS uses **UTIs** instead of file extensions. When you double-click `foo.md`:

```
foo.md (extension)
    ↓
LaunchServices looks up: net.daringfireball.markdown
    ↓
Find bundle claiming that UTI
    ↓
Launch that bundle with the file path
```

### 4.2 Standard UTIs

**Common UTIs you can claim support for:**

| UTI | Purpose |
|-----|---------|
| `public.plain-text` | Any text file |
| `public.source-code` | Programming language files |
| `public.json` | JSON files |
| `net.daringfireball.markdown` | Markdown (`.md`) |
| `com.apple.shell-script` | Bash scripts (`.sh`) |
| `public.shell-script` | Generic shell scripts |

### 4.3 Claiming File Types in Info.plist

```xml
<key>CFBundleDocumentTypes</key>
<array>
    <!-- Markdown Editor -->
    <dict>
        <key>CFBundleTypeName</key>
        <string>Markdown Document</string>
        
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        
        <key>LSItemContentTypes</key>
        <array>
            <string>net.daringfireball.markdown</string>
        </array>
        
        <key>LSIsExtensionHidden</key>
        <false/>
    </dict>
    
    <!-- JavaScript/TypeScript source -->
    <dict>
        <key>CFBundleTypeName</key>
        <string>TypeScript Source</string>
        
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        
        <key>LSItemContentTypes</key>
        <array>
            <string>public.typescript-source</string>
            <string>public.javascript-source</string>
        </array>
    </dict>
</array>
```

### 4.4 Custom UTI (Your Own File Type)

To define a new file type (e.g., `.wibwob` project files):

```xml
<key>UTExportedTypeDeclarations</key>
<array>
    <dict>
        <key>UTTypeIdentifier</key>
        <string>com.wibandwob.wibwob-project</string>
        
        <key>UTTypeDescription</key>
        <string>WibWob Desktop Project</string>
        
        <key>UTTypeConformsTo</key>
        <array>
            <string>public.json</string>
        </array>
        
        <key>UTTypeTagSpecification</key>
        <dict>
            <key>public.filename-extension</key>
            <array>
                <string>wibwob</string>
            </array>
            
            <key>com.apple.ostype</key>
            <string>WIBO</string>  <!-- 4-letter OSType code -->
        </dict>
        
        <key>UTTypeIconFile</key>
        <string>WibWobIcon.icns</string>
    </dict>
</array>
```

---

## 5. Ghostty Integration: Action Scripts & AppleScript

### 5.1 Current WibWob-DOS Ghostty Support

**Status:** Ghostty shader control via shell script + AppleScript reload.

- **Script:** `scripts/ghostty-shader.sh` — toggles custom shaders
- **Mechanism:** `osascript` calls to reload Ghostty config
- **AppleScript:** Sends `Cmd+Shift+,` (config reload) via `tell application "Ghostty"`

**Current code** (from `src/app.ts`):
```typescript
function activateGhosttyShader() {
  if (!ghosttyShader || !isGhostty) return;
  try {
    spawnSync("bash", [ghosttyShaderScript, "on", ghosttyShader], { stdio: "ignore" });
  } catch {}
}
```

### 5.2 Ghostty AppleScript Capabilities (PR #11208)

**Merged:** Ghostty v1.3+ now supports full AppleScript control.

**Available actions:**
```applescript
tell application "Ghostty"
  -- Get list of open tabs
  every tab of every window
  
  -- Perform actions on a terminal/tab
  tell terminal 1 of selected tab of front window
    perform action "reload_config"        -- Reload config file
    perform action "close_terminal"       -- Close terminal
    perform action "send_text" with "hello"  -- Send text to terminal
    perform action "copy_selection"       -- Copy selected text
  end tell
end tell
```

**Most useful for WibWob-DOS:**
- `perform action "reload_config"` — hot-swap shader config (instead of `Cmd+Shift+,`)
- `perform action "send_text"` — send commands to Ghostty terminal
- `perform action "copy_selection"` — integrate clipboard

### 5.3 Ghostty "Action Scripts"

**What:** Ghostty config allows binding keystrokes to **shell commands** that can control Ghostty via AppleScript.

**Config example** (`~/.config/ghostty/config`):
```ini
# Keybind: Cmd+Shift+P opens a rofi/dmenu picker to switch shaders
keybind = cmd+shift+p=action "send_text" with "wibwob-shader-picker"

# Or directly run a shell command
keybind = cmd+shift+o=action "send_text" with "bash /path/to/shader-switcher.sh"
```

**Limitation:** Ghostty's `action` syntax is limited. For complex workflows, the better approach is:

1. Ghostty keybind calls a shell command (`send_text`)
2. Shell command sends an HTTP request to WibWob-DOS API (`http://127.0.0.1:8099/commands/run`)
3. API dispatch handles shader switching, window layout changes, etc.

---

### 5.4 Ghostty ↔ WibWob-DOS Integration Points

**Current integrations:**
1. **Shader control** — `ghostty-shader.sh` (shell) → config file → AppleScript reload
2. **Window detection** — `find-ghostty-window.c` (CoreGraphics) finds Ghostty window for screenshot

**Possible future integrations:**
1. **URL schemes** — `wibwob://shader?name=glow` → AppleScript → Ghostty config hot-swap
2. **Selection sync** — Ghostty selection → WibWob-DOS command (via API)
3. **Terminal commands** — WibWob-DOS window sends code to Ghostty (`send_text` action)
4. **Multi-terminal coordination** — WibWob-DOS layout controls multiple Ghostty instances

---

## 6. Practical Implementation: wibwob:// URL Scheme

### 6.1 Goal

Support links like:
- `wibwob://open?path=/foo/bar.md` — open file in WibWob editor
- `wibwob://shader?name=glow` — switch Ghostty shader (if running)
- `wibwob://jump?window=editor&focus=true` — jump to a window and focus it
- `wibwob://command?id=theme.set&args={"name":"dark"}` — run a command with JSON args

### 6.2 Implementation Steps

#### Step 1: Create .app wrapper

```bash
#!/bin/bash
# scripts/create-app-wrapper.sh

BUNDLE_NAME="WibWob"
BUNDLE_ID="com.wibandwob.wibwob-dos"
APP_PATH="/Applications/${BUNDLE_NAME}.app"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Create bundle structure
mkdir -p "${APP_PATH}/Contents/MacOS"
mkdir -p "${APP_PATH}/Contents/Resources"

# Create launcher script
cat > "${APP_PATH}/Contents/MacOS/${BUNDLE_NAME}" <<'EOF'
#!/bin/bash
exec bun run "$(dirname "$0")/../../../Repos/wibandwob-dos/src/app.ts" "$@"
EOF

chmod +x "${APP_PATH}/Contents/MacOS/${BUNDLE_NAME}"

# Create Info.plist
cat > "${APP_PATH}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
         "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${BUNDLE_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleVersion</key>
    <string>0.2.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>${BUNDLE_NAME}</string>
    
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>WibWob Desktop URI</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>wibwob</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
EOF

echo "✅ Created ${APP_PATH}"
```

#### Step 2: Register URL handler in src/app.ts

```typescript
import { URL } from 'url';

function parseWibwobURL(urlString: string) {
  const url = new URL(urlString);
  return {
    action: url.pathname.slice(1) || 'default',
    params: Object.fromEntries(url.searchParams),
  };
}

async function handleWibwobURL(urlString: string) {
  const { action, params } = parseWibwobURL(urlString);
  
  switch (action) {
    case 'open':
      await commandRegistry.run('wibwob.open-file', { path: params.path });
      break;
    case 'shader':
      await commandRegistry.run('ghostty.shader', { name: params.name });
      break;
    case 'command': {
      const args = params.args ? JSON.parse(params.args) : {};
      await commandRegistry.run(params.id, args);
      break;
    }
    default:
      console.warn(`Unknown wibwob:// action: ${action}`);
  }
}

// At app startup, check for URL in argv or env
const urlArg = process.argv.find(arg => arg.startsWith('wibwob://'));
if (urlArg) {
  await handleWibvobURL(urlArg);
}
```

#### Step 3: Register in command catalog

```typescript
// src/core/command-catalog.ts

export const WIBWOB_URL_COMMANDS = [
  {
    id: 'wibwob.open-file',
    label: 'Open File (via URL)',
    description: 'Open a file when called via wibwob:// URL scheme',
    api: true,
    args: { path: Type.String() },
  },
  {
    id: 'ghostty.shader',
    label: 'Ghostty: Set Shader',
    description: 'Switch active shader if running in Ghostty',
    api: true,
    args: { name: Type.String() },
  },
];
```

### 6.3 Usage Examples

```bash
# Open a file
open "wibwob://open?path=/Users/james/notes.md"

# Switch shader
open "wibwob://shader?name=glow"

# Run a command via API
curl "http://127.0.0.1:8099/commands/run" -X POST \
  -H "Content-Type: application/json" \
  -d '{"id":"theme.set","args":{"name":"dark"}}'

# Via URL scheme (requires command to accept URL args)
open "wibwob://command?id=theme.set&args=%7B%22name%22:%22dark%22%7D"
```

---

## 7. Best Practices & Patterns

### 7.1 Environment Variable Passthrough

When macOS launches your `.app`, it **resets environment variables**. To preserve key env vars, use:

```bash
#!/bin/bash
# In WibWob.app/Contents/MacOS/wibwob

# Restore environment from calling shell
source ~/.zprofile

# Pass through to Bun
exec bun run ... "$@"
```

### 7.2 PID & Lifecycle Management

When launching from a URL, the app should:

```typescript
// If PID file already exists, route URL to existing instance
const existingPid = readFile(pidPath);
if (existingPid && processExists(existingPid)) {
  // Use API to handle URL in existing instance
  await fetch(`http://127.0.0.1:8099/commands/run`, {
    method: 'POST',
    body: JSON.stringify({ id: 'wibwob.handle-url', args: { url: urlArg } }),
  });
  process.exit(0);
}
```

### 7.3 Fallback to HTTP API

For complex workflows, **prefer the HTTP API** over URL scheme arguments:

```bash
# Instead of:
open "wibwob://command?id=very.long.command&args=..."

# Do:
curl -X POST http://127.0.0.1:8099/commands/run \
  -H "Content-Type: application/json" \
  -d '{"id":"theme.set","args":{"name":"dark"}}'
```

URL schemes are good for **simple actions** (open file, switch theme). Complex args belong in HTTP requests.

---

## 8. Ghostty-Specific Considerations

### 8.1 Shader Hot-Swap via URL + AppleScript

**Desired flow:**
```
wibwob://shader?name=glow
  ↓ [WibWob-DOS receives URL]
  ↓ [Updates ~/.config/ghostty/config]
  ↓ [Runs AppleScript: perform action "reload_config"]
  ↓ [Ghostty hot-swaps shader]
```

**Implementation:**
```typescript
async function setGhosttyShader(name: string) {
  const config = `${process.env.HOME}/.config/ghostty/config`;
  
  // Update config file
  const content = await readFile(config, 'utf-8');
  const updated = content.replace(
    /^custom-shader = .*/m,
    `custom-shader = ${process.env.REPO_ROOT}/shaders/${name}.glsl`
  );
  await writeFile(config, updated);
  
  // Reload via AppleScript (Ghostty 1.3+)
  const result = spawnSync('osascript', ['-e', `
    tell application "Ghostty"
      tell terminal 1 of selected tab of front window
        perform action "reload_config"
      end tell
    end tell
  `]);
  
  return result.status === 0;
}
```

### 8.2 Detection: Is Ghostty Running?

```typescript
function isGhosttyRunning(): boolean {
  // Check environment
  if (process.env.GHOSTTY_RESOURCES_DIR) return true;
  if (process.env.TERM_PROGRAM?.includes('ghostty')) return true;
  
  // Check via launchctl
  try {
    const result = spawnSync('pgrep', ['-x', 'Ghostty']);
    return result.status === 0;
  } catch {
    return false;
  }
}
```

### 8.3 Ghostty Config Paths

| Platform | Path |
|----------|------|
| **macOS** | `~/Library/Application Support/com.mitchellh.ghostty/config` |
| **Linux** | `${XDG_CONFIG_HOME:-$HOME/.config}/ghostty/config` |

---

## 9. Comparison: URL Schemes vs HTTP API

| Feature | URL Scheme | HTTP API |
|---------|-----------|----------|
| **Activation** | Clicking link, `open` command | `curl`, client code |
| **Args complexity** | Simple (KV pairs, limited encoding) | JSON, arbitrary nesting |
| **Lifecycle** | May launch new app instance | Uses existing instance |
| **Integration** | Finder, browsers, email | Scripts, automations, browsers |
| **Discovery** | System-wide, visible in OpenWith | Requires knowledge of endpoint |
| **Error handling** | Generic app error dialogs | Structured API responses |

**Recommendation for WibWob-DOS:**
- Use **URL schemes** for user-facing actions (open file, switch theme)
- Use **HTTP API** for programmatic control and complex workflows
- Both route to same command registry internally

---

## 10. Checklist: Implementing wibwob:// Support

- [ ] Create `WibWob.app` wrapper bundle structure
- [ ] Write `Contents/MacOS/wibwob` launcher script
- [ ] Create `Contents/Info.plist` with `CFBundleURLTypes`
- [ ] Move to `/Applications/` and test `open "wibwob://open?path=..."`
- [ ] Add URL handler in `src/app.ts`
- [ ] Register URL-driven commands in command catalog
- [ ] Document URL scheme in README (format, examples, limitations)
- [ ] Test multi-instance behavior (route to existing instance via API)
- [ ] Add shader hot-swap via `wibwob://shader?name=...`
- [ ] Integration test: file manager → WibWob (double-click `.md` file)

---

## 11. References & Links

### Official macOS Documentation
- [CoreServices/LaunchServices](https://developer.apple.com/documentation/coreservices/launch_services)
- [Defining Custom URL Schemes](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)
- [Uniform Type Identifiers](https://developer.apple.com/documentation/uniformtypeidentifiers)
- [Info.plist Keys](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html)

### Ghostty Documentation
- [Ghostty Config](https://ghostty.org/docs/config)
- [Ghostty Keybindings](https://ghostty.org/docs/config/keybind)
- [AppleScript PR #11208](https://github.com/ghostty-org/ghostty/pull/11208)
- [Audio-reactive Shaders Discussion](https://github.com/ghostty-org/ghostty/discussions/10201)
- [Shader Switcher Community PR](https://github.com/0xhckr/ghostty-shaders/pull/61)

### WibWob-DOS Existing Resources
- `scripts/ghostty-shader.sh` — shader toggle CLI
- `scripts/lib/find-ghostty-window.c` — CoreGraphics window detection
- `.planning/spikes/spk-ghostty-shader-menu/` — proposed shader picker microapp
- `.planning/spikes/spk-wibmux/` — related Ghostty integration plan

---

## 12. Open Questions for Implementation

1. **Instance routing:** Should URL calls to an existing WibWob-DOS instance route via HTTP API or launch a new instance?
   - Recommendation: Check PID file; if alive, route via API (avoid double-launch)

2. **Ghostty-only shader control:** Should shader switching fail gracefully if Ghostty isn't detected?
   - Recommendation: Graceful no-op with log message

3. **URL encoding limits:** Long command args exceed safe URL length. Should `.wibwob` project files store commands as JSON instead?
   - Recommendation: Use project files for complex workflows; URLs for simple actions

4. **Security:** Should `wibwob://` URLs require a token or be openly exposed?
   - Recommendation: Local-only API (localhost:8099); URL scheme for same-device only

5. **File type association priority:** If `.md` is claimed by multiple editors, how does user choose?
   - Recommendation: Offer "Default for .md" checkbox in preferences, respect user choice via `LSSetDefaultRoleHandlerForContentType`

---

## Summary

**URL Schemes on macOS:**
- ✅ Require `.app` bundle with `Info.plist`
- ✅ Registration via `CFBundleURLSchemes` array
- ✅ App receives URL in `argv` or environment
- ❌ Cannot register from bare Bun script
- ✅ Lightweight wrapper (100 lines of shell) is sufficient

**File Associations (UTI):**
- ✅ Claim support via `CFBundleDocumentTypes`
- ✅ Define custom types via `UTExportedTypeDeclarations`
- ✅ Use standard UTIs when possible (`public.plain-text`, `net.daringfireball.markdown`)

**Ghostty Integration:**
- ✅ AppleScript control available (v1.3+, PR #11208)
- ✅ Hot-reload config via `perform action "reload_config"`
- ✅ Shader switching can be wired to WibWob-DOS commands
- ✅ Combine with HTTP API for complex workflows
