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
  danishDate,
  formatClock,
  formatHour,
  instantFromZoned,
  relativeDayLabel,
  zonedHour,
} from "@/lib/weather/time";
import {
  type HourlyForecast,
  PROVIDER_IDS,
  type ProviderId,
} from "@/lib/weather/types";
import { ChevronIcon, PROVIDER_STYLES, ProviderTag, WindArrow } from "./ui";
import { WeatherIcon } from "./weather-icon";

/*
 * Each row is a fixed leading cell (the day, or the hour) followed by one grid
 * per provider sharing a single column template. The column templates are
 * declared once here and reused by the headers, so a header can never drift
 * out of alignment with the rows underneath it.
 */
const DAY_LEAD = "w-[150px] shrink-0";
const DAY_ROW_COLUMNS =
  "grid grid-cols-[40px_repeat(4,minmax(0,54px))_minmax(80px,1fr)_104px_88px_96px] items-center gap-3";

const HOUR_LEAD = "w-[68px] shrink-0";
const HOUR_ROW_COLUMNS =
  "grid grid-cols-[40px_44px_repeat(5,minmax(0,1fr))] items-center gap-3";

export type DayData = {
  day: string;
  sun: SunTimes;
  summaries: Partial<Record<ProviderId, DaySummary>>;
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
        <div>Spænd</div>
        <div className="text-center">Høj / lav</div>
        <div className="text-center">Nedbør</div>
        <div className="text-center">Vind</div>
      </div>
      <div className="w-6 shrink-0" />
    </div>
  );
}

