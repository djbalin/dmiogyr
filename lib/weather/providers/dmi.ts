import { zonedDayKey, zonedHour } from "../time";
import type { HourlyForecast } from "../types";

/** The parameters we ask DMI's EDR API for. */
export const DMI_PARAMETERS = [
  "temperature-2m",
  "total-precipitation",
  "wind-speed-10m",
  "wind-dir-10m",
  "fraction-of-cloud-cover",
  "relative-humidity-2m",
] as const;

type DmiParameter = (typeof DMI_PARAMETERS)[number];

type DmiFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { step: string } & Partial<Record<DmiParameter, number>>;
};

export type DmiResponse = {
  type: "FeatureCollection";
  features: DmiFeature[];
};

const KELVIN = 273.15;

export function buildDmiUrl(
  lat: number,
  lon: number,
  from: Date,
  horizonDays: number,
): string {
  const until = new Date(from.getTime() + horizonDays * 86_400_000);
  const coords = `POINT(${lon} ${lat})`;
  const datetime = `${from.toISOString()}/${until.toISOString()}`;
  const query = new URLSearchParams({
    coords,
    crs: "crs84",
    "parameter-name": DMI_PARAMETERS.join(","),
    datetime,
    f: "GeoJSON",
  });
  // DMI moved their open data APIs to opendataapi.dmi.dk, which needs no
  // authentication. The old dmigw.govcloud.dk host still demands an API key
  // and is deprecated.
  // https://www.dmi.dk/friedata/dokumentation/forecast-data-edr-api
  return `https://opendataapi.dmi.dk/v1/forecastedr/collections/harmonie_dini_sf/position?${query}`;
}

/**
 * Turn a precipitation series that accumulates over the forecast into
 * per-step amounts.
 *
 * DMI's documentation does not make it unambiguous whether
 * `total-precipitation` arrives accumulated from the model's start or already
 * de-accumulated per step, and it has changed across API versions. Rather than
 * guess, detect it: a genuine per-hour series over a week of weather will fall
 * back to zero many times over, so a series that never once decreases and does
 * increase is accumulated. An all-zero series has no increases and is left
 * alone.
 */
export function deaccumulate(values: number[]): number[] {
  const increases = values.some((value, i) => i > 0 && value > values[i - 1]);
  const decreases = values.some((value, i) => i > 0 && value < values[i - 1]);
  if (!increases || decreases) return values;
  // The first entry's accumulation started before the window we asked for, so
  // there is no honest per-step value for it: call it zero rather than
  // reporting a week of rain as falling in the first hour.
  return values.map((value, i) =>
    i === 0 ? 0 : Math.max(0, value - values[i - 1]),
  );
}

export function normaliseDmi(data: DmiResponse): HourlyForecast[] {
  const features = (data.features ?? [])
    // An entry with no timestamp or no temperature cannot be placed on the
    // grid or drawn; dropping it beats rendering a fabricated 0 °C.
    .filter(
      (feature) =>
        Boolean(feature?.properties?.step) &&
        typeof feature.properties["temperature-2m"] === "number",
    )
    .sort((a, b) => a.properties.step.localeCompare(b.properties.step));

  if (features.length === 0) return [];

  const precipitation = deaccumulate(
    features.map((feature) => feature.properties["total-precipitation"] ?? 0),
  );

  return features.map((feature, index) => {
    const time = new Date(feature.properties.step);
    const properties = feature.properties;
    return {
      time: time.toISOString(),
      day: zonedDayKey(time),
      hour: zonedHour(time),
      // DMI reports temperature in Kelvin and cloud cover as a fraction of one.
      temperature: (properties["temperature-2m"] as number) - KELVIN,
      precipitation: precipitation[index],
      windSpeed: properties["wind-speed-10m"] ?? 0,
      windDirection: properties["wind-dir-10m"] ?? 0,
      cloudCover: (properties["fraction-of-cloud-cover"] ?? 0) * 100,
      humidity: properties["relative-humidity-2m"] ?? 0,
      // DMI publishes no symbol codes, so the icon is derived from these
      // values at render time.
      coversHours: 1,
    };
  });
}
