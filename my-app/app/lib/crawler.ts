import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import {
  assertSafeUrl,
  hostnameOf,
  isCrawlableLink,
  normalizeUrl,
  sameOrigin,
  scorePage,
  toAbsoluteUrl,
} from "./url";
import { uid, type Product, type Service, type PricingPlan, type ImageItem, type PageInfo, type FAQ, type SocialLink, type CompanyInfo, type Analytics, type Evidence, type SiteInsight, type SiteAnalysis, type AnalyzeEvent } from "./types";

export interface CrawlHooks {
  emit?: (ev: AnalyzeEvent & { type: "log" | "step" }) => void;
  maxPages?: number;
  searchHint?: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 WebMindIntelligence/1.0";
const MAX_PAGES = 60;
const MAX_IMAGES = 60;
const MAX_PRODUCTS = 1000;

const CURRENCY_HINTS: Array<[RegExp, string]> = [
  [/(?:rs\.?|pkr|₨|rupees?)/i, "Rs."],
  [/₹|inr/i, "₹"],
  [/€|eur/i, "€"],
  [/£|gbp/i, "£"],
  [/¥|cny|jpy|rmb/i, "¥"],
  [/\baed\b/i, "AED "],
  [/\bsar\b/i, "SAR "],
  [/\$|usd/i, "$"],
];

const PRICE_RE =
  /(?:rs\.?|pkr|inr|aed|sar|usd|eur|gbp|jpy|cny|₨|₹|\$|€|£|¥)\s?[\d][\d.,]*|(?<![\w'’])[\d][\d.,]*\s?(?:rs\.?|pkr|inr|usd|eur|gbp|aed|sar)\b/i;

function detectCurrency(s: string): string {
  for (const [re, sym] of CURRENCY_HINTS) {
    if (re.test(s)) return sym;
  }
  return "";
}

function formatAmount(n: number): string {
  return n >= 1000 ? n.toLocaleString("en-US") : String(n);
}

function cleanPrice(match: RegExpMatchArray | string | null | undefined): string | null {
  if (!match) return null;
  const str = typeof match === "string" ? match : match[0] || "";
  const numMatch = str.match(/\d[\d.,]*/);
  if (!numMatch) return null;
  const value = parseFloat(numMatch[0].replace(/,/g, ""));
  if (Number.isNaN(value)) return null;
  const currency = detectCurrency(str);
  if (/\bmo\b|month/i.test(str)) return `${currency}${formatAmount(value)}/mo`;
  if (/\byr\b|year/i.test(str)) return `${currency}${formatAmount(value)}/yr`;
  if (/one-time/i.test(str)) return `${currency}${formatAmount(value)} one-time`;
  return `${currency}${formatAmount(value)}`;
}

function textClean(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 14000,
  redirects = 4
): Promise<{ html: string; finalUrl: string; status: number; error?: never } | { error: string; html?: never; finalUrl?: never; status?: never }> {
  let current = url;
  for (let i = 0; i <= redirects; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en,en-US;q=0.8",
        },
        redirect: "manual",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (loc) {
          const next = toAbsoluteUrl(loc, current);
          if (!next) return { error: "Redirect error" };
          const safe = await assertSafeUrl(next);
          if (!safe.ok) return { error: safe.error || "Redirect to unsafe host" };
          current = next;
          continue;
        }
        return { error: `Unexpected redirect (${res.status})` };
      }
      if (res.status === 403 || res.status === 401) return { error: "This website does not allow automated access (403)." };
      if (res.status === 404) return { error: "Page not found (404)." };
      if (res.status >= 400) return { error: `Website returned HTTP ${res.status}.` };
      const type = res.headers.get("content-type") || "";
      if (!/html|xhtml|text\/plain/i.test(type)) return { error: "Page did not return HTML content." };
      const html = await res.text();
      return { html, finalUrl: current, status: res.status };
    } catch (e: unknown) {
      clearTimeout(timer);
      if ((e as Error).name === "AbortError") return { error: "Connection timed out." };
      const err = e as Error & { code?: string; cause?: { code?: string } };
      const code = (err as any)?.code || err.cause?.code;
      if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { error: "Unable to resolve this domain." };
      if (code === "ECONNREFUSED") return { error: "Connection refused by the website." };
      if (code === "ETIMEDOUT") return { error: "Connection timed out." };
      if (code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || code === "CERT_HAS_EXPIRED") return { error: "The website has an invalid security certificate." };
      return { error: "Unable to access this website." };
    }
  }
  return { error: "Too many redirects." };
}

function parseJsonLd($: CheerioAPI): any[] {
  const out: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() || "";
    try {
      const data = JSON.parse(text) as any;
      if (Array.isArray(data)) out.push(...data);
      else if (data["@graph"]) out.push(...data["@graph"]);
      else out.push(data);
    } catch {
      /* skip malformed ld+json */
    }
  });
  return out;
}

function ldTypes(node: any): string[] {
  const t = node?.["@type"];
  return Array.isArray(t) ? t : t
    ? [t]
    : [];
}

function socialNetwork(href: string): string | null {
  const h = href.toLowerCase();
  if (h.includes("facebook.com")) return "Facebook";
  if (h.includes("twitter.com") || h.includes("x.com")) return "Twitter / X";
  if (h.includes("linkedin.com")) return "LinkedIn";
  if (h.includes("instagram.com")) return "Instagram";
  if (h.includes("youtube.com") || h.includes("youtu.be")) return "YouTube";
  if (h.includes("github.com")) return "GitHub";
  if (h.includes("tiktok.com")) return "TikTok";
  if (h.includes("pinterest.")) return "Pinterest";
  if (h.includes("snapchat.com")) return "Snapchat";
  if (h.includes("whatsapp.com") || h.includes("wa.me")) return "WhatsApp";
  return null;
}

