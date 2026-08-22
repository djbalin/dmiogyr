/**
 * A small, closed set of weather conditions that both providers map onto.
 *
 * Yr publishes symbol codes; DMI does not, so DMI's condition is derived from
 * cloud cover, precipitation and temperature. Day/night is deliberately *not*
 * taken from Yr's `_day` / `_night` suffix — it is computed from the sun
 * position for the forecast location, so both providers agree on when it is
 * dark and the two icon rows never contradict each other.
 */
export type Condition =
  | "clear"
  | "fair"
  | "partlycloudy"
  | "cloudy"
  | "fog"
  | "lightrain"
  | "rain"
  | "heavyrain"
  | "sleet"
  | "snow"
  | "thunder";

export const CONDITION_LABELS: Record<Condition, string> = {
  clear: "Klart",
  fair: "Let skyet",
  partlycloudy: "Delvist skyet",
  cloudy: "Overskyet",
  fog: "Tåge",
  lightrain: "Let regn",
  rain: "Regn",
  heavyrain: "Kraftig regn",
  sleet: "Slud",
  snow: "Sne",
  thunder: "Torden",
};

/** Millimetres per hour at which we stop calling it "light". */
const RAIN_MM = 0.5;
const HEAVY_RAIN_MM = 2;
const TRACE_MM = 0.05;

/** Cloud cover percentages separating the four sky states. */
const CLEAR_PCT = 15;
const FAIR_PCT = 40;
const PARTLY_PCT = 75;

/**
 * Derive a condition from raw values. Used for DMI, and as the fallback when a
 * Yr symbol code is missing or unrecognised.
 */
export function deriveCondition(input: {
  cloudCover: number;
  precipitation: number;
  temperature: number;
  /** Precipitation is given per `coversHours`; normalise before comparing. */
  coversHours?: number;
}): Condition {
  const hours = Math.max(1, input.coversHours ?? 1);
  const mmPerHour = input.precipitation / hours;

  if (mmPerHour > TRACE_MM) {
    if (input.temperature <= 0.5) return "snow";
    if (input.temperature <= 2) return "sleet";
    if (mmPerHour >= HEAVY_RAIN_MM) return "heavyrain";
    if (mmPerHour >= RAIN_MM) return "rain";
    return "lightrain";
  }

  if (input.cloudCover > PARTLY_PCT) return "cloudy";
  if (input.cloudCover > FAIR_PCT) return "partlycloudy";
  if (input.cloudCover > CLEAR_PCT) return "fair";
  return "clear";
}

/** Yr symbol code (minus its time-of-day suffix) to our condition set. */
const YR_SYMBOLS: Record<string, Condition> = {
  clearsky: "clear",
  fair: "fair",
  partlycloudy: "partlycloudy",
  cloudy: "cloudy",
  fog: "fog",
  lightrain: "lightrain",
  lightrainshowers: "lightrain",
  rain: "rain",
  rainshowers: "rain",
  heavyrain: "heavyrain",
  heavyrainshowers: "heavyrain",
  sleet: "sleet",
  lightsleet: "sleet",
  heavysleet: "sleet",
  sleetshowers: "sleet",
  lightsleetshowers: "sleet",
  heavysleetshowers: "sleet",
  snow: "snow",
  lightsnow: "snow",
  heavysnow: "snow",
  snowshowers: "snow",
  lightsnowshowers: "snow",
  heavysnowshowers: "snow",
};

/**
 * Map a Yr symbol code to a condition. Codes look like "partlycloudy_day" or
 * "heavyrainandthunder"; thunder is a suffix on any precipitation code, and we
 * surface it because it is the one condition worth warning about.
 */
export function conditionFromYrSymbol(symbol: string): Condition | null {
  const base = symbol.split("_")[0];
  if (base.includes("thunder")) return "thunder";
  return YR_SYMBOLS[base] ?? null;
}
