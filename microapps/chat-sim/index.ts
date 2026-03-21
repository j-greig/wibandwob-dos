import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import {
  createScrollView,
  createInputLine,
  createHeaderBar,
  createStatusBar,
} from "../../src/services/microapp-sdk.js";

const APP_TITLE = "Chat Sim";

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: string;
}

const BOT_RESPONSES = [
  "Interesting! Tell me more.",
  "I see what you mean.",
  "That's a great point.",
  "Hmm, let me think about that...",
  "Could you elaborate?",
  "Fascinating! What made you think of that?",
  "I hadn't considered that perspective.",
  "That reminds me of something...",
  "*nods thoughtfully*",
  "Go on...",
];

function getTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMessage(msg: ChatMessage): string {
  const nameColor = msg.sender === "You" ? "\x1b[96m" : "\x1b[93m";
  return `${nameColor}${msg.sender}\x1b[0m \x1b[90m${msg.timestamp}\x1b[0m\n  ${msg.text}`;
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: APP_TITLE,
    description: "Chat simulator with auto-responding bot. Type messages and press Enter.",
    menu: [{ category: "demos", order: 207, label: APP_TITLE }],
    palette: { order: 207, label: `Open ${APP_TITLE}` },
    action: () => {
      const messages: ChatMessage[] = [
        { sender: "Bot", text: "Hello! Type a message and press Enter to chat.", timestamp: getTimestamp() },
      ];

      const win = host.createWindow({ title: APP_TITLE, width: 55, height: 20 });

      const header = createHeaderBar(win.body, {
        left: APP_TITLE,
        right: `${messages.length} messages`,
      });

      const chatView = createScrollView(win.body, {
        topOffset: 1,
        bottomOffset: 2,
        wrap: true,
      });

      const input = createInputLine(win.body, {
        placeholder: "Type a message...",
        bottom: 1,
      });

      const status = createStatusBar(win.body, {
        left: "Enter: send  Esc: focus chat  Tab: focus input",
        right: "online",
      });

      const renderChat = () => {
        const text = messages.map(formatMessage).join("\n\n");
        chatView.update({ content: text });
        // Scroll to bottom
        const el = chatView.element;
        (el as any).setScrollPerc(100);
        header.update({ right: `${messages.length} messages` });
        host.screen.render();
      };

      const addMessage = (sender: string, text: string) => {
        messages.push({ sender, text, timestamp: getTimestamp() });
        renderChat();
      };

      const botReply = () => {
        setTimeout(() => {
          const response = BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)];
          addMessage("Bot", response!);
        }, 500 + Math.random() * 1500);
      };

      input.onSubmit((text) => {
        if (text.trim()) {
          addMessage("You", text.trim());
          botReply();
        }
      });

      // win.onInput handles API-sent text (agent input)
      win.onInput((text) => {
        if (text.trim()) {
          addMessage("Agent", text.trim());
          botReply();
        }
      });

      // Focus management
      chatView.element.key(["tab"], () => input.focus());
      chatView.element.key(["i"], () => input.focus());

      win.describeState(() => ({
        summary: `Chat Sim — ${messages.length} messages`,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1]?.text ?? "",
        lastSender: messages[messages.length - 1]?.sender ?? "",
      }));

      win.captureText(() =>
        messages.map(m => `[${m.timestamp}] ${m.sender}: ${m.text}`).join("\n")
      );

      win.onRestyle(() => {
        header.update({});
        status.update({});
        host.screen.render();
      });

      win.onCleanup(() => {
        header.destroy();
        chatView.destroy();
        input.destroy();
        status.destroy();
      });

      win.setFocusTarget(input.element);
      win.focus();
      renderChat();

      return { ok: true, windowId: win.id };
    },
  });
}
