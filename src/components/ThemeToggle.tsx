"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "tj-theme";

export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolveTheme(choice);
}

const OPTIONS: Array<{ id: ThemeChoice; label: string; hint: string }> = [
  { id: "system", label: "System", hint: "Follow the OS" },
  { id: "light", label: "Light", hint: "White theme" },
  { id: "dark", label: "Dark", hint: "Night theme" },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    setChoice(readThemeChoice());
  }, []);

  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  function select(next: ThemeChoice) {
    setChoice(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map((option) => {
        const active = choice === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => select(option.id)}
            className={`rounded-lg border px-3 py-3 text-left ${
              active
                ? "border-sky-500/60 bg-sky-500/10"
                : "border-sky-500/30"
            }`}
          >
            <span className="block text-sm font-medium text-slate-100">
              {option.label}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
