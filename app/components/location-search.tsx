"use client";

import { useEffect, useId, useRef, useState } from "react";
import { KNOWN_LOCATIONS, type Location } from "@/lib/weather/locations";
import type { PlaceSuggestion } from "@/lib/weather/providers/dmi-search";

/** Long enough to skip a request per keystroke while typing quickly. */
const DEBOUNCE_MS = 180;
/** DMI's index needs two letters before a prefix match means much. */
const MIN_QUERY_LENGTH = 2;

const KNOWN_SUGGESTIONS: PlaceSuggestion[] = KNOWN_LOCATIONS.map(
  ({ id, name, region }) => ({ id, name, region }),
);

type SearchState =
  | { status: "idle"; results: PlaceSuggestion[] }
  | { status: "loading"; results: PlaceSuggestion[] }
  | { status: "ready"; results: PlaceSuggestion[] }
  | { status: "error"; results: PlaceSuggestion[] };

/**
 * A search box with suggestions, following the WAI-ARIA combobox pattern:
 * focus stays in the input while the arrow keys move through the list, so
 * typing, correcting and picking all happen without leaving the keyboard.
 *
 * Suggestions come from DMI's own place index (see `/api/steder`), so any
 * town or village DMI forecasts for can be found; before anything is typed
 * the larger towns are offered instead.
 */
export function LocationSearch({
  value,
  onSelect,
  pending,
  className = "",
}: {
  value: Location;
  onSelect: (place: PlaceSuggestion) => void;
  /** True while the chosen place's page is loading. */
  pending: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<SearchState>({
    status: "idle",
    results: KNOWN_SUGGESTIONS,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const typed = query.trim();

  useEffect(() => {
    if (typed.length < MIN_QUERY_LENGTH) {
      setState({ status: "idle", results: KNOWN_SUGGESTIONS });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ status: "loading", results: previous.results }));
    const timer = setTimeout(() => {
      fetch(`/api/steder?q=${encodeURIComponent(typed)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (!response.ok || !Array.isArray(body?.results)) {
            throw new Error("search failed");
          }
          setState({ status: "ready", results: body.results });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setState({ status: "error", results: [] });
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed]);

  // A new list means the old highlighted row no longer points anywhere.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on change
  useEffect(() => setActive(-1), [state.results]);

  const results = state.results;

  const choose = (place: PlaceSuggestion) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    if (place.id !== value.id) onSelect(place);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(-1, index - 1));
    } else if (event.key === "Enter") {
      const pick = results[active] ?? (typed ? results[0] : undefined);
      if (open && pick) {
        event.preventDefault();
        choose(pick);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  const showList = open;
  const activeId = active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <div className={`relative ${className}`}>
      {/* The focus ring goes round the whole pill rather than the bare input
          inside it. */}
      <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-3.5 pr-3 shadow-[var(--shadow)] transition-colors focus-within:border-line-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:border-line-strong">
        <SearchIcon />
        <label className="sr-only" htmlFor={`${listId}-input`}>
          Søg efter by eller sted
        </label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          // Shows the current place until the user starts typing over it.
          placeholder={open ? "Søg efter by eller sted" : value.name}
          value={open ? query : ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={onKeyDown}
          style={{ outline: "none" }}
          className={`min-w-0 flex-1 bg-transparent text-base font-semibold text-ink focus:outline-none sm:text-sm [&::-webkit-search-cancel-button]:hidden ${
            open
              ? "placeholder:font-normal placeholder:text-ink-faint"
              : "placeholder:text-ink"
          }`}
        />
        {(pending || state.status === "loading") && <Spinner />}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow)]">
          {state.status === "idle" && (
            <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Større byer
            </p>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label="Forslag"
            className="max-h-80 overflow-y-auto py-1.5"
          >
            {results.map((place, index) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the input handles the keyboard, as the combobox pattern has it
              <div
                key={place.id}
                id={`${listId}-${index}`}
                role="option"
                // Reachable through aria-activedescendant, not the tab order.
                tabIndex={-1}
                aria-selected={index === active}
                // Keep focus in the input so blur does not close the list
                // before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 sm:py-2 ${
                  index === active ? "bg-surface-muted" : ""
                }`}
              >
                <span className="truncate font-medium text-ink">
                  {place.name}
                </span>
                {place.region && (
                  <span className="shrink-0 truncate text-xs text-ink-faint">
                    {place.region}
                  </span>
                )}
              </div>
            ))}
          </div>
          {state.status === "ready" && results.length === 0 && (
            <p className="px-4 pb-3 text-sm text-ink-muted">
              Ingen steder fundet for "{typed}".
            </p>
          )}
          {state.status === "error" && (
            <p className="px-4 py-3 text-sm text-warn">
              Søgningen virker ikke lige nu. Prøv igen om lidt.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      className="pointer-events-none shrink-0 text-accent"
    >
      <circle
        cx="8.5"
        cy="8.5"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m13 13 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      aria-hidden="true"
      className="shrink-0 animate-spin text-ink-faint"
    >
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="30 14"
        strokeLinecap="round"
      />
    </svg>
  );
}
