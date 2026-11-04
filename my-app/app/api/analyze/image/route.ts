import { NextResponse, type NextRequest } from "next/server";
import { analyzeSite } from "@/app/lib/crawler";
import { assertSafeUrl, normalizeUrl } from "@/app/lib/url";
import { uid, type AnalyzeEvent, type ImageIntelligence, type ImageMatch, type Product, type SiteAnalysis } from "@/app/lib/types";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i;

const STOP_TOKENS = new Set([
  "product", "products", "image", "images", "photo", "photos", "picture", "pictures", "img",
  "file", "files", "upload", "uploads", "uploaded", "shop", "shopify", "sale", "new", "best",
  "jpeg", "jpg", "png", "webp", "gif", "avif", "svg", "icon", "thumb", "thumbnail", "medium",
  "large", "small", "original", "main", "hero", "heroimg", "banner", "logo",
]);

function normImageUrl(value: string): string {
  try {
    const p = new URL(value);
    p.hash = "";
    p.search = "";
    p.hostname = p.hostname.replace(/^www\./i, "");
    p.protocol = "http:";
    return p.toString().replace(/\/+$/, "");
  } catch {
    return value;
  }
}

function tokensOf(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && t.length <= 24 && !/^\d+$/.test(t) && !STOP_TOKENS.has(t));
}

function matchImageToSite(image: ImageIntelligence, site: SiteAnalysis): ImageMatch | null {
  const imgNorm = normImageUrl(image.src);
  const imgTokens = tokensOf(image.name);
  const hintTokens = tokensOf(image.label || "");
  let best: { product: Product; score: number; reasons: string[] } | null = null;

  for (const p of site.products) {
    let score = 0;
    const reasons: string[] = [];

    const productTokens = p.image ? tokensOf(p.image.split("/").filter(Boolean).pop() || p.image) : [];

    if (p.image && normImageUrl(p.image) === imgNorm) {
      score += 220;
      reasons.push("exact image URL");
    }

    const nameHay = p.name.toLowerCase();
    const broadHay = `${p.name} ${p.category || ""} ${p.description || ""}`.toLowerCase();

    for (const t of hintTokens) {
      if (nameHay.includes(t)) {
        score += 230;
        reasons.push(t);
      } else if (broadHay.includes(t)) {
        score += 30;
      }
    }

    for (const t of imgTokens) {
      if (nameHay.includes(t)) {
        score += 50;
        reasons.push(t);
      } else if (broadHay.includes(t)) {
        score += 14;
      }
    }

    for (const t of productTokens) {
      if (t.length >= 3 && nameHay.includes(t)) {
        score += 34;
        reasons.push(t);
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { product: p, score, reasons };
    }
  }

  if (!best) return null;
  const confidence = best.score >= 220 ? "high" : best.score >= 70 ? "medium" : "low";
  if (confidence === "low") return null;

  const reason =
    best.reasons.length > 0
      ? best.reasons.slice(0, 3).join(", ")
      : "best product on the page for this image";

  return {
    productId: best.product.id,
    productName: best.product.name,
    productPrice: best.product.price,
    productImage: best.product.image,
    sourceUrl: best.product.sourceUrl,
    confidence,
    reason,
  };
}

async function readUrlFromRequest(request: NextRequest): Promise<{ url: string; imageUrl: string; image?: string; hint?: string; error?: string }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const rawUrl = typeof form.get("url") === "string" ? String(form.get("url")) : "";
      const rawImageUrl = typeof form.get("imageUrl") === "string" ? String(form.get("imageUrl")) : "";
      const rawHint = typeof form.get("hint") === "string" ? String(form.get("hint")) : "";
      return { url: rawUrl.trim(), imageUrl: rawImageUrl.trim(), hint: rawHint.trim() };
    } catch {
      return { url: "", imageUrl: "", hint: "", error: "Could not read the uploaded form data." };
    }
  }

  try {
    const body = (await request.json()) as { url?: unknown; imageUrl?: unknown; image?: unknown; hint?: unknown };
    const url = typeof body?.url === "string" ? body.url : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : "";
    const image = typeof body?.image === "string" && /^data:image\//i.test(body.image) ? body.image : "";
    const hint = typeof body?.hint === "string" ? body.hint : "";
    return { url: url.trim(), imageUrl: imageUrl.trim(), image, hint: hint.trim() };
  } catch {
    return { url: "", imageUrl: "", image: "", hint: "", error: "Invalid JSON body." };
  }
}

