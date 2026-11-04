"use client";

import React from "react";
import { cn } from "./ui";

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export const PALETTE = ["#6366f1", "#8b5cf6", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e", "#14b8a6", "#ec4899"];

const fmt = (n: number) => n.toLocaleString();

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface p-4 card-shadow transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-[11px] text-ink-muted">{subtitle}</div>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon,
  tone = "indigo",
  hint,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "indigo" | "violet" | "emerald" | "amber" | "rose" | "cyan";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    indigo: "bg-gradient-to-br from-indigo-500 to-violet-600",
    violet: "bg-gradient-to-br from-violet-500 to-purple-600",
    emerald: "bg-gradient-to-br from-emerald-500 to-teal-600",
    amber: "bg-gradient-to-br from-amber-500 to-orange-600",
    rose: "bg-gradient-to-br from-rose-500 to-pink-600",
    cyan: "bg-gradient-to-br from-cyan-500 to-sky-600",
  };
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-3.5 card-shadow transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", tones[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-bold leading-6 text-ink">{value}</div>
          <div className="truncate text-[11px] font-medium text-ink-muted">{label}</div>
        </div>
      </div>
      {hint && <div className="mt-2 truncate text-[10.5px] text-ink-muted/70">{hint}</div>}
    </div>
  );
}

function roundedTopRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  const b = y + h;
  return `M${x},${b} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${b} Z`;
}

