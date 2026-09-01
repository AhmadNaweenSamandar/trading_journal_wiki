import { RHistogram } from "@/components/charts";
import { Donut, Legend } from "@/components/circles";
import { EmptyState, Meter, PageHeader, Panel, StatCard } from "@/components/ui";
import { getSettings, getTrades } from "@/lib/db";
import { currency, percent, profitFactor, rValue, tone } from "@/lib/format";
import {
  computeStats,
  dayOf,
  emotionRiskReport,
  groupBy,
  rMultiple,
  type Group,
} from "@/lib/metrics";
import { RISK_EMOTIONS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

/** Tilt emotions are always red; the rest take their colour from what they earned. */
function emotionColor(emotion: string, netPnl: number): string {
  if (RISK_EMOTIONS.has(emotion)) return "#f43f5e";
  if (netPnl > 0) return "#10b981";
  if (netPnl < 0) return "#fb7185";
  return "#64748b";
}

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default async function AnalyticsPage() {
  const [trades, settings] = await Promise.all([getTrades(), getSettings()]);

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Analytics" />
        <EmptyState
          title="Nothing to analyze yet"
          body="Once you have a handful of trades logged, this page breaks your results down by setup quality, emotion, tags, day of week, and coin."
          cta={{ href: "/trades/new", label: "Log a trade" }}
        />
      </>
    );
  }

  const stats = computeStats(trades);
  const tilt = emotionRiskReport(trades);
  const rValues = trades.map(rMultiple).filter((r): r is number => r != null);

  const byGrade = groupBy(trades, (t) => t.grade).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  const byDay = groupBy(trades, dayOf).sort(
    (a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key),
  );
  const byCoin = groupBy(trades, (t) => t.coin);
  const byTimeframe = groupBy(trades, (t) => t.timeframe);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="This is where psychology and process become measurable instead of theoretical."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Avg setup quality"
          value={percent(stats.avgQualityScore, 0)}
          hint="Checklist completion"
        />
        <StatCard
          label="Avg rule score"
          value={percent(stats.avgRuleScore, 0)}
          hint={`${percent(stats.ruleAdherence, 0)} fully clean`}
        />
        <StatCard
          label="Plan capture"
          value={
            stats.avgPlanCapture == null
              ? "--"
              : percent(stats.avgPlanCapture * 100, 0)
          }
          hint="Of planned reward"
        />
        <StatCard
          label="Fees paid"
          value={currency(stats.totalFees)}
          hint={`${percent(
            stats.grossProfit > 0 ? (stats.totalFees / stats.grossProfit) * 100 : 0,
            0,
          )} of gross profit`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="R-multiple distribution"
          description="Where your results actually land, in units of risk."
        >
          <RHistogram values={rValues} />
        </Panel>

        <Panel
          title="Setup quality vs outcome"
          description="A-grade setups should show meaningfully higher expectancy than C-grade. If they do not, tighten your entry criteria."
        >
          <GroupTable groups={byGrade} labelHeading="Grade" />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Emotion by stage of the trade"
          description="Splitting emotion across the life of the trade is what makes it diagnostic."
          action={
            tilt.count > 0 ? (
              <span className="text-xs text-slate-500">
                {tilt.count} trades touched a tilt emotion ·{" "}
                <span className={tone(tilt.cost)}>{currency(tilt.cost)}</span>
              </span>
            ) : null
          }
        >
          {settings.emotionQuestions.length === 0 ? (
            <p className="text-sm text-slate-500">No emotion questions configured.</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {settings.emotionQuestions.map((question) => {
                const answered = trades.filter((t) => t.emotions[question.id]);
                const groups = groupBy(answered, (t) => t.emotions[question.id]);
                const segments = groups.map((group) => ({
                  label: group.key,
                  value: group.stats.count,
                  color: emotionColor(group.key, group.stats.netPnl),
                  detail: `${currency(group.stats.netPnl)} · ${percent(group.stats.winRate, 0)} win`,
                }));
                const net = groups.reduce((sum, g) => sum + g.stats.netPnl, 0);

                return (
                  <div key={question.id}>
                    <p className="mb-2 text-xs font-medium text-slate-300">
                      {question.label}
                    </p>
                    {groups.length === 0 ? (
                      <p className="text-xs text-slate-600">Not recorded yet.</p>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Donut
                          size={116}
                          thickness={13}
                          segments={segments}
                          centerValue={currency(net)}
                          centerLabel={`${answered.length} logged`}
                          centerClass={tone(net)}
                        />
                        <div className="min-w-0 flex-1">
                          <Legend segments={segments} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="By day of week" description="When you actually perform.">
          <GroupTable groups={byDay} labelHeading="Day" />
        </Panel>
        <Panel title="By coin" description="Which markets suit you.">
          <GroupTable groups={byCoin} labelHeading="Coin" />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="By timeframe" description="Which timeframe produces your best expectancy.">
          <GroupTable groups={byTimeframe} labelHeading="Timeframe" />
        </Panel>

        {settings.tagCategories.map((category) => {
          const tagged = trades.filter((t) => t.tags[category.id]);
          return (
            <Panel
              key={category.id}
              title={`By ${category.name.toLowerCase()}`}
              description={
                tagged.length === 0
                  ? "No trades tagged in this category yet."
                  : `${tagged.length} of ${trades.length} trades tagged.`
              }
            >
              {tagged.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing to show.</p>
              ) : (
                <GroupTable
                  groups={groupBy(tagged, (t) => t.tags[category.id])}
                  labelHeading={category.name}
                />
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}

function GroupTable({
  groups,
  labelHeading,
}: {
  groups: Group[];
  labelHeading: string;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-slate-500">No data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead>
          <tr className="border-b border-sky-500/20 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-3 font-medium">{labelHeading}</th>
            <th className="px-2 py-2 text-right font-medium">n</th>
            <th className="px-2 py-2 text-right font-medium">Win</th>
            <th className="px-2 py-2 text-right font-medium">PF</th>
            <th className="px-2 py-2 text-right font-medium">Exp</th>
            <th className="py-2 pl-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sky-500/20">
          {groups.map((group) => (
            <tr key={group.key}>
              <td className="py-2 pr-3 text-slate-200">{group.key}</td>
              <td className="px-2 py-2 text-right text-slate-500">
                {group.stats.count}
              </td>
              <td className="px-2 py-2 text-right text-slate-400">
                {percent(group.stats.winRate, 0)}
              </td>
              <td
                className={`px-2 py-2 text-right ${
                  group.stats.profitFactor == null || group.stats.profitFactor >= 1
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {profitFactor(group.stats.profitFactor)}
              </td>
              <td className={`px-2 py-2 text-right ${tone(group.stats.expectancyR)}`}>
                {rValue(group.stats.expectancyR)}
              </td>
              <td className={`py-2 pl-2 text-right ${tone(group.stats.netPnl)}`}>
                {currency(group.stats.netPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
