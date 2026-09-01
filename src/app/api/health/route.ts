import { NextResponse } from "next/server";

import { getBiometrics, saveBiometrics } from "@/lib/db";
import { normalizeBiometrics } from "@/lib/health";
import type { Biometrics } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getBiometrics());
}

/** Upserts by date, so re-saving a day replaces that morning's readings. */
export async function POST(request: Request) {
  const { draft, errors } = normalizeBiometrics(await request.json());
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const records = await getBiometrics();
  const now = new Date().toISOString();
  const index = records.findIndex((record) => record.date === draft.date);

  const record: Biometrics = {
    ...draft,
    id: draft.date,
    createdAt: index === -1 ? now : records[index].createdAt,
    updatedAt: now,
  };

  if (index === -1) records.push(record);
  else records[index] = record;

  await saveBiometrics(records);
  return NextResponse.json(record, { status: index === -1 ? 201 : 200 });
}
