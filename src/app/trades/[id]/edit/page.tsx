import { notFound } from "next/navigation";

import { TradeForm } from "@/components/TradeForm";
import { PageHeader } from "@/components/ui";
import { getSettings, getTrade, getTrades } from "@/lib/db";
import { stamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trade, settings, trades] = await Promise.all([
    getTrade(id),
    getSettings(),
    getTrades(),
  ]);
  if (!trade) notFound();

  return (
    <>
      <PageHeader
        title={`Edit trade #${trade.seq} · ${trade.coin}`}
        subtitle={`${trade.strategy} · ${stamp(trade.entryAt)}`}
      />
      <TradeForm initial={trade} settings={settings} allTrades={trades} />
    </>
  );
}
