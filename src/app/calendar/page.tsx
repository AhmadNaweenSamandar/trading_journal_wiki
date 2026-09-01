import { CalendarView } from "@/components/CalendarView";
import { EmptyState, PageHeader } from "@/components/ui";
import { getTrades } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const trades = await getTrades();

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="P&L calendar" />
        <EmptyState
          title="No days to show yet"
          body="The calendar highlights your red and green days so daily patterns become obvious at a glance."
          cta={{ href: "/trades/new", label: "Log a trade" }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="P&L calendar"
        subtitle="Daily patterns are hard to see in a table and obvious on a calendar. Each square shows net P&L, trade count and win rate."
      />
      <CalendarView trades={trades} />
    </>
  );
}
