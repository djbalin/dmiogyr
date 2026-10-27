"use client";

import { useId } from "react";
import { conditionFor, hourAt } from "@/lib/weather/aggregate";
import { CONDITION_LABELS } from "@/lib/weather/conditions";
import type { DmiLocationDetails } from "@/lib/weather/providers/dmi-extras";
import { isNight, type SunTimes } from "@/lib/weather/sun";
import { formatClock } from "@/lib/weather/time";
import {
  type ForecastResponse,
  PROVIDER_IDS,
  type ProviderId,
} from "@/lib/weather/types";
import {
  ChevronIcon,
  PROVIDER_STYLES,
  ProviderTag,
  Skeleton,
  SunIcon,
  WindArrow,
} from "./ui";
import { WeatherIcon } from "./weather-icon";

/**
 * The headline card: what both providers think is happening right now, and
 * today's sunrise, sunset and day length.
 *
 * Deliberately compact — it sits in a narrow column beside the graph on wide
 * screens (above it on a phone). Its heading folds it up and down like the
 * day rows: collapsed, it is a one-line bar above the graph showing just the
 * two temperatures, and the graph takes the full width.
 */
export function NowPanel({
  forecasts,
  sun,
  dmiSun,
  now,
  loading,
  collapsed,
  onToggle,
  className = "",
}: {
  forecasts: Partial<Record<ProviderId, ForecastResponse>>;
  sun: SunTimes | null;
  /** DMI's own sun times for today, preferred over `sun` when present. */
  dmiSun: DmiLocationDetails["sun"][number] | null;
  now: Date;
  loading: boolean;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const entries = PROVIDER_IDS.map((provider) => ({
    provider,
    hour: forecasts[provider] ? hourAt(forecasts[provider].hours, now) : null,
  })).filter((entry) => entry.hour);

  const bodyId = useId();

  // A disclosure heading: the whole row is the button, as on the day rows.
  const header = (
    <h2>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        className="-m-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-muted"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Lige nu
        </span>
        {collapsed && (
          <span className="flex items-baseline gap-3">
            {entries.map(({ provider, hour }) => (
              <span
                key={provider}
                className={`numeric text-base font-semibold ${PROVIDER_STYLES[provider].text}`}
              >
                <span className="sr-only">
                  {provider === "dmi" ? "DMI" : "Yr"}{" "}
                </span>
                {Math.round(hour?.temperature ?? 0)}°
              </span>
            ))}
          </span>
        )}
        <span className="ml-auto text-ink-faint">
          <ChevronIcon open={!collapsed} />
        </span>
      </button>
    </h2>
  );

  const card = `flex flex-col rounded-2xl border border-line bg-surface shadow-[var(--shadow)] ${
    collapsed ? "px-4 py-3" : "p-4"
  } ${className}`;

  if (collapsed) {
    return (
      <section aria-label="Vejret lige nu" className={card}>
        {header}
        <div id={bodyId} hidden />
      </section>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <section aria-label="Vejret lige nu" aria-busy="true" className={card}>
        {header}
        <div id={bodyId}>
          <div className="mt-3 flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mt-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
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

      <div id={bodyId} className="flex flex-1 flex-col">
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

        <SunRow sun={sun} dmiSun={dmiSun} />

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
      </div>
    </section>
  );
}

/**
 * Today's sun, as dmi.dk lists it. DMI's figures win when they have arrived;
 * until then (or if that feed is down) the locally computed times stand in,
 * so the row never waits on a second request.
 */
function SunRow({
  sun,
  dmiSun,
}: {
  sun: SunTimes | null;
  dmiSun: DmiLocationDetails["sun"][number] | null;
}) {
  let sunrise: string | null = null;
  let sunset: string | null = null;
  let dayLengthSeconds: number | null = null;

  if (dmiSun) {
    sunrise = dmiSun.sunrise;
    sunset = dmiSun.sunset;
    dayLengthSeconds = dmiSun.dayLengthSeconds;
  } else if (sun?.sunrise && sun.sunset) {
    sunrise = formatClock(sun.sunrise);
    sunset = formatClock(sun.sunset);
    dayLengthSeconds = (sun.sunset.getTime() - sun.sunrise.getTime()) / 1000;
  }
  if (!sunrise || !sunset || dayLengthSeconds === null) return null;

  // One line, as the day table shows sun times, so it fits the narrow
  // column beside the graph; the labels are there for screen readers and
  // on hover.
  return (
    <dl className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs text-ink-muted">
      <SunIcon />
      <SunStat label="Solopgang" value={`↑ ${sunrise}`} />
      <SunStat label="Solnedgang" value={`↓ ${sunset}`} />
      <SunStat
        label="Dagslængde"
        value={`${formatDayLength(dayLengthSeconds)} lys`}
      />
    </dl>
  );
}

function SunStat({ label, value }: { label: string; value: string }) {
  return (
    <div title={label}>
      <dt className="sr-only">{label}</dt>
      <dd className="numeric font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatDayLength(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours} t ${minutes} m`;
}
