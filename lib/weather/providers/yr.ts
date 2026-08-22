import { zonedDayKey, zonedHour } from "../time";
import type { HourlyForecast } from "../types";

type YrBlock = {
  summary?: { symbol_code?: string };
  details?: { precipitation_amount?: number };
};

export type YrEntry = {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature?: number;
        cloud_area_fraction?: number;
        relative_humidity?: number;
        wind_from_direction?: number;
        wind_speed?: number;
      };
    };
    next_1_hours?: YrBlock;
    next_6_hours?: YrBlock;
    next_12_hours?: YrBlock;
  };
};

export type YrResponse = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number, number] };
  properties: {
    meta: { updated_at: string };
    timeseries: YrEntry[];
  };
};

export function buildYrUrl(lat: number, lon: number, altitude = 10): string {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    altitude: String(Math.round(altitude)),
  });
  return `https://api.met.no/weatherapi/locationforecast/2.0/compact?${query}`;
}

/**
 * MET Norway requires an identifying User-Agent naming the application and a
 * way to contact whoever runs it. Deployments should set WEATHER_CONTACT to
 * their own address; the fallback names this repository.
 * https://developer.yr.no/doc/TermsOfService/
 */
export function yrUserAgent(): string {
  const contact = process.env.WEATHER_CONTACT ?? "github.com/djbalin/dmiogyr";
  return `dmiogyr-weather/1.0 (${contact})`;
}

const MS_PER_HOUR = 3_600_000;

/** Whole hours between two timeseries entries, or null if either is missing. */
function hoursBetween(
  from: YrEntry | undefined,
  to: YrEntry | undefined,
): number | null {
  if (!from || !to) return null;
  const hours = Math.round(
    (new Date(to.time).getTime() - new Date(from.time).getTime()) / MS_PER_HOUR,
  );
  return hours > 0 ? hours : null;
}

/**
 * Normalise Yr's timeseries.
 *
 * Yr reports hourly for roughly the first two days and six-hourly after that,
 * so each entry covers a different span. The span is measured from the gap to
 * the next entry rather than from which `next_N_hours` block is present, which
 * keeps it correct if MET changes the resolution schedule.
 *
 * Precipitation is taken from the block that matches the gap. Where only a
 * six-hour block is available but the entries are closer together than six
 * hours, the amount is spread evenly across the gap: the six-hour windows of
 * consecutive entries overlap, and splitting them proportionally keeps daily
 * totals from being counted twice.
 */
export function normaliseYr(data: YrResponse): HourlyForecast[] {
  const entries = (data?.properties?.timeseries ?? [])
    .filter(
      (entry) =>
        typeof entry?.data?.instant?.details?.air_temperature === "number",
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  return entries.map((entry, index) => {
    const time = new Date(entry.time);
    const next = entries[index + 1];
    const previous = entries[index - 1];
    // The final entry has no successor to measure against, so it inherits the
    // spacing of the one before it — otherwise the last six-hour block of the
    // forecast would be reported as covering a single hour.
    const gapHours =
      hoursBetween(entry, next) ?? hoursBetween(previous, entry) ?? 1;

    const oneHour = entry.data.next_1_hours;
    const sixHour = entry.data.next_6_hours;

    let precipitation = 0;
    let coversHours = gapHours;
    if (oneHour?.details?.precipitation_amount !== undefined && gapHours <= 1) {
      precipitation = oneHour.details.precipitation_amount;
      coversHours = 1;
    } else if (sixHour?.details?.precipitation_amount !== undefined) {
      precipitation =
        sixHour.details.precipitation_amount * (Math.min(gapHours, 6) / 6);
    } else if (oneHour?.details?.precipitation_amount !== undefined) {
      precipitation = oneHour.details.precipitation_amount;
      coversHours = 1;
    }

    const instant = entry.data.instant.details;
    const symbol =
      oneHour?.summary?.symbol_code ??
      sixHour?.summary?.symbol_code ??
      entry.data.next_12_hours?.summary?.symbol_code;

    return {
      time: time.toISOString(),
      day: zonedDayKey(time),
      hour: zonedHour(time),
      temperature: instant.air_temperature as number,
      precipitation,
      windSpeed: instant.wind_speed ?? 0,
      windDirection: instant.wind_from_direction ?? 0,
      // Yr already reports cloud cover as a percentage.
      cloudCover: instant.cloud_area_fraction ?? 0,
      humidity: instant.relative_humidity ?? 0,
      symbol,
      coversHours,
    };
  });
}
