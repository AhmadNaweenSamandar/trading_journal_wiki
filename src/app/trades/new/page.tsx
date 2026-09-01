import Link from "next/link";

import { TradeForm } from "@/components/TradeForm";
import { PageHeader } from "@/components/ui";
import { getSettings, getTrades, nextSeq } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewTradePage() {
  const [settings, trades] = await Promise.all([getSettings(), getTrades()]);

  return (
    <>
      <PageHeader
        title={`New journal entry · trade #${nextSeq(trades)}`}
        subtitle="Two layers: the mechanical record and the context behind it. Under five minutes."
        action={
          <Link
            href="/settings"
            className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
          >
            Edit checklists
          </Link>
        }
      />
      <TradeForm settings={settings} allTrades={trades} />
    </>
  );
}
