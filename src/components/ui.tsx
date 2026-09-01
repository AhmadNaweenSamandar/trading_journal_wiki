import Link from "next/link";
import type { ReactNode } from "react";

import { tone } from "@/lib/format";
import type { Grade, Trade } from "@/lib/types";
import { RISK_EMOTIONS } from "@/lib/taxonomy";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${valueClass ?? "text-slate-100"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const GRADE_STYLES: Record<Grade, string> = {
  A: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  B: "bg-sky-500/25 text-sky-300 ring-sky-500/30",
  C: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ring-1 ${GRADE_STYLES[grade]}`}
      title={`Grade ${grade}`}
    >
      {grade}
    </span>
  );
}

export function EmotionBadge({ emotion }: { emotion: string }) {
  const risky = RISK_EMOTIONS.has(emotion);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ring-1 ${
        risky
          ? "bg-rose-500/10 text-rose-300 ring-rose-500/25"
          : "bg-sky-500/20 text-sky-200 ring-sky-500/30"
      }`}
    >
      {emotion}
    </span>
  );
}

export function RulesBadge({ trade }: { trade: Trade }) {
  const ok = trade.rulesFollowed;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ring-1 ${
        ok
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25"
          : "bg-rose-500/10 text-rose-300 ring-rose-500/25"
      }`}
      title={`${trade.ruleScore.toFixed(0)}% of rules followed`}
    >
      {ok ? "Rules followed" : `Rules ${trade.ruleScore.toFixed(0)}%`}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-sky-500/20 px-2 py-0.5 text-xs text-sky-200 ring-1 ring-sky-500/30">
      {children}
    </span>
  );
}

export function DirectionBadge({ direction }: { direction: "long" | "short" }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
        direction === "long"
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-rose-500/10 text-rose-400"
      }`}
    >
      {direction}
    </span>
  );
}

export function Money({ value }: { value: number }) {
  return (
    <span className={tone(value)}>
      {value > 0 ? "+" : value < 0 ? "-" : ""}$
      {Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{body}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Horizontal meter used for adherence and distribution readouts. */
export function Meter({
  value,
  max = 100,
  colorClass = "bg-sky-500",
}: {
  value: number;
  max?: number;
  colorClass?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-500/25">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
