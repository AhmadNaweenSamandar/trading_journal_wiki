import { NextResponse } from "next/server";

import { getWeekNotes, saveWeekNotes } from "@/lib/db";
import type { WeekNote } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getWeekNotes());
}

export async function POST(request: Request) {
  const raw = (await request.json()) as Partial<WeekNote>;
  const weekStart = (raw.weekStart ?? "").trim();
  const body = (raw.body ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ errors: ["A valid week is required."] }, { status: 400 });
  }

  const notes = await getWeekNotes();
  const next: WeekNote = {
    weekStart,
    body,
    updatedAt: new Date().toISOString(),
  };
  await saveWeekNotes([...notes.filter((note) => note.weekStart !== weekStart), next]);
  return NextResponse.json(next);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "week is required" }, { status: 400 });
  }
  const remaining = (await getWeekNotes()).filter((note) => note.weekStart !== week);
  await saveWeekNotes(remaining);
  return NextResponse.json({ ok: true });
}
