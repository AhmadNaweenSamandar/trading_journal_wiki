import { NextResponse } from "next/server";

import { getPremarket, getPremarkets, savePremarkets } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const record = await getPremarket(date);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const records = await getPremarkets();
  const remaining = records.filter((record) => record.date !== date);

  if (remaining.length === records.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await savePremarkets(remaining);
  return NextResponse.json({ ok: true });
}
