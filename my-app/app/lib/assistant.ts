import type { Evidence, PdfDocument, SiteAnalysis } from "./types";

function parsePrice(value: string | undefined): number | null {
  if (!value) return null;
  const clean = value.replace(/[^0-9.,]/g, "").replace(/,(\d{3})/g, "$1");
  const n = parseFloat(clean);
  return Number.isNaN(n) ? null : n;
}

export interface AssistantReply {
  text: string;
  sources: Evidence[];
}

const DOC_STOP = new Set([
  "the", "and", "for", "with", "this", "that", "are", "was", "were", "will", "have", "has", "had", "but", "not",
  "you", "your", "our", "from", "they", "them", "what", "when", "where", "which", "who", "how", "can", "could",
  "should", "would", "about", "into", "than", "then", "there", "their", "also", "only", "just", "its", "very",
  "more", "most", "all", "any", "each", "such", "some", "these", "those", "a", "an", "of", "in", "on", "to", "is",
  "be", "or", "as", "at", "by", "do", "does", "did", "we", "us", "up", "down", "out", "over", "under",
]);

function docTerms(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0600-\u06FF\u0400-\u04FF]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !DOC_STOP.has(t));
}

function answerFromDocuments(question: string, documents: PdfDocument[]): AssistantReply {
  const doc = documents[documents.length - 1];
  const q = question.toLowerCase();
  const docName = doc.name;
  const body = (doc.text || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const source: Evidence = { label: "Document", value: docName, sourceUrl: docName, sourcePage: "Documents tab" };

  if (!body) {
    return {
      text: `**${docName}** could not be read as text — it appears to be scanned or image-based, so there is no extractable content to summarize.`,
      sources: [source],
    };
  }

  const readIntent =
    /(summar|khalasa|khulasa|overview|what('s| is) in|what('s| is) written|written|content|likha|read|extract|dekh|daikh|dikh|porho|parho|sara data|poora data|data mn)/i.test(q);
  const terms = docTerms(q);

  if (readIntent || terms.length === 0) {
    const pageLabel = doc.pages === 1 ? "1 page" : `${doc.pages} pages`;
    const excerpt = body.slice(0, 2400);
    const tail =
      body.length > excerpt.length
        ? `\n\n…and the document continues (${pageLabel}, ${body.length.toLocaleString()} characters in total). Ask me to read a specific part or tell me what topic to find.`
        : "";
    return { text: `Here's what **${docName}** contains:\n\n${excerpt}${tail}`, sources: [source] };
  }

  if (terms.length) {
    const paragraphs = body.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
    const scored = paragraphs
      .map((p) => ({ p, score: terms.reduce((s, t) => s + (p.toLowerCase().includes(t) ? Math.min(1, p.length / 400) : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    if (scored.length) {
      return {
        text: `Looking for that in **${docName}**, here's what the document says:\n\n${scored.map((x) => x.p.trim()).join("\n\n").slice(0, 2400)}`,
        sources: [source],
      };
    }
  }

  return {
    text: `I couldn't find anything matching that in **${docName}**. Ask me to summarize the document, or open the Documents tab on the right to read the full extracted text.`,
    sources: [source],
  };
}

export function answerQuestion(question: string, site: SiteAnalysis | null): AssistantReply {
  const q = question.toLowerCase().trim();
  const domain = site?.domain || "";
  const companyName = site?.company?.name || domain;

  const header = `Based on my analysis of ${companyName} (${domain}):\n\n`;

  if (!site) {
    return {
      text:
        "Paste a website URL above and click **Analyze Website**. Once I've browsed the site, I can answer questions about its products, pricing, services and business.",
      sources: [],
    };
  }

  const docs = site.documents || [];
  const docOnlySite =
    site.origin === "pdf" || (docs.length > 0 && !site.products.length && !site.services.length && !site.pricing.length);
  const docExplicitAsk =
    /(document|pdf\b|file\b|what('s| is) in|what('s| is) written|likha|written|content|summar|khalasa|overview|dekh|daikh|dikh|read|extract|data mn|sara data|poora data)/i.test(
      q
    );
  if (docOnlySite || (docs.length > 0 && docExplicitAsk)) {
    return answerFromDocuments(q, docs);
  }

  const lengths: Record<string, boolean> = {
    "cheapest product": site.products.length > 0 && /cheap|lowest|least expensive|best price|most affordable/i.test(q),
    "list products": site.products.length > 0 && /(^|\s)(products?|catalog|items?|offerings?|range)(\s|$)/.test(q) && /\b(all|list|show|what|which|about)\b/.test(q),
    services: site.services.length > 0 && /service|what do they offer|solutions|what do they do/i.test(q),
    pricing: /price|pricing|cost|how much|plans|subscription|free trial/i.test(q),
    report: /report/i.test(q),
    compare: /compare|versus|vs\b|competitor analysis/i.test(q),
    competitors: /competitor|who else|market position|rival/i.test(q),
    contact: /contact|email|phone|reach|address|location/i.test(q),
    audience: /target|audience|customer|customers|who (is|are|does)|buyer/i.test(q),
    faq: /faq|question|answers?|troubleshoot/i.test(q),
    about: /what (is|does)|about|summary|overview|who are they|company/i.test(q),
    insights: /insight|strategy|strength|weakness|opportunity|marketing|seo|business model/i.test(q),
  };

  const matched = Object.keys(lengths).find((k) => lengths[k]);

  const out: string[] = [];
  const sources: Evidence[] = [];

  const addS = (s: Evidence) => {
    if (!sources.some((x) => x.label === s.label && x.sourceUrl === s.sourceUrl)) sources.push(s);
  };

  if (matched === "cheapest product") {
    const withPrice = site.products.filter((p) => parsePrice(p.price) !== null);
    if (withPrice.length) {
      withPrice.sort((a, b) => (parsePrice(a.price) as number) - (parsePrice(b.price) as number));
      const p = withPrice[0];
      out.push(`The cheapest product I found is **${p.name}** at **${p.price}**.`);
      if (p.description) out.push(`\n${p.description}`);
      addS({ label: `Price`, value: `${p.name} — ${p.price}`, sourceUrl: p.sourceUrl, sourcePage: p.sourceUrl.split("/").filter(Boolean).slice(-1)[0] });
    } else {
      out.push("I couldn't compare prices — the products I extracted don't have publicly listed prices.");
    }
  } else if (matched === "list products") {
    if (site.products.length) {
      out.push(`I found **${site.products.length} product${site.products.length === 1 ? "" : "s"}**:`);
      const seen = new Set<string>();
      for (const p of site.products.slice(0, 12)) {
        if (seen.has(p.name)) continue;
        seen.add(p.name);
        out.push(`\n- **${p.name}**${p.price ? ` — ${p.price}` : ""}${p.category ? ` (${p.category})` : ""}`);
        addS({ label: "Product", value: `${p.name}${p.price ? ` — ${p.price}` : ""}`, sourceUrl: p.sourceUrl, sourcePage: p.sourceUrl.split("/").filter(Boolean).slice(-1)[0] });
      }
      if (site.products.length > 12) out.push(`\n…and ${site.products.length - 12} more. Open the Website Intelligence panel to browse them all.`);
    } else {
      out.push("I couldn't extract a product catalog from this site.");
    }
  } else if (matched === "services") {
    if (site.services.length) {
      out.push(`The site lists **${site.services.length} service${site.services.length === 1 ? "" : "s"}**:`);
      const seen = new Set<string>();
      for (const s of site.services.slice(0, 10)) {
        if (seen.has(s.name)) continue;
        seen.add(s.name);
        out.push(`\n- **${s.name}**${s.description ? ` — ${s.description}` : ""}`);
        addS({ label: "Service", value: s.name, sourceUrl: s.sourceUrl, sourcePage: s.sourceUrl.split("/").filter(Boolean).slice(-1)[0] || "/" });
      }
    } else {
      out.push("No services section was found on the analyzed pages.");
    }
  } else if (matched === "pricing") {
    if (site.pricing.length) {
      out.push(`I found **${site.pricing.length} pricing entry${site.pricing.length === 1 ? "" : "s"}**:`);
      for (const p of site.pricing.slice(0, 10)) {
        out.push(`\n- **${p.name}** — ${p.price || "on request"}${p.period ? ` (${p.period})` : ""}${p.features?.length ? `\n  ${p.features.map((f) => `· ${f}`).join("\n  ")}` : ""}`);
        addS({ label: "Plan", value: `${p.name} — ${p.price || "n/a"}`, sourceUrl: p.sourceUrl, sourcePage: p.sourceUrl.split("/").filter(Boolean).slice(-1)[0] || "/" });
      }
      addS({ label: "Pricing page", value: site.pricing[0].sourceUrl, sourceUrl: site.pricing[0].sourceUrl });
    } else {
      out.push("**Public pricing was not found** on the analyzed pages. Prices may be available only after signup or a sales call.");
    }
  } else if (matched === "report") {
    out.push("You can generate a structured business report from everything I extracted. Open the **Reports** tab in the sidebar and click **Generate Report** to create an executive summary you can export as PDF or CSV.");
  } else if (matched === "compare") {
    out.push("Comparison works best with two or more websites. Open the **Compare** tab, add the competitor's URL, and I'll line up their company, products, pricing and positioning side by side.");
  } else if (matched === "competitors") {
    const comp = site.insights.find((i) => i.title === "Competitor Signals");
    if (comp && comp.summary && !comp.summary.includes("does not name competitors")) {
      out.push(comp.summary);
      addS({ label: "Competitor signal", value: comp.summary.split(":").slice(1).join(":").trim().slice(0, 120), sourceUrl: comp.evidence[0]?.sourceUrl || site.origin });
    } else {
      out.push("The site doesn't name competitors openly. To learn more, run the Compare view with a competitor website.");
    }
  } else if (matched === "contact") {
    const c = site.company;
    const bits: string[] = [];
    if (c.email) bits.push(`Email: **${c.email}**`);
    if (c.phone) bits.push(`Phone: **${c.phone}**`);
    if (c.address) bits.push(`Address: **${c.address}**`);
    if (c.headquarters) bits.push(`Headquarters: **${c.headquarters}**`);
    if (c.socials.length) bits.push(`Social: ${c.socials.map((s) => `${s.network} — ${s.url}`).join(", ")}`);
    if (bits.length) {
      out.push(bits.join("\n"));
      addS({ label: "Contact page", value: `${site.origin}/contact`, sourceUrl: `${site.origin}/contact` });
    } else {
      out.push("I didn't find public contact details on the analyzed pages (no email, phone or address).");
    }
  } else if (matched === "audience") {
    const insight = site.insights.find((i) => i.title === "Target Audience");
    const summary = insight?.summary || "No clear target audience signals were found in the copy.";
    out.push(summary);
    for (const e of insight?.evidence || []) addS(e);
  } else if (matched === "faq") {
    if (site.faqs.length) {
      out.push(`I found **${site.faqs.length} FAQ item${site.faqs.length === 1 ? "" : "s"}**:`);
      for (const f of site.faqs.slice(0, 6)) {
        out.push(`\n**Q: ${f.question}**\n${f.answer}`);
        addS({ label: "FAQ", value: f.question.slice(0, 110), sourceUrl: f.sourceUrl, sourcePage: f.sourceUrl.split("/").filter(Boolean).slice(-1)[0] || "/" });
      }
    } else {
      out.push("No FAQ section was found on the analyzed pages.");
    }
  } else if (matched === "about") {
    const c = site.company;
    const bits: string[] = [];
    if (c.description) bits.push(c.description);
    const facts: string[] = [];
    if (c.founded) facts.push(`Founded: ${c.founded}`);
    if (c.headquarters) facts.push(`Headquarters: ${c.headquarters}`);
    if (c.industry) facts.push(`Industry: ${c.industry}`);
    if (c.businessModel) facts.push(`Business model: ${c.businessModel}`);
    if (facts.length) bits.push(facts.join("\n"));
    if (site.products.length) bits.push(`They publish ${site.products.length} product${site.products.length === 1 ? "" : "s"} and ${site.services.length} service${site.services.length === 1 ? "" : "s"}.`);
    if (site.pricing.length) bits.push(`Public pricing was found for ${site.pricing.length} plan${site.pricing.length === 1 ? "" : "s"}.`);
    if (!bits.length) bits.push("Not much company detail was found. Some websites publish very little corporate information.");
    out.push(bits.join("\n\n"));
    if (c.founded) addS({ label: "Founded", value: c.founded, sourceUrl: site.origin, sourcePage: "About" });
    if (c.headquarters) addS({ label: "Headquarters", value: c.headquarters, sourceUrl: site.origin, sourcePage: "About" });
    addS({ label: "Website", value: site.origin, sourceUrl: site.origin });
  } else if (matched === "insights") {
    const sections = site.insights.filter((i) => !["Questions to Investigate"].includes(i.title));
    if (sections.length) {
      out.push("Here are the key intelligence takeaways from this site:");
      for (const s of sections.slice(0, 5)) {
        out.push(`\n**${s.title}**\n${s.summary}`);
        for (const e of s.evidence.slice(0, 2)) addS(e);
      }
    } else {
      out.push("I don't have enough data to produce insights for this site yet.");
    }
  } else {
    const firstInsight = site.insights.find((i) => i.title === "Business Summary");
    out.push(firstInsight?.summary || `${companyName} has been analyzed (${domain}).`);
    if (site.products.length || site.services.length || site.pricing.length) {
      out.push(`\n\nQuick facts:\n- **${site.products.length} products** found\n- **${site.services.length} services** found\n- **${site.pricing.length} pricing entries** found`);
    }
    out.push("\n\nYou can ask me things like: *\"What are their main services?\"*, *\"Which product is cheapest?\"* or *\"Summarize their business model.\"*");
  }

  return { text: (header + out.join("\n")).trim(), sources };
}

/** Optional LLM path. Returns null when no OPENAI_API_KEY is configured or the call fails. */
export async function answerWithLLM(question: string, site: SiteAnalysis | null): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const context = summarizeContext(site);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are CommerceLens AI, an ecommerce fashion advisor and website analyst. Answer ONLY from the provided context (verified website evidence and any uploaded documents). Never invent pricing, facts or pages. If something is not in the context, say it was not found. When a question asks about an uploaded document file or \"the data\", answer from that document's text and quote it where useful. Cite a source page name when possible.",
          },
          {
            role: "user",
            content: `WEBSITE CONTEXT:\n${context}\n\nQUESTION: ${question}`,
          },
        ],
        max_tokens: 700,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || null;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null;
  }
}

export function summarizeContext(site: SiteAnalysis | null): string {
  if (!site) return "No website has been analyzed yet.";
  const s: string[] = [];
  const c = site.company;
  s.push(`Company: ${c.name || "unknown"} | Domain: ${site.domain} | Origin: ${site.origin}`);
  if (c.description) s.push(`Description: ${c.description}`);
  if (c.industry) s.push(`Industry: ${c.industry}`);
  if (c.founded) s.push(`Founded: ${c.founded}`);
  if (c.headquarters) s.push(`Headquarters: ${c.headquarters}`);
  if (c.email) s.push(`Email: ${c.email}`);
  if (c.phone) s.push(`Phone: ${c.phone}`);
  if (c.businessModel) s.push(`Business model: ${c.businessModel}`);
  if (c.socials.length) s.push(`Socials: ${c.socials.map((x) => `${x.network}: ${x.url}`).join(", ")}`);
  if (site.pages.length) s.push(`Pages analyzed (${site.pages.length}): ${site.pages.map((p) => `${p.title} (${p.url})`).join("; ")}`);
  if (site.products.length) s.push(`Products (${site.products.length}): ${site.products.map((p) => `${p.name}${p.price ? ` ${p.price}` : ""}`).join("; ")}`);
  if (site.services.length) s.push(`Services (${site.services.length}): ${site.services.map((p) => p.name).join("; ")}`);
  if (site.pricing.length) s.push(`Pricing (${site.pricing.length}): ${site.pricing.map((p) => `${p.name}: ${p.price || "custom"}`).join("; ")}`);
  if (site.faqs.length) s.push(`FAQs: ${site.faqs.map((f) => `Q:${f.question} A:${f.answer}`).join(" | ")}`);
  if (site.images.length) s.push(`Images extracted: ${site.images.length} (first: ${site.images[0].src})`);
  if (site.insights.length) s.push(`Insights: ${site.insights.map((i) => `${i.title}: ${i.summary}`).join(" | ")}`);
  if (site.warnings.length) s.push(`Warnings: ${site.warnings.join(" | ")}`);
  if (site.documents?.length) {
    for (const d of site.documents) {
      s.push(`Document "${d.name}" (${d.pages} pages, ${d.text.length} chars):\n${d.text.slice(0, 6000)}`);
    }
  }
  if (site.demo) s.push("NOTE: This is demo data, not a live crawl.");
  return s.join("\n");
}