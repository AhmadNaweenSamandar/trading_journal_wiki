import Link from "next/link";

import { HealthForm } from "@/components/HealthForm";
import { ReadinessReportView } from "@/components/ReadinessReport";
import { ScoreTrend } from "@/components/ScoreTrend";
import { Ring } from "@/components/circles";
import { PageHeader, Panel } from "@/components/ui";
import { getBiometrics, getTrades } from "@/lib/db";
import { currency, longDate, percent, tone } from "@/lib/format";
import {
  buildReadiness,
  computeBaseline,
  readinessVsResults,
  scoreHistory,
} from "@/lib/health";
import { todayKey } from "@/lib/premarket";

export const dynamic = "force-dynamic";

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ date }, records, trades] = await Promise.all([
    searchParams,
    getBiometrics(),
    getTrades(),
  ]);

  const today = todayKey();
  const targetDate = date ?? today;
  const record = records.find((r) => r.date === targetDate);
  const report = record ? buildReadiness(record, records) : null;
  const baseline = computeBaseline(records, targetDate);
  const outcomes = readinessVsResults(records, trades);
  const history = records.filter((r) => r.date !== targetDate).slice(0, 14);
  const trend = scoreHistory(records);

  return (
    <>
      <PageHeader
        title="Health"
        subtitle="Your P&L is a lagging indicator of your neurobiology. Decision making, focus, discipline and confidence are scored from overnight physiology, then used to set the risk you may take today."
        action={
          targetDate !== today ? (
            <Link
              href="/health"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            >
              Back to today
            </Link>
          ) : null
        }
      />

      {report ? (
        <ReadinessReportView report={report} />
      ) : (
        <div className="rounded-xl border border-dashed border-sky-500/25 p-6 text-center">
          <p className="text-sm text-slate-400">
            No readings logged for {longDate(targetDate)}.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Enter this morning&apos;s numbers below and the four scores build themselves.
          </p>
        </div>
      )}

      <div className="mt-4">
        <Panel
          title="Score trend"
          description="The four capacities over your last two weeks. The dashed line at 50 is the floor below which size is cut."
        >
          <ScoreTrend points={trend} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Your baseline"
          description={
            baseline.days === 0
              ? "Nothing logged yet. Every score is judged against your own rolling 30-day average, so the first two weeks are mostly about building it."
              : `Rolling 30-day average from ${baseline.days} logged ${baseline.days === 1 ? "day" : "days"}.${baseline.reliable ? "" : " Under 14 days, so treat deviations loosely."}`
          }
        >
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <BaselineStat label="HRV" value={baseline.hrv} unit=" ms" />
            <BaselineStat
              label="Resting HR"
              value={baseline.restingHeartRate}
              unit=" bpm"
            />
            <BaselineStat
              label="Respiratory"
              value={baseline.respiratoryRate}
              unit=" rpm"
              decimals={1}
            />
            <BaselineStat label="Deep sleep" value={baseline.sws} unit=" min" />
            <BaselineStat label="REM sleep" value={baseline.rem} unit=" min" />
            <div>
              <dt className="label">7-day HRV trend</dt>
              <dd
                className={`mt-0.5 text-sm font-semibold ${
                  baseline.hrvTrendPct == null
                    ? "text-slate-600"
                    : baseline.hrvTrendPct >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                }`}
              >
                {baseline.hrvTrendPct == null
                  ? "--"
                  : `${baseline.hrvTrendPct >= 0 ? "+" : ""}${baseline.hrvTrendPct.toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel
          title="Readiness against results"
          description="Whether the days your physiology called ready actually traded better. Grouped by the lowest of the four scores, since that is what governs the day."
        >
          {outcomes.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Log readings alongside your trades and this comparison builds itself.
            </p>
          ) : (
            <div className="space-y-3">
              {outcomes.map((row) => (
                <div
                  key={row.band}
                  className="flex items-center gap-4 rounded-lg border border-sky-500/20 p-3"
                >
                  <Ring
                    size={70}
                    thickness={8}
                    value={row.winRate}
                    color={
                      row.band === "optimal"
                        ? "#10b981"
                        : row.band === "moderate"
                          ? "#f59e0b"
                          : "#f43f5e"
                    }
                    centerValue={percent(row.winRate, 0)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200">{row.label}</p>
                    <p className="text-[11px] text-slate-500">
                      {row.days} {row.days === 1 ? "day" : "days"} · {row.trades} trades ·{" "}
                      {percent(row.ruleAdherence, 0)} on plan
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {currency(row.avgPnlPerTrade)} per trade
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${tone(row.netPnl)}`}>
                    {currency(row.netPnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <HealthForm key={targetDate} initial={record} date={targetDate} />
      </div>

      {history.length > 0 ? (
        <div className="mt-4">
          <Panel title="Previous mornings" description="Open one to review or edit it.">
            <ul className="divide-y divide-sky-500/20">
              {history.map((entry) => {
                const past = buildReadiness(entry, records);
                return (
                  <li key={entry.date}>
                    <Link
                      href={`/health?date=${entry.date}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-sky-400/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{longDate(entry.date)}</p>
                        <p className="truncate text-xs text-slate-500">
                          {entry.note ||
                            `Recovery ${entry.recoveryPct ?? "--"}% · HRV ${entry.hrv ?? "--"} ms`}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {past.composite == null
                          ? "--"
                          : `composite ${Math.round(past.composite)}`}
                      </span>
                      <span
                        className={`shrink-0 text-xs ${
                          past.risk.lockout ? "text-rose-400" : "text-slate-400"
                        }`}
                      >
                        {past.risk.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      ) : null}
    </>
  );
}

function BaselineStat({
  label,
  value,
  unit,
  decimals = 0,
}: {
  label: string;
  value: number | null;
  unit: string;
  decimals?: number;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-200">
        {value == null ? "--" : `${value.toFixed(decimals)}${unit}`}
      </dd>
    </div>
  );
}
