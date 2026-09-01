import { NextResponse } from "next/server";

import { getNotes, saveNotes } from "@/lib/db";
import type { Note } from "@/lib/types";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const note = (await getNotes()).find((n) => n.slug === slug);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function PUT(request: Request, { params }: Context) {
  const { slug } = await params;
  const raw = (await request.json()) as Partial<Note>;
  const notes = await getNotes();
  const index = notes.findIndex((n) => n.slug === slug);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated: Note = {
    ...notes[index],
    title: (raw.title ?? notes[index].title).trim() || notes[index].title,
    category: (raw.category ?? notes[index].category).trim(),
    summary: raw.summary ?? notes[index].summary,
    body: raw.body ?? notes[index].body,
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : notes[index].tags,
    pinned: typeof raw.pinned === "boolean" ? raw.pinned : notes[index].pinned,
    updatedAt: new Date().toISOString(),
  };
  notes[index] = updated;
  await saveNotes(notes);

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { slug } = await params;
  const notes = await getNotes();
  const remaining = notes.filter((n) => n.slug !== slug);
  if (remaining.length === notes.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await saveNotes(remaining);
  return NextResponse.json({ ok: true });
}
