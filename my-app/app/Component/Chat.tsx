"use client";

import React, { useEffect, useRef, useState } from "react";
import type { AgentAction, ChatMessage, SiteAnalysis } from "@/app/lib/types";
import AgentActivity from "./AgentActivity";
import VoiceButton from "./VoiceButton";
import { Badge, Button, cn, CopyButton, GhostIcon, RichText, SectionLabel } from "./ui";
import {
  IconSend,
  IconSparkles,
  IconGlobe,
  IconExternal,
  IconThumbsUp,
  IconThumbsDown,
  IconRefresh,
  IconPlay,
  IconStop,
  IconMessage,
  IconPanel,
  IconLink,
} from "./icons";

const CHAT_URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/i;

export const DEFAULT_AGENT_ACTIONS: AgentAction[] = [
  { id: "connect", label: "Connecting to website", state: "pending" },
  { id: "discover", label: "Discovering important pages", state: "pending" },
  { id: "extract", label: "Extracting structured data", state: "pending" },
  { id: "products", label: "Analyzing products", state: "pending" },
  { id: "services", label: "Understanding services", state: "pending" },
  { id: "pricing", label: "Extracting pricing", state: "pending" },
  { id: "images", label: "Collecting images", state: "pending" },
  { id: "faq", label: "Analyzing FAQs", state: "pending" },
  { id: "analytics", label: "Analyzing content & metadata", state: "pending" },
  { id: "insights", label: "Building website intelligence", state: "pending" },
  { id: "complete", label: "Analysis complete", state: "pending" },
];

const SUGGESTIONS: Array<{ label: string; prompt: string }> = [
  { label: "What does this company sell?", prompt: "What does this company sell?" },
  { label: "Which product is cheapest?", prompt: "Which product is cheapest?" },
  { label: "What are their main services?", prompt: "What are their main services?" },
  { label: "Summarize their pricing", prompt: "Summarize their pricing" },
  { label: "Business report", prompt: "Create a business report" },
];

