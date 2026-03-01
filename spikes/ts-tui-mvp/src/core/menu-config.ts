import type { MenuConfig, MenuItem } from "./types.js";

export interface AppMenuActions {
  browsePrimers: () => void;
  openPrimerPrompt: () => void;
  openTextFilePrompt: () => void;
  openEditor: () => void;
  saveWorkspaceAs: () => void;
  loadWorkspacePrompt: () => void;
  openArtWindow: () => void;
  openTerminal: () => void;
  openXTermShell: () => void;
  openWibWobChat: () => void;
  openWibWobAgent: () => void;
  openPiChat: () => void;
  quit: () => void;
  focusNextWindow: () => void;
  focusPreviousWindow: () => void;
  closeFocusedWindow: () => void;
  openBackroomsPrompt: () => void;
  tileWindows: () => void;
  cascadeWindows: () => void;
  openGallery: () => void;
  openBrowserReader: () => void;
  openFigletBanner: () => void;
  openPatternWindow: () => void;
  openOrbitWindow: () => void;
  openGlitchWindow: () => void;
  openChatWindow: () => void;
  openCompanionWindow: () => void;
  openWorkspaceManager: () => void;
  openCommandPalette: () => void;
  openStateInspector: () => void;
  saveWorkspace: () => void;
  loadWorkspace: () => void;
}

export function createMenuConfigs(actions: AppMenuActions): MenuConfig[] {
  return [
    {
      label: "File",
      key: "f",
      left: 1,
      items: [
        { label: "Browse Primers", action: actions.browsePrimers },
        { label: "Open Primer...", action: actions.openPrimerPrompt },
        { label: "Open Text File...", action: actions.openTextFilePrompt },
        { label: "New Text Buffer", action: actions.openEditor },
        { label: "Save Workspace...", action: actions.saveWorkspaceAs },
        { label: "Load Workspace...", action: actions.loadWorkspacePrompt },
        { label: "Open Art Window", action: actions.openArtWindow },
        { label: "Open Terminal", action: actions.openTerminal },
        { label: "Open XTerm Shell", action: actions.openXTermShell },
        { label: "Open Wib&Wob Chat", action: actions.openWibWobChat },
        { label: "Open Wib&Wob Agent", action: actions.openWibWobAgent },
        { label: "Open Pi Terminal (Legacy)", action: actions.openPiChat },
        { label: "Quit", action: actions.quit }
      ]
    },
    {
      label: "Edit",
      key: "e",
      left: 8,
      items: [
        { label: "Focus Next Window", action: actions.focusNextWindow },
        { label: "Focus Previous Window", action: actions.focusPreviousWindow },
        { label: "Close Focused Window", action: actions.closeFocusedWindow }
      ]
    },
    {
      label: "View",
      key: "v",
      left: 15,
      items: [{ label: "Backrooms TV...", action: actions.openBackroomsPrompt }]
    },
    {
      label: "Window",
      key: "w",
      left: 22,
      items: [
        { label: "Tile Windows", action: actions.tileWindows },
        { label: "Cascade Windows", action: actions.cascadeWindows },
        { label: "Open Gallery", action: actions.openGallery },
        { label: "Open Browser", action: actions.openBrowserReader },
        { label: "Open Art", action: actions.openArtWindow }
      ]
    },
    {
      label: "Tools",
      key: "t",
      left: 31,
      items: [
        { label: "Backrooms TV", action: actions.openBackroomsPrompt },
        { label: "Primer Gallery", action: actions.openGallery },
        { label: "Browser Reader", action: actions.openBrowserReader },
        { label: "Figlet Banner", action: actions.openFigletBanner },
        { label: "Pattern Window", action: actions.openPatternWindow },
        { label: "Orbit Window", action: actions.openOrbitWindow },
        { label: "Glitch FX", action: actions.openGlitchWindow },
        { label: "Chat Transcript", action: actions.openChatWindow },
        { label: "Wib&Wob Chat", action: actions.openWibWobChat },
        { label: "Wib&Wob Agent", action: actions.openWibWobAgent },
        { label: "Companion", action: actions.openCompanionWindow },
        { label: "Workspace Manager", action: actions.openWorkspaceManager },
        { label: "XTerm Shell", action: actions.openXTermShell },
        { label: "Pi Terminal (Legacy)", action: actions.openPiChat },
        { label: "Command Palette", action: actions.openCommandPalette },
        { label: "State Inspector", action: actions.openStateInspector }
      ]
    }
  ];
}

export function createPaletteCommands(actions: AppMenuActions): MenuItem[] {
  return [
    { label: "Open Backrooms TV", action: actions.openBackroomsPrompt },
    { label: "Open Primer Gallery", action: actions.openGallery },
    { label: "Open Browser Reader", action: actions.openBrowserReader },
    { label: "Open Figlet Banner", action: actions.openFigletBanner },
    { label: "Open Pattern Window", action: actions.openPatternWindow },
    { label: "Open Orbit Window", action: actions.openOrbitWindow },
    { label: "Open Glitch FX Window", action: actions.openGlitchWindow },
    { label: "Open Chat Transcript", action: actions.openChatWindow },
    { label: "Open Wib&Wob Chat", action: actions.openWibWobChat },
    { label: "Open Wib&Wob Agent", action: actions.openWibWobAgent },
    { label: "Open Companion Window", action: actions.openCompanionWindow },
    { label: "Open Workspace Manager", action: actions.openWorkspaceManager },
    { label: "Save Workspace As...", action: actions.saveWorkspaceAs },
    { label: "Load Workspace...", action: actions.loadWorkspacePrompt },
    { label: "Open State Inspector", action: actions.openStateInspector },
    { label: "Save Workspace", action: actions.saveWorkspace },
    { label: "Load Workspace", action: actions.loadWorkspace },
    { label: "Tile Windows", action: actions.tileWindows },
    { label: "Cascade Windows", action: actions.cascadeWindows },
    { label: "Open Terminal", action: actions.openTerminal },
    { label: "Open XTerm Shell", action: actions.openXTermShell },
    { label: "Open Pi Terminal (Legacy)", action: actions.openPiChat }
  ];
}