function TemperatureBar({
  summary,
  provider,
  scaleMin,
  scaleMax,
}: {
  summary: DaySummary;
  provider: ProviderId;
  scaleMin: number;
  scaleMax: number;
}) {
  const span = Math.max(1, scaleMax - scaleMin);
  const left = Math.max(
    0,
    Math.min(100, ((summary.minTemperature - scaleMin) / span) * 100),
  );
  const width = Math.max(
    5,
    Math.min(
      100 - left,
      ((summary.maxTemperature - summary.minTemperature) / span) * 100,
    ),
  );
  return (
    <div className="h-1.5 w-full rounded-full bg-line" aria-hidden="true">
      <div
        className={`h-1.5 rounded-full ${PROVIDER_STYLES[provider].bar}`}
        style={{ marginLeft: `${left}%`, width: `${width}%` }}
      />
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
  scaleMin,
  scaleMax,
}: {
  provider: ProviderId;
  summary: DaySummary | undefined;
  scaleMin: number;
  scaleMax: number;
}) {
  const styles = PROVIDER_STYLES[provider];

  if (!summary) {
    return (
      <div className={DAY_ROW_COLUMNS}>
        <ProviderTag provider={provider} className="opacity-50" />
        <div className="col-span-8 text-sm text-ink-faint">
          Ingen udsigt så langt frem
        </div>
      </div>
    );
  }

  return (
    <div className={DAY_ROW_COLUMNS}>
      <ProviderTag provider={provider} />
      <PeriodIcons summary={summary} size={30} />
      <TemperatureBar
        summary={summary}
        provider={provider}
        scaleMin={scaleMin}
        scaleMax={scaleMax}
      />
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
  scaleMin,
  scaleMax,
  open,
  onToggle,
}: {
  data: DayData;
  today: string;
  now: Date;
  scaleMin: number;
  scaleMax: number;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const { day, sun, summaries } = data;
  const spread = temperatureSpread(summaries.dmi ?? null, summaries.yr ?? null);
  const label = relativeDayLabel(day, today);

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
              <span className="block text-sm text-ink-muted">
                {danishDate(day)}
              </span>
              <SunLine sun={sun} />
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
                  scaleMin={scaleMin}
                  scaleMax={scaleMax}
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
              <span className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-ink">
                  {label}
                </span>
                <span className="text-sm text-ink-muted">
                  {danishDate(day)}
                </span>
              </span>
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
            <SunLine sun={sun} className="mt-2" />
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
    <span className={`numeric block text-xs text-ink-faint ${className}`}>
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
      <div className="hidden items-end gap-3 border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint lg:flex">
        <div className={HOUR_LEAD}>Tid</div>
        <div className={`flex-1 ${HOUR_ROW_COLUMNS}`}>
          <div />
          <div className="text-center">Vejr</div>
          <div className="text-center">Temp.</div>
          <div className="text-center">Nedbør mm</div>
          <div className="text-center">Vind m/s</div>
          <div className="text-center">Skydække</div>
          <div className="text-center">Luftfugt.</div>
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
  const present = PROVIDER_IDS.filter((provider) => slot[provider]);

  return (
    <div
      className={`border-b border-line/70 px-4 py-2 last:border-b-0 ${
        highlighted ? "bg-surface ring-1 ring-inset ring-accent/40" : ""
      }`}
    >
      {/* Desktop */}
      <div className="hidden items-center gap-3 lg:flex">
        <div
          className={`numeric ${HOUR_LEAD} text-sm font-medium text-ink-muted`}
        >
          {formatHour(hour)}:00
          {highlighted && (
            <span className="ml-1 text-[10px] font-semibold uppercase text-accent">
              nu
            </span>
          )}
        </div>
        <div className="flex-1 space-y-1">
          {present.map((provider) => {
            const entry = slot[provider] as HourlyForecast;
            const condition = conditionFor(entry);
            const styles = PROVIDER_STYLES[provider];
            return (
              <div key={provider} className={HOUR_ROW_COLUMNS}>
                <ProviderTag provider={provider} />
                <div
                  className="flex justify-center"
                  title={CONDITION_LABELS[condition]}
                >
                  <WeatherIcon
                    condition={condition}
                    night={night}
                    size={24}
                    decorative
                  />
                </div>
                <div
                  className={`numeric text-center text-sm font-semibold ${styles.text}`}
                >
                  {Math.round(entry.temperature)}°
                </div>
                <div className={`numeric text-center text-sm ${styles.text}`}>
                  {entry.precipitation >= 0.05
                    ? entry.precipitation.toFixed(1)
                    : "—"}
                </div>
                <div
                  className={`numeric flex items-center justify-center gap-1 text-sm ${styles.text}`}
                >
                  <WindArrow degrees={entry.windDirection} />
                  {Math.round(entry.windSpeed)}
                </div>
                <div className={`numeric text-center text-sm ${styles.text}`}>
                  {Math.round(entry.cloudCover)}%
                </div>
                <div className={`numeric text-center text-sm ${styles.text}`}>
                  {Math.round(entry.humidity)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <div className="mb-1 flex items-center gap-2">
          <span className="numeric text-sm font-medium text-ink-muted">
            {formatHour(hour)}:00
          </span>
          {highlighted && (
            <span className="text-[10px] font-semibold uppercase text-accent">
              nu
            </span>
          )}
        </div>
        {present.map((provider) => {
          const entry = slot[provider] as HourlyForecast;
          const condition = conditionFor(entry);
          const styles = PROVIDER_STYLES[provider];
          return (
            <div
              key={provider}
              className="grid grid-cols-[36px_28px_44px_1fr_1fr] items-center gap-2 py-0.5"
            >
              <ProviderTag provider={provider} />
              <WeatherIcon
                condition={condition}
                night={night}
                size={22}
                decorative
              />
              <span className={`numeric text-sm font-semibold ${styles.text}`}>
                {Math.round(entry.temperature)}°
              </span>
              <span className={`numeric text-xs ${styles.text}`}>
                {entry.precipitation >= 0.05
                  ? `${entry.precipitation.toFixed(1)} mm`
                  : "0 mm"}
              </span>
              <span
                className={`numeric flex items-center gap-1 text-xs ${styles.text}`}
              >
                <WindArrow degrees={entry.windDirection} />
                {Math.round(entry.windSpeed)} m/s
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
