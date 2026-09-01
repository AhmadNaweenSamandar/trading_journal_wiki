import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteTradeButton } from "@/components/DeleteTradeButton";
import { RiskMeter } from "@/components/TradeForm";
import {
  DirectionBadge,
  GradeBadge,
  Meter,
  PageHeader,
  Panel,
  StatCard,
  Tag,
} from "@/components/ui";
import { getSettings, getTrade } from "@/lib/db";
import {
  currency,
  duration,
  holdLabel,
  percent,
  rValue,
  stamp,
  tone,
} from "@/lib/format";
import {
  dayOf,
  holdMinutes,
  margin,
  netPnl,
  planCapture,
  positionValue,
  returnOnMargin,
  riskDiscipline,
  rMultiple,
} from "@/lib/metrics";
import { GRADE_DESCRIPTIONS, RISK_EMOTIONS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trade, settings] = await Promise.all([getTrade(id), getSettings()]);
  if (!trade) notFound();

  const pnl = netPnl(trade);
  const r = rMultiple(trade);
  const discipline = riskDiscipline(trade);
  const used = margin(trade);
  const capture = planCapture(trade);
  const rom = returnOnMargin(trade);

  const shots = [
    { label: "Exit — 1 minute", url: trade.screenshots.exit1m },
    { label: "Exit — 15 minute", url: trade.screenshots.exit15m },
  ].filter((s) => s.url);

  const tagList = settings.tagCategories
    .map((category) => ({ name: category.name, value: trade.tags[category.id] }))
    .filter((t) => t.value);

  return (
    <>
      <PageHeader
        title={`Trade #${trade.seq} · ${trade.coin} · ${trade.strategy}`}
        subtitle={`${dayOf(trade)} · ${stamp(trade.entryAt)} → ${stamp(trade.exitAt)} · ${trade.timeframe}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/trades/${trade.id}/edit`}
              className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-300 hover:bg-sky-400/20 hover:border-sky-400/50"
            >
              Edit
            </Link>
            <DeleteTradeButton id={trade.id} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Net P&L" value={currency(pnl)} valueClass={tone(pnl)} />
        <StatCard
          label="Final R"
          value={rValue(r)}
          valueClass={tone(r ?? 0)}
          hint={`Planned ${trade.plannedRr || "--"}`}
        />
        <StatCard
          label="Result"
          value={trade.outcome}
          valueClass={
            trade.outcome === "win"
              ? "text-emerald-400 capitalize"
              : trade.outcome === "loss"
                ? "text-rose-400 capitalize"
                : "capitalize"
          }
        />
        <StatCard
          label="Plan capture"
          value={capture == null ? "--" : percent(capture * 100, 0)}
          hint="Of the planned reward"
          valueClass={
            capture == null
              ? undefined
              : capture > 0.7
                ? "text-emerald-400"
                : "text-amber-400"
          }
        />
        <StatCard
          label="Return on margin"
          value={rom == null ? "--" : `${rom.toFixed(1)}%`}
          valueClass={tone(pnl)}
          hint={used == null ? undefined : `${currency(used)} committed`}
        />
        <StatCard
          label="Hold time"
          value={holdLabel(holdMinutes(trade))}
          hint={`Logged in ${duration(trade.entryDurationSeconds)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Context"
            description="The data points that explain why this trade happened."
          >
            <dl className="space-y-4">
              <Row label="Quality grade">
                <div className="flex items-start gap-3">
                  <GradeBadge grade={trade.grade} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-400">
                      {trade.qualityScore.toFixed(0)}% of the checklist ·{" "}
                      {GRADE_DESCRIPTIONS[trade.grade]}
                    </p>
                    <div className="mt-2">
                      <Meter
                        value={trade.qualityScore}
                        colorClass={
                          trade.grade === "A"
                            ? "bg-emerald-500"
                            : trade.grade === "B"
                              ? "bg-sky-500"
                              : "bg-amber-500"
                        }
                      />
                    </div>
                    {settings.qualityChecklist.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {settings.qualityChecklist.map((item) => (
                          <CheckLine
                            key={item.id}
                            label={item.label}
                            checked={trade.qualityChecks.includes(item.id)}
                          />
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </Row>

              <Row label="Rules">
                <div>
                  <p
                    className={`text-sm ${
                      trade.rulesFollowed ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {trade.ruleScore.toFixed(0)}% followed
                    {trade.rulesFollowed ? " — every rule held" : ""}
                  </p>
                  {settings.rulesChecklist.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {settings.rulesChecklist.map((item) => (
                        <CheckLine
                          key={item.id}
                          label={item.label}
                          checked={trade.ruleChecks.includes(item.id)}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Row>

              <Row label="Planned vs actual risk">
                <div className="w-full max-w-sm">
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span className="text-slate-400">
                      Planned{" "}
                      <span className="text-slate-200">
                        {trade.plannedRisk == null ? "--" : currency(trade.plannedRisk)}
                      </span>
                    </span>
                    <span className="text-slate-400">
                      Actual{" "}
                      <span
                        className={
                          discipline?.tone === "over"
                            ? "text-rose-300"
                            : discipline?.tone === "under"
                              ? "text-emerald-300"
                              : "text-slate-200"
                        }
                      >
                        {trade.actualRisk == null ? "--" : currency(trade.actualRisk)}
                      </span>
                    </span>
                  </div>
                  <RiskMeter discipline={discipline} />
                </div>
              </Row>

              <Row label="Trade reason">
                <span className="text-slate-300">{trade.tradeReason || "--"}</span>
              </Row>
              <Row label="Exit reason">
                <span className="text-slate-300">{trade.exitReason || "--"}</span>
              </Row>

              <Row label="Emotions">
                {settings.emotionQuestions.length === 0 ? (
                  <span className="text-slate-500">--</span>
                ) : (
                  <ul className="space-y-1.5">
                    {settings.emotionQuestions.map((question) => {
                      const answer = trade.emotions[question.id];
                      return (
                        <li
                          key={question.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="text-sm text-slate-400">
                            {question.label}
                          </span>
                          {answer ? (
                            <span
                              className={`rounded-md px-2 py-0.5 text-sm ring-1 ${
                                RISK_EMOTIONS.has(answer)
                                  ? "bg-rose-500/10 text-rose-300 ring-rose-500/25"
                                  : "bg-sky-500/20 text-sky-200 ring-sky-500/30"
                              }`}
                            >
                              {answer}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-600">Not recorded</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Row>

              <Row label="Lesson">
                <span className="text-slate-300">{trade.lesson || "--"}</span>
              </Row>
            </dl>
          </Panel>

          {shots.length > 0 ? (
            <Panel
              title="Exit screenshots"
              description="Click a chart to open it full size with zoom."
            >
              <div className="space-y-4">
                {shots.map((shot) => {
                  const slot = shot.label.includes("1 minute") ? "exit1m" : "exit15m";
                  return (
                    <figure key={shot.label}>
                      <figcaption className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                        <span>{shot.label}</span>
                        <Link
                          href={`/trades/${trade.id}/shot/${slot}`}
                          className="text-sky-400 hover:text-sky-300"
                        >
                          Open full size
                        </Link>
                      </figcaption>
                      <Link
                        href={`/trades/${trade.id}/shot/${slot}`}
                        className="block overflow-hidden rounded-lg border border-sky-500/20"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shot.url}
                          alt={shot.label}
                          className="w-full object-contain"
                        />
                      </Link>
                    </figure>
                  );
                })}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Mechanical" description="What happened.">
            <dl className="space-y-2 text-sm">
              <Line label="Trade #">#{trade.seq}</Line>
              <Line label="Direction">
                <DirectionBadge direction={trade.direction} />
              </Line>
              <Line label="Day">{dayOf(trade)}</Line>
              <Line label="Entry">{stamp(trade.entryAt)}</Line>
              <Line label="Exit">{stamp(trade.exitAt)}</Line>
              <Line label="Coin">{trade.coin}</Line>
              <Line label="Quantity">{trade.quantity}</Line>
              <Line label="Entry price">{trade.entryPrice}</Line>
              <Line label="Exit price">{trade.exitPrice}</Line>
              <Line label="Position value">{currency(positionValue(trade))}</Line>
              <Line label="Leverage">{trade.leverage}x</Line>
              <Line label="Margin used">{used == null ? "--" : currency(used)}</Line>
              <Line label="Trading fee">{currency(trade.tradingFee)}</Line>
              <Line label="Timeframe">{trade.timeframe}</Line>
              <Line label="Planned R:R">{trade.plannedRr || "--"}</Line>
              <Line label="Final R">{rValue(r)}</Line>
              <Line label="Net P&L">
                <span className={tone(pnl)}>{currency(pnl)}</span>
              </Line>
            </dl>
          </Panel>

          {tagList.length > 0 || trade.customTags.length > 0 ? (
            <Panel title="Tags" description="How this trade slices.">
              <div className="flex flex-wrap gap-1.5">
                {tagList.map((tag) => (
                  <Tag key={tag.name}>
                    <span className="text-slate-600">{tag.name}:</span>
                    <span className="ml-1">{tag.value}</span>
                  </Tag>
                ))}
                {trade.customTags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </Panel>
          ) : null}

          <div
            className={`card p-4 text-sm ${
              trade.rulesFollowed ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {trade.rulesFollowed
              ? "Execution matched the plan on every rule."
              : "Rules broke on this trade. Filter the journal by broken rules to see what the pattern costs you."}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-sky-500/20 pb-3 last:border-0 last:pb-0">
      <dt className="label mb-1.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="truncate font-mono text-slate-200">{children}</dd>
    </div>
  );
}

function CheckLine({ label, checked }: { label: string; checked: boolean }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
          checked
            ? "border-emerald-500 bg-emerald-500 text-slate-950"
            : "border-sky-500/30 text-transparent"
        }`}
      >
        {checked ? "\u2713" : ""}
      </span>
      <span className={checked ? "text-slate-300" : "text-slate-600 line-through"}>
        {label}
      </span>
    </li>
  );
}
