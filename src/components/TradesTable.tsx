"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DirectionBadge, GradeBadge, Money } from "@/components/ui";
import { currency, percent, profitFactor, rValue, stamp, tone } from "@/lib/format";
import { computeStats, dayOf, margin, netPnl, positionValue, rMultiple } from "@/lib/metrics";
import { exportTrades } from "@/lib/spreadsheet";
import type { Settings, Trade } from "@/lib/types";

type SortKey = "seq" | "date" | "pnl" | "r";

/** Facet key -> selected value. An absent key means no filter on that facet. */
type Facets = Record<string, string>;

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function TradesTable({
  trades,
  settings,
  initialQuery = "",
}: {
  trades: Trade[];
  settings: Settings;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [facets, setFacets] = useState<Facets>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("seq");
  const [descending, setDescending] = useState(true);

  const groups = useMemo(
    () => [
      {
        key: "coin",
        label: "Coin",
        options: unique(trades.map((t) => t.coin)),
      },
      {
        key: "strategy",
        label: "Strategy",
        options: unique(trades.map((t) => t.strategy)).length
          ? unique(trades.map((t) => t.strategy))
          : settings.strategies,
      },
      { key: "grade", label: "Grade", options: ["A", "B", "C"] },
      { key: "outcome", label: "Result", options: ["win", "loss", "breakeven"] },
      { key: "rules", label: "Rules", options: ["Followed", "Broken"] },
      { key: "direction", label: "Direction", options: ["long", "short"] },
      {
        key: "timeframe",
        label: "Timeframe",
        options: unique(trades.map((t) => t.timeframe)).length
          ? unique(trades.map((t) => t.timeframe))
          : settings.timeframes,
      },
      {
        key: "emotion",
        label: "Emotion",
        options: unique(trades.flatMap((t) => Object.values(t.emotions))).length
          ? unique(trades.flatMap((t) => Object.values(t.emotions)))
          : settings.emotionOptions,
      },
    ],
    [trades, settings],
  );

  const activeFacets = Object.entries(facets).filter(([, value]) => value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = trades.filter((trade) => {
      for (const [key, value] of Object.entries(facets)) {
        if (!value) continue;
        if (key === "rules") {
          if (value === "Followed" && !trade.rulesFollowed) return false;
          if (value === "Broken" && trade.rulesFollowed) return false;
          continue;
        }
        if (key === "emotion") {
          if (!Object.values(trade.emotions).includes(value)) return false;
          continue;
        }
        if (String(trade[key as keyof Trade] ?? "") !== value) return false;
      }

      if (needle) {
        const haystack = [
          `#${trade.seq}`,
          trade.coin,
          trade.strategy,
          trade.tradeReason,
          trade.exitReason,
          trade.lesson,
          trade.timeframe,
          trade.entryAt,
          dayOf(trade),
          ...Object.values(trade.emotions),
          ...Object.values(trade.tags),
          ...trade.customTags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const direction = descending ? -1 : 1;
    return result.sort((a, b) => {
      if (sortKey === "pnl") return (netPnl(a) - netPnl(b)) * direction;
      if (sortKey === "r") return ((rMultiple(a) ?? 0) - (rMultiple(b) ?? 0)) * direction;
      if (sortKey === "date") return a.entryAt.localeCompare(b.entryAt) * direction;
      return (a.seq - b.seq) * direction;
    });
  }, [trades, query, facets, sortKey, descending]);

  const stats = computeStats(filtered);
  const filtersActive = query !== "" || activeFacets.length > 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDescending((d) => !d);
    else {
      setSortKey(key);
      setDescending(true);
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (descending ? " \u2193" : " \u2191") : "";

  const setFacet = (key: string, value: string) =>
    setFacets((prev) => {
      const next = { ...prev };
      if (!value || prev[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });

  const clearAll = () => {
    setQuery("");
    setFacets({});
  };

  return (
    <>
      <div className="card mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
              &#8981;
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trade #, coin, reason, lesson, tag..."
              className="field w-full pl-8"
            />
          </div>

          <button
            onClick={() => setPanelOpen((open) => !open)}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              panelOpen || activeFacets.length
                ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
                : "border-sky-500/30 text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
            }`}
          >
            Filters
            {activeFacets.length ? (
              <span className="ml-1.5 rounded bg-sky-500/25 px-1.5 text-xs">
                {activeFacets.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => exportTrades(filtered, settings)}
            disabled={filtered.length === 0}
            className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200 disabled:opacity-40"
            title={`Extract ${filtered.length} trades to Excel`}
          >
            Extract to Excel
          </button>
        </div>

        {activeFacets.length ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {activeFacets.map(([key, value]) => {
              const group = groups.find((g) => g.key === key);
              return (
                <button
                  key={key}
                  onClick={() => setFacet(key, "")}
                  className="group flex items-center gap-1.5 rounded-full bg-sky-500/10 py-1 pl-2.5 pr-2 text-xs text-sky-300 ring-1 ring-sky-500/25 hover:bg-sky-500/20"
                >
                  <span className="text-sky-500/70">{group?.label ?? key}</span>
                  <span className="font-medium capitalize">{value}</span>
                  <span className="text-sky-500/60 group-hover:text-sky-200">
                    &times;
                  </span>
                </button>
              );
            })}
            <button
              onClick={clearAll}
              className="px-1.5 text-xs text-slate-500 hover:bg-sky-400/20 hover:text-sky-200"
            >
              Clear all
            </button>
          </div>
        ) : null}

        {panelOpen ? (
          <div className="mt-3 space-y-2.5 border-t border-sky-500/20 pt-3">
            {groups
              .filter((group) => group.options.length > 0)
              .map((group) => (
                <div key={group.key} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-20 shrink-0 text-xs text-slate-600">
                    {group.label}
                  </span>
                  {group.options.map((option) => {
                    const selected = facets[group.key] === option;
                    return (
                      <button
                        key={option}
                        onClick={() => setFacet(group.key, option)}
                        className={`rounded-full px-2.5 py-1 text-xs capitalize transition-colors ${
                          selected
                            ? "bg-sky-500 text-slate-950"
                            : "bg-sky-500/25 text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-sky-500/20 pt-3 text-xs text-slate-500">
          <span>
            <span className="text-slate-300">{filtered.length}</span> trades
          </span>
          <span>
            Net <span className={tone(stats.netPnl)}>{currency(stats.netPnl)}</span>
          </span>
          <span>
            Win rate <span className="text-slate-300">{percent(stats.winRate)}</span>
          </span>
          <span>
            Profit factor{" "}
            <span className="text-slate-300">{profitFactor(stats.profitFactor)}</span>
          </span>
          <span>
            Expectancy{" "}
            <span className={tone(stats.expectancyR)}>{rValue(stats.expectancyR)}</span>
          </span>
          <span>
            Rule adherence{" "}
            <span className="text-slate-300">{percent(stats.ruleAdherence, 0)}</span>
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-sm text-slate-400">No trades match these filters.</p>
          {filtersActive ? (
            <button
              onClick={clearAll}
              className="mt-2 text-sm text-sky-400 hover:text-sky-300"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-sky-500/20 text-[11px] uppercase tracking-wider text-slate-500">
                  <Th className="w-16" onClick={() => toggleSort("seq")}>
                    #{sortIndicator("seq")}
                  </Th>
                  <Th onClick={() => toggleSort("date")}>Entry{sortIndicator("date")}</Th>
                  <Th>Day</Th>
                  <Th>Coin</Th>
                  <Th>Strategy</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Position</Th>
                  <Th className="text-right">Lev</Th>
                  <Th className="text-center">Grade</Th>
                  <Th>Rules</Th>
                  <Th className="text-right" onClick={() => toggleSort("r")}>
                    R{sortIndicator("r")}
                  </Th>
                  <Th className="text-right" onClick={() => toggleSort("pnl")}>
                    Net P&L{sortIndicator("pnl")}
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-500/20">
                {filtered.map((trade) => {
                  const used = margin(trade);
                  const pnl = netPnl(trade);
                  return (
                    <tr
                      key={trade.id}
                      className="transition-colors hover:bg-sky-400/20"
                    >
                      <Td>
                        <Link
                          href={`/trades/${trade.id}`}
                          className={`font-mono text-xs font-semibold ${
                            pnl > 0
                              ? "text-emerald-400"
                              : pnl < 0
                                ? "text-rose-400"
                                : "text-slate-500"
                          }`}
                          title={`Trade ${trade.seq} · ${trade.outcome}`}
                        >
                          #{trade.seq}
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/trades/${trade.id}`}
                          className="block text-slate-400"
                        >
                          {stamp(trade.entryAt)}
                        </Link>
                      </Td>
                      <Td className="text-slate-500">{dayOf(trade).slice(0, 3)}</Td>
                      <Td>
                        <Link
                          href={`/trades/${trade.id}`}
                          className="flex items-center gap-2"
                        >
                          <span className="font-medium text-slate-100">
                            {trade.coin}
                          </span>
                          <DirectionBadge direction={trade.direction} />
                        </Link>
                      </Td>
                      <Td className="max-w-[180px]">
                        <Link
                          href={`/trades/${trade.id}`}
                          className="block truncate text-slate-300"
                        >
                          {trade.strategy}
                        </Link>
                      </Td>
                      <Td className="text-right font-mono text-xs text-slate-400">
                        {trade.quantity}
                      </Td>
                      <Td className="text-right text-slate-400">
                        {currency(positionValue(trade))}
                        {used != null ? (
                          <span className="block text-[11px] text-slate-600">
                            margin {currency(used)}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="text-right text-slate-400">{trade.leverage}x</Td>
                      <Td className="text-center">
                        <GradeBadge grade={trade.grade} />
                      </Td>
                      <Td>
                        <span
                          className={
                            trade.rulesFollowed ? "text-emerald-400" : "text-rose-400"
                          }
                        >
                          {trade.rulesFollowed
                            ? "Followed"
                            : `${trade.ruleScore.toFixed(0)}%`}
                        </span>
                      </Td>
                      <Td className={`text-right ${tone(rMultiple(trade) ?? 0)}`}>
                        {rValue(rMultiple(trade))}
                      </Td>
                      <Td className="text-right font-medium">
                        <Money value={pnl} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Th({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2.5 font-medium ${onClick ? "cursor-pointer select-none hover:bg-sky-400/20 hover:text-sky-200" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
