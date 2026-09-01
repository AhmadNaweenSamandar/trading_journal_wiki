export interface Segment {
  label: string;
  value: number;
  color: string;
  /** Optional caption shown in the legend under the label. */
  detail?: string;
}

function arc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const toPoint = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  };
  const [x1, y1] = toPoint(startAngle);
  const [x2, y2] = toPoint(endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M${x1} ${y1} A${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * A ring split into proportional segments, with the headline figure in the
 * middle. Reads faster than a stack of bars when there are only a few slices.
 */
export function Donut({
  segments,
  size = 132,
  thickness = 14,
  centerValue,
  centerLabel,
  centerClass = "text-slate-100",
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel?: string;
  centerClass?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  let cursor = 0;
  // A gap between segments keeps adjacent colours from bleeding together.
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2 : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--chart-grid)"
        strokeWidth={thickness}
      />

      {total > 0
        ? segments.map((segment) => {
            const value = Math.max(0, segment.value);
            if (value === 0) return null;
            const sweep = (value / total) * 360;
            const start = cursor + gap / 2;
            const end = cursor + sweep - gap / 2;
            cursor += sweep;
            if (end <= start) return null;

            // A full ring cannot be drawn with a single arc command.
            if (sweep >= 359.9) {
              return (
                <circle
                  key={segment.label}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                />
              );
            }

            return (
              <path
                key={segment.label}
                d={arc(cx, cy, radius, start, end)}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeLinecap="round"
              >
                <title>{`${segment.label}: ${value}`}</title>
              </path>
            );
          })
        : null}

      <text
        x={cx}
        y={centerLabel ? cy - 2 : cy + 5}
        textAnchor="middle"
        className={`fill-current text-[17px] font-semibold ${centerClass}`}
      >
        {centerValue}
      </text>
      {centerLabel ? (
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          className="fill-slate-500 text-[10px] uppercase tracking-wide"
        >
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}

export function Legend({ segments }: { segments: Segment[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {segments.map((segment) => (
        <li key={segment.label} className="flex items-baseline gap-2">
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: segment.color }}
          />
          <span className="min-w-0 flex-1">
            <span className="text-slate-300">{segment.label}</span>
            {segment.detail ? (
              <span className="block text-[11px] text-slate-500">{segment.detail}</span>
            ) : null}
          </span>
          <span className="shrink-0 text-slate-400">{segment.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** A single-value progress ring, for one percentage that stands on its own. */
export function Ring({
  value,
  max = 100,
  size = 96,
  thickness = 9,
  color = "#38bdf8",
  centerValue,
  centerLabel,
  centerClass = "text-slate-100",
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  centerValue: string;
  centerLabel?: string;
  centerClass?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      role="img"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--chart-grid)"
        strokeWidth={thickness}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
      />
      <g className="rotate-90" style={{ transformOrigin: "center" }}>
        <text
          x={size / 2}
          y={centerLabel ? size / 2 - 1 : size / 2 + 5}
          textAnchor="middle"
          className={`fill-current text-[15px] font-semibold ${centerClass}`}
        >
          {centerValue}
        </text>
        {centerLabel ? (
          <text
            x={size / 2}
            y={size / 2 + 13}
            textAnchor="middle"
            className="fill-slate-500 text-[9px] uppercase tracking-wide"
          >
            {centerLabel}
          </text>
        ) : null}
      </g>
    </svg>
  );
}

/**
 * A row of labelled bars. Used where a comparison has too many categories to
 * read as a ring.
 */
export function BarRow({
  bars,
  height = 150,
  formatValue,
}: {
  bars: Array<{ label: string; value: number; caption?: string }>;
  height?: number;
  formatValue: (value: number) => string;
}) {
  if (bars.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No data yet.</p>;
  }

  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  const hasNegative = bars.some((b) => b.value < 0);
  const zeroLine = hasNegative ? height / 2 : height;

  return (
    <div className="w-full">
      <div
        className="relative flex items-end justify-around gap-2"
        style={{ height }}
      >
        <div
          className="absolute inset-x-0 border-t border-sky-500/20"
          style={{ top: zeroLine }}
        />
        {bars.map((bar) => {
          const scale = hasNegative ? height / 2 : height;
          const barHeight = Math.max(2, (Math.abs(bar.value) / max) * (scale - 22));
          const positive = bar.value >= 0;
          return (
            <div
              key={bar.label}
              className="relative flex min-w-0 flex-1 flex-col items-center"
              style={{ height }}
              title={`${bar.label}: ${formatValue(bar.value)}`}
            >
              <div
                className="absolute flex w-full flex-col items-center"
                style={
                  positive
                    ? { bottom: height - zeroLine, height: barHeight }
                    : { top: zeroLine, height: barHeight }
                }
              >
                {positive ? (
                  <span className="absolute -top-4 text-[10px] text-slate-400">
                    {formatValue(bar.value)}
                  </span>
                ) : null}
                <div
                  className={`w-full max-w-[42px] rounded ${
                    positive ? "bg-emerald-500/80" : "bg-rose-500/80"
                  }`}
                  style={{ height: "100%" }}
                />
                {positive ? null : (
                  <span className="absolute -bottom-4 text-[10px] text-slate-400">
                    {formatValue(bar.value)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex justify-around gap-2">
        {bars.map((bar) => (
          <div key={bar.label} className="min-w-0 flex-1 text-center">
            <p className="truncate text-[11px] text-slate-400">{bar.label}</p>
            {bar.caption ? (
              <p className="truncate text-[10px] text-slate-600">{bar.caption}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
