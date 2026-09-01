"use client";

import { useRef, useState } from "react";

interface Props {
  label: string;
  hint?: string;
  url: string;
  active: boolean;
  uploading?: boolean;
  showLabel?: boolean;
  onActivate: () => void;
  onFile: (file: File | Blob) => void;
  onClear: () => void;
}

export function ScreenshotPad({
  label,
  hint,
  url,
  active,
  uploading,
  showLabel = true,
  onActivate,
  onFile,
  onClear,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      {showLabel ? (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">{label}</span>
          {url ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="text-[11px] text-slate-500 hover:text-sky-200"
              >
                {expanded ? "Shrink" : "Expand"}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] text-slate-500 hover:text-rose-300"
              >
                Remove
              </button>
            </span>
          ) : null}
        </div>
      ) : url ? (
        <div className="mb-1.5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] text-slate-500 hover:text-sky-200"
          >
            {expanded ? "Shrink" : "Expand"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-slate-500 hover:text-rose-300"
          >
            Remove chart
          </button>
        </div>
      ) : null}

      <div
        onClick={onActivate}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file?.type.startsWith("image/")) onFile(file);
        }}
        className={`relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
          dragging
            ? "border-sky-400 bg-sky-500/10"
            : active && !url
              ? "border-sky-500/70 bg-sky-500/5"
              : "border-sky-500/30"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className={`w-full object-contain ${expanded ? "max-h-[70vh]" : "max-h-72"}`}
          />
        ) : (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-slate-400">
              {uploading
                ? "Uploading..."
                : active
                  ? "Press \u2318V to paste your chart here"
                  : "Click to select, then paste"}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              or drop an image ·{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  input.current?.click();
                }}
                className="underline hover:text-sky-300"
              >
                browse
              </button>
            </p>
          </div>
        )}

        {active && !url ? (
          <span className="absolute right-2 top-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
            Paste target
          </span>
        ) : null}
      </div>

      {hint ? <p className="mt-1 text-[11px] text-slate-600">{hint}</p> : null}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
