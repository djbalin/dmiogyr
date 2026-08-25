import type { HourlyForecast } from "./types";

const MS_PER_HOUR = 3_600_000;

export type Domain = { start: number; end: number };

/** One provider's value at one point on the hourly grid, or null past its data. */
type HourlyPoint = { time: number; temp: number | null; precip: number | null };

/**
 * Put a provider's hours — which may run hourly, then 3-hourly, then
 * 6-hourly the further out the forecast reaches — onto a plain hourly grid
 * spanning `domain`, so the chart always has one point per full clock hour.
 *
 * Temperature is linearly interpolated between the two real readings either
 * side of an hour that has no reading of its own. Precipitation is spread
 * evenly across a coarse block's covered hours (a 6-hour block reporting
 * 6 mm reads as 1 mm/hour) rather than dumping the whole total on its first
 * hour — the same assumption the day table's "6-timers opløsning" note
 * already asks the reader to make.
 */
export function resampleHourly(
  hours: HourlyForecast[],
  domain: Domain,
): HourlyPoint[] {
  const points: HourlyPoint[] = [];
  let i = 0;

  for (let t = domain.start; t <= domain.end; t += MS_PER_HOUR) {
    while (i + 1 < hours.length && new Date(hours[i + 1].time).getTime() <= t) {
      i++;
    }
    const entry = hours[i];
    if (!entry) {
      points.push({ time: t, temp: null, precip: null });
      continue;
    }

    const entryStart = new Date(entry.time).getTime();
    const entryEnd = entryStart + entry.coversHours * MS_PER_HOUR;
    if (t < entryStart || t >= entryEnd) {
      points.push({ time: t, temp: null, precip: null });
      continue;
    }

    const next = hours[i + 1];
    let temp = entry.temperature;
    if (next) {
      const nextStart = new Date(next.time).getTime();
      const span = nextStart - entryStart;
      if (span > 0) {
        const fraction = (t - entryStart) / span;
        temp =
          entry.temperature + (next.temperature - entry.temperature) * fraction;
      }
    }

    points.push({
      time: t,
      temp,
      precip: entry.precipitation / entry.coversHours,
    });
  }

  return points;
}

export type ChartRow = {
  time: number;
  dmiTemp: number | null;
  yrTemp: number | null;
  dmiPrecip: number | null;
  yrPrecip: number | null;
};

/** Both providers' hours, resampled onto one shared hourly grid for the chart. */
export function buildChartRows(
  dmiHours: HourlyForecast[],
  yrHours: HourlyForecast[],
  domain: Domain,
): ChartRow[] {
  const dmi = resampleHourly(dmiHours, domain);
  const yr = resampleHourly(yrHours, domain);
  return dmi.map((point, index) => ({
    time: point.time,
    dmiTemp: point.temp,
    dmiPrecip: point.precip,
    yrTemp: yr[index]?.temp ?? null,
    yrPrecip: yr[index]?.precip ?? null,
  }));
}
