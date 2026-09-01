"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ImportDialog } from "@/components/ImportDialog";
import { IMPORT_DRAFT_KEY } from "@/lib/spreadsheet";
import { emptyTradeDraft } from "@/lib/taxonomy";
import type { Settings } from "@/lib/types";

export function SpreadsheetImportButton({
  settings,
  className,
}: {
  settings: Settings;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-lg border border-sky-500/30 px-4 py-2 text-sm text-slate-300 hover:border-sky-500/50 hover:bg-sky-400/20 hover:text-sky-300"
        }
      >
        Upload spreadsheet
      </button>
      {open ? (
        <ImportDialog
          settings={settings}
          baseDraft={emptyTradeDraft(settings)}
          onLoadRow={(draft) => {
            sessionStorage.setItem(IMPORT_DRAFT_KEY, JSON.stringify(draft));
            router.push("/trades/new");
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
