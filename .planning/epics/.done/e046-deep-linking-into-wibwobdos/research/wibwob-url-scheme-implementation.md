# WibWob-DOS URL Scheme Implementation Guide

**Quick-start guide** for adding `wibwob://` URL scheme support to WibWob-DOS.

---

## Phase 1: Minimal .app Wrapper (30 min)

### 1.1 Create Bundle Structure

```bash
#!/bin/bash
# scripts/create-wibwob-app.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_PATH="${HOME}/Applications/WibWob.app"
BUNDLE_ID="com.wibandwob.wibwob-dos"

# Create directories
mkdir -p "${BUNDLE_PATH}/Contents/MacOS"
mkdir -p "${BUNDLE_PATH}/Contents/Resources"

# Create launcher script
cat > "${BUNDLE_PATH}/Contents/MacOS/wibwob-launcher" <<'LAUNCHER'
#!/bin/bash
# WibWob-DOS launcher wrapper

# Find repo root (assuming standard structure)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../Repos/wibandwob-dos" && pwd)"

# If URL was passed as first arg, pass it through
if [[ "$#" -gt 0 && "$1" == "wibwob://"* ]]; then
  export WIBWOB_LAUNCH_URL="$1"
fi

# Launch the app
exec bun run "${REPO_ROOT}/src/app.ts"
LAUNCHER

chmod +x "${BUNDLE_PATH}/Contents/MacOS/wibwob-launcher"

# Create Info.plist
cat > "${BUNDLE_PATH}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
         "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    
    <key>CFBundleExecutable</key>
    <string>wibwob-launcher</string>
    
    <key>CFBundleIdentifier</key>
    <string>com.wibandwob.wibwob-dos</string>
    
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    
    <key>CFBundleName</key>
    <string>WibWob</string>
    
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    
    <key>CFBundleShortVersionString</key>
    <string>0.2.0</string>
    
    <key>CFBundleVersion</key>
    <string>1</string>
    
    <!-- URL SCHEME REGISTRATION -->
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>WibWob Desktop URI Handler</string>
            
            <key>CFBundleURLSchemes</key>
            <array>
                <string>wibwob</string>
            </array>
        </dict>
    </array>
    
    <!-- FILE TYPE ASSOCIATIONS -->
    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Plain Text</string>
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            <key>LSItemContentTypes</key>
            <array>
                <string>public.plain-text</string>
            </array>
        </dict>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Markdown Document</string>
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            <key>LSItemContentTypes</key>
            <array>
                <string>net.daringfireball.markdown</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
PLIST

echo "✅ Created ${BUNDLE_PATH}"
echo "   Info.plist registered URL scheme: wibwob://"
echo ""
echo "To test:"
echo "  open \"wibwob://open?path=/path/to/file.md\""
```

### 1.2 Run the Setup

```bash
bash scripts/create-wibwob-app.sh
```

### 1.3 Verify

```bash
# Check that the app exists
ls -la ~/Applications/WibWob.app/Contents/

# Test the URL scheme
open "wibwob://open?path=/etc/hosts"
```

---

## Phase 2: Handle URLs in src/app.ts (15 min)

### 2.1 Add URL Handler Module

Create `src/services/url-handler.ts`:

