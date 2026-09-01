import Link from "next/link";

import { PageHeader, Tag } from "@/components/ui";
import { getNotes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WikiIndexPage() {
  const notes = await getNotes();
  const categories = [...new Set(notes.map((n) => n.category))];
  const pinned = notes.filter((n) => n.pinned);

  return (
    <>
      <PageHeader
        title="Wiki"
        subtitle="The method behind the journal. What to capture, why it matters, and how to review it."
      />

      {pinned.length > 0 ? (
        <section className="mb-6">
          <h2 className="label mb-2">Start here</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinned.map((note) => (
              <Link
                key={note.slug}
                href={`/wiki/${note.slug}`}
                className="card p-4"
              >
                <p className="text-sm font-semibold text-slate-100">{note.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {note.summary}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="label mb-2">{category}</h2>
            <ul className="card divide-y divide-sky-500/20">
              {notes
                .filter((note) => note.category === category)
                .map((note) => (
                  <li key={note.slug}>
                    <Link
                      href={`/wiki/${note.slug}`}
                      className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-sky-400/20"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">
                          {note.title}
                        </span>
                        {note.tags.slice(0, 3).map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </span>
                      <span className="text-xs text-slate-500">{note.summary}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
