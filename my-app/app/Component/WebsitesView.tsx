"use client";

import React, { useState } from "react";
import type { Conversation } from "@/app/lib/types";
import { Card, Badge, EmptyState, NiceDate, cn } from "./ui";
import { IconGlobe, IconCube, IconLayers, IconHistory, IconChart, IconSparkles } from "./icons";
import { ChartCard, DonutChart, MiniSpark, TrendChart } from "./charts";

type MetricKey = "products" | "services" | "pages";
const METRIC_META: Record<MetricKey, { label: string; color: string }> = {
  products: { label: "Products", color: "#2563eb" },
  services: { label: "Services", color: "#0f766e" },
  pages: { label: "Pages", color: "#b45309" },
};

function KpiCard({
  label,
  value,
  icon,
  tone,
  sub,
  spark,
  fillId,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: string;
  sub?: string;
  spark: number[];
  fillId: string;
}) {
  const tones: Record<string, string> = {
    indigo: "analytics-tone-navy",
    violet: "analytics-tone-teal",
    emerald: "analytics-tone-amber",
    amber: "analytics-tone-coral",
    rose: "analytics-tone-slate",
    cyan: "analytics-tone-teal",
  };
  return (
    <div className="analytics-kpi flex min-h-[122px] min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 card-shadow transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm bg-gradient-to-br", tones[tone])}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <div className="min-w-0 truncate text-[21px] font-bold leading-6 text-ink tabular-nums">{value}</div>
            {sub && <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted dark:bg-white/10">{sub}</span>}
          </div>
          <div className="truncate text-[11px] font-medium text-ink-muted">{label}</div>
        </div>
      </div>
      <div className="mt-auto pt-3">
        <MiniSpark values={spark} color="#6b7280" fillId={fillId} width={116} height={30} />
      </div>
    </div>
  );
}

