import { NextResponse } from "next/server";

import { saveScreenshot } from "@/lib/db";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Accepts a pasted image as a data URL and stores it next to the journal data. */
export async function POST(request: Request) {
  const { dataUrl } = (await request.json()) as { dataUrl?: string };
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl ?? "");
  if (!match) {
    return NextResponse.json({ error: "Expected an image data URL." }, { status: 400 });
  }

  const extension = EXTENSIONS[match[1]];
  if (!extension) {
    return NextResponse.json(
      { error: `Unsupported image type: ${match[1]}` },
      { status: 415 },
    );
  }

  const url = await saveScreenshot(match[2], extension);
  return NextResponse.json({ url }, { status: 201 });
}
