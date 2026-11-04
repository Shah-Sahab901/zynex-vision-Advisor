"use client";

import React from "react";
import { Button, Card, SectionLabel, Badge } from "./ui";
import { IconSun, IconMoon, IconTrash, IconZap, IconCheckCircle, IconInfo } from "./icons";

export default function SettingsView({
  isDark,
  onToggleDark,
  demoMode,
  onToggleDemoMode,
  onClearAll,
}: {
  isDark: boolean;
  onToggleDark: () => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  onClearAll: () => void;
}) {
  const toggle = (checked: boolean, onChange: () => void) => (
    <button
      onClick={onChange}
      className={"relative h-6 w-11 shrink-0 rounded-full transition-colors " + (checked ? "bg-indigo-500" : "bg-gray-200 dark:bg-white/10")}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " + (checked ? "left-[22px]" : "left-0.5")}
      />
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">Appearance, analysis behaviour and data.</p>
      </div>

      <Card className="divide-y divide-line p-0">
        <SettingRow
          icon={isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
          title="Theme"
          hint="Switch between light and dark appearance."
        >
          {toggle(isDark, onToggleDark)}
        </SettingRow>

        <SettingRow
          icon={<IconZap size={16} />}
          title={demoMode ? "Demo mode is ON" : "Instant demo mode"}
          hint={
            demoMode
              ? "URL analysis uses a pre-indexed demo dataset (clearly labeled). Turn off for live crawling."
              : "When a live crawl fails or you want a quick expo demo, demo mode provides a pre-indexed sample website."
          }
        >
          {toggle(demoMode, onToggleDemoMode)}
        </SettingRow>

        <SettingRow
          icon={<IconInfo size={16} />}
          title="AI provider"
          hint="Without an API key, CommerceLens AI answers from collected website evidence locally (no hallucinated facts)."
        >
          <Badge tone="green">
            <IconCheckCircle size={11} />
            Local evidence engine
          </Badge>
        </SettingRow>

        <SettingRow
          icon={<IconTrash size={16} />}
          title="Data"
          hint="Delete all conversations and analyzed websites from this browser."
        >
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm("Delete all conversations and analyses? This cannot be undone.")) onClearAll();
            }}
          >
            Clear all data
          </Button>
        </SettingRow>
      </Card>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <SectionLabel className="mb-2">Keyboard shortcuts</SectionLabel>
        <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
          <Shortcut keys="Ctrl + K" label="Focus the website URL field" />
          <Shortcut keys="Ctrl + N" label="Start a new chat" />
          <Shortcut keys="Enter" label="Send a chat message" />
          <Shortcut keys="Shift + Enter" label="New line in the message box" />
        </div>
      </div>

      <p className="text-[11px] leading-5 text-ink-muted">
        Privacy: website content is treated as untrusted external input. SSRF-protected, robots.txt-aware crawling. No credentials are ever passed to the browser. Data is stored locally in your browser.
      </p>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-ink-muted dark:bg-white/10">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[12px] leading-5 text-ink-muted">{hint}</div>
      </div>
      {children}
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
      <span className="text-ink-muted">{label}</span>
      <kbd className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink">{keys}</kbd>
    </div>
  );
}