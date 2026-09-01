"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/health", label: "Health" },
  { href: "/premarket", label: "Pre-market" },
  { href: "/trades", label: "Trades" },
  { href: "/trades/new", label: "New" },
  { href: "/strategies", label: "Strategies" },
  { href: "/analytics", label: "Analytics" },
  { href: "/review", label: "Review" },
  { href: "/calendar", label: "Calendar" },
  { href: "/lessons", label: "Lessons" },
  { href: "/wiki", label: "Wiki" },
  { href: "/settings", label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--app-line)] bg-[var(--sidebar-bg)]/90 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/25 text-xs font-bold text-sky-400">
          TJ
        </span>
        <span className="text-sm font-semibold text-slate-100">
          Trading Journal
        </span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                active
                  ? "bg-sky-500/10 font-medium text-sky-300"
                  : "text-slate-400 hover:bg-sky-400/20 hover:text-sky-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
