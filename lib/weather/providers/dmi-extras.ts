/**
 * The parts of dmi.dk's own location page (dmi.dk/lokation/show/DK/<id>/<name>/)
 * that sit outside the hourly forecast: the written regional forecast, sun
 * times, UV index, active weather warnings, and — for towns near the coast —
 * observed and forecast water level. Each is its own small upstream call
 * rather than one bundled endpoint, matching how dmi.dk itself loads them.
 */

// ---------------------------------------------------------------------------
// Regional forecast text, sun times, UV index
// ---------------------------------------------------------------------------

type DmiSunDay = {
  date: string;
  localSunUpTime: string;
  localSunDownTime: string;
  dayLengthSeconds: number;
};

type DmiUvDay = {
  Date: string;
  UVmax: number;
};

type DmiLocationDetailsResponse = {
  regionalForecast: {
    area: string;
    headline: string;
    date: string;
    valid: string;
    weatherForecast: string;
  };
  name: string;
  municipality: string;
  sun: DmiSunDay[];
  UVs: DmiUvDay[];
};

export type DmiLocationDetails = {
  regionalForecast: {
    area: string;
    headline: string;
    /** Danish-language byline, e.g. "Udsigt, der gælder til søndag aften, udsendt kl. 20.33". */
    valid: string;
    text: string;
  };
  sun: {
    date: string;
    sunrise: string;
    sunset: string;
    dayLengthSeconds: number;
  }[];
  uv: { date: string; max: number }[];
};

export function buildDmiDetailsUrl(geonameId: number): string {
  return `https://www.dmi.dk/dmidk_byvejrWS/rest/json/id/${geonameId}`;
}

export function normaliseDmiDetails(
  data: DmiLocationDetailsResponse,
): DmiLocationDetails {
  return {
    regionalForecast: {
      area: data.regionalForecast?.area ?? "",
      headline: data.regionalForecast?.headline ?? "",
      valid: data.regionalForecast?.valid ?? "",
      text: data.regionalForecast?.weatherForecast ?? "",
    },
    sun: (data.sun ?? []).map((day) => ({
      date: day.date,
      sunrise: day.localSunUpTime,
      sunset: day.localSunDownTime,
      dayLengthSeconds: day.dayLengthSeconds,
    })),
    uv: (data.UVs ?? []).map((day) => ({ date: day.Date, max: day.UVmax })),
  };
}

// ---------------------------------------------------------------------------
// Weather warnings ("varsler")
// ---------------------------------------------------------------------------

/** A day's warning level, as DMI colour-codes them. */
export type DmiWarningLevel = "none" | "yellow" | "orange" | "red";

type DmiWarningsResponse = {
  name: string;
  area: string;
  day0: string;
  day1: string;
  day2: string;
  /** Freeform: DMI has not been observed to populate this for a Danish town with no active warning, so the shape of an entry is not pinned down further than what is rendered defensively. */
  warnings: unknown[];
};

export type DmiWarnings = {
  /** Today's warning level; drives whether a banner shows at all. */
  level: DmiWarningLevel;
  warnings: unknown[];
};

const WARNING_LEVELS: readonly DmiWarningLevel[] = [
  "none",
  "yellow",
  "orange",
  "red",
];

function toWarningLevel(value: string | undefined): DmiWarningLevel {
  return (WARNING_LEVELS as readonly string[]).includes(value ?? "")
    ? (value as DmiWarningLevel)
    : "none";
}

export function buildDmiWarningsUrl(geonameId: number): string {
  return `https://www.dmi.dk/dmidk_byvejrWS/rest/texts/varsler/geonameid/${geonameId}`;
}

export function normaliseDmiWarnings(data: DmiWarningsResponse): DmiWarnings {
  return {
    level: toWarningLevel(data?.day0),
    warnings: Array.isArray(data?.warnings) ? data.warnings : [],
  };
}

// ---------------------------------------------------------------------------
// Water level ("vandstand")
// ---------------------------------------------------------------------------

type DmiTideResponse = [
  {
    stationId: string;
    generatedTime: string;
    values: { time: string; value: number }[];
  },
];

export type TidePoint = { time: string; levelCm: number };

export function buildTideUrl(stationId: string, kind: "obs" | "fcst"): string {
  return `https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=odj&stations=${stationId}&datatype=${kind}`;
}

export function normaliseTide(data: DmiTideResponse): TidePoint[] {
  const values = data?.[0]?.values ?? [];
  return values
    .filter((point) => typeof point?.value === "number")
    .map((point) => ({ time: point.time, levelCm: point.value }));
}
