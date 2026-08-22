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

/**
 * DMI's own numeric weather-symbol codes, as used on dmi.dk and returned by
 * its `ninjo2dmidk?cmd=llj` endpoint. DMI does not publish a table for these
 * anywhere in its "Frie data" documentation; this is reconstructed from the
 * groupings a third-party client of the same endpoint uses
 * (github.com/Badgie/dmi-weather) and cross-checked against a live sample for
 * Roskilde, where e.g. 180 lined up with a heavier shower than 160 and 3 was
 * the default for anything overcast.
 *
 * The scheme appears to be: a base code per sky/precipitation type, +100 for
 * a variant (night, going by 1→101 clear sky), and a further offset for
 * "byger" (showers) vs steady precipitation. Only the base and +100 forms
 * have been observed in practice; both are mapped for safety.
 */
const DMI_SYMBOL_GROUPS: Record<number, Condition> = {
  1: "clear",
  101: "clear",
  2: "partlycloudy",
  102: "partlycloudy",
  3: "cloudy",
  103: "cloudy",
  60: "lightrain",
  80: "lightrain",
  160: "lightrain",
  180: "lightrain",
  63: "rain",
  81: "rain",
  163: "rain",
  181: "rain",
  68: "sleet",
  83: "sleet",
  168: "sleet",
  183: "sleet",
  69: "sleet",
  84: "sleet",
  169: "sleet",
  184: "sleet",
  70: "snow",
  85: "snow",
  170: "snow",
  185: "snow",
  73: "snow",
  86: "snow",
  173: "snow",
  186: "snow",
  95: "thunder",
  195: "thunder",
};

/** Metres of visibility below which DMI's symbol codes appear not to bother distinguishing fog from cloud. */
const FOG_VISIBILITY_M = 1000;

/** Millimetres per hour at which the symbol's rain/thunder groups escalate to "heavyrain". */
const DMI_HEAVY_RAIN_MM = 2;

/**
 * Map a DMI numeric symbol code (plus the raw values around it) to a
 * condition. `visibility` overrides to "fog" below {@link FOG_VISIBILITY_M}:
 * DMI's symbol table has no fog code of its own, so this is the only signal
 * for it.
 */
export function conditionFromDmiSymbol(
  symbol: string,
  input: { precipitation: number; visibility?: number },
): Condition | null {
  const code = Number.parseInt(symbol, 10);
  if (Number.isNaN(code)) return null;
  const group = DMI_SYMBOL_GROUPS[code];
  if (!group) return null;

  if (
    typeof input.visibility === "number" &&
    input.visibility < FOG_VISIBILITY_M &&
    group !== "thunder"
  ) {
    return "fog";
  }

  // The symbol only distinguishes "rain" from "heavier rain" qualitatively;
  // sharpen it with the actual amount, same threshold deriveCondition uses.
  if (
    (group === "lightrain" || group === "rain") &&
    input.precipitation >= DMI_HEAVY_RAIN_MM
  ) {
    return "heavyrain";
  }

  return group;
}

/** A rough cloud-cover percentage for a condition, for display only.
 *
 * DMI's `llj` feed has no cloud-cover field, unlike the old EDR API. This
 * fills the "X% skyer" stat from the symbol-derived condition instead of
 * leaving it blank — approximate, and labelled as such wherever it is shown.
 */
export const APPROXIMATE_CLOUD_COVER: Record<Condition, number> = {
  clear: 5,
  fair: 25,
  partlycloudy: 45,
  cloudy: 90,
  fog: 100,
  lightrain: 85,
  rain: 95,
  heavyrain: 100,
  sleet: 95,
  snow: 90,
  thunder: 95,
};
