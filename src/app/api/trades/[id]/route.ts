import { NextResponse } from "next/server";

import { getSettings, getTrades, saveTrades } from "@/lib/db";
import { normalizeTrade } from "@/lib/validate";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const trade = (await getTrades()).find((t) => t.id === id);
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(trade);
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const settings = await getSettings();
  const { draft, errors } = normalizeTrade(await request.json(), settings);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const trades = await getTrades();
  const index = trades.findIndex((t) => t.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = {
    ...draft,
    id,
    seq: trades[index].seq,
    createdAt: trades[index].createdAt,
    updatedAt: new Date().toISOString(),
  };
  trades[index] = updated;
  await saveTrades(trades);

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const trades = await getTrades();
  const remaining = trades.filter((t) => t.id !== id);
  if (remaining.length === trades.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await saveTrades(remaining);
  return NextResponse.json({ ok: true });
}
