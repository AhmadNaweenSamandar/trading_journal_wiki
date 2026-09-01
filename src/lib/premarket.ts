import { dayName } from "./format";
import { netPnl } from "./metrics";
import type {
  Bias,
  CandleRead,
  MarketEvent,
  Premarket,
  PremarketDraft,
  PriceLevel,
  TimeframeRead,
  Trade,
} from "./types";

export const BIASES: Bias[] = ["bullish", "bearish", "neutral"];
export const IMPACTS = ["high", "medium", "low"] as const;

export const DEFAULT_CANDLE_LABELS = [
  "Monthly candle",
  "Weekly candle",
  "Daily candle",
];

export function todayKey(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyRead(): TimeframeRead {
  return { screenshot: "", note: "", bias: "neutral" };
}

export function candleFromLabel(label: string): CandleRead {
  return { id: uid("cndl"), label, ...emptyRead() };
}

export function defaultCandles(labels = DEFAULT_CANDLE_LABELS): CandleRead[] {
  return labels.map((label) => candleFromLabel(label));
}

export function emptyPremarket(
  date = todayKey(),
  candleLabels = DEFAULT_CANDLE_LABELS,
): PremarketDraft {
  return {
    date,
    day: dayName(date),
    yesterdayMovement: "",
    candles: defaultCandles(candleLabels),
    dayBias: "neutral",
    dayBiasNote: "",
    levels: [],
    events: [],
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bias(value: unknown): Bias {
  return BIASES.includes(value as Bias) ? (value as Bias) : "neutral";
}

function timeframeRead(value: unknown): TimeframeRead {
  const raw = (value ?? {}) as Partial<TimeframeRead>;
  return {
    screenshot: text(raw.screenshot),
    note: text(raw.note),
    bias: bias(raw.bias),
  };
}

function candleRead(value: unknown, index: number): CandleRead | null {
  const raw = (value ?? {}) as Partial<CandleRead>;
  const label = text(raw.label);
  const read = timeframeRead(raw);
  if (!label && !read.screenshot && !read.note) return null;
  return {
    id: text(raw.id) || `cndl_${index}`,
    label: label || `Candle ${index + 1}`,
    ...read,
  };
}

type LegacyPremarket = Partial<Premarket> & {
  monthly?: TimeframeRead;
  weekly?: TimeframeRead;
  daily?: TimeframeRead;
};

export function hydrateCandles(raw: LegacyPremarket): CandleRead[] {
  if (Array.isArray(raw.candles)) {
    return raw.candles
      .map((item, index) => candleRead(item, index))
      .filter((item): item is CandleRead => item != null);
  }

  return (
    [
      ["Monthly candle", raw.monthly],
      ["Weekly candle", raw.weekly],
      ["Daily candle", raw.daily],
    ] as const
  ).map(([label, read], index) => ({
    id: ["monthly", "weekly", "daily"][index],
    label,
    ...timeframeRead(read),
  }));
}

function levels(value: unknown): PriceLevel[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => ({
      id: text((raw as PriceLevel)?.id) || `lvl_${index}`,
      label: text((raw as PriceLevel)?.label),
      price: text((raw as PriceLevel)?.price),
    }))
    .filter((level) => level.label || level.price);
}

function events(value: unknown): MarketEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => {
      const event = raw as MarketEvent;
      return {
        id: text(event?.id) || `evt_${index}`,
        time: text(event?.time),
        title: text(event?.title),
        impact: (IMPACTS as readonly string[]).includes(event?.impact)
          ? event.impact
          : ("medium" as const),
      };
    })
    .filter((event) => event.title);
}

export function hydratePremarket(input: unknown): Premarket {
  const raw = (input ?? {}) as LegacyPremarket;
  const date = text(raw.date);
  return {
    id: text(raw.id) || date,
    date,
    day: text(raw.day) || dayName(date),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
    yesterdayMovement: text(raw.yesterdayMovement),
    candles: hydrateCandles(raw),
    dayBias: bias(raw.dayBias),
    dayBiasNote: text(raw.dayBiasNote),
    levels: levels(raw.levels),
    events: events(raw.events),
  };
}

export function normalizePremarket(input: unknown): {
  draft: PremarketDraft;
  errors: string[];
} {
  const raw = (input ?? {}) as LegacyPremarket;
  const errors: string[] = [];

  const date = text(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push("A valid date is required.");
  }

  const { id: _id, createdAt: _c, updatedAt: _u, ...hydrated } = hydratePremarket(raw);

  return {
    draft: {
      ...hydrated,
      date,
      day: dayName(date),
    },
    errors,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Summary                                  */
/* -------------------------------------------------------------------------- */

export interface PremarketSummary {
  date: string;
  day: string;
  bias: Bias;
  /** True when every candle read points the same way. */
  timeframesAligned: boolean;
  /** Candle reads that disagree with the stated day bias. */
  conflicts: string[];
  timeframes: Array<{ label: string; bias: Bias; hasChart: boolean; note: string }>;
  levelCount: number;
  levels: PriceLevel[];
  highImpactEvents: MarketEvent[];
  events: MarketEvent[];
  chartsAttached: number;
  chartSlots: number;
  completeness: number;
  /** What actually happened after the plan was written. */
  tradesToday: number;
  netPnlToday: number;
}

/**
 * A plain read-out of the saved plan, plus how the day has gone since. There is
 * no interpretation here, only arithmetic on what was written down.
 */
export function summarize(record: Premarket, trades: Trade[]): PremarketSummary {
  const timeframes = record.candles.map((candle) => ({
    label: candle.label,
    bias: candle.bias,
    hasChart: Boolean(candle.screenshot),
    note: candle.note,
  }));

  const distinct = new Set(timeframes.map((t) => t.bias));
  const conflicts = timeframes
    .filter((t) => t.bias !== "neutral" && t.bias !== record.dayBias)
    .map((t) => t.label);

  const todays = trades.filter((trade) => trade.entryAt.slice(0, 10) === record.date);

  const slots = [
    record.yesterdayMovement,
    record.dayBiasNote,
    ...record.candles.map((candle) => candle.screenshot || candle.note),
    record.levels.length ? "x" : "",
    record.events.length ? "x" : "",
  ];
  const filled = slots.filter(Boolean).length;

  return {
    date: record.date,
    day: record.day,
    bias: record.dayBias,
    timeframesAligned: timeframes.length > 0 && distinct.size === 1,
    conflicts,
    timeframes,
    levelCount: record.levels.length,
    levels: record.levels,
    highImpactEvents: record.events.filter((event) => event.impact === "high"),
    events: record.events,
    chartsAttached: timeframes.filter((t) => t.hasChart).length,
    chartSlots: Math.max(1, timeframes.length),
    completeness: Math.round((filled / Math.max(1, slots.length)) * 100),
    tradesToday: todays.length,
    netPnlToday: todays.reduce((sum, trade) => sum + netPnl(trade), 0),
  };
}
