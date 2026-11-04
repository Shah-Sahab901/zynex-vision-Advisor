import { uid, type SiteAnalysis } from "./types";

const SRC = "https://aurora-analytics.com";

const IMG = (label: string, bg: string, fg = "#ffffff"): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="${fg}" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
  )}`;

export function demoAnalysis(): SiteAnalysis {
  const prices = [
    { name: "Starter", price: "$29/mo" },
    { name: "Growth", price: "$79/mo" },
    { name: "Enterprise", price: "Custom" },
  ];

  const productNames = ["Revenue Pulse", "Forecast Engine", "Segment Finder", "Funnel Lens"];
  const products = productNames.map((n, i) => ({
    id: uid(),
    name: n,
    category: "Analytics",
    price: (i + 1) * 12 + 15 === 27 ? "$27" : i % 2 ? "$59" : "$39",
    image: IMG(n.slice(0, 12), ["#6366f1", "#8b5cf6", "#3b82f6", "#06b6d4"][i]),
    description: `A ${n.toLowerCase()} module that turns raw website and app data into decisions-ready dashboards for analysts and growth teams.`,
    features: ["Real-time dashboards", "Automated reports", "Team sharing", "API access"],
    rating: 4.5 + i * 0.1,
    availability: "InStock",
    sourceUrl: `${SRC}/products/${n.toLowerCase().replace(/ /g, "-")}`,
  }));

  const services = [
    { id: uid(), name: "Implementation & Onboarding", description: "Guided setup of analytics, data connectors and team training.", sourceUrl: `${SRC}/services#implementation` },
    { id: uid(), name: "Custom Dashboards", description: "Bespoke reporting built by our data team for your KPIs.", sourceUrl: `${SRC}/services#custom` },
    { id: uid(), name: "Enterprise Support", description: "Priority support, SLAs and a dedicated account manager.", sourceUrl: `${SRC}/services#support` },
  ];

  const pricing = prices.map((p, i) => ({
    id: uid(),
    name: p.name,
    price: p.price,
    period: i === 2 ? undefined : "monthly",
    features: i === 2 ? ["Unlimited events", "Custom SLAs", "Dedicated support"] : [i === 0 ? "10,000 events / mo" : "100,000 events / mo", "Core dashboards", "Email support"],
    sourceUrl: `${SRC}/pricing`,
  }));

  const images = [
    { id: uid(), src: IMG("Revenue pulse", "#6366f1"), alt: "Revenue Pulse dashboard", pageUrl: `${SRC}/products/revenue-pulse` },
    { id: uid(), src: IMG("Forecast engine", "#8b5cf6"), alt: "Forecast Engine chart", pageUrl: `${SRC}/products/forecast-engine` },
    { id: uid(), src: IMG("Segment finder", "#3b82f6"), alt: "Segment Finder heatmap", pageUrl: `${SRC}/products/segment-finder` },
    { id: uid(), src: IMG("Funnel lens", "#06b6d4"), alt: "Funnel Lens conversion board", pageUrl: `${SRC}/products/funnel-lens` },
  ];

  return {
    status: "complete",
    demo: true,
    analyzedAt: new Date().toISOString(),
    origin: SRC,
    domain: "aurora-analytics.com",
    company: {
      name: "Aurora Analytics",
      website: SRC,
      domain: "aurora-analytics.com",
      tagline: "Product analytics without the headache",
      description:
        "Aurora Analytics is a product analytics platform that helps SaaS teams understand user behavior, forecast revenue and reduce churn.",
      logo: IMG("A", "#6366f1", "#ffffff"),
      industry: "SaaS / Product Analytics",
      founded: "2018",
      headquarters: "Austin, Texas",
      email: "hello@aurora-analytics.com",
      businessModel: "Subscription SaaS with tiered monthly plans",
      socials: [
        { network: "Twitter / X", url: "https://x.com/aurora_analytics" },
        { network: "LinkedIn", url: "https://linkedin.com/company/aurora-analytics" },
      ],
    },
    pages: [
      { url: `${SRC}/`, title: "Aurora Analytics — Product analytics", description: "Understand user behavior, forecast revenue, reduce churn.", headings: ["Product analytics without the headache", "Pricing", "Customers"], linksCount: 42, imagesCount: 6, accessed: true },
      { url: `${SRC}/about`, title: "About Aurora Analytics", description: "We're a team of data people building analytics for everyone.", headings: ["Our story", "Our team"], linksCount: 18, imagesCount: 4, accessed: true },
      { url: `${SRC}/products`, title: "Products", headings: ["Revenue Pulse", "Forecast Engine", "Segment Finder", "Funnel Lens"], linksCount: 24, imagesCount: 8, accessed: true },
      { url: `${SRC}/pricing`, title: "Pricing", headings: ["Starter", "Growth", "Enterprise"], linksCount: 12, imagesCount: 2, accessed: true },
      { url: `${SRC}/services`, title: "Services", headings: ["Implementation & Onboarding", "Custom Dashboards", "Enterprise Support"], linksCount: 9, imagesCount: 3, accessed: true },
      { url: `${SRC}/customers`, title: "Customers", headings: ["Namedrop", "How teams use Aurora"], linksCount: 14, imagesCount: 5, accessed: true },
    ],
    products,
    services,
    pricing,
    images,
    faqs: [
      { question: "How long does implementation take?", answer: "Most teams go live in under a week with our guided onboarding.", sourceUrl: `${SRC}/faq` },
      { question: "Is there a free trial?", answer: "Yes — the Starter plan includes a 14-day trial with no credit card.", sourceUrl: `${SRC}/pricing` },
    ],
    analytics: {
      title: "Aurora Analytics — Product analytics",
      description: "Understand user behavior, forecast revenue, reduce churn.",
      keywords: ["product analytics", "saas", "churn", "revenue forecasting"],
      headings: ["Product analytics without the headache", "Pricing", "Customers", "Revenue Pulse", "Forecast Engine"],
      technologies: ["Next.js", "Vercel", "Stripe", "Google Analytics"],
      internalLinks: 118,
      externalLinks: 9,
      missingMeta: [],
      pagesAnalyzed: 6,
      productCount: 4,
      serviceCount: 3,
      imageCount: 4,
      pricingCount: 3,
    },
    insights: [
      {
        title: "Business Summary",
        summary:
          "Aurora Analytics is a subscription SaaS that sells product analytics software. The site describes the product as a way to understand user behavior, forecast revenue and reduce churn, targeting SaaS and product teams.",
        evidence: [
          { label: "Company", value: "Aurora Analytics", sourceUrl: SRC, sourcePage: "Homepage" },
          { label: "Business model", value: "Subscription SaaS with tiered monthly plans", sourceUrl: `${SRC}/pricing` },
        ],
      },
      {
        title: "Target Audience",
        summary: "The copy targets SaaS teams, product managers and growth/marketing teams. This is inferred from the demo site copy.",
        evidence: [{ label: "Audience signal", value: "SaaS teams, product managers", sourceUrl: SRC, sourcePage: "Homepage" }],
      },
      {
        title: "Products & Services",
        summary: "4 modules (Revenue Pulse, Forecast Engine, Segment Finder, Funnel Lens) and 3 services were extracted.",
        evidence: [
          { label: "Product", value: "Revenue Pulse — $39", sourceUrl: `${SRC}/products/revenue-pulse` },
          { label: "Service", value: "Enterprise Support", sourceUrl: `${SRC}/services` },
        ],
      },
      {
        title: "Pricing Strategy",
        summary: "3 public plans: Starter ($29/mo), Growth ($79/mo), Enterprise (Custom). Price anchors shift buyers toward the Growth plan.",
        evidence: [{ label: "Plan", value: "Growth — $79/mo", sourceUrl: `${SRC}/pricing` }],
      },
      {
        title: "Competitor Signals",
        summary: "The site references 'excelsheets and legacy BI tools' as alternatives, implying lightweight BI tools are the competitive set.",
        evidence: [{ label: "Competitor mentioned", value: "Legacy business-intelligence tools", sourceUrl: `${SRC}/about` }],
      },
      {
        title: "Content & SEO Observations",
        summary: "Pages analyzed: 6. FAQ found: 2. Stack detected: Next.js, Vercel, Stripe, Google Analytics.",
        evidence: [
          { label: "Technology detected", value: "Next.js, Vercel, Stripe, Google Analytics", sourceUrl: SRC },
          { label: "FAQ", value: "How long does implementation take?", sourceUrl: `${SRC}/faq` },
        ],
      },
      {
        title: "Business Opportunities",
        summary: "A 4-module catalog plus onboarding services creates an opportunity to bundle product + services into an annual package.",
        evidence: [],
      },
      {
        title: "Questions to Investigate",
        summary: "Is the Starter plan self-serve with no human touch? Do Enterprise plans include implementation with a dated roadmap?",
        evidence: [],
      },
    ],
    warnings: ["This is DEMO data. It is not a live crawl of aurora-analytics.com."],
    isPartial: false,
  };
}