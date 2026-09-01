import { NextResponse } from "next/server";

import { getNotes, saveNotes } from "@/lib/db";
import type { Note } from "@/lib/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export async function GET() {
  return NextResponse.json(await getNotes());
}

export async function POST(request: Request) {
  const raw = (await request.json()) as Partial<Note>;
  const title = (raw.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ errors: ["Title is required."] }, { status: 400 });
  }

  const notes = await getNotes();
  let slug = slugify(raw.slug || title) || `note-${Date.now()}`;
  if (notes.some((n) => n.slug === slug)) slug = `${slug}-${Date.now().toString(36)}`;

  const note: Note = {
    slug,
    title,
    category: (raw.category ?? "Notes").trim() || "Notes",
    summary: (raw.summary ?? "").trim(),
    body: raw.body ?? "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [],
    updatedAt: new Date().toISOString(),
    pinned: Boolean(raw.pinned),
  };

  await saveNotes([...notes, note]);
  return NextResponse.json(note, { status: 201 });
}
