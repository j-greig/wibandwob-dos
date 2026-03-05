export type SlashHandler = () => string;

export interface SlashRouter {
  /** Returns the handler's reply if text starts with a registered command,
   *  null if it is not a slash command, and the /unknown reply if the command
   *  is not registered. */
  handle(text: string): string | null;
}

export function createSlashRouter(
  commands: Record<string, SlashHandler>,
  unknownReply?: string
): SlashRouter {
  const normalized = new Map<string, SlashHandler>();

  for (const [name, handler] of Object.entries(commands)) {
    normalized.set(name.trim().toLowerCase(), handler);
  }

  return {
    handle(text: string): string | null {
      const input = text.trim();
      if (!input.startsWith("/")) {
        return null;
      }

      const commandName = input.slice(1).trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
      if (!commandName) {
        return unknownReply ?? "unknown command.";
      }

      const handler = normalized.get(commandName);
      if (!handler) {
        return unknownReply ?? "unknown command.";
      }

      return handler();
    },
  };
}
