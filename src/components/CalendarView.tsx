"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Donut } from "@/components/circles";
import { Panel } from "@/components/ui";
import { currency, roundMoney, tone } from "@/lib/format";
import { byDay, dateOf, netPnl, type DayBucket } from "@/lib/metrics";
import type { Trade } from "@/lib/types";

const DAY_LABELS = ["Sat", "Mon", "Tue", "Wed", "Thu", "Fri", "Sun"];
const ALL_MONTHS = "all";

interface DayStat extends DayBucket {
  wins: number;
  losses: number;
  winRate: number;
}

function summarise(bucket: DayBucket): DayStat {
  const wins = bucket.trades.filter((t) => netPnl(t) > 0).length;
  const losses = bucket.trades.filter((t) => netPnl(t) < 0).length;
  const decided = wins + losses;
  return {
    ...bucket,
    wins,
    losses,
    winRate: decided ? (wins / decided) * 100 : 0,
  };
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Saturday on the left, Sunday on the right, weekdays in between. */
function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (day === 6) return 0;
  if (day === 0) return 6;
  return day;
}

function utcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(date: string, days: number): string {
  const next = utcDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return isoDay(next);
}

/** Saturday that opens the week containing this date. */
function saturdayOf(date: string): string {
  const day = utcDate(date).getUTCDay();
  const daysSinceSaturday = (day + 1) % 7;
  return addUtcDays(date, -daysSinceSaturday);
}