function socialHandle(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean)[0] || "";
    return seg.replace(/^@/, "").replace(/[?#].*$/, "").toLowerCase();
  } catch {
    return "";
  }
}

interface ScrapedPage {
  url: string;
  title: string;
  description?: string;
  headings: string[];
  text: string;
  links: string[];
  meta: Record<string, string>;
  html: string;
  error?: string;
}

function parsePage($: CheerioAPI, url: string): ScrapedPage {
  const meta: Record<string, string> = {};
  $("meta[content]").each((_, el) => {
    const name = ($(el).attr("property") || $(el).attr("name") || "").toLowerCase();
    const content = textClean($(el).attr("content"));
    if (name && content && !(name in meta)) meta[name] = content;
  });

  const title = textClean(meta["og:title"] || meta["twitter:title"] || $("title").first().text()) || url;
  const description = textClean(meta["og:description"] || meta["twitter:description"] || meta["description"] || "") || undefined;

  const headings: string[] = [];
  $("h1, h2").each((_, el) => {
    const t = textClean($(el).text());
    if (t && t.length > 2 && t.length < 160 && !headings.includes(t)) headings.push(t);
  });

  const text = textClean($("main, article, body").first().text().slice(0, 80000));

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const abs = href ? toAbsoluteUrl(href, url) : null;
    if (abs) links.push(abs);
  });

  return { url, title, description, headings, text, links, meta, html: $.html() };
}

