import { NextResponse } from "next/server";

import { getPremarkets, savePremarkets } from "@/lib/db";
import { normalizePremarket } from "@/lib/premarket";
import type { Premarket } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getPremarkets());
}

/** Creates a new plan. A date that already has a plan is rejected. */
export async function POST(request: Request) {
  const { draft, errors } = normalizePremarket(await request.json());
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const records = await getPremarkets();
  if (records.some((record) => record.date === draft.date)) {
    return NextResponse.json(
      { errors: ["A plan for this date is already recorded."] },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const record: Premarket = {
    ...draft,
    id: draft.date,
    createdAt: now,
    updatedAt: now,
  };

  records.push(record);
  await savePremarkets(records);
  return NextResponse.json(record, { status: 201 });
}
