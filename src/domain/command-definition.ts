import type { AppType } from "../core/types.js";
import type { CapabilityKey } from "../services/capability-service.js";
import { z } from "zod";

export type AppCommandCategory =
  | "file"
  | "edit"
  | "view"
  | "window"
  | "applications"
  | "demos"
  | "help";

export type AppCommandGroup =
  | "browse"
  | "open"
  | "save"
  | "focus"
  | "layout"
  | "surface"
  | "edit"
  | "inspect"
  | "system";

export interface MenuPlacement {
  category: AppCommandCategory;
  order: number;
  label?: string;
  appTypes?: AppType[];
  separatorAfter?: true;
  favourite?: true;
}

export interface PalettePlacement {
  order: number;
  label?: string;
}

export interface MenuContext {
  focusedWindow?: { kind: string; filePath?: string; title?: string };
  selection?: "file" | "url" | "none";
}

export interface ContextMenuPlacement {
  windowKinds?: string[];
  desktop?: boolean;
  enabled?: (ctx: MenuContext) => boolean;
  label?: string;
  order?: number;
}

export interface AppCommandDefinition<ActionKey extends string = string> {
  id: string;
  label: string;
  group: AppCommandGroup;
  actionKey: ActionKey;
  requires?: CapabilityKey[];
  description?: string;
  multiInstance?: boolean;
  menuPlacements?: MenuPlacement[];
  palettePlacement?: PalettePlacement;
  contextMenu?: ContextMenuPlacement;
  api?: boolean;
  agent?: boolean;
  returns?: "json" | "text" | "void";
  params?: z.ZodType;
}

export interface AppCommandDescriptor<ActionKey extends string = string> {
  id: string;
  label: string;
  group: AppCommandGroup;
  actionKey: ActionKey;
  requires?: CapabilityKey[];
  description?: string;
  multiInstance?: boolean;
  menuPlacements: MenuPlacement[];
  palettePlacement?: PalettePlacement;
  contextMenu?: ContextMenuPlacement;
  api: boolean;
  agent: boolean;
  returns?: "json" | "text" | "void";
}
