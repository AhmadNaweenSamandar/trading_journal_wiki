import Link from "next/link";

import { EmptyState, GradeBadge, Money, PageHeader, Panel } from "@/components/ui";
import { getTrades } from "@/lib/db";
import { rValue, stamp, tone } from "@/lib/format";
import { groupBy, netPnl, rMultiple, sortChronologically } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const trades = await getTrades();
  const withLessons = sortChronologically(trades)
    .filter((t) => t.lesson)
    .reverse();

  if (withLessons.length === 0) {
    return (
      <>
        <PageHeader title="Lessons" />
        <EmptyState
          title="No lessons captured yet"
          body="One sentence per trade. Not every trade has a lesson, and that is fine. Read twenty in a row and the themes jump out."
          cta={{ href: "/trades/new", label: "Log a trade" }}
        />
      </>
    );
  }

  const exitReasons = groupBy(
    trades.filter((t) => t.exitReason),
    (t) => t.exitReason.toLowerCase().slice(0, 40),
  ).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Lessons"
        subtitle={`${withLessons.length} one-liners, newest first. These become gold during the weekly review.`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Every lesson" description="Read them in a row.">
            <ul className="divide-y divide-sky-500/20">
              {withLessons.map((trade) => (
                <li key={trade.id}>
                  <Link
                    href={`/trades/${trade.id}`}
                    className="-mx-2 flex gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-sky-400/20"
                  >
                    <GradeBadge grade={trade.grade} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200">{trade.lesson}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {trade.coin} · {trade.strategy} · {stamp(trade.entryAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm">
                        <Money value={netPnl(trade)} />
                      </p>
                      <p className={`text-xs ${tone(rMultiple(trade) ?? 0)}`}>
                        {rValue(rMultiple(trade))}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div>
          <Panel
            title="Recurring exit reasons"
            description="Exit reasons reveal the patterns that cost you the most money."
          >
            {exitReasons.length === 0 ? (
              <p className="text-sm text-slate-500">No exit reasons recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {exitReasons.map((group) => (
                  <li key={group.key}>
                    <p className="text-sm text-slate-300 first-letter:uppercase">
                      {group.key}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {group.stats.count}{" "}
                        {group.stats.count === 1 ? "time" : "times"}
                      </span>
                      <span className={tone(group.stats.netPnl)}>
                        {group.stats.netPnl >= 0 ? "+" : ""}
                        {group.stats.netPnl.toFixed(2)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
