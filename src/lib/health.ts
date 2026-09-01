import { netPnl } from "./metrics";
import type { Biometrics, BiometricsDraft, Trade } from "./types";

/**
 * Scores a trader's cognitive readiness from overnight physiology.
 *
 * The premise is that P&L lags neurobiology: sleep, autonomic tone and
 * accumulated stress set the ceiling on how well the prefrontal cortex can
 * evaluate risk, sustain attention and inhibit impulse. Each score below is a
 * weighted blend of the measures the research attaches to that capacity, and
 * every measure is judged against your own rolling baseline rather than a
 * population average.
 *
 * Nothing here is a diagnosis. It is arithmetic on numbers you recorded.
 */

export type ScoreBand = "optimal" | "moderate" | "compromised";

export interface Contribution {
  label: string;
  /** Share of the parent score, 0-1. */
  weight: number;
  /** Sub-score, 0-100, or null when the input is missing. */
  score: number | null;
  /** The raw reading, formatted for display. */
  reading: string;
  /** What it was compared against. */
  against: string;
}

export interface ReadinessScore {
  key: "decision" | "focus" | "discipline" | "confidence";
  label: string;
  /** 0-100, or null when no inputs were available. */
  score: number | null;
  band: ScoreBand;
  /** The mechanism this score is measuring. */
  premise: string;
  contributions: Contribution[];
  /** Threshold rules that fired, in the order they should be read. */
  flags: string[];
  /** What to do differently today. */
  guidance: string;
}

export interface Baseline {
  hrv: number | null;
  restingHeartRate: number | null;
  respiratoryRate: number | null;
  sws: number | null;
  swsSd: number | null;
  rem: number | null;
  /** Percent change between the last 7 days and the 7 before that. */
  hrvTrendPct: number | null;
  /** Days of history the baseline was built from. */
  days: number;
  /** A baseline needs a fortnight before deviations mean much. */
  reliable: boolean;
}

export interface RiskDirective {
  /** Fraction of your normal risk per trade, 0-1. */
  multiplier: number;
  label: string;
  reasons: string[];
  lockout: boolean;
}

