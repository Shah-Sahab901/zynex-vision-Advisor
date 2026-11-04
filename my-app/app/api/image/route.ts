import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function imageHeaders(referrer: string | undefined) {
  return {
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    Referer: referrer || "https://www.google.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  };
}

async function getImage(url: URL, referrer?: string) {
  const response = await fetch(url, {
    headers: imageHeaders(referrer),
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") || "";
  return response.ok && contentType.startsWith("image/") ? response : null;
}

async function discoverPageImages(pageUrl: string): Promise<string[]> {
  try {
    const response = await fetch(pageUrl, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": imageHeaders(pageUrl)["User-Agent"] },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const urls: string[] = [];
    $("meta[property='og:image'], meta[name='twitter:image'], img").each((_, element) => {
      const raw = $(element).attr("content") || $(element).attr("data-src") || $(element).attr("data-original") || $(element).attr("src");
      if (!raw || raw.startsWith("data:")) return;
      try {
        const absolute = new URL(raw, pageUrl).toString();
        if (!/\.svg|favicon|\.ico(\?|$)/i.test(absolute) && !urls.includes(absolute)) urls.push(absolute);
      } catch {
        // Ignore malformed image candidates.
      }
    });
    return urls.slice(0, 12);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  const referrer = request.nextUrl.searchParams.get("ref") || undefined;
  if (!raw) return new NextResponse("Missing image URL", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Invalid image URL", { status: 400 });
  }

  if (!/^https?:$/.test(target.protocol) || BLOCKED_HOSTS.has(target.hostname.toLowerCase())) {
    return new NextResponse("Unsupported image host", { status: 400 });
  }

  try {
    let upstream = await getImage(target, referrer || `${target.origin}/`);
    if (!upstream && referrer) {
      const candidates = await discoverPageImages(referrer);
      for (const candidate of candidates) {
        const candidateUrl = new URL(candidate);
        upstream = await getImage(candidateUrl, referrer);
        if (upstream) break;
      }
    }
    if (!upstream) return new NextResponse("Image unavailable", { status: 404 });

    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Unable to fetch image", { status: 502 });
  }
}
