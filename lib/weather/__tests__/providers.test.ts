import { describe, expect, it } from "vitest";
import {
  buildDmiUrl,
  type DmiResponse,
  deaccumulate,
  normaliseDmi,
} from "../providers/dmi";
import { buildYrUrl, normaliseYr, type YrResponse } from "../providers/yr";

function dmiFeature(step: string, overrides: Record<string, number> = {}) {
  return {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [12.5683, 55.6761] as [number, number],
    },
    properties: {
      step,
      "temperature-2m": 288.15,
      "total-precipitation": 0,
      "wind-speed-10m": 5,
      "wind-dir-10m": 270,
      "fraction-of-cloud-cover": 0.5,
      "relative-humidity-2m": 70,
      ...overrides,
    },
  };
}

describe("normaliseDmi", () => {
  it("converts Kelvin to Celsius and cloud fractions to percentages", () => {
    const data: DmiResponse = {
      type: "FeatureCollection",
      features: [dmiFeature("2026-08-21T10:00:00Z")],
    };
    const [hour] = normaliseDmi(data);
    expect(hour.temperature).toBeCloseTo(15, 6);
    expect(hour.cloudCover).toBeCloseTo(50, 6);
  });

  it("places each hour on the Copenhagen calendar, not the UTC one", () => {
    const data: DmiResponse = {
      type: "FeatureCollection",
      features: [dmiFeature("2026-08-20T23:00:00Z")],
    };
    const [hour] = normaliseDmi(data);
    expect(hour.day).toBe("2026-08-21");
    expect(hour.hour).toBe(1);
  });

  it("sorts out-of-order features", () => {
    const data: DmiResponse = {
      type: "FeatureCollection",
      features: [
        dmiFeature("2026-08-21T12:00:00Z"),
        dmiFeature("2026-08-21T10:00:00Z"),
      ],
    };
    expect(normaliseDmi(data).map((hour) => hour.hour)).toEqual([12, 14]);
  });

  it("drops entries with no temperature rather than reporting a fake 0 °C", () => {
    const broken = dmiFeature("2026-08-21T11:00:00Z");
    delete (broken.properties as Record<string, unknown>)["temperature-2m"];
    const data: DmiResponse = {
      type: "FeatureCollection",
      features: [dmiFeature("2026-08-21T10:00:00Z"), broken],
    };
    expect(normaliseDmi(data)).toHaveLength(1);
  });

  it("returns an empty list for an empty response", () => {
    expect(normaliseDmi({ type: "FeatureCollection", features: [] })).toEqual(
      [],
    );
  });
});

