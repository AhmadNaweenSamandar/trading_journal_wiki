"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ScreenshotPad } from "@/components/ScreenshotPad";
import {
  BIASES,
  IMPACTS,
  candleFromLabel,
  emptyPremarket,
  uid,
} from "@/lib/premarket";
import type {
  Bias,
  CandleRead,
  EventImpact,
  PremarketDraft,
} from "@/lib/types";
import { uploadImage } from "@/lib/upload";

const BIAS_STYLES: Record<Bias, string> = {
  bullish: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
  bearish: "border-rose-500/60 bg-rose-500/10 text-rose-300",
  neutral: "border-sky-500/35 bg-sky-500/25 text-slate-300",
};

const IMPACT_STYLES: Record<EventImpact, string> = {
  high: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  medium: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  low: "bg-sky-500/25 text-slate-400 ring-sky-500/30",
};

export function PremarketForm({
  candleLabels,
}: {
  candleLabels?: string[];
}) {
  const router = useRouter();

  const [draft, setDraft] = useState<PremarketDraft>(() =>
    emptyPremarket(undefined, candleLabels),
  );
  const [activePad, setActivePad] = useState<string>(
    () => draft.candles[0]?.id ?? "",
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [newCandle, setNewCandle] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof PremarketDraft>(key: K, value: PremarketDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const patchCandle = (id: string, patch: Partial<CandleRead>) =>
    setDraft((prev) => ({
      ...prev,
      candles: prev.candles.map((candle) =>
        candle.id === id ? { ...candle, ...patch } : candle,
      ),
    }));

  const attach = useCallback(async (id: string, file: File | Blob) => {
    setUploading(id);
    try {
      const url = await uploadImage(file);
      setDraft((prev) => ({
        ...prev,
        candles: prev.candles.map((candle) =>
          candle.id === id ? { ...candle, screenshot: url } : candle,
        ),
      }));
    } catch (error) {
      setErrors([(error as Error).message]);
    } finally {
      setUploading(null);
    }
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (!file || !activePad) return;
      event.preventDefault();
      void attach(activePad, file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activePad, attach]);

  function addCandle() {
    const label = newCandle.trim();
    if (!label) return;
    const candle = candleFromLabel(label);
    setDraft((prev) => ({ ...prev, candles: [...prev.candles, candle] }));
    setActivePad(candle.id);
    setNewCandle("");
  }

  function removeCandle(id: string) {
    setDraft((prev) => {
      const candles = prev.candles.filter((candle) => candle.id !== id);
      if (activePad === id) setActivePad(candles[0]?.id ?? "");
      return { ...prev, candles };
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors([]);

    const response = await fetch("/api/premarket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErrors(body.errors ?? ["Could not save the plan."]);
      return;
    }

    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-24">
      {errors.length > 0 ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {errors.join(" ")}
        </div>
      ) : null}

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Session</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            One plan per day. After you save, this form closes and the summary
            stays at the top.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <div className="field bg-sky-500/10 text-slate-400">{draft.date}</div>
          </Field>
          <Field label="Day">
            <div className="field bg-sky-500/10 text-slate-400">
              {draft.day || "--"}
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Day bias">
              <BiasPicker
                value={draft.dayBias}
                onChange={(value) => set("dayBias", value)}
              />
            </Field>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Field
            label="Yesterday's price movement"
            hint="What the market did in the session before this one."
          >
            <textarea
              value={draft.yesterdayMovement}
              onChange={(e) => set("yesterdayMovement", e.target.value)}
              rows={3}
              placeholder="Swept the Friday high then sold off into the daily open and closed weak"
              className="field resize-none"
            />
          </Field>
          <Field label="Day bias reasoning" hint="Why you lean that way today.">
            <textarea
              value={draft.dayBiasNote}
              onChange={(e) => set("dayBiasNote", e.target.value)}
              rows={3}
              placeholder="Daily is in a pullback inside a weekly uptrend; looking for longs from the 4H demand"
              className="field resize-none"
            />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Market analysis</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Stack the candles you actually read. Add a 30 min, drop monthly —
            whatever the day needs. Click a chart box, then press Cmd+V to paste.
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={newCandle}
            onChange={(e) => setNewCandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCandle();
              }
            }}
            placeholder="e.g. 30 min candle"
            className="field"
          />
          <button
            type="button"
            onClick={addCandle}
            className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Add candle
          </button>
        </div>

        {draft.candles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-sky-500/25 px-3 py-3 text-center text-xs text-slate-500">
            No candles yet. Add the timeframes you want to read today.
          </p>
        ) : (
          <div className="space-y-4">
            {draft.candles.map((candle) => (
              <div
                key={candle.id}
                className="space-y-3 rounded-lg border border-sky-500/20 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={candle.label}
                    onChange={(e) => patchCandle(candle.id, { label: e.target.value })}
                    placeholder="Candle name"
                    className="field min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeCandle(candle.id)}
                    className="shrink-0 rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:border-rose-500/50 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
                <ScreenshotPad
                  label={candle.label}
                  showLabel={false}
                  url={candle.screenshot}
                  active={activePad === candle.id}
                  uploading={uploading === candle.id}
                  onActivate={() => setActivePad(candle.id)}
                  onFile={(file) => void attach(candle.id, file)}
                  onClear={() => patchCandle(candle.id, { screenshot: "" })}
                />
                <BiasPicker
                  value={candle.bias}
                  onChange={(value) => patchCandle(candle.id, { bias: value })}
                />
                <textarea
                  value={candle.note}
                  onChange={(e) => patchCandle(candle.id, { note: e.target.value })}
                  rows={2}
                  placeholder={`What the ${candle.label.toLowerCase() || "candle"} is telling you`}
                  className="field resize-none"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Important levels</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              The prices that would change your mind.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              set("levels", [
                ...draft.levels,
                { id: uid("lvl"), label: "", price: "" },
              ])
            }
            className="shrink-0 rounded-lg border border-sky-500/30 px-3 py-1.5 text-sm text-slate-300 hover:border-sky-500/50 hover:bg-sky-400/20 hover:text-sky-300"
          >
            Add level
          </button>
        </div>

        {draft.levels.length === 0 ? (
          <p className="rounded-lg border border-dashed border-sky-500/25 px-3 py-3 text-center text-xs text-slate-500">
            No levels marked yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {draft.levels.map((level, index) => (
              <li
                key={level.id}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center"
              >
                <input
                  value={level.label}
                  onChange={(e) => {
                    const next = [...draft.levels];
                    next[index] = { ...level, label: e.target.value };
                    set("levels", next);
                  }}
                  placeholder="Weekly resistance"
                  className="field min-w-0"
                />
                <input
                  value={level.price}
                  onChange={(e) => {
                    const next = [...draft.levels];
                    next[index] = { ...level, price: e.target.value };
                    set("levels", next);
                  }}
                  placeholder="64,800"
                  className="field font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "levels",
                      draft.levels.filter((item) => item.id !== level.id),
                    )
                  }
                  className="px-1.5 text-slate-600 hover:text-rose-400"
                  aria-label="Remove level"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Important events</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Scheduled news that can invalidate a technical read.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              set("events", [
                ...draft.events,
                { id: uid("evt"), time: "", title: "", impact: "medium" },
              ])
            }
            className="shrink-0 rounded-lg border border-sky-500/30 px-3 py-1.5 text-sm text-slate-300 hover:border-sky-500/50 hover:bg-sky-400/20 hover:text-sky-300"
          >
            Add event
          </button>
        </div>

        {draft.events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-sky-500/25 px-3 py-3 text-center text-xs text-slate-500">
            Nothing on the calendar today.
          </p>
        ) : (
          <ul className="space-y-2">
            {draft.events.map((event, index) => (
              <li
                key={event.id}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_6.5rem_auto] sm:items-center"
              >
                <input
                  type="time"
                  value={event.time}
                  onChange={(e) => {
                    const next = [...draft.events];
                    next[index] = { ...event, time: e.target.value };
                    set("events", next);
                  }}
                  className="field"
                />
                <input
                  value={event.title}
                  onChange={(e) => {
                    const next = [...draft.events];
                    next[index] = { ...event, title: e.target.value };
                    set("events", next);
                  }}
                  placeholder="CPI release"
                  className="field min-w-0"
                />
                <select
                  value={event.impact}
                  onChange={(e) => {
                    const next = [...draft.events];
                    next[index] = {
                      ...event,
                      impact: e.target.value as EventImpact,
                    };
                    set("events", next);
                  }}
                  className={`field ${IMPACT_STYLES[event.impact]}`}
                >
                  {IMPACTS.map((impact) => (
                    <option key={impact} value={impact}>
                      {impact}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "events",
                      draft.events.filter((item) => item.id !== event.id),
                    )
                  }
                  className="px-1.5 text-slate-600 hover:text-rose-400"
                  aria-label="Remove event"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="card sticky bottom-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-xs text-slate-500">
          Saving locks today&apos;s plan and builds the summary above.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save plan"}
        </button>
      </div>
    </form>
  );
}

function BiasPicker({
  value,
  onChange,
}: {
  value: Bias;
  onChange: (value: Bias) => void;
}) {
  return (
    <div className="flex gap-2">
      {BIASES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors ${
            value === option
              ? BIAS_STYLES[option]
              : "border-sky-500/30 text-slate-500 hover:bg-sky-400/20 hover:border-sky-400/50"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="label mb-1.5">{label}</span>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}
