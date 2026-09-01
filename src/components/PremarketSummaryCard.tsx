import { Ring } from "@/components/circles";
import { currency, longDate, tone } from "@/lib/format";
import type { PremarketSummary } from "@/lib/premarket";
import type { Bias } from "@/lib/types";

const BIAS_TONE: Record<Bias, string> = {
  bullish: "text-emerald-400",
  bearish: "text-rose-400",
  neutral: "text-slate-300",
};

const BIAS_RING: Record<Bias, string> = {
  bullish: "#10b981",
  bearish: "#f43f5e",
  neutral: "#64748b",
};

/** The rectangle at the top of the page: today's plan, read back at a glance. */
export function PremarketSummaryCard({ summary }: { summary: PremarketSummary }) {
  return (
    <section className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-sky-400/80">Today&apos;s pre-market summary</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">
            {summary.day}, {longDate(summary.date)}
          </h2>
          <p className={`mt-0.5 text-sm font-medium capitalize ${BIAS_TONE[summary.bias]}`}>
            {summary.bias} bias
            {summary.timeframesAligned
              ? " · all timeframes aligned"
              : summary.conflicts.length
                ? ` · ${summary.conflicts.join(" and ")} disagree${summary.conflicts.length === 1 ? "s" : ""}`
                : ""}
          </p>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-center">
            <Ring
              size={84}
              value={summary.completeness}
              color={BIAS_RING[summary.bias]}
              centerValue={`${summary.completeness}%`}
              centerClass={BIAS_TONE[summary.bias]}
            />
            <p className="mt-1 text-[11px] text-slate-500">Plan filled in</p>
          </div>
          <div className="text-center">
            <Ring
              size={84}
              value={summary.chartsAttached}
              max={summary.chartSlots}
              color="#38bdf8"
              centerValue={`${summary.chartsAttached}/${summary.chartSlots}`}
              centerClass="text-sky-300"
            />
            <p className="mt-1 text-[11px] text-slate-500">Charts attached</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-sky-500/15 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="label">Timeframe reads</p>
          <ul className="mt-1 space-y-0.5">
            {summary.timeframes.map((frame) => (
              <li key={frame.label} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: BIAS_RING[frame.bias] }}
                />
                <span className="text-slate-400">{frame.label}</span>
                <span className={`capitalize ${BIAS_TONE[frame.bias]}`}>
                  {frame.bias}
                </span>
                {frame.hasChart ? null : (
                  <span className="text-[10px] text-slate-600">no chart</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="label">
            Levels to watch{summary.levelCount ? ` (${summary.levelCount})` : ""}
          </p>
          {summary.levels.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">None marked.</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm">
              {summary.levels.slice(0, 4).map((level) => (
                <li key={level.id} className="flex justify-between gap-2">
                  <span className="truncate text-slate-400">{level.label || "Level"}</span>
                  <span className="shrink-0 font-mono text-slate-200">{level.price}</span>
                </li>
              ))}
              {summary.levels.length > 4 ? (
                <li className="text-[11px] text-slate-600">
                  +{summary.levels.length - 4} more
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div>
          <p className="label">Events</p>
          {summary.events.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">Clear calendar.</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm">
              {summary.events.slice(0, 4).map((event) => (
                <li key={event.id} className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[11px] text-slate-500">
                    {event.time || "--:--"}
                  </span>
                  <span
                    className={`truncate ${
                      event.impact === "high" ? "text-rose-300" : "text-slate-400"
                    }`}
                  >
                    {event.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {summary.highImpactEvents.length > 0 ? (
            <p className="mt-1 text-[11px] text-rose-400/80">
              {summary.highImpactEvents.length} high impact
            </p>
          ) : null}
        </div>

        <div>
          <p className="label">Since the open</p>
          <p className={`mt-1 text-lg font-semibold ${tone(summary.netPnlToday)}`}>
            {currency(summary.netPnlToday)}
          </p>
          <p className="text-[11px] text-slate-500">
            {summary.tradesToday} {summary.tradesToday === 1 ? "trade" : "trades"} logged
            today
          </p>
        </div>
      </div>
    </section>
  );
}