describe("deaccumulate", () => {
  it("leaves an ordinary per-hour series alone", () => {
    expect(deaccumulate([0, 0.4, 0.1, 0, 1.2])).toEqual([0, 0.4, 0.1, 0, 1.2]);
  });

  it("leaves an all-zero series alone", () => {
    expect(deaccumulate([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("converts a never-decreasing series into per-step amounts", () => {
    // The first entry's accumulation began before the requested window, so it
    // has no honest per-step value and becomes zero.
    expect(deaccumulate([1.0, 1.5, 1.5, 3.0])).toEqual([0, 0.5, 0, 1.5]);
  });

  it("never produces a negative amount", () => {
    expect(deaccumulate([2, 2, 2, 5]).every((value) => value >= 0)).toBe(true);
  });
});

describe("buildDmiUrl", () => {
  it("asks for the requested window at the un-authenticated host", () => {
    const url = new URL(
      buildDmiUrl(55.6761, 12.5683, new Date("2026-08-21T10:00:00Z"), 7),
    );
    expect(url.host).toBe("opendataapi.dmi.dk");
    expect(url.searchParams.get("coords")).toBe("POINT(12.5683 55.6761)");
    expect(url.searchParams.get("datetime")).toBe(
      "2026-08-21T10:00:00.000Z/2026-08-28T10:00:00.000Z",
    );
    expect(url.searchParams.get("parameter-name")).toContain("temperature-2m");
  });
});

function yrEntry(
  time: string,
  options: {
    temperature?: number;
    oneHour?: number | null;
    sixHour?: number | null;
    symbol?: string;
  } = {},
): YrResponse["properties"]["timeseries"][number] {
  const {
    temperature = 15,
    oneHour = 0,
    sixHour = null,
    symbol = "cloudy",
  } = options;
  return {
    time,
    data: {
      instant: {
        details: {
          air_temperature: temperature,
          cloud_area_fraction: 80,
          relative_humidity: 70,
          wind_from_direction: 270,
          wind_speed: 5,
        },
      },
      ...(oneHour === null
        ? {}
        : {
            next_1_hours: {
              summary: { symbol_code: symbol },
              details: { precipitation_amount: oneHour },
            },
          }),
      ...(sixHour === null
        ? {}
        : {
            next_6_hours: {
              summary: { symbol_code: symbol },
              details: { precipitation_amount: sixHour },
            },
          }),
    },
  };
}

function yrResponse(
  entries: YrResponse["properties"]["timeseries"],
): YrResponse {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [12.5683, 55.6761, 10] },
    properties: {
      meta: { updated_at: "2026-08-21T10:00:00Z" },
      timeseries: entries,
    },
  };
}

describe("normaliseYr", () => {
  it("keeps Celsius and percentages as they arrive", () => {
    const [hour] = normaliseYr(
      yrResponse([yrEntry("2026-08-21T10:00:00Z", { temperature: 15.4 })]),
    );
    expect(hour.temperature).toBe(15.4);
    expect(hour.cloudCover).toBe(80);
  });

  it("carries the provider's own symbol code through", () => {
    const [hour] = normaliseYr(
      yrResponse([
        yrEntry("2026-08-21T10:00:00Z", { symbol: "partlycloudy_day" }),
      ]),
    );
    expect(hour.symbol).toBe("partlycloudy_day");
  });

  it("measures coverage from the gap to the next entry", () => {
    const hours = normaliseYr(
      yrResponse([
        yrEntry("2026-08-21T10:00:00Z", { oneHour: 0.2 }),
        yrEntry("2026-08-21T11:00:00Z", { oneHour: 0.3 }),
        // The resolution drops to six-hourly from here on.
        yrEntry("2026-08-21T12:00:00Z", { oneHour: null, sixHour: 3 }),
        yrEntry("2026-08-21T18:00:00Z", { oneHour: null, sixHour: 6 }),
      ]),
    );
    // The last entry has no successor, so it inherits the six-hour spacing of
    // the block before it.
    expect(hours.map((hour) => hour.coversHours)).toEqual([1, 1, 6, 6]);
  });

  it("prefers the one-hour precipitation block at hourly resolution", () => {
    const hours = normaliseYr(
      yrResponse([
        yrEntry("2026-08-21T10:00:00Z", { oneHour: 0.2, sixHour: 3 }),
        yrEntry("2026-08-21T11:00:00Z", { oneHour: 0.3, sixHour: 3 }),
      ]),
    );
    expect(hours[0].precipitation).toBe(0.2);
  });

  it("gives the final entry the spacing of the one before it", () => {
    const hours = normaliseYr(
      yrResponse([
        yrEntry("2026-08-21T06:00:00Z", { oneHour: null, sixHour: 6 }),
        yrEntry("2026-08-21T12:00:00Z", { oneHour: null, sixHour: 12 }),
      ]),
    );
    expect(hours[1].coversHours).toBe(6);
    expect(hours[1].precipitation).toBe(12);
  });

  it("spreads a six-hour total across a shorter gap instead of double counting", () => {
    const hours = normaliseYr(
      yrResponse([
        // Three-hourly entries whose six-hour windows overlap.
        yrEntry("2026-08-21T10:00:00Z", { oneHour: null, sixHour: 6 }),
        yrEntry("2026-08-21T13:00:00Z", { oneHour: null, sixHour: 6 }),
        yrEntry("2026-08-21T16:00:00Z", { oneHour: null, sixHour: 6 }),
      ]),
    );
    expect(hours[0].precipitation).toBe(3);
    expect(hours[1].precipitation).toBe(3);
  });

  it("drops entries with no temperature", () => {
    const broken = yrEntry("2026-08-21T11:00:00Z");
    delete (broken.data.instant.details as Record<string, unknown>)
      .air_temperature;
    expect(
      normaliseYr(yrResponse([yrEntry("2026-08-21T10:00:00Z"), broken])),
    ).toHaveLength(1);
  });

  it("survives a response with no timeseries at all", () => {
    expect(normaliseYr({} as YrResponse)).toEqual([]);
  });
});

describe("buildYrUrl", () => {
  it("requests the compact product with the given coordinates", () => {
    const url = new URL(buildYrUrl(55.6761, 12.5683));
    expect(url.host).toBe("api.met.no");
    expect(url.pathname).toBe("/weatherapi/locationforecast/2.0/compact");
    expect(url.searchParams.get("lat")).toBe("55.6761");
    expect(url.searchParams.get("lon")).toBe("12.5683");
  });
});
