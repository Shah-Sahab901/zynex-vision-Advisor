"use client";

import React, { useMemo, useState } from "react";
import type { Conversation, SiteAnalysis } from "@/app/lib/types";
import { Button, Card, EmptyState, SectionLabel } from "./ui";
import { IconCompare, IconGlobe } from "./icons";

function siteOptions(conversations: Conversation[]): Array<{ id: string; site: SiteAnalysis }> {
  const out: Array<{ id: string; site: SiteAnalysis }> = [];
  for (const c of conversations) {
    if (c.site) out.push({ id: c.id, site: c.site });
  }
  return out;
}

function Row({ label, values }: { label: string; values: Array<string> }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-line px-3 py-2.5 last:border-b-0 sm:grid-cols-[160px_1fr_1fr_1fr] sm:gap-3">
      <div className="text-[12px] font-medium text-ink-muted">{label}</div>
      {values.map((v, i) => (
        <div key={i} className="break-words text-[12.5px] leading-5 text-ink">{v || "—"}</div>
      ))}
    </div>
  );
}

export default function CompareView({
  conversations,
  currentSite,
  onOpen,
}: {
  conversations: Conversation[];
  currentSite: SiteAnalysis | null;
  onOpen: (conversationId: string) => void;
}) {
  const options = useMemo(() => siteOptions(conversations), [conversations]);
  const [selected, setSelected] = useState<string[]>(() =>
    currentSite
      ? [conversations.find((c) => c.site?.domain === currentSite.domain)?.id || ""].filter(Boolean).slice(0, 1)
      : []
  );
  const [result, setResult] = useState<Array<{ id: string; site: SiteAnalysis }> | null>(null);

  const chosen = selected.filter((id) => options.some((o) => o.id === id));

  const compare = () => {
    const rows = chosen.map((id) => options.find((o) => o.id === id)).filter(Boolean) as Array<{ id: string; site: SiteAnalysis }>;
    setResult(rows);
  };

  const summary = useMemo(() => {
    if (!result || result.length < 2) return null;
    const [a, b] = result;
    const diffs: string[] = [];
    const A = a.site;
    const B = b.site;
    if (A.company.name && B.company.name && A.company.name !== B.company.name) diffs.push(`**${A.company.name}** and **${B.company.name}** operate different business verticals among the analyzed sites.`);
    if ((A.products.length === 0) !== (B.products.length === 0)) diffs.push(`${A.company.name || A.domain} publishes product info online${A.products.length ? "" : " in a format we could extract"}, while ${B.company.name || B.domain}${B.products.length ? " publishes product info" : " does not publish an accessible catalog"}.`);
    else if (A.products.length && B.products.length && A.products.length !== B.products.length) diffs.push(`${A.company.name || A.domain} lists ${A.products.length} extracted products versus ${B.products.length} for ${B.company.name || B.domain}.`);
    if ((A.pricing.length === 0) !== (B.pricing.length === 0)) diffs.push(`${(A.pricing.length ? A : B).company.name || (A.pricing.length ? A : B).domain} publishes public pricing; the other does not.`);
    else if (A.pricing.length && B.pricing.length && A.pricing[0]?.price !== B.pricing[0]?.price) diffs.push(`Pricing anchors differ — ${A.company.name || A.domain} from ${A.pricing[0].price}, ${B.company.name || B.domain} from ${B.pricing[0].price}.`);
    if ((A.services.length === 0) !== (B.services.length === 0)) diffs.push(`${(A.services.length ? A : B).company.name || (A.services.length ? A : B).domain} clearly documents services on the site; the other does not.`);
    const compA = A.insights.find((i) => i.title === "Competitor Signals");
    const compB = B.insights.find((i) => i.title === "Competitor Signals");
    if (compA && compB) diffs.push(`Both sites signal a competitive set: "${compA.summary.slice(0, 90)}…" vs "${compB.summary.slice(0, 90)}…".`);
    const common: string[] = [];
    if (A.company.industry && A.company.industry === B.company.industry) common.push(`Both sites operate in **${A.company.industry}**.`);
    if (A.analytics.technologies.length && B.analytics.technologies.length) {
      const shared = A.analytics.technologies.filter((t) => B.analytics.technologies.includes(t));
      if (shared.length) common.push(`Shared stack: ${shared.slice(0, 3).join(", ")}.`);
    }
    const questions: string[] = [];
    if (A.pricing.length && B.pricing.length) questions.push(`How does ${A.company.name || A.domain}'s pricing position against ${B.pricing[0].name} (${B.pricing[0].price}) on value delivered?`);
    if (A.products.length && B.products.length) questions.push(`Where do the two product lines overlap, and which gaps give ${A.company.name || A.domain} an opening?`);
    return { diffs, common, questions };
  }, [result]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Compare Websites</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">Pick up to three analyzed websites to line up their business, products, pricing and positioning.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {chosen.map((id) => {
            const o = options.find((x) => x.id === id);
            if (!o) return null;
            return (
              <div key={id} className="flex items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-50 px-3 py-2 text-[12.5px] font-medium text-ink dark:bg-indigo-950/40">
                <IconGlobe size={14} className="text-brand-600" />
                {o.site.company.name || o.site.domain}
                <button onClick={() => setSelected((s) => s.filter((x) => x !== id))} className="text-ink-muted hover:text-red-500">×</button>
              </div>
            );
          })}
          {chosen.length < 3 && (
            <select
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id && !selected.includes(id)) setSelected((s) => [...s, id]);
              }}
              className="h-9 rounded-xl border border-line bg-surface px-2 text-[12.5px] text-ink-muted hover:border-brand-500/50"
            >
              <option value="">+ Add website ({options.length} analyzed)</option>
              {options
                .filter((o) => !selected.includes(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.site.company.name || o.site.domain}
                  </option>
                ))}
            </select>
          )}
          <div className="ml-auto">
            <Button onClick={compare} disabled={chosen.length < 2} className="flex items-center gap-1.5">
              <IconCompare size={15} />
              Compare Websites
            </Button>
          </div>
        </div>
        {chosen.length < 2 && (
          <div className="mt-3 text-[12px] text-ink-muted">Select at least two analyzed websites. Analyze sites first from the top bar, or open past conversations that already have intelligence.</div>
        )}
      </Card>

      {result && result.length >= 2 && (
        <div className="animate-fade-up space-y-4">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 border-b border-line bg-gray-50/60 px-3 py-3 sm:grid-cols-[160px_1fr_1fr_1fr] sm:gap-3 dark:bg-white/5">
              <div />
              {result.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  {r.site.company.logo ? (
                    <img src={r.site.company.logo} alt="" className="h-7 w-7 rounded-lg object-contain" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">
                      {(r.site.company.name || r.site.domain).slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-ink">{r.site.company.name || r.site.domain}</div>
                    <button onClick={() => onOpen(r.id)} className="text-[11px] text-brand-600 hover:underline">
                      Open conversation →
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Row label="Industry" values={result.map((r) => r.site.company.industry || "Not found on the website")} />
            <Row label="Founded" values={result.map((r) => r.site.company.founded || "Not found on the website")} />
            <Row label="Headquarters" values={result.map((r) => r.site.company.headquarters || "Not found on the website")} />
            <Row label="Business model" values={result.map((r) => r.site.company.businessModel || "Not stated")} />
            <Row label="Description" values={result.map((r) => (r.site.company.description || "No description found").slice(0, 220))} />
            <Row
              label="Products"
              values={result.map((r) =>
                r.site.products.length
                  ? r.site.products.slice(0, 5).map((p) => `${p.name}${p.price ? ` · ${p.price}` : ""}`).join("\n")
                  : "No products found"
              )}
            />
            <Row label="Services" values={result.map((r) => (r.site.services.length ? r.site.services.slice(0, 5).map((s) => s.name).join("\n") : "No services found"))} />
            <Row
              label="Pricing"
              values={result.map((r) => (r.site.pricing.length ? r.site.pricing.slice(0, 3).map((p) => `${p.name}: ${p.price || "custom"}`).join("\n") : "Public pricing not found"))}
            />
            <Row
              label="Target customers"
              values={result.map((r) => {
                const ins = r.site.insights.find((i) => i.title === "Target Audience");
                return (ins?.summary || "Not found on the website").slice(0, 160);
              })}
            />
            <Row label="Stack" values={result.map((r) => (r.site.analytics.technologies.length ? r.site.analytics.technologies.slice(0, 4).join(", ") : "Not detected"))} />
            <Row
              label="Metrics"
              values={result.map((r) => `${r.site.products.length} products · ${r.site.services.length} services · ${r.site.pricing.length} pricing · ${r.site.images.length} images`)}
            />
          </Card>

          {summary && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-4 lg:col-span-2">
                <SectionLabel className="mb-2">AI comparison summary</SectionLabel>
                <div className="space-y-2 text-[13px] leading-6 text-ink">
                  {summary.diffs.map((d, i) => (
                    <Bullet key={i}>{d}</Bullet>
                  ))}
                  {summary.diffs.length === 0 && <div>The two sites share very similar surface positioning; deeper product/page analysis is needed for differentiation.</div>}
                </div>
              </Card>
              <div className="space-y-4">
                <Card className="p-4">
                  <SectionLabel className="mb-2">Common areas</SectionLabel>
                  <div className="space-y-2 text-[12.5px] leading-5 text-ink">
                    {summary.common.length ? summary.common.map((c, i) => <Bullet key={i}>{c}</Bullet>) : "Fewer shared characteristics were detected between the two sites."}
                  </div>
                </Card>
                <Card className="p-4">
                  <SectionLabel className="mb-2">Questions worth investigating</SectionLabel>
                  <div className="space-y-2 text-[12.5px] leading-5 text-ink">
                    {summary.questions.length ? summary.questions.map((q, i) => <Bullet key={i}>{q}</Bullet>) : "Compare a third website to deepen the analysis."}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {options.length === 0 && (
        <EmptyState
          icon={<IconCompare size={30} />}
          title="No analyzed websites yet"
          hint="Analyze at least two websites — then come back here to compare them."
        />
      )}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
      <span>{children}</span>
    </div>
  );
}