function daysInMonth(key: string): string[] {
  const [year, month] = key.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`,
  );
}

type MonthWeek = {
  slots: Array<string | null>;
  /** Days that count toward this week's total. */
  sumDates: string[];
};

/**
 * One row per Saturday-start week. Slots follow Sat, Mon–Fri, Sun so a Friday
 * always sits under Friday — never the next sequential cell.
 *
 * Week 1 of a month that starts mid-week also totals the leftover days from
 * the previous month (they belong to this Sat–Sun week). The previous month
 * keeps those days in its own last week and does not pick up the new month.
 */
function monthWeeks(cells: string[]): MonthWeek[] {
  const inMonth = new Set(cells);
  const weeks: MonthWeek[] = [];
  const first = cells[0];
  const last = cells[cells.length - 1];
  if (!first || !last) return weeks;

  for (let saturday = saturdayOf(first); saturday <= last; saturday = addUtcDays(saturday, 7)) {
    const sequential = [0, 1, 2, 3, 4, 5, 6].map((offset) => addUtcDays(saturday, offset));
    const [sat, sun, mon, tue, wed, thu, fri] = sequential;
    const slots = [sat, mon, tue, wed, thu, fri, sun].map((date) =>
      inMonth.has(date) ? date : null,
    );
    const carriesPriorMonth = saturday < first;
    weeks.push({
      slots,
      sumDates: carriesPriorMonth
        ? sequential
        : sequential.filter((date) => inMonth.has(date)),
    });
  }
  return weeks;
}

export function CalendarView({ trades }: { trades: Trade[] }) {
  const months = useMemo(
    () =>
      [...new Set(trades.map((t) => dateOf(t).slice(0, 7)))]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a)),
    [trades],
  );

  const [month, setMonth] = useState(months[0] ?? ALL_MONTHS);
  const [weekdays, setWeekdays] = useState<number[]>([]);

  const dayStats = useMemo(() => {
    const map = new Map<string, DayStat>();
    for (const [date, bucket] of byDay(trades)) map.set(date, summarise(bucket));
    return map;
  }, [trades]);

  const weekdayActive = useCallback(
    (date: string) => weekdays.length === 0 || weekdays.includes(weekdayIndex(date)),
    [weekdays],
  );

  const visibleMonths = month === ALL_MONTHS ? months : [month];

  // Every day in view that passes the weekday filter.
  const scoped = useMemo(
    () =>
      [...dayStats.values()].filter(
        (day) =>
          (month === ALL_MONTHS || day.date.startsWith(month)) && weekdayActive(day.date),
      ),
    [dayStats, month, weekdayActive],
  );

  const scopedPnl = scoped.reduce((sum, day) => sum + day.pnl, 0);
  const scopedTrades = scoped.reduce((sum, day) => sum + day.count, 0);
  const scopedWins = scoped.reduce((sum, day) => sum + day.wins, 0);
  const scopedLosses = scoped.reduce((sum, day) => sum + day.losses, 0);
  const scopedWinRate = scopedWins + scopedLosses
    ? (scopedWins / (scopedWins + scopedLosses)) * 100
    : 0;
  const green = scoped.filter((d) => d.pnl > 0).length;
  const red = scoped.filter((d) => d.pnl < 0).length;

  const toggleWeekday = (index: number) =>
    setWeekdays((prev) =>
      prev.includes(index) ? prev.filter((v) => v !== index) : [...prev, index],
    );

  const monthIndex = months.indexOf(month);
  const step = (delta: number) => {
    const next = months[monthIndex + delta];
    if (next) setMonth(next);
  };

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Summary
          label={month === ALL_MONTHS ? "Net P&L (all)" : "Net P&L this month"}
          value={currency(scopedPnl)}
          className={tone(scopedPnl)}
        />
        <Summary label="Trades" value={String(scopedTrades)} className="text-slate-100" />
        <Summary
          label="Win rate"
          value={scopedTrades ? `${scopedWinRate.toFixed(0)}%` : "--"}
          className="text-slate-100"
        />
        <Summary label="Green days" value={String(green)} className="text-emerald-400" />
        <Summary label="Red days" value={String(red)} className="text-rose-400" />
      </div>

      <div className="space-y-4">
        {visibleMonths.map((key, monthIdx) => {
          const cells = daysInMonth(key);
          const weeks = monthWeeks(cells);
          const active = cells.filter((d) => dayStats.has(d) && weekdayActive(d));
          const monthPnl = active.reduce(
            (sum, date) => sum + (dayStats.get(date)?.pnl ?? 0),
            0,
          );
          const monthTrades = active.reduce(
            (sum, date) => sum + (dayStats.get(date)?.count ?? 0),
            0,
          );
          const monthDays = active
            .map((date) => dayStats.get(date))
            .filter((day): day is DayStat => Boolean(day));
          const monthBest =
            [...monthDays].sort((a, b) => b.pnl - a.pnl).find((d) => d.pnl > 0) ?? null;
          const monthWorst =
            [...monthDays].sort((a, b) => a.pnl - b.pnl).find((d) => d.pnl < 0) ?? null;
          const showFilter = monthIdx === 0;

          return (
            <Panel
              key={key}
              title={monthLabel(key)}
              description={`${active.length} trading days · ${monthTrades} trades`}
              action={
                <span className={`text-sm font-semibold ${tone(monthPnl)}`}>
                  {currency(monthPnl)}
                </span>
              }
            >
              {showFilter ? (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/10 p-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => step(1)}
                      disabled={month === ALL_MONTHS || monthIndex >= months.length - 1}
                      className="rounded-lg border border-sky-500/30 px-2.5 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200 disabled:opacity-30"
                      aria-label="Previous month"
                    >
                      &#8249;
                    </button>
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="field w-auto"
                    >
                      <option value={ALL_MONTHS}>All months</option>
                      {months.map((option) => (
                        <option key={option} value={option}>
                          {monthLabel(option)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => step(-1)}
                      disabled={month === ALL_MONTHS || monthIndex <= 0}
                      className="rounded-lg border border-sky-500/30 px-2.5 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200 disabled:opacity-30"
                      aria-label="Next month"
                    >
                      &#8250;
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-600">Days</span>
                    {DAY_LABELS.map((label, index) => {
                      const on = weekdays.includes(index);
                      return (
                        <button
                          key={label}
                          onClick={() => toggleWeekday(index)}
                          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                            on
                              ? "bg-sky-500 text-slate-950"
                              : "bg-sky-500/25 text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {weekdays.length ? (
                      <button
                        onClick={() => setWeekdays([])}
                        className="px-1.5 text-xs text-slate-500 hover:bg-sky-400/20 hover:text-sky-200"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-0">
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_LABELS.map((label) => (
                      <div
                        key={label}
                        className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-slate-600"
                      >
                        {label}
                      </div>
                    ))}
                    {weeks.flatMap((week, weekIndex) =>
                      week.slots.map((date, column) => {
                        if (!date) {
                          return (
                            <div
                              key={`pad-${weekIndex}-${column}`}
                              className="min-h-[84px]"
                            />
                          );
                        }

                        const day = dayStats.get(date);
                        const dayNumber = Number(date.slice(-2));
                        const dimmed = !weekdayActive(date);

                        if (!day || dimmed) {
                          return (
                            <div
                              key={date}
                              className={`min-h-[84px] rounded-lg border border-sky-500/15 bg-sky-500/5 p-1.5 text-[11px] ${
                                dimmed && day ? "text-slate-700 opacity-40" : "text-slate-700"
                              }`}
                            >
                              {dayNumber}
                            </div>
                          );
                        }

                        const positive = day.pnl > 0;
                        const flat = day.pnl === 0;
                        return (
                          <Link
                            key={date}
                            href={`/trades?q=${date}`}
                            title={`${date} · ${day.count} trades · ${day.wins}W/${day.losses}L · ${currency(day.pnl)}`}
                            className={`flex min-h-[84px] flex-col justify-between rounded-lg border p-1.5 ${
                              flat
                                ? "border-sky-500/30 bg-sky-500/10"
                                : positive
                                  ? "border-emerald-500/30 bg-emerald-500/10"
                                  : "border-rose-500/30 bg-rose-500/10"
                            }`}
                          >
                            <span className="text-[11px] text-slate-400">{dayNumber}</span>
                            <span
                              className={`text-[12px] font-semibold leading-tight ${tone(day.pnl)}`}
                            >
                              {currency(day.pnl)}
                            </span>
                            <span className="flex items-baseline justify-between text-[10px] leading-tight">
                              <span className="text-slate-500">
                                {day.count}
                                {day.count === 1 ? " trade" : " trades"}
                              </span>
                              <span
                                className={
                                  day.winRate >= 50 ? "text-emerald-400/80" : "text-rose-400/80"
                                }
                              >
                                {day.winRate.toFixed(0)}%
                              </span>
                            </span>
                          </Link>
                        );
                      }),
                    )}
                  </div>
                </div>

                <div
                  className="mx-3 hidden w-px self-stretch bg-sky-500/35 sm:block"
                  aria-hidden
                />

                <div className="flex w-28 shrink-0 flex-col gap-1.5 sm:w-36">
                  <div className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-sky-400">
                    Weeks
                  </div>
                  {weeks.map((week, index) => {
                    const traded = week.sumDates.filter(
                      (date) => dayStats.has(date) && weekdayActive(date),
                    );
                    const weekPnl = traded.reduce(
                      (sum, date) =>
                        sum + roundMoney(dayStats.get(date)?.pnl ?? 0),
                      0,
                    );
                    return (
                      <div
                        key={`${key}-w${index}`}
                        className="flex min-h-[84px] flex-1 flex-col justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 p-2"
                      >
                        <p className="text-[11px] font-medium text-sky-300">
                          Week {index + 1}
                        </p>
                        <p className={`text-sm font-semibold ${tone(weekPnl)}`}>
                          {currency(weekPnl)}
                        </p>
                        <p className="text-[10px] text-sky-400/80">
                          {traded.length}
                          {traded.length === 1 ? " day" : " days"} traded
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 overflow-hidden rounded-lg border border-sky-500/20 sm:grid-cols-2 sm:divide-x sm:divide-sky-500/20">
                  <BestWorstSide
                    title="Best day of the month"
                    day={monthBest}
                    empty="No green days this month."
                  />
                  <BestWorstSide
                    title="Worst day of the month"
                    day={monthWorst}
                    empty="No red days this month."
                  />
                </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}

function BestWorstSide({
  title,
  day,
  empty,
}: {
  title: string;
  day: DayStat | null;
  empty: string;
}) {
  return (
    <div className="p-4">
      <p className="label mb-3">{title}</p>
      {!day ? (
        <p className="py-4 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <Link
          href={`/trades?q=${day.date}`}
          className="flex items-center gap-3 rounded-lg"
        >
          <Donut
            size={88}
            thickness={10}
            segments={[
              { label: "Wins", value: day.wins, color: "#10b981" },
              { label: "Losses", value: day.losses, color: "#f43f5e" },
            ]}
            centerValue={`${day.winRate.toFixed(0)}%`}
            centerLabel="win"
            centerClass={day.winRate >= 50 ? "text-emerald-400" : "text-rose-400"}
          />
          <div className="min-w-0">
            <p className={`text-lg font-semibold ${tone(day.pnl)}`}>
              {currency(day.pnl)}
            </p>
            <p className="text-sm text-slate-400">{day.date}</p>
            <p className="text-xs text-slate-500">
              {day.count}
              {day.count === 1 ? " trade" : " trades"} · {day.wins}W/{day.losses}L
            </p>
          </div>
        </Link>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${className}`}>{value}</p>
    </div>
  );
}
