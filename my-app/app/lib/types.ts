export type AnalysisStatus = "idle" | "running" | "complete" | "error" | "partial";

export interface AgentAction {
  id: string;
  label: string;
  detail?: string;
  state: "pending" | "active" | "done" | "error";
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  price?: string;
  currency?: string;
  image?: string;
  description?: string;
  features?: string[];
  rating?: number;
  availability?: string;
  sourceUrl: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  sourceUrl: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price?: string;
  period?: string;
  features?: string[];
  sourceUrl: string;
}

export interface ImageItem {
  id: string;
  src: string;
  alt?: string;
  pageUrl: string;
}

export interface PdfDocument {
  id: string;
  name: string;
  size: number;
  pages: number;
  text: string;
  uploadedAt: string;
}

export interface ImageIntelligence {
  id: string;
  name: string;
  src: string;
  mime?: string;
  width?: number;
  height?: number;
  sourceUrl?: string;
  label?: string;
  addedAt: string;
}

export interface ImageMatch {
  productId: string;
  productName: string;
  productPrice?: string;
  productImage?: string;
  sourceUrl: string;
  confidence: "high" | "medium";
  reason: string;
}

export interface PageInfo {
  url: string;
  title: string;
  description?: string;
  headings: string[];
  linksCount: number;
  imagesCount: number;
  accessed: boolean;
  error?: string;
}

export interface FAQ {
  question: string;
  answer: string;
  sourceUrl: string;
}

export interface SocialLink {
  network: string;
  url: string;
}

export interface CompanyInfo {
  name?: string;
  website: string;
  domain: string;
  tagline?: string;
  description?: string;
  logo?: string;
  industry?: string;
  founded?: string;
  headquarters?: string;
  email?: string;
  phone?: string;
  address?: string;
  businessModel?: string;
  socials: SocialLink[];
}

export interface Analytics {
  title?: string;
  description?: string;
  keywords?: string[];
  headings: string[];
  technologies: string[];
  internalLinks: number;
  externalLinks: number;
  missingMeta: string[];
  pagesAnalyzed: number;
  productCount: number;
  serviceCount: number;
  imageCount: number;
  pricingCount: number;
}

export interface Evidence {
  label: string;
  value?: string;
  sourceUrl: string;
  sourcePage?: string;
}

export interface SiteInsight {
  title: string;
  summary: string;
  evidence: Evidence[];
}

export interface SiteAnalysis {
  status: AnalysisStatus;
  demo?: boolean;
  analyzedAt: string;
  origin: string;
  domain: string;
  company: CompanyInfo;
  pages: PageInfo[];
  products: Product[];
  services: Service[];
  pricing: PricingPlan[];
  images: ImageItem[];
  faqs: FAQ[];
  analytics: Analytics;
  insights: SiteInsight[];
  warnings: string[];
  isPartial?: boolean;
  documents?: PdfDocument[];
  imageAnalysis?: ImageIntelligence;
  imageMatch?: ImageMatch;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  createdAt: string;
  sources?: Evidence[];
  actions?: AgentAction[];
  speaking?: boolean;
  pending?: boolean;
  analyzing?: boolean;
  feedback?: "up" | "down";
  demo?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  site: SiteAnalysis | null;
  messages: ChatMessage[];
}

export type ViewKey = "assistant" | "websites" | "insights" | "compare" | "reports" | "settings";

export interface AnalyzeEvent {
  type: "log" | "step" | "complete" | "error";
  message?: string;
  stepId?: string;
  state?: "active" | "done" | "error";
  detail?: string;
  data?: SiteAnalysis;
}

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);