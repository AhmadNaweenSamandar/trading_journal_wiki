import Link from "next/link";

import { BarRow, Donut, Legend, Ring } from "@/components/circles";
import { EmptyState, Meter, PageHeader, Panel } from "@/components/ui";
import { WeekNoteEditor } from "@/components/WeekNoteEditor";
import { getSettings, getTrades, getWeekNotes } from "@/lib/db";
import {
  currency,
  holdLabel,
  longDate,
  percent,
  profitFactor,
  rValue,
  tone,
  weekStart,
} from "@/lib/format";
import { dateOf, dayOf, groupBy, netPnl, rMultiple } from "@/lib/metrics";
import {
  baselineComparison,
  buildFindings,
  dayPatterns,
  detectDrift,
  edgeConcentration,
  intradaySequence,
  offPlanByHour,
  planAdherence,
  ruleViolations,
  strategyDrift,
  timingReport,
  winnerConcentration,
  type BaselineRow,
  type Finding,
} from "@/lib/patterns";

export const dynamic = "force-dynamic";

function shiftWeek(week: string, days: number): string {
  const [y, m, d] = week.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ week: requested }, trades, settings, weekNotes] = await Promise.all([
    searchParams,
    getTrades(),
    getSettings(),
    getWeekNotes(),
  ]);

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Weekly review" />
        <EmptyState
          title="Nothing to measure yet"
          body="Every number on this page is computed from your own logged trades. Log a week of entries and the review builds itself."
          cta={{ href: "/trades/new", label: "Log a trade" }}
        />
      </>
    );
  }

  const weeks = groupBy(trades, (t) => weekStart(dateOf(t))).sort((a, b) =>
    b.key.localeCompare(a.key),
  );
  const current = weeks.find((w) => w.key === requested) ?? weeks[0];
  const currentIndex = weeks.findIndex((w) => w.key === current.key);
  const previous = weeks[currentIndex + 1];

  // Patterns are measured across the whole journal so slices can reach a usable
  // sample size; the week above is what actually happened in the review period.
  const findings = buildFindings(trades, settings);
  const weekFindings = buildFindings(current.trades, settings);
  const actionable = findings.filter((f) => f.actionable);
  const ranked = (actionable.length > 0 ? actionable : findings).slice(0, 12);

  const drift = detectDrift(trades, settings.driftWindow);
  const setupDrift = strategyDrift(trades, settings.driftWindow);
  const concentration = edgeConcentration(trades);
  const days = dayPatterns(current.trades);
  const timing = timingReport(trades);

  const baseline = baselineComparison(current.trades, trades, current.key, settings);
  const adherence = planAdherence(current.trades, settings.offPlanThresholdPct);
  const violations = ruleViolations(current.trades, settings);
  const topWinner = winnerConcentration(current.trades);
  const adherenceColors: Record<string, string> = {
    "plan-win": "#10b981",
    "plan-loss": "#38bdf8",
    "off-plan-win": "#f59e0b",
    "off-plan-loss": "#f43f5e",
  };
  const concentrationSegments = (concentration?.contributors ?? []).map(
    (row, index) => ({
      label: row.key,
      value: Number(row.share.toFixed(1)),
      color: ["#10b981", "#38bdf8", "#a78bfa", "#fbbf24", "#f472b6"][index % 5],
      detail: currency(row.profit),
    }),
  );
  const adherenceSegments = adherence.cells.map((cell) => ({
    label: cell.label,
    value: cell.count,
    color: adherenceColors[cell.key],
    detail:
      cell.key === "off-plan-win" && cell.count > 0
        ? `${currency(cell.pnl)} · paid for breaking rules`
        : currency(cell.pnl),
  }));
  const sequence = intradaySequence(trades);
  const offPlanHours = offPlanByHour(trades);

  const lastWeek = shiftWeek(current.key, -7);
  const lastWeekNote = weekNotes.find((note) => note.weekStart === lastWeek) ?? null;
  const thisWeekNote = weekNotes.find((note) => note.weekStart === current.key) ?? null;

  return (
    <>
      <PageHeader
        title="Weekly review"
        subtitle={`Week of ${longDate(current.key)} · ${current.stats.count} trades · a repeatable five-step pass, every figure computed from your own logged data`}
        action={
          <div className="flex items-center gap-2">
            {weeks[currentIndex + 1] ? (
              <Link
                href={`/review?week=${weeks[currentIndex + 1].key}`}
                className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
              >
                Earlier
              </Link>
            ) : null}
            {weeks[currentIndex - 1] ? (
              <Link
                href={`/review?week=${weeks[currentIndex - 1].key}`}
                className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
              >
                Later
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Delta
          label="Net P&L"
          value={currency(current.stats.netPnl)}
          className={tone(current.stats.netPnl)}
          delta={previous ? current.stats.netPnl - previous.stats.netPnl : null}
          format={(v) => currency(v)}
        />
        <Delta
          label="Trades"
          value={String(current.stats.count)}
          className="text-slate-100"
          delta={previous ? current.stats.count - previous.stats.count : null}
          format={(v) => String(v)}
        />
        <Delta
          label="Win rate"
          value={percent(current.stats.winRate, 0)}
          className="text-slate-100"
          delta={previous ? current.stats.winRate - previous.stats.winRate : null}
          format={(v) => `${v.toFixed(0)} pts`}
        />
        <Delta
          label="Profit factor"
          value={profitFactor(current.stats.profitFactor)}
          className={
            current.stats.profitFactor == null || current.stats.profitFactor >= 1
              ? "text-emerald-400"
              : "text-rose-400"
          }
          delta={
            previous &&
            current.stats.profitFactor != null &&
            previous.stats.profitFactor != null
              ? current.stats.profitFactor - previous.stats.profitFactor
              : null
          }
          format={(v) => v.toFixed(2)}
        />
        <Delta
          label="Expectancy"
          value={rValue(current.stats.expectancyR)}
          className={tone(current.stats.expectancyR)}
          delta={
            previous ? current.stats.expectancyR - previous.stats.expectancyR : null
          }
          format={(v) => `${v.toFixed(2)}R`}
        />
        <Delta
          label="Rule adherence"
          value={percent(current.stats.ruleAdherence, 0)}
          className="text-slate-100"
          delta={
            previous ? current.stats.ruleAdherence - previous.stats.ruleAdherence : null
          }
          format={(v) => `${v.toFixed(0)} pts`}
        />
      </div>

      <div className="mb-4">
        <Panel
          title={`1 · This week vs your ${settings.baselineDays}-day baseline`}
          description={
            baseline.baselineTrades === 0
              ? `No trades logged between ${baseline.from} and ${baseline.to}, so there is nothing to compare against yet.`
              : `Baseline built from ${baseline.baselineTrades} trades between ${baseline.from} and ${baseline.to}. Anything ${settings.baselineDeviationPct}% or more away from normal is flagged.`
          }
        >
          <ul className="divide-y divide-sky-500/20">
            {baseline.rows.map((row) => (
              <BaselineLine key={row.label} row={row} />
            ))}
          </ul>
        </Panel>
      </div>

      {lastWeekNote?.body ? (
        <div className="mb-4">
          <Panel
            title="Key summary from last week"
            description={`Written at the end of the week of ${longDate(lastWeek)}.`}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {lastWeekNote.body}
            </p>
          </Panel>
        </div>
      ) : null}

      <div className="mb-4 grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="2 · Process vs outcome"
          description="Every decided trade this week graded on whether you followed your rules, before looking at whether it paid. A losing week inside your rules is variance; a winning week outside them is a warning."
        >
          {adherence.total === 0 ? (
            <p className="text-sm text-slate-500">
              No decided trades this week to grade.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <Donut
                  size={150}
                  segments={adherenceSegments}
                  centerValue={percent(100 - adherence.offPlanShare, 0)}
                  centerLabel="on plan"
                  centerClass={
                    adherence.breachesThreshold ? "text-rose-400" : "text-emerald-400"
                  }
                />
                <div className="min-w-[180px] flex-1">
                  <Legend segments={adherenceSegments} />
                </div>
                <Ring
                  size={104}
                  value={adherence.offPlanShare}
                  color={adherence.breachesThreshold ? "#f43f5e" : "#10b981"}
                  centerValue={percent(adherence.offPlanShare, 0)}
                  centerLabel="off plan"
                  centerClass={
                    adherence.breachesThreshold ? "text-rose-400" : "text-emerald-400"
                  }
                />
              </div>

              <p className="mt-3 border-t border-sky-500/20 pt-3 text-xs text-slate-500">
                {adherence.breachesThreshold
                  ? `Off-plan share is above your ${settings.offPlanThresholdPct}% threshold, so the constraint is execution rather than strategy.`
                  : `Off-plan share is within your ${settings.offPlanThresholdPct}% threshold.`}{" "}
                On-plan trades alone made {currency(adherence.planOnlyPnl)}.
              </p>
            </>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Repeat rule breaks this week"
            description="The same rule broken twice in one week is a pattern, not a slip. Ordered by what each one cost."
          >
            {violations.length === 0 ? (
              <p className="text-sm text-emerald-400">
                Every rule on your checklist was followed on every trade this week.
              </p>
            ) : (
              <ul className="space-y-2">
                {violations.map((violation) => (
                  <li
                    key={violation.id}
                    className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${
                      violation.pnl > 0
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : violation.pnl < 0
                          ? "border-rose-500/30 bg-rose-500/5"
                          : "border-sky-500/20"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200">{violation.label}</p>
                      <p className="text-[11px] text-slate-500">
                        Broken on {violation.count}{" "}
                        {violation.count === 1 ? "trade" : "trades"}
                        {violation.repeat ? " · repeat" : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm ${tone(violation.pnl)}`}>
                      {currency(violation.pnl)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Does the week survive without its best trade?"
            description="If one winner carries the week, the result is a single outcome rather than a repeatable edge."
          >
            {topWinner == null ? (
              <p className="text-sm text-slate-500">No winning trades this week.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-5">
                <Ring
                  size={112}
                  value={topWinner.shareOfGross}
                  color={topWinner.shareOfGross > 50 ? "#f59e0b" : "#10b981"}
                  centerValue={percent(topWinner.shareOfGross, 0)}
                  centerLabel="of gross"
                  centerClass={
                    topWinner.shareOfGross > 50 ? "text-amber-400" : "text-emerald-400"
                  }
                />
                <div className="min-w-[190px] flex-1">
                  <BarRow
                    height={110}
                    formatValue={(v) => currency(v)}
                    bars={[
                      { label: "Week", value: topWinner.netPnl },
                      {
                        label: "Minus best",
                        value: topWinner.netWithoutBest,
                        caption: `#${topWinner.best!.seq} ${topWinner.best!.coin}`,
                      },
                    ]}
                  />
                </div>
                <p className="w-full text-xs text-slate-500">
                  {topWinner.survivesRemoval
                    ? "The week is still profitable without its best trade."
                    : "Removing the best trade flips the week negative."}
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="3 · Patterns ranked by what they cost"
            description={`Measured across all ${trades.length} logged trades. Slices below your ${settings.minSampleSize}-trade floor are marked as thin samples.`}
          >
            {ranked.length === 0 ? (
              <p className="text-sm text-slate-500">
                No losing slices found in the data yet.
              </p>
            ) : (
              <ul className="divide-y divide-sky-500/20">
                {ranked.map((finding) => (
                  <FindingRow key={finding.id} finding={finding} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="This week in isolation"
            description="The same measurement restricted to the review period, before any sample-size filter."
          >
            {weekFindings.length === 0 ? (
              <p className="text-sm text-slate-500">
                No losing slices in this week&apos;s trades.
              </p>
            ) : (
              <ul className="divide-y divide-sky-500/20">
                {weekFindings.slice(0, 6).map((finding) => (
                  <FindingRow key={finding.id} finding={finding} compact />
                ))}
              </ul>
            )}
          </Panel>

          {drift ? (
            <Panel
              title={`Drift — last ${drift.windowSize} trades vs the ${drift.baseline.count} before`}
              description="Distribution shifts show up here before they show up in the equity curve."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-sky-500/20 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3 font-medium">Measure</th>
                      <th className="px-2 py-2 text-right font-medium">Baseline</th>
                      <th className="px-2 py-2 text-right font-medium">Recent</th>
                      <th className="py-2 pl-2 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-500/20">
                    <DriftRow
                      label="Win rate"
                      baseline={percent(drift.baseline.winRate, 0)}
                      recent={percent(drift.recent.winRate, 0)}
                      delta={drift.winRateDelta}
                      format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)} pts`}
                    />
                    <DriftRow
                      label="Average winner"
                      baseline={rValue(drift.avgWinR.baseline)}
                      recent={rValue(drift.avgWinR.recent)}
                      delta={
                        drift.avgWinR.recent != null && drift.avgWinR.baseline != null
                          ? drift.avgWinR.recent - drift.avgWinR.baseline
                          : null
                      }
                      format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`}
                    />
                    <DriftRow
                      label="Average loser"
                      baseline={rValue(drift.avgLossR.baseline)}
                      recent={rValue(drift.avgLossR.recent)}
                      delta={
                        drift.avgLossR.recent != null && drift.avgLossR.baseline != null
                          ? drift.avgLossR.recent - drift.avgLossR.baseline
                          : null
                      }
                      format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`}
                    />
                    <DriftRow
                      label="Expectancy per trade"
                      baseline={currency(drift.baseline.expectancy)}
                      recent={currency(drift.recent.expectancy)}
                      delta={drift.expectancyDelta}
                      format={(v) => `${v >= 0 ? "+" : ""}${currency(v)}`}
                    />
                    <DriftRow
                      label="Applied over the recent window"
                      baseline="--"
                      recent="--"
                      delta={drift.dollarDelta}
                      format={(v) => `${v >= 0 ? "+" : ""}${currency(v)}`}
                    />
                  </tbody>
                </table>
              </div>

              {setupDrift.length > 0 ? (
                <div className="mt-4 border-t border-sky-500/20 pt-3">
                  <p className="label mb-2">Per strategy</p>
                  <ul className="space-y-1.5">
                    {setupDrift.map((row) => (
                      <li
                        key={row.key}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate text-slate-300">
                          {row.key}
                        </span>
                        <span className="shrink-0 text-xs text-slate-600">
                          {row.sample} trades
                        </span>
                        <span className="w-24 shrink-0 text-right text-xs text-slate-500">
                          {percent(row.baseline.winRate, 0)} →{" "}
                          {percent(row.recent.winRate, 0)}
                        </span>
                        <span
                          className={`w-20 shrink-0 text-right ${tone(row.expectancyDelta)}`}
                        >
                          {row.expectancyDelta >= 0 ? "+" : ""}
                          {currency(row.expectancyDelta)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
          ) : (
            <Panel
              title="Drift"
              description={`Needs at least ${settings.driftWindow * 2} trades to compare a recent window against a baseline. You have ${trades.length}.`}
            >
              <Meter value={trades.length} max={settings.driftWindow * 2} />
            </Panel>
          )}

          <Panel
            title="Trade order within the day"
            description="Results by where a trade fell in the day's sequence. If P&L degrades after the first few, the extra trades are costing you rather than adding."
          >
            {sequence.length === 0 ? (
              <p className="text-sm text-slate-500">Not enough data yet.</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="label mb-2">Expectancy per trade</p>
                  <BarRow
                    height={150}
                    formatValue={(v) => currency(v)}
                    bars={sequence.map((row) => ({
                      label: row.ordinal,
                      value: Number(row.stats.expectancy.toFixed(2)),
                      caption: `${row.stats.count} trades`,
                    }))}
                  />
                </div>
                <div>
                  <p className="label mb-2">Win rate</p>
                  <div className="flex flex-wrap justify-around gap-3">
                    {sequence.map((row) => (
                      <div key={row.ordinal} className="text-center">
                        <Ring
                          size={78}
                          thickness={8}
                          value={row.stats.winRate}
                          color={row.stats.netPnl >= 0 ? "#10b981" : "#f43f5e"}
                          centerValue={percent(row.stats.winRate, 0)}
                        />
                        <p className="mt-1 text-[11px] text-slate-400">{row.ordinal}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Panel>

          {offPlanHours.length > 0 ? (
            <Panel
              title="When rule breaks happen"
              description="Off-plan trades by entry hour, across the whole journal. Rule breaks usually cluster in a specific part of the session."
            >
              <div className="flex flex-wrap justify-around gap-4">
                {offPlanHours.slice(0, 6).map((row) => (
                  <div key={row.hour} className="text-center">
                    <Ring
                      size={88}
                      value={row.share}
                      color="#f43f5e"
                      centerValue={percent(row.share, 0)}
                      centerLabel="off plan"
                      centerClass="text-rose-400"
                    />
                    <p className="mt-1 font-mono text-sm text-slate-300">{row.hour}</p>
                    <p className="text-[11px] text-slate-500">
                      {row.offPlan} of {row.total}
                    </p>
                    <p className={`text-[11px] ${tone(row.pnl)}`}>
                      {currency(row.pnl)}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel
            title="Timing"
            description="How long you hold, and when in the day and week your results actually come from. Measured across the whole journal."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <TimingCard
                label="Longest trade"
                primary={holdLabel(timing.longest?.minutes ?? null)}
                lines={
                  timing.longest
                    ? [
                        `#${timing.longest.trade.seq} ${timing.longest.trade.coin} · ${dayOf(timing.longest.trade)}`,
                        `${currency(netPnl(timing.longest.trade))} · ${rValue(rMultiple(timing.longest.trade))}`,
                      ]
                    : ["No timestamped trades yet."]
                }
                className={
                  timing.longest ? tone(netPnl(timing.longest.trade)) : "text-slate-400"
                }
              />
              <TimingCard
                label="Shortest trade"
                primary={holdLabel(timing.shortest?.minutes ?? null)}
                lines={
                  timing.shortest
                    ? [
                        `#${timing.shortest.trade.seq} ${timing.shortest.trade.coin} · ${dayOf(timing.shortest.trade)}`,
                        `${currency(netPnl(timing.shortest.trade))} · ${rValue(rMultiple(timing.shortest.trade))}`,
                      ]
                    : ["No timestamped trades yet."]
                }
                className={
                  timing.shortest ? tone(netPnl(timing.shortest.trade)) : "text-slate-400"
                }
              />
              <TimingCard
                label="Average hold on winners"
                primary={holdLabel(
                  timing.avgHoldWinners == null
                    ? null
                    : Math.round(timing.avgHoldWinners),
                )}
                lines={[
                  timing.avgHoldLosers == null
                    ? "No losers to compare against."
                    : `Losers average ${holdLabel(Math.round(timing.avgHoldLosers))}.`,
                ]}
                className="text-emerald-400"
              />
              <TimingCard
                label="Average hold on losers"
                primary={holdLabel(
                  timing.avgHoldLosers == null ? null : Math.round(timing.avgHoldLosers),
                )}
                lines={[
                  timing.avgHoldWinners != null && timing.avgHoldLosers != null
                    ? timing.avgHoldLosers > timing.avgHoldWinners
                      ? "You hold losers longer than winners."
                      : "You hold winners longer than losers."
                    : "Not enough data to compare.",
                ]}
                className="text-rose-400"
              />
              <TimingCard
                label="Best hour of day"
                primary={timing.bestHour?.hour ?? "--"}
                lines={
                  timing.bestHour
                    ? [
                        `${currency(timing.bestHour.stats.netPnl)} over ${timing.bestHour.stats.count} trades`,
                        `${percent(timing.bestHour.stats.winRate, 0)} win rate`,
                      ]
                    : ["No entry times recorded."]
                }
                className="text-emerald-400"
              />
              <TimingCard
                label="Worst hour of day"
                primary={timing.worstHour?.hour ?? "--"}
                lines={
                  timing.worstHour
                    ? [
                        `${currency(timing.worstHour.stats.netPnl)} over ${timing.worstHour.stats.count} trades`,
                        `${percent(timing.worstHour.stats.winRate, 0)} win rate`,
                      ]
                    : ["No entry times recorded."]
                }
                className="text-rose-400"
              />
              <TimingCard
                label="Best day of week"
                primary={timing.bestDay?.day ?? "--"}
                lines={
                  timing.bestDay
                    ? [
                        `${currency(timing.bestDay.stats.netPnl)} over ${timing.bestDay.stats.count} trades`,
                        `${percent(timing.bestDay.stats.winRate, 0)} win rate`,
                      ]
                    : ["No days recorded."]
                }
                className="text-emerald-400"
              />
              <TimingCard
                label="Worst day of week"
                primary={timing.worstDay?.day ?? "--"}
                lines={
                  timing.worstDay
                    ? [
                        `${currency(timing.worstDay.stats.netPnl)} over ${timing.worstDay.stats.count} trades`,
                        `${percent(timing.worstDay.stats.winRate, 0)} win rate`,
                      ]
                    : ["No days recorded."]
                }
                className="text-rose-400"
              />
            </div>

            {timing.longestDay || timing.shortestDay ? (
              <p className="mt-3 border-t border-sky-500/20 pt-3 text-xs text-slate-500">
                Your longest hold landed on a {timing.longestDay}; your shortest on a{" "}
                {timing.shortestDay}.
              </p>
            ) : null}
          </Panel>

        </div>

        <div className="space-y-4">
          <Panel title="Day pattern" description="This week's sessions.">
            <div className="mb-3 flex justify-center">
              <Donut
                size={126}
                segments={[
                  { label: "Green days", value: days.greenDays, color: "#10b981" },
                  { label: "Red days", value: days.redDays, color: "#f43f5e" },
                ]}
                centerValue={`${days.greenDays}/${days.greenDays + days.redDays}`}
                centerLabel="green"
                centerClass={
                  days.greenDays >= days.redDays ? "text-emerald-400" : "text-rose-400"
                }
              />
            </div>
            <dl className="space-y-2 text-sm">
              <Stat
                label="Longest green streak"
                value={`${days.longestGreenStreak} days`}
              />
              <Stat label="Longest red streak" value={`${days.longestRedStreak} days`} />
              <Stat
                label="Red day after a green day"
                value={`${days.givebackDays} · ${currency(days.givebackCost)}`}
              />
            </dl>
          </Panel>

          {concentration && concentration.contributors.length > 0 ? (
            <Panel
              title="Edge concentration"
              description={`${percent(concentration.topShare, 0)} of gross profit comes from your top ${Math.min(2, concentration.contributors.length)} strategies.`}
            >
              <div className="flex flex-col items-center gap-3">
                <Donut
                  size={140}
                  segments={concentrationSegments}
                  centerValue={percent(concentration.topShare, 0)}
                  centerLabel="top 2"
                  centerClass={
                    concentration.topShare > 80 ? "text-amber-400" : "text-slate-100"
                  }
                />
                <div className="w-full">
                  <Legend segments={concentrationSegments} />
                </div>
              </div>
              <p className="mt-3 border-t border-sky-500/20 pt-3 text-xs text-slate-500">
                {concentration.carrying} strategies net positive ·{" "}
                {concentration.dragging} net negative
              </p>
            </Panel>
          ) : null}

        </div>
      </div>

      <div className="mt-4">
        <Panel title="Week over week" description="Every week you have logged.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-sky-500/20 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3 font-medium">Week of</th>
                  <th className="px-2 py-2 text-right font-medium">Trades</th>
                  <th className="px-2 py-2 text-right font-medium">Win</th>
                  <th className="px-2 py-2 text-right font-medium">Adherence</th>
                  <th className="px-2 py-2 text-right font-medium">Quality</th>
                  <th className="px-2 py-2 text-right font-medium">PF</th>
                  <th className="py-2 pl-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-500/20">
                {weeks.map((week) => (
                  <tr
                    key={week.key}
                    className={week.key === current.key ? "bg-sky-500/5" : ""}
                  >
                    <td className="py-2 pr-3">
                      <Link
                        href={`/review?week=${week.key}`}
                        className="text-slate-300 hover:text-sky-300"
                      >
                        {longDate(week.key)}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right text-slate-500">
                      {week.stats.count}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-400">
                      {percent(week.stats.winRate, 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-400">
                      {percent(week.stats.ruleAdherence, 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-400">
                      {percent(week.stats.avgQualityScore, 0)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-400">
                      {profitFactor(week.stats.profitFactor)}
                    </td>
                    <td className={`py-2 pl-2 text-right ${tone(week.stats.netPnl)}`}>
                      {currency(week.stats.netPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="4 · Lessons logged this week"
          description="Read each one on its own. These are the words you wrote while the trade was still fresh."
          action={
            <Link href="/lessons" className="text-xs text-sky-400 hover:text-sky-300">
              All lessons
            </Link>
          }
        >
          {current.trades.some((trade) => trade.lesson) ? (
            <ul className="space-y-4">
              {current.trades
                .filter((trade) => trade.lesson)
                .map((trade) => (
                  <li
                    key={trade.id}
                    className="rounded-lg border border-sky-500/20 px-4 py-3"
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                      {trade.lesson}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      <Link
                        href={`/trades/${trade.id}`}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        #{trade.seq} {trade.coin}
                      </Link>
                      <span className="mx-1.5 text-slate-600">·</span>
                      {longDate(dateOf(trade))}
                      <span className="mx-1.5 text-slate-600">·</span>
                      <span className={tone(netPnl(trade))}>{currency(netPnl(trade))}</span>
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No lessons recorded this week.</p>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="5 · This week's notes"
          description="Your summary after sitting with the numbers. Next week's review opens with this as last week's key summary."
        >
          <WeekNoteEditor weekStart={current.key} initial={thisWeekNote?.body ?? ""} />
        </Panel>
      </div>
    </>
  );
}

function FindingRow({ finding, compact }: { finding: Finding; compact?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={`mt-0.5 w-20 shrink-0 text-right text-sm font-semibold ${
          finding.kind === "opportunity" ? "text-sky-400" : "text-rose-400"
        }`}
      >
        {currency(finding.impact)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200">
          <span className="text-slate-500">{finding.category} — </span>
          {finding.subject}
        </p>
        {!compact ? (
          <p className="mt-0.5 text-xs text-slate-500">{finding.detail}</p>
        ) : null}
      </div>
      {!finding.actionable ? (
        <span className="mt-0.5 shrink-0 rounded bg-sky-500/25 px-1.5 py-0.5 text-[10px] text-slate-500">
          n={finding.sample}
        </span>
      ) : null}
    </li>
  );
}

function DriftRow({
  label,
  baseline,
  recent,
  delta,
  format,
}: {
  label: string;
  baseline: string;
  recent: string;
  delta: number | null;
  format: (value: number) => string;
}) {
  return (
    <tr>
      <td className="py-2 pr-3 text-slate-300">{label}</td>
      <td className="px-2 py-2 text-right text-slate-500">{baseline}</td>
      <td className="px-2 py-2 text-right text-slate-300">{recent}</td>
      <td className={`py-2 pl-2 text-right ${delta == null ? "" : tone(delta)}`}>
        {delta == null ? "--" : format(delta)}
      </td>
    </tr>
  );
}

function Delta({
  label,
  value,
  className,
  delta,
  format,
}: {
  label: string;
  value: string;
  className: string;
  delta: number | null;
  format: (value: number) => string;
}) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${className}`}>{value}</p>
      {delta != null ? (
        <p className={`mt-1 text-xs ${tone(delta)}`}>
          {delta >= 0 ? "+" : ""}
          {format(delta)} vs prior week
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-600">No prior week</p>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-sky-500/20 p-3">
      <p className="label">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${className}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}

function formatMetric(value: number, format: BaselineRow["format"]): string {
  if (format === "currency") return currency(value);
  if (format === "percent") return percent(value, 0);
  if (format === "ratio") return value.toFixed(2);
  return value.toFixed(1);
}

function BaselineLine({ row }: { row: BaselineRow }) {
  // A flagged move is only bad if it went the wrong way for this metric.
  const improved =
    row.deviation == null
      ? null
      : row.higherIsBetter
        ? row.deviation > 0
        : row.deviation < 0;

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-slate-300">{row.label}</p>
        <p className="text-[11px] text-slate-600">
          {row.baseline == null
            ? "No baseline yet"
            : `Baseline ${formatMetric(row.baseline, row.format)}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-slate-100">
          {formatMetric(row.value, row.format)}
        </p>
        {row.deviation == null ? null : (
          <p
            className={`text-[11px] ${
              !row.flagged
                ? "text-slate-600"
                : improved
                  ? "text-emerald-400"
                  : "text-rose-400"
            }`}
          >
            {row.deviation >= 0 ? "+" : ""}
            {row.deviation.toFixed(0)}%{row.flagged ? " off normal" : ""}
          </p>
        )}
      </div>
    </li>
  );
}

function TimingCard({
  label,
  primary,
  lines,
  className,
}: {
  label: string;
  primary: string;
  lines: string[];
  className: string;
}) {
  return (
    <div className="rounded-lg border border-sky-500/20 p-3">
      <p className="label">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${className}`}>{primary}</p>
      {lines.map((line) => (
        <p key={line} className="mt-0.5 text-xs text-slate-500">
          {line}
        </p>
      ))}
    </div>
  );
}
