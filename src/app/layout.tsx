import type { Metadata } from "next";
import Script from "next/script";

import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";

import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Journal Wiki",
  description:
    "A local-first personal wiki to organize and analyze trading notes.",
};

const THEME_BOOT = `(function(){try{var t=localStorage.getItem("tj-theme")||"system";var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",dark?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--app-bg)] text-[var(--app-ink)] antialiased">
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT}
        </Script>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileNav />
            <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7 sm:px-7">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
