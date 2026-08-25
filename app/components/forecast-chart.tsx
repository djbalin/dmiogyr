"use client";

import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { conditionFor } from "@/lib/weather/aggregate";
import { buildChartRows, type ChartRow } from "@/lib/weather/chart-data";
import { CONDITION_LABELS } from "@/lib/weather/conditions";
import type { Location } from "@/lib/weather/locations";
import { computeSunTimes, isNight } from "@/lib/weather/sun";
import {
  addDays,
  danishWeekday,
  formatClock,
  instantFromZoned,
  relativeDayLabel,
  startOfZonedDay,
  todayKey,
  zonedDayKey,
  zonedHour,
} from "@/lib/weather/time";
import {
  type ForecastResponse,
  type HourlyForecast,
  PROVIDER_IDS,
  PROVIDERS,
  type ProviderId,
} from "@/lib/weather/types";
import { PROVIDER_STYLES } from "./ui";
import { WeatherIcon } from "./weather-icon";

const MS_PER_HOUR = 3_600_000;
/** How far ahead the graph reaches — Yr's own horizon, the longer of the two. */
const HORIZON_DAYS = 9;
/** How often a weather icon sits above the chart. */
const ICON_STEP_HOURS = 6;
const CHART_MARGIN = { top: 8, right: 12, bottom: 0, left: 8 };
const Y_AXIS_WIDTH = 34;
/** Left/right inset of the chart's own plot area, so the icon and day-header
 * rows above it line up with the axes below rather than the card's edges. */
const PLOT_INSET = {
  left: Y_AXIS_WIDTH + CHART_MARGIN.left,
  right: CHART_MARGIN.right,
};

/**
 * Tailwind only emits a `--color-*` theme variable into the built CSS when it
 * finds the literal string somewhere in the source — building the name with
 * `` `var(--color-${provider})` `` hides it from that scan, and `--color-yr`
 * quietly disappears from the stylesheet even though `--color-dmi` (used
 * literally elsewhere, e.g. in the tide sparkline) survives. Spelling both out
 * here keeps them both in the build.
 */
const PROVIDER_COLOR_VAR: Record<ProviderId, string> = {
  dmi: "var(--color-dmi)",
  yr: "var(--color-yr)",
};

/**
 * The graph dmi.dk shows at the top of a location page — a day-by-day row of
 * weather icons over a temperature-and-precipitation chart, then a wind
 * panel — redrawn in this app's own visual language: soft gradient fills
 * instead of a grey zebra background, hairline dividers instead of heavy grid
 * lines, and the existing DMI-teal/Yr-indigo identity carried all the way
 * through instead of a single flat colour per line.
 *
 * Two stacked charts share one time axis for the temperature and
 * precipitation panels — different scales, so no dual-axis chart — synced
 * by `syncId` so their crosshair and tooltip move together.
 */
