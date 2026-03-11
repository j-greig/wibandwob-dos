# Adaptive Content Extraction — Future Strategy

## Problem

Many sites deliver content via mechanisms that Readability + Turndown miss:

| Technique | Example | Current result |
|-----------|---------|----------------|
| JS-rendered sections | symbient.life, SPAs | Empty headings, truncated text |
| CSS background-image | Hero banners, cards | No images extracted |
| Lazy-load via IntersectionObserver | Most modern sites | Missing images |
| `<picture>` / `<source>` / srcset | Responsive images | Partial — we handle some |
| Shadow DOM | Web components | Invisible to Readability |
| Infinite scroll | News feeds, social | Only first fold |
| `<noscript>` fallbacks | SEO-friendly sites | Partial — we check these |
| SVG inline / `<object>` | Diagrams, logos | Not extracted |
| `<canvas>` rendered content | Charts, visualisations | Not extractable |
| iframe-embedded content | Embeds, widgets | Not extracted |

## Heuristic layers — progressive enhancement

### Layer 1: Smarter waiting (cheapest win)

Current: `waitUntil: "networkidle2"` + 15s timeout.

Better: adaptive wait based on page signals.

```
1. Wait for networkidle2 (current)
2. Check document.readyState === "complete"
3. Wait for MutationObserver silence (no DOM changes for 2s)
4. Scroll to bottom once (triggers IntersectionObserver lazy loads)
5. Wait for network silence again
6. Scroll back to top
```

This catches ~80% of lazy-load and JS-render patterns with no
site-specific knowledge.

### Layer 2: Multi-pass extraction

If Readability returns suspiciously little content:

```
Pass 1: Readability (current) — fast, clean, works on articles
Pass 2: If < 500 chars or empty sections detected:
  - innerText of document.body (raw but complete)
  - Strip nav/footer/header by tag name
  - Keep section/article/main content
Pass 3: If still thin:
  - page.content() — full rendered HTML
  - Custom extraction: walk DOM, extract visible text nodes
```

Heuristic trigger: `markdown.length < expectedMinLength` or
ratio of headings to body text is suspiciously high.

### Layer 3: Image discovery beyond `<img>`

Current: only `<img>` tags in Readability output.

Augment with page.evaluate() scan:

```javascript
// Run in Chrome context BEFORE Readability
const images = [];

// 1. Regular <img> (already handled)
document.querySelectorAll("img[src]").forEach(img => ...);

// 2. CSS background-image on visible elements
document.querySelectorAll("*").forEach(el => {
  const bg = getComputedStyle(el).backgroundImage;
  if (bg && bg !== "none" && bg.startsWith("url(")) {
    const url = bg.slice(5, -2);
    const rect = el.getBoundingClientRect();
    if (rect.width > 150 && rect.height > 150) {
      images.push({ url, width: rect.width, height: rect.height });
    }
  }
});

// 3. <video poster="...">
document.querySelectorAll("video[poster]").forEach(v => ...);

// 4. <svg> with useful content (skip icons < 50px)
// Convert to PNG via canvas if needed

// 5. Open Graph / Twitter Card meta tags (fallback hero image)
const og = document.querySelector('meta[property="og:image"]');
if (og) images.push({ url: og.content, source: "og:image" });
```

Inject discovered images as `![description](url)` into the
markdown at approximate positions.

### Layer 4: Scroll-and-capture for infinite content

For pages that load content on scroll:

```
1. Capture initial content
2. Scroll down by viewport height
3. Wait for MutationObserver activity to settle
4. Capture new content
5. Repeat N times (cap at 5 scrolls)
6. Deduplicate and concatenate
```

### Layer 5: Site-specific adapters (last resort)

Known-pattern matchers for common frameworks:

| Pattern | Detection | Adaptation |
|---------|-----------|------------|
| Next.js/Nuxt SSR | `__NEXT_DATA__` script tag | Parse JSON for page props |
| WordPress | `wp-content` in URLs | Standard Readability works |
| Medium | `<article>` with specific classes | Readability works well |
| SPA with hash routing | URL has `#/` or empty body | Wait longer, check for React root |
| Paywall soft-wall | `<meta name="robots" content="noarchive">` | Try Google cache URL |

## Implemented (2026-03-11)

- **Scroll trigger**: scroll to bottom + wait 1.5s before extraction (IntersectionObserver)
- **Thin-content DOM walk**: if Readability < 500 chars, structured walk of
  `main/article/[role=main]` extracting headings, paragraphs, lists, images
- **Chrome session image fetch**: `fetchImagesViaChrome()` uses `page.evaluate(fetch())`
  to download images through Chrome's session (same cookies, CDN auth, CORS).
  Saved to /tmp, passed as `file://` paths to hydrator. No more curl.

## Implementation priority (remaining)

1. **CSS background-image discovery** — scan computed styles, ~half day
2. **OG/meta image fallback** — og:image, twitter:image as hero, ~1 hour
3. **Scroll-and-capture for infinite content** — N viewport scrolls, ~1 day
4. **Site-specific adapters** — only when specific sites matter

## Measurement

Track extraction quality:
- `chars_extracted` — total markdown length
- `images_found` — count of `![` in output
- `heading_to_body_ratio` — high ratio = likely thin extraction
- `empty_sections` — headings with no body text following

Log these in status bar or state so agents can detect poor extractions
and retry with deeper heuristics.

## Files to change

| Layer | Files |
|-------|-------|
| 1 | `src/services/chrome-browser-service.ts` — `navigate()` method |
| 2 | `src/services/chrome-browser-service.ts` — new `extractFallback()` |
| 3 | `src/services/chrome-browser-service.ts` — new `discoverImages()` |
| 4 | `src/services/chrome-browser-service.ts` — new `scrollAndCapture()` |
| 5 | `src/services/site-adapters/` — new directory, per-pattern modules |
