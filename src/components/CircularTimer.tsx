"use client";

const SIZE = 96;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CircularTimer({
  elapsed,
  budget,
  running,
  onToggle,
}: {
  elapsed: number;
  budget: number;
  running: boolean;
  onToggle: () => void;
}) {
  const progress = Math.min(1, elapsed / budget);
  const over = elapsed > budget;
  const near = elapsed > budget * 0.6;
  const colour = over ? "#fb7185" : near ? "#fbbf24" : "#38bdf8";

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onToggle}
        title={running ? "Pause timer" : "Resume timer"}
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgb(14 165 233 / 0.28)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={colour}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            style={{ transition: "stroke-dashoffset 900ms linear, stroke 300ms" }}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-lg font-semibold tabular-nums"
            style={{ color: colour }}
          >
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-600">
            {running ? "running" : "paused"}
          </span>
        </span>
      </button>

      <div className="min-w-0">
        <p className="label">Five-minute budget</p>
        <p className="mt-1 text-sm text-slate-400">
          {over
            ? "Over five minutes. Wrap it up and save the analysis for the weekly review."
            : "The journal is a data collection tool, not a diary."}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Tap the dial to {running ? "pause" : "resume"}.
        </p>
      </div>
    </div>
  );
}
