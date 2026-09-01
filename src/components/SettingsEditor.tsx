"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import type { ChecklistItem, Settings, TagCategory } from "@/lib/types";

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function SettingsEditor({
  initial,
  tradeCount,
}: {
  initial: Settings;
  tradeCount: number;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (response.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <Block
        title="Appearance"
        description="Light, dark, or follow the system. This only changes how the journal looks on this device."
      >
        <ThemeToggle />
      </Block>

      <Block
        title="Strategies"
        description="The setups you pick from on each trade. Keep the list short and specific."
      >
        <StringList
          values={settings.strategies}
          onChange={(v) => patch("strategies", v)}
          placeholder="ChoCH Break"
        />
      </Block>

      <div className="grid gap-4 lg:grid-cols-3">
        <Block title="Coins" description="Suggestions in the coin field.">
          <StringList
            values={settings.coins}
            onChange={(v) => patch("coins", v.map((c) => c.toUpperCase()))}
            placeholder="BTC"
          />
        </Block>
        <Block title="Timeframes" description="Options in the timeframe field.">
          <StringList
            values={settings.timeframes}
            onChange={(v) => patch("timeframes", v)}
            placeholder="15M"
          />
        </Block>
        <Block title="Reward ratios" description="Suggestions for planned R:R.">
          <StringList
            values={settings.rewardRatios}
            onChange={(v) => patch("rewardRatios", v)}
            placeholder="1:3"
          />
        </Block>
      </div>

      <Block
        title="Quality checklist"
        description="Your definition of an A-grade setup. Ticking every box scores an A, 75% or more a B, below that a C."
      >
        <ItemList
          items={settings.qualityChecklist}
          onChange={(v) => patch("qualityChecklist", v)}
          idPrefix="q"
          placeholder="Higher timeframe bias aligned"
        />
      </Block>

      <Block
        title="Rules checklist"
        description="Your trading rules. A trade only counts as rules followed when every box is ticked."
      >
        <ItemList
          items={settings.rulesChecklist}
          onChange={(v) => patch("rulesChecklist", v)}
          idPrefix="r"
          placeholder="Did not move my stop away from entry"
        />
      </Block>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block
          title="Emotion questions"
          description="Asked on every entry. One answer each."
        >
          <ItemList
            items={settings.emotionQuestions}
            onChange={(v) => patch("emotionQuestions", v)}
            idPrefix="e"
            placeholder="What was I feeling during the trade?"
          />
        </Block>
        <Block
          title="Emotion options"
          description="The words you can pick from when answering."
        >
          <StringList
            values={settings.emotionOptions}
            onChange={(v) => patch("emotionOptions", v)}
            placeholder="Calm"
          />
        </Block>
      </div>

      <Block
        title="Tag categories"
        description="Each category becomes a dropdown on the entry form and a report on the analytics page."
      >
        <div className="space-y-3">
          {settings.tagCategories.map((category, index) => (
            <div
              key={category.id}
              className="rounded-lg border border-sky-500/20 p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={category.name}
                  onChange={(e) => {
                    const next = [...settings.tagCategories];
                    next[index] = { ...category, name: e.target.value };
                    patch("tagCategories", next);
                  }}
                  placeholder="Category name"
                  className="field flex-1 font-medium"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch(
                      "tagCategories",
                      settings.tagCategories.filter((c) => c.id !== category.id),
                    )
                  }
                  className="shrink-0 rounded-lg border border-sky-500/30 px-2.5 py-2 text-xs text-slate-400 hover:border-rose-500/50 hover:text-rose-300"
                >
                  Remove category
                </button>
              </div>
              <StringList
                values={category.options}
                onChange={(options) => {
                  const next = [...settings.tagCategories];
                  next[index] = { ...category, options };
                  patch("tagCategories", next);
                }}
                placeholder="Add an option"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              patch("tagCategories", [
                ...settings.tagCategories,
                { id: makeId("tag"), name: "", options: [] } as TagCategory,
              ])
            }
            className="rounded-lg border border-dashed border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:border-sky-400/50 hover:bg-sky-400/20 hover:text-sky-200"
          >
            Add tag category
          </button>
        </div>
      </Block>

      <Block
        title="Analysis parameters"
        description="The review page ranks patterns purely by what they cost in your own data. These control how it measures, not what it concludes."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Minimum sample size"
            hint="Slices with fewer trades are shown but flagged as thin."
            value={settings.minSampleSize}
            onChange={(v) => patch("minSampleSize", v)}
          />
          <NumberField
            label="Cascade window (minutes)"
            hint="A re-entry inside this window after a losing exit counts as a cascade."
            value={settings.cascadeWindowMinutes}
            onChange={(v) => patch("cascadeWindowMinutes", v)}
          />
          <NumberField
            label="Drift window (trades)"
            hint="Recent trades compared against everything before them."
            value={settings.driftWindow}
            onChange={(v) => patch("driftWindow", v)}
          />
          <NumberField
            label="Baseline window (days)"
            hint="Each week is compared against your rolling average over this many days."
            value={settings.baselineDays}
            onChange={(v) => patch("baselineDays", v)}
          />
          <NumberField
            label="Baseline deviation flag (%)"
            hint="A weekly metric this far from baseline is flagged as off-normal."
            value={settings.baselineDeviationPct}
            onChange={(v) => patch("baselineDeviationPct", v)}
          />
          <NumberField
            label="Off-plan threshold (%)"
            hint="Above this share of off-plan trades, the week is flagged as a discipline problem."
            value={settings.offPlanThresholdPct}
            onChange={(v) => patch("offPlanThresholdPct", v)}
          />
        </div>
      </Block>

      <DangerZone tradeCount={tradeCount} />

      <div className="fixed bottom-0 left-0 right-0 border-t border-sky-500/20 bg-slate-950/95 px-5 py-3 backdrop-blur lg:left-56">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {saved
              ? "Settings saved. Existing trades keep the grade they earned when saved."
              : "Changes apply to new entries. Saved trades keep their original grade and score."}
          </p>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DangerZone({ tradeCount }: { tradeCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  async function wipe() {
    setWorking(true);
    await fetch("/api/trades", { method: "DELETE" });
    setWorking(false);
    setConfirming(false);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-5">
      <h2 className="text-sm font-semibold text-rose-300">Danger zone</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Permanently deletes every trade in the journal. Your settings and wiki pages stay.
      </p>
      <div className="mt-3 flex items-center gap-2">
        {confirming ? (
          <>
            <button
              onClick={wipe}
              disabled={working}
              className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-400 disabled:opacity-50"
            >
              {working ? "Deleting..." : `Yes, delete all ${tradeCount} trades`}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={tradeCount === 0}
            className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
          >
            {tradeCount === 0 ? "No trades to delete" : "Delete all trades"}
          </button>
        )}
      </div>
    </section>
  );
}

function Block({
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
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <span className="label mb-1.5">{label}</span>
      <input
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="field"
      />
      <p className="mt-1 text-xs text-slate-600">{hint}</p>
    </div>
  );
}

function StringList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [entry, setEntry] = useState("");

  const add = () => {
    const value = entry.trim();
    if (!value || values.includes(value)) {
      setEntry("");
      return;
    }
    onChange([...values, value]);
    setEntry("");
  };

  return (
    <div>
      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/20 py-1 pl-2.5 pr-1.5 text-sm text-sky-200 ring-1 ring-sky-500/30"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                className="text-slate-500 hover:text-rose-300"
                aria-label={`Remove ${value}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-xs text-slate-600">Nothing here yet.</p>
      )}
      <div className="flex gap-2">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="field flex-1"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-lg border border-sky-500/30 px-3 text-sm text-slate-300 hover:bg-sky-400/20 hover:border-sky-400/50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ItemList({
  items,
  onChange,
  idPrefix,
  placeholder,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  idPrefix: string;
  placeholder: string;
}) {
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-xs text-slate-600">
            {index + 1}
          </span>
          <input
            value={item.label}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, label: e.target.value };
              onChange(next);
            }}
            placeholder={placeholder}
            className="field flex-1"
          />
          <div className="flex shrink-0 gap-1">
            <IconButton label="Move up" onClick={() => move(index, -1)}>
              &uarr;
            </IconButton>
            <IconButton label="Move down" onClick={() => move(index, 1)}>
              &darr;
            </IconButton>
            <IconButton
              label="Remove"
              danger
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
            >
              &times;
            </IconButton>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { id: makeId(idPrefix), label: "" }])}
        className="rounded-lg border border-dashed border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:border-sky-400/50 hover:bg-sky-400/20 hover:text-sky-200"
      >
        Add item
      </button>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-8 items-center justify-center rounded-lg border border-sky-500/30 text-slate-400 hover:border-sky-400/50 ${
        danger ? "hover:border-rose-500/50 hover:text-rose-300" : "hover:text-sky-200"
      }`}
    >
      {children}
    </button>
  );
}
