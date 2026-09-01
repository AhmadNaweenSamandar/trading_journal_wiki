import Link from "next/link";

import { EquityChart } from "@/components/charts";
import { Donut, Legend, Ring } from "@/components/circles";
import { SpreadsheetImportButton } from "@/components/SpreadsheetImportButton";
import {
  DirectionBadge,
  EmptyState,
  GradeBadge,
  Money,
  PageHeader,
  Panel,
  StatCard,
} from "@/components/ui";
import { getBiometrics, getSettings, getTrades } from "@/lib/db";
import { buildReadiness } from "@/lib/health";
import { todayKey } from "@/lib/premarket";
import { currency, percent, profitFactor, rValue, stamp, tone } from "@/lib/format";
import {
  computeStats,
  dateOf,
  equityCurve,
  groupBy,
  netPnl,
  rMultiple,
  ruleSplit,
  sortChronologically,
} from "@/lib/metrics";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [trades, biometrics, settings] = await Promise.all([
    getTrades(),
    getBiometrics(),
    getSettings(),
  ]);
  const todaysRead = biometrics.find((r) => r.date === todayKey());
  const readiness = todaysRead ? buildReadiness(todaysRead, biometrics) : null;

  if (trades.length === 0) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          subtitle="A local-first journal for organizing and analyzing your trading notes."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SpreadsheetImportButton settings={settings} />
              <Link
                href="/trades/new"
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
              >
                New entry
              </Link>
            </div>
          }
        />
        {readiness ? (
          <Link
            href="/health"
            className="card mb-4 flex flex-wrap items-center justify-between gap-4 p-4"
          >
            <div>
              <p className="label">Today&apos;s readiness</p>
              <p className="mt-0.5 text-sm text-slate-300">{readiness.risk.label}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {readiness.scores.map((score) => (
                <div key={score.key} className="text-center">
                  <Ring
                    size={64}
                    thickness={7}
                    value={score.score ?? 0}
                    color={
                      score.score == null
                        ? "#38bdf8"
                        : score.band === "optimal"
                          ? "#10b981"
                          : score.band === "moderate"
                            ? "#f59e0b"
                            : "#f43f5e"
                    }
                    centerValue={
                      score.score == null ? "--" : String(Math.round(score.score))
                    }
                  />
                  <p className="mt-1 text-[10px] text-slate-500">{score.label}</p>
                </div>
              ))}
            </div>
          </Link>
        ) : null}

        <EmptyState
          title="Your journal is empty"
          body="Log your first trade to start building the data set that shows which setups carry you and which drag you down. Set up your checklists first if you want the quality grade to match how you trade."
          cta={{ href: "/trades/new", label: "Log your first trade" }}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/settings"
            className="card p-4"
          >
            <p className="text-sm font-medium text-slate-200">Set up your checklists</p>
            <p className="mt-1 text-xs text-slate-500">
              Define what an A-grade setup means, list your rules, and choose your tag
              categories.
            </p>
          </Link>
          <Link
            href="/health"
            className="card p-4"
          >
            <p className="text-sm font-medium text-slate-200">Log this morning&apos;s readiness</p>
            <p className="mt-1 text-xs text-slate-500">
              Four scores from overnight physiology, and a hard cap on the risk you may take today.
            </p>
          </Link>
          <Link
            href="/wiki"
            className="card p-4"
          >
            <p className="text-sm font-medium text-slate-200">Read the method</p>
            <p className="mt-1 text-xs text-slate-500">
              The eight data points, the five-minute rule, and the weekly review
              framework.
            </p>
          </Link>
        </div>
      </>
    );
  }

  const stats = computeStats(trades);
  const curve = equityCurve(trades);
  const recent = sortChronologically(trades).slice(-6).reverse();
  const split = ruleSplit(trades);
  const strategies = groupBy(trades, (t) => t.strategy).slice(0, 5);
  const overRisk = stats.avgOverRisk;
  const chronological = sortChronologically(trades);
  const firstDate = dateOf(chronological[0]);
  const lastDate = dateOf(chronological[chronological.length - 1]);
  const tradingDays = new Set(trades.map(dateOf)).size;
  const peak = curve.reduce((max, point) => Math.max(max, point.equity), 0);
  const drawdown = peak - curve[curve.length - 1].equity;

  const ruleSegments = [
    {
      label: "Rules followed",
      value: split.followed.stats.count,
      color: "#10b981",
      detail: `${currency(split.followed.stats.netPnl)} · PF ${profitFactor(split.followed.stats.profitFactor)}`,
    },
    {
      label: "Rules broken",
      value: split.broken.stats.count,
      color: "#f43f5e",
      detail: `${currency(split.broken.stats.netPnl)} · PF ${profitFactor(split.broken.stats.profitFactor)}`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${stats.count} trades logged. The mechanical layer tells you what happened; the context layer tells you why.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SpreadsheetImportButton settings={settings} />
            <Link
              href="/trades/new"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            >
              New entry
            </Link>
          </div>
        }
      />

      {readiness ? (
        <Link
          href="/health"
          className="card mb-4 flex flex-wrap items-center justify-between gap-4 p-4"
        >
          <div>
            <p className="label">Today&apos;s readiness</p>
            <p className="mt-0.5 text-sm text-slate-300">
              {readiness.risk.label}
              {readiness.governing
                ? ` · ${readiness.governing.label} is governing`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {readiness.scores.map((score) => (
              <div key={score.key} className="text-center">
                <Ring
                  size={64}
                  thickness={7}
                  value={score.score ?? 0}
                    color={
                    score.score == null
                      ? "#38bdf8"
                      : score.band === "optimal"
                        ? "#10b981"
                        : score.band === "moderate"
                          ? "#f59e0b"
                          : "#f43f5e"
                  }
                  centerValue={score.score == null ? "--" : String(Math.round(score.score))}
                />
                <p className="mt-1 text-[10px] text-slate-500">{score.label}</p>
              </div>
            ))}
          </div>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Net P&L"
          value={currency(stats.netPnl)}
          valueClass={tone(stats.netPnl)}
          hint={`${stats.wins}W / ${stats.losses}L`}
        />
        <StatCard
          label="Win rate"
          value={percent(stats.winRate)}
          hint="Outcome, not quality"
        />
        <StatCard
          label="Profit factor"
          value={profitFactor(stats.profitFactor)}
          valueClass={
            stats.profitFactor == null || stats.profitFactor >= 1
              ? "text-emerald-400"
              : "text-rose-400"
          }
          hint="Gross win / gross loss"
        />
        <StatCard
          label="Expectancy"
          value={rValue(stats.expectancyR)}
          valueClass={tone(stats.expectancyR)}
          hint={`${currency(stats.expectancy)} per trade`}
        />
        <StatCard
          label="Rule adherence"
          value={percent(stats.ruleAdherence, 0)}
          hint={`${split.followed.stats.count} of ${stats.count} fully clean`}
        />
        <StatCard
          label="Over-risk"
          value={overRisk == null ? "--" : `+${overRisk.toFixed(0)}%`}
          valueClass={
            overRisk == null || overRisk === 0 ? "text-slate-100" : "text-rose-400"
          }
          hint="Average size above plan"
        />
      </div>

      <div className="mt-4">
        <Panel
          title="Equity curve"
          description="Cumulative net P&L over time. Flat stretches are days you did not trade."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
            <EquityChart points={curve} />
            <div className="grid grid-cols-2 gap-3 border-sky-500/20 lg:grid-cols-1 lg:border-l lg:pl-4">
              <SideStat label="Trades logged" value={String(stats.count)} />
              <SideStat label="Journaling since" value={firstDate || "--"} />
              <SideStat label="Last entry" value={lastDate || "--"} />
              <SideStat
                label="Trading days"
                value={`${tradingDays} · ${(stats.count / Math.max(1, tradingDays)).toFixed(1)}/day`}
              />
              <SideStat
                label="Peak equity"
                value={currency(peak)}
                className="text-emerald-400"
              />
              <SideStat
                label="From peak"
                value={drawdown > 0 ? `-${currency(drawdown)}` : "At highs"}
                className={drawdown > 0 ? "text-rose-400" : "text-emerald-400"}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Recent trades"
            description="The last six entries in your journal."
            action={
              <Link href="/trades" className="text-xs text-sky-400 hover:text-sky-300">
                View all
              </Link>
            }
          >
            <ul className="divide-y divide-sky-500/20">
              {recent.map((trade) => (
                <li key={trade.id}>
                  <Link
                    href={`/trades/${trade.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-sky-400/20"
                  >
                    <span className="w-9 shrink-0 font-mono text-xs text-slate-600">
                      #{trade.seq}
                    </span>
                    <GradeBadge grade={trade.grade} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100">
                          {trade.coin}
                        </span>
                        <DirectionBadge direction={trade.direction} />
                        <span className="truncate text-xs text-slate-500">
                          {trade.strategy}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {trade.exitReason || trade.tradeReason || "No reason recorded"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        <Money value={netPnl(trade)} />
                      </p>
                      <p className="text-xs text-slate-500">
                        {rValue(rMultiple(trade))} · {stamp(trade.entryAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Rules followed vs broken"
            description="The gap between these two is usually eye-opening."
          >
            <div className="flex items-center gap-4">
              <Donut
                segments={ruleSegments}
                centerValue={percent(stats.ruleAdherence, 0)}
                centerLabel="on plan"
                centerClass={
                  stats.ruleAdherence >= 100 ? "text-emerald-400" : "text-slate-100"
                }
              />
              <div className="min-w-0 flex-1">
                <Legend segments={ruleSegments} />
              </div>
            </div>
          </Panel>

          <Panel title="Strategy leaderboard" description="Ranked by net P&L.">
            <ul className="space-y-2.5">
              {strategies.map((group) => (
                <li key={group.key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{group.key}</p>
                    <p className="text-xs text-slate-500">
                      {group.stats.count} trades · PF{" "}
                      {profitFactor(group.stats.profitFactor)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm ${tone(group.stats.netPnl)}`}>
                    {currency(group.stats.netPnl)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/strategies"
              className="mt-3 block text-xs text-sky-400 hover:text-sky-300"
            >
              Full comparison
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}

function SideStat({
  label,
  value,
  className = "text-slate-200",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${className}`}>{value}</p>
    </div>
  );
}
