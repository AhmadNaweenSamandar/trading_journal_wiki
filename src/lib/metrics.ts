import { RISK_EMOTIONS } from "./taxonomy";
import type { Outcome, Trade } from "./types";

/** Quantity x entry price. What the position was worth at entry. */
export function positionValue(trade: Trade): number {
  return trade.quantity * trade.entryPrice;
}

/** Position value / leverage. The capital actually committed. */
export function margin(trade: Trade): number | null {
  const leverage = trade.leverage;
  if (!leverage || leverage <= 0) return null;
  return positionValue(trade) / leverage;
}

export function grossPnl(trade: Trade): number {
  const move =
    trade.direction === "long"
      ? trade.exitPrice - trade.entryPrice
      : trade.entryPrice - trade.exitPrice;
  return move * trade.quantity;
}

export function netPnl(trade: Trade): number {
  return grossPnl(trade) - (trade.tradingFee || 0);
}

/** Return on the margin actually committed. */
export function returnOnMargin(trade: Trade): number | null {
  const used = margin(trade);
  if (used == null || used === 0) return null;
  return (netPnl(trade) / used) * 100;
}

export function outcomeOf(pnl: number, tolerance = 0.01): Outcome {
  if (pnl > tolerance) return "win";
  if (pnl < -tolerance) return "loss";
  return "breakeven";
}

export function isWin(trade: Trade): boolean {
  return trade.outcome === "win";
}

/** Parses "1:3" into its reward leg. */
export function plannedRewardLeg(plannedRr: string): number | null {
  const match = /^\s*([\d.]+)\s*:\s*([\d.]+)\s*$/.exec(plannedRr || "");
  if (!match) return null;
  const risk = Number(match[1]);
  const reward = Number(match[2]);
  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0) return null;
  return reward / risk;
}

/**
 * One R is the risk you planned to take. A loss is measured by what you
 * actually put at risk, so planning $1 and losing $2 is -2R. A win is measured
 * by the profit banked against that same planned unit.
 */
export function computedR(trade: Trade): number | null {
  const planned = trade.plannedRisk;
  if (planned == null || planned <= 0) return null;
  if (trade.outcome === "breakeven") return 0;

  const pnl = netPnl(trade);
  if (pnl < 0) {
    const risked = trade.actualRisk != null ? trade.actualRisk : Math.abs(pnl);
    return -(risked / planned);
  }
  return pnl / planned;
}

/** The recorded override when present, otherwise the computed value. */
export function rMultiple(trade: Trade): number | null {
  if (trade.realizedR != null && Number.isFinite(trade.realizedR)) {
    return trade.realizedR;
  }
  return computedR(trade);
}

export type RiskTone = "over" | "on-plan" | "under";

export interface RiskDiscipline {
  /** Actual risk divided by planned risk. */
  ratio: number;
  /** Signed deviation from plan, as a percent. Positive means over-risked. */
  deviation: number;
  /**
   * 0 when you risked exactly what you planned, rising to 100 as actual risk
   * falls to zero. Negative once actual risk exceeds the plan.
   */
  score: number;
  tone: RiskTone;
  label: string;
}

/**
 * Risking less than planned is not a discipline failure, so only over-risking
 * is treated as a problem.
 */
export function riskDiscipline(trade: Trade): RiskDiscipline | null {
  const planned = trade.plannedRisk;
  const actual = trade.actualRisk;
  if (planned == null || planned <= 0 || actual == null || actual < 0) return null;

  const ratio = actual / planned;
  const deviation = (ratio - 1) * 100;

  if (Math.abs(deviation) < 0.5) {
    return { ratio, deviation: 0, score: 0, tone: "on-plan", label: "On plan" };
  }
  if (ratio > 1) {
    return {
      ratio,
      deviation,
      score: -deviation,
      tone: "over",
      label: `${ratio.toFixed(2)}x plan · +${deviation.toFixed(0)}% risk`,
    };
  }
  const score = (1 - ratio) * 100;
  return {
    ratio,
    deviation,
    score,
    tone: "under",
    label:
      actual === 0
        ? "100% under plan · no risk left on"
        : `${score.toFixed(0)}% under plan`,
  };
}

/** Signed deviation from planned risk. Positive means over-risked. */
export function riskDeviation(trade: Trade): number | null {
  return riskDiscipline(trade)?.deviation ?? null;
}

/** Share of the planned reward that was actually banked. */
export function planCapture(trade: Trade): number | null {
  const planned = plannedRewardLeg(trade.plannedRr);
  const realized = rMultiple(trade);
  if (planned == null || planned <= 0 || realized == null || realized <= 0) return null;
  return Math.min(1, realized / planned);
}

