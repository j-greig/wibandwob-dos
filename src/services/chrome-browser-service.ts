/**
 * Chrome Browser Service
 *
 * Auto-launches headless Chrome via puppeteer and connects via CDP.
 * Navigates to URLs and extracts readable content as markdown using
 * Mozilla Readability + Turndown. Based on badlogic/browser-tools.
 *
 * Falls back to connecting to an existing Chrome on :9222 if launch fails.
 */

import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import TurndownService from "turndown";
// @ts-ignore — no types available for turndown-plugin-gfm
import { gfm } from "turndown-plugin-gfm";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { capabilityService } from "./capability-service.js";

/** Suppress jsdom CSS parse warnings that leak to stderr. */
function quietConsole(): VirtualConsole {
  const vc = new VirtualConsole();
  // Forward everything except jsdom's internal CSS errors
  vc.on("error", () => {});
  vc.on("warn", () => {});
  return vc;
}

export interface BrowseResult {
  ok: boolean;
  url: string;
  title: string;
  markdown: string;
  error?: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/** Well-known Chrome/Chromium paths by platform. */
const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",  // macOS
  "/usr/bin/google-chrome-stable",                                  // Linux (apt/rpm)
  "/usr/bin/chromium-browser",                                      // Linux (snap/apt)
  "/usr/bin/chromium",                                              // Linux (arch)
];

