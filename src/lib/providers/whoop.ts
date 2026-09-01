import type { BiometricsDraft } from "../types";

/**
 * Mapping layer for WHOOP. The shapes below follow the v1 developer API
 * (Recovery, Sleep and Cycle collections). Nothing here performs network calls
 * yet: `fetchWhoopDay` is the single seam where an authenticated client gets
 * plugged in, and everything downstream already works against the mapped
 * `BiometricsDraft`.
 */

export interface WhoopRecovery {
  score?: {
    recovery_score?: number;
    hrv_rmssd_milli?: number;
    resting_heart_rate?: number;
  };
}

export interface WhoopSleep {
  score?: {
    stage_summary?: {
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
    };
    sleep_needed?: {
      baseline_milli?: number;
      need_from_sleep_debt_milli?: number;
    };
    respiratory_rate?: number;
  };
}

export interface WhoopCycle {
  score?: {
    strain?: number;
  };
}

export interface WhoopDay {
  date: string;
  recovery?: WhoopRecovery;
  sleep?: WhoopSleep;
  /** The cycle that closed yesterday, which is where yesterday's strain lives. */
  previousCycle?: WhoopCycle;
}

const toMinutes = (milli: number | undefined): number | null =>
  milli == null ? null : Math.round(milli / 60000);

/**
 * WHOOP does not publish a strain target directly, so it is derived the way
 * the app itself presents it: capacity scales with recovery.
 */
function strainTargetFrom(recoveryPct: number | null): number | null {
  if (recoveryPct == null) return null;
  return Number((6 + (recoveryPct / 100) * 15).toFixed(1));
}

export function mapWhoopDay(day: WhoopDay): BiometricsDraft {
  const recovery = day.recovery?.score;
  const sleep = day.sleep?.score;
  const stages = sleep?.stage_summary;

  const inBed = toMinutes(stages?.total_in_bed_time_milli);
  const awake = toMinutes(stages?.total_awake_time_milli);
  const recoveryPct = recovery?.recovery_score ?? null;

  return {
    date: day.date,
    source: "whoop",
    recoveryPct,
    hrv: recovery?.hrv_rmssd_milli ?? null,
    restingHeartRate: recovery?.resting_heart_rate ?? null,
    respiratoryRate: sleep?.respiratory_rate ?? null,
    sleepDebtMinutes: toMinutes(sleep?.sleep_needed?.need_from_sleep_debt_milli),
    swsMinutes: toMinutes(stages?.total_slow_wave_sleep_time_milli),
    remMinutes: toMinutes(stages?.total_rem_sleep_time_milli),
    totalSleepMinutes: inBed == null ? null : inBed - (awake ?? 0),
    strainYesterday: day.previousCycle?.score?.strain ?? null,
    strainTarget: strainTargetFrom(recoveryPct),
    note: "",
  };
}

export class ProviderNotConnectedError extends Error {
  constructor(provider: string) {
    super(`${provider} is not connected yet.`);
    this.name = "ProviderNotConnectedError";
  }
}

/**
 * The seam for the real integration. Swap the throw for authenticated calls to
 * /v1/recovery, /v1/activity/sleep and /v1/cycle, then hand the result to
 * `mapWhoopDay`.
 */
export async function fetchWhoopDay(_date: string): Promise<WhoopDay> {
  throw new ProviderNotConnectedError("WHOOP");
}
