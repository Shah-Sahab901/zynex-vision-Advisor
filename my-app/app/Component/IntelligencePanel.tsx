"use client";

import React, { useState } from "react";
import type { SiteAnalysis } from "@/app/lib/types";
import { Card, cn, EmptyState, SectionLabel, RichText, Badge } from "./ui";
import { BarChart, ChartCard } from "./charts";
import {
  IconGlobe,
  IconExternal,
  IconImage,
  IconCube,
  IconCreditCard,
  IconChart,
  IconTag,
  IconLayers,
  IconLink,
  IconStar,
  IconAlert,
  IconEye,
  IconX,
  IconSort,
  IconFileText,
} from "./icons";

type TabKey = "overview" | "products" | "services" | "pricing" | "images" | "documents" | "analytics" | "insights" | "image";

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode; count?: (s: SiteAnalysis) => number }> = [
  { key: "overview", label: "Overview", icon: <IconLayers size={14} /> },
  { key: "products", label: "Products", icon: <IconCube size={14} />, count: (s) => s.products.length },
  { key: "images", label: "Images", icon: <IconImage size={14} />, count: (s) => s.images.length },
  { key: "documents", label: "Documents", icon: <IconFileText size={14} />, count: (s) => s.documents?.length || 0 },
  { key: "analytics", label: "Analytics", icon: <IconChart size={14} /> },
  { key: "insights", label: "Insights", icon: <IconEye size={14} />, count: (s) => s.insights.length },
  { key: "image", label: "Image", icon: <IconImage size={14} /> },
];