export function findChromeExecutablePath(): string | null {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export class ChromeBrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private launched = false;
  /** chafa symbol mode: "braille" (default, higher res) or "block" (half blocks) */
  imageSymbols: "braille" | "block" = "block";

  /**
   * Launch or connect to Chrome. Tries launching headless first,
   * falls back to connecting to an existing instance on :9222.
   */
  async connect(): Promise<boolean> {
    const gate = capabilityService.isAvailable(["bin.chrome"]);
    if (!gate.ok) {
      throw new Error(`Chrome not available: ${gate.missing.join(", ")}`);
    }

    // Try launching our own headless Chrome
    if (!this.launched) {
      const chromePath = findChromeExecutablePath();
      if (chromePath) {
        try {
          this.browser = await Promise.race([
            puppeteer.launch({
              executablePath: chromePath,
              headless: true,
              args: [
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-background-networking",
                "--disable-sync",
                "--disable-gpu",
              ],
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 10000)
            ),
          ]);
          const pages = await this.browser.pages();
          this.page = pages.at(-1) ?? (await this.browser.newPage());
          this.launched = true;
          return true;
        } catch {
          // launch failed, fall through to connect
        }
      }
    }

    // Fall back: connect to existing Chrome on :9222
    try {
      this.browser = await Promise.race([
        puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 5000)
        ),
      ]);
      const pages = await this.browser.pages();
      this.page = pages.at(-1) ?? (await this.browser.newPage());
      return true;
    } catch {
      this.browser = null;
      this.page = null;
      return false;
    }
  }

  isConnected(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Navigate to a URL and extract readable markdown content.
   */
  async navigate(url: string): Promise<BrowseResult> {
    if (!this.browser || !this.page) {
      const connected = await this.connect();
      if (!connected) {
        return {
          ok: false,
          url,
          title: "",
          markdown: "",
          error: "Cannot launch or connect to Chrome. Install Chrome and try again.",
        };
      }
    }

    try {
      await Promise.race([
        this.page!.goto(url, { waitUntil: "networkidle2" }),
        new Promise((r) => setTimeout(r, 15000)),
      ]).catch(() => {});

      // Wait for DOM to settle after JS hydration (React, Next.js, etc.)
      await this.page!.evaluate(() => new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const done = () => { observer.disconnect(); resolve(); };
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, 800);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        timer = setTimeout(done, 2000); // max 2s wait
      })).catch(() => {});

      const finalUrl = this.page!.url();

      // Resolve lazy-loaded images: multiple strategies for different sites
      await this.page!.evaluate(() => {
        // 1. data-src → src (common lazy-load pattern)
        document.querySelectorAll("img[data-src]").forEach((img) => {
          const src = img.getAttribute("src") ?? "";
          if (!src || src.includes("data:") || src.includes("placeholder") || src.includes("1x1")) {
            img.setAttribute("src", img.getAttribute("data-src")!);
          }
        });
        // 2. srcset → src (responsive images without src)
        document.querySelectorAll("img").forEach((img) => {
          const src = img.getAttribute("src") ?? "";
          if (!src || src.includes("data:") || src.includes("1x1")) {
            const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset") ?? "";
            if (srcset) {
              // Pick the largest from srcset
              const entries = srcset.split(",").map(s => s.trim().split(/\s+/));
              const best = entries.sort((a, b) => {
                const aw = parseInt(a[1] ?? "0");
                const bw = parseInt(b[1] ?? "0");
                return bw - aw;
              })[0];
              if (best?.[0]) img.setAttribute("src", best[0]);
            }
          }
        });
        // 3. <noscript> tags often contain real <img> for JS-disabled fallback
        document.querySelectorAll("noscript").forEach((ns) => {
          const html = ns.textContent ?? "";
          const match = html.match(/src=["']([^"']+)["']/);
          if (match?.[1] && ns.parentElement) {
            const existingImg = ns.parentElement.querySelector("img");
            if (existingImg) {
              const curSrc = existingImg.getAttribute("src") ?? "";
              if (!curSrc || curSrc.includes("data:")) {
                existingImg.setAttribute("src", match[1]);
              }
            }
          }
        });
        // 4. <picture> <source> → img src
        document.querySelectorAll("picture").forEach((pic) => {
          const img = pic.querySelector("img");
          if (!img) return;
          const src = img.getAttribute("src") ?? "";
          if (src && !src.includes("data:")) return;
          const source = pic.querySelector("source[srcset]");
          if (source) {
            const srcset = source.getAttribute("srcset") ?? "";
            const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
            if (first) img.setAttribute("src", first);
          }
        });
      }).catch(() => {});

      // Scroll to bottom and back to trigger IntersectionObserver lazy loads
      await this.page!.evaluate(async () => {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        window.scrollTo(0, document.body.scrollHeight);
        await delay(1500);
        window.scrollTo(0, 0);
        await delay(500);
      }).catch(() => {});

      // Get HTML via CDP (works even with TrustedScriptURL restrictions)
      const client = await this.page!.createCDPSession();
      const { root } = await client.send("DOM.getDocument", {
        depth: -1,
        pierce: true,
      });
      const { outerHTML } = await client.send("DOM.getOuterHTML", {
        nodeId: root.nodeId,
      });
      await client.detach();

      // Pre-clean the HTML before Readability gets it
      const preCleanDoc = new JSDOM(outerHTML, { url: finalUrl, virtualConsole: quietConsole() });
      const preCleanBody = preCleanDoc.window.document;
      // Remove noise elements that confuse Readability
      const noiseSelectors = [
        // Navigation and chrome
        "nav", "[role='navigation']", "[role='banner']", "[role='contentinfo']",
        "[aria-label='navigation']", "[aria-label='breadcrumb']",
        ".nav", ".navbar", ".navigation", ".breadcrumb", ".breadcrumbs",
        // Cookie banners, popups, modals
        "[class*='cookie']", "[id*='cookie']", "[class*='consent']", "[id*='consent']",
        "[class*='popup']", "[class*='modal']", "[class*='overlay']",
        "[class*='gdpr']", "[id*='gdpr']",
        // Ads and promos
        "[class*='ad-']", "[class*='advert']", "[id*='ad-']",
        "[class*='promo']", "[class*='banner']",
        // Site furniture
        ".sidebar", "[role='complementary']", ".toc", ".table-of-contents",
        ".share-buttons", ".social-share", "[class*='share']",
        ".comments", "#comments", ".comment-section",
        // Wikipedia-specific noise
        ".mw-jump-link", ".mw-editsection", ".reference", ".reflist",
        ".navbox", ".sistersitebox", ".portalbox", ".noprint",
        // Skip-to-content links
        ".skip-link", ".skip-nav", "[class*='skip-to']",
      ];
      for (const sel of noiseSelectors) {
        try {
          preCleanBody.querySelectorAll(sel).forEach((el: Element) => el.remove());
        } catch { /* invalid selector on this page, skip */ }
      }
      const cleanedHTML = preCleanBody.documentElement.outerHTML;

      // Extract with Readability
      const doc = new JSDOM(cleanedHTML, { url: finalUrl, virtualConsole: quietConsole() });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      let markdown: string;
      let title = article?.title ?? "";

      if (article?.content) {
        markdown = this.htmlToMarkdown(article.content);
      } else {
        // Fallback: strip noise and extract main content from original HTML
        const fallbackDoc = new JSDOM(outerHTML, { url: finalUrl, virtualConsole: quietConsole() });
        const fallbackBody = fallbackDoc.window.document;
        fallbackBody
          .querySelectorAll(
            "script, style, noscript, nav, header, footer, aside, " +
            "[role='navigation'], [role='banner'], [role='contentinfo'], " +
            "[class*='cookie'], [class*='consent'], [class*='gdpr']"
          )
          .forEach((el: Element) => el.remove());
        const main =
          fallbackBody.querySelector(
            "main, article, [role='main'], .content, #content, .post, .entry"
          ) || fallbackBody.body;
        const fallbackHtml = main?.innerHTML || "";
        if (fallbackHtml.trim().length > 100) {
          markdown = this.htmlToMarkdown(fallbackHtml);
        } else {
          markdown = "(Could not extract readable content from this page)";
        }
        if (!title) {
          title =
            fallbackBody.querySelector("title")?.textContent?.trim() ?? "";
        }
      }

      // Thin-content detection: if Readability returned very little,
      // try a structured DOM walk of the rendered page
      if (markdown.length < 500) {
        try {
          const domText = await this.page!.evaluate(() => {
            const root = document.querySelector("main, article, [role='main'], .content, #content") || document.body;
            // Remove noise elements
            const noiseEls = "nav, footer, header, aside, script, style, noscript, " +
              "[role='navigation'], [role='banner'], [role='contentinfo'], " +
              "[class*='cookie'], [class*='consent'], [class*='nav'], " +
              "[class*='sidebar'], [class*='footer'], [class*='header']";
            root.querySelectorAll(noiseEls).forEach(el => el.remove());
            // Walk visible elements and extract structured text
            const lines: string[] = [];
            const seen = new Set<string>();
            const walk = (el: Element) => {
              const style = window.getComputedStyle(el);
              if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
              // Skip tiny/hidden elements
              const rect = el.getBoundingClientRect();
              if (rect.width < 10 || rect.height < 5) return;
              const tag = el.tagName.toLowerCase();
              if (tag === "img") {
                const src = (el as HTMLImageElement).src;
                const alt = el.getAttribute("alt") || "";
                if (src && !src.includes("data:")) lines.push(`![${alt}](${src})`);
                return;
              }
              if (/^h[1-6]$/.test(tag)) {
                const level = parseInt(tag[1]!);
                const text = el.textContent?.trim();
                if (text && !seen.has(text)) {
                  seen.add(text);
                  lines.push("\n" + "#".repeat(level) + " " + text + "\n");
                }
                return;
              }
              if (tag === "p" || tag === "li" || tag === "td" || tag === "th") {
                const text = el.textContent?.trim();
                if (text && text.length > 3 && !seen.has(text)) {
                  seen.add(text);
                  const prefix = tag === "li" ? "- " : "";
                  lines.push(prefix + text + "\n");
                }
                return;
              }
              if (tag === "pre" || tag === "code") {
                const text = el.textContent?.trim();
                if (text) lines.push("\n```\n" + text + "\n```\n");
                return;
              }
              // Recurse into containers
              for (const child of el.children) walk(child);
            };
            walk(root);
            return lines.join("\n");
          });
          if (domText.length > markdown.length) {
            markdown = domText;
          }
        } catch { /* DOM walk failed, keep Readability result */ }
      }

      // Image discovery: if markdown has no images, scan the rendered DOM
      // for <img>, CSS background-image, and OG meta tags.
      // Readability often strips images from non-article sections.
      if (!markdown.includes("![")) {
        try {
          const discovered = await this.page!.evaluate(() => {
            const imgs: Array<{src: string, alt: string, w: number, h: number, section: string}> = [];

            // 1. All visible <img> elements
            document.querySelectorAll("img").forEach(img => {
              const src = img.src;
              if (!src || src.includes("data:") || src.includes("1x1") || src.includes("pixel")) return;
              const rect = img.getBoundingClientRect();
              const w = img.naturalWidth || Math.round(rect.width);
              const h = img.naturalHeight || Math.round(rect.height);
              if (w < 150 || h < 150) return;
              // Find nearest heading or section for context
              let section = "";
              let el: Element | null = img;
              while (el && !section) {
                el = el.previousElementSibling || el.parentElement;
                if (el && /^H[1-6]$/i.test(el.tagName)) {
                  section = el.textContent?.trim() ?? "";
                }
              }
              imgs.push({ src, alt: img.alt || "", w, h, section });
            });

            // 2. CSS background-image on visible elements > 150px
            document.querySelectorAll("div, section, figure, header, [class*='hero'], [class*='banner']").forEach(el => {
              const bg = getComputedStyle(el).backgroundImage;
              if (!bg || bg === "none" || !bg.startsWith("url(")) return;
              const url = bg.slice(5, -2).replace(/["']/g, "");
              if (url.includes("data:") || url.includes("gradient")) return;
              const rect = el.getBoundingClientRect();
              if (rect.width < 150 || rect.height < 150) return;
              // Deduplicate with <img> results
              if (imgs.some(i => i.src === url)) return;
              imgs.push({ src: url, alt: "", w: Math.round(rect.width), h: Math.round(rect.height), section: "" });
            });

            // 3. OG / Twitter meta tags as fallback hero
            if (imgs.length === 0) {
              const og = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
              const tw = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement;
              const heroUrl = og?.content || tw?.content;
              if (heroUrl) {
                imgs.push({ src: heroUrl, alt: "Hero image", w: 800, h: 600, section: "" });
              }
            }

            return imgs;
          });

          if (discovered.length > 0) {
            // Inject discovered images into markdown after their section headings
            // or append at the end if no section match
            const appended: string[] = [];
            for (const img of discovered) {
              const alt = img.alt || (img.section ? `Image from ${img.section}` : "Image");
              const imgMd = `![${alt}](${img.src})`;
              if (img.section) {
                // Try to inject after the section heading
                const headingPattern = new RegExp(`(## ${img.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\n]*\n)`);
                if (headingPattern.test(markdown)) {
                  markdown = markdown.replace(headingPattern, `$1\n${imgMd}\n`);
                  continue;
                }
              }
              appended.push(imgMd);
            }
            if (appended.length > 0) {
              markdown += "\n\n" + appended.join("\n\n");
            }
          }
        } catch { /* image discovery failed, continue without */ }
      }

      return { ok: true, url: finalUrl, title, markdown };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        url,
        title: "",
        markdown: "",
        error: `Navigation failed: ${message}`,
      };
    }
  }

  /**
   * Fetch images through Chrome's session context (same cookies, CORS, CDN auth).
   * Returns map of URL → local /tmp path for images > 150px.
   * Must be called BEFORE disconnect().
   */
  async fetchImagesViaChrome(markdown: string): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!this.page) return result;

    const imgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    const urls: string[] = [];
    for (const m of markdown.matchAll(imgRegex)) {
      if (m[2]) urls.push(m[2]);
      // No cap — fetch all discovered images
    }
    if (urls.length === 0) return result;

    for (const url of urls) {
      try {
        const localPath = await this.page.evaluate(async (imgUrl: string) => {
          try {
            const resp = await fetch(imgUrl);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            const buf = await blob.arrayBuffer();
            // Return base64
            const bytes = new Uint8Array(buf);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
            return btoa(binary);
          } catch { return null; }
        }, url);

        if (!localPath) continue;

        // Write base64 to temp file
        const tmpPath = `/tmp/chafa-chrome-${Date.now()}-${Math.random().toString(36).slice(2)}.img`;
        fs.writeFileSync(tmpPath, Buffer.from(localPath, "base64"));

        // Check dimensions via sips
        const sipsResult = await this.runCommand("sips", ["-g", "pixelWidth", "-g", "pixelHeight", tmpPath], 3000);
        const pw = parseInt(sipsResult.stdout.match(/pixelWidth:\s*(\d+)/)?.[1] ?? "0");
        const ph = parseInt(sipsResult.stdout.match(/pixelHeight:\s*(\d+)/)?.[1] ?? "0");
        if (pw < 150 || ph < 150) {
          try { fs.unlinkSync(tmpPath); } catch {}
          continue;
        }

        result.set(url, tmpPath);
      } catch { /* skip this image */ }
    }
    return result;
  }

  /**
   * Search Google and return results (titles + links + snippets).
   */
  async search(query: string, numResults = 5): Promise<SearchResult[]> {
    if (!this.browser || !this.page) {
      const connected = await this.connect();
      if (!connected) return [];
    }

    const results: SearchResult[] = [];
    let start = 0;

    while (results.length < numResults) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}`;
      await this.page!.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await this.page!
        .waitForSelector("div.MjjYud", { timeout: 5000 })
        .catch(() => {});

      const pageResults = await this.page!.evaluate(() => {
        const items: Array<{
          title: string;
          link: string;
          snippet: string;
        }> = [];
        const searchResults = document.querySelectorAll("div.MjjYud");
        for (const result of searchResults) {
          const titleEl = result.querySelector("h3");
          const linkEl = result.querySelector("a");
          const snippetEl = result.querySelector(
            "div.VwiC3b, div[data-sncf]"
          );
          if (
            titleEl &&
            linkEl &&
            linkEl.href &&
            !linkEl.href.startsWith("https://www.google.com")
          ) {
            items.push({
              title: titleEl.textContent?.trim() || "",
              link: linkEl.href,
              snippet: snippetEl?.textContent?.trim() || "",
            });
          }
        }
        return items;
      });

      if (pageResults.length === 0) break;

      for (const r of pageResults) {
        if (results.length >= numResults) break;
        if (!results.some((existing) => existing.link === r.link)) {
          results.push(r);
        }
      }

      start += 10;
      if (start >= 100) break;
    }

    return results;
  }

  /**
   * Get the current page URL.
   */
  getCurrentUrl(): string {
    return this.page?.url() ?? "";
  }

  /**
   * Go back in browser history.
   */
  async goBack(): Promise<BrowseResult> {
    if (!this.page) {
      return {
        ok: false,
        url: "",
        title: "",
        markdown: "",
        error: "Not connected",
      };
    }
    try {
      await this.page.goBack({ waitUntil: "networkidle2" });
      return this.extractCurrentPage();
    } catch {
      return {
        ok: false,
        url: this.page.url(),
        title: "",
        markdown: "",
        error: "Cannot go back",
      };
    }
  }

  /**
   * Go forward in browser history.
   */
  async goForward(): Promise<BrowseResult> {
    if (!this.page) {
      return {
        ok: false,
        url: "",
        title: "",
        markdown: "",
        error: "Not connected",
      };
    }
    try {
      await this.page.goForward({ waitUntil: "networkidle2" });
      return this.extractCurrentPage();
    } catch {
      return {
        ok: false,
        url: this.page.url(),
        title: "",
        markdown: "",
        error: "Cannot go forward",
      };
    }
  }

  /**
   * Reload the current page and re-extract content.
   */
  async reload(): Promise<BrowseResult> {
    if (!this.page) {
      return {
        ok: false,
        url: "",
        title: "",
        markdown: "",
        error: "Not connected",
      };
    }
    const url = this.page.url();
    return this.navigate(url);
  }

  /**
   * Extract content from the current page without navigating.
   */
  private async extractCurrentPage(): Promise<BrowseResult> {
    if (!this.page) {
      return {
        ok: false,
        url: "",
        title: "",
        markdown: "",
        error: "Not connected",
      };
    }

    // Wait for page to settle after navigation
    await Promise.race([
      this.page.waitForNetworkIdle({ idleTime: 500 }),
      new Promise((r) => setTimeout(r, 8000)),
    ]).catch(() => {});

    const url = this.page.url();

    try {
      const client = await this.page.createCDPSession();
      const { root } = await client.send("DOM.getDocument", {
        depth: -1,
        pierce: true,
      });
      const { outerHTML } = await client.send("DOM.getOuterHTML", {
        nodeId: root.nodeId,
      });
      await client.detach();

      const doc = new JSDOM(outerHTML, { url, virtualConsole: quietConsole() });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      let markdown: string;
      let title = article?.title ?? "";

      if (article?.content) {
        markdown = this.htmlToMarkdown(article.content);
      } else {
        const fallbackDoc = new JSDOM(outerHTML, { url, virtualConsole: quietConsole() });
        const fallbackBody = fallbackDoc.window.document;
        fallbackBody
          .querySelectorAll(
            "script, style, noscript, nav, header, footer, aside"
          )
          .forEach((el: Element) => el.remove());
        const main =
          fallbackBody.querySelector(
            "main, article, [role='main'], .content, #content"
          ) || fallbackBody.body;
        const fallbackHtml = main?.innerHTML || "";
        markdown =
          fallbackHtml.trim().length > 100
            ? this.htmlToMarkdown(fallbackHtml)
            : "(Could not extract readable content)";
        if (!title) {
          title =
            fallbackBody.querySelector("title")?.textContent?.trim() ?? "";
        }
      }

      return { ok: true, url, title, markdown };
    } catch (err) {
      return {
        ok: false,
        url,
        title: "",
        markdown: "",
        error: `Extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  disconnect(): void {
    if (this.browser) {
      if (this.launched) {
        // We spawned it, so kill it properly
        this.browser.close().catch(() => {});
      } else {
        this.browser.disconnect();
      }
      this.browser = null;
      this.page = null;
      this.launched = false;
    }
  }

  private htmlToMarkdown(html: string): string {
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
    turndown.use(gfm);
    turndown.addRule("removeEmptyLinks", {
      filter: (node) =>
        node.nodeName === "A" && !node.textContent?.trim(),
      replacement: () => "",
    });
    // Keep image placeholders synchronous for Turndown; render ASCII later.
    turndown.addRule("chafaImages", {
      filter: "img",
      replacement: (_content, node) => {
        const src = (node as HTMLElement).getAttribute("src") ?? "";
        const alt = (node as HTMLElement).getAttribute("alt") ?? "";
        if (!src) return alt ? `[${alt}]` : "";
        return `![${alt}](${src})`;
      },
    });
    return turndown
      .turndown(html)
      .replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, "")
      .replace(/ +/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/\s+\./g, ".")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async renderImagesAsAscii(markdown: string): Promise<string> {
    const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    if (!imageRegex.test(markdown)) return markdown;

    // Run image conversion in a separate Node subprocess to avoid blocking
    // the blessed event loop. The hydrator reads markdown on stdin, converts
    // images via curl+chafa, and writes updated markdown to stdout.
    const hydrator = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "image-hydrator.mjs"
    );
    return new Promise<string>((resolve) => {
      const child = spawn("node", [
        hydrator,
        "--symbols", this.imageSymbols,
        "--max-images", "3",
        "--max-cols", "60",
      ], { stdio: ["pipe", "pipe", "ignore"] });

      let stdout = "";
      child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
      child.on("error", () => resolve(markdown));
      child.on("close", (code) => {
        resolve(code === 0 && stdout ? stdout : markdown);
      });

      // Send markdown on stdin then close
      child.stdin.write(markdown);
      child.stdin.end();

      // Safety timeout — don't wait forever
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve(markdown);
      }, 30000);
    });
  }

  private async runCommand(
    command: string,
    args: string[],
    timeoutMs: number
  ): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        resolve({ code: null, stdout, stderr, timedOut: true });
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.on("error", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code: null, stdout, stderr, timedOut: false });
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code, stdout, stderr, timedOut: false });
      });
    });
  }

  private async imageToAscii(url: string, maxCols = 60): Promise<string | null> {
    try {
      // Download image to temp file
      const tmpPath = `/tmp/chafa-${Date.now()}-${Math.random().toString(36).slice(2)}.img`;
      const dl = await this.runCommand("curl", [
        "-sL", "--max-time", "3",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
        "-o", tmpPath, url,
      ], 4000);
      if (dl.code !== 0 || dl.timedOut) return null;

      // Check file is a real image and large enough
      const fileResult = await this.runCommand("file", ["--brief", tmpPath], 2000);
      const fileType = fileResult.stdout.trim();
      if (!/image|PNG|JPEG|GIF|WebP|bitmap/i.test(fileType)) {
        try { fs.unlinkSync(tmpPath); } catch {}
        return null;
      }

      // Get dimensions via file output or sips
      const sipsResult = await this.runCommand("sips", ["-g", "pixelWidth", "-g", "pixelHeight", tmpPath], 3000);
      const wMatch = sipsResult.stdout.match(/pixelWidth:\s*(\d+)/);
      const hMatch = sipsResult.stdout.match(/pixelHeight:\s*(\d+)/);
      const pw = wMatch ? Number(wMatch[1]) : 0;
      const ph = hMatch ? Number(hMatch[1]) : 0;

      // Skip small images (icons, spacers, tracking pixels)
      if (pw < 150 || ph < 150) {
        try { fs.unlinkSync(tmpPath); } catch {}
        return null;
      }

      // Scale: preserve aspect ratio, max width = maxCols
      const aspect = ph / pw;
      const cols = Math.min(maxCols, pw);
      // Terminal chars are ~2:1, so rows = cols * aspect / 2
      const rows = Math.max(5, Math.round(cols * aspect / 2));

      const chafa = await this.runCommand("chafa", [
        "-f", "symbols", "-c", "256",
        "-s", `${cols}x${rows}`,
        "--symbols", this.imageSymbols,
        tmpPath,
      ], 5000);

      try { fs.unlinkSync(tmpPath); } catch {}

      if (chafa.code !== 0 || chafa.timedOut || !chafa.stdout.trim()) return null;
      // Strip terminal cursor hide/show sequences chafa adds
      return chafa.stdout
        .replace(/\x1b\[\?25[lh]/g, "")
        .trimEnd();
    } catch {
      return null;
    }
  }
}
