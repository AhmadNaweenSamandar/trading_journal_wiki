import { NextResponse } from "next/server";

import { getSettings, getTrades, nextSeq, saveTrades } from "@/lib/db";
import { normalizeTrade } from "@/lib/validate";
import type { Trade } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getTrades());
}

/** Clears the whole journal. Guarded by a confirmation in the settings UI. */
export async function DELETE() {
  await saveTrades([]);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const settings = await getSettings();
  const payload = await request.json();
  const trades = await getTrades();
  const now = new Date().toISOString();

  // A bulk payload comes from the spreadsheet importer.
  if (Array.isArray(payload)) {
    const created: Trade[] = [];
    const errors: string[] = [];
    let seq = nextSeq(trades);

    payload.forEach((entry, index) => {
      const { draft, errors: rowErrors } = normalizeTrade(entry, settings, {
        imported: true,
      });
      if (rowErrors.length > 0) {
        errors.push(`Row ${index + 1}: ${rowErrors.join(" ")}`);
        return;
      }
      created.push({
        ...draft,
        id: String(seq),
        seq,
        createdAt: now,
        updatedAt: now,
      });
      seq += 1;
    });

    if (created.length === 0) {
      return NextResponse.json(
        { errors: errors.length ? errors : ["Nothing to import."] },
        { status: 400 },
      );
    }

    await saveTrades([...trades, ...created]);
    return NextResponse.json(
      { imported: created.length, skipped: errors.length, errors },
      { status: 201 },
    );
  }

  const { draft, errors } = normalizeTrade(payload, settings);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const seq = nextSeq(trades);
  const trade: Trade = {
    ...draft,
    id: String(seq),
    seq,
    createdAt: now,
    updatedAt: now,
  };
  await saveTrades([...trades, trade]);

  return NextResponse.json(trade, { status: 201 });
}
