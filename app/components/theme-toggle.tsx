"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string; title: string }[] = [
  { value: "system", label: "Auto", title: "Følg enhedens indstilling" },
  { value: "light", label: "Lys", title: "Lyst tema" },
  { value: "dark", label: "Mørk", title: "Mørkt tema" },
];

function readTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignored on purpose: the theme still applies for this visit.
  }
}

/**
 * Auto / light / dark as a segmented control, out in the header rather than
 * behind a menu that held nothing else. Icons only, like the theme switches
 * phone apps put in their top bars: three 32px targets fit beside the title
 * on the narrowest screen, and each still names itself to screen readers and
 * on hover.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // Read after mount: the server cannot know the stored choice.
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => setTheme(readTheme()), []);

  const choose = (next: ThemePreference) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <fieldset
      className={`flex h-10 shrink-0 items-center gap-0.5 rounded-full border border-line bg-surface-muted p-1 ${className}`}
    >
      <legend className="sr-only">Tema</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          title={option.title}
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
            theme === option.value
              ? "bg-surface text-ink shadow-[var(--shadow)]"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={theme === option.value}
            onChange={() => choose(option.value)}
            className="sr-only"
          />
          <span className="sr-only">{option.label}</span>
          <ThemeIcon theme={option.value} />
        </label>
      ))}
    </fieldset>
  );
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <circle cx="10" cy="10" r="3.4" fill="currentColor" />
        <path
          d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path
          d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" />
    </svg>
  );
}
