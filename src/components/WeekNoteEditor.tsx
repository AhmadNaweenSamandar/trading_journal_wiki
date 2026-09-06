"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WeekNoteEditor({
  weekStart,
  initial,
}: {
  weekStart: string;
  initial: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/week-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, body }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
        rows={10}
        placeholder="What mattered this week? What you will carry into the next one — in your own words."
        className="field min-h-48 resize-y"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {saved
            ? "Saved. Next week's review will open with this as last week's key summary."
            : "This stays with the week you are reviewing and appears at the top of the following week."}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : initial ? "Update notes" : "Save notes"}
        </button>
      </div>
    </div>
  );
}