export function BarChart({
  data,
  height = 170,
  valueLabel,
  className,
}: {
  data: ChartDatum[];
  height?: number;
  valueLabel?: (n: number) => string;
  className?: string;
}) {
  const W = 320;
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const n = data.length;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = n <= 8 ? 26 : 18;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const step = n > 0 ? innerW / n : innerW;
  const barW = Math.max(7, Math.min(step * 0.62, 46));
  const label = valueLabel ?? fmt;

  if (n === 0) {
    return (
      <div className={cn("flex items-center justify-center text-[12px] text-ink-muted/60", className)} style={{ height }}>
        No data yet
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className={cn("h-auto w-full", className)} role="img" preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={padL}
          x2={W - padR}
          y1={padT + innerH - f * innerH}
          y2={padT + innerH - f * innerH}
          className="stroke-current text-ink-muted/20"
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const x = padL + i * step + (step - barW) / 2;
        const h = Math.max((d.value / max) * innerH, d.value > 0 ? 3 : 2);
        const y = padT + innerH - h;
        const val = d.value > 0 ? d.value : 0;
        return (
          <g key={i} className="transition-opacity hover:opacity-75">
            <title>{`${d.label}: ${fmt(val)}`}</title>
            <path
              d={roundedTopRect(x, padT + innerH - Math.max((val / max) * innerH, 2), barW, Math.max((val / max) * innerH, 2), 7)}
              className="fill-black/5 dark:fill-white/5"
            />
            <path d={roundedTopRect(x, y, barW, h, 7)} fill={d.color ?? "#6366f1"} />
            <text
              x={x + barW / 2}
              y={y - 5}
              textAnchor="middle"
              className="fill-current text-[9px] font-medium text-ink-muted"
            >
              {label(val)}
            </text>
            {n <= 8 && (
              <text
                x={x + barW / 2}
                y={padT + innerH + 12}
                textAnchor="middle"
                className="fill-current text-[8.5px] text-ink-muted/80"
              >
                {d.label.length > 11 ? d.label.slice(0, 10) + "…" : d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  className,
}: {
  data: ChartDatum[];
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}) {
  const R = 66;
  const C = 2 * Math.PI * R;
  const total = data.reduce((a, b) => a + b.value, 0);
  const segs = data.reduce<
    Array<{ d: ChartDatum; frac: number; dash: string; offset: number }>
  >((out, d) => {
    const frac = total > 0 ? d.value / total : 0;
    const offset = -out.reduce((a, it) => a + it.frac, 0) * C;
    out.push({ d, frac, dash: `${frac * C} ${C}`, offset });
    return out;
  }, []);

  return (
    <div className={cn("flex min-w-0 flex-col items-center", className)}>
      <svg viewBox="0 0 200 200" className="h-auto w-full max-w-[180px]" role="img">
        {total === 0 ? (
          <circle cx={100} cy={100} r={R} className="fill-none stroke-current text-ink-muted/15" strokeWidth={24} />
        ) : (
          <>
            <circle cx={100} cy={100} r={R} className="fill-none stroke-current text-ink-muted/10" strokeWidth={24} />
            {segs.map((s, i) => (
              <circle
                key={i}
                cx={100}
                cy={100}
                r={R}
                fill="none"
                stroke={s.d.color ?? PALETTE[i % PALETTE.length]}
                strokeWidth={24}
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                transform="rotate(-90 100 100)"
              >
                <title>{`${s.d.label}: ${fmt(s.d.value)}`}</title>
              </circle>
            ))}
          </>
        )}
        {centerValue !== undefined && (
          <text x={100} y={98} textAnchor="middle" className="fill-current text-[19px] font-bold text-ink">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={100} y={114} textAnchor="middle" className="fill-current text-[9px] text-ink-muted">
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="mt-3 flex w-full flex-wrap items-start justify-center gap-x-3 gap-y-1">
        {segs.map((s, i) => (
          <div key={i} className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-ink-muted">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.d.color ?? PALETTE[i % PALETTE.length] }} />
            <span className="max-w-[90px] truncate">{s.d.label}</span>
            <span className="font-semibold text-ink">{fmt(s.d.value)}</span>
            {total > 0 && <span className="text-ink-muted/70">({Math.round(s.frac * 100)}%)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniSpark({
  values,
  color = "#6366f1",
  width = 96,
  height = 30,
  fillId,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fillId: string;
}) {
  const max = Math.max(1, ...values);
  const n = values.length;

  if (n === 0) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" />;
  if (n === 1) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
        <circle cx={width / 2} cy={height / 2} r={3} fill={color} />
      </svg>
    );
  }

  const pad = 2;
  const pts = values.map((v, i) => ({
    x: pad + (i * (width - pad * 2)) / (n - 1),
    y: height - pad - (Math.max(0, v) / max) * (height - pad * 2 - 3),
  }));
  const line = pts.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const a = arr[i - 1];
    const cx = (a.x + p.x) / 2;
    return `${acc} C ${cx} ${a.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");
  const area = `${line} L ${pts[n - 1].x} ${height - pad} L ${pts[0].x} ${height - pad} Z`;
  const last = pts[n - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
}

export function TrendChart({
  data,
  color,
  height = 210,
  valueLabel,
  fillId,
  className,
}: {
  data: ChartDatum[];
  color?: string;
  height?: number;
  valueLabel?: (n: number) => string;
  fillId: string;
  className?: string;
}) {
  const W = 320;
  const n = data.length;
  const padL = 34;
  const padR = 12;
  const padT = 18;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const label = valueLabel ?? fmt;
  const rawMax = Math.max(1, ...data.map((d) => d.value));
  const niceMax = (() => {
    if (rawMax <= 0) return 1;
    const m = Math.pow(10, Math.floor(Math.log10(rawMax)));
    for (const c of [1, 2, 2.5, 5, 10]) {
      if (c * m >= rawMax) return c * m;
    }
    return 10 * m;
  })();
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);

  if (n === 0) {
    return (
      <div className={cn("flex items-center justify-center text-[12px] text-ink-muted/60", className)} style={{ height }}>
        No data yet
      </div>
    );
  }

  const pts = data.map((d, i) => ({
    x: n === 1 ? W / 2 : padL + (i * innerW) / (n - 1),
    y: padT + innerH - (Math.max(d.value, 0) / niceMax) * innerH,
  }));
  const line = pts
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z`;
  const last = pts[pts.length - 1];
  const lastD = data[data.length - 1];
  const maxPt = pts.reduce((a, p, i) => (data[i].value > data[a].value ? i : a), 0);
  const showXLabels = n <= 6;
  const xLabels = showXLabels
    ? data.map((d, i) => ({ i, t: d.label }))
    : [0, Math.floor((n - 1) / 2), n - 1].map((i) => ({ i, t: data[i].label }));
  const short = (s: string) => (s.length > 10 ? s.slice(0, 9) + "…" : s);
  const num = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

  const lineColor = color ?? "currentColor";

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className={cn("h-auto w-full text-ink", className)}
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.14} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={padT + innerH - (t / niceMax) * innerH}
            y2={padT + innerH - (t / niceMax) * innerH}
            className={i === 0 ? "stroke-current text-ink-muted/30" : "stroke-current text-ink-muted/15"}
            strokeWidth={1}
            strokeDasharray={i === 0 ? undefined : "1 0"}
          />
          <text x={padL - 6} y={padT + innerH - (t / niceMax) * innerH + 3} textAnchor="end" className="fill-current text-[8.5px] tabular-nums text-ink-muted">
            {num(t)}
          </text>
        </g>
      ))}

      {showXLabels &&
        pts.map((p, i) => (
          <line key={i} x1={p.x} x2={p.x} y1={padT} y2={padT + innerH} className="stroke-current text-ink-muted/10" strokeWidth={1} />
        ))}

      <path d={area} fill={`url(#${fillId})`} />
      <path d={line} fill="none" stroke={lineColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />

      {pts.map((p, i) => (
        <g key={`point-${i}`}>
          <circle cx={p.x} cy={p.y} r={4} fill="var(--surface)" stroke={lineColor} strokeWidth={2} />
          {i > 0 && data[i].value !== data[i - 1].value && (
            <path
              d={data[i].value > data[i - 1].value
                ? `M ${p.x - 2.5} ${p.y + 1.5} L ${p.x} ${p.y - 2} L ${p.x + 2.5} ${p.y + 1.5}`
                : `M ${p.x - 2.5} ${p.y - 1.5} L ${p.x} ${p.y + 2} L ${p.x + 2.5} ${p.y - 1.5}`}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      ))}

      {maxPt !== n - 1 && (
        <>
          <line
            x1={padL}
            x2={W - padR}
            y1={pts[maxPt].y}
            y2={pts[maxPt].y}
            stroke={lineColor}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.35}
          />
          <text x={W - padR} y={pts[maxPt].y - 4} textAnchor="end" className="fill-current text-[8.5px] font-semibold">
            max {num(data[maxPt].value)}
          </text>
        </>
      )}

      <text x={last.x} y={last.y - 10} textAnchor="middle" className="fill-current text-[10px] font-bold tabular-nums">
        {label(lastD.value)}
      </text>

      {xLabels.map(({ i, t }) => (
        <text key={i} x={pts[i].x} y={padT + innerH + 14} textAnchor="middle" className="fill-current text-[8.5px] text-ink-muted/80">
          {short(t)}
        </text>
      ))}

      {data.map((d, i) => (
        <title key={i}>{`${d.label}: ${label(d.value)}`}</title>
      ))}
    </svg>
  );
}