export interface ReadinessReport {
  date: string;
  scores: ReadinessScore[];
  /** Average of the scores that could be computed. */
  composite: number | null;
  /** The lowest score, which is what actually governs the day. */
  governing: ReadinessScore | null;
  baseline: Baseline;
  risk: RiskDirective;
  missing: string[];
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number | null {
  const avg = mean(values);
  if (avg == null || values.length < 2) return null;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Meeting your baseline scores 85 rather than 100, leaving headroom for the
 * nights that genuinely exceed it. Falls back to null when there is nothing
 * to compare against.
 */
function baselineScore(value: number | null, baseline: number | null): number | null {
  if (value == null) return null;
  // The first morning has no history. Treat the reading as the start of
  // your own baseline rather than leaving the score blank.
  if (baseline == null || baseline <= 0) return 85;
  return clamp((value / baseline) * 85);
}

/** Penalises movement in one direction only, leaving the other side unscored. */
function penaltyScore(
  value: number | null,
  baseline: number | null,
  perUnit: number,
  direction: "above" | "below",
): number | null {
  if (value == null) return null;
  if (baseline == null) return 85;
  const excess =
    direction === "above" ? Math.max(0, value - baseline) : Math.max(0, baseline - value);
  return clamp(100 - excess * perUnit);
}

function blend(contributions: Contribution[]): number | null {
  const scored = contributions.filter((c) => c.score != null);
  if (scored.length === 0) return null;
  // Re-normalise across the inputs that are present, so a missing reading
  // lowers confidence rather than silently dragging the score down.
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null;
  return scored.reduce((sum, c) => sum + c.score! * (c.weight / totalWeight), 0);
}

function bandOf(score: number | null): ScoreBand {
  if (score == null) return "moderate";
  if (score >= 67) return "optimal";
  if (score >= 50) return "moderate";
  return "compromised";
}

function minutes(value: number | null): string {
  if (value == null) return "--";
  const total = Math.round(value);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

function around(value: number | null, unit: string, decimals = 0): string {
  return value == null ? "no baseline" : `baseline ${value.toFixed(decimals)}${unit}`;
}

/* -------------------------------------------------------------------------- */
/*                                  Baseline                                  */
/* -------------------------------------------------------------------------- */

/**
 * Rolling baseline from the records preceding a given date. Thirty days is the
 * window WHOOP itself uses, and it is long enough to absorb a bad night.
 */
export function computeBaseline(
  history: Biometrics[],
  date: string,
  windowDays = 30,
): Baseline {
  const from = new Date(`${date}T00:00:00`);
  from.setDate(from.getDate() - windowDays);
  const fromKey = from.toISOString().slice(0, 10);

  const window = history
    .filter((r) => r.date >= fromKey && r.date < date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pick = (key: keyof Biometrics) =>
    window
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const sws = pick("swsMinutes");
  const hrvSeries = window
    .map((r) => r.hrv)
    .filter((v): v is number => typeof v === "number");

  // Last seven days against the seven before them, which is the shortest
  // window where a trend in vagal tone is meaningful.
  const recent = hrvSeries.slice(-7);
  const prior = hrvSeries.slice(-14, -7);
  const recentMean = mean(recent);
  const priorMean = mean(prior);
  const hrvTrendPct =
    recentMean != null && priorMean != null && priorMean > 0
      ? ((recentMean - priorMean) / priorMean) * 100
      : null;

  return {
    hrv: mean(hrvSeries),
    restingHeartRate: mean(pick("restingHeartRate")),
    respiratoryRate: mean(pick("respiratoryRate")),
    sws: mean(sws),
    swsSd: stdDev(sws),
    rem: mean(pick("remMinutes")),
    hrvTrendPct,
    days: window.length,
    reliable: window.length >= 14,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 The scores                                 */
/* -------------------------------------------------------------------------- */

/**
 * Decision making. The ventromedial prefrontal cortex burns metabolic energy
 * to weigh probability against reward, and slow wave sleep is what restores
 * it. Sleep-deprived subjects on the Iowa Gambling Task drift toward
 * high-variance, negative-expectancy choices without noticing.
 */
function decisionScore(today: Biometrics, baseline: Baseline): ReadinessScore {
  const debtHours =
    today.sleepDebtMinutes == null ? null : today.sleepDebtMinutes / 60;

  const contributions: Contribution[] = [
    {
      label: "Sleep debt",
      weight: 0.4,
      // Three hours of debt exhausts the score; 1.5 hours costs you half.
      score: debtHours == null ? null : clamp(100 - (debtHours / 3) * 100),
      reading: debtHours == null ? "--" : `${debtHours.toFixed(1)}h`,
      against: "0h is full marks, 3h is zero",
    },
    {
      label: "Slow wave sleep",
      weight: 0.4,
      score: baselineScore(today.swsMinutes, baseline.sws),
      reading: minutes(today.swsMinutes),
      against: baseline.sws == null ? "no baseline" : `baseline ${minutes(baseline.sws)}`,
    },
    {
      label: "Respiratory rate",
      weight: 0.2,
      score: penaltyScore(today.respiratoryRate, baseline.respiratoryRate, 40, "above"),
      reading:
        today.respiratoryRate == null ? "--" : `${today.respiratoryRate.toFixed(1)} rpm`,
      against: around(baseline.respiratoryRate, " rpm", 1),
    },
  ];

  let score = blend(contributions);
  const flags: string[] = [];

  // The compound rule from the sleep-deprivation literature: debt plus
  // suppressed deep sleep is where risk judgement actually breaks down.
  const swsBelowSd =
    today.swsMinutes != null &&
    baseline.sws != null &&
    baseline.swsSd != null &&
    today.swsMinutes < baseline.sws - baseline.swsSd;

  if (debtHours != null && debtHours > 1.5 && swsBelowSd && score != null) {
    score = Math.min(score, 35);
    flags.push(
      "Sleep debt above 1.5 hours with deep sleep more than one standard deviation below baseline. Risk judgement is the first thing to go.",
    );
  }

  return {
    key: "decision",
    label: "Decision making",
    score,
    band: bandOf(score),
    premise:
      "Prefrontal capacity to weigh probability against reward, restored by deep sleep.",
    contributions,
    flags,
    guidance:
      score == null
        ? "Log sleep debt and deep sleep to score this."
        : score < 50
          ? "Halve your position sizing and take only setups already written into your plan."
          : score < 67
            ? "Stick to A-grade setups. Do not improvise new criteria today."
            : "Risk judgement is intact. Normal sizing.",
  };
}

/**
 * Focus. Sustained vigilance and pattern recognition. Traders show real
 * cardiovascular arousal during volatility, and a stable resting heart rate is
 * the marker of the autonomic control needed to absorb it. REM sleep is what
 * consolidates the associative pattern recognition itself.
 */
function focusScore(today: Biometrics, baseline: Baseline): ReadinessScore {
  const contributions: Contribution[] = [
    {
      label: "REM sleep",
      weight: 0.5,
      score: baselineScore(today.remMinutes, baseline.rem),
      reading: minutes(today.remMinutes),
      against:
        baseline.rem == null
          ? "first reading, treated as your starting baseline"
          : `baseline ${minutes(baseline.rem)}`,
    },
    {
      label: "Resting heart rate",
      weight: 0.5,
      // Five beats above baseline is the edge of central nervous system fatigue.
      score: penaltyScore(
        today.restingHeartRate,
        baseline.restingHeartRate,
        12,
        "above",
      ),
      reading:
        today.restingHeartRate == null ? "--" : `${today.restingHeartRate.toFixed(0)} bpm`,
      against:
        baseline.restingHeartRate == null
          ? "first reading, treated as your starting baseline"
          : around(baseline.restingHeartRate, " bpm"),
    },
  ];

  let score = blend(contributions);
  const flags: string[] = [];

  const rhrDelta =
    today.restingHeartRate != null && baseline.restingHeartRate != null
      ? today.restingHeartRate - baseline.restingHeartRate
      : null;
  const remSuppressed =
    today.remMinutes != null && baseline.rem != null && today.remMinutes < baseline.rem;

  // 3–5 bpm above baseline is the literature's fatigue band. Combined with
  // suppressed REM, vigilance will not hold through a scalp session.
  if (rhrDelta != null && rhrDelta >= 3 && remSuppressed && score != null) {
    score = Math.min(score, 48);
    flags.push(
      `Resting heart rate ${rhrDelta.toFixed(0)} bpm above baseline with REM below baseline. Central nervous system fatigue: skip scalping.`,
    );
  }

  return {
    key: "focus",
    label: "Focus",
    score,
    band: bandOf(score),
    premise:
      "Sustained attention and pattern recognition, set by REM sleep and autonomic stability.",
    contributions,
    flags,
    guidance:
      score == null
        ? "Log REM sleep and resting heart rate to score this."
        : score < 50
          ? "Avoid scalping. Stay on daily and weekly setups that need less screen time."
          : score < 67
            ? "Step up a timeframe. Vigilance will fade faster than usual, so skip high-frequency work."
            : "Attention is holding. Any timeframe is fair game.",
  };
}

/**
 * Discipline. Vagally mediated HRV is a direct proxy for the prefrontal
 * cortex's ability to inhibit the amygdala, so it predicts whether you will
 * hold a stop or move it. A hard session followed by a red recovery is
 * accumulated allostatic load, and it shows up as impulsivity.
 */
function disciplineScore(today: Biometrics, baseline: Baseline): ReadinessScore {
  const strainNormalised =
    today.strainYesterday == null ? null : (today.strainYesterday / 21) * 100;
  const mismatch =
    strainNormalised == null || today.recoveryPct == null
      ? null
      : clamp(100 - Math.max(0, strainNormalised - today.recoveryPct) * 1.2);

  const contributions: Contribution[] = [
    {
      label: "HRV deviation",
      weight: 0.6,
      score: baselineScore(today.hrv, baseline.hrv),
      reading: today.hrv == null ? "--" : `${today.hrv.toFixed(0)} ms`,
      against: around(baseline.hrv, " ms"),
    },
    {
      label: "Strain against recovery",
      weight: 0.4,
      score: mismatch,
      reading:
        today.strainYesterday == null
          ? "--"
          : `strain ${today.strainYesterday.toFixed(1)} · recovery ${today.recoveryPct ?? "--"}%`,
      against: "penalised when yesterday's strain outran today's recovery",
    },
  ];

  let score = blend(contributions);
  const flags: string[] = [];

  const hrvSuppressed =
    today.hrv != null && baseline.hrv != null && today.hrv < baseline.hrv;
  const redRecovery = today.recoveryPct != null && today.recoveryPct <= 33;

  if (hrvSuppressed && redRecovery && score != null) {
    score = Math.min(score, 30);
    flags.push(
      "HRV below your 30-day average with recovery in the red. This is the combination that precedes moved stops and revenge trades.",
    );
  }

  if (
    today.strainYesterday != null &&
    today.strainYesterday >= 18 &&
    redRecovery &&
    score != null
  ) {
    score = Math.min(score, 35);
    flags.push(
      "An all-out strain day followed by a red recovery. Allostatic load is accumulating.",
    );
  }

  return {
    key: "discipline",
    label: "Discipline",
    score,
    band: bandOf(score),
    premise:
      "Impulse control. HRV proxies the prefrontal brake on the amygdala's fear and reward responses.",
    contributions,
    flags,
    guidance:
      score == null
        ? "Log HRV and recovery to score this."
        : score < 34
          ? "Lock yourself out. Manage open positions only, and place no new orders."
          : score < 50
            ? "Maximum risk reduction. No adding to positions and no re-entries after a stop."
            : score < 67
              ? "Safe to manage open trades. Set your stop once and do not touch it."
              : "Impulse control is intact. Your rules should hold under pressure.",
  };
}

/**
 * Confidence. Not bravado but interoception, the accuracy with which you read
 * your own bodily signals. Traders with higher baseline HRV read those signals
 * better, and that sensitivity tracks with profitability and survival.
 */
function confidenceScore(today: Biometrics, baseline: Baseline): ReadinessScore {
  const contributions: Contribution[] = [
    {
      label: "Recovery zone",
      weight: 0.5,
      score: today.recoveryPct,
      reading: today.recoveryPct == null ? "--" : `${today.recoveryPct}%`,
      against: "green is 67% and above",
    },
    {
      label: "7-day HRV trend",
      weight: 0.3,
      score:
        baseline.hrvTrendPct == null
          ? null
          : clamp(50 + baseline.hrvTrendPct * 2.5),
      reading:
        baseline.hrvTrendPct == null
          ? "--"
          : `${baseline.hrvTrendPct >= 0 ? "+" : ""}${baseline.hrvTrendPct.toFixed(1)}%`,
      against: "last 7 days against the 7 before",
    },
    {
      label: "Strain capacity today",
      weight: 0.2,
      score:
        today.strainTarget == null ? null : clamp((today.strainTarget / 18) * 100),
      reading: today.strainTarget == null ? "--" : today.strainTarget.toFixed(1),
      against: "a target of 18 or more is full capacity",
    },
  ];

  const score = blend(contributions);
  const flags: string[] = [];

  if (
    today.recoveryPct != null &&
    today.recoveryPct >= 67 &&
    baseline.hrvTrendPct != null &&
    baseline.hrvTrendPct > 0
  ) {
    flags.push(
      "Green recovery on a rising HRV trend. Your physiology is calibrated to trust your read.",
    );
  }

  return {
    key: "confidence",
    label: "Confidence",
    score,
    band: bandOf(score),
    premise:
      "Interoceptive accuracy: whether the gut feeling behind a decision is signal or noise today.",
    contributions,
    flags,
    guidance:
      score == null
        ? "Log recovery to score this."
        : score < 50
          ? "Do not trust discretionary reads today. Mechanical entries only, straight from your checklist."
          : score < 67
            ? "Take the setups you can point at on the chart. Leave the feel trades alone."
            : "Execute your edge at full conviction.",
  };
}

/* -------------------------------------------------------------------------- */
/*                              Risk from readiness                           */
/* -------------------------------------------------------------------------- */

/**
 * Translates the scores into a hard number, because a dashboard that only
 * describes your state changes nothing about the size you put on.
 */
function riskDirective(scores: ReadinessScore[]): RiskDirective {
  const scored = scores.filter((s) => s.score != null);
  if (scored.length === 0) {
    return {
      multiplier: 1,
      label: "Not scored",
      reasons: ["No physiological data logged for today."],
      lockout: false,
    };
  }

  const discipline = scores.find((s) => s.key === "discipline");
  const lowest = scored.reduce((min, s) => (s.score! < min.score! ? s : min));
  const reasons: string[] = [];

  if (discipline?.score != null && discipline.score < 34) {
    return {
      multiplier: 0,
      label: "Lockout",
      reasons: [
        "Discipline below 34. Impulse control is the one score that cannot be worked around by trading smaller.",
      ],
      lockout: true,
    };
  }

  let multiplier = 1;
  if (lowest.score! < 34) multiplier = 0.25;
  else if (lowest.score! < 50) multiplier = 0.5;
  else if (lowest.score! < 67) multiplier = 0.75;

  if (multiplier < 1) {
    reasons.push(
      `${lowest.label} at ${Math.round(lowest.score!)} is the governing score.`,
    );
  } else {
    reasons.push("Every score is in the optimal band.");
  }

  for (const score of scored) {
    for (const flag of score.flags) {
      if (!reasons.includes(flag)) reasons.push(flag);
    }
  }

  return {
    multiplier,
    label:
      multiplier === 1
        ? "Full risk"
        : `${Math.round(multiplier * 100)}% of normal risk`,
    reasons,
    lockout: false,
  };
}

const FIELD_LABELS: Array<[keyof Biometrics, string]> = [
  ["recoveryPct", "Recovery"],
  ["hrv", "HRV"],
  ["restingHeartRate", "Resting heart rate"],
  ["respiratoryRate", "Respiratory rate"],
  ["sleepDebtMinutes", "Sleep debt"],
  ["swsMinutes", "Deep sleep"],
  ["remMinutes", "REM sleep"],
  ["strainYesterday", "Yesterday's strain"],
  ["strainTarget", "Strain target"],
];

export function buildReadiness(
  today: Biometrics,
  history: Biometrics[],
): ReadinessReport {
  const baseline = computeBaseline(history, today.date);
  const scores = [
    decisionScore(today, baseline),
    focusScore(today, baseline),
    disciplineScore(today, baseline),
    confidenceScore(today, baseline),
  ];

  const scored = scores.filter((s) => s.score != null);
  const composite = scored.length
    ? scored.reduce((sum, s) => sum + s.score!, 0) / scored.length
    : null;

  return {
    date: today.date,
    scores,
    composite,
    governing: scored.length
      ? scored.reduce((min, s) => (s.score! < min.score! ? s : min))
      : null,
    baseline,
    risk: riskDirective(scores),
    missing: FIELD_LABELS.filter(([key]) => today[key] == null).map(([, label]) => label),
  };
}

/* -------------------------------------------------------------------------- */
/*                          Readiness against results                         */
/* -------------------------------------------------------------------------- */

export interface ReadinessOutcome {
  band: ScoreBand;
  label: string;
  days: number;
  trades: number;
  netPnl: number;
  winRate: number;
  ruleAdherence: number;
  avgPnlPerTrade: number;
}

const BAND_ORDER: ScoreBand[] = ["optimal", "moderate", "compromised"];
const BAND_LABELS: Record<ScoreBand, string> = {
  optimal: "Optimal days (67+)",
  moderate: "Moderate days (50-66)",
  compromised: "Compromised days (under 50)",
};

/**
 * The test that makes the rest of this page worth keeping: do the days your
 * physiology said you were ready actually trade better than the days it did
 * not? Grouped by the governing score, because that is what sets the day.
 */
export function readinessVsResults(
  records: Biometrics[],
  trades: Trade[],
): ReadinessOutcome[] {
  const bandByDate = new Map<string, ScoreBand>();
  for (const record of records) {
    const report = buildReadiness(record, records);
    if (report.governing?.score == null) continue;
    bandByDate.set(record.date, bandOf(report.governing.score));
  }

  return BAND_ORDER.map((band) => {
    const days = [...bandByDate.entries()].filter(([, b]) => b === band);
    const dates = new Set(days.map(([date]) => date));
    const dayTrades = trades.filter((trade) => dates.has(trade.entryAt.slice(0, 10)));

    const pnls = dayTrades.map(netPnl);
    const wins = pnls.filter((p) => p > 0).length;
    const decided = dayTrades.filter((t) => t.outcome !== "breakeven").length;
    const net = pnls.reduce((a, b) => a + b, 0);

    return {
      band,
      label: BAND_LABELS[band],
      days: days.length,
      trades: dayTrades.length,
      netPnl: net,
      winRate: decided ? (wins / decided) * 100 : 0,
      ruleAdherence: dayTrades.length
        ? (dayTrades.filter((t) => t.rulesFollowed).length / dayTrades.length) * 100
        : 0,
      avgPnlPerTrade: dayTrades.length ? net / dayTrades.length : 0,
    };
  }).filter((row) => row.days > 0);
}

export interface ScorePoint {
  date: string;
  decision: number | null;
  focus: number | null;
  discipline: number | null;
  confidence: number | null;
  composite: number | null;
}

/** Recent mornings, oldest first, for the trend chart. */
export function scoreHistory(records: Biometrics[], limit = 14): ScorePoint[] {
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((record) => {
      const report = buildReadiness(record, records);
      const pick = (key: ReadinessScore["key"]) =>
        report.scores.find((s) => s.key === key)?.score ?? null;
      return {
        date: record.date,
        decision: pick("decision"),
        focus: pick("focus"),
        discipline: pick("discipline"),
        confidence: pick("confidence"),
        composite: report.composite,
      };
    });
}

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

export function emptyBiometrics(date: string): BiometricsDraft {
  return {
    date,
    source: "manual",
    recoveryPct: null,
    hrv: null,
    restingHeartRate: null,
    respiratoryRate: null,
    sleepDebtMinutes: null,
    swsMinutes: null,
    remMinutes: null,
    totalSleepMinutes: null,
    strainYesterday: null,
    strainTarget: null,
    note: "",
  };
}

function num(value: unknown, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, parsed));
}

export function normalizeBiometrics(input: unknown): {
  draft: BiometricsDraft;
  errors: string[];
} {
  const raw = (input ?? {}) as Partial<Biometrics>;
  const errors: string[] = [];

  const date = typeof raw.date === "string" ? raw.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("A valid date is required.");

  return {
    draft: {
      date,
      source: raw.source === "whoop" ? "whoop" : "manual",
      recoveryPct: num(raw.recoveryPct, 0, 100),
      hrv: num(raw.hrv, 0, 400),
      restingHeartRate: num(raw.restingHeartRate, 20, 200),
      respiratoryRate: num(raw.respiratoryRate, 5, 40),
      sleepDebtMinutes: num(raw.sleepDebtMinutes, 0, 1440),
      swsMinutes: num(raw.swsMinutes, 0, 1440),
      remMinutes: num(raw.remMinutes, 0, 1440),
      totalSleepMinutes: num(raw.totalSleepMinutes, 0, 1440),
      strainYesterday: num(raw.strainYesterday, 0, 21),
      strainTarget: num(raw.strainTarget, 0, 21),
      note: typeof raw.note === "string" ? raw.note.trim() : "",
    },
    errors,
  };
}
