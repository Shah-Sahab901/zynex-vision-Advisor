import { lookup } from "node:dns/promises";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /^\[?::1\]?$/i,
  /^0\.0\.0\.0$/,
];

function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "");
  if (clean === "::1" || clean.toLowerCase().startsWith("fe80") || clean === "::") {
    return true;
  }
  const parts = clean.split(".");
  if (parts.length !== 4) return false;
  const [a, b] = parts.map((p) => parseInt(p, 10));
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function normalizeUrl(input: string): { url: string; error?: string } {
  let raw = (input || "").trim();
  if (!raw) return { url: "", error: "Please enter a website URL." };
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: "", error: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url: "", error: "Only http and https websites are supported." };
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { url: "", error: "Please enter a full domain, e.g. example.com" };
  }
  if (parsed.username || parsed.password) {
    return { url: "", error: "URLs with credentials are not allowed." };
  }
  return { url: parsed.hostname !== "www." ? parsed.toString() : parsed.toString() };
}

export async function assertSafeUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) {
    return { ok: false, error: "This website is not publicly reachable." };
  }
  if (host === "10.0.0.0") return { ok: false, error: "This website is not publicly reachable." };

  try {
    let ips: Array<{ address: string }>;
    try {
      ips = await lookup(host, { all: true });
    } catch {
      await new Promise((r) => setTimeout(r, 700));
      ips = await lookup(host, { all: true });
    }
    for (const entry of ips) {
      if (isPrivateIp(entry.address)) {
        return { ok: false, error: "This website is not publicly reachable." };
      }
    }
  } catch {
    return { ok: false, error: "We couldn't resolve this domain." };
  }
  return { ok: true };
}

export function toAbsoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function sameOrigin(a: string | URL, b: string | URL): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

const BLOCKED_EXT =
  /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif|pdf|zip|rar|7z|gz|tar|mp3|mp4|webm|avi|mov|docx?|xlsx?|pptx?|css|js|json|xml|woff2?|ttf|eot|txt)(\?|#|$)/i;

const SKIP_PATH =
  /(^|\/)(login|signin|sign-up|signup|logout|cart|checkout|register|download|captcha|account|auth|privacy-policy|terms-of-service|terms|newsletter|subscribe)([/?#]|$)/i;

export function isCrawlableLink(url: string): boolean {
  if (BLOCKED_EXT.test(url)) return false;
  const path = url.split("#")[0].split("?")[0].toLowerCase();
  if (SKIP_PATH.test(path)) return false;
  return true;
}

export function scorePage(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  const keywords: Array<[RegExp, number]> = [
    [/\/about/, 20],
    [/\/products/, 20],
    [/\/product\//, 12],
    [/\/service/, 18],
    [/(\/|^)solutions/, 14],
    [/\/pricing/, 20],
    [/\/contact/, 12],
    [/(\/|^)faq/, 16],
    [/\/help/, 10],
    [/\/blog/, 8],
    [/\/news/, 8],
    [/\/careers/, 8],
    [/\/team/, 8],
    [/\/features/, 10],
    [/\/portfolio/, 8],
    [/\/work/, 6],
    [/\/how-it-works/, 10],
    [/\/shop/, 16],
    [/(\/|^)store/, 12],
    [/\/collection/, 14],
    [/\/category/, 10],
    [/\/item\//, 10],
  ];
  for (const [re, s] of keywords) {
    if (re.test(lower)) score += s;
  }
  if (lower.split("/").length === 2) score += 4;
  return score;
}