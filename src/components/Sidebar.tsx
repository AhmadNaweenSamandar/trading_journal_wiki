"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: "Journal",
    links: [
      { href: "/", label: "Dashboard" },
      { href: "/health", label: "Health" },
      { href: "/premarket", label: "Pre-market" },
      { href: "/trades", label: "Trades" },
      { href: "/trades/new", label: "New Entry" },
      { href: "/calendar", label: "P&L Calendar" },
    ],
  },
  {
    heading: "Analysis",
    links: [
      { href: "/strategies", label: "Strategies" },
      { href: "/analytics", label: "Analytics" },
      { href: "/review", label: "Weekly Review" },
      { href: "/lessons", label: "Lessons" },
    ],
  },
  {
    heading: "Knowledge",
    links: [
      { href: "/wiki", label: "Wiki" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[var(--app-line)] bg-[var(--sidebar-bg)] px-3 py-5 lg:flex">
      <Link href="/" className="mb-7 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/25 text-sm font-bold text-sky-400">
          TJ
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-100">
            Trading Journal
          </span>
          <span className="block text-[11px] text-slate-500">Personal wiki</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-6">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-slate-600">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`block rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      isActive(link.href)
                        ? "bg-sky-500/10 font-medium text-sky-300"
                        : "text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Link
        href="/trades/new"
        className="mt-4 rounded-lg bg-sky-500 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400"
      >
        Log a trade
      </Link>
      <p className="mt-3 px-2 text-[11px] leading-relaxed text-slate-600">
        Data is stored locally in{" "}
        <code className="font-mono text-slate-500">/data</code>
      </p>
    </aside>
  );
}
