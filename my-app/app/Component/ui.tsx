"use client";

import React, { useState, useCallback, createContext, useContext, useSyncExternalStore } from "react";
import { IconX, IconCheck, IconAlert, IconInfo, IconCopy } from "./icons";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Button ---------------- */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type BtnSize = "xs" | "sm" | "md" | "lg";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-150 whitespace-nowrap select-none disabled:opacity-45 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-brand-500/40";
const btnVariants: Record<BtnVariant, string> = {
  primary:
    "premium-primary bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/25 hover:from-indigo-600 hover:to-indigo-700 active:scale-[.98]",
  secondary:
    "border border-line bg-surface text-ink hover:bg-gray-50 active:scale-[.98]",
  ghost: "text-ink-muted hover:text-ink hover:bg-gray-100/80",
  danger: "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950",
  subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-indigo-950 dark:text-indigo-300",
};
const btnSizes: Record<BtnSize, string> = {
  xs: "text-xs px-2 h-7 rounded-lg",
  sm: "text-sm px-3 h-9",
  md: "text-sm px-4 h-10",
  lg: "text-[15px] px-5 h-11",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button className={cn(btnBase, btnVariants[variant], btnSizes[size], className)} {...props} />;
}

export function GhostIcon({
  title,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-gray-100 hover:text-ink disabled:opacity-40 disabled:pointer-events-none",
        className
      )}
      {...props}
    />
  );
}

/* ---------------- Badge ---------------- */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "green" | "blue" | "violet" | "amber" | "red";
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- Card ---------------- */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface card-shadow", className)}>
      {children}
    </div>
  );
}

/* ---------------- Section label ---------------- */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] font-semibold uppercase tracking-wider text-ink-muted/80", className)}>
      {children}
    </div>
  );
}

/* ---------------- Skeletons ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-1 text-ink-muted/50">{icon}</div>}
      <div className="text-sm font-semibold text-ink">{title}</div>
      {hint && <div className="max-w-sm text-[13px] leading-5 text-ink-muted">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------- Toasts ---------------- */
interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}
const ToastCtx = createContext<(msg: string, type?: Toast["type"]) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-lg"
          >
            {t.type === "success" && <IconCheck className="text-emerald-500" size={16} />}
            {t.type === "error" && <IconAlert className="text-red-500" size={16} />}
            {t.type === "info" && <IconInfo className="text-brand-500" size={16} />}
            <div className="flex-1">{t.message}</div>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-ink-muted hover:text-ink">
              <IconX size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Copy helper ---------------- */
export function CopyButton({ text, label, size = 15 }: { text: string; label?: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <GhostIcon
      title={label || "Copy"}
      className={cn(copied && "text-emerald-500")}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <IconCheck size={size} /> : <IconCopy size={size} />}
    </GhostIcon>
  );
}

/* ---------------- Lightweight markdown-ish renderer ---------------- */
export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="my-1.5 space-y-1">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-6">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500/60" />
              <span>{inline(li)}</span>
            </li>
          ))}
        </ul>
      );
      list = [];
    }
  };

  const inline = (line: string) => {
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|`([^`]+)`|\*([^*]+)\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[1]) parts.push(<strong key={i++} className="font-semibold">{m[1]}</strong>);
      else if (m[2]) parts.push(<code key={i++} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] dark:bg-white/10">{m[2]}</code>);
      else if (m[3]) parts.push(<em key={i++}>{m[3]}</em>);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <>{parts}</>;
  };

  for (const raw of lines) {
    const line = raw;
    if (line.trim().startsWith("- ") || line.trim().startsWith("•")) {
      list.push(line.replace(/^[-•]\s+/, ""));
      continue;
    }
    flushList();
    if (line.trim() === "") continue;
    blocks.push(
      <p key={blocks.length} className="my-1.5 text-[14px] leading-6">
        {inline(line)}
      </p>
    );
  }
  flushList();

  return <div className="space-y-1">{blocks}</div>;
}

const nowStore = (() => {
  let value: number | null = null;
  const listeners = new Set<() => void>();
  const tick = () => {
    value = Date.now();
    for (const l of listeners) l();
  };
  return {
    subscribe(cb: () => void) {
      listeners.add(cb);
      if (listeners.size === 1) {
        value = Date.now();
        setInterval(tick, 60_000);
      }
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot(): number | null {
      return value;
    },
  };
})();

export function NiceDate({ iso }: { iso: string }) {
  const now = useSyncExternalStore(nowStore.subscribe, nowStore.getSnapshot, () => null);
  const d = new Date(iso);
  let label = iso;
  if (!Number.isNaN(d.getTime()) && now !== null) {
    const diff = now - d.getTime();
    if (diff < 60_000) label = "Just now";
    else if (diff < 3_600_000) label = `${Math.floor(diff / 60_000)}m ago`;
    else if (diff < 86_400_000) label = `${Math.floor(diff / 3_600_000)}h ago`;
    else label = d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return <span>{label}</span>;
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <img
      src="/Images/ricwi_text.png"
      alt="CommerceLens"
      className="shrink-0 object-contain"
      style={{ height: size, width: "auto" }}
    />
  );
}