export default function WebsitesView({
  conversations,
  onOpen,
}: {
  conversations: Conversation[];
  onOpen: (id: string) => void;
}) {
  const [metric, setMetric] = useState<MetricKey>("products");
  const sites = conversations.filter((c) => c.site);

  const totals = sites.reduce(
    (a, c) => {
      const s = c.site!;
      a.products += s.products.length;
      a.services += s.services.length;
      a.pricing += s.pricing.length;
      a.images += s.images.length;
      a.pages += s.analytics.pagesAnalyzed || 0;
      return a;
    },
    { products: 0, services: 0, pricing: 0, images: 0, pages: 0 }
  );

  const shortName = (s: { company: { name?: string }; domain: string }) => (s.company.name || s.domain).slice(0, 13);

  const metricData = sites.map((c) => {
    const s = c.site!;
    const v = metric === "products" ? s.products.length : metric === "services" ? s.services.length : s.analytics.pagesAnalyzed || 0;
    return { label: shortName(s), value: v, color: METRIC_META[metric].color };
  });

  const profile = sites.length === 1 ? sites[0].site! : null;
  const chartData = profile
    ? [
        { label: "Pages", value: profile.analytics.pagesAnalyzed || 0 },
        { label: "Products", value: profile.products.length },
        { label: "Services", value: profile.services.length },
        { label: "Pricing", value: profile.pricing.length },
        { label: "Images", value: profile.images.length },
        { label: "FAQs", value: profile.faqs.length },
      ]
        .filter((d) => d.value > 0)
    : metricData;

  const donutData = [
    { label: "Products", value: totals.products, color: "#2563eb" },
    { label: "Services", value: totals.services, color: "#0f766e" },
    { label: "Pricing plans", value: totals.pricing, color: "#b45309" },
    { label: "Images", value: totals.images, color: "#cbd5e1" },
  ].filter((d) => d.value > 0);

  const top = [...sites].sort((a, b) => b.site!.products.length - a.site!.products.length).slice(0, 5);
  const maxTop = Math.max(1, ...top.map((c) => c.site!.products.length));
  const maxGlobal = sites.reduce((m, c) => Math.max(m, c.site!.products.length), 0);
  const maxGlobalImages = sites.reduce((m, c) => Math.max(m, c.site!.images.length), 0);

  const pagesPerSite = sites.map((c) => c.site!.analytics.pagesAnalyzed || 0);
  const productsPerSite = sites.map((c) => c.site!.products.length);
  const imagesPerSite = sites.map((c) => c.site!.images.length);
  const servicesPerSite = sites.map((c) => c.site!.services.length);

  return (
    <div className="websites-view mx-auto min-w-0 max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-indigo-300">
            <IconChart size={13} /> Analytics Overview
          </div>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">WebMind Intelligence Dashboard</h1>
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-ink-muted">
            Live indicators across every website this assistant has analyzed — products, pricing, services, images and crawl coverage.
          </p>
        </div>
        {sites.length > 0 && (
          <span className="analytics-live-badge flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
            <span className="analytics-live-dot h-1.5 w-1.5 animate-pulse rounded-full" /> Live · {sites.length} tracked
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Websites analyzed" value={sites.length} tone="indigo" icon={<IconGlobe size={16} />} sub="saved" spark={pagesPerSite} fillId="kpiWebsites" />
        <KpiCard label="Products found" value={totals.products} tone="violet" icon={<IconCube size={16} />} sub={sites.length ? `Ø ${(totals.products / sites.length).toFixed(1)}/site` : undefined} spark={productsPerSite} fillId="kpiProducts" />
        <KpiCard label="Content captured" value={(totals.products + totals.services + totals.pricing + totals.images).toLocaleString()} tone="cyan" icon={<IconLayers size={16} />} sub="items" spark={imagesPerSite} fillId="kpiContent" />
        <KpiCard label="Pages crawled" value={totals.pages} tone="emerald" icon={<IconHistory size={16} />} sub="pages" spark={servicesPerSite} fillId="kpiPages" />
      </div>

      {/* Charts */}
      {sites.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ChartCard
            title={profile ? `Extraction profile · ${profile.company.name || profile.domain}` : `Performance · ${METRIC_META[metric].label}`}
            subtitle={profile ? "How much the assistant captured, by category" : "Trend across the analyzed websites"}
            className="analytics-chart lg:col-span-2"
            right={
              profile ? (
                <span className="shrink-0 rounded-xl bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-ink-muted dark:bg-white/10">
                  {profile.domain} · profile
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-gray-50 p-1 dark:bg-white/5">
                  {(Object.keys(METRIC_META) as MetricKey[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
                        metric === m ? "bg-ink text-surface shadow-sm" : "text-ink-muted hover:text-ink"
                      )}
                    >
                      {METRIC_META[m].label}
                    </button>
                  ))}
                </div>
              )
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(() => {
                const lastV = chartData[chartData.length - 1]?.value ?? 0;
                const firstV = chartData[0]?.value ?? 0;
                const diff = lastV - firstV;
                const up = diff >= 0;
                return (
                  <>
                    <div className="text-[24px] font-bold leading-7 text-ink tabular-nums">{lastV.toLocaleString()}</div>
                    <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink dark:bg-white/10">
                      {diff === 0 ? "—" : `${up ? "▲" : "▼"} ${Math.abs(diff).toLocaleString()}`}
                    </span>
                    <span className="text-[11px] text-ink-muted">{profile ? "vs first category" : "vs first analyzed site"}</span>
                  </>
                );
              })()}
            </div>
            <TrendChart data={chartData} color={profile ? "#0f766e" : METRIC_META[metric].color} height={210} fillId="trendPerf" valueLabel={(n) => n.toLocaleString()} />
          </ChartCard>

          <div className="flex min-w-0 flex-col gap-3">
            <ChartCard title="Content mix" subtitle="What the assistant extracted in total" className="analytics-chart">
              <DonutChart data={donutData} centerValue={totals.products + totals.services + totals.pricing + totals.images} centerLabel="total items" />
            </ChartCard>

            <ChartCard title="Top websites" subtitle="Sorted by products discovered" className="analytics-chart">
              <div className="space-y-2.5">
                {top.map((c) => {
                  const s = c.site!;
                  const pct = Math.round((s.products.length / maxTop) * 100);
                  return (
                    <button
                      key={c.id}
                      onClick={() => onOpen(c.id)}
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      {s.company.logo ? (
                        <img src={s.company.logo} alt="" className="h-7 w-7 shrink-0 rounded-lg border border-line object-contain" />
                      ) : (
                        <div className="analytics-tone-teal flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white">
                          {(s.company.name || s.domain).slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-semibold text-ink">{s.company.name || s.domain}</span>
                          <span className="shrink-0 text-[11px] font-medium text-ink-muted">{s.products.length} products</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <div className="analytics-progress h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 3)}%` }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* Website cards */}
      {sites.length === 0 ? (
        <EmptyState
          icon={<IconGlobe size={30} />}
          title="No websites analyzed yet"
          hint="Paste a URL in the top bar and click Analyze Website. The intelligence will be saved to this website anytime."
        />
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Analyzed websites</h2>
            <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-ink-muted dark:bg-white/10">{sites.length}</span>
            <IconSparkles size={13} className="text-brand-500" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sites.map((c) => {
              const s = c.site!;
              return (
                <Card key={c.id} className="analytics-site-card flex min-w-0 gap-3 p-4 transition-shadow hover:shadow-md">
                  {s.company.logo ? (
                    <img src={s.company.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-line object-contain" />
                  ) : (
                    <div className="analytics-tone-navy flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white">
                      {(s.company.name || s.domain).slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 truncate text-[14px] font-semibold text-ink">{s.company.name || s.domain}</div>
                      {s.demo && <Badge tone="violet">Demo</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                      {s.domain} · analyzed <NiceDate iso={s.analyzedAt} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                      <span className="rounded-lg bg-gray-100 px-1.5 py-0.5 dark:bg-white/10">{s.products.length} products</span>
                      <span className="rounded-lg bg-gray-100 px-1.5 py-0.5 dark:bg-white/10">{s.services.length} services</span>
                      <span className="rounded-lg bg-gray-100 px-1.5 py-0.5 dark:bg-white/10">{s.pricing.length} pricing</span>
                      <span className="rounded-lg bg-gray-100 px-1.5 py-0.5 dark:bg-white/10">{s.images.length} images</span>
                    </div>

                    {/* Mini comparison bars */}
                    <div className="mt-3 flex items-end gap-1">
                      {[
                        { v: s.products.length, max: maxGlobal, c: "analytics-bar-dark", n: "Products" },
                        { v: s.services.length, max: maxGlobal || 1, c: "analytics-bar-mid", n: "Services" },
                        { v: s.images.length, max: maxGlobalImages, c: "analytics-bar-light", n: "Images" },
                      ].map((b) => {
                        const capped = b.max > 0 ? b.max : 1;
                        const h = Math.max(b.v > 0 ? 4 : 3, Math.round((b.v / capped) * 26));
                        return (
                          <div key={b.n} className="flex flex-col items-center gap-1" title={`${b.n}: ${b.v}`}>
                            <span className={cn("w-3 rounded-t-sm", b.c)} style={{ height: h }} />
                            <span className="text-[8.5px] text-ink-muted/70">{b.n}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => onOpen(c.id)}
                    className="shrink-0 self-center rounded-xl border border-line px-2.5 py-1.5 text-[11px] font-medium text-brand-600 transition-colors hover:bg-brand-50"
                  >
                    Open →
                  </button>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}