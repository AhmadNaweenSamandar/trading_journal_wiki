import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageViewer } from "@/components/ImageViewer";
import { getTrade } from "@/lib/db";

export const dynamic = "force-dynamic";

const KINDS = {
  exit1m: "Exit — 1 minute",
  exit15m: "Exit — 15 minute",
} as const;

type Kind = keyof typeof KINDS;

export default async function ScreenshotPage({
  params,
}: {
  params: Promise<{ id: string; kind: string }>;
}) {
  const { id, kind } = await params;
  if (!(kind in KINDS)) notFound();

  const trade = await getTrade(id);
  if (!trade) notFound();

  const key = kind as Kind;
  const url = trade.screenshots[key];
  if (!url) notFound();

  return (
    <>
      <p className="sr-only">
        <Link href={`/trades/${trade.id}`}>Back to trade</Link>
      </p>
      <ImageViewer
        src={url}
        label={`Trade #${trade.seq} · ${KINDS[key]}`}
        backHref={`/trades/${trade.id}`}
      />
    </>
  );
}
