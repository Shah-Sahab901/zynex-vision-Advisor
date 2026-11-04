"use client";

import React, { useEffect, useRef, useState } from "react";
import { Badge, Button, cn } from "./ui";
import { IconGlobe, IconMenu, IconBell, IconX, IconZap, IconCheckCircle, IconAlert, IconPlus, IconFileText, IconImage, IconSparkles } from "./icons";
import type { SiteAnalysis } from "@/app/lib/types";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

async function downscaleImage(file: File, maxSize = 1000): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  if (!/^image\//.test(file.type)) throw new Error("Not an image file.");
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(raw);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(raw);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = raw;
  });
}

export default function TopBar({
  url,
  onUrlChange,
  onAnalyze,
  onDemo,
  analyzing,
  onStop,
  site,
  onOpenSidebar,
  onAutoAnalyze,
  onPdfAnalyze,
  onImageAnalyze,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onAnalyze: (u?: string) => void;
  onDemo: () => void;
  analyzing: boolean;
  onStop: () => void;
  site: SiteAnalysis | null;
  onOpenSidebar: () => void;
  onAutoAnalyze?: (url: string) => void;
  onPdfAnalyze?: (file: File) => void;
  onImageAnalyze?: (opts: { url: string; image?: string; imageUrl?: string; hint?: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autoAnalyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState("");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [attachUrlInput, setAttachUrlInput] = useState("");
  const [attachHint, setAttachHint] = useState("");

  const toggleAttach = () => {
    if (!attachOpen && !attachUrlInput.trim()) setAttachUrlInput(url);
    setAttachOpen((v) => !v);
  };

  const handleImageFile = async (file: File) => {
    try {
      const dataUrl = await downscaleImage(file);
      setAttachedImage(dataUrl);
      setAttachedImageName(file.name || "image");
    } catch {
      setAttachedImage(null);
      setAttachedImageName("");
    }
  };

  const handleAttachAnalyze = () => {
    const targetUrl = attachUrlInput.trim() || url.trim();
    if (!targetUrl) return;
    onImageAnalyze?.({
      url: targetUrl,
      image: attachedImage || undefined,
      imageUrl: imageUrlInput.trim() || undefined,
      hint: attachHint.trim() || undefined,
    });
    setAttachOpen(false);
    setAttachedImage(null);
    setAttachedImageName("");
    setImageUrlInput("");
    setAttachUrlInput("");
    setAttachHint("");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => {
    if (autoAnalyzeTimer.current) clearTimeout(autoAnalyzeTimer.current);
  }, []);

  const handleUrlChange = (value: string) => {
    onUrlChange(value);
    const trimmed = value.trim();
    if (!onAutoAnalyze || analyzing || !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(trimmed)) return;
    if (autoAnalyzeTimer.current) clearTimeout(autoAnalyzeTimer.current);
    autoAnalyzeTimer.current = setTimeout(() => onAutoAnalyze(trimmed), 650);
  };

  return (
    <header className="topbar-shell mobile-topbar z-20 flex min-h-[64px] shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface/90 px-2.5 py-2.5 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-0">
      <button
        onClick={onOpenSidebar}
        className="order-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-gray-100 lg:hidden"
      >
        <IconMenu size={19} />
      </button>

      <div className="order-2 flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 sm:order-none sm:w-auto sm:flex-nowrap">
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setSelectedPdf(file); e.currentTarget.value = ""; }} />
        <div className="relative">
          <button type="button" title="Attach a PDF, an image or a link" onClick={toggleAttach} className="topbar-upload flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors hover:text-ink">
            <IconPlus size={17} />
          </button>

          {attachOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={toggleAttach} />
              <div className="animate-fade-up absolute left-0 top-12 z-40 w-[min(25rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-3 shadow-xl">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <IconSparkles size={14} className="text-brand-600" />
                    Attach &amp; analyze
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-muted hover:text-ink"
                  >
                    <IconFileText size={13} /> PDF
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    ref={imageFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageFile(file); e.currentTarget.value = ""; }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => imageFileRef.current?.click()}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-[12px] font-medium text-ink-muted transition-colors hover:border-brand-500/50 hover:text-brand-600"
                    >
                      <IconImage size={15} />
                      {attachedImage ? "Change image" : "Upload image"}
                    </button>
                    {attachedImage && (
                      <div className="flex min-w-0 items-center gap-2">
                        <img src={attachedImage} alt="attached" className="h-9 w-9 shrink-0 rounded-lg border border-line object-cover" />
                        <span className="truncate text-[11px] text-ink-muted">{attachedImageName}</span>
                        <button
                          type="button"
                          aria-label="Remove attached image"
                          onClick={() => { setAttachedImage(null); setAttachedImageName(""); }}
                          className="shrink-0 rounded-md p-0.5 hover:bg-gray-100 hover:text-ink dark:hover:bg-white/10"
                        >
                          <IconX size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or paste an image URL (optional)"
                    spellCheck={false}
                    className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:border-brand-500/60 focus:outline-none dark:bg-white/5"
                  />

                  <input
                    value={attachHint}
                    onChange={(e) => setAttachHint(e.target.value)}
                    placeholder="Item ka naam likho — e.g. black kurta, ladies kurti, shoes (recommended)"
                    spellCheck={false}
                    className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:border-brand-500/60 focus:outline-none dark:bg-white/5"
                  />

                  <input
                    value={attachUrlInput}
                    onChange={(e) => setAttachUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAttachAnalyze(); }}
                    placeholder="Website URL to fetch data from"
                    spellCheck={false}
                    className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:border-brand-500/60 focus:outline-none dark:bg-white/5"
                  />

                  <Button onClick={handleAttachAnalyze} disabled={!(attachUrlInput.trim() || url.trim())} size="sm" className="w-full">
                    <IconSparkles size={14} />
                    Analyze with image
                  </Button>
                  <p className="text-[10.5px] leading-4 text-ink-muted/70">
                    Item ka naam likho + website URL — wohi cheez URL se nikaal kar data dikhaya jayega. Image optional hai (sirf color
                    confirm karne ke liye); URL ka craw anum hamesha hoga.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        {selectedPdf && (
          <div className="topbar-pdf-selection flex min-w-0 max-w-[220px] items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 text-[11px] text-ink-muted" title={selectedPdf.name}>
            <span className="truncate font-medium text-ink">{selectedPdf.name}</span>
            <span className="shrink-0">{(selectedPdf.size / 1024 / 1024).toFixed(1)} MB</span>
            <button type="button" aria-label="Remove selected PDF" onClick={() => setSelectedPdf(null)} className="shrink-0 rounded-md p-0.5 hover:bg-gray-100 hover:text-ink dark:hover:bg-white/10"><IconX size={13} /></button>
          </div>
        )}
        <div className="topbar-url mobile-url-input relative flex h-11 min-w-[150px] flex-1 items-center rounded-2xl border border-line bg-white shadow-sm focus-within:border-brand-500/60 focus-within:ring-4 focus-within:ring-brand-500/10 dark:bg-white/5 sm:min-w-0">
          <div className="pointer-events-none absolute left-3.5 text-ink-muted/70">
            <IconGlobe size={17} />
          </div>
          <input
            ref={inputRef}
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) onAnalyze();
            }}
            placeholder="Paste website URL — e.g. https://example.com"
            spellCheck={false}
            className="h-full w-full min-w-0 truncate bg-transparent pl-10 pr-4 text-[14px] text-ink placeholder:text-ink-muted/60 focus:outline-none"
          />
          <button
            onClick={() => onUrlChange("")}
            className="mr-2 hidden rounded-lg p-1 text-ink-muted hover:text-ink sm:block"
          >
            <IconX size={15} />
          </button>
          <kbd className="mr-3 hidden rounded-md border border-line bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted md:block">
            Ctrl K
          </kbd>
        </div>

        {analyzing ? (
          <>
            <Button variant="secondary" onClick={onStop} className="animate-pulse">
              <IconX size={16} />
              <span className="hidden sm:inline">Stop</span>
            </Button>
            <div className="hidden items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[13px] font-medium text-brand-700 md:flex dark:bg-indigo-950/60 dark:text-indigo-300">
              <span className="agent-pulse h-2 w-2 rounded-full bg-indigo-500" />
              Agent is working…
            </div>
          </>
        ) : (
          <>
            <Button onClick={() => selectedPdf ? (onPdfAnalyze?.(selectedPdf), setSelectedPdf(null)) : onAnalyze()} size="lg" className="premium-primary mobile-analyze shrink-0 whitespace-nowrap px-3 sm:px-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m12 3 1.5 5 5 1.5-5 1.5L12 16l-1.5-5-5-1.5 5-1.5L12 3Z" />
              </svg>
              {selectedPdf ? "Analyze PDF" : "Analyze Website"}
            </Button>
            <button
              onClick={onDemo}
              title="Run instant demo analysis"
              className="topbar-demo hidden shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors sm:flex"
            >
              <IconZap size={15} />
              Demo
            </button>
          </>
        )}
      </div>

      <div className="relative order-1 shrink-0 md:order-none">
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-gray-100 hover:text-ink"
        >
          <IconBell size={18} />
          {site && (
            <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-emerald-500" />
          )}
        </button>
        {notifOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
            <div className="animate-fade-up absolute right-0 top-11 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-1 shadow-xl sm:right-0">
              <div className="border-b border-line px-3 py-2 text-[12px] font-semibold text-ink">Activity</div>
              {site ? (
                <div className="flex items-start gap-2.5 p-3">
                  <IconCheckCircle className="mt-0.5 shrink-0 text-emerald-500" size={16} />
                  <div className="text-[12.5px] leading-5 text-ink">
                    <div className="font-medium">{site.company.name || site.domain}</div>
                    Analysis complete — {site.products.length} products, {site.services.length} services, {site.pricing.length} pricing entries.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-3 text-[12.5px] leading-5 text-ink-muted">
                  <IconAlert className="mt-0.5 shrink-0 text-amber-500" size={16} />
                  No activity yet. Paste a URL and run your first analysis.
                </div>
              )}
              {site?.warnings[0] && (
                <div className="border-t border-line px-3 py-2 text-[11.5px] text-amber-600 dark:text-amber-400">{site.warnings[0]}</div>
              )}
            </div>
          </>
        )}
      </div>

      {site && (
        <div className="topbar-live hidden shrink-0 items-center xl:flex">
          <Badge tone="green" className="border border-[#b8dfd1] bg-[#eefaf5] text-[#176b52] dark:border-[#286b58] dark:bg-[#12372e] dark:text-[#8de0bd]">
            <span className={cn("h-1.5 w-1.5 rounded-full bg-emerald-500")} />
            {site.demo ? "Demo data" : "Live analysis"}
          </Badge>
        </div>
      )}
    </header>
  );
}