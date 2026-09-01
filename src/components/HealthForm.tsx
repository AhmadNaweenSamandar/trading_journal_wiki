"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { emptyBiometrics } from "@/lib/health";
import type { Biometrics, BiometricsDraft } from "@/lib/types";

interface FieldSpec {
  key: keyof BiometricsDraft;
  label: string;
  unit: string;
  hint: string;
  step?: string;
}

const GROUPS: Array<{ heading: string; fields: FieldSpec[] }> = [
  {
    heading: "Recovery and autonomic tone",
    fields: [
      {
        key: "recoveryPct",
        label: "Recovery",
        unit: "%",
        hint: "Green is 67 and above.",
      },
      { key: "hrv", label: "HRV", unit: "ms", hint: "RMSSD from this morning." },
      {
        key: "restingHeartRate",
        label: "Resting heart rate",
        unit: "bpm",
        hint: "Overnight resting value.",
      },
      {
        key: "respiratoryRate",
        label: "Respiratory rate",
        unit: "rpm",
        hint: "Spikes often precede illness.",
        step: "0.1",
      },
    ],
  },
  {
    heading: "Sleep architecture",
    fields: [
      {
        key: "sleepDebtMinutes",
        label: "Sleep debt",
        unit: "min",
        hint: "Accumulated debt, in minutes.",
      },
      {
        key: "swsMinutes",
        label: "Deep sleep",
        unit: "min",
        hint: "Slow wave sleep restores prefrontal energy.",
      },
      {
        key: "remMinutes",
        label: "REM sleep",
        unit: "min",
        hint: "REM consolidates pattern recognition.",
      },
      {
        key: "totalSleepMinutes",
        label: "Total sleep",
        unit: "min",
        hint: "Time actually asleep.",
      },
    ],
  },
  {
    heading: "Strain",
    fields: [
      {
        key: "strainYesterday",
        label: "Yesterday's strain",
        unit: "0-21",
        hint: "18 and above is an all-out day.",
        step: "0.1",
      },
      {
        key: "strainTarget",
        label: "Today's strain target",
        unit: "0-21",
        hint: "The load your body is primed to absorb.",
        step: "0.1",
      },
    ],
  },
];

export function HealthForm({
  initial,
  date,
}: {
  initial?: Biometrics;
  date: string;
}) {
  const router = useRouter();

  const [draft, setDraft] = useState<BiometricsDraft>(() => {
    if (!initial) return emptyBiometrics(date);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = initial;
    return rest;
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [syncNote, setSyncNote] = useState("");

  const set = <K extends keyof BiometricsDraft>(key: K, value: BiometricsDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors([]);

    const response = await fetch("/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErrors(body.errors ?? ["Could not save these readings."]);
      return;
    }
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sync() {
    setSyncNote("Contacting WHOOP...");
    const response = await fetch("/api/health/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "whoop", date: draft.date }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setSyncNote((body.errors ?? ["Sync failed."])[0]);
      return;
    }
    setSyncNote("Pulled from WHOOP.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {errors.length > 0 ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {errors.join(" ")}
        </div>
      ) : null}

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              This morning&apos;s readings
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Enter what your wearable shows. Blank fields are simply left out of the
              score rather than counted as zero.
            </p>
          </div>
          <div>
            <span className="label mb-1.5">Date</span>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => set("date", e.target.value)}
              className="field w-auto"
            />
          </div>
        </div>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="label mb-2">{group.heading}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <span className="mb-1.5 block text-xs text-slate-400">
                      {field.label}
                      <span className="ml-1 text-slate-600">{field.unit}</span>
                    </span>
                    <input
                      type="number"
                      step={field.step ?? "1"}
                      value={(draft[field.key] as number | null) ?? ""}
                      onChange={(e) =>
                        set(
                          field.key,
                          (e.target.value === ""
                            ? null
                            : Number(e.target.value)) as BiometricsDraft[typeof field.key],
                        )
                      }
                      className="field"
                    />
                    <p className="mt-1 text-[11px] text-slate-600">{field.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div>
            <span className="label mb-1.5">Note</span>
            <input
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Travelled yesterday, two glasses of wine"
              className="field"
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-200">Connected devices</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              WHOOP will fill recovery, HRV, resting heart rate, respiratory rate, sleep
              stages, sleep debt and strain automatically. The mapping and the write path
              are already built; only the authenticated calls are missing.
            </p>
            {syncNote ? (
              <p className="mt-2 text-xs text-amber-300/90">{syncNote}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-sky-500/20 px-2.5 py-1 text-[11px] text-sky-200 ring-1 ring-sky-500/30">
              WHOOP · not connected
            </span>
            <button
              type="button"
              onClick={sync}
              className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-300 hover:border-sky-500/50 hover:bg-sky-400/20 hover:text-sky-300"
            >
              Try sync
            </button>
          </div>
        </div>
      </section>

      <div className="card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-xs text-slate-500">
          Saving rebuilds the readiness report above.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : initial ? "Update readings" : "Save readings"}
        </button>
      </div>
    </form>
  );
}