export function dayOf(trade: Trade): string {
  const date = new Date(trade.entryAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function dateOf(trade: Trade): string {
  return (trade.entryAt || "").slice(0, 10);
}

/** Minutes the position was open. */
export function holdMinutes(trade: Trade): number | null {
  const start = new Date(trade.entryAt).getTime();
  const end = new Date(trade.exitAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

export interface Stats {
  count: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  expectancy: number;
  expectancyR: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  ruleAdherence: number;
  avgRuleScore: number;
  avgQualityScore: number;
  /** Signed average deviation from planned risk. Positive means over-risked. */
  avgRiskDeviation: number | null;
  /** Average of the over-risk portion only, ignoring trades risked under plan. */
  avgOverRisk: number | null;
  avgPlanCapture: number | null;
  totalFees: number;
  avgHoldMinutes: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeStats(trades: Trade[]): Stats {
  const count = trades.length;
  const pnls = trades.map(netPnl);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const net = pnls.reduce((a, b) => a + b, 0);
  const decided = trades.filter((t) => t.outcome !== "breakeven").length;

  const rs = trades.map(rMultiple).filter((r): r is number => r != null);
  const deviations = trades.map(riskDeviation).filter((g): g is number => g != null);
  const captures = trades.map(planCapture).filter((c): c is number => c != null);
  const holds = trades.map(holdMinutes).filter((h): h is number => h != null);

  return {
    count,
    wins: wins.length,
    losses: losses.length,
    breakEven: count - wins.length - losses.length,
    winRate: decided ? (wins.length / decided) * 100 : 0,
    netPnl: net,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    expectancy: count ? net / count : 0,
    expectancyR: mean(rs) ?? 0,
    avgWin: mean(wins) ?? 0,
    avgLoss: mean(losses) ?? 0,
    largestWin: wins.length ? Math.max(...wins) : 0,
    largestLoss: losses.length ? Math.min(...losses) : 0,
    ruleAdherence: count
      ? (trades.filter((t) => t.rulesFollowed).length / count) * 100
      : 0,
    avgRuleScore: mean(trades.map((t) => t.ruleScore)) ?? 0,
    avgQualityScore: mean(trades.map((t) => t.qualityScore)) ?? 0,
    avgRiskDeviation: mean(deviations),
    avgOverRisk: mean(deviations.map((d) => Math.max(0, d))),
    avgPlanCapture: mean(captures),
    totalFees: trades.reduce((sum, t) => sum + (t.tradingFee || 0), 0),
    avgHoldMinutes: mean(holds),
  };
}

export interface Group {
  key: string;
  trades: Trade[];
  stats: Stats;
}

export function groupBy(trades: Trade[], keyOf: (t: Trade) => string): Group[] {
  const buckets = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = keyOf(trade) || "Untagged";
    const existing = buckets.get(key);
    if (existing) existing.push(trade);
    else buckets.set(key, [trade]);
  }
  return [...buckets.entries()]
    .map(([key, group]) => ({ key, trades: group, stats: computeStats(group) }))
    .sort((a, b) => b.stats.netPnl - a.stats.netPnl);
}

export function sortChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => a.entryAt.localeCompare(b.entryAt));
}

export interface EquityPoint {
  index: number;
  seq: number;
  label: string;
  /** Full entry timestamp, used to place the point on a time axis. */
  at: string;
  /** Calendar date of the entry. */
  date: string;
  equity: number;
  pnl: number;
}

export function equityCurve(trades: Trade[]): EquityPoint[] {
  let running = 0;
  return sortChronologically(trades).map((trade, index) => {
    const pnl = netPnl(trade);
    running += pnl;
    return {
      index: index + 1,
      seq: trade.seq,
      label: `#${trade.seq} ${trade.coin}`,
      at: trade.entryAt,
      date: dateOf(trade),
      equity: Number(running.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
    };
  });
}

export interface DayBucket {
  date: string;
  pnl: number;
  count: number;
  trades: Trade[];
}

export function byDay(trades: Trade[]): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>();
  for (const trade of trades) {
    const date = dateOf(trade);
    if (!date) continue;
    const bucket = map.get(date) ?? { date, pnl: 0, count: 0, trades: [] };
    bucket.pnl += netPnl(trade);
    bucket.count += 1;
    bucket.trades.push(trade);
    map.set(date, bucket);
  }
  return map;
}

/** Emotions that tend to precede impulsive decisions, and what they cost. */
export function emotionRiskReport(trades: Trade[]) {
  const flagged = trades.filter((t) =>
    Object.values(t.emotions).some((e) => RISK_EMOTIONS.has(e)),
  );
  return {
    count: flagged.length,
    cost: flagged.reduce((sum, t) => sum + netPnl(t), 0),
    share: trades.length ? (flagged.length / trades.length) * 100 : 0,
  };
}

export function ruleSplit(trades: Trade[]) {
  const followed = trades.filter((t) => t.rulesFollowed);
  const broken = trades.filter((t) => !t.rulesFollowed);
  return {
    followed: { trades: followed, stats: computeStats(followed) },
    broken: { trades: broken, stats: computeStats(broken) },
  };
}
