import { describe, expect, it } from "vitest";
import {
  conditionFor,
  groupByDay,
  hourAt,
  summariseDay,
  temperatureSpread,
} from "../aggregate";
import { computeSunTimes } from "../sun";
import { instantFromZoned } from "../time";
import type { HourlyForecast } from "../types";

const SUN = computeSunTimes("2026-08-21", 55.6761, 12.5683);

function hour(
  hourOfDay: number,
  overrides: Partial<HourlyForecast> = {},
): HourlyForecast {
  return {
    time: instantFromZoned("2026-08-21", hourOfDay).toISOString(),
    day: "2026-08-21",
    hour: hourOfDay,
    temperature: 15,
    precipitation: 0,
    windSpeed: 5,
    windDirection: 270,
    cloudCover: 10,
    humidity: 70,
    coversHours: 1,
    ...overrides,
  };
}

describe("groupByDay", () => {
  it("buckets by the forecast day and sorts chronologically", () => {
    const grouped = groupByDay([
      hour(12),
      { ...hour(3), day: "2026-08-22" },
      hour(1),
    ]);
    expect([...grouped.keys()]).toEqual(["2026-08-21", "2026-08-22"]);
    expect(grouped.get("2026-08-21")?.map((h) => h.hour)).toEqual([1, 12]);
  });
});

describe("summariseDay", () => {
  const hours = [
    hour(3, { temperature: 11 }),
    hour(9, { temperature: 18, windSpeed: 9 }),
    hour(14, { temperature: 22, precipitation: 1.5, cloudCover: 90 }),
    hour(20, { temperature: 16, precipitation: 0.5, cloudCover: 90 }),
  ];

  it("reports the day's extremes and totals", () => {
    const summary = summariseDay("2026-08-21", hours, SUN);
    expect(summary?.minTemperature).toBe(11);
    expect(summary?.maxTemperature).toBe(22);
    expect(summary?.totalPrecipitation).toBeCloseTo(2, 6);
    expect(summary?.maxWindSpeed).toBe(9);
  });

  it("summarises one period per part of the day that has data", () => {
    const summary = summariseDay("2026-08-21", hours, SUN);
    expect(summary?.periods.map((period) => period.id)).toEqual([
      "night",
      "morning",
      "afternoon",
      "evening",
    ]);
  });

  it("omits periods with no data at all", () => {
    const summary = summariseDay("2026-08-21", [hour(14)], SUN);
    expect(summary?.periods.map((period) => period.id)).toEqual(["afternoon"]);
  });

  it("marks the night period as dark and the afternoon as light", () => {
    const summary = summariseDay("2026-08-21", hours, SUN);
    const byId = new Map(summary?.periods.map((p) => [p.id, p]));
    expect(byId.get("night")?.isNight).toBe(true);
    expect(byId.get("afternoon")?.isNight).toBe(false);
    // Sunset is 20:31, so the evening block's 21:00 midpoint is dark.
    expect(byId.get("evening")?.isNight).toBe(true);
  });

  it("flags a day built from six-hourly data as coarse", () => {
    const coarse = summariseDay(
      "2026-08-21",
      [hour(12, { coversHours: 6 })],
      SUN,
    );
    expect(coarse?.isCoarse).toBe(true);
    expect(summariseDay("2026-08-21", hours, SUN)?.isCoarse).toBe(false);
  });

  it("weights cloud cover by how many hours each entry covers", () => {
    // One clear hour against a six-hour overcast block should read as overcast,
    // not as the halfway house an unweighted mean would give.
    const summary = summariseDay(
      "2026-08-21",
      [
        hour(12, { cloudCover: 0 }),
        hour(13, { cloudCover: 100, coversHours: 6 }),
      ],
      SUN,
    );
    expect(summary?.periods[0].condition).toBe("cloudy");
  });

  it("returns null when there are no hours", () => {
    expect(summariseDay("2026-08-21", [], SUN)).toBeNull();
  });
});

describe("conditionFor", () => {
  it("prefers the provider's own symbol code", () => {
    expect(conditionFor(hour(12, { symbol: "heavyrain", cloudCover: 0 }))).toBe(
      "heavyrain",
    );
  });

  it("surfaces thunder out of a compound Yr code", () => {
    expect(conditionFor(hour(12, { symbol: "rainandthunder" }))).toBe(
      "thunder",
    );
  });

  it("falls back to deriving from cloud and rain when there is no symbol", () => {
    expect(conditionFor(hour(12, { cloudCover: 5 }))).toBe("clear");
    expect(conditionFor(hour(12, { cloudCover: 95 }))).toBe("cloudy");
    expect(conditionFor(hour(12, { precipitation: 3 }))).toBe("heavyrain");
  });

  it("falls back when the symbol code is one we do not know", () => {
    expect(
      conditionFor(hour(12, { symbol: "spaceweather", cloudCover: 95 })),
    ).toBe("cloudy");
  });

  it("calls it snow below freezing and sleet just above", () => {
    expect(conditionFor(hour(12, { precipitation: 1, temperature: -3 }))).toBe(
      "snow",
    );
    expect(conditionFor(hour(12, { precipitation: 1, temperature: 1.5 }))).toBe(
      "sleet",
    );
  });

  it("judges rate, not total, for a six-hour block", () => {
    // 1.2 mm spread over six hours is 0.2 mm/h — light rain, not the downpour
    // the same figure would be in a single hour.
    expect(conditionFor(hour(12, { precipitation: 1.2, coversHours: 6 }))).toBe(
      "lightrain",
    );
    expect(conditionFor(hour(12, { precipitation: 1.2 }))).toBe("rain");
    // Exactly 0.5 mm/h is the boundary, and counts as rain rather than light.
    expect(conditionFor(hour(12, { precipitation: 3, coversHours: 6 }))).toBe(
      "rain",
    );
  });
});

describe("temperatureSpread", () => {
  const a = summariseDay("2026-08-21", [hour(12, { temperature: 20 })], SUN);
  const b = summariseDay("2026-08-21", [hour(12, { temperature: 23 })], SUN);

  it("is the largest gap between the two providers", () => {
    expect(temperatureSpread(a, b)).toBe(3);
  });

  it("is null when only one provider has the day", () => {
    expect(temperatureSpread(a, null)).toBeNull();
    expect(temperatureSpread(null, null)).toBeNull();
  });
});

describe("hourAt", () => {
  const hours = [hour(12), hour(13), hour(14)];

  it("finds the nearest entry", () => {
    const found = hourAt(hours, instantFromZoned("2026-08-21", 13, 20));
    expect(found?.hour).toBe(13);
  });

  it("returns nothing when the nearest entry is hours away", () => {
    expect(hourAt(hours, instantFromZoned("2026-08-21", 22))).toBeNull();
  });

  it("returns nothing for an empty forecast", () => {
    expect(hourAt([], new Date())).toBeNull();
  });
});
