/**
 * Brave Search Service
 *
 * Web search and content extraction via Brave Search API.
 * No browser required — uses HTTP fetch + Readability.
 *
 * Requires BRAVE_API_KEY env var. Free tier at:
 * https://api-dashboard.search.brave.com/register
 *
 * When the key is missing, methods return graceful errors
 * so the agent can fall back to Chrome-based search.
 */

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-ignore — no types available for turndown-plugin-gfm
import { gfm } from "turndown-plugin-gfm";

export interface BraveSearchResult {
  title: string;
  link: string;
  snippet: string;
  age: string;
}

export interface BraveContentResult {
  ok: boolean;
  url: string;
  title: string;
  markdown: string;
  error?: string;
}

export class BraveSearchService {
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.BRAVE_API_KEY;
  }

  /** Whether BRAVE_API_KEY is configured. */
  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Search via Brave Search API.
   * Returns empty array + logs if key is missing.
   */
  async search(
    query: string,
    options?: {
      numResults?: number;
      country?: string;
      freshness?: string;
    }
  ): Promise<{ results: BraveSearchResult[]; error?: string }> {
    if (!this.apiKey) {
      return {
        results: [],
        error:
          "BRAVE_API_KEY not set. Get a free key at https://api-dashboard.search.brave.com/register",
      };
    }

    const numResults = Math.max(1, Math.min(options?.numResults ?? 5, 20));
    const params = new URLSearchParams({
      q: query,
      count: String(numResults),
      country: options?.country ?? "US",
    });
    if (options?.freshness) {
      params.append("freshness", options.freshness);
    }

    const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          results: [],
          error: `Brave API error: HTTP ${response.status} ${response.statusText}\n${text}`,
        };
      }

      const data = (await response.json()) as {
        web?: {
          results?: Array<{
            title?: string;
            url?: string;
            description?: string;
            age?: string;
            page_age?: string;
          }>;
        };
      };

      const results: BraveSearchResult[] = [];
      if (data.web?.results) {
        for (const r of data.web.results) {
          if (results.length >= numResults) break;
          results.push({
            title: r.title ?? "",
            link: r.url ?? "",
            snippet: r.description ?? "",
            age: r.age ?? r.page_age ?? "",
          });
        }
      }

      return { results };
    } catch (err) {
      return {
        results: [],
        error: `Brave search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Fetch a URL and extract readable content as markdown.
   * No Chrome needed — uses plain HTTP fetch + Readability.
   * Works for most static/SSR pages. JS-heavy SPAs may need Chrome.
   */
  async fetchContent(url: string): Promise<BraveContentResult> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return {
          ok: false,
          url,
          title: "",
          markdown: "",
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article?.content) {
        return {
          ok: true,
          url,
          title: article.title ?? "",
          markdown: this.htmlToMarkdown(article.content),
        };
      }

      // Fallback: strip noise, find main content
      const fallbackDoc = new JSDOM(html, { url });
      const body = fallbackDoc.window.document;
      body
        .querySelectorAll(
          "script, style, noscript, nav, header, footer, aside"
        )
        .forEach((el: Element) => el.remove());

      const title =
        body.querySelector("title")?.textContent?.trim() ?? "";
      const main =
        body.querySelector(
          "main, article, [role='main'], .content, #content"
        ) || body.body;
      const mainHtml = main?.innerHTML ?? "";

      if (mainHtml.trim().length > 100) {
        return {
          ok: true,
          url,
          title,
          markdown: this.htmlToMarkdown(mainHtml),
        };
      }

      return {
        ok: false,
        url,
        title,
        markdown: "",
        error: "Could not extract readable content from this page",
      };
    } catch (err) {
      return {
        ok: false,
        url,
        title: "",
        markdown: "",
        error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      };
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
