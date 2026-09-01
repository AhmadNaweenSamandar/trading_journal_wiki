export type Direction = "long" | "short";

/** Derived from how much of the quality checklist was satisfied. */
export type Grade = "A" | "B" | "C";

export type Outcome = "win" | "loss" | "breakeven";

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface EmotionQuestion {
  id: string;
  label: string;
}

export interface TagCategory {
  id: string;
  name: string;
  options: string[];
}

/** Everything the user can reshape from the settings page. */
export interface Settings {
  strategies: string[];
  coins: string[];
  timeframes: string[];
  rewardRatios: string[];
  qualityChecklist: ChecklistItem[];
  rulesChecklist: ChecklistItem[];
  emotionQuestions: EmotionQuestion[];
  emotionOptions: string[];
  tagCategories: TagCategory[];

  /** Minimum trades in a slice before a measurement is treated as actionable. */
  minSampleSize: number;
  /** How soon after a losing exit a re-entry counts as part of a cascade. */
  cascadeWindowMinutes: number;
  /** Trade count in the recent window when checking for drift. */
  driftWindow: number;
  /** Rolling window the weekly review compares each week against. */
  baselineDays: number;
  /** How far a weekly metric must move from baseline before it is flagged. */
  baselineDeviationPct: number;
  /** Share of off-plan trades that counts as a discipline problem. */
  offPlanThresholdPct: number;
}

/** The single change being tracked for a given week. */
export interface Focus {
  id: string;
  /** Monday of the week this change applies to. */
  weekStart: string;
  findingId: string;
  statement: string;
  baselineImpact: number;
  createdAt: string;
}

export interface Screenshots {
  /** Exit chart on the 1 minute timeframe. */
  exit1m: string;
  /** Exit chart on the 15 minute timeframe. */
  exit15m: string;
}

export type Bias = "bullish" | "bearish" | "neutral";

/** One higher-timeframe chart read, with the chart image behind it. */
export interface TimeframeRead {
  screenshot: string;
  note: string;
  bias: Bias;
}

/** A candle the trader chose to analyse — monthly, 30 min, or anything else. */
export interface CandleRead extends TimeframeRead {
  id: string;
  label: string;
}

export interface PriceLevel {
  id: string;
  label: string;
  price: string;
}

export type EventImpact = "high" | "medium" | "low";

export interface MarketEvent {
  id: string;
  time: string;
  title: string;
  impact: EventImpact;
}

/** The plan written before the session, one record per calendar day. */
export interface Premarket {
  /** The date itself, so there is exactly one record per day. */
  id: string;
  date: string;
  day: string;
  createdAt: string;
  updatedAt: string;

  yesterdayMovement: string;
  candles: CandleRead[];
  dayBias: Bias;
  dayBiasNote: string;
  levels: PriceLevel[];
  events: MarketEvent[];
}

export type PremarketDraft = Omit<Premarket, "id" | "createdAt" | "updatedAt">;

export type BiometricSource = "manual" | "whoop";

/**
 * One morning's physiological readings. Every field is nullable because a
 * partial record still produces a partial readiness score.
 */
export interface Biometrics {
  /** The date itself, so there is exactly one record per day. */
  id: string;
  date: string;
  source: BiometricSource;
  createdAt: string;
  updatedAt: string;

  /** WHOOP recovery percentage, 0-100. */
  recoveryPct: number | null;
  /** Heart rate variability in milliseconds. */
  hrv: number | null;
  restingHeartRate: number | null;
  /** Breaths per minute. */
  respiratoryRate: number | null;
  sleepDebtMinutes: number | null;
  /** Slow wave, or deep, sleep. */
  swsMinutes: number | null;
  remMinutes: number | null;
  totalSleepMinutes: number | null;
  /** Yesterday's accumulated strain, 0-21. */
  strainYesterday: number | null;
  /** Today's recommended strain target, 0-21. */
  strainTarget: number | null;
  note: string;
}

export type BiometricsDraft = Omit<Biometrics, "id" | "createdAt" | "updatedAt">;

export interface Trade {
  /** Same value as seq, kept as a string for routing. */
  id: string;
  /** Sequential trade number, never reused after a deletion. */
  seq: number;
  createdAt: string;
  updatedAt: string;

  // Layer 1 - mechanical.
  direction: Direction;
  /** Local datetime, "YYYY-MM-DDTHH:mm". */
  entryAt: string;
  exitAt: string;
  coin: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  tradingFee: number;
  leverage: number;
  timeframe: string;
  strategy: string;
  /** Planned reward ratio written as "1:3". */
  plannedRr: string;
  /** Final R actually banked: 3 on a full 1:3 winner, -1 on a full stop. */
  realizedR: number | null;
  outcome: Outcome;

  // Layer 2 - context.
  /** Ids of satisfied quality checklist items. */
  qualityChecks: string[];
  /** Grade frozen at save time, so later checklist edits do not rewrite history. */
  grade: Grade;
  qualityScore: number;
  /** Ids of rules that were followed. */
  ruleChecks: string[];
  rulesFollowed: boolean;
  ruleScore: number;
  plannedRisk: number | null;
  actualRisk: number | null;
  tradeReason: string;
  exitReason: string;
  /** Answer per emotion question, keyed by question id. */
  emotions: Record<string, string>;
  lesson: string;

  /** Selected value per tag category, keyed by category id. */
  tags: Record<string, string>;
  customTags: string[];

  screenshots: Screenshots;
  entryDurationSeconds: number | null;
}

export interface Note {
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  tags: string[];
  updatedAt: string;
  pinned: boolean;
}

export type TradeDraft = Omit<Trade, "id" | "seq" | "createdAt" | "updatedAt">;
