import {
  type Condition,
  conditionFromDmiSymbol,
  conditionFromYrSymbol,
  deriveCondition,
} from "./conditions";
import { isNight, type SunTimes } from "./sun";
import { instantFromZoned } from "./time";
import type { HourlyForecast } from "./types";

/** The four blocks a day is summarised into on the day rows. */
export const DAY_PERIODS = [
  { id: "night", label: "Nat", short: "Nat", from: 0, to: 6 },
  { id: "morning", label: "Morgen", short: "Morg.", from: 6, to: 12 },
  { id: "afternoon", label: "Eftermiddag", short: "Efterm.", from: 12, to: 18 },
  { id: "evening", label: "Aften", short: "Aften", from: 18, to: 24 },
] as const;

export type PeriodId = (typeof DAY_PERIODS)[number]["id"];

export type PeriodSummary = {
  id: PeriodId;
  condition: Condition;
  isNight: boolean;
  /** Warmest hour in the period, rounded at render time. */
  temperature: number;
  precipitation: number;
};

export type DaySummary = {
  day: string;
  hours: HourlyForecast[];
  minTemperature: number;
  maxTemperature: number;
  totalPrecipitation: number;
  maxWindSpeed: number;
  periods: PeriodSummary[];
  /** True when the day is described by 6-hourly rather than hourly data. */
  isCoarse: boolean;
};

/** Group hours into calendar days, preserving chronological order. */
export function groupByDay(
  hours: HourlyForecast[],
): Map<string, HourlyForecast[]> {
  const days = new Map<string, HourlyForecast[]>();
  for (const hour of [...hours].sort((a, b) => a.time.localeCompare(b.time))) {
    const bucket = days.get(hour.day);
    if (bucket) bucket.push(hour);
    else days.set(hour.day, [hour]);
  }
  return days;
}

/**
 * The condition carried by an entry's own symbol code, trying both
 * providers' schemes — Yr's are alphabetic ("partlycloudy_day"), DMI's
 * numeric, so there is no ambiguity in trying both.
 */
function symbolCondition(hour: HourlyForecast): Condition | null {
  if (!hour.symbol) return null;
  return (
    conditionFromYrSymbol(hour.symbol) ??
    conditionFromDmiSymbol(hour.symbol, {
      precipitation: hour.precipitation,
      visibility: hour.visibility,
    })
  );
}

/** The condition an entry should be drawn with. */
export function conditionFor(hour: HourlyForecast): Condition {
  return symbolCondition(hour) ?? deriveCondition(hour);
}

/**
 * Summarise a period of the day.
 *
 * Cloud cover is averaged weighted by how many hours each entry covers, so a
 * single six-hour Yr block does not count the same as one DMI hour. The
 * condition comes from the entry that best characterises the period: whichever
 * has the most precipitation, falling back to the middle of the period when it
 * is dry.
 */
function summarisePeriod(
  id: PeriodId,
  hours: HourlyForecast[],
  sun: SunTimes,
  day: string,
  from: number,
  to: number,
): PeriodSummary | null {
  const inPeriod = hours.filter((h) => h.hour >= from && h.hour < to);
  if (inPeriod.length === 0) return null;

  const midpoint = instantFromZoned(day, Math.floor((from + to) / 2));
  const night = isNight(midpoint, sun);

  const wettest = inPeriod.reduce((worst, hour) =>
    hour.precipitation / Math.max(1, hour.coversHours) >
    worst.precipitation / Math.max(1, worst.coversHours)
      ? hour
      : worst,
  );

  const totalCoverage = inPeriod.reduce(
    (sum, hour) => sum + Math.max(1, hour.coversHours),
    0,
  );
  const cloudCover =
    inPeriod.reduce(
      (sum, hour) => sum + hour.cloudCover * Math.max(1, hour.coversHours),
      0,
    ) / totalCoverage;

  const precipitation = inPeriod.reduce((sum, h) => sum + h.precipitation, 0);
  const temperature = Math.max(...inPeriod.map((h) => h.temperature));

  // Prefer the provider's own symbol for the wettest hour; otherwise describe
  // the period from its averaged sky and its heaviest precipitation.
  const condition =
    symbolCondition(wettest) ??
    deriveCondition({
      cloudCover,
      precipitation: wettest.precipitation,
      coversHours: wettest.coversHours,
      temperature: wettest.temperature,
    });

  return { id, condition, isNight: night, temperature, precipitation };
}

/** Build the day-row summary for one provider's hours on one day. */
export function summariseDay(
  day: string,
  hours: HourlyForecast[],
  sun: SunTimes,
): DaySummary | null {
  if (hours.length === 0) return null;

  const temperatures = hours.map((h) => h.temperature);
  const periods: PeriodSummary[] = [];
  for (const period of DAY_PERIODS) {
    const summary = summarisePeriod(
      period.id,
      hours,
      sun,
      day,
      period.from,
      period.to,
    );
    if (summary) periods.push(summary);
  }

  return {
    day,
    hours,
    minTemperature: Math.min(...temperatures),
    maxTemperature: Math.max(...temperatures),
    totalPrecipitation: hours.reduce((sum, h) => sum + h.precipitation, 0),
    maxWindSpeed: Math.max(...hours.map((h) => h.windSpeed)),
    periods,
    isCoarse: hours.some((h) => h.coversHours > 1),
  };
}

/**
 * How far apart the two providers are on a given day, in degrees.
 *
 * This is the number the app exists to show: two forecasts side by side are
 * only interesting insofar as they disagree, so the disagreement gets its own
 * figure rather than being left for the reader to subtract by eye.
 */
export function temperatureSpread(
  a: DaySummary | null,
  b: DaySummary | null,
): number | null {
  if (!a || !b) return null;
  return Math.max(
    Math.abs(a.maxTemperature - b.maxTemperature),
    Math.abs(a.minTemperature - b.minTemperature),
  );
}

/** The forecast entry covering `at`, if the provider has one. */
export function hourAt(
  hours: HourlyForecast[],
  at: Date,
): HourlyForecast | null {
  const target = at.getTime();
  let best: HourlyForecast | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hour of hours) {
    const distance = Math.abs(new Date(hour.time).getTime() - target);
    if (distance < bestDistance) {
      best = hour;
      bestDistance = distance;
    }
  }
  // Anything more than three hours from the requested time is not "now".
  return bestDistance <= 3 * 3_600_000 ? best : null;
}
