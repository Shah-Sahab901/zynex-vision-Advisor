import type { ImageMatch, Product, SiteAnalysis } from "./types";

type RGB = [number, number, number];

const COLOR_NAMES: Array<{ name: string; rgb: RGB }> = [
  { name: "red", rgb: [215, 45, 45] },
  { name: "orange", rgb: [235, 130, 40] },
  { name: "yellow", rgb: [240, 205, 60] },
  { name: "green", rgb: [55, 160, 70] },
  { name: "teal", rgb: [40, 165, 150] },
  { name: "blue", rgb: [45, 95, 200] },
  { name: "navy", rgb: [25, 45, 110] },
  { name: "purple", rgb: [125, 70, 180] },
  { name: "pink", rgb: [235, 145, 165] },
  { name: "gold", rgb: [200, 160, 55] },
  { name: "brown", rgb: [128, 78, 48] },
  { name: "beige", rgb: [205, 180, 148] },
  { name: "black", rgb: [28, 28, 30] },
  { name: "white", rgb: [235, 235, 235] },
  { name: "gray", rgb: [132, 132, 136] },
];

function colorDistance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function colorSimilarity(a: RGB, b: RGB): number {
  return Math.max(0, 1 - colorDistance(a, b) / 441.7);
}

export function rgbToColorName(rgb: RGB): string {
  let best = COLOR_NAMES[0];
  let bestD = Infinity;
  for (const c of COLOR_NAMES) {
    const d = colorDistance(rgb, c.rgb);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

export async function imageSignature(src: string, grid = 4): Promise<number[] | null> {
  try {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = grid;
    canvas.height = grid;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, grid, grid);
    const data = ctx.getImageData(0, 0, grid, grid).data;
    const sig: number[] = [];
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      sig.push(data[i], data[i + 1], data[i + 2]);
      total += data[i] + data[i + 1] + data[i + 2];
    }
    if (total <= 0) return null;
    return sig.map((v) => v / total);
  } catch {
    return null;
  }
}

export function signatureSimilarity(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return Math.max(0, 1 - sum / 2);
}

export async function dominantColors(
  src: string,
  max = 4
): Promise<Array<{ rgb: RGB; ratio: number; name: string }> | null> {
  try {
    const img = await loadImage(src);
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const buckets = new Map<string, { sumR: number; sumG: number; sumB: number; w: number }>();
    const cx = (size - 1) / 2;
    const cy = (size - 1) / 2;
    const maxD = Math.hypot(cx, cy);
    let total = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const idx = i / 4;
      const x = idx % size;
      const y = Math.floor(idx / size);
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const w = 0.25 + Math.max(0, 1 - d) * 0.75;
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.sumR += r * w;
        bucket.sumG += g * w;
        bucket.sumB += b * w;
        bucket.w += w;
      } else {
        buckets.set(key, { sumR: r * w, sumG: g * w, sumB: b * w, w });
      }
      total += w;
    }

    const entries = Array.from(buckets.values())
      .map((bk) => ({
        rgb: [Math.round(bk.sumR / bk.w), Math.round(bk.sumG / bk.w), Math.round(bk.sumB / bk.w)] as RGB,
        ratio: bk.w / total,
      }))
      .sort((a, b) => b.ratio - a.ratio);

    const top: Array<{ rgb: RGB; ratio: number }> = [];
    for (const e of entries) {
      if (top.length >= max) break;
      if (top.some((t) => colorDistance(t.rgb, e.rgb) < 70)) continue;
      top.push(e);
    }
    if (!top.length) return null;

    const norm = top.reduce((s, e) => s + e.ratio, 0);
    return top.map((e) => ({ rgb: e.rgb, ratio: e.ratio / norm, name: rgbToColorName(e.rgb) }));
  } catch {
    return null;
  }
}

const ACHROMATIC = new Set(["black", "white", "gray", "beige"]);
const COLOR_WORD_NAMES = new Set<string>([...COLOR_NAMES.map((c) => c.name), "grey"]);
const COLOUR_ALT: Record<string, string> = { gray: "grey", grey: "gray" };
const MIN_SCORE = 0.35;
const STRONG_OVERLAP = 0.55;

