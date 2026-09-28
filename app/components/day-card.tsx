"use client";

import { useId } from "react";
import {
  conditionFor,
  DAY_PERIODS,
  type DaySummary,
  temperatureSpread,
} from "@/lib/weather/aggregate";
import { CONDITION_LABELS } from "@/lib/weather/conditions";
import { isNight, type SunTimes } from "@/lib/weather/sun";
import {
  dayHeading,
  formatClock,
  formatHour,
  instantFromZoned,
  zonedHour,
} from "@/lib/weather/time";
import {
  type HourlyForecast,
  PROVIDER_IDS,
  type ProviderId,
} from "@/lib/weather/types";
import { uvColor } from "@/lib/weather/uv";
import {
  ChevronIcon,
  PROVIDER_STYLES,
  ProviderTag,
  SunIcon,
  WindArrow,
} from "./ui";
import { WeatherIcon } from "./weather-icon";

/*
 * Each row is a fixed leading cell (the day, or the hour) followed by one grid
 * per provider sharing a single column template. The column templates are
 * declared once here and reused by the headers, so a header can never drift
 * out of alignment with the rows underneath it.
 */
const DAY_LEAD = "w-[210px] shrink-0";
const DAY_ROW_COLUMNS =
  "grid grid-cols-[40px_repeat(4,minmax(0,1fr))_104px_88px_96px] items-center gap-3";

/*
 * The hour table puts DMI and Yr side by side instead of stacked: one line per
 * hour, and every metric column is a DMI | Yr pair. Cloud cover and humidity
 * only fit once there is room for them.
 */
const HOUR_ROW_COLUMNS =
  "grid grid-cols-[44px_repeat(4,minmax(0,1fr))] items-center gap-x-2 sm:gap-x-4 lg:grid-cols-[64px_repeat(6,minmax(0,1fr))]";
/** Columns hidden below `lg`. */
const WIDE_ONLY = "hidden lg:grid";

export type DayData = {
  day: string;
  sun: SunTimes;
  summaries: Partial<Record<ProviderId, DaySummary>>;
  /** DMI's forecast UV-index maximum for the day, when it has one. */
  uv?: number;
};

export function DayListHeader() {
  return (
    <div className="hidden items-end gap-3 border-b border-line bg-surface-muted px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint lg:flex">
      <div className={DAY_LEAD}>Dag</div>
      <div className={`flex-1 ${DAY_ROW_COLUMNS}`}>
        <div />
        {DAY_PERIODS.map((period) => (
          <div key={period.id} className="text-center">
            {period.short}
          </div>
        ))}
        <div className="text-center">Høj / lav</div>
        <div className="text-center">Nedbør</div>
        <div className="text-center">Vind</div>
      </div>
      <div className="w-6 shrink-0" />
    </div>
  );
}

