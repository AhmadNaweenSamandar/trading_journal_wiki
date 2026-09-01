"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { currency } from "@/lib/format";
import type { Finding } from "@/lib/patterns";

export function FocusPicker({
  weekStart,
  candidates,
  existing,
}: {
  weekStart: string;
  candidates: Finding[];
  existing: { statement: string; baselineImpact: number } | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(candidates[0]?.id ?? "");
  const [statement, setStatement] = useState("");
  const [saving, setSaving] = useState(false);

  const finding = candidates.find((c) => c.id === selected);

  async function save() {
    if (!finding && !statement.trim()) return;
    setSaving(true);
    await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart,
        findingId: finding?.id ?? "",
        statement:
          statement.trim() ||
          `${finding!.category} — ${finding!.subject}: ${finding!.headline}`,
        baselineImpact: finding?.impact ?? 0,
      }),
    });
    setSaving(false);
    setStatement("");
    router.refresh();
  }

  async function clear() {
    setSaving(true);
    await fetch(`/api/focus?week=${weekStart}`, { method: "DELETE" });
    setSaving(false);
    router.refresh();
  }

  if (existing) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
          <p className="text-sm text-slate-200">{existing.statement}</p>
          <p className="mt-1 text-xs text-slate-500">
            Measured at {currency(existing.baselineImpact)} when it was chosen.
          </p>
        </div>
        <button
          onClick={clear}
          disabled={saving}
          className="text-xs text-slate-500 hover:text-rose-300"
        >
          Remove this change
        </button>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No priced patterns yet. Log more trades and a ranked list will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="field"
      >
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {currency(candidate.impact)} · {candidate.category} — {candidate.subject}
          </option>
        ))}
      </select>

      {finding ? (
        <p className="text-xs text-slate-500">
          {finding.detail} · sample {finding.sample}
          {finding.actionable ? "" : " (below your sample-size floor)"}
        </p>
      ) : null}

      <input
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="Write the rule change in your own words (optional)"
        className="field"
      />

      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Commit this change for next week"}
      </button>
    </div>
  );
}
