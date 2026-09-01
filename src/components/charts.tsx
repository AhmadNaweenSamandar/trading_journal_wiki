import { currency, shortDate } from "@/lib/format";
import type { EquityPoint } from "@/lib/metrics";

const W = 800;
const H = 260;
const PAD = { top: 16, right: 14, bottom: 34, left: 60 };

export function EquityChart({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Log at least two trades to draw an equity curve.
      </p>
    );
  }

  const values = points.map((p) => p.equity);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Spread points along real time so gaps between sessions are visible.
  const times = points.map((p) => new Date(p.at).getTime());
  const firstTime = times[0];
  const lastTime = times[times.length - 1];
  const timeSpan = lastTime - firstTime || 1;

  const x = (i: number) => PAD.left + ((times[i] - firstTime) / timeSpan) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * plotH;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.equity).toFixed(2)}`)
    .join(" ");
  const last = points[points.length - 1];
  const lastStroke = last.equity >= 0 ? "#34d399" : "#fb7185";
  const zeroY = y(0);
  const areaToZero = `${line} L${x(points.length - 1).toFixed(2)},${zeroY.toFixed(2)} L${x(0).toFixed(2)},${zeroY.toFixed(2)} Z`;

  const ticks = [max, min + span / 2, min].filter(
    (value, index, arr) => arr.indexOf(value) === index,
  );

  // A handful of evenly spaced date labels along the bottom.
  const labelCount = Math.min(5, points.length);
  const dateLabels = Array.from({ length: labelCount }, (_, i) => {
    const index = Math.round((i / (labelCount - 1 || 1)) * (points.length - 1));
    return { index, date: points[index].date };
  }).filter(
    (item, i, arr) => arr.findIndex((other) => other.index === item.index) === i,
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-64 w-full"
      role="img"
      aria-label="Equity curve over time"
    >
      <defs>
        <linearGradient id="equityFillGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="equityFillRed" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0.06" />
        </linearGradient>
        <clipPath id="equityAboveZero">
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={Math.max(0, zeroY - PAD.top)}
          />
        </clipPath>
        <clipPath id="equityBelowZero">
          <rect
            x={PAD.left}
            y={zeroY}
            width={plotW}
            height={Math.max(0, PAD.top + plotH - zeroY)}
          />
        </clipPath>
      </defs>

      {ticks.map((value) => (
        <g key={value}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(value)}
            y2={y(value)}
            stroke="var(--chart-grid)"
            strokeDasharray="3 4"
          />
          <text
            x={PAD.left - 8}
            y={y(value) + 4}
            textAnchor="end"
            className="fill-slate-500 text-[11px]"
          >
            {currency(value)}
          </text>
        </g>
      ))}

      {min < 0 && max > 0 ? (
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--chart-zero)"
        />
      ) : null}

      {max > 0 ? (
        <>
          <path d={areaToZero} fill="url(#equityFillGreen)" clipPath="url(#equityAboveZero)" />
          <path
            d={line}
            fill="none"
            stroke="#34d399"
            strokeWidth="2"
            strokeLinejoin="round"
            clipPath="url(#equityAboveZero)"
          />
        </>
      ) : null}
      {min < 0 ? (
        <>
          <path d={areaToZero} fill="url(#equityFillRed)" clipPath="url(#equityBelowZero)" />
          <path
            d={line}
            fill="none"
            stroke="#fb7185"
            strokeWidth="2"
            strokeLinejoin="round"
            clipPath="url(#equityBelowZero)"
          />
        </>
      ) : null}
      <circle cx={x(points.length - 1)} cy={y(last.equity)} r="3.5" fill={lastStroke} />

      {dateLabels.map(({ index, date }, i) => (
        <text
          key={date + index}
          x={x(index)}
          y={H - 10}
          textAnchor={i === 0 ? "start" : i === dateLabels.length - 1 ? "end" : "middle"}
          className="fill-slate-500 text-[11px]"
        >
          {shortDate(date)}
        </text>
      ))}
    </svg>
  );
}

const BUCKETS = [
  { label: "≤ -3R", test: (r: number) => r <= -3 },
  { label: "-3 to -2R", test: (r: number) => r > -3 && r <= -2 },
  { label: "-2 to -1R", test: (r: number) => r > -2 && r <= -1 },
  { label: "-1 to 0R", test: (r: number) => r > -1 && r < 0 },
  { label: "0 to 1R", test: (r: number) => r >= 0 && r < 1 },
  { label: "1 to 2R", test: (r: number) => r >= 1 && r < 2 },
  { label: "2 to 3R", test: (r: number) => r >= 2 && r < 3 },
  { label: "3R+", test: (r: number) => r >= 3 },
];

/** Distribution of realized R-multiples as a labelled bar chart. */
export function RHistogram({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No R data yet.</p>;
  }

  const counts = BUCKETS.map((bucket) => values.filter(bucket.test).length);
  const max = Math.max(...counts, 1);

  const width = 620;
  const height = 240;
  const pad = { top: 18, right: 8, bottom: 42, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / BUCKETS.length;
  const barW = slot * 0.62;

  const gridLines = 4;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-60 w-full"
      role="img"
      aria-label="Distribution of R multiples"
    >
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const value = (max / gridLines) * i;
        const y = pad.top + plotH - (value / max) * plotH;
        return (
          <g key={i}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="var(--chart-grid)"
              strokeDasharray={i === 0 ? undefined : "3 4"}
            />
            <text
              x={pad.left - 6}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-600 text-[10px]"
            >
              {Math.round(value)}
            </text>
          </g>
        );
      })}

      {BUCKETS.map((bucket, i) => {
        const count = counts[i];
        const barH = (count / max) * plotH;
        const x = pad.left + i * slot + (slot - barW) / 2;
        const y = pad.top + plotH - barH;
        const negative = bucket.label.startsWith("-") || bucket.label.startsWith("≤");
        return (
          <g key={bucket.label}>
            <rect
              x={x}
              y={count === 0 ? pad.top + plotH - 2 : y}
              width={barW}
              height={count === 0 ? 2 : barH}
              rx="3"
              fill={negative ? "#f43f5e" : "#10b981"}
              fillOpacity={count === 0 ? 0.25 : 0.75}
            >
              <title>{`${count} trades in ${bucket.label}`}</title>
            </rect>
            {count > 0 ? (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                className="fill-slate-300 text-[11px] font-medium"
              >
                {count}
              </text>
            ) : null}
            <text
              x={x + barW / 2}
              y={height - 24}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {bucket.label}
            </text>
          </g>
        );
      })}

      <text
        x={pad.left + plotW / 2}
        y={height - 6}
        textAnchor="middle"
        className="fill-slate-600 text-[10px]"
      >
        Realized R per trade · {values.length} trades
      </text>
    </svg>
  );
}
