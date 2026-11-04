"use client";

import React, { useMemo, useState } from "react";
import type { Conversation, SiteAnalysis } from "@/app/lib/types";
import { Button, Card, EmptyState, SectionLabel, useToast } from "./ui";
import { IconFileText, IconDownload, IconPrinter, IconCopy } from "./icons";

type ReportKind = "intelligence" | "business" | "competitor" | "products" | "marketing" | "seo" | "executive";

const KINDS: Array<{ key: ReportKind; label: string }> = [
  { key: "executive", label: "Executive Summary" },
  { key: "intelligence", label: "Website Intelligence Report" },
  { key: "business", label: "Business Analysis" },
  { key: "competitor", label: "Competitor Analysis" },
  { key: "products", label: "Product Analysis" },
  { key: "marketing", label: "Marketing Analysis" },
  { key: "seo", label: "SEO Analysis" },
];

interface ReportSection {
  title: string;
  lines: string[];
}

function buildReport(site: SiteAnalysis, kind: ReportKind): ReportSection[] {
  const S: ReportSection[] = [];
  const c = site.company;
  const add = (title: string, lines: string[]) => S.push({ title, lines });

  add("Company Overview", [
    `${c.name || site.domain} — ${site.domain}`,
    `Website: ${c.website}`,
    `Industry: ${c.industry || "Not found on the website"}`,
    `Founded: ${c.founded || "Not found on the website"}`,
    `Headquarters: ${c.headquarters || "Not found on the website"}`,
    `Business model: ${c.businessModel || "Not stated"}`,
    `Description: ${c.description || "Not found on the website"}`,
    `Email: ${c.email || "Not found"} · Phone: ${c.phone || "Not found"}`,
  ]);

  add("Methodology & Sources", [
    `Analysis run via CommerceLens AI. The agent crawled and parsed publicly accessible pages of ${site.domain}.`,
    `Pages analyzed: ${site.pages.filter((p) => p.accessed).length} (${site.pages.filter((p) => !p.accessed).length} could not be accessed).`,
    `Respected robots.txt where present. All facts below come with a source page the reader can verify.`,
    ...site.warnings.map((w) => `Warning: ${w}`),
  ]);

  const overview = site.insights.find((i) => i.title === "Business Summary");
  const audience = site.insights.find((i) => i.title === "Target Audience");
  const competitors = site.insights.find((i) => i.title === "Competitor Signals");
  const pricingInsight = site.insights.find((i) => i.title === "Pricing Strategy");

  add("Findings — AI Insights", [overview?.summary || "", audience?.summary || "", pricingInsight?.summary || ""].filter(Boolean));

  if (site.products.length || kind !== "products") {
    add("Products", site.products.length ? site.products.slice(0, 40).map((p) => `- ${p.name}${p.category ? ` (${p.category})` : ""}: ${p.price || "price on request"} — ${p.sourceUrl}`) : ["No products were published in an accessible format."]);
  }
  add("Services", site.services.length ? site.services.slice(0, 30).map((s) => `- ${s.name}${s.description ? ` — ${s.description.slice(0, 120)}` : ""} — ${s.sourceUrl}`) : ["No services section found."]);
  add("Pricing", site.pricing.length ? site.pricing.slice(0, 20).map((p) => `- ${p.name}: ${p.price || "on request"}${p.period ? ` (${p.period})` : ""} — ${p.sourceUrl}`) : ["Public pricing was not found on the analyzed pages."]);

  add("Content & SEO", [
    `Title: ${site.analytics.title || "No title tag"}`,
    `Description: ${site.analytics.description || "No meta description"}`,
    `Keywords: ${site.analytics.keywords?.join(", ") || "not set"}`,
    `Technologies: ${site.analytics.technologies.join(", ") || "not detected"}`,
    `Internal links: ${site.analytics.internalLinks} · External links: ${site.analytics.externalLinks}`,
    `Headings collected: ${site.analytics.headings.length}`,
    ...site.analytics.missingMeta,
  ]);

  add("Competitor Signals", [competitors?.summary || "The site does not name competitors openly."]);

  if (site.faqs.length) add("Frequently Asked Questions", site.faqs.slice(0, 10).map((f) => `Q: ${f.question}\nA: ${f.answer}\nSource: ${f.sourceUrl}`));

  add("Extracted Images", site.images.length ? site.images.slice(0, 10).map((i) => `${i.alt || "image"} — ${i.src}`) : ["No images extracted."]);

  const meta = [
    `Report type: ${KINDS.find((k) => k.key === kind)?.label}`,
    `Generated: ${new Date(site.analyzedAt).toLocaleString()}`,
    `Source: ${site.demo ? "Demo dataset (not a live crawl)" : site.origin}`,
    `Analysis status: ${site.status}`,
  ];
  add("Report Information", meta);

  return S;
}

function csvEscape(v: string) {
  return `"${(v || "").replace(/"/g, '""')}"`;
}

