import { APPROXIMATE_CLOUD_COVER, conditionFromDmiSymbol } from "../conditions";
import { zonedDayKey, zonedHour } from "../time";
import type { HourlyForecast } from "../types";

/**
 * One entry of DMI's own `timeserie`. Field names are DMI's, undocumented
 * outside their own frontend — this is the shape returned by the endpoint
 * dmi.dk's own location pages call, reverse-engineered from its network
 * traffic (opendataapi.dmi.dk's public EDR API, previously used here, had
 * stopped returning usable forecasts).
 */
type DmiTimeserieEntry = {
  /** Local time with UTC offset, e.g. "2026-08-22T20:00:00+02:00". */
  localTimeIso: string;
  /** Degrees Celsius. */
  temp: number;
  /** DMI's own numeric weather-symbol code; see `conditionFromDmiSymbol`. */
  symbol: number;
  /** Millimetres in the hour starting at this entry. */
  precip1: number;
  /** Millimetres over the 3 hours starting at this entry. */
  precip3?: number;
  /** Millimetres over the 6 hours starting at this entry. */
  precip6?: number;
  /** Compass direction the wind blows *from*, in degrees. */
  windDegree: number;
  /** Metres per second. */
  windSpeed: number;
  /** Percent, 0-100. */
  humidity: number;
  /** Metres. */
  visibility?: number;
};

export type DmiResponse = {
  id: string;
  city: string;
  timezone: string;
  timeserie: DmiTimeserieEntry[];
};

/**
 * DMI's own site is keyed by GeoNames id rather than by coordinates — see
 * `Location.dmiGeonameId`.
 */
export function buildDmiUrl(geonameId: number): string {
  return `https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=llj&id=${geonameId}`;
}

const MS_PER_HOUR = 3_600_000;

/** Whole hours between two entries. */
function hoursBetween(
  from: DmiTimeserieEntry | undefined,
  to: DmiTimeserieEntry | undefined,
): number | null {
  if (!from || !to) return null;
  const hours = Math.round(
    (new Date(to.localTimeIso).getTime() -
      new Date(from.localTimeIso).getTime()) /
      MS_PER_HOUR,
  );
  return hours > 0 ? hours : null;
}

/**
 * The precipitation amount matching a gap of `coversHours`, preferring the
 * narrowest window DMI reports that still covers it. Falls back to scaling
 * the widest window available when the gap is wider than any of them (should
 * not happen in practice, but better than silently dropping rain).
 */
function precipitationFor(
  entry: DmiTimeserieEntry,
  coversHours: number,
): number {
  if (coversHours <= 1) return entry.precip1 ?? 0;
  if (coversHours <= 3 && entry.precip3 !== undefined) return entry.precip3;
  if (entry.precip6 !== undefined) {
    return coversHours <= 6 ? entry.precip6 : entry.precip6 * (coversHours / 6);
  }
  return entry.precip3 ?? entry.precip1 ?? 0;
}

export function normaliseDmi(data: DmiResponse): HourlyForecast[] {
  const entries = (data?.timeserie ?? [])
    .filter(
      (entry) => Boolean(entry?.localTimeIso) && typeof entry.temp === "number",
    )
    .sort((a, b) => a.localTimeIso.localeCompare(b.localTimeIso));

  return entries.map((entry, index) => {
    const time = new Date(entry.localTimeIso);
    const next = entries[index + 1];
    const previous = entries[index - 1];
    // DMI's own resolution degrades from hourly to 3-hourly to 6-hourly over
    // the forecast window; the last entry inherits the spacing of the one
    // before it, for want of a successor to measure against.
    const coversHours =
      hoursBetween(entry, next) ?? hoursBetween(previous, entry) ?? 1;
    const precipitation = precipitationFor(entry, coversHours);
    const symbol = String(entry.symbol);
    // DMI's `llj` feed carries no cloud-cover field, unlike the EDR API this
    // replaces. Approximate it from the symbol's condition rather than
    // showing a fabricated 0%.
    const condition = conditionFromDmiSymbol(symbol, {
      precipitation,
      visibility: entry.visibility,
    });
    const cloudCover = condition ? APPROXIMATE_CLOUD_COVER[condition] : 50;

    return {
      time: time.toISOString(),
      day: zonedDayKey(time),
      hour: zonedHour(time),
      temperature: entry.temp,
      precipitation,
      windSpeed: entry.windSpeed ?? 0,
      windDirection: entry.windDegree ?? 0,
      cloudCover,
      humidity: entry.humidity ?? 0,
      visibility: entry.visibility,
      symbol,
      coversHours,
    };
  });
}
