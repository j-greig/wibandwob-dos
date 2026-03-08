/**
 * Primer Gallery — browsable primer collection.
 *
 * Tabs for categories. Scrollable List of .txt filenames from primers/.
 * Large preview panel. TextInput search with live filter.
 * Toggle for favourites. Enter opens primer in new window.
 */

import type { MicroappHost } from "#sdk";
import fs from "node:fs";
import path from "node:path";

const CATEGORIES = ["joan-stark", "wibwob", "monsters", "isometric", "all"] as const;
type Category = typeof CATEGORIES[number];

interface PrimerFile {
  name: string;
  path: string;
  category: Category;
  favourite: boolean;
}

function detectCategory(filePath: string): Category {
  const lower = filePath.toLowerCase();
  if (lower.includes("joan") || lower.includes("jgs")) return "joan-stark";
  if (lower.includes("wib") || lower.includes("wob")) return "wibwob";
  if (lower.includes("monster") || lower.includes("beast")) return "monsters";
  if (lower.includes("iso")) return "isometric";
  return "all";
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Primer Gallery",
    menu: [{ category: "applications", order: 61, label: "Primer Gallery" }],
    palette: { order: 172 },
    action: () => {
      const win = host.createWindow({
        title: "Primer Gallery",
        width: 80,
        height: 30,
      });

      // Discover primers
      const primersDir = path.join(process.cwd(), "primers");
      let allPrimers: PrimerFile[] = [];
      try {
        const files = fs.readdirSync(primersDir, { recursive: true }) as string[];
        allPrimers = files
          .filter((f: string) => f.endsWith(".txt") || f.endsWith(".md"))
          .map((f: string) => ({
            name: path.basename(f),
            path: path.join(primersDir, f),
            category: detectCategory(f),
            favourite: false,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } catch { /* primers dir may not exist */ }

      let activeTab: Category = "all";
      let searchQuery = "";
      let selected = 0;
      let previewContent = "";
      let showFavourites = false;

      function filteredPrimers(): PrimerFile[] {
        return allPrimers.filter(p => {
          if (showFavourites && !p.favourite) return false;
          if (activeTab !== "all" && p.category !== activeTab) return false;
          if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
          return true;
        });
      }

      function render() {
        const innerW = Number(win.body.width) || 80;
        const innerH = Number(win.body.height) || 28;
        const listW = Math.min(30, Math.floor(innerW * 0.35));
        const previewW = innerW - listW - 1;
        const filtered = filteredPrimers();

        // Tabs
        const tabs = CATEGORIES.map(c =>
          c === activeTab ? `[${c}]` : ` ${c} `
        ).join(" ");

        // Search
        const search = `🔍 ${searchQuery || "(type to search)"}`;

        // List
        const listLines = filtered.map((p, i) => {
          const marker = i === selected ? "▸ " : "  ";
          const fav = p.favourite ? "★ " : "  ";
          return `${marker}${fav}${p.name}`;
        });

        // Preview
        const previewLines = previewContent.split("\n");

        // Compose
        const lines: string[] = [tabs, search, "─".repeat(innerW)];
        const bodyH = innerH - 3;
        for (let i = 0; i < bodyH; i++) {
          const left = (listLines[i] ?? "").padEnd(listW).slice(0, listW);
          const right = (previewLines[i] ?? "").slice(0, previewW);
          lines.push(`${left}│${right}`);
        }

        win.body.setContent(lines.join("\n"));
        host.screen.render();
      }

      function loadPreview() {
        const filtered = filteredPrimers();
        const primer = filtered[selected];
        if (!primer) { previewContent = ""; return; }
        try {
          previewContent = fs.readFileSync(primer.path, "utf-8");
        } catch {
          previewContent = "(could not read file)";
        }
      }

      // Key bindings
      win.body.key(["tab"], () => {
        const idx = CATEGORIES.indexOf(activeTab);
        activeTab = CATEGORIES[(idx + 1) % CATEGORIES.length];
        selected = 0;
        loadPreview();
        render();
      });
      win.body.key(["up", "k"], () => {
        if (selected > 0) selected--;
        loadPreview();
        render();
      });
      win.body.key(["down", "j"], () => {
        const filtered = filteredPrimers();
        if (selected < filtered.length - 1) selected++;
        loadPreview();
        render();
      });
      win.body.key(["f"], () => {
        const filtered = filteredPrimers();
        const p = filtered[selected];
        if (p) p.favourite = !p.favourite;
        render();
      });
      win.body.key(["t"], () => {
        showFavourites = !showFavourites;
        selected = 0;
        loadPreview();
        render();
      });
      win.body.key(["return"], () => {
        const filtered = filteredPrimers();
        const p = filtered[selected];
        if (p) {
          host.runCommand("microapp.primer-gallery.open-primer", { path: p.path });
        }
      });
      win.body.key(["q", "escape"], () => win.close());

      win.onResize(() => { loadPreview(); render(); });

      loadPreview();
      render();

      win.describeState(() => ({
        summary: `Primer Gallery — ${filteredPrimers().length} primers`,
        activeTab,
        searchQuery,
        primerCount: allPrimers.length,
      }));
    },
  });
}
