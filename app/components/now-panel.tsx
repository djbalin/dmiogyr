"use client";

import { conditionFor, hourAt } from "@/lib/weather/aggregate";
import { CONDITION_LABELS } from "@/lib/weather/conditions";
import { isNight, type SunTimes } from "@/lib/weather/sun";
import { formatClock } from "@/lib/weather/time";
import {
  type ForecastResponse,
  type HourlyForecast,
  PROVIDER_IDS,
  type ProviderId,
} from "@/lib/weather/types";
import { uvColor } from "@/lib/weather/uv";
import {
  PROVIDER_STYLES,
  ProviderTag,
  Skeleton,
  SunIcon,
  WindArrow,
} from "./ui";
import { WeatherIcon } from "./weather-icon";

/**
 * The headline card: what both providers think is happening right now, and
 * today's sun — sunrise, sunset, day length and DMI's UV maximum.
 *
 * Deliberately compact — it sits in a narrow column beside the graph on wide
 * screens (above it on a phone) and can be hidden entirely, letting the graph
 * take the full width.
 */
export function NowPanel({
  forecasts,
  sun,
  uv,
  now,
  loading,
  onHide,
  className = "",
}: {
  forecasts: Partial<Record<ProviderId, ForecastResponse>>;
  sun: SunTimes | null;
  /** DMI's forecast UV-index maximum for today, when it has one. */
  uv?: number;
  now: Date;
  loading: boolean;
  onHide: () => void;
  className?: string;
}) {
  const entries = PROVIDER_IDS.map((provider) => ({
    provider,
    hour: forecasts[provider] ? hourAt(forecasts[provider].hours, now) : null,
  })).filter(
    (entry): entry is { provider: ProviderId; hour: HourlyForecast } =>
      entry.hour !== null,
  );

  const card = `flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] ${className}`;
  const header = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Lige nu
      </h2>
      <button
        type="button"
        onClick={onHide}
        aria-label="Skjul Lige nu"
        title="Skjul — lad grafen fylde hele bredden"
        className="-mr-1.5 flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <CollapseIcon />
      </button>
    </div>
  );

  if (entries.length === 0) {
    if (!loading) return null;
    return (
      <section aria-label="Vejret lige nu" aria-busy="true" className={card}>
        {header}
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="mt-4 h-10" />
      </section>
    );
  }

  const condition = conditionFor(entries[0].hour);
  const night = sun ? isNight(now, sun) : false;
  // Compare the values as they are displayed. Judging 21.4 and 22.3 to be in
  // agreement while the card reads "21°" next to "22°" would just look wrong.
  const shown = entries.map((entry) => Math.round(entry.hour.temperature));
  const disagreement = shown.length > 1 ? Math.abs(shown[0] - shown[1]) : null;

  return (
    <section aria-label="Vejret lige nu" className={card}>
      {header}

      <div className="mt-1 flex items-center gap-3">
        <WeatherIcon
          condition={condition}
          night={night}
          size={48}
          decorative
          className="shrink-0"
        />
        <div>
          <p className="font-medium text-ink">{CONDITION_LABELS[condition]}</p>
          {disagreement !== null && (
            <p className="text-sm text-ink-muted">
              {disagreement === 0
                ? "DMI og Yr er enige"
                : `${disagreement}° uenige`}
            </p>
          )}
        </div>
      </div>

      {/* The two providers side by side, each a temperature over its details. */}
      <div className="mt-3 grid grid-cols-2 divide-x divide-line">
        {entries.map(({ provider, hour }) => (
          <div key={provider} className="px-3 first:pl-0 last:pr-0">
            <ProviderTag provider={provider} />
            <p
              className={`numeric text-4xl font-semibold leading-none ${PROVIDER_STYLES[provider].text}`}
            >
              {Math.round(hour.temperature)}°
            </p>
            <dl className="numeric mt-2 space-y-0.5 text-sm text-ink-muted">
              <div className="flex items-center gap-1">
                <dt className="sr-only">Vind</dt>
                <dd className="flex items-center gap-1">
                  <WindArrow degrees={hour.windDirection} size={12} />
                  {Math.round(hour.windSpeed)} m/s
                </dd>
              </div>
              <div>
                <dt className="sr-only">Nedbør</dt>
                <dd>
                  {hour.precipitation >= 0.05
                    ? `${hour.precipitation.toFixed(1)} mm`
                    : "Tørt"}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Skydække</dt>
                <dd>{Math.round(hour.cloudCover)}% skyer</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {sun && <SunSection sun={sun} uv={uv} />}
    </section>
  );
}

/** Today's sun: rise and set, day length, and UV — at the card's foot. */
function SunSection({ sun, uv }: { sun: SunTimes; uv?: number }) {
  return (
    <div className="mt-auto pt-4">
      <div className="rounded-xl bg-surface-muted px-3 py-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <SunIcon size={16} />
            Sol i dag
          </span>
          {uv !== undefined && (
            <span
              className="numeric inline-flex items-center gap-1 text-xs font-semibold text-ink-muted"
              title={`UV-indeks ${uv.toFixed(1)}`}
            >
              UV
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-0.5 text-[0.6875rem] font-bold leading-none"
                style={{ borderColor: uvColor(uv), color: uvColor(uv) }}
              >
                {Math.round(uv)}
              </span>
            </span>
          )}
        </div>
        {sun.sunrise && sun.sunset ? (
          <dl className="numeric mt-2 flex justify-between gap-3">
            <SunStat label="Op" value={formatClock(sun.sunrise)} />
            <SunStat label="Ned" value={formatClock(sun.sunset)} />
            <SunStat
              label="Dagslys"
              value={formatDayLength(
                sun.sunset.getTime() - sun.sunrise.getTime(),
              )}
            />
          </dl>
        ) : (
          <p className="mt-1 text-ink-muted">
            {sun.polarNight ? "Solen står ikke op" : "Solen går ikke ned"}
          </p>
        )}
      </div>
    </div>
  );
}

function SunStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="whitespace-nowrap font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatDayLength(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return `${Math.floor(minutes / 60)} t ${minutes % 60} m`;
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="m8 5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
