"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export function ImageViewer({
  src,
  label,
  backHref,
}: {
  src: string;
  label: string;
  backHref: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  const clampZoom = (value: number) => Math.min(8, Math.max(0.5, value));

  const zoomBy = useCallback((delta: number) => {
    setZoom((current) => clampZoom(Number((current + delta).toFixed(2))));
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? -0.15 : 0.15);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const start = dragging.current;
      if (!start) return;
      setOffset({
        x: start.ox + (event.clientX - start.x),
        y: start.oy + (event.clientY - start.y),
      });
    };
    const onUp = () => {
      dragging.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function reset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-line)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--app-ink)]">{label}</p>
          <p className="text-xs text-[var(--app-muted)]">
            Scroll or use the buttons to zoom. Drag to pan when zoomed in.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => zoomBy(-0.25)}
            className="rounded-lg border border-[var(--app-line)] px-3 py-1.5 text-sm text-[var(--app-ink)]"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-14 text-center text-sm tabular-nums text-[var(--app-muted)]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.25)}
            className="rounded-lg border border-[var(--app-line)] px-3 py-1.5 text-sm text-[var(--app-ink)]"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-[var(--app-line)] px-3 py-1.5 text-sm text-[var(--app-muted)]"
          >
            Reset
          </button>
          <Link
            href={backHref}
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Back to trade
          </Link>
        </div>
      </header>

      <div
        className={`relative min-h-0 flex-1 overflow-hidden bg-[var(--app-subtle)] ${
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
        onPointerDown={(event) => {
          if (zoom <= 1) return;
          dragging.current = {
            x: event.clientX,
            y: event.clientY,
            ox: offset.x,
            oy: offset.y,
          };
        }}
        onDoubleClick={() => zoomBy(zoom >= 2 ? -1 : 1)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}