function isRobotsBlocked(url: string, blocked: string[]): boolean {
  const path = (url.split("#")[0].split("?")[0] || "/").toLowerCase();
  return blocked.some((b) => {
    const pat = b.replace(/^:/, "").toLowerCase();
    if (!pat) return false;
    if (pat.endsWith("$")) return path === pat.slice(0, -1);
    if (pat.includes("*")) {
      const re = new RegExp("^" + pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
      return re.test(path);
    }
    return path.startsWith(pat);
  });
}

async function crawlPage(id: string, url: string, blocked: string[], hooks: CrawlHooks): Promise<ScrapedPage> {
  const emit = hooks.emit;
  const skip = (err: string): ScrapedPage => ({ url, title: url, headings: [], text: "", links: [], meta: {}, html: "", error: err });

  if (isRobotsBlocked(url, blocked)) {
    if (emit) emit({ type: "step", stepId: id, state: "error", message: "Blocked by robots.txt", detail: url });
    return skip("Blocked by robots.txt");
  }
  if (emit) emit({ type: "step", stepId: id, state: "active", message: "Reading page", detail: url });
  const fetched = await fetchWithTimeout(url);
  if ("error" in fetched) {
    if (emit) emit({ type: "step", stepId: id, state: "error", message: fetched.error, detail: url });
    return skip(fetched.error || "Fetch failed");
  }
  const $ = cheerio.load(fetched.html);
  const page = parsePage($, fetched.finalUrl);
  if (emit) emit({ type: "step", stepId: id, state: "done", message: "Analyzed page", detail: page.title || url });
  return page;
}

const PLACEHOLDER_RE = /blank\.gif|placeholder|spacer|1x1|data:image\/gif/i;
const IMAGE_UI_RE = /logo|favicon|login|sign[-_ ]?in|appointment|book[-_ ]?an|account|profile|avatar|cart|checkout|menu|search|icon|facebook|instagram|twitter|youtube|linkedin/i;
const NON_PRODUCT_NAME_RE = /^(?:book\s+an?\s+appointment|login|log\s+in|sign\s+in|register|create\s+account|my\s+account|wishlist|shopping\s+cart|cart|checkout|search|menu|contact\s+us|subscribe|newsletter|track\s+order|store\s+locator)$/i;

function isProductCandidate(name: string): boolean {
  const clean = textClean(name);
  return clean.length >= 3 && clean.length <= 140 && !NON_PRODUCT_NAME_RE.test(clean);
}

function bestImageFrom($: CheerioAPI, scope: cheerio.Cheerio<any>): string | undefined {
  const img = scope.find("img").first();
  if (!img.length) return undefined;
  const candidates = [
    img.attr("data-src"),
    img.attr("data-original"),
    img.attr("data-lazy"),
    img.attr("data-lazy-src"),
    img.attr("data-image"),
    img.attr("data-srcset"),
    img.attr("srcset"),
    img.attr("src"),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const first = c.split(",")[0].trim().split(/\s+/)[0];
    if (first && !first.startsWith("data:") && !PLACEHOLDER_RE.test(first) && !IMAGE_UI_RE.test(`${first} ${img.attr("alt") || ""}`)) return first;
  }
  return undefined;
}

const SOCIAL_HOST_RE = /(instagram|facebook|youtube|youtu\.be|twitter|x\.com|tiktok|linkedin|pinterest|snapchat|wa\.me|whatsapp)\./i;
const PRODUCT_PATH_RE = /\/(?:products?|item|items|dp|p|shop|catalog|buy|collections?)\/[^/]+/i;

function bestProductLink($: CheerioAPI, scope: cheerio.Cheerio<any>, base: string): string {
  let origin = "";
  try {
    origin = new URL(base).origin;
  } catch {
    origin = "";
  }
  const anchors = scope.find(".pdp-link a[href], a[href]").toArray();
  let fallback = "";
  for (const a of anchors) {
    const abs = toAbsoluteUrl($(a).attr("href") || "", base);
    if (!abs) continue;
    if (SOCIAL_HOST_RE.test(abs)) continue;
    if (origin && !abs.startsWith(origin)) continue;
    const path = abs.split(/[?#]/)[0];
    if (PRODUCT_PATH_RE.test(path) || /\.html?$/i.test(path)) return abs;
    if (!fallback) fallback = abs;
  }
  return fallback || base;
}

function collectProducts($: CheerioAPI, url: string, seen: Set<string>): Product[] {
  const out: Product[] = [];
  const pushProduct = (p: any) => {
    const name = textClean(p.name || p.title);
    if (!isProductCandidate(name)) return;
    if (seen.has(name.toLowerCase())) return;
    let price: string | undefined;
    let currency: string | undefined;
    let availability: string | undefined;
    const offers = Array.isArray(p.offers) ? p.offers : p.offers
      ? [p.offers]
      : [];
    for (const o of offers) {
      if (!o || typeof o !== "object") continue;
      if (o.price != null) price = `${o.price}${o.priceCurrency || o.currency || "$"}`;
      else if (o.lowPrice != null) price = `${o.lowPrice}${o.priceCurrency || ""}+`;
      currency = o.priceCurrency || o.currency;
      const avail = o.availability || o.availabilityStatus;
      if (typeof avail === "string") availability = avail.split(".").pop()?.replace(/([A-Z])/g, " $1").trim().replace(/^ /, "");
    }
    let image: string | undefined;
    const pic = p.image;
    if (Array.isArray(pic)) {
      for (const x of pic) {
        const s = typeof x === "string" ? x : x?.url;
        if (s) {
          image = s;
          break;
        }
      }
    } else if (typeof pic === "string") image = pic;
    else image = pic?.url;

    const rating = p.aggregateRating?.ratingValue;
    const features = Array.isArray(p.featureList) ? p.featureList.filter((f: any) => typeof f === "string").slice(0, 6) : undefined;

    const absImage = image && !IMAGE_UI_RE.test(`${image} ${name}`) ? toAbsoluteUrl(image, url) || undefined : undefined;
    const ldUrl =
      (typeof p.url === "string" && p.url) ||
      (typeof p["@id"] === "string" && p["@id"]) ||
      (Array.isArray(p.offers) ? p.offers.find?.((o: any) => o && typeof o === "object" && o.url)?.url : p.offers?.url) ||
      "";
    const absLdUrl = ldUrl ? toAbsoluteUrl(ldUrl, url) : null;
    out.push({
      id: uid(),
      name,
      category: textClean(p.category || p.categoryName || undefined) || undefined,
      price,
      currency,
      image: absImage,
      description: textClean(p.description || undefined).slice(0, 500) || undefined,
      features,
      rating: rating != null ? parseFloat(rating) : undefined,
      availability,
      sourceUrl: absLdUrl && !SOCIAL_HOST_RE.test(absLdUrl) ? absLdUrl : url,
    });
    seen.add(name.toLowerCase());
  };

  const TILE_SEL =
    ".product-tile, .product-card, [data-pid], [class*='product-item'], [class*='product_item'], [class*='product-cell'], [class*='productCard'], [class*='grid-product'], [class*='collection-item'], [class*='productTile']";
  $(TILE_SEL).each((_, el) => {
    if (out.length > MAX_PRODUCTS) return;
    const scope = $(el);
    const nameEl = scope
      .find(".pdp-link a, [class*='product-name'], [class*='product-title'], [class*='productName'], [class*='card-title'], [class*='title'], h2, h3, h4, a[href]")
      .filter((__, n) => {
        const t = textClean($(n).text());
        return t.length >= 3 && t.length <= 140;
      })
      .first();
    const name = textClean(nameEl.text() || scope.find("a[href]").first().text());
    if (!isProductCandidate(name)) return;
    if (seen.has(name.toLowerCase())) return;
    const scopeText = textClean(scope.text()).slice(0, 400);
    const priceScope = scope.find(".price, [class*='price'], [itemprop='price']").first();
    const priceAttr = priceScope.attr("content") || priceScope.find("[content]").first().attr("content") || "";
    const priceText = textClean(priceAttr || priceScope.text());
    const pm = priceText.match(PRICE_RE) || scopeText.match(PRICE_RE);
    const img = bestImageFrom($, scope);
    const absImg = img ? toAbsoluteUrl(img, url) || undefined : undefined;
    if (!pm && !absImg) return;
    out.push({
      id: uid(),
      name,
      price: pm ? cleanPrice(pm) || undefined : undefined,
      image: absImg,
      sourceUrl: bestProductLink($, scope, url),
    });
    seen.add(name.toLowerCase());
  });

  for (const data of parseJsonLd($)) {
    if (!data || typeof data !== "object") continue;
    const types = ldTypes(data);
    if (types.includes("Product")) {
      pushProduct(data);
    } else if (types.includes("ItemList") && data.itemListElement) {
      for (const item of data.itemListElement) {
        if (item && typeof item === "object") {
          if (ldTypes(item).includes("Product")) pushProduct(item);
          else if (item.image || item.name || item.price) pushProduct(item);
        }
      }
    }
  }

  $("a[href]").each((_, el) => {
    if (out.length > MAX_PRODUCTS) return;
    const href = $(el).attr("href") || "";
    const abs = toAbsoluteUrl(href, url);
    if (!abs) return;
    const p = abs.split("#")[0];
    if (!/(product|products|shop|item|collection|catalog|buy|p-)/i.test(p)) return;
    const container = $(el).closest("article, li, .product, [class*='product'], [class*='card']");
    const scope = container.length ? container.first() : $(el).parent();
    const scopeText = scope.text();
    const pm = scopeText.match(PRICE_RE);
    if (!pm) return;
    const headingEl = scope.find("h2, h3, h4, [class*='title'], [class*='name']").first();
    const name = textClean(headingEl.text() || $(el).text());
    if (!isProductCandidate(name)) return;
    if (seen.has(name.toLowerCase())) return;
    const img = bestImageFrom($, scope);
    out.push({
      id: uid(),
      name,
      price: cleanPrice(pm) || undefined,
      image: img ? toAbsoluteUrl(img, url) || undefined : undefined,
      sourceUrl: abs,
    });
    seen.add(name.toLowerCase());
  });

  const unique = new Map<string, Product>();
  for (const p of out) unique.set(`${p.name}|${p.price || ""}`, p);
  return [...unique.values()];
}

function collectImages($: CheerioAPI, url: string, limit = 40): ImageItem[] {
  const out: ImageItem[] = [];
  const push = (src: string, alt?: string) => {
    const abs = toAbsoluteUrl(src, url);
    if (!abs) return;
    if (abs.startsWith("data:")) return;
    const lower = abs.toLowerCase();
    if (/\.svg|favicon|\.ico(\?|$)/.test(lower)) return;
    if (IMAGE_UI_RE.test(`${lower} ${alt || ""}`)) return;
    if (out.some((x) => x.src === abs)) return;
    if (out.length >= limit) return;
    out.push({ id: uid(), src: abs, alt: textClean(alt) || undefined, pageUrl: url });
  };
  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, el) => push($(el).attr("content") || ""));
  $("img").each((_, el) => {
    const lazy = $(el).attr("data-src") || $(el).attr("data-original") || $(el).attr("data-lazy") || $(el).attr("data-lazy-src") || $(el).attr("data-image");
    let src = $(el).attr("src") || "";
    if (!src || src.startsWith("data:") || PLACEHOLDER_RE.test(src)) src = lazy || "";
    if (!src) {
      const set = $(el).attr("data-srcset") || $(el).attr("srcset");
      if (set) src = set.split(",")[0].trim().split(/\s+/)[0] || "";
    }
    const w = parseInt($(el).attr("width") || "0", 10);
    const h = parseInt($(el).attr("height") || "0", 10);
    const alt = $(el).attr("alt") || "";
    if (!src) return;
    if (alt.trim().length < 3 && w === 0 && h === 0) return;
    if (alt.trim().length >= 3) {
      push(src, alt);
    } else if (w >= 100 || h >= 100) {
      push(src, alt);
    }
  });
  return out;
}

function collectFaqs($: CheerioAPI, url: string): FAQ[] {
  const out: FAQ[] = [];
  for (const data of parseJsonLd($)) {
    if (!data || typeof data !== "object") continue;
    if (ldTypes(data).includes("FAQPage") && data.mainEntity) {
      for (const q of data.mainEntity) {
        if (!q || typeof q !== "object") continue;
        const question = textClean(q.name || q.question);
        const answerRaw = q.acceptedAnswer;
        const answer = textClean(typeof answerRaw === "object" ? answerRaw?.text : answerRaw);
        if (question && answer) out.push({ question, answer, sourceUrl: url });
      }
    }
  }
  $("details summary").each((_, el) => {
    const question = textClean($(el).text());
    const answer = textClean($(el).parent().find("p").first().text());
    if (question && answer) out.push({ question, answer, sourceUrl: url });
  });
  return out;
}

function collectPricing($: CheerioAPI, url: string): PricingPlan[] {
  const out: PricingPlan[] = [];
  $("h2, h3, h4").each((_, el) => {
    const name = textClean($(el).text());
    if (!name || name.length > 60) return;
    const scope = $(el).parent();
    const t = textClean(scope.text());
    const pm = t.match(PRICE_RE);
    if (!pm) return;
    const price = cleanPrice(pm);
    if (!price) return;
    const features = scope
      .find("li, [class*='feature']")
      .slice(0, 8)
      .map((_, li) => {
        const tt = textClean($(li).text());
        return tt.replace(/^[•\-—\s]+/, "").slice(0, 90);
      })
      .get()
      .filter((x) => x && x.length > 1);
    const period = /annually|per year|\/yr/i.test(t) ? "annual" : /monthly|per month|\/mo/i.test(t) ? "monthly" : undefined;
    out.push({ id: uid(), name, price, period, features: features.length ? features.slice(0, 8) : undefined, sourceUrl: url });
  });

  for (const data of parseJsonLd($)) {
    if (!data || typeof data !== "object") continue;
    const offers = Array.isArray(data.offers) ? data.offers : data.offers
      ? [data.offers]
      : [];
    if (!offers.length) continue;
    for (const o of offers) {
      if (!o || typeof o !== "object" || o.price == null) continue;
      out.push({
        id: uid(),
        name: textClean(o.name || data.name || "Pricing"),
        price: `${o.price}${o.priceCurrency || ""}`,
        period: undefined,
        features: undefined,
        sourceUrl: url,
      });
    }
  }

  const unique = new Map<string, PricingPlan>();
  for (const p of out) unique.set(`${p.name}|${p.price}`, p);
  return [...unique.values()].slice(0, 30);
}

function detectTechnologies(html: string): string[] {
  const tech: string[] = [];
  const lower = html.toLowerCase();
  const add = (name: string, needle: string) => {
    if (lower.includes(needle)) tech.push(name);
  };
  const gen = lower.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)/i);
  if (gen) tech.push(textClean(gen[1]));
  add("Next.js", "/_next/static");
  add("Nuxt", "_nuxt");
  add("Vite", "data-vite");
  add("Shopify", "cdn.shopify.com");
  add("WooCommerce", "woocommerce");
  add("WordPress", "wp-content");
  add("Wix", "wixstatic.com");
  add("Squarespace", "static.squarespace.com");
  add("Webflow", "webflow");
  add("Drupal", "drupal");
  add("Magento", "magento");
  add("React", "react-dom");
  add("Vue", "vue.runtime");
  add("Google Analytics", "googletagmanager.com/gtag");
  add("Hotjar", "static.hotjar.com");
  add("Intercom", "widget.intercom.io");
  add("Cloudflare", "cloudflare");
  add("Stripe", "js.stripe.com");
  return [...new Set(tech)].slice(0, 16);
}

