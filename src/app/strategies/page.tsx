import Link from "next/link";

import { EmptyState, Meter, PageHeader, Panel } from "@/components/ui";
import { getTrades } from "@/lib/db";
import { currency, percent, profitFactor, rValue, tone } from "@/lib/format";
import { computeStats, groupBy } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function StrategiesPage() {
  const trades = await getTrades();

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Strategies" />
        <EmptyState
          title="No strategies to compare yet"
          body="Assign a strategy to each trade and this page will rank them side by side by profit factor, expectancy, and rule adherence."
          cta={{ href: "/trades/new", label: "Log a trade" }}
        />
      </>
    );
  }

  const overall = computeStats(trades);
  const groups = groupBy(trades, (t) => t.strategy).sort((a, b) => {
    const pfA = a.stats.profitFactor ?? Number.POSITIVE_INFINITY;
    const pfB = b.stats.profitFactor ?? Number.POSITIVE_INFINITY;
    return pfB - pfA;
  });

  const carrying = groups.filter((g) => (g.stats.profitFactor ?? 99) >= 1);
  const dragging = groups.filter((g) => (g.stats.profitFactor ?? 99) < 1);
  const maxTrades = Math.max(...groups.map((g) => g.stats.count));

  return (
    <>
      <PageHeader
        title="Strategies"
        subtitle="Track win rate and profit factor by strategy, not just overall. The blended number hides which setups carry you."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="label">Overall profit factor</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-100">
            {profitFactor(overall.profitFactor)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Blended across {groups.length} strategies
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Carrying you</p>
          <p className="mt-1.5 text-2xl font-semibold text-emerald-400">
            {carrying.length}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {carrying.map((g) => g.key).join(", ") || "None"}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Below 1.0, cost you money</p>
          <p className="mt-1.5 text-2xl font-semibold text-rose-400">
            {dragging.length}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {dragging.map((g) => g.key).join(", ") || "None"}
          </p>
        </div>
      </div>

      <div className="card mb-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-sky-500/20 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">Strategy</th>
                <th className="px-4 py-3 text-right font-medium">Trades</th>
                <th className="px-4 py-3 text-right font-medium">Win rate</th>
                <th className="px-4 py-3 text-right font-medium">Profit factor</th>
                <th className="px-4 py-3 text-right font-medium">Expectancy</th>
                <th className="px-4 py-3 text-right font-medium">Adherence</th>
                <th className="px-4 py-3 text-right font-medium">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-500/20">
              {groups.map((group) => {
                const pf = group.stats.profitFactor;
                const losing = pf != null && pf < 1;
                return (
                  <tr key={group.key} className="hover:bg-sky-400/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{group.key}</div>
                      <div className="mt-1 w-32">
                        <Meter
                          value={group.stats.count}
                          max={maxTrades}
                          colorClass={losing ? "bg-rose-500/70" : "bg-emerald-500/70"}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {group.stats.count}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {percent(group.stats.winRate, 0)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        losing ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {profitFactor(pf)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${tone(group.stats.expectancyR)}`}
                    >
                      {rValue(group.stats.expectancyR)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {percent(group.stats.ruleAdherence, 0)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${tone(group.stats.netPnl)}`}
                    >
                      {currency(group.stats.netPnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Panel
        title="Grade breakdown by strategy"
        description="A-grade setups should show meaningfully higher expectancy than C-grade. If they do not, your entry criteria need tightening."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => {
            const byGrade = groupBy(group.trades, (t) => t.grade).sort((a, b) =>
              a.key.localeCompare(b.key),
            );
            return (
              <div key={group.key} className="rounded-lg border border-sky-500/25 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-sm font-medium text-slate-200">{group.key}</p>
                  <Link href="/trades" className="text-xs text-sky-400 hover:text-sky-300">
                    View trades
                  </Link>
                </div>
                <ul className="space-y-1.5">
                  {byGrade.map((grade) => (
                    <li
                      key={grade.key}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-500">
                        Grade {grade.key}
                        <span className="ml-1.5 text-slate-600">
                          ({grade.stats.count})
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className={tone(grade.stats.expectancyR)}>
                          {rValue(grade.stats.expectancyR)}
                        </span>
                        <span className={`w-16 text-right ${tone(grade.stats.netPnl)}`}>
                          {currency(grade.stats.netPnl)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