```typescript
import { URL } from 'url';
import type { CommandRegistry } from '../core/command-registry.js';

export interface WibwobURLParams {
  action: string;
  params: Record<string, string>;
}

/**
 * Parse a wibwob:// URL into action + params
 * Examples:
 *   wibwob://open?path=/foo/bar.md
 *   wibwob://shader?name=glow
 *   wibwob://command?id=theme.set&args={"name":"dark"}
 */
export function parseWibwobURL(urlString: string): WibwobURLParams {
  const url = new URL(urlString);
  const action = url.pathname.slice(1) || 'default';
  const params: Record<string, string> = {};
  
  for (const [key, value] of url.searchParams) {
    params[key] = value;
  }
  
  return { action, params };
}

export async function handleWibwobURL(
  urlString: string,
  commandRegistry: CommandRegistry
): Promise<void> {
  const { action, params } = parseWibwobURL(urlString);
  
  console.log(`[URL Handler] action=${action}, params=${JSON.stringify(params)}`);
  
  switch (action) {
    case 'open': {
      const path = params.path || params[0];
      if (!path) {
        console.error('[URL] open: missing path parameter');
        return;
      }
      await commandRegistry.run('editor.open', { path });
      break;
    }
    
    case 'shader': {
      const name = params.name || params[0];
      if (!name) {
        console.error('[URL] shader: missing name parameter');
        return;
      }
      // Will be implemented as a command
      await commandRegistry.run('ghostty.shader.set', { name });
      break;
    }
    
    case 'command': {
      const id = params.id;
      const rawArgs = params.args || '{}';
      if (!id) {
        console.error('[URL] command: missing id parameter');
        return;
      }
      try {
        const args = JSON.parse(rawArgs);
        await commandRegistry.run(id, args);
      } catch (err) {
        console.error('[URL] command: failed to parse args JSON', err);
      }
      break;
    }
    
    case 'jump': {
      const window = params.window;
      if (!window) {
        console.error('[URL] jump: missing window parameter');
        return;
      }
      await commandRegistry.run('window.focus', { id: window });
      break;
    }
    
    default:
      console.warn(`[URL] Unknown action: ${action}`);
  }
}

/**
 * Extract wibwob:// URL from launch context
 * macOS passes it in argv[0] or WIBWOB_LAUNCH_URL env var
 */
export function extractLaunchURL(): string | null {
  // Check environment (set by launcher script)
  if (process.env.WIBWOB_LAUNCH_URL) {
    return process.env.WIBWOB_LAUNCH_URL;
  }
  
  // Check argv (macOS sometimes puts it here)
  const urlArg = process.argv.find(arg => arg.startsWith('wibwob://'));
  if (urlArg) {
    return urlArg;
  }
  
  return null;
}
```

### 2.2 Integrate into App Startup

In `src/app.ts`, add near the start of app creation:

```typescript
import { handleWibwobURL, extractLaunchURL } from './services/url-handler.js';

// ... existing code ...

const app = new TsTuiMvpApp({ runtimeNode });

// Handle URL-based launch
const launchURL = extractLaunchURL();
if (launchURL) {
  // If app just started, route URL immediately
  console.log(`[App] Processing launch URL: ${launchURL}`);
  await handleWibwobURL(launchURL, app.commandRegistry);
} else {
  console.log('[App] No launch URL detected');
}

// If app was already running and received URL via API, handle via route
// (see Phase 3)

await app.run();
```

---

## Phase 3: Add URL Handling to Command Registry (20 min)

### 3.1 Register URL Handler Commands

In `src/core/command-catalog.ts`, add:

```typescript
export const URL_HANDLER_COMMANDS: CommandDefinition[] = [
  {
    id: 'app.handle-url',
    label: 'Handle wibwob:// URL',
    description: 'Route a URL scheme call to the appropriate command',
    api: true,
    hidden: true,
    args: {
      url: Type.String({
        description: 'Full wibwob:// URL',
      }),
    },
  },
  {
    id: 'ghostty.shader.set',
    label: 'Ghostty: Set Shader',
    description: 'Switch Ghostty shader by name (if running)',
    api: true,
    args: {
      name: Type.String({
        description: 'Shader name (e.g., "glow", "crt", "nord-tint")',
      }),
    },
  },
];
```

### 3.2 Implement Command Handler

In command registry dispatcher, add:

```typescript
case 'app.handle-url': {
  const url = args.url as string;
  await handleWibwobURL(url, this);
  return { success: true };
}

case 'ghostty.shader.set': {
  const name = args.name as string;
  const result = await setGhosttyShader(name);
  return { 
    success: result,
    message: result ? `Shader set to ${name}` : `Failed to set shader`,
  };
}
```

---

## Phase 4: Ghostty Shader Hot-Swap (15 min)

### 4.1 Create Shader Service