function tokensOf(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
}

function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  return new RegExp(`(^|[^a-z])(${escaped})([^a-z]|$)`, "i").test(text);
}

export async function findImageMatchOnSite(site: SiteAnalysis, hint?: string): Promise<ImageMatch | null> {
  const query = site.imageAnalysis;
  if (!query) return null;
  if (site.imageMatch && site.imageMatch.confidence === "high") return site.imageMatch;

  const hintClean = (hint || "").trim();
  const hintTokens = tokensOf(hintClean);
  const hintColorTokens = hintTokens.filter((t) => COLOR_WORD_NAMES.has(t));
  const hintItemTokens = hintTokens.filter((t) => !COLOR_WORD_NAMES.has(t));

  const queryColors = await dominantColors(query.src);
  if (!queryColors) return null;

  const candidates = site.products.filter((p) => p.image).slice(0, 15);
  if (!candidates.length) return null;

  const detected = Array.from(new Set(queryColors.map((c) => c.name)));
  const dominantName = queryColors[0].name;

  interface Candidate {
    product: Product;
    score: number;
    colorPts: number;
    itemHits: string[];
    allItemHit: boolean;
    why: string;
  }
  let best: Candidate | null = null;

  for (const p of candidates) {
    const pText = `${p.name} ${p.category || ""} ${p.description || ""}`.toLowerCase();
    const itemHits = hintItemTokens.filter((t) => hasWord(pText, t));
    const allItemHit = hintItemTokens.length > 0 && itemHits.length === hintItemTokens.length;

    if (hintItemTokens.length > 0 && itemHits.length === 0) continue;

    const pColors = await dominantColors(`/api/image?url=${encodeURIComponent(p.image as string)}`);

    let colorPts = 0;
    let overlap = 0;
    if (!pColors) {
      if (hintItemTokens.length === 0) continue;
    } else if (hintColorTokens.length > 0) {
      const colorHits = hintColorTokens.filter((t) => {
        const alt = COLOUR_ALT[t] || "";
        return hasWord(pText, t) || (Boolean(alt) && hasWord(pText, alt));
      });
      colorPts += colorHits.length * 40;
      for (const c of hintColorTokens) {
        if (queryColors.some((qc) => qc.name === c)) colorPts += 25;
      }
    }

    if (pColors) {
      for (const qc of queryColors) {
        let row = 0;
        for (const pc of pColors) {
          const s = colorSimilarity(qc.rgb, pc.rgb) * pc.ratio;
          if (s > row) row = s;
        }
        overlap += qc.ratio * row;
      }
      colorPts += overlap * 30;
    }

    if (hintItemTokens.length > 0) {
      if (!allItemHit && colorPts < 30) continue;
    } else {
      if (ACHROMATIC.has(dominantName) && hintColorTokens.length === 0) continue;
      if (overlap < STRONG_OVERLAP && itemHits.length === 0) continue;
    }

    const score = colorPts + itemHits.length * 55;
    if (hintItemTokens.length === 0 && score < MIN_SCORE * 100) continue;

    if (!best || score > best.score) {
      best = {
        product: p,
        score,
        colorPts,
        itemHits,
        allItemHit,
        why:
          hintClean && (allItemHit || itemHits.length > 0)
            ? `You said "${hintClean}" — matched "${p.name}"`
            : `Detected ${detected.join("/")} color — closest color match (${Math.min(100, Math.round(score))}%)`,
      };
    }
  }

  if (!best) return null;

  const product = best.product;
  const strong = best.allItemHit || (best.itemHits.length > 0 && queryColors.length > 0 && best.score >= 95);
  return {
    productId: product.id,
    productName: product.name,
    productPrice: product.price,
    productImage: product.image,
    sourceUrl: product.sourceUrl,
    confidence: strong ? "high" : "medium",
    reason: best.why,
  };
}