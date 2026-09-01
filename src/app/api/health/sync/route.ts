import { NextResponse } from "next/server";

import { getBiometrics, saveBiometrics } from "@/lib/db";
import { normalizeBiometrics } from "@/lib/health";
import {
  ProviderNotConnectedError,
  fetchWhoopDay,
  mapWhoopDay,
} from "@/lib/providers/whoop";
import type { Biometrics } from "@/lib/types";

/**
 * Pulls a day from a connected wearable. The WHOOP client is not wired up yet,
 * so this returns a clear 501 until credentials exist; the write path below is
 * already complete and will work unchanged once it is.
 */
export async function POST(request: Request) {
  const { provider = "whoop", date } = await request.json().catch(() => ({}));

  if (provider !== "whoop") {
    return NextResponse.json(
      { errors: [`Unknown provider "${provider}".`] },
      { status: 400 },
    );
  }

  const day = date ?? new Date().toISOString().slice(0, 10);

  try {
    const raw = await fetchWhoopDay(day);
    const { draft, errors } = normalizeBiometrics(mapWhoopDay(raw));
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 502 });
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
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof ProviderNotConnectedError) {
      return NextResponse.json(
        {
          errors: [
            "WHOOP is not connected yet. Add your credentials and implement fetchWhoopDay in src/lib/providers/whoop.ts, then this endpoint starts working.",
          ],
        },
        { status: 501 },
      );
    }
    return NextResponse.json(
      { errors: [(error as Error).message] },
      { status: 502 },
    );
  }
}
