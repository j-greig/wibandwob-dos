/**
 * Chrome Browser Service
 *
 * Connects to Chrome via CDP (Chrome DevTools Protocol) on localhost:9222,
 * navigates to URLs, and extracts readable content as markdown using
 * Mozilla Readability + Turndown. Based on badlogic/browser-tools.
 *
 * Requires Chrome running with --remote-debugging-port=9222
 */

import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

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

export class ChromeBrowserService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Attempt to connect to Chrome on :9222. Returns true if connected.
   */
  async connect(): Promise<boolean> {
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
          error: "Cannot connect to Chrome on :9222. Run browser-start.js first.",
        };
      }
    }

    try {
      await Promise.race([
        this.page!.goto(url, { waitUntil: "networkidle2" }),
        new Promise((r) => setTimeout(r, 15000)),
      ]).catch(() => {});

      const finalUrl = this.page!.url();

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

      // Extract with Readability
      const doc = new JSDOM(outerHTML, { url: finalUrl });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      let markdown: string;
      let title = article?.title ?? "";

      if (article?.content) {
        markdown = this.htmlToMarkdown(article.content);
      } else {
        // Fallback: strip noise and extract main content
        const fallbackDoc = new JSDOM(outerHTML, { url: finalUrl });
        const fallbackBody = fallbackDoc.window.document;
        fallbackBody
          .querySelectorAll(
            "script, style, noscript, nav, header, footer, aside"
          )
          .forEach((el) => el.remove());
        const main =
          fallbackBody.querySelector(
            "main, article, [role='main'], .content, #content"
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

      const doc = new JSDOM(outerHTML, { url });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      let markdown: string;
      let title = article?.title ?? "";

      if (article?.content) {
        markdown = this.htmlToMarkdown(article.content);
      } else {
        const fallbackDoc = new JSDOM(outerHTML, { url });
        const fallbackBody = fallbackDoc.window.document;
        fallbackBody
          .querySelectorAll(
            "script, style, noscript, nav, header, footer, aside"
          )
          .forEach((el) => el.remove());
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
      this.browser.disconnect();
      this.browser = null;
      this.page = null;
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
    return turndown
      .turndown(html)
      .replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, "")
      .replace(/ +/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/\s+\./g, ".")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
