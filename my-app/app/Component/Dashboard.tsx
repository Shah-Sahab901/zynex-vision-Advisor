"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentAction, AnalyzeEvent, ChatMessage, Conversation, SiteAnalysis, ViewKey } from "@/app/lib/types";
import { uid } from "@/app/lib/types";
import { ToastProvider, useToast, Card, EmptyState, SectionLabel } from "./ui";
import { IconEye, IconExternal } from "./icons";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Chat, { DEFAULT_AGENT_ACTIONS } from "./Chat";
import IntelligencePanel from "./IntelligencePanel";
import WebsitesView from "./WebsitesView";
import CompareView from "./CompareView";
import ReportsView from "./ReportsView";
import SettingsView from "./SettingsView";
import { answerQuestion } from "@/app/lib/assistant";
import { findImageMatchOnSite } from "@/app/lib/imagematcher";
import type { PdfDocument } from "@/app/lib/types";

const LS_CONV = "webmind-conversations-v1";
const LS_DARK = "webmind-dark";
const LS_DEMO = "webmind-demo";

function loadConvs(): Conversation[] {
  try {
    const raw = localStorage.getItem(LS_CONV);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveConvs(convs: Conversation[]) {
  try {
    localStorage.setItem(LS_CONV, JSON.stringify(convs));
  } catch {
    /* storage full or unavailable */
  }
}

export default function Dashboard() {
  const toast = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>("assistant");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [agentActions, setAgentActions] = useState<AgentAction[]>(DEFAULT_AGENT_ACTIONS);
  const [agentDetail, setAgentDetail] = useState("");
  const [agentDomain, setAgentDomain] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const bootedRef = useRef(false);

  const analyzeAbort = useRef<AbortController | null>(null);
  const streamAbort = useRef<AbortController | null>(null);
  const agentActionsRef = useRef<AgentAction[]>(DEFAULT_AGENT_ACTIONS);

  useEffect(() => {
    const t = setTimeout(() => {
      bootedRef.current = true;
      setConversations(loadConvs());
      setIsDark(typeof window !== "undefined" && localStorage.getItem(LS_DARK) === "1");
      setDemoMode(typeof window !== "undefined" && localStorage.getItem(LS_DEMO) === "1");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setSideOpen(false);
        setIntelOpen(false);
      }
    };
    const mqAny = mq as unknown as {
      addEventListener?: (t: string, cb: (e: MediaQueryListEvent) => void) => void;
      addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
      removeEventListener?: (t: string, cb: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
    };
    if (typeof mqAny.addEventListener === "function") mqAny.addEventListener("change", onChange);
    else mqAny.addListener?.(onChange);
    return () => {
      if (typeof mqAny.removeEventListener === "function") mqAny.removeEventListener("change", onChange);
      else mqAny.removeListener?.(onChange);
    };
  }, []);

  useEffect(() => {
    if (!bootedRef.current) return;
    saveConvs(conversations);
  }, [conversations]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(LS_DARK, isDark ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DEMO, demoMode ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [demoMode]);

  const setLiveActions = (fn: (prev: AgentAction[]) => AgentAction[]) => {
    const next = fn(agentActionsRef.current);
    agentActionsRef.current = next;
    setAgentActions(next);
  };

  const activeConversation = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);
  const activeSite = activeConversation?.site || null;

  const updateMessage = (convId: string, msgId: string, patch: Partial<ChatMessage>) => {
    setConversations((cs) =>
      cs.map((c) =>
        c.id === convId
          ? {
              ...c,
              updatedAt: new Date().toISOString(),
              messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
            }
          : c
      )
    );
  };

  const stopAnalyze = useCallback(() => {
    analyzeAbort.current?.abort();
    setAnalyzing(false);
  }, []);

  const stopStreaming = useCallback(() => {
    streamAbort.current?.abort();
    setStreaming(false);
  }, []);

  const ensureConversation = (title: string, description: string): Conversation => {
    const existing = conversations.find((c) => c.id === activeId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: uid(),
      title,
      description,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      site: null,
      messages: [],
    };
    setConversations((cs) => [conv, ...cs]);
    setActiveId(conv.id);
    setView("assistant");
    return conv;
  };

  const finalizeAnalysis = (convId: string, site: SiteAnalysis) => {
    const snapshot: AgentAction[] = agentActionsRef.current;
    setAnalyzing(false);
    setAgentDetail("");
    const n = site.pages.filter((p) => p.accessed).length;
    const summary = `✓ Analysis complete — ${n} page${n === 1 ? "" : "s"} analyzed, ${site.products.length} product${site.products.length === 1 ? "" : "s"} found, ${site.services.length} service${site.services.length === 1 ? "" : "s"} identified, ${site.pricing.length} pricing entr${site.pricing.length === 1 ? "y" : "ies"} and ${site.images.length} image${site.images.length === 1 ? "" : "s"} extracted from ${site.domain}.`;
    const greeting = site.demo
      ? `I used the **demo dataset** for ${site.company.name || site.domain} (sample data, not a live crawl). I've extracted the business info, products, pricing and services. Open the Website Intelligence panel to browse them, or ask me a question.`
      : `I've finished analyzing **${site.company.name || site.domain}** (${site.domain}). I browsed ${n} accessible page${n === 1 ? "" : "s"}, extracted ${site.products.length} product${site.products.length === 1 ? "" : "s"}, ${site.services.length} service${site.services.length === 1 ? "" : "s"} and ${site.pricing.length} pricing entr${site.pricing.length === 1 ? "y" : "ies"}. You'll find everything with sources in the Website Intelligence panel.`;
    const imageNote = site.imageAnalysis
      ? `\n\nYour attached image **${site.imageAnalysis.name}** is bound to this report — open the **Image** tab on the right to see it.${
          site.imageMatch
            ? `\n\n✅ **Image match found:** **${site.imageMatch.productName}**${
                site.imageMatch.productPrice ? ` at **${site.imageMatch.productPrice}**` : ""
              } — the matching data was pulled from that site (${site.imageMatch.confidence} confidence).`
            : ""
        }`
      : "";
    setConversations((cs) =>
      cs.map((c) =>
        c.id === convId
          ? {
              ...c,
              title: `${site.company.name || site.domain} Website Analysis`,
              description: site.demo ? "Demo website intelligence report" : site.origin === "image" ? "Image-bound website intelligence report" : "Complete website intelligence report",
              site,
              messages: [
                ...c.messages.filter((m) => !m.analyzing && m.role !== "agent"),
                { id: uid(), role: "agent" as const, content: summary, createdAt: new Date().toISOString(), actions: snapshot, analyzing: false },
                { id: uid(), role: "assistant" as const, content: greeting + imageNote, createdAt: new Date().toISOString() },
              ],
            }
          : c
      )
    );
    toast(`Analysis complete for ${site.domain}`, "success");
  };

  const markAnalysisFailed = (convId: string, message: string) => {
    const snapshot: AgentAction[] = agentActionsRef.current.map((a) => (a.state === "active" ? { ...a, state: "error" as const } : a));
    setAnalyzing(false);
    setAgentDetail("");
    setConversations((cs) =>
      cs.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: [
                ...c.messages.filter((m) => !m.analyzing && m.role !== "agent"),
                { id: uid(), role: "agent" as const, content: "Analysis failed", createdAt: new Date().toISOString(), actions: snapshot, analyzing: false },
                { id: uid(), role: "assistant" as const, content: `${message}\n\nFix the URL and try again, or run the instant **Demo** instead.`, createdAt: new Date().toISOString() },
              ],
            }
          : c
      )
    );
    toast(message || "Analysis failed.", "error");
  };

  const analyze = async (input?: string, forceDemo = false) => {
    const useDemo = forceDemo;
    const value = input !== undefined ? input : url;
    if (!useDemo && !value.trim()) {
      toast("Paste a website URL first.", "error");
      return;
    }
    const conv = ensureConversation("Analyzing website…", useDemo ? "Instant demo analysis" : "Website analysis in progress");
    const domain = useDemo ? "aurora-analytics.com" : value.trim().replace(/^https?:\/\//i, "").split("/")[0];
    const convId = conv.id;

    setLiveActions((as) => as.map((a) => ({ ...a, state: "pending" as const })));
    setAgentDetail("");
    setAgentDomain(domain);
    setAnalyzing(true);
    setConversations((cs) =>
      cs.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: uid(), role: "agent" as const, content: "", createdAt: new Date().toISOString(), actions: [], analyzing: true }] }
          : c
      )
    );
    setView("assistant");

    const ctrl = new AbortController();
    analyzeAbort.current = ctrl;

    const markActive = (id: string) => setLiveActions((as) => as.map((a) => (a.id === id ? { ...a, state: "active" as const } : a)));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value, demoMode: useDemo || demoMode }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Analysis failed." }));
        throw new Error((err as { error?: string }).error || "Analysis failed.");
      }

      await readLines(res, ctrl.signal, (obj: unknown) => {
        const ev = obj as AnalyzeEvent;
        if (ev.type === "log" && ev.message) {
          const msg = ev.message.toLowerCase();
          if (msg.startsWith("connecting")) markActive("connect");
          else if (msg.startsWith("discovering")) markActive("discover");
          else if (msg.startsWith("extracting structured")) markActive("extract");
          else if (msg.startsWith("analyzing products")) markActive("products");
          else if (msg.startsWith("understanding services")) markActive("services");
          else if (msg.startsWith("extracting pricing")) markActive("pricing");
          else if (msg.startsWith("collecting images")) markActive("images");
          else if (msg.startsWith("analyzing faqs")) markActive("faq");
          else if (msg.startsWith("analyzing content")) markActive("analytics");
          else if (msg.startsWith("building website")) markActive("insights");
          else if (msg.startsWith("analysis complete")) setLiveActions((as) => as.map((a) => ({ ...a, state: "done" as const })));
        }
        if (ev.type === "step") {
          const id = ev.stepId || "";
          if (id === "homepage") {
            setLiveActions((as) => as.map((a) => (a.id === "connect" ? { ...a, state: ev.state || "done" } : a)));
          } else if (DEFAULT_AGENT_ACTIONS.some((a) => a.id === id)) {
            setLiveActions((as) => as.map((a) => (a.id === id ? { ...a, state: ev.state || "done", detail: ev.detail } : a)));
          } else {
            if (ev.state === "active") setAgentDetail(ev.detail || "Reading page…");
            if (ev.state === "done") setAgentDetail("");
            if (ev.state === "error") {
              setAgentDetail("");
              setLiveActions((as) => as.map((a) => (a.id === "connect" ? { ...a, state: "error" as const, detail: ev.detail } : a)));
            }
          }
        }
        if (ev.type === "complete" && ev.data) finalizeAnalysis(convId, ev.data);
        if (ev.type === "error" && ev.message) markAnalysisFailed(convId, ev.message);
      });
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        markAnalysisFailed(convId, (err as Error).message || "Unable to access this website.");
      }
    }
  };

  const analyzePdf = async (file: File) => {
    const conv = ensureConversation(`${file.name} PDF Analysis`, "PDF document intelligence");
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/analyze/pdf", { method: "POST", body: form });
      const raw = await response.text();
      let body: { document?: PdfDocument; error?: string } = {};
      try {
        body = raw ? (JSON.parse(raw) as { document?: PdfDocument; error?: string }) : {};
      } catch {
        body = { error: `PDF service returned an invalid response (${response.status}).` };
      }
      if (!response.ok || !body.document) throw new Error(body.error || "PDF analysis failed.");
      const document = body.document;
      setConversations((cs) => cs.map((c) => {
        if (c.id !== conv.id) return c;
        const existing = c.site;
        const site: SiteAnalysis = existing ? { ...existing, documents: [...(existing.documents || []), document] } : {
          status: "complete", analyzedAt: document.uploadedAt, origin: "pdf", domain: file.name,
          company: { website: "", domain: file.name, socials: [] }, pages: [], products: [], services: [], pricing: [], images: [], faqs: [], analytics: { headings: [], technologies: [], internalLinks: 0, externalLinks: 0, missingMeta: [], pagesAnalyzed: 0, productCount: 0, serviceCount: 0, imageCount: 0, pricingCount: 0 }, insights: [], warnings: [], documents: [document],
        };
        return {
          ...c,
          site,
          title: `${file.name} PDF Analysis`,
          description: "PDF document intelligence report",
          updatedAt: new Date().toISOString(),
          messages: [
            ...c.messages,
            {
              id: uid(),
              role: "assistant" as const,
              content: `I've analyzed **${file.name}**. The extracted text (${document.pages} page${document.pages === 1 ? "" : "s"}) is ready in the **Documents** tab on the right. Ask me to summarize it, read out what's written, or find a specific detail in the data.`,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }));
      toast(`PDF analyzed: ${file.name}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF analysis failed.";
      setConversations((cs) => cs.map((c) => c.id === conv.id ? {
        ...c,
        messages: [...c.messages, { id: uid(), role: "assistant" as const, content: `I couldn't analyze **${file.name}**. ${message}`, createdAt: new Date().toISOString() }],
      } : c));
      toast(message, "error");
    }
  };

  const analyzeImage = async (opts: { url: string; image?: string; imageUrl?: string; hint?: string }) => {
    const value = opts.url.trim();
    if (!value) {
      toast("Paste a website URL first to fetch data together with the image.", "error");
      return;
    }
    const conv = ensureConversation("Analyzing website from image…", "Image-bound website analysis");
    const domain = value.replace(/^https?:\/\//i, "").split("/")[0];
    const convId = conv.id;

    setLiveActions((as) => as.map((a) => ({ ...a, state: "pending" as const })));
    setAgentDetail("");
    setAgentDomain(domain);
    setAnalyzing(true);
    setConversations((cs) =>
      cs.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: uid(), role: "agent" as const, content: "", createdAt: new Date().toISOString(), actions: [], analyzing: true }] }
          : c
      )
    );
    setView("assistant");

    const ctrl = new AbortController();
    analyzeAbort.current = ctrl;

    const markActive = (id: string) => setLiveActions((as) => as.map((a) => (a.id === id ? { ...a, state: "active" as const } : a)));

    try {
      const res = await fetch("/api/analyze/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value, image: opts.image, imageUrl: opts.imageUrl, hint: opts.hint }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Analysis failed." }));
        throw new Error((err as { error?: string }).error || "Analysis failed.");
      }

      await readLines(res, ctrl.signal, (obj: unknown) => {
        const ev = obj as AnalyzeEvent;
        if (ev.type === "log" && ev.message) {
          const msg = ev.message.toLowerCase();
          if (msg.startsWith("connecting")) markActive("connect");
          else if (msg.startsWith("discovering")) markActive("discover");
          else if (msg.startsWith("extracting structured")) markActive("extract");
          else if (msg.startsWith("analyzing products")) markActive("products");
          else if (msg.startsWith("understanding services")) markActive("services");
          else if (msg.startsWith("extracting pricing")) markActive("pricing");
          else if (msg.startsWith("collecting images")) markActive("images");
          else if (msg.startsWith("analyzing faqs")) markActive("faq");
          else if (msg.startsWith("analyzing content")) markActive("analytics");
          else if (msg.startsWith("building website")) markActive("insights");
          else if (msg.startsWith("analysis complete")) setLiveActions((as) => as.map((a) => ({ ...a, state: "done" as const })));
        }
        if (ev.type === "step") {
          const id = ev.stepId || "";
          if (id === "homepage") {
            setLiveActions((as) => as.map((a) => (a.id === "connect" ? { ...a, state: ev.state || "done" } : a)));
          } else if (DEFAULT_AGENT_ACTIONS.some((a) => a.id === id)) {
            setLiveActions((as) => as.map((a) => (a.id === id ? { ...a, state: ev.state || "done", detail: ev.detail } : a)));
          } else {
            if (ev.state === "active") setAgentDetail(ev.detail || "Reading page…");
            if (ev.state === "done") setAgentDetail("");
            if (ev.state === "error") {
              setAgentDetail("");
              setLiveActions((as) => as.map((a) => (a.id === "connect" ? { ...a, state: "error" as const, detail: ev.detail } : a)));
            }
          }
        }
        if (ev.type === "complete" && ev.data) {
          const data = ev.data;
          if (data.imageAnalysis) {
            void (async () => {
              let patched = data;
              try {
                const match = await findImageMatchOnSite(data, data.imageAnalysis?.label);
                if (match && (!data.imageMatch || data.imageMatch.confidence === "medium")) {
                  patched = { ...data, imageMatch: match };
                }
              } catch {
                /* keep the server-side match */
              }
              finalizeAnalysis(convId, patched);
            })();
          } else {
            finalizeAnalysis(convId, data);
          }
        }
        if (ev.type === "error" && ev.message) markAnalysisFailed(convId, ev.message);
      });
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        markAnalysisFailed(convId, (err as Error).message || "Unable to access this website.");
      }
    }
  };

  const sendMessage = (text: string) => {
    if (analyzing || streaming) return;
    if (text === "__demo__") {
      analyze(undefined, true);
      return;
    }
    const now = new Date().toISOString();
    let conv = conversations.find((c) => c.id === activeId) || null;
    if (!conv) {
      conv = ensureConversation("New conversation", text.slice(0, 60));
    }
    const convId = conv.id;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, createdAt: now };
    const botMsg: ChatMessage = { id: uid(), role: "assistant", content: "", createdAt: now, pending: true };
    setConversations((cs) => cs.map((c) => (c.id === convId ? { ...c, updatedAt: now, messages: [...c.messages, userMsg, botMsg] } : c)));
    setView("assistant");
    setStreaming(true);

    const ctrl = new AbortController();
    streamAbort.current = ctrl;
    const siteSnapshot = conv.site;

    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, site: siteSnapshot }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error("Failed to get a response.");
        let content = "";
        let lastError: string | null = null;
        await readLines(res, ctrl.signal, (obj: unknown) => {
          const line = obj as { delta?: unknown; done?: unknown; text?: unknown; error?: unknown };
          if (typeof line.delta === "string") {
            content += line.delta;
            updateMessage(convId, botMsg.id, { content });
          }
          if (line.done && typeof line.text === "string") content = line.text;
          if (typeof line.error === "string") lastError = line.error;
        });
        const sources = siteSnapshot ? answerQuestion(text, siteSnapshot).sources : [];
        updateMessage(convId, botMsg.id, {
          content: lastError ? `I ran into an issue: ${lastError}` : content,
          pending: false,
          sources,
        });
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          updateMessage(convId, botMsg.id, { content: "Sorry, I couldn't reach the assistant service. Please try again.", pending: false });
        }
      } finally {
        setStreaming(false);
      }
    })();
  };

  const regenerate = () => {
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv) return;
    const msgs = conv.messages;
    let userMsg: ChatMessage | null = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant" && msgs[i].pending) return;
      if (msgs[i].role === "assistant") {
        const prev = msgs[i - 1];
        if (prev && prev.role === "user") {
          userMsg = prev;
          setConversations((cs) => cs.map((c) => (c.id === conv.id ? { ...c, messages: c.messages.filter((_, idx) => idx !== i) } : c)));
          break;
        }
      }
      if (msgs[i].role === "agent") break;
    }
    if (userMsg) sendMessage(userMsg.content);
  };

  const onQuickQuestion = (q: string) => {
    if (q === "__demo__") {
      analyze(undefined, true);
    } else {
      sendMessage(q);
    }
  };

  const speak = (msgId: string) => {
    if (speakingId === msgId) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
      return;
    }
    const conv = conversations.find((c) => c.id === activeId);
    const msg = conv?.messages.find((m) => m.id === msgId);
    if (!msg?.content) return;
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(msg.content.replace(/\*\*/g, "").replace(/`/g, ""));
    u.rate = 1.02;
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis?.speak(u);
  };

  const feedback = (msgId: string, dir: "up" | "down") => {
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv) return;
    updateMessage(conv.id, msgId, { feedback: dir });
    toast(dir === "up" ? "Thanks for the feedback." : "Thanks — this helps the assistant improve.", "success");
  };

  const newChat = useCallback(() => {
    stopAnalyze();
    stopStreaming();
    const now = new Date().toISOString();
    const conv: Conversation = { id: uid(), title: "New Chat", description: "Start a conversation with CommerceLens AI", createdAt: now, updatedAt: now, pinned: false, site: null, messages: [] };
    setConversations((cs) => [conv, ...cs]);
    setActiveId(conv.id);
    setView("assistant");
  }, [stopAnalyze, stopStreaming]);

  const openConversation = (id: string) => {
    stopAnalyze();
    stopStreaming();
    setActiveId(id);
    setView("assistant");
    setSideOpen(false);
    setIntelOpen(false);
  };

  const togglePin = (id: string) => setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));

  const renameConv = (id: string, current: string) => {
    const next = window.prompt("Rename conversation", current || "Untitled");
    if (next && next.trim()) {
      setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: next.trim() } : c)));
      toast("Conversation renamed.", "success");
    }
  };

  const deleteConv = (id: string) => {
    if (!window.confirm("Delete this conversation?")) return;
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) {
      const rest = conversations.filter((c) => c.id !== id);
      setActiveId(rest[0]?.id || null);
    }
    toast("Conversation deleted.", "success");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  const clearAll = () => {
    setConversations([]);
    setActiveId(null);
    setUrl("");
    toast("All data cleared.", "success");
  };

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-background font-sans text-ink">
        <div
          aria-hidden={!sideOpen}
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ease-out lg:hidden ${sideOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={() => setSideOpen(false)}
        />
        {intelOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setIntelOpen(false)}
          />
        )}
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          view={view}
          onView={(v) => {
            setView(v);
            setSideOpen(false);
          }}
          onOpen={openConversation}
          onNewChat={newChat}
          onRename={renameConv}
          onDelete={deleteConv}
          onTogglePin={togglePin}
          open={sideOpen}
          onClose={() => setSideOpen(false)}
          isDark={isDark}
          onToggleDark={() => setIsDark(!isDark)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            url={url}
            onUrlChange={setUrl}
            onAnalyze={(input) => {
              if (!analyzing) analyze(input);
            }}
            onDemo={() => analyze(undefined, true)}
            analyzing={analyzing}
            onStop={stopAnalyze}
            site={activeSite}
            onOpenSidebar={() => setSideOpen(true)}
            onAutoAnalyze={(value) => {
              if (!analyzing) analyze(value);
            }}
            onPdfAnalyze={analyzePdf}
            onImageAnalyze={analyzeImage}
          />

          <main className="relative flex min-h-0 flex-1">
            {view === "assistant" && (
              <div className="min-w-0 flex-1">
                <Chat
                  messages={activeConversation?.messages || []}
                  analyzing={analyzing}
                  agentActions={agentActions}
                  agentDetail={agentDetail}
                  agentDomain={agentDomain}
                  site={activeSite}
                  streaming={streaming}
                  querying={false}
                  onSend={sendMessage}
                  onStopStreaming={stopStreaming}
                  onServiceStop={stopAnalyze}
                  onRegenerate={regenerate}
                  onSpeak={speak}
                  speakingId={speakingId}
                  onFeedback={feedback}
                  onQuickQuestion={onQuickQuestion}
                  onOpenIntelligence={() => setIntelOpen(true)}
                  onAnalyzeUrl={(spokenUrl) => {
                    setUrl(spokenUrl);
                    if (!analyzing) analyze(spokenUrl);
                  }}
                />
              </div>
            )}

            {view === "websites" && (
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <WebsitesView conversations={conversations} onOpen={openConversation} />
              </div>
            )}

            {view === "insights" && (
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <InsightsPage site={activeSite} onAnalyze={() => onQuickQuestion("__demo__")} />
              </div>
            )}

            {view === "compare" && (
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <CompareView conversations={conversations} currentSite={activeSite} onOpen={openConversation} />
              </div>
            )}

            {view === "reports" && (
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <ReportsView conversations={conversations} currentSite={activeSite} />
              </div>
            )}

            {view === "settings" && (
              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <SettingsView
                  isDark={isDark}
                  onToggleDark={() => setIsDark(!isDark)}
                  demoMode={demoMode}
                  onToggleDemoMode={() => setDemoMode(!demoMode)}
                  onClearAll={clearAll}
                />
              </div>
            )}

            <IntelligencePanel site={activeSite} open={intelOpen} onClose={() => setIntelOpen(false)} />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

/* ---------------- Insights page (right-hand nav view) ---------------- */
function InsightsPage({ site, onAnalyze }: { site: SiteAnalysis | null; onAnalyze: () => void }) {
  if (!site) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={<IconEye size={30} />}
          title="No insights generated yet"
          hint="Analyze a website first — the AI turns the extracted evidence into business insights, with sources you can verify."
          action={
            <button onClick={onAnalyze} className="rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white">
              Analyze the demo
            </button>
          }
        />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">AI Business Insights</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Generated from collected website evidence for <span className="font-medium text-brand-600">{site.company.name || site.domain}</span>. Every insight carries clickable sources.
        </p>
      </div>
      {site.insights.map((ins, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              <IconEye size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">{ins.title}</div>
              <div className="mt-1 text-[13px] leading-6 text-ink-muted">{ins.summary}</div>
              {ins.evidence.length > 0 && (
                <div className="mt-3">
                  <SectionLabel className="mb-1.5">Evidence</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {ins.evidence.map((e, j) => (
                      <a
                        key={j}
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${e.label}: ${e.value}`}
                        className="inline-flex max-w-xs items-center gap-1 rounded-lg border border-line bg-gray-50 px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-brand-500/40 hover:text-brand-600 dark:bg-white/5"
                      >
                        <span className="truncate">
                          {e.label}: {e.value || "view"}
                        </span>
                        <IconExternal size={10} className="shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- NDJSON line reader ---------------- */
async function readLines(res: Response, signal: AbortSignal, onEvent: (obj: unknown) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal.aborted) {
      reader.cancel().catch(() => {});
      return;
    }
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        try {
          onEvent(JSON.parse(line));
        } catch {
          /* skip malformed line */
        }
      }
    }
  }
  if (buf.trim()) {
    try {
      onEvent(JSON.parse(buf));
    } catch {
      /* skip */
    }
  }
}