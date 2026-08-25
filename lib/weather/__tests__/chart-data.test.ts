import { describe, expect, it } from "vitest";
import { buildChartRows, resampleHourly } from "../chart-data";
import type { HourlyForecast } from "../types";

function hour(overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time: "2026-08-21T10:00:00.000Z",
    day: "2026-08-21",
    hour: 12,
    temperature: 15,
    precipitation: 0,
    windSpeed: 5,
    windDirection: 270,
    cloudCover: 50,
    humidity: 70,
    coversHours: 1,
    ...overrides,
  };
}

const HOUR_MS = 3_600_000;
const T0 = new Date("2026-08-21T10:00:00.000Z").getTime();

describe("resampleHourly", () => {
  it("passes hourly data through unchanged", () => {
    const hours = [
      hour({
        time: "2026-08-21T10:00:00.000Z",
        temperature: 10,
        precipitation: 1,
      }),
      hour({
        time: "2026-08-21T11:00:00.000Z",
        temperature: 12,
        precipitation: 2,
      }),
    ];
    const points = resampleHourly(hours, { start: T0, end: T0 + HOUR_MS });
    expect(points).toEqual([
      { time: T0, temp: 10, precip: 1 },
      { time: T0 + HOUR_MS, temp: 12, precip: 2 },
    ]);
  });

  it("linearly interpolates temperature across a coarse block", () => {
    const hours = [
      hour({
        time: "2026-08-21T10:00:00.000Z",
        temperature: 10,
        precipitation: 6,
        coversHours: 6,
      }),
      hour({ time: "2026-08-21T16:00:00.000Z", temperature: 22 }),
    ];
    const points = resampleHourly(hours, { start: T0, end: T0 + 6 * HOUR_MS });
    // Six hours from 10° to 22° is 2° per hour.
    expect(points.map((p) => p.temp)).toEqual([10, 12, 14, 16, 18, 20, 22]);
  });

  it("spreads a coarse block's precipitation evenly across its hours", () => {
    const hours = [
      hour({
        time: "2026-08-21T10:00:00.000Z",
        precipitation: 6,
        coversHours: 6,
      }),
    ];
    const points = resampleHourly(hours, { start: T0, end: T0 + 5 * HOUR_MS });
    expect(points.every((p) => p.precip === 1)).toBe(true);
  });

  it("returns null past the data it was given", () => {
    const hours = [hour({ time: "2026-08-21T10:00:00.000Z" })];
    const points = resampleHourly(hours, { start: T0, end: T0 + HOUR_MS });
    expect(points[1]).toEqual({ time: T0 + HOUR_MS, temp: null, precip: null });
  });

  it("returns null before any data starts", () => {
    const hours = [hour({ time: "2026-08-21T12:00:00.000Z" })];
    const points = resampleHourly(hours, { start: T0, end: T0 });
    expect(points).toEqual([{ time: T0, temp: null, precip: null }]);
  });

  it("returns an empty grid for no data", () => {
    expect(resampleHourly([], { start: T0, end: T0 + HOUR_MS })).toEqual([
      { time: T0, temp: null, precip: null },
      { time: T0 + HOUR_MS, temp: null, precip: null },
    ]);
  });
});

describe("buildChartRows", () => {
  it("zips both providers onto the same hourly grid by index", () => {
    const dmi = [
      hour({
        time: "2026-08-21T10:00:00.000Z",
        temperature: 10,
        precipitation: 1,
      }),
    ];
    const yr = [
      hour({
        time: "2026-08-21T10:00:00.000Z",
        temperature: 12,
        precipitation: 2,
      }),
    ];
    const rows = buildChartRows(dmi, yr, { start: T0, end: T0 });
    expect(rows).toEqual([
      { time: T0, dmiTemp: 10, dmiPrecip: 1, yrTemp: 12, yrPrecip: 2 },
    ]);
  });

  it("gives a row null values for a provider with no data at that hour", () => {
    const dmi = [hour({ time: "2026-08-21T10:00:00.000Z", temperature: 10 })];
    const rows = buildChartRows(dmi, [], { start: T0, end: T0 });
    expect(rows[0].yrTemp).toBeNull();
    expect(rows[0].yrPrecip).toBeNull();
  });
});
