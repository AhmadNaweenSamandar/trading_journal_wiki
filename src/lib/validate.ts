import { DEFAULT_SETTINGS, emptyTradeDraft, gradeFromScore, scoreOf } from "./taxonomy";
import { netPnl, outcomeOf } from "./metrics";
import type { Outcome, Settings, Trade, TradeDraft } from "./types";

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "string" ? Number(value) : (value as number);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : (value as number);
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => str(v)).filter(Boolean) : [];
}

function strRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const text = str(raw);
    if (text) out[key] = text;
  }
  return out;
}

export interface Validated {
  draft: TradeDraft;
  errors: string[];
}

/**
 * Coerces an untrusted payload into a well-formed draft. The grade, rule score,
 * and outcome are derived here so they can never disagree with the raw inputs.
 */
export function normalizeTrade(
  input: unknown,
  settings: Settings,
  options?: { imported?: boolean },
): Validated {
  const raw = (input ?? {}) as Record<string, unknown>;
  const base = emptyTradeDraft(settings);
  const errors: string[] = [];
  const imported = Boolean(options?.imported);

  const qualityIds = new Set(settings.qualityChecklist.map((i) => i.id));
  const ruleIds = new Set(settings.rulesChecklist.map((i) => i.id));
  const qualityChecks = strArray(raw.qualityChecks).filter((id) => qualityIds.has(id));
  const ruleChecks = strArray(raw.ruleChecks).filter((id) => ruleIds.has(id));

  const qualityScore = scoreOf(qualityChecks.length, settings.qualityChecklist.length);
  const ruleScore = scoreOf(ruleChecks.length, settings.rulesChecklist.length);

  const rawShots = (raw.screenshots ?? {}) as Record<string, unknown>;

  const draft: TradeDraft = {
    ...base,
    direction: raw.direction === "short" ? "short" : "long",
    entryAt: str(raw.entryAt, base.entryAt),
    exitAt: str(raw.exitAt, base.exitAt),
    coin: str(raw.coin).toUpperCase(),
    quantity: num(raw.quantity),
    entryPrice: num(raw.entryPrice),
    exitPrice: num(raw.exitPrice),
    tradingFee: num(raw.tradingFee),
    leverage: num(raw.leverage, 1) || 1,
    timeframe: str(raw.timeframe, base.timeframe),
    strategy: str(raw.strategy, imported ? base.strategy : ""),
    plannedRr: str(raw.plannedRr, base.plannedRr),
    realizedR: optionalNum(raw.realizedR),
    outcome: "breakeven",

    qualityChecks,
    grade: gradeFromScore(qualityScore),
    qualityScore: Number(qualityScore.toFixed(1)),
    ruleChecks,
    rulesFollowed:
      settings.rulesChecklist.length > 0 &&
      ruleChecks.length === settings.rulesChecklist.length,
    ruleScore: Number(ruleScore.toFixed(1)),
    plannedRisk: optionalNum(raw.plannedRisk),
    actualRisk: optionalNum(raw.actualRisk),
    tradeReason: str(raw.tradeReason),
    exitReason: str(raw.exitReason),
    emotions: strRecord(raw.emotions),
    lesson: str(raw.lesson),

    tags: strRecord(raw.tags),
    customTags: strArray(raw.customTags),

    screenshots: {
      exit1m: str(rawShots.exit1m),
      exit15m: str(rawShots.exit15m),
    },
    entryDurationSeconds: optionalNum(raw.entryDurationSeconds),
  };

  // Outcome follows the money unless the trader explicitly called it breakeven.
  if (imported && draft.exitPrice <= 0 && draft.entryPrice > 0) {
    draft.exitPrice = draft.entryPrice;
  }
  if (imported && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(draft.exitAt)) {
    draft.exitAt = draft.entryAt;
  }

  const provisional = { ...draft, id: "", createdAt: "", updatedAt: "" } as Trade;
  const requested = str(raw.outcome) as Outcome;
  const money = netPnl(provisional);
  if (requested === "breakeven") {
    draft.outcome = "breakeven";
  } else if (
    imported &&
    (requested === "win" || requested === "loss") &&
    Math.abs(money) < 0.01
  ) {
    draft.outcome = requested;
  } else {
    draft.outcome = outcomeOf(money);
  }

  if (!draft.coin) errors.push("Coin is required.");
  if (!imported && !draft.strategy) errors.push("Strategy is required.");
  if (draft.quantity <= 0) errors.push("Quantity must be greater than zero.");
  if (draft.entryPrice <= 0) errors.push("Entry price must be greater than zero.");
  if (draft.exitPrice <= 0) errors.push("Exit price must be greater than zero.");
  if (draft.leverage <= 0) errors.push("Leverage must be greater than zero.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(draft.entryAt)) {
    errors.push("Entry timestamp is required.");
  }
  if (!imported && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(draft.exitAt)) {
    errors.push("Exit timestamp is required.");
  }

  return { draft, errors };
}

function cleanItems(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const label = str(item.label);
      if (!label) return null;
      return { id: str(item.id) || `${prefix}_${Date.now()}_${index}`, label };
    })
    .filter((item): item is { id: string; label: string } => item !== null);
}

export function normalizeSettings(input: unknown): Settings {
  const raw = (input ?? {}) as Record<string, unknown>;

  const tagCategories = Array.isArray(raw.tagCategories)
    ? raw.tagCategories
        .map((entry, index) => {
          const category = (entry ?? {}) as Record<string, unknown>;
          const name = str(category.name);
          if (!name) return null;
          return {
            id: str(category.id) || `tag_${Date.now()}_${index}`,
            name,
            options: strArray(category.options),
          };
        })
        .filter((c): c is Settings["tagCategories"][number] => c !== null)
    : DEFAULT_SETTINGS.tagCategories;

  const positive = (value: unknown, fallback: number) => {
    const parsed = optionalNum(value);
    return parsed != null && parsed > 0 ? Math.round(parsed) : fallback;
  };

  return {
    strategies: strArray(raw.strategies),
    coins: strArray(raw.coins).map((c) => c.toUpperCase()),
    timeframes: strArray(raw.timeframes),
    rewardRatios: strArray(raw.rewardRatios),
    qualityChecklist: cleanItems(raw.qualityChecklist, "q"),
    rulesChecklist: cleanItems(raw.rulesChecklist, "r"),
    emotionQuestions: cleanItems(raw.emotionQuestions, "e"),
    emotionOptions: strArray(raw.emotionOptions),
    tagCategories,
    minSampleSize: positive(raw.minSampleSize, DEFAULT_SETTINGS.minSampleSize),
    cascadeWindowMinutes: positive(
      raw.cascadeWindowMinutes,
      DEFAULT_SETTINGS.cascadeWindowMinutes,
    ),
    driftWindow: positive(raw.driftWindow, DEFAULT_SETTINGS.driftWindow),
    baselineDays: positive(raw.baselineDays, DEFAULT_SETTINGS.baselineDays),
    baselineDeviationPct: positive(
      raw.baselineDeviationPct,
      DEFAULT_SETTINGS.baselineDeviationPct,
    ),
    offPlanThresholdPct: positive(
      raw.offPlanThresholdPct,
      DEFAULT_SETTINGS.offPlanThresholdPct,
    ),
  };
}
