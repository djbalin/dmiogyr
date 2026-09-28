"use client";

import { conditionFor, hourAt } from "@/lib/weather/aggregate";
import { CONDITION_LABELS } from "@/lib/weather/conditions";
import { isNight, type SunTimes } from "@/lib/weather/sun";
import {
  type ForecastResponse,
  PROVIDER_IDS,
  type ProviderId,
} from "@/lib/weather/types";
import { PROVIDER_STYLES, ProviderTag, Skeleton, WindArrow } from "./ui";
import { WeatherIcon } from "./weather-icon";

/**
 * The headline card: what both providers think is happening right now.
 *
 * Deliberately compact — it sits in a narrow column beside the graph on wide
 * screens (above it on a phone) and can be hidden entirely, letting the graph
 * take the full width.
 */
export function NowPanel({
  forecasts,
  sun,
  now,
  loading,
  onHide,
  className = "",
}: {
  forecasts: Partial<Record<ProviderId, ForecastResponse>>;
  sun: SunTimes | null;
  now: Date;
  loading: boolean;
  onHide: () => void;
  className?: string;
}) {
  const entries = PROVIDER_IDS.map((provider) => ({
    provider,
    hour: forecasts[provider] ? hourAt(forecasts[provider].hours, now) : null,
  })).filter((entry) => entry.hour);

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

  const card = `flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] ${className}`;

  if (loading && entries.length === 0) {
    return (
      <section aria-label="Vejret lige nu" aria-busy="true" className={card}>
        {header}
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </section>
    );
  }

  if (entries.length === 0) return null;

  const lead = entries[0];
  const leadHour = lead.hour;
  if (!leadHour) return null;

  const condition = conditionFor(leadHour);
  const night = sun ? isNight(now, sun) : false;
  // Compare the values as they are displayed. Judging 21.4 and 22.3 to be in
  // agreement while the card reads "21°" next to "22°" would just look wrong.
  const shown = entries.map((entry) =>
    Math.round(entry.hour?.temperature ?? 0),
  );
  const disagreement = shown.length > 1 ? Math.abs(shown[0] - shown[1]) : null;

  return (
    <section aria-label="Vejret lige nu" className={card}>
      {header}

      <div className="mt-2 flex items-center gap-3">
        <WeatherIcon
          condition={condition}
          night={night}
          size={44}
          decorative
          className="shrink-0"
        />
        <p className="text-sm font-medium text-ink">
          {CONDITION_LABELS[condition]}
        </p>
      </div>

      <div className="mt-3 grid flex-1 grid-cols-2 content-start gap-3 lg:grid-cols-1">
        {entries.map(({ provider, hour }) => {
          if (!hour) return null;
          const styles = PROVIDER_STYLES[provider];
          return (
            <div key={provider}>
              <div className="flex items-baseline gap-2">
                <ProviderTag provider={provider} />
                <p
                  className={`numeric text-3xl font-semibold leading-none ${styles.text}`}
                >
                  {Math.round(hour.temperature)}°
                </p>
              </div>
              <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Vind</dt>
                  <dd className="numeric flex items-center gap-1">
                    <WindArrow degrees={hour.windDirection} size={12} />
                    {Math.round(hour.windSpeed)} m/s
                  </dd>
                </div>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Nedbør</dt>
                  <dd className="numeric">
                    {hour.precipitation >= 0.05
                      ? `${hour.precipitation.toFixed(1)} mm`
                      : "tørt"}
                  </dd>
                </div>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Skydække</dt>
                  <dd className="numeric">
                    {Math.round(hour.cloudCover)}% skyer
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      {disagreement !== null && (
        <p className="mt-3 border-t border-line pt-2.5 text-xs text-ink-muted">
          {disagreement === 0 ? (
            <>
              <strong className="text-ink">Enige</strong> om temperaturen.
            </>
          ) : (
            <>
              <strong className="text-ink">{disagreement}° uenige</strong> om
              temperaturen.
            </>
          )}
        </p>
      )}
    </section>
  );
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
