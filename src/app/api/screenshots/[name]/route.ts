import { readScreenshot } from "@/lib/db";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const file = await readScreenshot(name);
  if (!file) return new Response("Not found", { status: 404 });

  const extension = name.split(".").pop()?.toLowerCase() ?? "png";
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": MIME[extension] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