export default function ReportsView({
  conversations,
  currentSite,
}: {
  conversations: Conversation[];
  currentSite: SiteAnalysis | null;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<ReportKind>("executive");
  const [generated, setGenerated] = useState<SiteAnalysis | null>(null);

  const candidates = useMemo(() => conversations.filter((c) => c.site), [conversations]);

  const pickSite = (id: string) => {
    const conv = candidates.find((c) => c.id === id);
    setGenerated(conv?.site || null);
  };

  const chosenSite = generated || currentSite;

  const sections = useMemo(
    () => (chosenSite ? buildReport(chosenSite, kind) : []),
    [chosenSite, kind]
  );

  const reportText = useMemo(
    () =>
      sections
        .map((s) => `## ${s.title}\n\n${s.lines.join("\n")}`)
        .join("\n\n")
        .replace(/- /g, "- "),
    [sections]
  );

  const exportPDF = () => {
    if (!chosenSite) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${chosenSite.company.name || chosenSite.domain} — WebMind Report</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;color:#111;margin:32px;max-width:820px;margin:auto}
h1{font-size:22px;margin-bottom:4px}h2{border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:22px;font-size:15px;text-transform:uppercase;letter-spacing:.5px;color:#333}
p,li{font-size:13px;line-height:1.6}.mono{font-family:monospace;font-size:12px}
.meta{color:#555;font-size:12px;margin-bottom:18px}
</style></head><body>
<h1>${escapeHtml(chosenSite.company.name || chosenSite.domain)}</h1>
<div class="meta">CommerceLens AI — ${escapeHtml(KINDS.find((k) => k.key === kind)?.label || "")} · ${new Date().toLocaleString()} · ${chosenSite.demo ? "Demo data" : chosenSite.origin}</div>
${sections.map((s) => `<h2>${escapeHtml(s.title)}</h2>${s.lines.map((l) => `<p>${escapeHtml(l).replace(/\n/g, "<br>")}</p>`).join("")}`).join("")}
</body></html>`;
    const w = window.open("", "_blank", "width=920,height=760");
    if (!w) {
      toast("Allow pop-ups to export the PDF.", "error");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 350);
  };

  const exportCSV = () => {
    if (!chosenSite) return;
    const rows: string[][] = [];
    for (const p of chosenSite.products) rows.push(["Product", p.name, p.category || "", p.price || "", "", p.sourceUrl]);
    for (const s of chosenSite.services) rows.push(["Service", s.name, "", "", s.description || "", s.sourceUrl]);
    for (const p of chosenSite.pricing) rows.push(["Pricing", p.name, "", p.price || "", (p.period || "") + (p.features ? " · " + p.features.join(" | ") : ""), p.sourceUrl]);
    const csv = "Type,Name,Category,Price,Details,Source\n" + rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    downloadBlob(csv, `${chosenSite.domain}-extracted-data.csv`, "text/csv;charset=utf-8");
    toast("CSV exported.", "success");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      toast("Report copied to clipboard.", "success");
    } catch {
      toast("Could not copy.", "error");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Reports</h1>
        <p className="mt-0.5 max-w-xl text-[13px] text-ink-muted">
          Build a structured business report from the evidence collected during analysis. Every claim carries its source page.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 sm:max-w-xs">
            <SectionLabel className="mb-1.5">Website</SectionLabel>
            <select
              value={generated ? generated.domain : currentSite?.domain || ""}
              onChange={(e) => {
                const conv = candidates.find((c) => c.site?.domain === e.target.value);
                if (conv) pickSite(conv.id);
                else setGenerated(null);
              }}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[13px] text-ink focus:border-brand-500/50 focus:outline-none"
            >
              {!currentSite && candidates.length === 0 && <option value="">No analyzed sites yet</option>}
              {(currentSite && !generated ? [{ id: "current", name: currentSite.company.name || currentSite.domain, domain: currentSite.domain }] : []).slice(0, 1).map((s) => (
                <option key="current" value={s.domain}>{s.name} (current)</option>
              ))}
              {candidates.map((c) => (
                <option key={c.id} value={c.site?.domain || ""}>
                  {c.site?.company.name || c.site?.domain} {c.site?.demo ? "(demo)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 sm:max-w-xl">
            <SectionLabel className="mb-1.5">Report type</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={
                    "rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors " +
                    (kind === k.key
                      ? "border-brand-500/50 bg-brand-50 text-brand-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "border-line text-ink-muted hover:border-brand-500/40 hover:text-ink")
                  }
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => setGenerated(chosenSite)} disabled={!chosenSite} className="flex items-center gap-1.5">
            <IconFileText size={15} />
            Generate Report
          </Button>
        </div>
      </Card>

      {(generated || chosenSite) ? (
        <div className="animate-fade-up">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SectionLabel className="mr-1">Export</SectionLabel>
            <Button variant="secondary" size="sm" onClick={exportPDF}>
              <IconPrinter size={14} /> PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <IconDownload size={14} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={copyReport}>
              <IconCopy size={14} /> Copy
            </Button>
          </div>

          <div id="report-root">
            <Card className="p-6 sm:p-8">
            <div className="mb-5 border-b border-line pb-4">
              <div className="flex items-center gap-2">
                {chosenSite?.company.logo && <img src={chosenSite.company.logo} alt="" className="h-9 w-9 rounded-lg object-contain" />}
                <div>
                  <h2 className="text-[16px] font-semibold text-ink">{chosenSite?.company.name || chosenSite?.domain}</h2>
                  <div className="text-[11.5px] text-ink-muted">
                    {KINDS.find((k) => k.key === kind)?.label} · {new Date().toLocaleString()} ·{" "}
                    {chosenSite?.demo ? "Demo data (not a live crawl)" : chosenSite?.origin}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {sections.map((s, i) => (
                <div key={i}>
                  <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-brand-600">{s.title}</h3>
                  <div className="space-y-1">
                    {s.lines.map((l, j) => (
                      <p key={j} className="whitespace-pre-wrap text-[13px] leading-6 text-ink">{l}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<IconFileText size={30} />}
          title="No report generated yet"
          hint="Analyze a website first, or pick an analyzed site above, then click Generate Report."
        />
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function downloadBlob(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}