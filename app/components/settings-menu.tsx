"use client";

import { useEffect, useId, useRef, useState } from "react";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Lys" },
  { value: "dark", label: "Mørk" },
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

/** The gear button in the header and the small panel it opens. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  // Read after mount: the server cannot know the stored choice.
  const [theme, setTheme] = useState<ThemePreference>("system");
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => setTheme(readTheme()), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: ThemePreference) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Indstillinger"
        title="Indstillinger"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-[var(--shadow)] transition-colors hover:border-line-strong"
      >
        <GearIcon />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-2xl border border-line bg-surface-raised p-4 shadow-[var(--shadow)]"
        >
          <fieldset>
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              Tema
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-line bg-surface-muted p-1">
              {OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-full px-2 py-1.5 text-center text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                    theme === option.value
                      ? "bg-surface text-ink shadow-[var(--shadow)]"
                      : "text-ink-muted hover:text-ink"
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
                  {option.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              Auto følger din enheds indstilling.
            </p>
          </fieldset>
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M8.6 2.5h2.8l.4 2 1.5.9 1.9-.7 1.4 2.4-1.5 1.3v1.8l1.5 1.3-1.4 2.4-1.9-.7-1.5.9-.4 2H8.6l-.4-2-1.5-.9-1.9.7-1.4-2.4 1.5-1.3V9.1L3.4 7.8l1.4-2.4 1.9.7 1.5-.9.4-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="10"
        cy="10"
        r="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
