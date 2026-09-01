import { NextResponse } from "next/server";

import { getSettings, saveSettings } from "@/lib/db";
import { normalizeSettings } from "@/lib/validate";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(request: Request) {
  const settings = normalizeSettings(await request.json());
  await saveSettings(settings);
  return NextResponse.json(settings);
}