function AgentProgressMsg({
  actions,
  detail,
  domain,
  analyzing,
  onStop,
}: {
  actions: AgentAction[];
  detail?: string;
  domain?: string;
  analyzing: boolean;
  onStop: () => void;
}) {
  return (
    <div className="flex justify-start animate-fade-up">
      <div className="w-full max-w-xl">
        <div className="mb-1 flex items-center gap-2 px-1">
          <SectionLabel>Agent Activity</SectionLabel>
          {analyzing && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-50"
            >
              <IconStop size={11} /> Cancel
            </button>
          )}
        </div>
        <AgentActivity actions={actions} detail={detail} domain={domain} running={analyzing} />
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onFeedback,
  onSpeak,
  speakingId,
  onRegenerate,
  isLast,
}: {
  message: ChatMessage;
  onFeedback: (id: string, dir: "up" | "down") => void;
  onSpeak: (id: string) => void;
  speakingId: string | null;
  onRegenerate: () => void;
  isLast: boolean;
}) {
  const showActions = !message.pending;

  return (
    <div className="animate-fade-up flex justify-start">
      <div className="min-w-0 max-w-[760px]">
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <IconSparkles size={11} />
          </div>
          <SectionLabel>CommerceLens AI</SectionLabel>
          {message.demo && <Badge tone="violet">Demo</Badge>}
        </div>

        <div className="text-[15px] leading-7 text-ink">
          {message.pending && !message.content ? (
            <div className="flex items-center gap-2 py-1 text-[14px] text-ink-muted">
              <span className="agent-pulse h-2 w-2 rounded-full bg-indigo-500" />
              Thinking…
            </div>
          ) : (
            <div className={cn("break-words pr-2", message.pending && "streaming-caret")}>
              <RichText text={message.content} />
            </div>
          )}

          {message.sources && message.sources.length > 0 && !message.pending && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted/80">
                <IconLink size={11} /> Sources · click to verify
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.sources.slice(0, 5).map((s, i) => (
                  <a
                    key={i}
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.sourcePage || s.sourceUrl}
                    className="inline-flex max-w-[240px] items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-brand-500/40 hover:text-brand-600"
                  >
                    <span className="truncate">{s.label}</span>
                    <IconExternal size={10} className="shrink-0" />
                  </a>
                ))}
                {message.sources.length > 5 && (
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] text-ink-muted">
                    +{message.sources.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {showActions && (
          <div className="mt-1.5 flex items-center gap-0.5 pl-1 opacity-0 transition-opacity hover:opacity-100">
            <CopyButton text={message.content} label="Copy response" />
            <GhostIcon title="Speak this answer" className={cn(speakingId === message.id && "text-brand-600")} onClick={() => onSpeak(message.id)}>
              {speakingId === message.id ? <IconStop size={14} /> : <IconPlay size={14} />}
            </GhostIcon>
            <GhostIcon title="Regenerate" onClick={onRegenerate}>
              <IconRefresh size={14} />
            </GhostIcon>
            <div className="mx-1 h-4 w-px bg-line" />
            <GhostIcon title="Helpful" onClick={() => onFeedback(message.id, "up")} className={cn(message.feedback === "up" && "text-emerald-500")}>
              <IconThumbsUp size={14} />
            </GhostIcon>
            <GhostIcon title="Not helpful" onClick={() => onFeedback(message.id, "down")} className={cn(message.feedback === "down" && "text-red-500")}>
              <IconThumbsDown size={14} />
            </GhostIcon>
            {isLast && <span className="ml-1 text-[10px] text-ink-muted/70">Ask a follow-up — the site context stays loaded.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="animate-fade-up flex justify-end">
      <div className="max-w-[640px]">
        <div className="mb-1 flex justify-end px-1">
          <SectionLabel>You</SectionLabel>
        </div>
        <div className="rounded-[22px] rounded-tr-md bg-gray-200/80 px-4 py-2.5 text-[14.5px] leading-6 text-ink dark:bg-white/10">
          {message.content}
        </div>
      </div>
    </div>
  );
}

export default function Chat({
  messages,
  analyzing,
  agentActions,
  agentDetail,
  agentDomain,
  site,
  streaming,
  querying,
  onSend,
  onStopStreaming,
  onServiceStop,
  onRegenerate,
  onSpeak,
  speakingId,
  onFeedback,
  onQuickQuestion,
  onOpenIntelligence,
  onAnalyzeUrl,
}: {
  messages: ChatMessage[];
  analyzing: boolean;
  agentActions: AgentAction[];
  agentDetail?: string;
  agentDomain?: string;
  site: SiteAnalysis | null;
  streaming: boolean;
  querying: boolean;
  onSend: (text: string) => void;
  onStopStreaming: () => void;
  onServiceStop: () => void;
  onRegenerate: () => void;
  onSpeak: (id: string) => void;
  speakingId: string | null;
  onFeedback: (id: string, dir: "up" | "down") => void;
  onQuickQuestion: (q: string) => void;
  onOpenIntelligence: () => void;
  onAnalyzeUrl: (url: string) => void;
}) {
  const [input, setInput] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, analyzing, voiceActive]);

  const send = () => {
    const t = input.trim();
    if (!t || streaming || querying) return;
    const urlMatch = t.match(CHAT_URL_RE);
    if (urlMatch) {
      const spokenUrl = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
      onAnalyzeUrl(spokenUrl);
      setInput("");
      return;
    }
    onSend(t);
    setInput("");
  };

  const hasMessages = messages.length > 0;

  const docContext = site?.documents?.length
    ? `\n\nUPLOADED DOCUMENT CONTEXT (answer questions about "the data", "the file" or "the document" from this text):\n${site.documents
        .map((d) => `[${d.name}] — ${d.pages} page${d.pages === 1 ? "" : "s"}:\n${d.text.slice(0, 6000)}`)
        .join("\n\n")}`
    : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink">AI Shopping Advisor</div>
          <div className="truncate text-[12px] text-ink-muted">
            {site ? (
              <>
                Study current context: <span className="font-medium text-brand-600">{site.company.name || site.domain}</span>
              </>
            ) : analyzing ? (
              "Browsing the website now…"
            ) : (
              "Ask me anything about this website"
            )}
          </div>
        </div>
        <button
          onClick={onOpenIntelligence}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-muted hover:bg-gray-50 lg:hidden"
        >
          <IconPanel size={14} /> Intelligence
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="mobile-chat-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-8">
        <div className="mx-auto max-w-[800px] space-y-6">
          {!hasMessages && !analyzing && (
            <EmptyChat site={site} onQuickQuestion={onQuickQuestion} />
          )}

          {messages.map((m, i) =>
            m.role === "agent" ? (
              <AgentProgressMsg
                key={m.id}
                actions={m.analyzing ? agentActions : m.actions || []}
                detail={agentDetail}
                domain={agentDomain}
                analyzing={m.analyzing ?? analyzing}
                onStop={onServiceStop}
              />
            ) : m.role === "user" ? (
              <UserBubble key={m.id} message={m} />
            ) : (
              <AssistantBubble
                key={m.id}
                message={m}
                onFeedback={onFeedback}
                onSpeak={onSpeak}
                speakingId={speakingId}
                onRegenerate={onRegenerate}
                isLast={i === messages.length - 1 || messages.length === 1}
              />
            )
          )}

          {querying && (
            <div className="flex items-center gap-2 text-[13px] text-ink-muted">
              <span className="agent-pulse h-2 w-2 rounded-full bg-indigo-500" />
              Generating answer…
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="mobile-composer px-4 pb-3 pt-2 sm:px-8">
        <div className="mx-auto max-w-[800px]">
          <div
            className={cn(
              "flex items-end gap-2 rounded-[28px] border bg-surface px-4 py-2.5 shadow-sm transition-colors focus-within:border-brand-500/50 focus-within:ring-4 focus-within:ring-brand-500/10",
              voiceActive ? "border-indigo-300" : "border-line"
            )}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={
                site
                  ? "Message AI Shopping Advisor…"
                  : "Message AI Shopping Advisor…"
              }
              className="max-h-32 min-h-[40px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-ink placeholder:text-ink-muted/60 focus:outline-none"
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
            />

            <VoiceButton
              onResult={(text) => setInput((v) => (v ? v + " " + text : text))}
              onListeningChange={setVoiceActive}
              disabled={streaming || querying}
              onWebsiteUrl={onAnalyzeUrl}
              context={site ? `ANALYSIS COMPLETE. Tell the user briefly that the data is ready in the right panel, then offer to explain it. Current verified website context: ${site.company.name || site.domain}. Domain: ${site.domain}. Products: ${site.products.length}. Services: ${site.services.length}. Pricing entries: ${site.pricing.length}. Images: ${site.images.length}. Top products: ${site.products.slice(0, 5).map((p) => `${p.name}${p.price ? ` (${p.price})` : ""}`).join("; ") || "none found"}.${docContext} Answer only from this verified context (website evidence and uploaded documents) and say when a detail is unavailable.` : "No data exists in the app yet. If the user asks about the right panel, the Intelligence/Documents panel, or what data is available, tell them honestly that the right panel is empty because nothing has been analyzed in the session yet. Then offer to analyze a website URL or upload a PDF (Documents). Never claim data exists when nothing has been analyzed."}
            />

            {streaming || querying ? (
              <Button variant="secondary" onClick={onStopStreaming} title="Stop generating">
                <IconStop size={16} />
              </Button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                title="Send (Enter)"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white transition-opacity hover:opacity-80 disabled:opacity-30 dark:bg-white dark:text-black"
              >
                <IconSend size={15} />
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-ink-muted/70">
            <span>Enter to send · Shift+Enter for a new line</span>
            {site && !site.demo && (
              <span className="flex items-center gap-1">
                <IconGlobe size={11} />
                {site.domain} · analyzed {new Date(site.analyzedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyChat({
  site,
  onQuickQuestion,
}: {
  site: SiteAnalysis | null;
  onQuickQuestion: (q: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 pt-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
        <IconMessage size={20} />
      </div>
      <h2 className="text-[clamp(24px,7vw,30px)] font-semibold tracking-tight text-ink">
        {site ? "What's on your mind?" : "What's on your agenda today?"}
      </h2>
      <p className="mt-2.5 max-w-md text-[13.5px] leading-6 text-ink-muted">
        {site
          ? site.origin === "pdf" || (site.documents?.length ? site.documents.length > 0 && !site.products.length && !site.services.length && !site.pricing.length : false)
            ? `The extracted text from **${site.company.name || site.domain}** is ready on the right. Ask me to summarize the document, read out what's written, or find a specific detail in it.`
            : `${site.company.name || site.domain} has been analyzed. Ask me anything — I'll answer with evidence from the pages I crawled.`
          : "Paste any website URL above, click Analyze Website, and I'll browse it, extract products, pricing and services, then answer your questions."}
      </p>

      {site ? (
        <div className="mt-7 grid w-full max-w-[640px] grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => onQuickQuestion(s.prompt)}
              className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-left text-[13px] font-medium text-ink transition-all hover:border-brand-500/50 hover:shadow-sm"
            >
              <span className="min-w-0 break-words">{s.label}</span>
              <IconSparkles size={14} className="shrink-0 text-brand-500" />
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-5 py-4 text-[13px] text-ink-muted">
          <IconGlobe size={16} className="shrink-0 text-brand-500" />
          No website analyzed yet — try{" "}
          <code className="font-mono">https://example.com</code> or click{" "}
          <button onClick={() => onQuickQuestion("__demo__")} className="font-semibold text-violet-500 hover:underline">
            Demo
          </button>{" "}
          for an instant example.
        </div>
      )}
    </div>
  );
}