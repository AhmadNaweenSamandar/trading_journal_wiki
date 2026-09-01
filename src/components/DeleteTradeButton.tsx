"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteTradeButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const response = await fetch(`/api/trades/${id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/trades");
      router.refresh();
      return;
    }
    setDeleting(false);
    setConfirming(false);
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:border-rose-500/50 hover:text-rose-300"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={remove}
        disabled={deleting}
        className="rounded-lg bg-rose-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Confirm delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
      >
        Cancel
      </button>
    </span>
  );
}
