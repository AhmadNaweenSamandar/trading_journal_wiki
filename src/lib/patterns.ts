import { currency, percent, profitFactor } from "./format";
import {
  byDay,
  computeStats,
  dateOf,
  dayOf,
  groupBy,
  holdMinutes,
  netPnl,
  plannedRewardLeg,
  rMultiple,
  sortChronologically,
  type Stats,
} from "./metrics";
import type { Settings, Trade } from "./types";

/**
 * Every finding is a measurement taken from the logged trades. The impact is
 * the dollar amount attached to the pattern, so findings can be ranked against
 * each other rather than against an opinion about which one matters more.
 */
export type FindingKind = "cost" | "opportunity";

export interface Finding {
  /** Stable across weeks so a saved focus can be re-measured later. */
  id: string;
  category: string;
  subject: string;
  headline: string;
  detail: string;
  impact: number;
  kind: FindingKind;
  sample: number;
  actionable: boolean;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function statLine(stats: Stats): string {
  return `${stats.count} trades · ${percent(stats.winRate, 0)} win · PF ${profitFactor(
    stats.profitFactor,
  )} · ${currency(stats.netPnl)}`;
}

function minutesBetween(from: string, to: string): number | null {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / 60000;
}

/** Losing slices of a grouping, each priced at what it cost over the period. */
function segmentCosts(
  trades: Trade[],
  keyOf: (t: Trade) => string,
  category: string,
  minSample: number,
): Finding[] {
  return groupBy(trades, keyOf)
    .filter((group) => group.stats.netPnl < 0 && group.key !== "Untagged")
    .map((group) => ({
      id: `${slug(category)}:${slug(group.key)}`,
      category,
      subject: group.key,
      headline: `${currency(group.stats.netPnl)} over ${group.stats.count} trades`,
      detail: statLine(group.stats),
      impact: -group.stats.netPnl,
      kind: "cost" as const,
      sample: group.stats.count,
      actionable: group.stats.count >= minSample,
    }));
}

function emotionCosts(
  trades: Trade[],
  settings: Settings,
): Finding[] {
  const findings: Finding[] = [];
  for (const question of settings.emotionQuestions) {
    const answered = trades.filter((t) => t.emotions[question.id]);
    if (answered.length === 0) continue;
    findings.push(
      ...segmentCosts(
        answered,
        (t) => t.emotions[question.id],
        `Emotion — ${question.label}`,
        settings.minSampleSize,
      ),
    );
  }
  return findings;
}

function ruleCosts(trades: Trade[], settings: Settings): Finding[] {
  const findings: Finding[] = [];

  const broken = trades.filter((t) => !t.rulesFollowed);
  if (broken.length > 0) {
    const stats = computeStats(broken);
    if (stats.netPnl < 0) {
      findings.push({
        id: "rules:any-broken",
        category: "Rule adherence",
        subject: "Trades with any rule broken",
        headline: `${currency(stats.netPnl)} over ${stats.count} trades`,
        detail: statLine(stats),
        impact: -stats.netPnl,
        kind: "cost",
        sample: stats.count,
        actionable: stats.count >= settings.minSampleSize,
      });
    }
  }

  for (const rule of settings.rulesChecklist) {
    const missed = trades.filter((t) => !t.ruleChecks.includes(rule.id));
    if (missed.length === 0) continue;
    const stats = computeStats(missed);
    if (stats.netPnl >= 0) continue;
    findings.push({
      id: `rule:${rule.id}`,
      category: "Rule adherence",
      subject: rule.label,
      headline: `${currency(stats.netPnl)} when this rule was not ticked`,
      detail: statLine(stats),
      impact: -stats.netPnl,
      kind: "cost",
      sample: stats.count,
      actionable: stats.count >= settings.minSampleSize,
    });
  }

  return findings;
}

export interface Cascade {
  trigger: Trade;
  followUps: Trade[];
}

/**
 * A losing exit followed by another entry inside the configured window.
 * Measures the sequence itself rather than relying on memory of "bad days".
 */
export function findCascades(trades: Trade[], windowMinutes: number): Cascade[] {
  const ordered = sortChronologically(trades);
  const cascades: Cascade[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    if (netPnl(ordered[i]) >= 0) continue;
    const followUps: Trade[] = [];
    let cursor = ordered[i];
    for (let j = i + 1; j < ordered.length; j += 1) {
      const gap = minutesBetween(cursor.exitAt, ordered[j].entryAt);
      if (gap == null || gap < 0 || gap > windowMinutes) break;
      followUps.push(ordered[j]);
      cursor = ordered[j];
    }
    if (followUps.length > 0) cascades.push({ trigger: ordered[i], followUps });
  }

  return cascades;
}

function cascadeFinding(trades: Trade[], settings: Settings): Finding | null {
  const cascades = findCascades(trades, settings.cascadeWindowMinutes);
  const followUps = cascades.flatMap((c) => c.followUps);
  if (followUps.length === 0) return null;

  const stats = computeStats(followUps);
  if (stats.netPnl >= 0) return null;

  const losingSessions = new Set(
    trades.filter((t) => netPnl(t) < 0).map((t) => dateOf(t)),
  ).size;
  const cascadeSessions = new Set(cascades.map((c) => dateOf(c.trigger))).size;

  return {
    id: "cascade:re-entry-after-loss",
    category: "Behavioural cascade",
    subject: `Re-entry within ${settings.cascadeWindowMinutes} minutes of a losing exit`,
    headline: `${currency(stats.netPnl)} over ${stats.count} follow-up trades`,
    detail: `${statLine(stats)} · occurred on ${cascadeSessions} of ${losingSessions} sessions that had a loss`,
    impact: -stats.netPnl,
    kind: "cost",
    sample: stats.count,
    actionable: stats.count >= settings.minSampleSize,
  };
}

/* -------------------------------------------------------------------------- */
/*                          Weekly review measurements                        */
/* -------------------------------------------------------------------------- */

/**
 * Plan adherence graded four ways. Splitting outcome from process separates a
 * normal losing week from a week you got paid for breaking your own rules.
 */
export interface AdherenceCell {
  key: "plan-win" | "plan-loss" | "off-plan-win" | "off-plan-loss";
  label: string;
  count: number;
  pnl: number;
  trades: Trade[];
}

export interface AdherenceReport {
  cells: AdherenceCell[];
  total: number;
  offPlanCount: number;
  offPlanShare: number;
  /** P&L earned while breaking rules. Positive here is a reward for bad process. */
  offPlanWinPnl: number;
  offPlanLossPnl: number;
  /** Net P&L with every off-plan trade removed. */
  planOnlyPnl: number;
  breachesThreshold: boolean;
}

export function planAdherence(trades: Trade[], threshold: number): AdherenceReport {
  const decided = trades.filter((t) => t.outcome !== "breakeven");
  const pick = (onPlan: boolean, win: boolean) =>
    decided.filter((t) => t.rulesFollowed === onPlan && netPnl(t) > 0 === win);

  const sum = (group: Trade[]) => group.reduce((total, t) => total + netPnl(t), 0);

  const groups: AdherenceCell[] = [
    { key: "plan-win", label: "Plan win", trades: pick(true, true) },
    { key: "plan-loss", label: "Plan loss", trades: pick(true, false) },
    { key: "off-plan-win", label: "Off-plan win", trades: pick(false, true) },
    { key: "off-plan-loss", label: "Off-plan loss", trades: pick(false, false) },
  ].map((cell) => ({
    ...cell,
    count: cell.trades.length,
    pnl: sum(cell.trades),
  })) as AdherenceCell[];

  const offPlan = decided.filter((t) => !t.rulesFollowed);
  const total = decided.length;
  const share = total ? (offPlan.length / total) * 100 : 0;

  return {
    cells: groups,
    total,
    offPlanCount: offPlan.length,
    offPlanShare: share,
    offPlanWinPnl: groups.find((c) => c.key === "off-plan-win")!.pnl,
    offPlanLossPnl: groups.find((c) => c.key === "off-plan-loss")!.pnl,
    planOnlyPnl: sum(decided.filter((t) => t.rulesFollowed)),
    breachesThreshold: total > 0 && share > threshold,
  };
}

/** A specific rule, how often it was broken in the period, and what it cost. */
export interface Violation {
  id: string;
  label: string;
  count: number;
  pnl: number;
  /** The same rule broken more than once in one period is a pattern. */
  repeat: boolean;
}

export function ruleViolations(trades: Trade[], settings: Settings): Violation[] {
  return settings.rulesChecklist
    .map((rule) => {
      const broken = trades.filter((t) => !t.ruleChecks.includes(rule.id));
      return {
        id: rule.id,
        label: rule.label,
        count: broken.length,
        pnl: broken.reduce((total, t) => total + netPnl(t), 0),
        repeat: broken.length >= 2,
      };
    })
    .filter((violation) => violation.count > 0)
    .sort((a, b) => a.pnl - b.pnl || b.count - a.count);
}

/** Largest peak-to-trough fall within a set of trades, in sequence. */
export interface DrawdownReport {
  amount: number;
  peak: number;
  trough: number;
  fromTrade: Trade | null;
  toTrade: Trade | null;
}

export function maxDrawdown(trades: Trade[]): DrawdownReport {
  const ordered = sortChronologically(trades);
  let equity = 0;
  let peak = 0;
  let peakTrade: Trade | null = null;
  let worst: DrawdownReport = {
    amount: 0,
    peak: 0,
    trough: 0,
    fromTrade: null,
    toTrade: null,
  };

  for (const trade of ordered) {
    equity += netPnl(trade);
    if (equity > peak) {
      peak = equity;
      peakTrade = trade;
      continue;
    }
    const fall = peak - equity;
    if (fall > worst.amount) {
      worst = {
        amount: fall,
        peak,
        trough: equity,
        fromTrade: peakTrade,
        toTrade: trade,
      };
    }
  }

  return worst;
}

/**
 * How much of the period's profit rests on a single trade. If removing the
 * best winner flips the period negative, the week was one trade, not an edge.
 */
export interface WinnerConcentration {
  best: Trade | null;
  bestPnl: number;
  netPnl: number;
  netWithoutBest: number;
  /** Share of gross profit contributed by the single best trade. */
  shareOfGross: number;
  survivesRemoval: boolean;
}

export function winnerConcentration(trades: Trade[]): WinnerConcentration | null {
  const winners = trades.filter((t) => netPnl(t) > 0);
  if (winners.length === 0) return null;

  const best = winners.reduce((top, t) => (netPnl(t) > netPnl(top) ? t : top));
  const bestPnl = netPnl(best);
  const net = trades.reduce((total, t) => total + netPnl(t), 0);
  const gross = winners.reduce((total, t) => total + netPnl(t), 0);

  return {
    best,
    bestPnl,
    netPnl: net,
    netWithoutBest: net - bestPnl,
    shareOfGross: gross > 0 ? (bestPnl / gross) * 100 : 0,
    survivesRemoval: net - bestPnl > 0,
  };
}

/**
 * Results by position in the day's sequence. Degrading P&L after the first
 * few trades is the numeric signature of overtrading.
 */
export interface SequenceRow {
  ordinal: string;
  stats: Stats;
}

export function intradaySequence(trades: Trade[]): SequenceRow[] {
  const labelled = new Map<Trade, number>();
  for (const bucket of byDay(trades).values()) {
    sortChronologically(bucket.trades).forEach((trade, index) => {
      labelled.set(trade, index + 1);
    });
  }

  const label = (n: number) =>
    n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : "4th+";

  return groupBy(trades, (trade) => label(labelled.get(trade) ?? 1))
    .map((group) => ({ ordinal: group.key, stats: group.stats }))
    .sort((a, b) => a.ordinal.localeCompare(b.ordinal));
}

/** When rule breaks cluster during the day. */
export interface OffPlanHour {
  hour: string;
  offPlan: number;
  total: number;
  share: number;
  pnl: number;
}

export function offPlanByHour(trades: Trade[]): OffPlanHour[] {
  return groupBy(trades, (t) => `${t.entryAt.slice(11, 13)}:00`)
    .map((group) => {
      const broken = group.trades.filter((t) => !t.rulesFollowed);
      return {
        hour: group.key,
        offPlan: broken.length,
        total: group.trades.length,
        share: group.trades.length ? (broken.length / group.trades.length) * 100 : 0,
        pnl: broken.reduce((total, t) => total + netPnl(t), 0),
      };
    })
    .filter((row) => row.offPlan > 0)
    .sort((a, b) => b.offPlan - a.offPlan || a.pnl - b.pnl);
}

/**
 * A weekly metric next to the rolling baseline it should be judged against.
 * Without a baseline every week reads as either a triumph or a crisis.
 */
export interface BaselineRow {
  label: string;
  value: number;
  baseline: number | null;
  /** Percent distance from baseline, signed. */
  deviation: number | null;
  /** True when a rise in this metric is an improvement. */
  higherIsBetter: boolean;
  format: "currency" | "percent" | "ratio" | "count";
  flagged: boolean;
}

export interface BaselineReport {
  rows: BaselineRow[];
  baselineTrades: number;
  baselineDays: number;
  from: string;
  to: string;
}

function winLossRatio(stats: Stats): number {
  return stats.avgLoss < 0 ? stats.avgWin / Math.abs(stats.avgLoss) : 0;
}

/**
 * Compares the review week against the rolling window that precedes it,
 * excluding the week itself so the baseline is not diluted by what it measures.
 */
export function baselineComparison(
  weekTrades: Trade[],
  allTrades: Trade[],
  weekStartDate: string,
  settings: Settings,
): BaselineReport {
  const start = new Date(`${weekStartDate}T00:00:00`);
  const from = new Date(start);
  from.setDate(from.getDate() - settings.baselineDays);
  const fromKey = from.toISOString().slice(0, 10);

  const baselineTrades = allTrades.filter((trade) => {
    const date = dateOf(trade);
    return date >= fromKey && date < weekStartDate;
  });

  const week = computeStats(weekTrades);
  const base = computeStats(baselineTrades);
  const hasBaseline = baselineTrades.length > 0;

  // Trade count is compared per week, so the baseline is scaled to a week.
  const weeks = Math.max(1, settings.baselineDays / 7);

  const build = (
    label: string,
    value: number,
    baseline: number | null,
    higherIsBetter: boolean,
    format: BaselineRow["format"],
  ): BaselineRow => {
    const deviation =
      baseline != null && baseline !== 0 ? ((value - baseline) / Math.abs(baseline)) * 100 : null;
    return {
      label,
      value,
      baseline,
      deviation,
      higherIsBetter,
      format,
      flagged: deviation != null && Math.abs(deviation) >= settings.baselineDeviationPct,
    };
  };

  return {
    rows: [
      build("Win rate", week.winRate, hasBaseline ? base.winRate : null, true, "percent"),
      build(
        "Avg win / avg loss",
        winLossRatio(week),
        hasBaseline ? winLossRatio(base) : null,
        true,
        "ratio",
      ),
      build(
        "Profit factor",
        week.profitFactor ?? 0,
        hasBaseline ? (base.profitFactor ?? 0) : null,
        true,
        "ratio",
      ),
      build(
        "Trades per week",
        week.count,
        hasBaseline ? base.count / weeks : null,
        false,
        "count",
      ),
      build(
        "Expectancy per trade",
        week.expectancy,
        hasBaseline ? base.expectancy : null,
        true,
        "currency",
      ),
      build(
        "Max drawdown",
        maxDrawdown(weekTrades).amount,
        hasBaseline ? maxDrawdown(baselineTrades).amount / weeks : null,
        false,
        "currency",
      ),
    ],
    baselineTrades: baselineTrades.length,
    baselineDays: settings.baselineDays,
    from: fromKey,
    to: weekStartDate,
  };
}

export interface TimingReport {
  longest: { trade: Trade; minutes: number } | null;
  shortest: { trade: Trade; minutes: number } | null;
  avgHoldWinners: number | null;
  avgHoldLosers: number | null;
  bestHour: { hour: string; stats: Stats } | null;
  worstHour: { hour: string; stats: Stats } | null;
  bestDay: { day: string; stats: Stats } | null;
  worstDay: { day: string; stats: Stats } | null;
  longestDay: string | null;
  shortestDay: string | null;
}

function avgHold(trades: Trade[]): number | null {
  const values = trades.map(holdMinutes).filter((m): m is number => m != null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Hold times and time-of-day performance, measured from the timestamps. */
export function timingReport(trades: Trade[]): TimingReport {
  const timed = trades
    .map((trade) => ({ trade, minutes: holdMinutes(trade) }))
    .filter((row): row is { trade: Trade; minutes: number } => row.minutes != null);

  const sortedByHold = [...timed].sort((a, b) => a.minutes - b.minutes);
  const hourGroups = groupBy(trades, (t) => `${t.entryAt.slice(11, 13)}:00`);
  const dayGroups = groupBy(trades, dayOf);

  const byNet = (groups: typeof hourGroups) =>
    [...groups].sort((a, b) => b.stats.netPnl - a.stats.netPnl);

  const hours = byNet(hourGroups);
  const days = byNet(dayGroups);

  return {
    longest: sortedByHold.at(-1) ?? null,
    shortest: sortedByHold[0] ?? null,
    avgHoldWinners: avgHold(trades.filter((t) => netPnl(t) > 0)),
    avgHoldLosers: avgHold(trades.filter((t) => netPnl(t) < 0)),
    bestHour: hours[0] ? { hour: hours[0].key, stats: hours[0].stats } : null,
    worstHour: hours.at(-1)
      ? { hour: hours.at(-1)!.key, stats: hours.at(-1)!.stats }
      : null,
    bestDay: days[0] ? { day: days[0].key, stats: days[0].stats } : null,
    worstDay: days.at(-1) ? { day: days.at(-1)!.key, stats: days.at(-1)!.stats } : null,
    longestDay: sortedByHold.at(-1) ? dayOf(sortedByHold.at(-1)!.trade) : null,
    shortestDay: sortedByHold[0] ? dayOf(sortedByHold[0].trade) : null,
  };
}

/**
 * On losing trades where actual risk exceeded the plan, the share of the loss
 * attributable to the extra size.
 */
function sizingFinding(trades: Trade[], settings: Settings): Finding | null {
  const oversized = trades.filter(
    (t) =>
      t.plannedRisk != null &&
      t.actualRisk != null &&
      t.plannedRisk > 0 &&
      t.actualRisk > t.plannedRisk &&
      netPnl(t) < 0,
  );
  if (oversized.length === 0) return null;

  let excess = 0;
  for (const trade of oversized) {
    const share = (trade.actualRisk! - trade.plannedRisk!) / trade.actualRisk!;
    excess += Math.abs(netPnl(trade)) * share;
  }
  if (excess <= 0) return null;

  const avgGap =
    oversized.reduce(
      (sum, t) => sum + ((t.actualRisk! - t.plannedRisk!) / t.plannedRisk!) * 100,
      0,
    ) / oversized.length;

  return {
    id: "sizing:over-plan-losses",
    category: "Position sizing",
    subject: "Losses taken above planned risk",
    headline: `${currency(excess)} of losses came from size above plan`,
    detail: `${oversized.length} losing trades sized ${percent(avgGap, 0)} above plan on average`,
    impact: excess,
    kind: "cost",
    sample: oversized.length,
    actionable: oversized.length >= settings.minSampleSize,
  };
}

/** Winners closed short of the planned reward, priced at the R left behind. */
function captureFinding(trades: Trade[], settings: Settings): Finding | null {
  const shortfalls = trades.filter((t) => {
    const planned = plannedRewardLeg(t.plannedRr);
    const realized = rMultiple(t);
    const risk = t.actualRisk ?? t.plannedRisk;
    return (
      planned != null &&
      realized != null &&
      risk != null &&
      risk > 0 &&
      realized > 0 &&
      realized < planned
    );
  });
  if (shortfalls.length === 0) return null;

  let left = 0;
  let rGap = 0;
  for (const trade of shortfalls) {
    const planned = plannedRewardLeg(trade.plannedRr)!;
    const realized = rMultiple(trade)!;
    const risk = (trade.actualRisk ?? trade.plannedRisk)!;
    left += (planned - realized) * risk;
    rGap += planned - realized;
  }

  return {
    id: "exits:under-capture",
    category: "Exit execution",
    subject: "Winners closed below the planned reward",
    headline: `${currency(left)} left on the table`,
    detail: `${shortfalls.length} winners closed an average of ${(rGap / shortfalls.length).toFixed(2)}R short of plan`,
    impact: left,
    kind: "opportunity",
    sample: shortfalls.length,
    actionable: shortfalls.length >= settings.minSampleSize,
  };
}

/** Red days that immediately followed a green day. */
function givebackFinding(trades: Trade[], settings: Settings): Finding | null {
  const days = [...byDay(trades).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const giveback = days.filter(
    (day, index) => index > 0 && days[index - 1].pnl > 0 && day.pnl < 0,
  );
  if (giveback.length === 0) return null;

  const cost = giveback.reduce((sum, day) => sum + day.pnl, 0);
  const greenDays = days.filter((d) => d.pnl > 0).length;

  return {
    id: "days:giveback",
    category: "Day pattern",
    subject: "Red day immediately after a green day",
    headline: `${currency(cost)} across ${giveback.length} days`,
    detail: `${giveback.length} of ${greenDays} green days were followed by a red day`,
    impact: -cost,
    kind: "cost",
    sample: giveback.length,
    actionable: giveback.length >= Math.min(settings.minSampleSize, 10),
  };
}

export function buildFindings(trades: Trade[], settings: Settings): Finding[] {
  if (trades.length === 0) return [];
  const min = settings.minSampleSize;

  const findings: Finding[] = [
    ...segmentCosts(trades, (t) => t.strategy, "Strategy", min),
    ...segmentCosts(trades, (t) => `${t.entryAt.slice(11, 13)}:00`, "Hour of day", min),
    ...segmentCosts(trades, dayOf, "Day of week", min),
    ...segmentCosts(trades, (t) => `Grade ${t.grade}`, "Setup grade", min),
    ...segmentCosts(trades, (t) => t.coin, "Coin", min),
    ...segmentCosts(trades, (t) => t.timeframe, "Timeframe", min),
    ...emotionCosts(trades, settings),
    ...ruleCosts(trades, settings),
  ];

  for (const category of settings.tagCategories) {
    const tagged = trades.filter((t) => t.tags[category.id]);
    if (tagged.length === 0) continue;
    findings.push(
      ...segmentCosts(tagged, (t) => t.tags[category.id], category.name, min),
    );
  }

  const extras = [
    cascadeFinding(trades, settings),
    sizingFinding(trades, settings),
    captureFinding(trades, settings),
    givebackFinding(trades, settings),
  ].filter((f): f is Finding => f !== null);

  return [...findings, ...extras].sort((a, b) => b.impact - a.impact);
}

/** Re-measures a single previously chosen finding against a new set of trades. */
export function measureFinding(
  findingId: string,
  trades: Trade[],
  settings: Settings,
): Finding | null {
  return buildFindings(trades, settings).find((f) => f.id === findingId) ?? null;
}

export interface Concentration {
  totalProfit: number;
  contributors: Array<{ key: string; profit: number; share: number; count: number }>;
  topShare: number;
  carrying: number;
  dragging: number;
}

/** How much of the gross profit comes from how few strategies. */
export function edgeConcentration(trades: Trade[]): Concentration | null {
  const groups = groupBy(trades, (t) => t.strategy);
  if (groups.length === 0) return null;

  const profitable = groups.filter((g) => g.stats.netPnl > 0);
  const totalProfit = profitable.reduce((sum, g) => sum + g.stats.netPnl, 0);

  const contributors = profitable
    .map((g) => ({
      key: g.key,
      profit: g.stats.netPnl,
      share: totalProfit > 0 ? (g.stats.netPnl / totalProfit) * 100 : 0,
      count: g.stats.count,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    totalProfit,
    contributors,
    topShare: contributors.slice(0, 2).reduce((sum, c) => sum + c.share, 0),
    carrying: profitable.length,
    dragging: groups.length - profitable.length,
  };
}

export interface Drift {
  windowSize: number;
  recent: Stats;
  baseline: Stats;
  avgWinR: { recent: number | null; baseline: number | null };
  avgLossR: { recent: number | null; baseline: number | null };
  expectancyDelta: number;
  winRateDelta: number;
  /** Expectancy change applied over the recent window, in dollars. */
  dollarDelta: number;
}

function avgRWhere(trades: Trade[], predicate: (r: number) => boolean): number | null {
  const values = trades
    .map(rMultiple)
    .filter((r): r is number => r != null && predicate(r));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Compares the most recent window of trades against everything before it. */
export function detectDrift(trades: Trade[], windowSize: number): Drift | null {
  const ordered = sortChronologically(trades);
  if (ordered.length < windowSize * 2) return null;

  const recentTrades = ordered.slice(-windowSize);
  const baselineTrades = ordered.slice(0, -windowSize);
  const recent = computeStats(recentTrades);
  const baseline = computeStats(baselineTrades);

  return {
    windowSize,
    recent,
    baseline,
    avgWinR: {
      recent: avgRWhere(recentTrades, (r) => r > 0),
      baseline: avgRWhere(baselineTrades, (r) => r > 0),
    },
    avgLossR: {
      recent: avgRWhere(recentTrades, (r) => r < 0),
      baseline: avgRWhere(baselineTrades, (r) => r < 0),
    },
    expectancyDelta: recent.expectancy - baseline.expectancy,
    winRateDelta: recent.winRate - baseline.winRate,
    dollarDelta: (recent.expectancy - baseline.expectancy) * recentTrades.length,
  };
}

export interface StrategyWindow {
  key: string;
  recent: Stats;
  baseline: Stats;
  winRateDelta: number;
  expectancyDelta: number;
  sample: number;
}

/** Per-strategy version of the same comparison, to surface setup-level drift. */
export function strategyDrift(
  trades: Trade[],
  windowSize: number,
): StrategyWindow[] {
  return groupBy(trades, (t) => t.strategy)
    .map((group) => {
      const ordered = sortChronologically(group.trades);
      if (ordered.length < windowSize * 2) return null;
      const recent = computeStats(ordered.slice(-windowSize));
      const baseline = computeStats(ordered.slice(0, -windowSize));
      return {
        key: group.key,
        recent,
        baseline,
        winRateDelta: recent.winRate - baseline.winRate,
        expectancyDelta: recent.expectancy - baseline.expectancy,
        sample: ordered.length,
      };
    })
    .filter((s): s is StrategyWindow => s !== null)
    .sort((a, b) => a.expectancyDelta - b.expectancyDelta);
}

export interface HourRow {
  hour: string;
  stats: Stats;
}

export function byHour(trades: Trade[]): HourRow[] {
  return groupBy(trades, (t) => `${t.entryAt.slice(11, 13)}:00`)
    .map((group) => ({ hour: group.key, stats: group.stats }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

export interface DayPatterns {
  greenDays: number;
  redDays: number;
  longestRedStreak: number;
  longestGreenStreak: number;
  givebackDays: number;
  givebackCost: number;
}

export function dayPatterns(trades: Trade[]): DayPatterns {
  const days = [...byDay(trades).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  let longestRed = 0;
  let longestGreen = 0;
  let red = 0;
  let green = 0;
  let givebackDays = 0;
  let givebackCost = 0;

  days.forEach((day, index) => {
    if (day.pnl < 0) {
      red += 1;
      green = 0;
      if (index > 0 && days[index - 1].pnl > 0) {
        givebackDays += 1;
        givebackCost += day.pnl;
      }
    } else if (day.pnl > 0) {
      green += 1;
      red = 0;
    }
    longestRed = Math.max(longestRed, red);
    longestGreen = Math.max(longestGreen, green);
  });

  return {
    greenDays: days.filter((d) => d.pnl > 0).length,
    redDays: days.filter((d) => d.pnl < 0).length,
    longestRedStreak: longestRed,
    longestGreenStreak: longestGreen,
    givebackDays,
    givebackCost,
  };
}