function PeriodIcons({ summary, size }: { summary: DaySummary; size: number }) {
  return (
    <>
      {DAY_PERIODS.map((period) => {
        const match = summary.periods.find((p) => p.id === period.id);
        return (
          <div key={period.id} className="flex justify-center">
            {match ? (
              <WeatherIcon
                condition={match.condition}
                night={match.isNight}
                size={size}
              />
            ) : (
              <span className="text-sm text-ink-faint">–</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function DesktopProviderRow({
  provider,
  summary,
}: {
  provider: ProviderId;
  summary: DaySummary | undefined;
}) {
  const styles = PROVIDER_STYLES[provider];

  if (!summary) {
    return (
      <div className={DAY_ROW_COLUMNS}>
        <ProviderTag provider={provider} className="opacity-50" />
        <div className="col-span-7 text-sm text-ink-faint">
          Ingen udsigt så langt frem
        </div>
      </div>
    );
  }

  return (
    <div className={DAY_ROW_COLUMNS}>
      <ProviderTag provider={provider} />
      <PeriodIcons summary={summary} size={30} />
      <div className={`numeric text-center ${styles.text}`}>
        <span className="text-lg font-semibold">
          {Math.round(summary.maxTemperature)}°
        </span>
        <span className="ml-1 text-sm opacity-70">
          {Math.round(summary.minTemperature)}°
        </span>
      </div>
      <div className={`numeric text-center text-sm ${styles.text}`}>
        {summary.totalPrecipitation >= 0.05
          ? `${summary.totalPrecipitation.toFixed(1)} mm`
          : "—"}
      </div>
      <div className={`numeric text-center text-sm ${styles.text}`}>
        {Math.round(summary.maxWindSpeed)} m/s
      </div>
    </div>
  );
}

export function DayCard({
  data,
  today,
  now,
  open,
  onToggle,
}: {
  data: DayData;
  today: string;
  now: Date;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const { day, sun, summaries, uv } = data;
  const spread = temperatureSpread(summaries.dmi ?? null, summaries.yr ?? null);
  const label = dayHeading(day, today);

  return (
    <div className="border-t border-line first:border-t-0">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-surface-muted"
        >
          {/* Desktop */}
          <div className="hidden items-center gap-3 lg:flex">
            <div className={DAY_LEAD}>
              <span className="block text-base font-semibold text-ink">
                {label}
              </span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <SunLine sun={sun} />
                {uv !== undefined && <UvBadge uv={uv} />}
              </div>
              {spread !== null && spread >= 1 && (
                <SpreadBadge spread={spread} className="mt-1.5" />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              {PROVIDER_IDS.map((provider) => (
                <DesktopProviderRow
                  key={provider}
                  provider={provider}
                  summary={summaries[provider]}
                />
              ))}
            </div>
            <div className="w-6 shrink-0 text-ink-muted">
              <ChevronIcon open={open} />
            </div>
          </div>

          {/* Mobile */}
          <div className="lg:hidden">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-ink">{label}</span>
              <span className="flex items-center gap-2">
                {spread !== null && spread >= 1 && (
                  <SpreadBadge spread={spread} />
                )}
                <span className="text-ink-muted">
                  <ChevronIcon open={open} />
                </span>
              </span>
            </div>
            <div className="space-y-1">
              {PROVIDER_IDS.map((provider) => {
                const summary = summaries[provider];
                if (!summary) {
                  return (
                    <div
                      key={provider}
                      className="flex items-center gap-2 py-1"
                    >
                      <ProviderTag provider={provider} className="opacity-50" />
                      <span className="text-xs text-ink-faint">
                        ingen udsigt så langt frem
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={provider}
                    className="grid grid-cols-[36px_repeat(4,minmax(0,1fr))_62px] items-center gap-1"
                  >
                    <ProviderTag provider={provider} />
                    <PeriodIcons summary={summary} size={26} />
                    <span
                      className={`numeric text-right text-sm ${PROVIDER_STYLES[provider].text}`}
                    >
                      <span className="font-semibold">
                        {Math.round(summary.maxTemperature)}°
                      </span>
                      <span className="opacity-70">
                        {" "}
                        {Math.round(summary.minTemperature)}°
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <SunLine sun={sun} />
              {uv !== undefined && <UvBadge uv={uv} />}
            </div>
          </div>
        </button>
      </h3>

      <div id={panelId} hidden={!open}>
        {open && <HourTable data={data} today={today} now={now} />}
      </div>
    </div>
  );
}

function SunLine({
  sun,
  className = "",
}: {
  sun: SunTimes;
  className?: string;
}) {
  return (
    <span
      className={`numeric flex items-center gap-1 text-xs text-ink-faint ${className}`}
    >
      <SunIcon />
      {sun.sunrise && sun.sunset ? (
        <>
          <span aria-hidden="true">↑</span> {formatClock(sun.sunrise)}
          <span className="mx-1" />
          <span aria-hidden="true">↓</span> {formatClock(sun.sunset)}
        </>
      ) : sun.polarNight ? (
        "Solen står ikke op"
      ) : (
        "Solen går ikke ned"
      )}
    </span>
  );
}

/**
 * DMI's UV-index badge: just the number, ringed in the colour of its band —
 * no "Moderate"/"High" label, the same visual-only treatment DMI itself uses.
 */
function UvBadge({ uv }: { uv: number }) {
  const color = uvColor(uv);
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-faint"
      title={`UV-indeks ${uv.toFixed(1)}`}
    >
      <SunIcon />
      UV
      <span
        className="numeric inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold leading-none"
        style={{ borderColor: color, color }}
      >
        {Math.round(uv)}
      </span>
    </span>
  );
}

/** How far apart the two providers are, when it is far enough to matter. */
function SpreadBadge({
  spread,
  className = "",
}: {
  spread: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn ${className}`}
      title="Største forskel mellem DMI's og Yr's temperaturer denne dag"
    >
      Uenige · {Math.round(spread)}°
    </span>
  );
}

function HourTable({
  data,
  today,
  now,
}: {
  data: DayData;
  today: string;
  now: Date;
}) {
  const slots = new Map<number, Partial<Record<ProviderId, HourlyForecast>>>();
  for (const provider of PROVIDER_IDS) {
    for (const hour of data.summaries[provider]?.hours ?? []) {
      const slot = slots.get(hour.hour) ?? {};
      slot[provider] = hour;
      slots.set(hour.hour, slot);
    }
  }
  const rows = [...slots.entries()].sort((a, b) => a[0] - b[0]);
  const coarse = PROVIDER_IDS.filter((p) => data.summaries[p]?.isCoarse);
  const currentHour = data.day === today ? zonedHour(now) : -1;

  return (
    <div className="border-t border-line bg-surface-muted/60">
      <div className="border-b border-line px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint sm:text-[11px] sm:tracking-wider">
        <div className={HOUR_ROW_COLUMNS}>
          <div>Tid</div>
          <HeaderCell label="Vejr" />
          <HeaderCell label="Temp." />
          <HeaderCell label="Nedbør" unit="mm" />
          <HeaderCell label="Vind" unit="m/s" />
          <HeaderCell label="Skyer" unit="%" className={WIDE_ONLY} />
          <HeaderCell label="Luftfugt." unit="%" className={WIDE_ONLY} />
        </div>
      </div>

      <div>
        {rows.map(([hour, slot]) => (
          <HourRow
            key={hour}
            hour={hour}
            slot={slot}
            day={data.day}
            sun={data.sun}
            highlighted={hour === currentHour}
          />
        ))}
      </div>

      {coarse.length > 0 && (
        <p className="border-t border-line px-4 py-2 text-xs text-ink-faint">
          {coarse.map((p) => (p === "dmi" ? "DMI" : "Yr")).join(" og ")} leverer
          kun 6-timers opløsning så langt frem, så ikke alle timer har en værdi.
        </p>
      )}
    </div>
  );
}

/** A metric's heading over its DMI | Yr pair of sub-columns. */
function HeaderCell({
  label,
  unit,
  className = "grid",
}: {
  label: string;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={`${className} grid-cols-2 gap-y-0.5 text-center`}>
      <div className="col-span-2 truncate">
        {label}
        {unit && (
          <span className="ml-1 hidden font-medium normal-case tracking-normal opacity-70 sm:inline">
            {unit}
          </span>
        )}
      </div>
      {PROVIDER_IDS.map((provider) => (
        <ProviderTag
          key={provider}
          provider={provider}
          className="text-[9px]"
        />
      ))}
    </div>
  );
}

/**
 * One metric for one hour: DMI's value on the left, Yr's on the right, each in
 * its provider's colour, split by a hairline. An hour a provider has no value
 * for (its coarse, 6-hourly range) shows a faint dot.
 */
function PairCell({
  slot,
  render,
  className = "grid",
}: {
  slot: Partial<Record<ProviderId, HourlyForecast>>;
  render: (entry: HourlyForecast, provider: ProviderId) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} grid-cols-2 divide-x divide-line`}>
      {PROVIDER_IDS.map((provider) => {
        const entry = slot[provider];
        return (
          <div
            key={provider}
            className={`numeric flex min-w-0 items-center justify-center gap-0.5 text-xs sm:text-sm ${PROVIDER_STYLES[provider].text}`}
          >
            {entry ? (
              render(entry, provider)
            ) : (
              <span className="text-ink-faint">·</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HourRow({
  hour,
  slot,
  day,
  sun,
  highlighted,
}: {
  hour: number;
  slot: Partial<Record<ProviderId, HourlyForecast>>;
  day: string;
  sun: SunTimes;
  highlighted: boolean;
}) {
  const night = isNight(instantFromZoned(day, hour), sun);

  return (
    <div
      className={`border-b border-line/70 px-4 py-1.5 last:border-b-0 ${
        highlighted ? "bg-surface ring-1 ring-inset ring-accent/40" : ""
      }`}
    >
      <div className={HOUR_ROW_COLUMNS}>
        <div className="numeric text-sm font-medium text-ink-muted">
          {formatHour(hour)}
          <span className="hidden sm:inline">:00</span>
          {highlighted && (
            <span className="ml-1 text-[10px] font-semibold uppercase text-accent">
              nu
            </span>
          )}
        </div>
        <PairCell
          slot={slot}
          render={(entry) => {
            const condition = conditionFor(entry);
            return (
              <span title={CONDITION_LABELS[condition]}>
                <WeatherIcon
                  condition={condition}
                  night={night}
                  size={22}
                  decorative
                />
              </span>
            );
          }}
        />
        <PairCell
          slot={slot}
          render={(entry) => (
            <span className="font-semibold">
              {Math.round(entry.temperature)}°
            </span>
          )}
        />
        <PairCell
          slot={slot}
          render={(entry) =>
            entry.precipitation >= 0.05 ? (
              entry.precipitation.toFixed(1)
            ) : (
              <span className="opacity-50">—</span>
            )
          }
        />
        <PairCell
          slot={slot}
          render={(entry) => (
            <>
              <WindArrow degrees={entry.windDirection} size={12} />
              {Math.round(entry.windSpeed)}
            </>
          )}
        />
        <PairCell
          slot={slot}
          className={WIDE_ONLY}
          render={(entry) => Math.round(entry.cloudCover)}
        />
        <PairCell
          slot={slot}
          className={WIDE_ONLY}
          render={(entry) => Math.round(entry.humidity)}
        />
      </div>
    </div>
  );
}
