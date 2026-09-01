import { PremarketArchive } from "@/components/PremarketArchive";
import { PremarketDetail } from "@/components/PremarketDetail";
import { PremarketForm } from "@/components/PremarketForm";
import { PremarketSummaryCard } from "@/components/PremarketSummaryCard";
import { PageHeader } from "@/components/ui";
import { getPremarkets, getTrades } from "@/lib/db";
import { DEFAULT_CANDLE_LABELS, summarize, todayKey } from "@/lib/premarket";

export const dynamic = "force-dynamic";

export default async function PremarketPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const [{ date, month: monthParam }, records, trades] = await Promise.all([
    searchParams,
    getPremarkets(),
    getTrades(),
  ]);

  const today = todayKey();
  const todaysPlan = records.find((record) => record.date === today);
  const summary = todaysPlan ? summarize(todaysPlan, trades) : null;

  const previous = records.filter((record) => record.date !== today);
  const months = [...new Set(previous.map((record) => record.date.slice(0, 7)))];
  const selected = date
    ? previous.find((record) => record.date === date)
    : undefined;
  const month =
    monthParam && months.includes(monthParam)
      ? monthParam
      : selected?.date.slice(0, 7) ?? months[0] ?? "";
  const monthRecords = previous.filter((record) => record.date.startsWith(month));

  const candleLabels =
    records[0]?.candles.map((candle) => candle.label).filter(Boolean) ??
    DEFAULT_CANDLE_LABELS;

  return (
    <>
      <PageHeader
        title="Pre-market"
        subtitle="Write the plan before the session, not the story after it. One record per day."
      />

      {summary ? (
        <div className="mb-4">
          <PremarketSummaryCard summary={summary} />
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-sky-500/25 p-5 text-center">
          <p className="text-sm text-slate-400">No plan saved for today yet.</p>
          <p className="mt-1 text-xs text-slate-600">
            Fill in the form below and save. The summary appears here, and only for
            today.
          </p>
        </div>
      )}

      {!todaysPlan ? (
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-medium text-slate-300">
            New plan for today
          </h2>
          <PremarketForm candleLabels={candleLabels} />
        </div>
      ) : null}

      {selected ? (
        <div className="mb-4">
          <PremarketDetail record={selected} />
        </div>
      ) : null}

      {previous.length > 0 ? (
        <div className="mt-4">
          <PremarketArchive
            records={monthRecords}
            months={months}
            month={month}
            selectedDate={selected?.date}
          />
        </div>
      ) : null}
    </>
  );
}
