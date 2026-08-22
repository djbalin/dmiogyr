"use client";

import {
  findLocation,
  LOCATIONS,
  type Location,
} from "@/lib/weather/locations";

/**
 * A styled native `<select>`.
 *
 * A custom listbox would allow a two-line option, but it also means owning
 * roving focus, type-ahead and touch behaviour — all of which the native
 * control already does, and does better on a phone, where this gets the
 * platform's own picker. The region is folded into the option label instead.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: Location;
  onChange: (location: Location) => void;
}) {
  return (
    <div className="relative flex items-center rounded-full border border-line bg-surface pl-3 pr-2 shadow-[var(--shadow)] transition-colors focus-within:border-line-strong hover:border-line-strong">
      <svg
        viewBox="0 0 20 20"
        width="16"
        height="16"
        aria-hidden="true"
        className="pointer-events-none shrink-0 text-accent"
      >
        <path
          d="M10 18s6-5.2 6-9.5a6 6 0 1 0-12 0C4 12.8 10 18 10 18Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="10" cy="8.4" r="2.2" fill="currentColor" />
      </svg>

      <label className="sr-only" htmlFor="location-picker">
        Vælg by
      </label>
      <select
        id="location-picker"
        value={value.id}
        onChange={(event) => onChange(findLocation(event.target.value))}
        className="cursor-pointer appearance-none bg-transparent py-2 pl-2 pr-6 text-sm font-semibold text-ink focus:outline-none"
      >
        {LOCATIONS.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name} · {location.region}
          </option>
        ))}
      </select>

      <svg
        viewBox="0 0 20 20"
        width="14"
        height="14"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-ink-faint"
      >
        <path
          d="m5 8 5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