async function buildImageIntelligence(form: FormData, imageUrl: string, imageData?: string, hint?: string): Promise<{ image?: ImageIntelligence; error?: string }> {
  const file = form.get("image");
  if (file instanceof File) {
    if (!IMAGE_MIME.test(file.type)) {
      return { error: "Only image files are supported (PNG, JPEG, WebP, GIF, AVIF, SVG)." };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: "Image must be smaller than 8 MB." };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const payload = `data:${file.type};base64,${buffer.toString("base64")}`;
    return {
      image: {
        id: uid(),
        name: file.name || "uploaded-image",
        src: payload,
        mime: file.type,
        sourceUrl: imageUrl || undefined,
        label: hint || undefined,
        addedAt: new Date().toISOString(),
      },
    };
  }

  if (imageData) {
    const mime = (imageData.match(/^data:([^;]+);/) || [])[1] || "image/jpeg";
    return {
      image: {
        id: uid(),
        name: "uploaded-image",
        src: imageData,
        mime,
        sourceUrl: imageUrl || undefined,
        label: hint || undefined,
        addedAt: new Date().toISOString(),
      },
    };
  }

  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      if (!/^https?:$/.test(parsed.protocol)) return { error: "Image URL must be http or https." };
    } catch {
      return { error: "Image URL is not valid." };
    }
    return {
      image: {
        id: uid(),
        name: imageUrl.split("/").filter(Boolean).pop()?.split("?")[0] || "image",
        src: imageUrl,
        mime: undefined,
        sourceUrl: imageUrl,
        label: hint || undefined,
        addedAt: new Date().toISOString(),
      },
    };
  }

  return {};
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");
  const { url: rawUrl, imageUrl, image: parsedImage, hint, error: readError } = await readUrlFromRequest(request);

  if (readError) return NextResponse.json({ error: readError }, { status: 400 });

  if (!rawUrl) {
    return NextResponse.json({ error: "A website URL is required to fetch data together with the image." }, { status: 400 });
  }

  const normalized = normalizeUrl(rawUrl);
  if (normalized.error) return NextResponse.json({ error: normalized.error }, { status: 400 });
  const url = normalized.url;

  const safety = await assertSafeUrl(url);
  if (!safety.ok) return NextResponse.json({ error: safety.error || "This website is not publicly reachable." }, { status: 400 });

  const form = isMultipart ? await request.formData().catch(() => new FormData()) : new FormData();
  const { image, error: imageError } = await buildImageIntelligence(form, imageUrl, parsedImage, hint || "");
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array>();
  const writer = stream.writable.getWriter();
  const send = (ev: AnalyzeEvent) => {
    writer.write(encoder.encode(JSON.stringify(ev) + "\n")).catch(() => {});
  };

  (async () => {
    try {
      let aborted = false;
      request.signal.addEventListener("abort", () => {
        aborted = true;
      });

      send({
        type: "log",
        message: "Connecting to website from your image…",
      });

      const result = await analyzeSite(url, {
        maxPages: 16,
        searchHint: hint?.trim() || undefined,
        emit: (ev) => {
          if (!aborted) send(ev);
        },
      });

      if (aborted) return;

      if (image) {
        result.origin = "image";
        result.imageAnalysis = image;

        const match = matchImageToSite(image, result);
        if (match) {
          result.imageMatch = match;
          result.insights = [
            {
              title: "Image Match",
              summary: `The image you uploaded most closely matches the product **${match.productName}** (${match.confidence} confidence). Use the Image tab on the right to review it with its price and details.`,
              evidence: [{ label: "Matched product", value: match.productName, sourceUrl: match.sourceUrl }],
            },
            ...result.insights,
          ];
        }

        result.company = {
          ...result.company,
          logo: result.company.logo || image.src,
        };
        result.images = [{ id: image.id, src: image.src, alt: image.name, pageUrl: image.sourceUrl || url }, ...result.images];
        result.insights = [
          {
            title: "Image-bound Analysis",
            summary:
              "This intelligence was pulled from the website you paired with your image. The image is attached to this report so you can verify the source visually.",
            evidence: image.sourceUrl
              ? [{ label: "Image source", value: image.name, sourceUrl: image.sourceUrl }]
              : [{ label: "Image source", value: image.name, sourceUrl: url }],
          },
          ...result.insights,
        ];
      } else if (hint && hint.trim()) {
        const pseudo: ImageIntelligence = {
          id: uid(),
          name: "",
          src: "",
          label: hint.trim(),
          addedAt: new Date().toISOString(),
        };
        const match = matchImageToSite(pseudo, result);
        if (match) {
          result.imageMatch = match;
          result.insights = [
            {
              title: "Text Match",
              summary: `The item you described ("${hint.trim()}") most closely matches the product **${match.productName}** (${match.confidence} confidence). The data below was pulled from that product's listing on the site.`,
              evidence: [{ label: "Matched product", value: match.productName, sourceUrl: match.sourceUrl }],
            },
            ...result.insights,
          ];
        }
      }

      if (hint && hint.trim() && !result.imageMatch) {
        result.warnings = [
          `No product on this site matched "${hint.trim()}". The site's catalog pages may be rendered in the browser (client-side), so their products were not present in the HTML we could read. We extracted ${result.products.length} product(s) from what was accessible. For exact data, paste a specific product page link (e.g. .../products/...), or a site whose catalog is server-rendered.`,
          ...result.warnings,
        ];
      }

      send({ type: "complete", data: result as SiteAnalysis });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      send({ type: "error", message });
    } finally {
      try {
        await writer.close();
      } catch {
        writer.releaseLock();
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}