import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A deliberately small markdown subset: headings, lists, quotes, rules, bold,
 * inline code, and [[slug|label]] links between wiki pages.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${i++}`;
    if (match[1]) {
      nodes.push(
        <Link
          key={key}
          href={`/wiki/${match[1]}`}
          className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:decoration-sky-400"
        >
          {match[2] ?? match[1]}
        </Link>,
      );
    } else if (match[3]) {
      nodes.push(
        <strong key={key} className="font-semibold text-slate-100">
          {match[3]}
        </strong>,
      );
    } else if (match[4]) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-sky-500/25 px-1.5 py-0.5 font-mono text-[0.85em] text-sky-300"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ body }: { body: string }) {
  const lines = body.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let ordered = false;
  let quote: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    const items = list.map((item, i) => (
      <li key={i} className="pl-1 marker:text-slate-500">
        {renderInline(item, `${key}-${i}`)}
      </li>
    ));
    blocks.push(
      ordered ? (
        <ol key={key} className="ml-5 list-decimal space-y-1.5 text-slate-300">
          {items}
        </ol>
      ) : (
        <ul key={key} className="ml-5 list-disc space-y-1.5 text-slate-300">
          {items}
        </ul>
      ),
    );
    list = [];
  };

  const flushQuote = (key: string) => {
    if (quote.length === 0) return;
    blocks.push(
      <blockquote
        key={key}
        className="border-l-2 border-sky-500/60 bg-sky-500/5 py-2 pl-4 text-slate-300 italic"
      >
        {quote.map((q, i) => (
          <p key={i}>{renderInline(q, `${key}-${i}`)}</p>
        ))}
      </blockquote>,
    );
    quote = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const key = `b-${index}`;

    if (line.startsWith("- ")) {
      flushQuote(`${key}-q`);
      if (ordered) flushList(`${key}-l`);
      ordered = false;
      list.push(line.slice(2));
      return;
    }
    const orderedMatch = /^\d+\.\s+(.*)$/.exec(line);
    if (orderedMatch) {
      flushQuote(`${key}-q`);
      if (!ordered) flushList(`${key}-l`);
      ordered = true;
      list.push(orderedMatch[1]);
      return;
    }
    if (line.startsWith("> ")) {
      flushList(`${key}-l`);
      quote.push(line.slice(2));
      return;
    }

    flushList(`${key}-l`);
    flushQuote(`${key}-q`);

    if (line === "") return;
    if (line.startsWith("---")) {
      blocks.push(<hr key={key} className="border-sky-500/20" />);
      return;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={key} className="pt-2 text-base font-semibold text-slate-100">
          {renderInline(line.slice(4), key)}
        </h3>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={key} className="pt-4 text-lg font-semibold text-slate-100">
          {renderInline(line.slice(3), key)}
        </h2>,
      );
      return;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key} className="pt-2 text-2xl font-bold text-white">
          {renderInline(line.slice(2), key)}
        </h1>,
      );
      return;
    }
    blocks.push(
      <p key={key} className="leading-relaxed text-slate-300">
        {renderInline(line, key)}
      </p>,
    );
  });

  flushList("tail-l");
  flushQuote("tail-q");

  return <div className="space-y-3">{blocks}</div>;
}
