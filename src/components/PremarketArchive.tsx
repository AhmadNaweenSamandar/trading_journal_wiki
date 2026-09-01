"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Panel } from "@/components/ui";
import { longDate, monthLabel } from "@/lib/format";
import type { Bias, Premarket } from "@/lib/types";

const BIAS_TONE: Record<Bias, string> = {
  bullish: "text-emerald-400",
  bearish: "text-rose-400",
  neutral: "text-slate-400",
};

export function PremarketArchive({
  records,
  months,
  month,
  selectedDate,
}: {
  records: Premarket[];
  months: string[];
  month: string;
  selectedDate?: string;
}) {
  const router = useRouter();
  const monthIndex = months.indexOf(month);
  const label = month ? monthLabel(month) : "No plans yet";

  function go(next: string) {
    router.push(`/premarket?month=${next}`);
  }

  return (
    <Panel
      title={month ? `${label} pre-market` : "Previous plans"}
      description="Open a morning to read the full plan. The summary at the top stays on today."
      action={
        months.length > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => go(months[monthIndex + 1])}
              disabled={monthIndex < 0 || monthIndex >= months.length - 1}
              className="rounded-lg border border-sky-500/30 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200 disabled:opacity-30"
              aria-label="Older month"
            >
              &#8249;
            </button>
            <select
              value={month}
              onChange={(e) => go(e.target.value)}
              className="field w-auto"
            >
              {months.map((option) => (
                <option key={option} value={option}>
                  {monthLabel(option)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => go(months[monthIndex - 1])}
              disabled={monthIndex <= 0}
              className="rounded-lg border border-sky-500/30 px-2.5 py-1.5 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200 disabled:opacity-30"
              aria-label="Newer month"
            >
              &#8250;
            </button>
          </div>
        ) : null
      }
    >
      {records.length === 0 ? (
        <p className="text-sm text-slate-500">No plans recorded in this month.</p>
      ) : (
        <ul className="divide-y divide-sky-500/20">
          {records.map((record) => {
            const active = record.date === selectedDate;
            return (
              <li key={record.date}>
                <Link
                  href={`/premarket?month=${month}&date=${record.date}`}
                  className={`-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors ${
                    active
                      ? "bg-sky-500/15 text-sky-200"
                      : "hover:bg-sky-400/20"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200">
                      {record.day}, {longDate(record.date)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {record.dayBiasNote ||
                        record.yesterdayMovement ||
                        record.candles.map((candle) => candle.label).join(" · ") ||
                        "No notes written"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs capitalize ${BIAS_TONE[record.dayBias]}`}
                  >
                    {record.dayBias}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-600">
                    {record.levels.length}L · {record.events.length}E
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