export function ForecastChart({
  forecasts,
  now,
  loading,
  location,
}: {
  forecasts: Partial<Record<ProviderId, ForecastResponse>>;
  now: Date;
  loading: boolean;
  location: Location;
}) {
  const [visible, setVisible] = useState<Record<ProviderId, boolean>>({
    dmi: true,
    yr: true,
  });

  const domain = useMemo(() => {
    const start = Math.floor(now.getTime() / MS_PER_HOUR) * MS_PER_HOUR;
    return { start, end: start + HORIZON_DAYS * 24 * MS_PER_HOUR };
  }, [now]);

  const rows = useMemo(
    () =>
      buildChartRows(
        forecasts.dmi?.hours ?? [],
        forecasts.yr?.hours ?? [],
        domain,
      ),
    [forecasts, domain],
  );

  const dayTicks = useMemo(() => {
    const ticks: number[] = [];
    const firstDay = zonedDayKey(new Date(domain.start));
    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const t = startOfZonedDay(addDays(firstDay, i)).getTime();
      if (t > domain.start && t <= domain.end) ticks.push(t);
    }
    return ticks;
  }, [domain]);

  const hasData: Record<ProviderId, boolean> = {
    dmi: rows.some((row) => row.dmiTemp !== null),
    yr: rows.some((row) => row.yrTemp !== null),
  };

  /** Whichever visible source is "first" carries the icon row — showing both
   * providers' icons at once would just be clutter; the chart underneath
   * still compares both in full colour. */
  const primary: ProviderId | null =
    visible.dmi && hasData.dmi ? "dmi" : visible.yr && hasData.yr ? "yr" : null;

  const dayHeaders = useMemo(() => {
    const today = todayKey(undefined, now);
    const headers: { time: number; day: string }[] = [];
    // Late in the day, "today" and tomorrow's boundary can be only an hour or
    // two apart — too little width for both labels. Drop "today"'s rather
    // than let them collide; the icons and chart still cover those hours.
    const MIN_GAP_MS = 14 * MS_PER_HOUR;
    if (!dayTicks[0] || dayTicks[0] - domain.start >= MIN_GAP_MS) {
      headers.push({
        time: domain.start,
        day: zonedDayKey(new Date(domain.start)),
      });
    }
    for (const t of dayTicks)
      headers.push({ time: t, day: zonedDayKey(new Date(t)) });
    return headers.map(({ time, day }) => ({
      time,
      // Full-length day names ("Torsdag · 27. aug.") only fit DMI's own
      // ~2-day-wide graph; at this 9-day zoom each day gets under 110px, so
      // "today" stays as a full label (nothing crowds its left edge) and
      // every other day is abbreviated to weekday + date.
      label:
        day === today
          ? relativeDayLabel(day, today)
          : `${danishWeekday(day).slice(0, 3)} ${Number(day.split("-")[2])}.`,
    }));
  }, [domain.start, dayTicks, now]);

  /** Every `ICON_STEP_HOURS` from the first such boundary in range, aligned to
   * the clock (00/06/12/18) rather than offset from "now" — both the icon row
   * and the hour labels below the chart hang off this same grid. */
  const sixHourTicks = useMemo(() => {
    const firstDay = zonedDayKey(new Date(domain.start));
    const startHour = zonedHour(new Date(domain.start));
    const alignedHour =
      Math.ceil(startHour / ICON_STEP_HOURS) * ICON_STEP_HOURS;
    let day = firstDay;
    let hour = alignedHour;
    if (hour >= 24) {
      hour -= 24;
      day = addDays(day, 1);
    }
    let t = instantFromZoned(day, hour).getTime();

    const ticks: number[] = [];
    while (t <= domain.end) {
      ticks.push(t);
      t += ICON_STEP_HOURS * MS_PER_HOUR;
    }
    return ticks;
  }, [domain]);

  const iconTicks = useMemo(() => {
    if (!primary) return [];
    const hours = forecasts[primary]?.hours ?? [];
    if (hours.length === 0) return [];
    return sixHourTicks
      .map((time) => ({ time, hour: nearestHour(hours, time) }))
      .filter(
        (tick): tick is { time: number; hour: HourlyForecast } =>
          tick.hour !== null,
      );
  }, [primary, forecasts, sixHourTicks]);

  const toggle = (provider: ProviderId) =>
    setVisible((previous) => ({
      ...previous,
      [provider]: !previous[provider],
    }));

  const empty =
    !loading && !((visible.dmi && hasData.dmi) || (visible.yr && hasData.yr));

  return (
    <section
      aria-label="Temperatur- og nedbørsgraf"
      className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Graf, {HORIZON_DAYS} døgn
        </h2>
        <div className="flex items-center gap-2">
          {PROVIDER_IDS.map((provider) => (
            <SourceToggle
              key={provider}
              provider={provider}
              active={visible[provider]}
              onToggle={() => toggle(provider)}
              disabled={!hasData[provider]}
            />
          ))}
        </div>
      </div>

      {empty ? (
        <p className="mt-6 py-10 text-center text-sm text-ink-faint">
          {!visible.dmi && !visible.yr
            ? "Vælg mindst én kilde for at se grafen."
            : "Ingen data at vise."}
        </p>
      ) : (
        <div className="mt-4">
          <PlotRow height={20}>
            {dayHeaders.map(({ time, label }) => (
              <span
                key={time}
                className="absolute top-0 whitespace-nowrap text-[13px] font-semibold text-ink"
                style={{ left: xPercent(time, domain) }}
              >
                {label}
              </span>
            ))}
          </PlotRow>

          <PlotRow height={26}>
            {iconTicks.map(({ time, hour }) => {
              const condition = conditionFor(hour);
              const sun = computeSunTimes(
                zonedDayKey(new Date(time)),
                location.lat,
                location.lon,
              );
              return (
                <span
                  key={time}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: xPercent(time, domain) }}
                  title={CONDITION_LABELS[condition]}
                >
                  <WeatherIcon
                    condition={condition}
                    night={isNight(new Date(time), sun)}
                    size={22}
                    decorative
                  />
                </span>
              );
            })}
          </PlotRow>

          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={rows} margin={CHART_MARGIN} syncId="forecast">
              <defs>
                <linearGradient id="dmiTempFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={PROVIDER_COLOR_VAR.dmi}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="42%"
                    stopColor={PROVIDER_COLOR_VAR.dmi}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="yrTempFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={PROVIDER_COLOR_VAR.yr}
                    stopOpacity={0.16}
                  />
                  <stop
                    offset="42%"
                    stopColor={PROVIDER_COLOR_VAR.yr}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-line)"
                strokeDasharray="0"
              />
              {dayTicks.map((t) => (
                <ReferenceLine
                  key={t}
                  x={t}
                  stroke="var(--color-line-strong)"
                />
              ))}
              <XAxis
                dataKey="time"
                type="number"
                domain={[domain.start, domain.end]}
                hide
              />
              <YAxis
                width={Y_AXIS_WIDTH}
                tickFormatter={(v: number) => `${Math.round(v)}°`}
                tick={{ fill: "var(--color-ink-faint)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip visible={visible} />} />
              {visible.yr && (
                <Area
                  dataKey="yrTemp"
                  stroke={PROVIDER_COLOR_VAR.yr}
                  strokeWidth={2.25}
                  fill="url(#yrTempFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              {visible.dmi && (
                <Area
                  dataKey="dmiTemp"
                  stroke={PROVIDER_COLOR_VAR.dmi}
                  strokeWidth={2.25}
                  fill="url(#dmiTempFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={rows} margin={CHART_MARGIN} syncId="forecast">
              {dayTicks.map((t) => (
                <ReferenceLine
                  key={t}
                  x={t}
                  stroke="var(--color-line-strong)"
                />
              ))}
              <XAxis
                dataKey="time"
                type="number"
                domain={[domain.start, domain.end]}
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={Y_AXIS_WIDTH}
                tick={{ fill: "var(--color-ink-faint)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}`}
              />
              <Tooltip
                content={() => null}
                cursor={{ fill: "var(--color-line)", opacity: 0.4 }}
              />
              {visible.dmi && (
                <Bar
                  dataKey="dmiPrecip"
                  fill={PROVIDER_COLOR_VAR.dmi}
                  radius={[1.5, 1.5, 0, 0]}
                  isAnimationActive={false}
                />
              )}
              {visible.yr && (
                <Bar
                  dataKey="yrPrecip"
                  fill={PROVIDER_COLOR_VAR.yr}
                  radius={[1.5, 1.5, 0, 0]}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>

          <PlotRow height={16}>
            {sixHourTicks.map((t) => (
              <span
                key={t}
                className="numeric absolute top-0 -translate-x-1/2 text-[10px] text-ink-faint"
                style={{ left: xPercent(t, domain) }}
              >
                {formatClock(new Date(t)).slice(0, 2)}
              </span>
            ))}
          </PlotRow>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        Nedbør vist som søjler pr. time; se tabellen nedenfor for de nøjagtige
        tal.
      </p>
    </section>
  );
}

/** A full-width row inset to line up with the chart's plot area beneath it. */
function PlotRow({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ paddingLeft: PLOT_INSET.left, paddingRight: PLOT_INSET.right }}
    >
      <div className="relative" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

function xPercent(
  time: number,
  domain: { start: number; end: number },
): string {
  const fraction = (time - domain.start) / (domain.end - domain.start);
  return `${Math.max(0, Math.min(100, fraction * 100))}%`;
}

/** The hour closest to `time`, or null past a three-hour reach. */
function nearestHour(
  hours: HourlyForecast[],
  time: number,
): HourlyForecast | null {
  let best: HourlyForecast | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hour of hours) {
    const distance = Math.abs(new Date(hour.time).getTime() - time);
    if (distance < bestDistance) {
      best = hour;
      bestDistance = distance;
    }
  }
  return bestDistance <= 3 * MS_PER_HOUR ? best : null;
}

function SourceToggle({
  provider,
  active,
  onToggle,
  disabled,
}: {
  provider: ProviderId;
  active: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const styles = PROVIDER_STYLES[provider];
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-line-strong bg-surface-muted text-ink"
          : "border-line bg-surface text-ink-faint"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${styles.dot} ${active ? "" : "opacity-30"}`}
      />
      {PROVIDERS[provider].name}
    </button>
  );
}

function ChartTooltip({
  active,
  payload,
  visible,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  visible: Record<ProviderId, boolean>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const entries = PROVIDER_IDS.filter(
    (provider) => visible[provider] && row[`${provider}Temp`] !== null,
  );
  if (entries.length === 0) return null;

  return (
    <div className="w-44 rounded-xl border border-line bg-surface-raised p-3 text-xs shadow-[var(--shadow)]">
      <p className="numeric mb-1.5 font-semibold text-ink">
        {formatClock(new Date(row.time))}
      </p>
      <dl className="space-y-1">
        {entries.map((provider) => {
          const temp = row[`${provider}Temp`];
          const precip = row[`${provider}Precip`];
          return (
            <div
              key={provider}
              className="flex items-center justify-between gap-2"
            >
              <dt className="flex items-center gap-1.5 text-ink-muted">
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: PROVIDER_COLOR_VAR[provider] }}
                />
                {PROVIDERS[provider].name}
              </dt>
              <dd className="numeric font-medium text-ink">
                {temp !== null && `${Math.round(temp)}°`}
                {precip !== null && precip >= 0.05 && (
                  <span className="ml-1 text-ink-faint">
                    {precip.toFixed(1)} mm
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
