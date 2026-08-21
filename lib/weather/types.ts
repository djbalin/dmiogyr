/** Provider identifiers. Order here is the order they appear in the UI. */
export const PROVIDER_IDS = ["dmi", "yr"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderMeta = {
  id: ProviderId;
  /** Short label used in headers and legends. */
  name: string;
  /** One-line description shown in the legend. */
  description: string;
  /** Forecast horizon we ask the upstream API for, in days. */
  horizonDays: number;
  attribution: { label: string; href: string };
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  dmi: {
    id: "dmi",
    name: "DMI",
    description: "HARMONIE DINI · høj opløsning over Norden",
    horizonDays: 7,
    attribution: { label: "DMI", href: "https://www.dmi.dk/" },
  },
  yr: {
    id: "yr",
    name: "Yr",
    description: "MET Norway · global model",
    horizonDays: 9,
    attribution: { label: "MET Norway (Yr)", href: "https://www.yr.no/" },
  },
};

/**
 * A single hour of forecast, normalised across providers.
 *
 * `time` is an ISO-8601 instant in UTC. Everything derived from it that the
 * user sees (which day it belongs to, which hour it is shown as) is computed
 * in the forecast's timezone — never in the viewer's — so that a user abroad
 * sees the same day boundaries as a user in Copenhagen.
 */
export type HourlyForecast = {
  /** ISO-8601 UTC instant, e.g. "2026-08-21T13:00:00.000Z". */
  time: string;
  /** Calendar day in the forecast timezone, "YYYY-MM-DD". */
  day: string;
  /** Hour of day in the forecast timezone, 0-23. */
  hour: number;
  /** Degrees Celsius. */
  temperature: number;
  /** Millimetres of precipitation during this hour. */
  precipitation: number;
  /** Metres per second. */
  windSpeed: number;
  /** Degrees the wind blows *from*, 0-360. */
  windDirection: number;
  /** Percent, 0-100. */
  cloudCover: number;
  /** Percent, 0-100. */
  humidity: number;
  /**
   * Provider-supplied weather symbol, when there is one. Yr publishes these;
   * DMI does not, so for DMI it stays undefined and the icon is derived from
   * cloud cover and precipitation instead.
   */
  symbol?: string;
  /**
   * Number of hours this entry covers. Yr drops to 6-hourly resolution beyond
   * roughly two days out, and the UI says so rather than pretending otherwise.
   */
  coversHours: number;
};

export type ForecastResponse = {
  provider: ProviderId;
  location: { name: string; lat: number; lon: number };
  /** When the upstream data was fetched, ISO-8601 UTC. */
  updatedAt: string;
  /** "live" for a fresh upstream response, "stale" when served past its TTL. */
  freshness: "live" | "stale";
  hours: HourlyForecast[];
};

export type ForecastError = { error: string };
