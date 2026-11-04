"use client";

import React from "react";
import type { AgentAction } from "@/app/lib/types";
import { cn } from "./ui";
import { IconCheck, IconX, IconBot } from "./icons";

export default function AgentActivity({
  actions,
  detail,
  domain,
  running,
}: {
  actions: AgentAction[];
  detail?: string;
  domain?: string;
  running: boolean;
}) {
  const active = actions.find((a) => a.state === "active");
  const doneCount = actions.filter((a) => a.state === "done").length;
  const total = actions.length;

  return (
    <div className="agent-activity animate-fade-up overflow-hidden rounded-2xl border border-[#d7d7d2] bg-linear-to-b from-white to-[#f0f0ed] card-shadow dark:border-[#3a3a38] dark:from-[#20201e] dark:to-[#151514]">
      <div className="flex items-center gap-2.5 border-b border-[#e2e2de] px-4 py-3 dark:border-[#353532]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a8a] text-white shadow-sm">
          <IconBot size={15} />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-[#171715] dark:text-[#f2f2ee]">WebMind Agent</div>
          <div className="text-[11px] text-[#6a6a65] dark:text-[#aaa9a3]">
            {running
              ? domain
                ? `Analyzing ${domain}`
                : "Analyzing website"
              : doneCount === total
                ? "Analysis complete"
                : "Stopped"}
          </div>
        </div>
        {running && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#e6f6f2] px-2.5 py-1 text-[11px] font-semibold text-[#0f766e] dark:bg-[#123b36] dark:text-[#7de3d2]">
            <span className="agent-pulse h-1.5 w-1.5 rounded-full bg-[#0f9f8a] dark:bg-[#5eead4]" />
            Working
          </span>
        )}
      </div>

      <div className="grid gap-x-3 gap-y-1.5 p-4 sm:grid-cols-2">
        {actions.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2.5 text-[12.5px]">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                a.state === "done" && "border-[#a7d8c7] bg-[#e8f7f0] text-[#087f5b] dark:border-[#286b58] dark:bg-[#12372e] dark:text-[#8de0bd]",
                a.state === "active" && "border-[#a8c7ee] bg-[#edf4ff] text-[#2563eb] dark:border-[#345b91] dark:bg-[#172b4d] dark:text-[#93c5fd]",
                a.state === "error" && "border-[#efb6a8] bg-[#fff1ed] text-[#c2412d] dark:border-[#7c3328] dark:bg-[#421d18] dark:text-[#fca5a5]",
                a.state === "pending" && "border-[#d8dce2] bg-[#f5f7fa] text-[#9aa3af] dark:border-[#454b55] dark:bg-[#20242b] dark:text-[#7f8a99]"
              )}
            >
              {a.state === "done" && <IconCheck size={11} />}
              {a.state === "error" && <IconX size={11} />}
              {a.state === "active" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3b82f6] dark:bg-[#93c5fd]" />}
              {a.state === "pending" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span
              className={cn(
                "min-w-0 truncate",
                a.state === "pending" ? "text-[#7b8490] dark:text-[#aab3c0]" : "text-[#202b3a] dark:text-[#eeeeea]",
                a.id === "complete" && a.state === "pending" && "hidden sm:block"
              )}
            >
              {a.label}
            </span>
            {i === 0 && total < 12 && <span className="sr-only">{doneCount}</span>}
          </div>
        ))}
      </div>

      {(active || detail) && running && (
        <div className="border-t border-[#e2e2de] px-4 py-2.5 dark:border-[#353532]">
          <div className="flex items-center gap-2 text-[12px] text-[#6a6a65] dark:text-[#aaa9a3]">
            <span className="agent-pulse inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f9f8a] dark:bg-[#5eead4]" />
            <span className="truncate">
              {active ? (
                <>
                  Currently analyzing: <span className="font-medium text-[#20201e] dark:text-[#eeeeea]">{active.label}</span>
                </>
              ) : (
                detail
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}