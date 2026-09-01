import type { ScorePoint } from "@/lib/health";

const SERIES = [
  { key: "decision" as const, label: "Decision", color: "#38bdf8" },
  { key: "focus" as const, label: "Focus", color: "#a78bfa" },
  { key: "discipline" as const, label: "Discipline", color: "#f59e0b" },
  { key: "confidence" as const, label: "Confidence", color: "#10b981" },
];

const W = 640;
const H = 180;
const PAD = { top: 12, right: 10, bottom: 24, left: 28 };

export function ScoreTrend({ points }: { points: ScorePoint[] }) {
  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Log two mornings and the four scores start drawing a line.
      </p>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (value: number) => PAD.top + (1 - value / 100) * plotH;

  const lines = SERIES.map((series) => {
    const coords = points
      .map((point, i) => {
        const value = point[series.key];
        return value == null ? null : `${x(i).toFixed(1)},${y(value).toFixed(1)}`;
      })
      .filter((pair): pair is string => pair != null);
    return { ...series, d: coords.length ? `M${coords.join(" L")}` : "" };
  });

  const first = points[0].date.slice(5);
  const last = points[points.length - 1].date.slice(5);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full"
        role="img"
        aria-label="Readiness scores over recent mornings"
      >
        {[0, 50, 67, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 50 ? "rgb(56 189 248 / 0.35)" : "var(--chart-grid)"}
              strokeDasharray={tick === 0 || tick === 100 ? undefined : "3 4"}
            />
            <text
              x={PAD.left - 6}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-slate-600 text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {lines.map((line) =>
          line.d ? (
            <path
              key={line.key}
              d={line.d}
              fill="none"
              stroke={line.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        <text x={PAD.left} y={H - 6} className="fill-slate-600 text-[10px]">
          {first}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          className="fill-slate-600 text-[10px]"
        >
          {last}
        </text>
      </svg>
      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span
              className="h-1.5 w-3 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            {series.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
