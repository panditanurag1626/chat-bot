import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Pull Q&A out of Schema.org FAQPage JSON-LD blocks. Many FAQ pages are SPAs
 *  that render via JS but still embed the questions/answers here. */
function extractFaqJsonld($: cheerio.CheerioAPI): string {
  const out: string[] = [];

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    const types = Array.isArray(t) ? t : t ? [t] : [];
    if (types.includes("Question")) {
      const q = String(obj["name"] || "").trim();
      let ans = (obj["acceptedAnswer"] || obj["suggestedAnswer"] || {}) as unknown;
      if (Array.isArray(ans)) ans = ans[0] || {};
      const aRaw =
        ans && typeof ans === "object" ? String((ans as Record<string, unknown>)["text"] || "") : "";
      const a = cheerio.load(aRaw).text().replace(/\s+/g, " ").trim();
      if (q && a) out.push(`Q: ${q}\nA: ${a}`);
    }
    for (const k of ["mainEntity", "@graph", "hasPart", "itemListElement"]) {
      if (k in obj) walk(obj[k]);
    }
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || "";
    if (!raw.trim()) return;
    try {
      walk(JSON.parse(raw));
    } catch {
      /* malformed JSON-LD, skip */
    }
  });
  return out.join("\n\n");
}

/** Last-resort fallback for SPA pages where raw HTML is a JS shell. r.jina.ai
 *  renders the page in a headless browser and returns clean text. No API key. */
async function fetchViaJinaReader(url: string, timeoutMs = 30000): Promise<string> {
  try {
    const r = await fetchWithTimeout(
      `https://r.jina.ai/${url}`,
      {
        headers: {
          "User-Agent": "ChatBotAI-Trainer/1.0",
          Accept: "text/plain",
          "X-Return-Format": "text",
        },
      },
      timeoutMs
    );
    if (r.ok) {
      const text = (await r.text()).trim();
      if (text) return text;
    }
  } catch (e) {
    console.warn("[autotrain] r.jina.ai fallback failed:", e);
  }
  return "";
}

export async function fetchCleanText(url: string, limit = 20000, timeoutMs = 20000): Promise<string> {
  let faqText = "";
  let bodyText = "";
  try {
    const r = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      timeoutMs
    );
    if (r.ok) {
      const html = await r.text();
      const $ = cheerio.load(html);
      faqText = extractFaqJsonld($);
      $("script, style, noscript, header, footer, nav").remove();
      bodyText = $("body").text().replace(/\s+/g, " ").trim();
    }
  } catch (e) {
    console.warn(`[autotrain] direct fetch failed for ${url}:`, e);
  }

  let combined = faqText ? (faqText + "\n\n" + bodyText).trim() : bodyText;

  // SPA fallback — thin HTML means a JS shell; try the rendering reader.
  if (combined.trim().length < 200) {
    const rendered = await fetchViaJinaReader(url);
    if (rendered.length > combined.length) combined = rendered;
  }

  return combined.slice(0, limit);
}