function ImageTab({ site }: { site: SiteAnalysis }) {
  const img = site.imageAnalysis;
  const match = site.imageMatch;
  if (!img) {
    return (
      <EmptyState
        icon={<IconImage size={32} />}
        title="No attached image"
        hint="Use the + button in the top bar to upload an image and pair it with a website URL — the data will appear here."
      />
    );
  }
  const src = img.src.startsWith("data:") ? img.src : `/api/image?url=${encodeURIComponent(img.src)}`;
  return (
    <div className="space-y-4">
      {match && (
        <Card className="overflow-hidden border-brand-500/40">
          <div className="flex items-center gap-2 border-b border-line bg-brand-50/60 px-4 py-2.5 dark:bg-indigo-950/40">
            <IconImage size={14} className="text-brand-600" />
            <span className="text-[12px] font-semibold text-ink">Matches your image</span>
            <Badge tone={match.confidence === "high" ? "green" : "blue"} className="ml-auto">
              {match.confidence} confidence
            </Badge>
          </div>
          <div className="flex min-h-[112px] overflow-hidden">
            {match.productImage ? (
              <ProductImage src={match.productImage} name={match.productName} sourceUrl={match.sourceUrl} />
            ) : (
              <div className="flex w-20 shrink-0 items-center justify-center bg-indigo-50 font-bold text-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300">
                {match.productName.slice(0, 1)}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col p-3">
              <a
                href={match.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={match.sourceUrl}
                className="break-words text-[13px] font-semibold text-ink hover:text-brand-600 hover:underline"
              >
                {match.productName}
              </a>
              {match.productPrice && <div className="mt-1 text-[13.5px] font-medium text-brand-600">{match.productPrice}</div>}
              <div className="mt-1 text-[10.5px] italic text-ink-muted">Data pulled from the URL based on your image.</div>
              <div className="mt-auto pt-2">
                <SourceLink url={match.sourceUrl} label="View source page" />
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex h-56 items-center justify-center bg-gray-50 p-3 dark:bg-white/5">
          <img src={src} alt={img.name} className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
        <div className="p-4">
          <div className="break-words text-[13px] font-semibold text-ink">{img.name}</div>
          <div className="mt-2 space-y-1.5 text-[12px] text-ink-muted">
            {img.mime && <div>Type: {img.mime}</div>}
            {img.width && img.height && (
              <div>
                Dimensions: {img.width} × {img.height} px
              </div>
            )}
            <div>Added: {new Date(img.addedAt).toLocaleString()}</div>
            {match && <div>Match: {match.reason}</div>}
          </div>
          {img.sourceUrl && (
            <div className="mt-3">
              <SourceLink url={img.sourceUrl} label="Image source" />
            </div>
          )}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-[12.5px] leading-5 text-ink-muted">
          {match
            ? `The product above is the closest match to your image. Products, pricing, services and the rest of the extracted data live in the neighboring tabs on the right.`
            : `No reliable product match was found for this image. Products, pricing, services and the rest of the extracted data live in the neighboring tabs on the right.`}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <div className="text-[11px] font-medium text-ink-muted">{label}</div>
      <div className="break-words text-[15px] font-semibold text-ink">{value}</div>
      {sub && <div className="break-words text-[10.5px] text-ink-muted">{sub}</div>}
    </div>
  );
}

function SourceLink({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label || url}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-gray-50 px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-brand-500/40 hover:text-brand-600 dark:bg-white/5"
    >
      <IconLink size={10} className="shrink-0" />
      {label ? <span className="max-w-[140px] truncate">{label}</span> : <span className="max-w-[180px] truncate">{url}</span>}
      <IconExternal size={10} className="shrink-0" />
    </a>
  );
}

function ProductImage({ src, name, sourceUrl }: { src: string; name: string; sourceUrl: string }) {
  const [mode, setMode] = useState<"proxy" | "direct">("proxy");
  return (
    <img
      src={mode === "proxy" ? `/api/image?url=${encodeURIComponent(src)}&ref=${encodeURIComponent(sourceUrl)}` : src}
      alt={name}
      loading="lazy"
      className="w-28 shrink-0 self-stretch border-r border-line bg-gray-50 object-cover"
      onError={() => setMode("direct")}
    />
  );
}

function OverviewTab({ site }: { site: SiteAnalysis }) {
  const c = site.company;
  const facts: Array<[string, string | undefined]> = [
    ["Company Name", c.name],
    ["Industry", c.industry],
    ["Founded", c.founded],
    ["Headquarters", c.headquarters],
    ["Website", c.website],
    ["Business Model", c.businessModel],
    ["Email", c.email],
    ["Phone", c.phone],
    ["Address", c.address],
  ];

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        {c.logo ? (
          <div className="flex h-28 items-center justify-center border-b border-line bg-gray-50 p-4 dark:bg-white/5">
            <img src={c.logo} alt={c.name || site.domain} className="h-20 w-auto rounded-xl object-contain" />
          </div>
        ) : (
          <div className="flex h-20 items-center justify-center border-b border-line bg-gray-50 dark:bg-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500 text-lg font-bold text-white">{(c.name || site.domain).slice(0, 1)}</div>
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold text-ink">{c.name || site.domain}</div>
            <SourceLink url={site.origin} label="Visit" />
          </div>
          {c.tagline && <div className="mt-0.5 text-[12.5px] italic text-ink-muted">“{c.tagline}”</div>}
          {c.description && <div className="mt-2 text-[13px] leading-6 text-ink-muted">{c.description}</div>}
          {c.socials.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.socials.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-muted hover:border-brand-500/50 hover:text-brand-600"
                >
                  {s.network} <IconExternal size={10} />
                </a>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ChartCard
        title="Extraction snapshot"
        subtitle="What the assistant captured on this website"
        right={<span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-white/10 dark:text-indigo-300">{site.analytics.pagesAnalyzed} pages</span>}
      >
        <BarChart
          height={150}
          data={[
            { label: "Products", value: site.products.length, color: "#2563eb" },
            { label: "Services", value: site.services.length, color: "#3b82f6" },
            { label: "Pricing", value: site.pricing.length, color: "#60a5fa" },
            { label: "Images", value: site.images.length, color: "#93c5fd" },
            { label: "FAQs", value: site.faqs.length, color: "#bfdbfe" },
          ]}
        />
      </ChartCard>

      <div>
        <SectionLabel className="mb-2">Key Facts</SectionLabel>
        <div className="space-y-2">
          {facts
            .filter((f) => f[1])
            .map(([label, value]) => (
              <div key={label} className="flex items-start gap-3 rounded-xl border border-line px-3.5 py-2.5">
                <span className="shrink-0 text-[12px] font-medium text-ink-muted">{label}</span>
                <span className="min-w-0 flex-1 break-words text-[12.5px] text-ink">{value}</span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-muted/60">Source: {label === "Website" ? "URL" : label}</span>
              </div>
            ))}
          {facts.every((f) => !f[1]) && <div className="py-3 text-center text-[12.5px] text-ink-muted">Not found on the website.</div>}
        </div>
      </div>

      <div>
        <SectionLabel className="mb-2">Key Insights</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {site.insights.slice(0, 4).map((ins, i) => (
            <Card key={i} className="min-w-0 overflow-hidden p-3.5">
              <div className="break-words text-[12.5px] font-semibold text-ink">{ins.title}</div>
              <div className="mt-1 break-words text-[12px] leading-5 text-ink-muted">{ins.summary}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ site }: { site: SiteAnalysis }) {
  const documents = site.documents || [];
  if (!documents.length) return <EmptyState icon={<IconFileText size={32} />} title="No PDF documents yet" hint="Use the plus button in the top bar to upload a PDF and extract its verified text here." />;
  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <Card key={document.id} className="overflow-hidden">
          <div className="border-b border-line bg-slate-50 px-4 py-3 dark:bg-white/5">
            <div className="flex items-start gap-2">
              <IconFileText className="mt-0.5 shrink-0 text-brand-600" size={17} />
              <div className="min-w-0">
                <div className="break-words text-[13px] font-semibold text-ink">{document.name}</div>
                <div className="mt-1 text-[11px] text-ink-muted">{document.pages} pages · {(document.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-4">
            {document.text ? <RichText text={document.text} /> : <div className="text-[12.5px] text-ink-muted">No readable text was found in this PDF.</div>}
          </div>
        </Card>
      ))}
      <div className="text-center text-[11px] text-ink-muted">{documents.length} PDF document{documents.length === 1 ? "" : "s"} analyzed</div>
    </div>
  );
}

function ProductsTab({ site }: { site: SiteAnalysis }) {
  const [sort, setSort] = useState<"name" | "price">("name");
  const [catFilter, setCatFilter] = useState("");
  const categories = [...new Set(site.products.map((p) => p.category).filter(Boolean))] as string[];
  const filtered = site.products.filter((p) => (catFilter ? p.category === catFilter : true));
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price") {
      const pa = parseP(a.price);
      const pb = parseP(b.price);
      if (pa !== null && pb !== null) return pa - pb;
      if (pa !== null) return -1;
      return 1;
    }
    return a.name.localeCompare(b.name);
  });

  if (site.products.length === 0) {
    return (
      <EmptyState
        icon={<IconCube size={32} />}
        title="No products found"
        hint="This website does not have an accessible product catalog, or products were not published in a format that can be extracted."
      />
    );
  }

  return (
    <div className="space-y-3">
      {site.imageMatch && (
        <Card className="flex min-h-[104px] overflow-hidden border-brand-500/40">
          <div className="w-6 shrink-0 bg-brand-500" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-brand-600">
                <IconImage size={13} />
                {site.imageAnalysis ? "Matches your image" : "Matches your item"}
              </div>
              <Badge tone={site.imageMatch.confidence === "high" ? "green" : "blue"}>{site.imageMatch.confidence} confidence</Badge>
            </div>
            <a
              href={site.imageMatch.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={site.imageMatch.sourceUrl}
              className="break-words text-[13px] font-semibold text-ink hover:text-brand-600 hover:underline"
            >
              {site.imageMatch.productName}
            </a>
            <div className="flex items-center gap-3 text-[12.5px] font-medium text-brand-600">
              {site.imageMatch.productPrice || "Price on request"}
              <span className="font-normal text-ink-muted">— {site.imageMatch.reason}</span>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-line p-0.5">
          <button
            onClick={() => setSort("name")}
            className={cn("rounded-md px-2 py-1 text-[11px] font-medium", sort === "name" ? "bg-gray-100 text-ink" : "text-ink-muted hover:text-ink")}
          >
            <IconSort size={12} className="mr-1" />
            Name
          </button>
          <button
            onClick={() => setSort("price")}
            className={cn("rounded-md px-2 py-1 text-[11px] font-medium", sort === "price" ? "bg-gray-100 text-ink" : "text-ink-muted hover:text-ink")}
          >
            <IconSort size={12} className="mr-1 rotate-90" />
            Price
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {sorted.map((p) => (
          <Card key={p.id} className="flex min-h-[112px] overflow-hidden transition-shadow hover:shadow-md">
            {p.image ? (
              <ProductImage src={p.image} name={p.name} sourceUrl={p.sourceUrl} />
            ) : (
              <div className="flex w-20 shrink-0 items-center justify-center bg-indigo-50 font-bold text-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300">
                {p.name.slice(0, 1)}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col p-3">
              <a
                href={p.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={p.sourceUrl}
                className="break-words text-[12.5px] font-semibold text-ink hover:text-brand-600 hover:underline"
              >
                {p.name}
              </a>
              {p.category && <div className="mt-0.5 text-[11px] text-ink-muted">{p.category}</div>}
              <div className="mt-1 text-[12.5px] font-medium text-brand-600">{p.price || "Price on request"}</div>
              {p.rating != null && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-500">
                  <IconStar size={12} className="fill-current" />
                  {p.rating.toFixed(1)}
                </div>
              )}
              {p.description && <div className="mt-1.5 break-words text-[11px] leading-4 text-ink-muted">{p.description}</div>}
              <div className="mt-auto pt-2">
                <SourceLink url={p.sourceUrl} label="View source page" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="text-center text-[11px] text-ink-muted">{site.products.length} total products found</div>
    </div>
  );
}

function ServicesTab({ site }: { site: SiteAnalysis }) {
  if (site.services.length === 0) {
    return (
      <EmptyState
        icon={<IconTag size={32} />}
        title="No services found"
        hint="No services section was found on the analyzed pages."
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {site.services.slice(0, 24).map((s) => (
        <Card key={s.id} className="min-w-0 overflow-hidden p-3.5">
          <div className="break-words text-[12.5px] font-semibold text-ink">{s.name}</div>
          {s.description && <div className="mt-1 break-words text-[12px] leading-5 text-ink-muted">{s.description}</div>}
          <div className="mt-2">
            <SourceLink url={s.sourceUrl} label="Source page" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function PricingTab({ site }: { site: SiteAnalysis }) {
  if (site.pricing.length === 0) {
    return (
      <EmptyState
        icon={<IconCreditCard size={32} />}
        title="Public pricing was not found"
        hint="No pricing information could be extracted from the analyzed pages. Pricing may be available after signup or a sales call."
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {site.pricing.slice(0, 10).map((p) => (
          <Card key={p.id} className="flex min-w-0 flex-col overflow-hidden p-4">
            <div className="line-clamp-2 text-[12.5px] font-semibold text-ink">{p.name}</div>
            <div className="mt-1.5 break-words text-[18px] font-bold leading-tight text-brand-600">{p.price || "On request"}</div>
            {p.period && <div className="text-[11px] text-ink-muted">{p.period}</div>}
            {p.features && p.features.length > 0 && (
              <div className="mt-2.5 space-y-1 border-t border-line pt-2.5">
                {p.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] leading-5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                    <span className="min-w-0 break-words text-ink-muted">{f}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-auto pt-3">
              <SourceLink url={p.sourceUrl} label="Source page" />
            </div>
          </Card>
        ))}
      </div>
      <div className="text-center text-[11px] text-ink-muted">{site.pricing.length} pricing entries extracted</div>
    </div>
  );
}

function ImagesTab({ site }: { site: SiteAnalysis }) {
  if (site.images.length === 0) {
    return (
      <EmptyState
        icon={<IconImage size={32} />}
        title="No images found"
        hint="No meaningful images could be extracted from the analyzed pages."
      />
    );
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {site.images.slice(0, 30).map((img) => (
          <a
            key={img.id}
            href={img.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={img.alt || img.pageUrl}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-gray-50 transition-all hover:shadow-md dark:bg-white/5"
          >
            <img
              src={img.src}
              alt={img.alt || ""}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                const parent = el.parentElement;
                if (parent) {
                  parent.classList.add("flex", "items-center", "justify-center");
                  const placeholder = document.createElement("span");
                  placeholder.textContent = "Image unavailable";
                  placeholder.className = "text-[11px] text-ink-muted";
                  parent.appendChild(placeholder);
                }
              }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="truncate text-[10.5px] text-white">{img.alt || img.pageUrl.split("/").pop()}</div>
            </div>
          </a>
        ))}
      </div>
      <div className="mt-3 text-center text-[11px] text-ink-muted">{site.images.length} total images extracted</div>
    </div>
  );
}

function AnalyticsTab({ site }: { site: SiteAnalysis }) {
  const a = site.analytics;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Pages analyzed" value={a.pagesAnalyzed} />
        <Metric label="Products found" value={a.productCount} />
        <Metric label="Services found" value={a.serviceCount} />
        <Metric label="Images extracted" value={a.imageCount} />
        <Metric label="Internal links" value={a.internalLinks.toLocaleString()} />
        <Metric label="External links" value={a.externalLinks.toLocaleString()} />
        <Metric label="Pricing entries" value={a.pricingCount} />
        <Metric label="SEO titles" value={a.title ? "Yes" : "Missing"} sub={a.title?.slice(0, 40)} />
      </div>

      <div>
        <SectionLabel className="mb-2">SEO Metadata</SectionLabel>
        <Card className="divide-y divide-line p-0">
          <Kv k="Title" v={a.title} />
          <Kv k="Description" v={a.description} />
          <Kv k="Keywords" v={a.keywords?.join(", ")} />
          {a.missingMeta.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Missing metadata</div>
              <ul className="mt-1 space-y-0.5">
                {a.missingMeta.map((m, i) => (
                  <li key={i} className="text-[11.5px] text-ink-muted">· {m}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {a.technologies.length > 0 && (
        <div>
          <SectionLabel className="mb-2">Detected technologies</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {a.technologies.map((t) => (
              <span key={t} className="rounded-lg border border-line bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-ink dark:bg-white/5">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {a.headings.length > 0 && (
        <div>
          <SectionLabel className="mb-2">Page headings</SectionLabel>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {a.headings.slice(0, 30).map((h, i) => (
              <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-ink-muted dark:bg-white/5">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InsightsTab({ site }: { site: SiteAnalysis }) {
  if (site.insights.length === 0) {
    return (
      <EmptyState
        icon={<IconEye size={32} />}
        title="No insights generated"
        hint="No AI business insights were available from the analyzed pages."
      />
    );
  }
  return (
    <div className="space-y-4">
      {site.insights.map((ins, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              <IconEye size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink">{ins.title}</div>
              <div className="mt-1 text-[12.5px] leading-5 text-ink-muted">{ins.summary}</div>
              {ins.evidence.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ins.evidence.map((e, j) => (
                    <a
                      key={j}
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${e.label}: ${e.value}${e.sourcePage ? " — " + e.sourcePage : ""}`}
                      className="inline-flex max-w-[240px] items-center gap-1 rounded-lg border border-line bg-gray-50 px-2 py-0.5 text-[10.5px] text-ink-muted transition-colors hover:border-brand-500/40 hover:text-brand-600 dark:bg-white/5"
                    >
                      <span className="truncate">{e.label}: {e.value || "view"}</span>
                      <IconExternal size={9} className="shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Kv({ k, v }: { k: string; v?: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="shrink-0 text-[12px] font-medium text-ink-muted">{k}</span>
      <span className="truncate text-right text-[12.5px] text-ink">{v || "Not found"}</span>
    </div>
  );
}

function parseP(price: string | undefined): number | null {
  if (!price) return null;
  const m = price.match(/([\d][\d.,]*)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,(\d{3})/g, "$1"));
  return Number.isNaN(n) ? null : n;
}

export default function IntelligencePanel({
  site,
  open,
  onClose,
}: {
  site: SiteAnalysis | null;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <aside
      className={cn(
        "flex h-full w-[340px] shrink-0 flex-col border-l border-line bg-surface transition-transform duration-200 lg:w-[360px] lg:translate-x-0 xl:w-[400px]",
        open ? "translate-x-0 fixed right-0 top-0 z-50 h-full w-[min(340px,calc(100vw-1rem))] shadow-2xl lg:static lg:w-[360px] lg:shadow-none lg:z-auto xl:w-[400px]" : "fixed right-0 translate-x-full lg:static lg:translate-x-0"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <IconGlobe className="text-brand-600" size={16} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">Website Intelligence</div>
          <div className="truncate text-[11px] text-ink-muted">
            {site ? (
              <>
                {site.company.name || site.domain} ·{" "}
                <span className={cn(site.status === "complete" ? "text-emerald-500" : "text-amber-500")}>
                  {site.status === "complete" ? "Analysis complete" : site.status === "partial" ? "Partial analysis" : site.status}
                </span>
              </>
            ) : (
              "No analysis yet"
            )}
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-gray-100 lg:hidden">
          <IconX size={17} />
        </button>
      </div>

      {/* Tab bar */}
      {site && (
        <div className="flex gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => {
            if (t.key === "image" && !site.imageAnalysis) return null;
            const n = t.count?.(site);
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors",
                  tab === t.key
                    ? "bg-brand-50 text-brand-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "text-ink-muted hover:bg-gray-100 hover:text-ink"
                )}
              >
                {t.icon}
                {t.label}
                {typeof n === "number" && n > 0 && (
                  <span className="ml-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-white/10">{n}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
        {!site ? (
          <EmptyState
            icon={<IconGlobe size={32} />}
            title="No website analyzed yet"
            hint="Paste a URL in the top bar and click Analyze Website to generate intelligence."
          />
        ) : tab === "overview" ? (
          <OverviewTab site={site} />
        ) : tab === "products" ? (
          <ProductsTab site={site} />
        ) : tab === "services" ? (
          <ServicesTab site={site} />
        ) : tab === "pricing" ? (
          <PricingTab site={site} />
        ) : tab === "images" ? (
          <ImagesTab site={site} />
        ) : tab === "documents" ? (
          <DocumentsTab site={site} />
        ) : tab === "image" ? (
          <ImageTab site={site} />
        ) : tab === "analytics" ? (
          <AnalyticsTab site={site} />
        ) : (
          <InsightsTab site={site} />
        )}
      </div>

      {site?.warnings.length ? (
        <div className="border-t border-line px-4 py-2.5">
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] leading-4 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <IconAlert className="mt-0.5 shrink-0 text-amber-600" size={14} />
            <div>{site.warnings[0]}</div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}