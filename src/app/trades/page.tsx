import Link from "next/link";

import { SpreadsheetImportButton } from "@/components/SpreadsheetImportButton";
import { TradesTable } from "@/components/TradesTable";
import { EmptyState, PageHeader } from "@/components/ui";
import { getSettings, getTrades } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, trades, settings] = await Promise.all([
    searchParams,
    getTrades(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Trades"
        subtitle="Filter by any field to answer a specific question. The summary row recalculates for whatever slice you are looking at."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SpreadsheetImportButton settings={settings} />
            <Link
              href="/trades/new"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            >
              New entry
            </Link>
          </div>
        }
      />
      {trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          body="Your journal is empty. Log your first trade to start building the data set."
          cta={{ href: "/trades/new", label: "Log a trade" }}
        />
      ) : (
        <TradesTable
          key={q ?? ""}
          trades={trades}
          settings={settings}
          initialQuery={q ?? ""}
        />
      )}
    </>
  );
}
