import { Ring } from "@/components/circles";
import { Panel } from "@/components/ui";
import { longDate } from "@/lib/format";
import type { ReadinessReport, ReadinessScore, ScoreBand } from "@/lib/health";

const BAND_COLOR: Record<ScoreBand, string> = {
  optimal: "#10b981",
  moderate: "#f59e0b",
  compromised: "#f43f5e",
};

const BAND_TEXT: Record<ScoreBand, string> = {
  optimal: "text-emerald-400",
  moderate: "text-amber-400",
  compromised: "text-rose-400",
};

const BAND_LABEL: Record<ScoreBand, string> = {
  optimal: "Optimal",
  moderate: "Moderate",
  compromised: "Compromised",
};

/** The 7am read-out: four scores, and the position size they permit. */
export function ReadinessReportView({ report }: { report: ReadinessReport }) {
  const { risk } = report;
  const riskColor = risk.lockout
    ? "#f43f5e"
    : risk.multiplier === 1
      ? "#10b981"
      : risk.multiplier >= 0.75
        ? "#38bdf8"
        : "#f59e0b";

  return (
    <>
      <section
        className={`rounded-xl border p-5 ${
          risk.lockout
            ? "border-rose-500/40 bg-rose-500/[0.05]"
            : risk.multiplier === 1
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : "border-amber-500/30 bg-amber-500/[0.04]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="label text-slate-400">Pre-market neuro-readiness</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-100">
              {longDate(report.date)}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Maximum risk today:{" "}
              <span
                className={
                  risk.lockout
                    ? "font-semibold text-rose-400"
                    : risk.multiplier === 1
                      ? "font-semibold text-emerald-400"
                      : "font-semibold text-amber-400"
                }
              >
                {risk.label}
              </span>
            </p>
            <ul className="mt-2 space-y-1">
              {risk.reasons.map((reason) => (
                <li key={reason} className="text-xs text-slate-400">
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center">
            <Ring
              size={104}
              value={risk.lockout ? 100 : risk.multiplier * 100}
              color={riskColor}
              centerValue={risk.lockout ? "0%" : `${Math.round(risk.multiplier * 100)}%`}
              centerLabel="of risk"
              centerClass={
                risk.lockout
                  ? "text-rose-400"
                  : risk.multiplier === 1
                    ? "text-emerald-400"
                    : "text-amber-400"
              }
            />
            {report.composite != null ? (
              <p className="mt-1 text-[11px] text-slate-500">
                Composite {Math.round(report.composite)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-sky-500/20 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          {report.scores.map((score) => (
            <ScoreCard key={score.key} score={score} />
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {report.scores.map((score) => (
          <Panel key={score.key} title={score.label} description={score.premise}>
            <div className="flex flex-wrap justify-around gap-3">
              {score.contributions.map((item) => {
                const band: ScoreBand =
                  item.score == null
                    ? "moderate"
                    : item.score >= 67
                      ? "optimal"
                      : item.score >= 50
                        ? "moderate"
                        : "compromised";
                return (
                  <div key={item.label} className="w-[88px] text-center">
                    <Ring
                      size={78}
                      thickness={8}
                      value={item.score ?? 0}
                      color={item.score == null ? "#38bdf8" : BAND_COLOR[band]}
                      centerValue={item.score == null ? "--" : String(Math.round(item.score))}
                      centerClass={item.score == null ? "text-slate-600" : BAND_TEXT[band]}
                    />
                    <p className="mt-1.5 text-[11px] leading-tight text-slate-300">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {Math.round(item.weight * 100)}% · {item.reading}
                    </p>
                  </div>
                );
              })}
            </div>

            {score.flags.length > 0 ? (
              <ul className="mt-3 space-y-1.5 border-t border-sky-500/20 pt-3">
                {score.flags.map((flag) => (
                  <li key={flag} className="text-xs text-amber-300/90">
                    {flag}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-3 border-t border-sky-500/20 pt-3 text-sm text-slate-300">
              {score.guidance}
            </p>
          </Panel>
        ))}
      </div>
    </>
  );
}

function ScoreCard({ score }: { score: ReadinessScore }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
      <Ring
        size={72}
        thickness={8}
        value={score.score ?? 0}
        color={score.score == null ? "#38bdf8" : BAND_COLOR[score.band]}
        centerValue={score.score == null ? "--" : String(Math.round(score.score))}
        centerClass={score.score == null ? "text-slate-600" : BAND_TEXT[score.band]}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{score.label}</p>
        <p
          className={`text-xs ${score.score == null ? "text-slate-600" : BAND_TEXT[score.band]}`}
        >
          {score.score == null ? "Not scored" : BAND_LABEL[score.band]}
        </p>
      </div>
    </div>
  );
}
