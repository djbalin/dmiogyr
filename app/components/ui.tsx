import type { ProviderId } from "@/lib/weather/types";

/** Tailwind text/background classes per provider, resolved in one place. */
export const PROVIDER_STYLES: Record<
  ProviderId,
  { text: string; bg: string; dot: string; bar: string }
> = {
  dmi: {
    text: "text-dmi",
    bg: "bg-dmi-soft",
    dot: "bg-dmi",
    bar: "bg-dmi",
  },
  yr: {
    text: "text-yr",
    bg: "bg-yr-soft",
    dot: "bg-yr",
    bar: "bg-yr",
  },
};

/**
 * The short provider label that sits in front of every number.
 *
 * Two stacked figures distinguished only by colour are unreadable to anyone
 * who cannot tell teal from indigo, and ambiguous for everyone else on a small
 * screen, so each value carries its source in text.
 */
export function ProviderTag({
  provider,
  className = "",
}: {
  provider: ProviderId;
  className?: string;
}) {
  return (
    <span
      className={`${PROVIDER_STYLES[provider].text} text-[10px] font-semibold uppercase tracking-wider ${className}`}
    >
      {provider === "dmi" ? "DMI" : "Yr"}
    </span>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
  );
}

export function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      className={spinning ? "animate-spin" : undefined}
    >
      <path
        d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3v3.2h-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WarningIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10 2.8 18.2 17H1.8L10 2.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10 8v3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.2" r="1" fill="currentColor" />
    </svg>
  );
}

/** An arrow pointing the way the wind is blowing *towards*. */
export function WindArrow({
  degrees,
  size = 14,
  className = "",
}: {
  degrees: number;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      // Meteorological wind direction is where the wind comes *from*; the
      // arrow shows where it is going, hence the 180° turn.
      style={{ transform: `rotate(${degrees + 180}deg)` }}
    >
      <path d="M8 1.5 12 14 8 11.2 4 14Z" fill="currentColor" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-line ${className}`}
      aria-hidden="true"
    />
  );
}
