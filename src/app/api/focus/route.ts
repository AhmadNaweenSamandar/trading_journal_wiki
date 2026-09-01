import { NextResponse } from "next/server";

import { getFocuses, saveFocuses } from "@/lib/db";
import type { Focus } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getFocuses());
}

export async function POST(request: Request) {
  const raw = (await request.json()) as Partial<Focus>;
  const weekStart = (raw.weekStart ?? "").trim();
  const findingId = (raw.findingId ?? "").trim();
  const statement = (raw.statement ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !statement) {
    return NextResponse.json(
      { errors: ["A week and a statement are required."] },
      { status: 400 },
    );
  }

  const focus: Focus = {
    id: `f_${Date.now().toString(36)}`,
    weekStart,
    findingId,
    statement,
    baselineImpact: Number(raw.baselineImpact) || 0,
    createdAt: new Date().toISOString(),
  };

  // One change per week: a new pick replaces the previous one.
  const existing = (await getFocuses()).filter((f) => f.weekStart !== weekStart);
  await saveFocuses([...existing, focus]);

  return NextResponse.json(focus, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "week is required" }, { status: 400 });
  }
  const remaining = (await getFocuses()).filter((f) => f.weekStart !== week);
  await saveFocuses(remaining);
  return NextResponse.json({ ok: true });
}
