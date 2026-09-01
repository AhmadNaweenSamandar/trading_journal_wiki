import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/Markdown";
import { PageHeader, Tag } from "@/components/ui";
import { getNote, getNotes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WikiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [note, notes] = await Promise.all([getNote(slug), getNotes()]);
  if (!note) notFound();

  const related = notes.filter(
    (n) => n.slug !== note.slug && n.category === note.category,
  );

  return (
    <>
      <PageHeader
        title={note.title}
        subtitle={note.summary}
        action={
          <Link
            href="/wiki"
            className="rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
          >
            All pages
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <article className="card p-6 lg:col-span-3">
          <Markdown body={note.body} />
        </article>

        <aside className="space-y-4">
          <div className="card p-4">
            <p className="label mb-2">Category</p>
            <p className="text-sm text-slate-300">{note.category}</p>
            {note.tags.length > 0 ? (
              <>
                <p className="label mb-2 mt-4">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {note.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {related.length > 0 ? (
            <div className="card p-4">
              <p className="label mb-2">Related</p>
              <ul className="space-y-1.5">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/wiki/${item.slug}`}
                      className="text-sm text-slate-400 hover:text-sky-300"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
