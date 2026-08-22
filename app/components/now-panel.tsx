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
 * The old app opened straight into a seven-day table, which buried the one
 * question people actually open a weather app to answer.
 */
export function NowPanel({
  forecasts,
  sun,
  now,
  loading,
}: {
  forecasts: Partial<Record<ProviderId, ForecastResponse>>;
  sun: SunTimes | null;
  now: Date;
  loading: boolean;
}) {
  const entries = PROVIDER_IDS.map((provider) => ({
    provider,
    hour: forecasts[provider] ? hourAt(forecasts[provider].hours, now) : null,
  })).filter((entry) => entry.hour);

  if (loading && entries.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
        <Skeleton className="h-4 w-16" />
        <div className="mt-4 flex gap-8">
          <Skeleton className="h-16 w-40" />
          <Skeleton className="h-16 w-40" />
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
    <section
      aria-label="Vejret lige nu"
      className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Lige nu
        </h2>
        <p className="text-sm text-ink-muted">{CONDITION_LABELS[condition]}</p>
      </div>

      <div className="mt-4 flex items-center gap-4 sm:gap-6">
        <WeatherIcon
          condition={condition}
          night={night}
          size={72}
          decorative
          className="shrink-0"
        />

        {/* Both providers align to the same left edge on a phone, and sit next
            to each other once there is room — close enough to compare at a
            glance rather than spread across the full width of the card. */}
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:gap-12">
          {entries.map(({ provider, hour }) => {
            if (!hour) return null;
            const styles = PROVIDER_STYLES[provider];
            return (
              <div key={provider}>
                <ProviderTag provider={provider} />
                <p
                  className={`numeric text-4xl font-semibold leading-tight ${styles.text}`}
                >
                  {Math.round(hour.temperature)}°
                </p>
                <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink-muted">
                  <div className="flex items-center gap-1">
                    <dt className="sr-only">Vind</dt>
                    <dd className="numeric flex items-center gap-1">
                      <WindArrow degrees={hour.windDirection} />
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
      </div>

      {disagreement !== null && (
        <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
          {disagreement === 0 ? (
            <>
              DMI og Yr er <strong className="text-ink">enige</strong> om
              temperaturen lige nu.
            </>
          ) : (
            <>
              DMI og Yr er{" "}
              <strong className="text-ink">{disagreement}° uenige</strong> om
              temperaturen lige nu.
            </>
          )}
        </p>
      )}
    </section>
  );
}