Create `src/services/ghostty-shader-service.ts`:

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export class GhosttyShaderService {
  private configPath: string;
  private repoRoot: string;
  
  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    // macOS path
    this.configPath = `${process.env.HOME}/Library/Application Support/com.mitchellh.ghostty/config`;
    
    // Linux fallback
    if (!this.configPath || this.configPath.includes('undefined')) {
      const xdgConfig = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
      this.configPath = path.join(xdgConfig, 'ghostty', 'config');
    }
  }
  
  /**
   * Check if running in Ghostty
   */
  isGhosttyRunning(): boolean {
    return !!(process.env.GHOSTTY_RESOURCES_DIR || 
              process.env.TERM_PROGRAM?.includes('ghostty'));
  }
  
  /**
   * Set active shader and reload config
   * @returns true if successful
   */
  setShader(shaderName: string): boolean {
    if (!this.isGhosttyRunning()) {
      console.warn('[Ghostty] Not running in Ghostty; cannot set shader');
      return false;
    }
    
    const shaderPath = path.join(this.repoRoot, 'shaders', `${shaderName}.glsl`);
    
    try {
      // Read config
      const config = readFileSync(this.configPath, 'utf-8');
      
      // Replace custom-shader line or add if missing
      let updated: string;
      if (config.includes('custom-shader')) {
        updated = config.replace(
          /^custom-shader = .*/m,
          `custom-shader = ${shaderPath}`
        );
      } else {
        updated = config + `\ncustom-shader = ${shaderPath}\n`;
      }
      
      // Write back
      writeFileSync(this.configPath, updated);
      
      // Reload via AppleScript (Ghostty 1.3+)
      this.reloadGhosttyConfig();
      
      console.log(`[Ghostty] Shader set to: ${shaderName}`);
      return true;
    } catch (err) {
      console.error('[Ghostty] Failed to set shader:', err);
      return false;
    }
  }
  
  /**
   * Trigger config reload in Ghostty
   */
  private reloadGhosttyConfig(): void {
    try {
      const script = `
        tell application "Ghostty"
          tell terminal 1 of selected tab of front window
            perform action "reload_config"
          end tell
        end tell
      `;
      
      spawnSync('osascript', ['-e', script], { stdio: 'ignore' });
      console.log('[Ghostty] Config reloaded');
    } catch (err) {
      console.warn('[Ghostty] Failed to reload config:', err);
      // Non-fatal; config will reload on manual Cmd+Shift+,
    }
  }
}
```

### 4.2 Wire into App Controller

```typescript
import { GhosttyShaderService } from './services/ghostty-shader-service.js';

export class TsTuiMvpApp {
  private ghosttyShaderService: GhosttyShaderService;
  
  constructor({ runtimeNode }: { runtimeNode: RuntimeNode }) {
    // ...
    this.ghosttyShaderService = new GhosttyShaderService(REPO_ROOT);
  }
  
  // In command registry handler:
  case 'ghostty.shader.set': {
    const name = args.name as string;
    const success = this.ghosttyShaderService.setShader(name);
    return { success, message: success ? `Shader: ${name}` : 'Failed' };
  }
}
```

---

## Phase 5: Testing (10 min)

### 5.1 Test URL Scheme Registration

```bash
# This should open/focus WibWob-DOS
open "wibwob://open?path=/etc/hosts"

# Test Ghostty shader switch (if in Ghostty)
open "wibwob://shader?name=glow"

# Test command dispatch
open "wibwob://command?id=theme.set&args=%7B%22name%22:%22dark%22%7D"
```

### 5.2 Test Existing Instance Routing

If WibWob-DOS is already running, URLs should route via API (not launch a second instance):

```bash
# Add check to app startup:
const pidPath = path.join(runtimeNode.scratchBase, 'wibwob.pid');
const existingPid = readFileSync(pidPath, 'utf-8').trim();

