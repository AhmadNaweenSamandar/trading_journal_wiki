"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  applyRow,
  detectSheet,
  downloadTemplate,
  isBlankImportRow,
  rowLabel,
  SPREADSHEET_ACCEPT,
  type DetectedSheet,
  type MechanicalKey,
} from "@/lib/spreadsheet";
import type { Settings, TradeDraft } from "@/lib/types";

const FIELD_LABELS: Record<MechanicalKey, string> = {
  direction: "Direction",
  coin: "Coin",
  entryAt: "Entry timestamp",
  exitAt: "Exit timestamp",
  quantity: "Quantity",
  entryPrice: "Entry price",
  exitPrice: "Exit price",
  tradingFee: "Total fee",
  leverage: "Leverage",
  timeframe: "Timeframe",
  strategy: "Strategy",
  plannedRr: "Planned R:R",
  plannedRisk: "Planned risk",
  actualRisk: "Actual risk",
  realizedR: "Net R",
  realizedPnl: "Realized P&L",
  outcome: "Result",
  outcomeWin: "Win",
  outcomeLoss: "Loss",
  outcomeBe: "Breakeven",
};

export function ImportDialog({
  settings,
  baseDraft,
  onLoadRow,
  onClose,
}: {
  settings: Settings;
  baseDraft: TradeDraft;
  onLoadRow: (draft: TradeDraft) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<DetectedSheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function readFile(file: File) {
    setError("");
    setResult("");
    setFileName(file.name);
    try {
      const detected = detectSheet(await file.arrayBuffer(), file.name);
      if (!detected) {
        setError(
          "Could not find a trade table in that file. The importer looks for a header row with at least two columns that match the mechanical layer. Unmatched columns are skipped, not rejected.",
        );
        setSheet(null);
        return;
      }
      setSheet(detected);
    } catch {
      setError("That file could not be read as a spreadsheet.");
      setSheet(null);
    }
  }

  function loadRow(index: number) {
    if (!sheet) return;
    onLoadRow(applyRow(baseDraft, sheet.rows[index], settings));
    onClose();
  }

  async function importAll() {
    if (!sheet) return;
    setBusy(true);
    setError("");
    const payload = sheet.rows
      .filter((row) => !isBlankImportRow(row))
      .map((row) => applyRow(baseDraft, row, settings));
    const response = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    const skippedNotes = Array.isArray(body.errors)
      ? (body.errors as string[]).slice(0, 8).join(" ")
      : "";

    if (!response.ok) {
      setError(
        skippedNotes ||
          (body.errors ?? ["Import failed."]).slice?.(0, 5).join(" ") ||
          "Import failed.",
      );
      return;
    }
    setResult(
      `Imported ${body.imported} trades${body.skipped ? `, skipped ${body.skipped}` : ""}.`,
    );
    if (skippedNotes) setError(skippedNotes);
    router.refresh();
  }

  const matched = sheet
    ? (Object.keys(sheet.columns) as MechanicalKey[])
    : ([] as MechanicalKey[]);
  const skipped = sheet
    ? [...sheet.ignoredHeaders, ...sheet.unmatchedHeaders]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="card my-8 w-full max-w-3xl p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Upload a spreadsheet
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Excel, CSV, ODS and related workbook files are all accepted. Columns
              that match the mechanical layer are filled; everything else — files,
              images, broker, ID, day, margin, unrealized P&amp;L — is skipped and
              left empty. If both a trading fee and a total fee exist, only the
              total is used.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg border border-sky-500/30 px-3 py-1.5 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => input.current?.click()}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Choose file
          </button>
          <button
            onClick={downloadTemplate}
            className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
          >
            Download template
          </button>
          {fileName ? (
            <span className="text-xs text-slate-500">{fileName}</span>
          ) : null}
          <input
            ref={input}
            type="file"
            accept={SPREADSHEET_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
        {result ? (
          <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {result}
          </p>
        ) : null}

        {sheet ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-sky-500/20 p-3">
              <p className="text-sm text-slate-300">
                Found <span className="font-semibold">{sheet.rows.length}</span> rows on
                sheet <span className="font-mono text-sky-300">{sheet.sheetName}</span>,
                header on row {sheet.headerRow}.
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-500">
                Mapped
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {matched.map((key) => (
                  <span
                    key={key}
                    className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-500/25"
                  >
                    {FIELD_LABELS[key]}
                  </span>
                ))}
              </div>
              {skipped.length > 0 ? (
                <>
                  <p className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
                    Skipped — left empty
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {skipped.map((header) => (
                      <span
                        key={header}
                        className="rounded-md bg-sky-500/25 px-2 py-0.5 text-xs text-slate-500"
                        title="Not a mechanical field, ignored"
                      >
                        {header}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-sky-500/20">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-sky-500/10">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-medium">Row</th>
                    {matched.slice(0, 6).map((key) => (
                      <th key={key} className="px-3 py-2 font-medium">
                        {FIELD_LABELS[key]}
                      </th>
                    ))}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-500/20">
                  {sheet.rows.slice(0, 100).map((row, index) => (
                    <tr key={index} className="hover:bg-sky-400/20">
                      <td className="px-3 py-2 text-slate-600">{index + 1}</td>
                      {matched.slice(0, 6).map((key) => (
                        <td key={key} className="px-3 py-2 text-slate-300">
                          {String(row[key] ?? "")}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => loadRow(index)}
                          className="rounded border border-sky-500/30 px-2 py-1 text-xs text-slate-300 hover:border-sky-500/50 hover:bg-sky-400/20 hover:text-sky-300"
                          title={rowLabel(row)}
                        >
                          Load into form
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Loading one row fills this entry form. Importing all creates{" "}
                {sheet.rows.length} trades from the columns that matched. Missing
                fields stay empty.
              </p>
              <button
                onClick={importAll}
                disabled={busy}
                className="rounded-lg border border-sky-500/50 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
              >
                {busy ? "Importing..." : `Import all ${sheet.rows.length} as trades`}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
