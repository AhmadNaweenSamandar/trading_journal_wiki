"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CircularTimer } from "@/components/CircularTimer";
import { ImportDialog } from "@/components/ImportDialog";
import { ScreenshotPad } from "@/components/ScreenshotPad";
import { currency, duration, rValue, tone } from "@/lib/format";
import {
  computedR,
  dayOf,
  holdMinutes,
  margin,
  netPnl,
  outcomeOf,
  plannedRewardLeg,
  positionValue,
  returnOnMargin,
  riskDiscipline,
} from "@/lib/metrics";
import {
  ENTRY_TIME_BUDGET_SECONDS,
  GRADE_DESCRIPTIONS,
  emptyTradeDraft,
  gradeFromScore,
  scoreOf,
} from "@/lib/taxonomy";
import { IMPORT_DRAFT_KEY, exportTrades } from "@/lib/spreadsheet";
import type { Settings, Trade, TradeDraft } from "@/lib/types";
import { uploadImage } from "@/lib/upload";

type ShotKey = "exit1m" | "exit15m";

interface Props {
  initial?: Trade;
  settings: Settings;
  allTrades: Trade[];
}

export function TradeForm({ initial, settings, allTrades }: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [draft, setDraft] = useState<TradeDraft>(() => {
    if (!initial) return emptyTradeDraft(settings);
    const { id: _id, seq: _s, createdAt: _c, updatedAt: _u, ...rest } = initial;
    return rest;
  });
  const [scratch, setScratch] = useState(initial?.outcome === "breakeven");
  const [elapsed, setElapsed] = useState(0);
  const [timerOn, setTimerOn] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [activeShot, setActiveShot] = useState<ShotKey>("exit1m");
  const [uploading, setUploading] = useState<ShotKey | null>(null);
  const [importing, setImporting] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (initial) return;
    try {
      const raw = sessionStorage.getItem(IMPORT_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(IMPORT_DRAFT_KEY);
      setDraft(JSON.parse(raw) as TradeDraft);
    } catch {
      /* ignore a stale or unreadable stash */
    }
  }, [initial]);

  useEffect(() => {
    if (!timerOn) return;
    const tick = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(tick);
  }, [timerOn]);

  const set = <K extends keyof TradeDraft>(key: K, value: TradeDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const attach = useCallback(async (key: ShotKey, file: File | Blob) => {
    setUploading(key);
    try {
      const url = await uploadImage(file);
      setDraft((prev) => ({
        ...prev,
        screenshots: { ...prev.screenshots, [key]: url },
      }));
    } catch (error) {
      setErrors([(error as Error).message]);
    } finally {
      setUploading(null);
    }
  }, []);

  // Paste anywhere on the page drops the image into the selected pad.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((i) =>
        i.type.startsWith("image/"),
      );
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      event.preventDefault();
      void attach(activeShot, file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activeShot, attach]);

  const provisional = useMemo(
    () => ({ ...draft, id: "preview", seq: 0, createdAt: "", updatedAt: "" }) as Trade,
    [draft],
  );

  const pnl = netPnl(provisional);
  const derivedOutcome = scratch ? "breakeven" : outcomeOf(pnl);
  const withOutcome = { ...provisional, outcome: derivedOutcome } as Trade;
  const autoR = computedR(withOutcome);
  const finalR = draft.realizedR ?? autoR;
  const discipline = riskDiscipline(provisional);

  const qualityScore = scoreOf(
    draft.qualityChecks.length,
    settings.qualityChecklist.length,
  );
  const ruleScore = scoreOf(draft.ruleChecks.length, settings.rulesChecklist.length);
  const grade = gradeFromScore(qualityScore);
  const rewardLeg = plannedRewardLeg(draft.plannedRr);
  const held = holdMinutes(provisional);

  const toggle = (key: "qualityChecks" | "ruleChecks", id: string) =>
    setDraft((prev) => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter((v) => v !== id)
        : [...prev[key], id],
    }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors([]);

    const payload = {
      ...draft,
      outcome: derivedOutcome,
      entryDurationSeconds: isEdit ? draft.entryDurationSeconds : elapsed,
    };

    const response = await fetch(
      isEdit ? `/api/trades/${initial!.id}` : "/api/trades",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setErrors(body.errors ?? ["Could not save the entry."]);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const saved: Trade = await response.json();
    router.push(`/trades/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      {importing ? (
        <ImportDialog
          settings={settings}
          baseDraft={draft}
          onLoadRow={(next) => setDraft(next)}
          onClose={() => setImporting(false)}
        />
      ) : null}

      {errors.length > 0 ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          <ul className="list-inside list-disc space-y-0.5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="min-w-0 space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
            {isEdit ? (
              <div>
                <p className="label">Editing trade</p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">
                  #{initial!.seq}
                </p>
                <p className="text-xs text-slate-500">
                  Logged in {duration(initial!.entryDurationSeconds)}
                </p>
              </div>
            ) : (
              <CircularTimer
                elapsed={elapsed}
                budget={ENTRY_TIME_BUDGET_SECONDS}
                running={timerOn}
                onToggle={() => setTimerOn((on) => !on)}
              />
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImporting(true)}
                className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-300 hover:border-sky-500/50 hover:bg-sky-400/20 hover:text-sky-300"
              >
                Upload spreadsheet
              </button>
              <button
                type="button"
                onClick={() => exportTrades(allTrades, settings)}
                disabled={allTrades.length === 0}
                className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-300 hover:border-sky-500/50 hover:bg-sky-400/20 hover:text-sky-300 disabled:opacity-40"
                title={
                  allTrades.length === 0
                    ? "No trades to extract yet"
                    : `Extract ${allTrades.length} trades to Excel`
                }
              >
                Extract to Excel
              </button>
            </div>
          </div>

          <Section
            title="Layer 1 — Mechanical"
            description="What happened. Trade number, day, position value, margin, net P&L, result and final R are all computed."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Direction">
                <div className="flex gap-2">
                  {(["long", "short"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => set("direction", option)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                        draft.direction === option
                          ? option === "long"
                            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                            : "border-rose-500/60 bg-rose-500/10 text-rose-300"
                          : "border-sky-500/30 text-slate-400 hover:border-sky-400/50 hover:bg-sky-400/20"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Coin">
                <input
                  list="coin-options"
                  value={draft.coin}
                  onChange={(e) => set("coin", e.target.value.toUpperCase())}
                  placeholder="BTC"
                  className="field"
                />
                <datalist id="coin-options">
                  {settings.coins.map((coin) => (
                    <option key={coin} value={coin} />
                  ))}
                </datalist>
              </Field>

              <Field label="Timeframe">
                <select
                  value={draft.timeframe}
                  onChange={(e) => set("timeframe", e.target.value)}
                  className="field"
                >
                  {settings.timeframes.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>

              <Field
                label="Strategy type"
                hint={
                  settings.strategies.length === 0
                    ? "Add one in Settings first"
                    : undefined
                }
              >
                <select
                  value={draft.strategy}
                  onChange={(e) => set("strategy", e.target.value)}
                  className="field"
                >
                  <option value="">Select a strategy</option>
                  {settings.strategies.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>

              <Field label="Entry timestamp">
                <input
                  type="datetime-local"
                  value={draft.entryAt}
                  onChange={(e) => set("entryAt", e.target.value)}
                  className="field"
                />
              </Field>
              <Field
                label="Exit timestamp"
                hint={held == null ? undefined : `Held ${formatHold(held)}`}
              >
                <input
                  type="datetime-local"
                  value={draft.exitAt}
                  onChange={(e) => set("exitAt", e.target.value)}
                  className="field"
                />
              </Field>
              <Field label="Quantity">
                <NumberInput
                  value={draft.quantity}
                  onChange={(v) => set("quantity", v ?? 0)}
                  placeholder="0.5"
                />
              </Field>
              <Field label="Leverage" hint="1 for spot">
                <NumberInput
                  value={draft.leverage}
                  onChange={(v) => set("leverage", v ?? 1)}
                  placeholder="10"
                />
              </Field>

              <Field label="Entry price">
                <NumberInput
                  value={draft.entryPrice}
                  onChange={(v) => set("entryPrice", v ?? 0)}
                />
              </Field>
              <Field label="Exit price">
                <NumberInput
                  value={draft.exitPrice}
                  onChange={(v) => set("exitPrice", v ?? 0)}
                />
              </Field>
              <Field label="Trading fee">
                <NumberInput
                  value={draft.tradingFee}
                  onChange={(v) => set("tradingFee", v ?? 0)}
                />
              </Field>
              <Field label="Planned reward ratio">
                <input
                  list="rr-options"
                  value={draft.plannedRr}
                  onChange={(e) => set("plannedRr", e.target.value)}
                  placeholder="1:3"
                  className="field"
                />
                <datalist id="rr-options">
                  {settings.rewardRatios.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 sm:grid-cols-6">
              <Readout
                label="Trade #"
                value={isEdit ? `#${initial!.seq}` : "next"}
              />
              <Readout label="Day" value={dayOf(provisional) || "--"} />
              <Readout
                label="Position value"
                value={currency(positionValue(provisional))}
              />
              <Readout
                label="Margin used"
                value={
                  margin(provisional) == null ? "--" : currency(margin(provisional)!)
                }
              />
              <Readout label="Net P&L" value={currency(pnl)} className={tone(pnl)} />
              <Readout
                label="Return on margin"
                value={
                  returnOnMargin(provisional) == null
                    ? "--"
                    : `${returnOnMargin(provisional)!.toFixed(1)}%`
                }
                className={tone(pnl)}
              />
            </div>
          </Section>

          <Section
            title="Risk and result"
            description="One R is the risk you planned. A loss is measured against what you actually risked; a win against the profit you banked."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Planned risk ($)" hint="Your 1R unit.">
                  <NumberInput
                    value={draft.plannedRisk}
                    onChange={(v) => set("plannedRisk", v)}
                    placeholder="50"
                  />
                </Field>
                <Field
                  label="Actual risk ($)"
                  hint="What you really had exposed by the time it resolved."
                >
                  <NumberInput
                    value={draft.actualRisk}
                    onChange={(v) => set("actualRisk", v)}
                    placeholder="50"
                  />
                </Field>
              </div>
              <div className="self-start pt-1">
                <RiskMeter discipline={discipline} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Result" hint="Follows net P&L unless you scratch it.">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium capitalize ring-1 ${
                      derivedOutcome === "win"
                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                        : derivedOutcome === "loss"
                          ? "bg-rose-500/10 text-rose-300 ring-rose-500/30"
                          : "bg-sky-500/25 text-slate-300 ring-sky-500/30"
                    }`}
                  >
                    {derivedOutcome}
                  </span>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={scratch}
                      onChange={(e) => setScratch(e.target.checked)}
                      className="h-4 w-4 accent-sky-500"
                    />
                    Breakeven
                  </label>
                </div>
              </Field>

              <Field
                label="Final R (computed)"
                hint={
                  autoR == null
                    ? "Enter planned risk to compute this."
                    : derivedOutcome === "loss"
                      ? "Actual risk ÷ planned risk"
                      : "Net P&L ÷ planned risk"
                }
              >
                <div
                  className={`rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-lg font-semibold ${tone(autoR ?? 0)}`}
                >
                  {rValue(autoR)}
                </div>
              </Field>

              <Field
                label="Override final R"
                hint={
                  rewardLeg != null
                    ? `Leave empty to use the computed value. Full target is +${rewardLeg}R.`
                    : "Leave empty to use the computed value."
                }
              >
                <NumberInput
                  value={draft.realizedR}
                  onChange={(v) => set("realizedR", v)}
                  placeholder={autoR == null ? "" : autoR.toFixed(2)}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Layer 2 — Context"
            description="Why it happened. This is the layer only you can provide."
          >
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label">
                    Quality checklist — grade computes from what you tick
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{qualityScore.toFixed(0)}%</span>
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ring-1 ${
                        grade === "A"
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                          : grade === "B"
                            ? "bg-sky-500/25 text-sky-300 ring-sky-500/30"
                            : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                      }`}
                    >
                      {grade}
                    </span>
                  </span>
                </div>
                {settings.qualityChecklist.length === 0 ? (
                  <EmptyChecklist kind="quality criteria" />
                ) : (
                  <ul className="grid gap-1.5 lg:grid-cols-2">
                    {settings.qualityChecklist.map((item) => (
                      <CheckRow
                        key={item.id}
                        label={item.label}
                        checked={draft.qualityChecks.includes(item.id)}
                        onToggle={() => toggle("qualityChecks", item.id)}
                      />
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-slate-600">{GRADE_DESCRIPTIONS[grade]}</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label">Rules followed</span>
                  <span
                    className={`text-xs ${ruleScore >= 100 ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {ruleScore.toFixed(0)}%{ruleScore >= 100 ? " — all followed" : ""}
                  </span>
                </div>
                {settings.rulesChecklist.length === 0 ? (
                  <EmptyChecklist kind="rules" />
                ) : (
                  <ul className="grid gap-1.5 lg:grid-cols-2">
                    {settings.rulesChecklist.map((item) => (
                      <CheckRow
                        key={item.id}
                        label={item.label}
                        checked={draft.ruleChecks.includes(item.id)}
                        onToggle={() => toggle("ruleChecks", item.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="Trade reason" hint="One sentence. Why you entered.">
                  <textarea
                    value={draft.tradeReason}
                    onChange={(e) => set("tradeReason", e.target.value)}
                    rows={2}
                    placeholder="BTC swept the Asia low and printed a bullish ChoCH on the 5M"
                    className="field resize-none"
                  />
                </Field>

                <Field label="Exit reason" hint="One sentence. Why you closed.">
                  <textarea
                    value={draft.exitReason}
                    onChange={(e) => set("exitReason", e.target.value)}
                    rows={2}
                    placeholder="Hit the full 1:3 target"
                    className="field resize-none"
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-sky-500/25 p-4">
                <span className="label mb-3">Emotions</span>
                {settings.emotionQuestions.length === 0 ? (
                  <EmptyChecklist kind="emotion questions" />
                ) : (
                  <div className="space-y-3">
                    {settings.emotionQuestions.map((question) => (
                      <label
                        key={question.id}
                        className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span className="min-w-0 flex-1 text-sm text-slate-300">
                          {question.label}
                        </span>
                        <select
                          value={draft.emotions[question.id] ?? ""}
                          onChange={(e) =>
                            set("emotions", {
                              ...draft.emotions,
                              [question.id]: e.target.value,
                            })
                          }
                          className="field sm:w-48 sm:shrink-0"
                        >
                          <option value="">Not recorded</option>
                          {settings.emotionOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <Field
                label="One lesson"
                hint="'Clean execution, nothing to change' is a valid answer."
              >
                <textarea
                  value={draft.lesson}
                  onChange={(e) => set("lesson", e.target.value)}
                  rows={2}
                  placeholder="Entered before the confirmation candle closed"
                  className="field resize-none"
                />
              </Field>
            </div>
          </Section>

          <Section title="Tags" description="Categories you control from Settings.">
            {settings.tagCategories.length === 0 ? (
              <EmptyChecklist kind="tag categories" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {settings.tagCategories.map((category) => (
                  <Field key={category.id} label={category.name}>
                    <select
                      value={draft.tags[category.id] ?? ""}
                      onChange={(e) =>
                        set("tags", { ...draft.tags, [category.id]: e.target.value })
                      }
                      className="field"
                    >
                      <option value="">Not set</option>
                      {category.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            )}
            <div className="mt-3">
              <CustomTagsEditor
                tags={draft.customTags}
                onChange={(tags) => set("customTags", tags)}
              />
            </div>
          </Section>
        </div>

        <Section
          title="Exit screenshots"
          description="Copy a chart to your clipboard and press Cmd+V anywhere on this page. It lands in whichever pad is selected."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <ScreenshotPad
              label="Exit — 1 minute"
              url={draft.screenshots.exit1m}
              active={activeShot === "exit1m"}
              uploading={uploading === "exit1m"}
              onActivate={() => setActiveShot("exit1m")}
              onFile={(file) => void attach("exit1m", file)}
              onClear={() => set("screenshots", { ...draft.screenshots, exit1m: "" })}
            />
            <ScreenshotPad
              label="Exit — 15 minute"
              url={draft.screenshots.exit15m}
              active={activeShot === "exit15m"}
              uploading={uploading === "exit15m"}
              onActivate={() => setActiveShot("exit15m")}
              onFile={(file) => void attach("exit15m", file)}
              onClear={() => set("screenshots", { ...draft.screenshots, exit15m: "" })}
            />
          </div>
        </Section>

        <div className="card sticky bottom-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Readout label="Net P&L" value={currency(pnl)} className={tone(pnl)} />
            <Readout
              label="Final R"
              value={rValue(finalR)}
              className={tone(finalR ?? 0)}
            />
            <Readout label="Grade" value={`${grade} · ${qualityScore.toFixed(0)}%`} />
            <Readout
              label="Rules"
              value={`${ruleScore.toFixed(0)}%`}
              className={ruleScore >= 100 ? "text-emerald-400" : "text-rose-400"}
            />
          </div>

          <div className="flex shrink-0 gap-2">
            <Link
              href={isEdit ? `/trades/${initial!.id}` : "/trades"}
              className="rounded-lg border border-sky-500/30 px-4 py-2 text-center text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Save changes" : "Save entry"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export function RiskMeter({
  discipline,
}: {
  discipline: ReturnType<typeof riskDiscipline>;
}) {
  if (!discipline) {
    return (
      <p className="rounded-lg border border-dashed border-sky-500/25 px-3 py-3 text-center text-xs text-slate-600">
        Enter planned and actual risk to score your sizing.
      </p>
    );
  }

  const { tone: riskTone, score, label } = discipline;
  const colour =
    riskTone === "over"
      ? "bg-rose-500"
      : riskTone === "under"
        ? "bg-emerald-500"
        : "bg-sky-500";
  const text =
    riskTone === "over"
      ? "text-rose-400"
      : riskTone === "under"
        ? "text-emerald-400"
        : "text-slate-400";

  // Over-risk fills to the right of centre, under-risk to the left.
  const width =
    riskTone === "over"
      ? Math.min(50, (Math.abs(score) / 100) * 50)
      : Math.min(50, (score / 100) * 50);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label">Risk vs plan</span>
        <span className={`text-sm font-medium ${text}`}>{label}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-sky-500/25">
        <div className="absolute left-1/2 top-0 h-full w-px bg-sky-400/40" />
        <div
          className={`absolute top-0 h-full ${colour}`}
          style={
            riskTone === "over"
              ? { left: "50%", width: `${width}%` }
              : { right: "50%", width: `${width}%` }
          }
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-600">
        <span>No risk taken</span>
        <span>On plan</span>
        <span>Over plan</span>
      </div>
    </div>
  );
}

function formatHold(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function CustomTagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [value, setValue] = useState("");

  function add() {
    const next = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...tags];
    for (const tag of next) {
      if (!merged.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
        merged.push(tag);
      }
    }
    onChange(merged);
    setValue("");
  }

  return (
    <div>
      <span className="label mb-1.5">Custom tags</span>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Type a tag — spaces are allowed"
          className="field"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Add
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Click Add or press Enter. A comma still splits a paste into several tags.
      </p>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1 text-xs text-sky-200 ring-1 ring-sky-500/30"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((item) => item !== tag))}
                className="rounded-full px-0.5 text-slate-500 hover:text-rose-300"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
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

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      step="any"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      placeholder={placeholder}
      className="field"
    />
  );
}

function Readout({
  label,
  value,
  className = "text-slate-200",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${className}`}>{value}</p>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
          checked
            ? "border-emerald-500/40 bg-emerald-500/5 text-slate-200"
            : "border-sky-500/20 text-slate-400 hover:bg-sky-400/20 hover:border-sky-400/40"
        }`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
            checked
              ? "border-emerald-500 bg-emerald-500 text-slate-950"
              : "border-sky-500/35"
          }`}
        >
          {checked ? "\u2713" : ""}
        </span>
        {label}
      </button>
    </li>
  );
}

function EmptyChecklist({ kind }: { kind: string }) {
  return (
    <p className="rounded-lg border border-dashed border-sky-500/25 px-3 py-4 text-center text-xs text-slate-500">
      No {kind} defined yet.{" "}
      <Link href="/settings" className="text-sky-400 hover:text-sky-300">
        Add some in Settings
      </Link>
      .
    </p>
  );
}