async function fetchRobots(url: string): Promise<string[]> {
  const blocked: string[] = [];
  try {
    let inWildcard = false;
    const res = await fetch(`${new URL(url).origin}/robots.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = await res.text();
      for (const raw of body.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.toLowerCase().startsWith("user-agent:")) {
          inWildcard = /(^|\s)\*\s*$/.test(line.split(":")[1]?.trim() || "");
        } else if (line.toLowerCase().startsWith("disallow:")) {
          const path = line.split(":")[1]?.trim() || "";
          if (inWildcard && path) blocked.push(path);
        } else if (line && !line.includes(":")) {
          inWildcard = false;
        }
      }
    }
  } catch {
    /* best effort */
  }
  return blocked;
}

interface InsightInput {
  domain: string;
  company: CompanyInfo;
  homepageText: string;
  aboutText: string;
  products: Product[];
  services: Service[];
  pricing: PricingPlan[];
  faqs: FAQ[];
  headings: string[];
  technologies: string[];
}

function buildInsights(site: InsightInput): SiteInsight[] {
  const ev = (label: string, value: string, sourceUrl: string, sourcePage?: string): Evidence => ({ label, value, sourceUrl, sourcePage });
  const insights: SiteInsight[] = [];
  const d = site.company.description || "";
  const t = site.homepageText;
  const a = site.aboutText;

  insights.push({
    title: "Business Summary",
    summary: [
      site.company.name ? `${site.company.name} operates ${site.domain}.` : `${site.domain} was analyzed.`,
      d ? d.slice(0, 260) : "No clear company description was found on the analyzed pages.",
    ].join(" "),
    evidence: [
      ...(site.company.name ? [ev("Company", site.company.name, site.company.website)] : []),
      ...(d ? [ev("Description", d.slice(0, 140), site.company.website, "Homepage")] : []),
    ],
  });

  const rawAudience = (t + " " + a).match(/for\s+([a-z][a-z0-9 ,'&()-]{3,80})/gi) || [];
  const known = ["teams", "business", "businesses", "enterprises", "enterprise", "developers", "agencies", "startups", "students", "creators", "retailer", "retailers", "small business", "individuals", "families", "schools", "institutions", "financial", "healthcare", "e-commerce", "ecommerce", "marketers", "sales teams", "companies"];
  const audience: string[] = [];
  for (const s of rawAudience) {
    const lower = s.toLowerCase();
    for (const k of known) {
      if (lower.includes(k)) {
        const phrase = lower.replace(/^for\s+/, "").trim();
        if (!audience.includes(phrase)) audience.push(phrase);
        break;
      }
    }
    if (audience.length >= 6) break;
  }

  insights.push({
    title: "Target Audience",
    summary: audience.length
      ? `Content signals suggest the site targets: ${audience.slice(0, 5).join(", ")}. This is inferred from website copy.`
      : "No clear target audience signals were found in the copy. Consider a competitor comparison for more context.",
    evidence: audience.slice(0, 5).map((x) => ev("Audience signal", x[0].toUpperCase() + x.slice(1), site.company.website, "Homepage / About")),
  });

  insights.push({
    title: "Products & Services",
    summary: `${site.products.length} product${site.products.length === 1 ? "" : "s"} and ${site.services.length} service${site.services.length === 1 ? "" : "s"} were extracted from the site.`,
    evidence: [
      ...site.products.slice(0, 3).map((p) => ev("Product", `${p.name}${p.price ? ` — ${p.price}` : ""}`, p.sourceUrl, p.sourceUrl.split("/").filter(Boolean).slice(-1)[0])),
      ...site.services.slice(0, 3).map((s) => ev("Service", s.name, s.sourceUrl)),
    ],
  });

  const plans = site.pricing;
  insights.push({
    title: "Pricing Strategy",
    summary: plans.length
      ? `${plans.length} public pricing option${plans.length === 1 ? "" : "s"} found: ${plans.map((p) => `${p.name} (${p.price || "list price"})`).slice(0, 3).join(", ")}${plans.length > 3 ? "…" : ""}.`
      : "Pricing is not published on the site, or could not be extracted from the pages analyzed.",
    evidence: plans.slice(0, 3).map((p) => ev("Plan", `${p.name} — ${p.price || "n/a"}`, p.sourceUrl)),
  });

  const competitorMentions = (t + " " + a).match(/(?:alternative to|instead of|vs\.?|compared to)\s+([A-Z][A-Za-z0-9]{1,30})/g) || [];
  const competitors = [...new Set(competitorMentions.map((m) => m.replace(/^(alternative to|instead of|vs\.?|compared to)\s+/i, "").split(/[^A-Za-z0-9]/).slice(0, 2).join(" ")))].filter(Boolean).slice(0, 5);
  insights.push({
    title: "Competitor Signals",
    summary: competitors.length
      ? `The site itself mentions or compares against: ${competitors.join(", ")}.`
      : "The site does not name competitors openly. Use the Compare tab to run a competitor analysis.",
    evidence: competitors.map((c) => ev("Competitor mentioned", c, site.company.website, "Homepage / About")),
  });

  insights.push({
    title: "Content & SEO Observations",
    summary: [
      `Pages analyzed: ${site.technologies.length ? "stack: " + site.technologies.join(", ") + "." : "Stack not detected."}`,
      `${site.faqs.length} FAQ item${site.faqs.length === 1 ? "" : "s"} found`, `${site.headings.length} content headings surfaced.`,
    ].join(" "),
    evidence: [
      ...site.technologies.slice(0, 6).map((x) => ev("Technology detected", x, site.company.website)),
      ...site.faqs.slice(0, 2).map((f) => ev("FAQ", f.question.slice(0, 110), f.sourceUrl)),
    ],
  });

  insights.push({
    title: "Business Opportunities",
    summary: site.products.length
      ? `The catalog has ${site.products.length} products you can study or re-market. ${site.faqs.length ? `The ${site.faqs.length} FAQ answers are ready-made material for buyer questions.` : ""}`
      : "The site is indexed and ready for follow-up: run the Compare view against a competitor to spot gaps.",
    evidence: [],
  });

  insights.push({
    title: "Questions to Investigate",
    summary: site.pricing.length
      ? "Check whether listed prices include taxes, setup or minimum contracts. Look for details hidden behind signup."
      : "Pricing is not public — a sales call or secondary source is needed to understand cost structure.",
    evidence: [],
  });

  return insights;
}

async function runPool<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

export async function analyzeSite(input: string, hooks: CrawlHooks = {}): Promise<SiteAnalysis> {
  const emit = hooks.emit;
  const emitLog = (message: string, stepId?: string) => {
    if (emit) emit({ type: "log", message, ...(stepId ? { stepId } : {}) });
  };

  emitLog("Connecting to website…");
  const normalized = normalizeUrl(input);
  if (normalized.error) throw new Error(normalized.error);
  const safe = await assertSafeUrl(normalized.url);
  if (!safe.ok) throw new Error(safe.error || "Unable to access this website.");
  const origin = new URL(normalized.url).origin;
  const domain = hostnameOf(normalized.url);

  emitLog("Checking robots.txt…");
  const blocked = await fetchRobots(normalized.url);

  emitLog(`Browsing ${domain}…`);
  const pages = new Map<string, ScrapedPage>();
  const homepage = await crawlPage("homepage", normalized.url, blocked, hooks);
  pages.set("home", homepage);

  const homepageHtml = homepage.error ? "<html></html>" : homepage.html;
  const home$ = cheerio.load(homepageHtml);

  emitLog("Discovering important pages…", "discover");
  const discovered = new Map<string, number>();
  for (const link of homepage.links) {
    const abs = toAbsoluteUrl(link, normalized.url);
    if (!abs) continue;
    if (!sameOrigin(abs, origin)) continue;
    if (!isCrawlableLink(abs)) continue;
    const p = abs.split("#")[0];
    const s = scorePage(p);
    if (p === origin || p === origin + "/") continue;
    if (!discovered.has(p) || s > (discovered.get(p) as number)) discovered.set(p, s);
  }

  const sorted = [...discovered.entries()]
    .sort((a, b) => {
      const aProduct = PRODUCT_PATH_RE.test(a[0].split(/[?#]/)[0]) ? 1 : 0;
      const bProduct = PRODUCT_PATH_RE.test(b[0].split(/[?#]/)[0]) ? 1 : 0;
      return bProduct - aProduct || b[1] - a[1];
    })
    .map(([u]) => u);
  const targets = sorted.slice(0, Math.max(0, Math.min(hooks.maxPages || MAX_PAGES, MAX_PAGES) - pages.size));

  const searchHint = hooks.searchHint?.trim();
  if (searchHint) {
    const enc = encodeURIComponent(searchHint);
    const searchCandidates = [
      `${origin}/search?q=${enc}`,
      `${origin}/search/?q=${enc}`,
      `${origin}/catalog/?q=${enc}`,
      `${origin}/search?keyword=${enc}`,
      `${origin}/?s=${enc}`,
    ];
    for (const su of searchCandidates) {
      if (pages.size >= (hooks.maxPages || MAX_PAGES)) break;
      if (isRobotsBlocked(su, blocked) || !isCrawlableLink(su)) continue;
      if ([...pages.values()].some((p) => p.url === su)) continue;
      emitLog("Also searching the catalog for the item you described…", "products");
      const page = await crawlPage("search", su, blocked, hooks);
      pages.set("search", page);
      if (!page.error && page.html) break;
    }
  }

  await runPool(targets, 3, async (target) => {
    if (pages.size >= (hooks.maxPages || MAX_PAGES)) return;
    const key = `page${pages.size}`;
    const page = await crawlPage(key, target, blocked, hooks);
    pages.set(key, page);
  });

  const okPages = [...pages.values()].filter((p) => !p.error);
  if (okPages.length === 0) {
    const firstError = [...pages.values()].find((p) => p.error)?.error;
    throw new Error(firstError || "Unable to access this website.");
  }

  emitLog("Extracting structured data…", "extract");

  const homepagePage = okPages.find((p) => p.url === normalized.url || p.url === origin || p.url === origin + "/") || pages.get("home") || okPages[0];
  const homepageText = homepagePage.text || "";
  const siteName = textClean(home$('meta[property="og:site_name"]').attr("content") || home$('meta[name="application-name"]').attr("content") || homepagePage.title.split("|")[0].split("–")[0].trim());

  const brandTokens = new Set(
    [siteName, domain.split(".")[0]]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
  const brandCandidates = new Map<string, { network: string; url: string; score: number }>();
  const addSocial = (abs: string, base: number) => {
    const n = socialNetwork(abs);
    if (!n) return;
    const handle = socialHandle(abs);
    let score = base;
    if (handle) {
      for (const t of brandTokens) {
        if (t && (handle.includes(t) || t.includes(handle))) {
          score += 100;
          break;
        }
      }
    }
    const existing = brandCandidates.get(n);
    if (!existing || score > existing.score) brandCandidates.set(n, { network: n, url: abs, score });
  };

  for (const data of parseJsonLd(home$)) {
    if (!data || typeof data !== "object") continue;
    const sameAs = (data as { sameAs?: unknown }).sameAs;
    const arr = Array.isArray(sameAs) ? sameAs : sameAs ? [sameAs] : [];
    for (const s of arr) if (typeof s === "string") addSocial(s, 60);
  }
  home$("footer a[href], [class*='social'] a[href], [class*='footer'] a[href], [id*='social'] a[href], [class*='follow'] a[href]").each((_, el) => {
    const abs = toAbsoluteUrl(home$(el).attr("href") || "", normalized.url);
    if (abs) addSocial(abs, 40);
  });
  home$("a[href]").each((_, el) => {
    const abs = toAbsoluteUrl(home$(el).attr("href") || "", normalized.url);
    if (abs) addSocial(abs, 5);
  });
  const socials: SocialLink[] = [...brandCandidates.values()]
    .sort((a, b) => b.score - a.score)
    .map((c) => ({ network: c.network, url: c.url }))
    .slice(0, 10);

  const ogImage = textClean(home$('meta[property="og:image"]').attr("content"));
  const logo = ogImage ? toAbsoluteUrl(ogImage, normalized.url) || undefined : undefined;

  const allText = okPages.map((p) => p.text).join(" ");
  const aboutPage = okPages.find((p) => /\/about/i.test(p.url) || /\babout\b/i.test(p.title)) || okPages[0] || homepagePage;

  const foundedM = allText.match(/(?:founded|established|started|launched|since)[^.]{0,40}?(19|20)\d{2}/i);
  const hqM = allText.match(/(?:headquartered|headquarters|based)\s+in\s+([A-Z][A-Za-z .'-]{2,50})/i);
  const emailEl = home$('a[href^="mailto:"]').first().attr("href");
  const phoneEl = home$('a[href^="tel:"]').first().attr("href");
  const businessModelM = allText.match(/business model[:\s]+([^.\n]{3,140})/i);
  const industryM = homepageText.match(/industry[:\s]+([A-Z][A-Za-z &,-]{2,50})/i);
  const contactAddress = okPages.find((p) => /\/contact/i.test(p.url));
  const addressM = contactAddress?.text.match(/[A-Z0-9][^\n]{3,80},\s*[A-Z][A-Za-z -]+,\s*[A-Z]{2}\s?\d{4,6}/);

  const company: CompanyInfo = {
    name: siteName || homepagePage.title,
    website: origin,
    domain,
    description: homepagePage.description,
    logo,
    industry: industryM ? textClean(industryM[1]) : undefined,
    founded: foundedM ? foundedM[1] || foundedM[2] : undefined,
    headquarters: hqM ? textClean(hqM[1]) : undefined,
    email: emailEl ? emailEl.replace("mailto:", "") : undefined,
    phone: phoneEl ? phoneEl.replace("tel:", "") : undefined,
    address: addressM ? textClean(addressM[0]) : undefined,
    businessModel: businessModelM ? textClean(businessModelM[1]) : undefined,
    socials,
  };

  emitLog("Analyzing products…", "products");

  const rawProducts: Product[] = [];
  const seenProducts = new Set<string>();
  for (const p of okPages) {
    const $ = cheerio.load(p.html);
    rawProducts.push(...collectProducts($, p.url, seenProducts));
  }
  const products: Product[] = [];
  const productByKey = new Map<string, Product>();
  for (const p of rawProducts) {
    const key = `${p.name.toLowerCase()}|${p.price || ""}`;
    if (productByKey.has(key)) continue;
    productByKey.set(key, p);
    products.push(p);
    if (products.length >= MAX_PRODUCTS) break;
  }

  emitLog("Understanding services…", "services");
  const services: Service[] = [];
  const serviceSeen = new Set<string>();
  const servicePages = okPages.filter((p) => /\/service|\/solutions|\/what-we-do|\/expertise/i.test(p.url) || /\bservices?\b/i.test(p.title));
  const pushService = (s: Service) => {
    const key = s.name.toLowerCase();
    if (serviceSeen.has(key)) return;
    serviceSeen.add(key);
    services.push(s);
  };
  for (const p of servicePages) {
    for (const h of p.headings) {
      if (h.length < 3 || h.length > 90) continue;
      pushService({ id: uid(), name: h, sourceUrl: p.url });
    }
  }
  for (const p of servicePages) {
    const $ = cheerio.load(p.html);
    for (const data of parseJsonLd($)) {
      if (!data || typeof data !== "object") continue;
      if (ldTypes(data).includes("Service") && data.name) {
        pushService({ id: uid(), name: textClean(data.name), description: textClean(data.description || undefined), sourceUrl: p.url });
      }
    }
  }
  if (services.length === 0) {
    const nounHeadings = new Set(okPages.flatMap((p) => p.headings));
    for (const h of [...nounHeadings].filter((x) => /(consult|service|solution|support|develop|design|manage|market|platform|agency)/i.test(x)).slice(0, 12)) {
      pushService({ id: uid(), name: h, sourceUrl: aboutPage.url });
    }
  }

  emitLog("Extracting pricing…", "pricing");
  const pricing: PricingPlan[] = [];
  const pricingPages = okPages.filter((p) => /\/pricing|\/plans|\/price/i.test(p.url) || /\bpricing\b|\bplans\b/i.test(p.title));
  for (const p of pricingPages.length ? pricingPages : [aboutPage]) {
    const $ = cheerio.load(p.html);
    for (const plan of collectPricing($, p.url)) pricing.push(plan);
  }
  if (pricing.length === 0) {
    for (const p of products) {
      if (p.price) pricing.push({ id: uid(), name: p.name, price: p.price, sourceUrl: p.sourceUrl });
    }
  }
  const pricingSeen = new Set<string>();
  const pricingDedup = pricing.filter((x) => {
    const k = `${x.name}|${x.price}`;
    if (pricingSeen.has(k)) return false;
    pricingSeen.add(k);
    return true;
  }).slice(0, 30);

  emitLog("Collecting images…", "images");
  const imageMap = new Map<string, ImageItem>();
  for (const p of okPages) {
    const $ = cheerio.load(p.html);
    for (const img of collectImages($, p.url)) {
      if (!imageMap.has(img.src)) imageMap.set(img.src, img);
      if (imageMap.size >= MAX_IMAGES) break;
    }
  }
  const images = [...imageMap.values()].slice(0, MAX_IMAGES);

  emitLog("Analyzing FAQs…", "extract");
  const faqs: FAQ[] = [];
  const faqSeen = new Set<string>();
  for (const p of okPages) {
    const $ = cheerio.load(p.html);
    for (const f of collectFaqs($, p.url)) {
      const k = f.question.toLowerCase();
      if (faqSeen.has(k)) continue;
      faqSeen.add(k);
      faqs.push(f);
      if (faqs.length >= 20) break;
    }
    if (faqs.length >= 20) break;
  }

  emitLog("Analyzing content & metadata…", "analytics");
  const technologies: string[] = [];
  const headings: string[] = [];
  let internalLinks = 0;
  let externalLinks = 0;
  const missingMeta: string[] = [];
  let hasViewport = false;

  for (const p of okPages) {
    internalLinks += new Set(p.links.filter((l) => sameOrigin(l, origin))).size;
    externalLinks += new Set(p.links.filter((l) => !sameOrigin(l, origin))).size;
    for (const h of p.headings) {
      if (!headings.includes(h)) headings.push(h);
    }
    const $ = cheerio.load(p.html);
    if ($("meta[name='viewport']").length) hasViewport = true;
    if (!/[/\\]?[.]?[a-z0-9-]+\.(png|jpg|pdf|zip)/i.test(p.url)) {
      if (!p.title || p.title.length < 3) missingMeta.push(`${p.url} has no readable title`);
      if (!p.description) missingMeta.push(`${p.url} has no meta description`);
    }
    for (const t of detectTechnologies(p.html)) technologies.push(t);
  }
  if (!hasViewport) missingMeta.push("No viewport meta tag found on the site");

  const analytics: Analytics = {
    title: homepagePage.title,
    description: homepagePage.description,
    keywords: homepagePage.meta["keywords"] ? homepagePage.meta["keywords"].split(",").map((k) => k.trim()).filter(Boolean).slice(0, 15) : undefined,
    headings: headings.slice(0, 40),
    technologies: [...new Set(technologies)],
    internalLinks,
    externalLinks,
    missingMeta: missingMeta.slice(0, 8),
    pagesAnalyzed: okPages.length,
    productCount: products.length,
    serviceCount: services.length,
    imageCount: images.length,
    pricingCount: pricingDedup.length,
  };

  emitLog("Building website intelligence…", "insights");

  const insights = buildInsights({
    domain,
    company,
    homepageText: homepageText.slice(0, 12000),
    aboutText: aboutPage.text.slice(0, 6000),
    products,
    services: services.slice(0, 40),
    pricing: pricingDedup,
    faqs,
    headings,
    technologies: analytics.technologies,
  });

  const pagesInfo: PageInfo[] = await (async () => {
    const list: PageInfo[] = [];
    for (const p of [...pages.entries()] as Array<[string, ScrapedPage]>) {
      const [, page] = p;
      let imagesCount = 0;
      if (!page.error) {
        const $ = cheerio.load(page.html);
        imagesCount = $("img").length;
      }
      list.push({
        url: page.url,
        title: page.title,
        description: page.description,
        headings: page.headings.slice(0, 10),
        linksCount: page.links.length,
        imagesCount,
        accessed: !page.error,
        error: page.error,
      });
    }
    return list;
  })();

  const failed = pagesInfo.filter((p) => !p.accessed);
  const warnings: string[] = [];
  if (failed.length) {
    warnings.push(`Some pages could not be accessed (${failed.map((f) => new URL(f.url).pathname || "/").slice(0, 3).join(", ")}). Results are based on successfully analyzed pages.`);
  }
  if (blocked.length) warnings.push("Respected robots.txt exclusions from this site.");
  if (products.length === 0) warnings.push("No products could be extracted. The site may not publish a product catalog in accessible form.");

  const result: SiteAnalysis = {
    status: failed.length ? "partial" : "complete",
    analyzedAt: new Date().toISOString(),
    origin,
    domain,
    company,
    pages: pagesInfo,
    products: products.slice(0, MAX_PRODUCTS),
    services: services.slice(0, 40),
    pricing: pricingDedup,
    images,
    faqs,
    analytics,
    insights,
    warnings,
    isPartial: failed.length > 0,
  };

  emitLog("Analysis complete.", "complete");
  return result;
}