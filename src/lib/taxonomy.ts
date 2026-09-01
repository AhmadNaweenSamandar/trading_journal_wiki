import type { Grade, Settings, TradeDraft } from "./types";

/** Below this, the problem is execution rather than strategy. */
export const RULE_ADHERENCE_TARGET = 75;

/** A planned-vs-actual risk gap wider than this means sizing discipline needs work. */
export const RISK_GAP_TOLERANCE = 20;

/** The journal is a data collection tool, not a diary. */
export const ENTRY_TIME_BUDGET_SECONDS = 300;

export const GRADES: Grade[] = ["A", "B", "C"];

export const GRADE_DESCRIPTIONS: Record<Grade, string> = {
  A: "Every checklist item satisfied. Textbook setup.",
  B: "At least 75% of the checklist. Valid setup, minor conditions missing.",
  C: "Below 75%. Marginal setup, entered anyway.",
};

/** Emotions that tend to precede impulsive decisions. Flagged across the reports. */
export const RISK_EMOTIONS = new Set([
  "Revenge",
  "FOMO",
  "Rushed",
  "Frustrated",
  "Greedy",
  "Fearful",
  "Impatient",
]);

/**
 * Grade is a function of checklist completion, not of the result.
 * 100% is an A, 75% or better is a B, anything less is a C.
 */
export function gradeFromScore(score: number): Grade {
  if (score >= 100) return "A";
  if (score >= 75) return "B";
  return "C";
}

export function scoreOf(checked: number, total: number): number {
  if (total <= 0) return 0;
  return (checked / total) * 100;
}

export const DEFAULT_SETTINGS: Settings = {
  strategies: ["ChoCH Break"],
  coins: ["BTC", "ETH", "SOL", "XRP"],
  timeframes: ["1M", "3M", "5M", "15M", "30M", "1H", "4H", "Daily"],
  rewardRatios: ["1:1", "1:1.5", "1:2", "1:3", "1:4", "1:5"],
  qualityChecklist: [
    { id: "q_htf_bias", label: "Higher timeframe bias aligned with the trade" },
    { id: "q_choch", label: "Clear change of character confirmed on my timeframe" },
    { id: "q_poi", label: "Entry taken from a valid point of interest" },
    { id: "q_confirm", label: "Confirmation candle closed before entry" },
    { id: "q_rr", label: "Planned reward ratio at least 1:3" },
    { id: "q_news", label: "No high impact news within 15 minutes" },
    { id: "q_liquidity", label: "Liquidity swept before the entry" },
    { id: "q_session", label: "Traded inside my planned session" },
  ],
  rulesChecklist: [
    { id: "r_size", label: "Risked no more than my planned amount" },
    { id: "r_stop", label: "Stop loss placed before entry" },
    { id: "r_no_move", label: "Did not move my stop away from entry" },
    { id: "r_no_add", label: "Did not add to a losing position" },
    { id: "r_target", label: "Exited at my planned target or invalidation" },
    { id: "r_limit", label: "Respected my daily loss limit" },
    { id: "r_plan", label: "Trade was on my pre-session plan" },
  ],
  emotionQuestions: [
    { id: "e_before", label: "What was I feeling when I enter the trade?" },
    { id: "e_during", label: "What was I feeling during the trade?" },
    { id: "e_after", label: "What was I feeling after the trade?" },
  ],
  emotionOptions: [
    "Calm",
    "Confident",
    "Focused",
    "Anxious",
    "Frustrated",
    "Rushed",
    "Revenge",
    "FOMO",
    "Bored",
    "Greedy",
    "Fearful",
    "Impatient",
    "Relieved",
  ],
  tagCategories: [
    {
      id: "tag_session",
      name: "Session",
      options: ["Asia", "London", "New York", "Overlap", "Weekend"],
    },
    {
      id: "tag_condition",
      name: "Market Condition",
      options: ["Trending", "Range", "Choppy", "High Volatility", "Low Volatility"],
    },
    {
      id: "tag_confluence",
      name: "Confluence Count",
      options: ["1 factor", "2 factors", "3+ factors"],
    },
  ],
  minSampleSize: 30,
  cascadeWindowMinutes: 60,
  driftWindow: 20,
  baselineDays: 30,
  baselineDeviationPct: 15,
  offPlanThresholdPct: 30,
};

export function emptyTradeDraft(settings: Settings): TradeDraft {
  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`;
  return {
    direction: "long",
    entryAt: stamp,
    exitAt: stamp,
    coin: settings.coins[0] ?? "",
    quantity: 0,
    entryPrice: 0,
    exitPrice: 0,
    tradingFee: 0,
    leverage: 1,
    timeframe: settings.timeframes[0] ?? "",
    strategy: settings.strategies[0] ?? "",
    plannedRr: settings.rewardRatios.includes("1:3")
      ? "1:3"
      : (settings.rewardRatios[0] ?? ""),
    realizedR: null,
    outcome: "breakeven",
    qualityChecks: [],
    grade: "C",
    qualityScore: 0,
    ruleChecks: [],
    rulesFollowed: false,
    ruleScore: 0,
    plannedRisk: null,
    actualRisk: null,
    tradeReason: "",
    exitReason: "",
    emotions: {},
    lesson: "",
    tags: {},
    customTags: [],
    screenshots: { exit1m: "", exit15m: "" },
    entryDurationSeconds: null,
  };
}
