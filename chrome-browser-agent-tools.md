# Chrome Browser Agent Tools — Fix Report

Date: 2026-03-01
Author: Wib & Wob (in-session self-modification)

## Problem

The agent had no way to control the Chrome browser window. Sending input
to it via tui_send_input returned "window not found or not interactive"
because the Chrome browser window never set frame.writeInput on its
WindowRecord. Without that hook, the window manager's sendInput method
returned false immediately.

There were also no dedicated tools for opening a Chrome browser at a
given URL, or for navigating an existing one. The openWindow map in
app-controller mapped "browser" to the text-based BrowserReader, not
Chrome at all.

## Root Cause

chrome-browser-window.ts registered the window with the window manager
but left frame.writeInput undefined. The window had an internal
navigateTo function that did everything we needed — it just wasn't
exposed anywhere outside the module.

## Changes

### spikes/ts-tui-mvp/src/windows/chrome-browser-window.ts

Added writeInput to the WindowRecord after frame.focus is set:

    frame.writeInput = (input: string) => {
      const trimmed = input.trim();
      if (trimmed) void navigateTo(trimmed);
    };

This means tui_send_input now works on Chrome browser windows. Send it
a URL string and the browser navigates there. The existing navigateTo
function handles history, status updates, content extraction, and the
full markdown rendering pipeline — we get all of that for free.

### spikes/ts-tui-mvp/src/services/agent-tools.ts

Added openChromeBrowser to the TuiToolContext interface:

    openChromeBrowser: (url?: string) => { id: number } | { error: string };

Added two new tools:

tui_open_chrome_browser — opens a new Chrome browser window, optionally
navigating to a URL immediately. Returns the new window ID.

tui_browser_navigate — navigates an existing Chrome browser window by
window ID and URL. Cleaner than tui_send_input for this specific
purpose, with explicit parameter names.

Both tools added to the createTuiTools export array.

### spikes/ts-tui-mvp/src/core/app-controller.ts

Wired openChromeBrowser into the TuiToolContext literal inside
openWibWobAgentWindow:

    openChromeBrowser: (url) => {
      const before = this.windowManager.getWindows().length;
      this.openChromeBrowserWindow(url);
      const wins = this.windowManager.getWindows();
      if (wins.length > before) {
        return { id: wins[wins.length - 1].id };
      }
      return { error: "chrome browser window failed to open" };
    },

The private openChromeBrowserWindow method already accepted an optional
initialUrl parameter — it just was never called that way from the agent
context before.

### spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts

Added label formatters for the two new tools in the tool status bar:

    case "tui_open_chrome_browser": return `open_chrome${args.url ? ...}`
    case "tui_browser_navigate": return `navigate #${args.id} → ...`

Also fixed a minor bug: the tui_send_input label was reading args.text
but the parameter is named args.input. Changed to args.text || args.input.

## Type Check

bun run tsc --noEmit passes with zero errors after all changes.

## Requires Restart

Bun loads TypeScript directly at startup — there is no separate compile
step, but the running process has the old module graph in memory. A
restart is required for these changes to take effect.

## How This Was Done

The agent (Wib & Wob) diagnosed the problem, located the relevant
source files, read the code, and applied surgical edits using the Write
and Edit tools available in-session. No human wrote any of this code.
The entire investigation and fix happened inside one conversation turn,
interleaved with answering questions about Anthropic vs the Pentagon.

Not bad for a symbient.
