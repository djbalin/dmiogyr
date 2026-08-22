import { describe, expect, it } from "vitest";
import { buildDmiUrl, type DmiResponse, normaliseDmi } from "../providers/dmi";
import { buildYrUrl, normaliseYr, type YrResponse } from "../providers/yr";

function dmiEntry(
  localTimeIso: string,
  overrides: Record<string, number> = {},
) {
  return {
    localTimeIso,
    temp: 15,
    symbol: 1,
    precip1: 0,
    windSpeed: 5,
    windDegree: 270,
    humidity: 70,
    visibility: 25_000,
    ...overrides,
  };
}

function dmiResponse(timeserie: ReturnType<typeof dmiEntry>[]): DmiResponse {
  return {
    id: "2614481",
    city: "Roskilde",
    timezone: "Europe/Copenhagen",
    timeserie,
  };
}

describe("normaliseDmi", () => {
  it("keeps Celsius as it arrives, since DMI's own feed is already Celsius", () => {
    const data = dmiResponse([
      dmiEntry("2026-08-21T10:00:00+02:00", { temp: 15 }),
    ]);
    const [hour] = normaliseDmi(data);
    expect(hour.temperature).toBe(15);
  });

  it("places each hour on the Copenhagen calendar, from the local-time field", () => {
    const data = dmiResponse([dmiEntry("2026-08-21T01:00:00+02:00")]);
    const [hour] = normaliseDmi(data);
    expect(hour.day).toBe("2026-08-21");
    expect(hour.hour).toBe(1);
  });

  it("sorts out-of-order entries", () => {
    const data = dmiResponse([
      dmiEntry("2026-08-21T12:00:00+02:00"),
      dmiEntry("2026-08-21T10:00:00+02:00"),
    ]);
    expect(normaliseDmi(data).map((hour) => hour.hour)).toEqual([10, 12]);
  });

  it("drops entries with no temperature rather than reporting a fake 0 °C", () => {
    const broken = dmiEntry("2026-08-21T11:00:00+02:00");
    delete (broken as Record<string, unknown>).temp;
    const data = dmiResponse([dmiEntry("2026-08-21T10:00:00+02:00"), broken]);
    expect(normaliseDmi(data)).toHaveLength(1);
  });

  it("returns an empty list for an empty response", () => {
    expect(
      normaliseDmi({
        id: "0",
        city: "",
        timezone: "Europe/Copenhagen",
        timeserie: [],
      }),
    ).toEqual([]);
  });

  it("measures coverage from the gap to the next entry, as DMI's resolution degrades", () => {
    const hours = normaliseDmi(
      dmiResponse([
        dmiEntry("2026-08-21T10:00:00+02:00"),
        dmiEntry("2026-08-21T11:00:00+02:00"),
        // Resolution drops to three-hourly, then six-hourly.
        dmiEntry("2026-08-21T14:00:00+02:00", { precip3: 1.5 }),
        dmiEntry("2026-08-21T20:00:00+02:00", { precip6: 3 }),
      ]),
    );
    expect(hours.map((hour) => hour.coversHours)).toEqual([1, 3, 6, 6]);
  });

  it("takes the precipitation window matching the gap rather than always precip1", () => {
    const hours = normaliseDmi(
      dmiResponse([
        // A 3-hour gap to the next entry: precip3, not precip1, is the
        // honest total for the window this entry covers.
        dmiEntry("2026-08-21T10:00:00+02:00", { precip1: 0.2, precip3: 1.2 }),
        dmiEntry("2026-08-21T13:00:00+02:00", { precip1: 0.1 }),
      ]),
    );
    expect(hours[0].precipitation).toBe(1.2);
  });

  it("derives a condition from its own symbol code, distinct from a bare cloud/precip guess", () => {
    // Symbol 63 is DMI's "rain" code; without it the same cloud cover and a
    // dry hour would read as merely cloudy.
    const [hour] = normaliseDmi(
      dmiResponse([
        dmiEntry("2026-08-21T10:00:00+02:00", { symbol: 63, precip1: 0 }),
      ]),
    );
    expect(hour.symbol).toBe("63");
  });
});

describe("buildDmiUrl", () => {
  it("asks dmi.dk's own frontend endpoint for the given GeoNames id", () => {
    const url = new URL(buildDmiUrl(2614481));
    expect(url.host).toBe("www.dmi.dk");
    expect(url.pathname).toBe("/NinJo2DmiDk/ninjo2dmidk");
    expect(url.searchParams.get("cmd")).toBe("llj");
    expect(url.searchParams.get("id")).toBe("2614481");
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
