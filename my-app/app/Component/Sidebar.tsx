"use client";

import React, { useMemo, useState } from "react";
import type { Conversation, ViewKey } from "@/app/lib/types";
import { Badge, cn, GhostIcon, Logo, NiceDate } from "./ui";
import {
  IconMessage,
  IconGlobe,
  IconChart,
  IconCompare,
  IconFileText,
  IconSettings,
  IconPlus,
  IconSearch,
  IconTrash,
  IconPin,
  IconPencil,
  IconX,
  IconSparkles,
  IconSun,
  IconUser,
} from "./icons";

const NAV: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "assistant", label: "Assistant", icon: <IconMessage size={16} /> },
  { key: "websites", label: "Websites", icon: <IconGlobe size={16} /> },
  { key: "insights", label: "Insights", icon: <IconChart size={16} /> },
  { key: "compare", label: "Compare", icon: <IconCompare size={16} /> },
  { key: "reports", label: "Reports", icon: <IconFileText size={16} /> },
  { key: "settings", label: "Settings", icon: <IconSettings size={16} /> },
];

export default function Sidebar({
  conversations,
  activeId,
  view,
  onView,
  onOpen,
  onNewChat,
  onRename,
  onDelete,
  onTogglePin,
  open,
  onClose,
  isDark,
  onToggleDark,
}: {
  conversations: Conversation[];
  activeId: string | null;
  view: ViewKey;
  onView: (v: ViewKey) => void;
  onOpen: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...conversations].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
    });
    if (!q) return sorted;
    return sorted.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || (c.site?.domain || "").toLowerCase().includes(q)
    );
  }, [conversations, query]);

  return (
    <aside
      className={cn(
        "flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-surface will-change-transform transition-[transform,box-shadow] duration-300 ease-out lg:w-[252px] lg:translate-x-0 xl:w-[264px]",
        open ? "translate-x-0 fixed left-0 top-0 z-50 h-full w-[min(280px,calc(100vw-1.25rem))] shadow-2xl lg:static lg:shadow-none lg:z-auto" : "fixed left-0 -translate-x-full lg:static lg:translate-x-0"
      )}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-ink">CommerceLens AI</div>
            <div className="text-[10.5px] text-ink-muted">Ecommerce Fashion Advisor &amp; Analyst</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-gray-100 lg:hidden">
          <IconX size={17} />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3 pt-1">
        <button
          onClick={onNewChat}
          className="premium-primary flex w-full items-center gap-2 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-indigo-500/25 transition-all hover:from-indigo-600 hover:to-indigo-700 active:scale-[.99]"
        >
          <IconPlus size={16} />
          New Chat
          <span className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">Ctrl N</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="mt-4 space-y-0.5 px-3">
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              onView(item.key);
              onClose();
            }}
            className={cn(
              "premium-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              view === item.key
                ? "bg-brand-50 text-brand-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                : "text-ink-muted hover:bg-gray-100 hover:text-ink"
            )}
          >
            {item.icon}
            {item.label}
            {item.key === "compare" && (
              <span className="ml-auto text-[10px] font-medium text-violet-500">BETA</span>
            )}
          </button>
        ))}
      </nav>

      {/* Chat history */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col px-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted/80">Chat History</div>
          <span className="text-[10px] text-ink-muted">{conversations.length}</span>
        </div>

        <div className="relative mb-2">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted/60" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="h-8 w-full rounded-lg border border-line bg-gray-50 pl-8 pr-3 text-[12px] text-ink placeholder:text-ink-muted/70 focus:border-brand-500/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-white/5"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5 pb-4">
          {filtered.length === 0 && (
            <div className="px-2 py-6 text-center text-[12px] text-ink-muted">
              {conversations.length === 0 ? "No conversations yet.\nStart a new chat." : "No matches found."}
            </div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group relative rounded-xl border px-2.5 py-2 transition-colors cursor-pointer",
                c.id === activeId
                  ? "border-brand-500/30 bg-brand-50/70 dark:bg-indigo-950/40"
                  : "border-transparent hover:border-line hover:bg-gray-50 dark:hover:bg-white/5"
              )}
              onClick={() => onOpen(c.id)}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium text-ink">{c.title || "Untitled"}</span>
                    {c.pinned && <IconPin size={11} className="shrink-0 text-amber-500" />}
                  </div>
                  {c.description && <div className="mt-0.5 truncate text-[11px] text-ink-muted">{c.description}</div>}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-muted/70">
                    <NiceDate iso={c.updatedAt || c.createdAt} />
                    {c.site?.demo && <Badge tone="violet">Demo</Badge>}
                  </div>
                </div>
              </div>

              {/* hover actions */}
              <div className="absolute right-1 top-1.5 hidden items-center gap-0.5 rounded-lg bg-surface/95 p-0.5 shadow-sm group-hover:flex">
                <GhostIcon title="Pin" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onTogglePin(c.id); }}>
                  <IconPin size={13} className={cn(c.pinned && "text-amber-500")} />
                </GhostIcon>
                <GhostIcon title="Rename" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onRename(c.id, c.title); }}>
                  <IconPencil size={13} />
                </GhostIcon>
                <GhostIcon title="Delete" className="h-6 w-6 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}>
                  <IconTrash size={13} />
                </GhostIcon>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer profile */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <IconUser size={15} />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12.5px] font-medium text-ink">Product Explorer</div>
            <div className="text-[10.5px] text-ink-muted">Free plan</div>
          </div>
          <button
            onClick={onToggleDark}
            title="Toggle theme"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-gray-100 hover:text-ink"
          >
            {isDark ? <IconSun size={16} /> : <IconSparkles size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
}