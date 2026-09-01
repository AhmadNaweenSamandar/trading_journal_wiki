import { Panel } from "@/components/ui";
import { longDate } from "@/lib/format";
import type { Bias, EventImpact, Premarket } from "@/lib/types";

const BIAS_TONE: Record<Bias, string> = {
  bullish: "text-emerald-400",
  bearish: "text-rose-400",
  neutral: "text-slate-300",
};

const IMPACT_STYLES: Record<EventImpact, string> = {
  high: "text-rose-300",
  medium: "text-amber-300",
  low: "text-slate-400",
};

export function PremarketDetail({ record }: { record: Premarket }) {
  return (
    <div className="space-y-4">
      <Panel
        title={`${record.day}, ${longDate(record.date)}`}
        description="Full plan from that morning."
        action={
          <span className={`text-sm font-medium capitalize ${BIAS_TONE[record.dayBias]}`}>
            {record.dayBias} bias
          </span>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="label">Yesterday&apos;s price movement</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
              {record.yesterdayMovement || "—"}
            </dd>
          </div>
          <div>
            <dt className="label">Day bias reasoning</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
              {record.dayBiasNote || "—"}
            </dd>
          </div>
        </dl>
      </Panel>

      {record.candles.map((candle) => (
        <section key={candle.id} className="card space-y-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-200">{candle.label}</h3>
            <span className={`text-xs capitalize ${BIAS_TONE[candle.bias]}`}>
              {candle.bias}
            </span>
          </div>
          {candle.screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candle.screenshot}
              alt={candle.label}
              className="max-h-80 w-full rounded-lg object-contain"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-sky-500/25 px-3 py-6 text-center text-xs text-slate-500">
              No chart attached.
            </p>
          )}
          {candle.note ? (
            <p className="whitespace-pre-wrap text-sm text-slate-300">{candle.note}</p>
          ) : null}
        </section>
      ))}

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200">Important levels</h3>
        {record.levels.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None marked.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {record.levels.map((level) => (
              <li
                key={level.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-slate-400">{level.label || "Level"}</span>
                <span className="font-mono text-slate-200">{level.price}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200">Important events</h3>
        {record.events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Clear calendar.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {record.events.map((event) => (
              <li key={event.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-16 shrink-0 font-mono text-[11px] text-slate-500">
                  {event.time || "--:--"}
                </span>
                <span className="min-w-0 flex-1 text-slate-300">{event.title}</span>
                <span className={`shrink-0 capitalize ${IMPACT_STYLES[event.impact]}`}>
                  {event.impact}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