if (existingPid && processExists(existingPid)) {
  // Route via API instead of launching new instance
  const launchURL = extractLaunchURL();
  if (launchURL) {
    try {
      const response = await fetch(`${runtimeNode.apiBaseUrl}/commands/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'app.handle-url', args: { url: launchURL } }),
      });
      console.log('[URL] Routed to existing instance');
      process.exit(0);
    } catch (err) {
      console.error('[URL] Routing failed, launching new instance', err);
    }
  }
}
```

### 5.3 Test via File Manager

1. Double-click a `.md` file in Finder → should open in WibWob-DOS
2. Check that `CFBundleDocumentTypes` is properly configured in `Info.plist`

---

## Phase 6: Documentation & Polish (10 min)

### 6.1 Update README

```markdown
## URL Scheme Support

WibWob-DOS registers the `wibwob://` URL scheme for remote operations.

### Syntax

```
wibwob://ACTION?param1=value1&param2=value2
```

### Supported Actions

| Action | Args | Example |
|--------|------|---------|
| `open` | `path` | `wibwob://open?path=/path/to/file.md` |
| `shader` | `name` | `wibwob://shader?name=glow` |
| `jump` | `window` | `wibwob://jump?window=editor` |
| `command` | `id`, `args` | `wibwob://command?id=theme.set&args=%7B...%7D` |

### Installation

```bash
bash scripts/create-wibwob-app.sh
```

This creates `~/Applications/WibWob.app` and registers the URL scheme.

### Examples

```bash
# Open a file
open "wibwob://open?path=$HOME/notes.md"

# Switch shader (Ghostty only)
open "wibwob://shader?name=crt"

# Run a command
open "wibwob://command?id=theme.set&args=%7B%22name%22:%22nord%22%7D"
```
```

### 6.2 Add to package.json scripts

```json
{
  "scripts": {
    "setup:url-scheme": "bash scripts/create-wibwob-app.sh"
  }
}
```

---

## Checklist

- [ ] Run `bash scripts/create-wibwob-app.sh`
- [ ] Verify `~/Applications/WibWob.app` exists
- [ ] Add `url-handler.ts` service
- [ ] Add URL parsing and routing in `src/app.ts`
- [ ] Register URL-driven commands in command catalog
- [ ] Implement `ghostty-shader-service.ts`
- [ ] Test: `open "wibwob://open?path=/etc/hosts"`
- [ ] Test: `open "wibwob://shader?name=glow"` (if in Ghostty)
- [ ] Test: Double-click a `.md` file in Finder
- [ ] Update README with URL scheme documentation
- [ ] Commit with message: `feat: wibwob:// URL scheme support`

---

## Advanced: Integration Points

### Multi-Instance Coordination

If you have two WibWob-DOS instances (dev + alt), URLs should route to a specific instance:

```
wibwob://instance/label/main/open?path=/foo.md
wibwob://instance/label/zuk/shader?name=glow
```

### Browser Bookmarklets

Create Bookmarklets that trigger actions:

```javascript
// Copy this to a browser bookmark
javascript:void(fetch('http://127.0.0.1:8099/commands/run', {
  method: 'POST',
  body: JSON.stringify({ id: 'editor.open', args: { path: '/path/to/file.md' }})
}))
```

### Finder Quick Actions

Package a Quick Action that opens selected files in WibWob-DOS:

```bash
# Create Finder plugin
mkdir -p ~/Library/Services
# Create .workflow or .quiickaction plist that calls open "wibwob://open?path=$1"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `wibwob://` URL doesn't open app | Verify `Info.plist` is valid: `plutil -lint ~/Applications/WibWob.app/Contents/Info.plist` |
| App launches but URL not handled | Check `extractLaunchURL()` is called in `src/app.ts` startup |
| Shader not switching | Verify Ghostty 1.3+: `ghostty --version` |
| File association not working | Update `CFBundleDocumentTypes` in `Info.plist`, then trash and rebuild the bundle |

---

## Performance Notes

- **URL parsing:** O(1) — uses standard `URL` API
- **Existing instance check:** ~10ms — read PID file + `kill -0`
- **Ghostty reload:** ~200ms — AppleScript roundtrip
- **No impact on normal startup** — URL handling is optional, clean-up code path

---

## References

- `.planning/spikes/spk-ghostty-shader-menu/` — broader shader UI roadmap
- `research/macos-url-schemes-uti-research.md` — detailed technical background
- `scripts/ghostty-shader.sh` — existing shader CLI (reference)
- [Ghostty AppleScript PR #11208](https://github.com/ghostty-org/ghostty/pull/11208)
