/**
 * Timezone helpers.
 *
 * The app shows Danish forecasts, so every user-visible day boundary and hour
 * label is resolved in a fixed forecast timezone rather than the viewer's. A
 * user in Tokyo looking at the Copenhagen forecast should see Copenhagen's
 * days, and the server and the browser must agree or React will complain about
 * a hydration mismatch.
 */
export const FORECAST_TIME_ZONE = "Europe/Copenhagen";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Break an instant into wall-clock parts in the given timezone. */
export function zonedParts(
  date: Date,
  timeZone: string = FORECAST_TIME_ZONE,
): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  // Intl renders midnight as hour 24 in some engines; normalise it to 0.
  const hour = read("hour") % 24;
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The calendar day an instant falls on, as "YYYY-MM-DD" in `timeZone`. */
export function zonedDayKey(
  date: Date,
  timeZone: string = FORECAST_TIME_ZONE,
): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The hour of day (0-23) an instant falls on in `timeZone`. */
export function zonedHour(
  date: Date,
  timeZone: string = FORECAST_TIME_ZONE,
): number {
  return zonedParts(date, timeZone).hour;
}

/** How far ahead of UTC `timeZone` is at this instant, in milliseconds. */
export function zoneOffsetMs(
  date: Date,
  timeZone: string = FORECAST_TIME_ZONE,
): number {
  const { year, month, day, hour, minute } = zonedParts(date, timeZone);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Seconds and milliseconds are unaffected by any real-world zone offset.
  const truncated = Math.floor(date.getTime() / 60000) * 60000;
  return asUtc - truncated;
}

/**
 * The instant matching a wall-clock time in `timeZone`.
 *
 * Two passes: guess that the wall-clock time is UTC, measure the zone's offset
 * near that guess, correct, then re-measure in case the correction moved us
 * across a DST transition.
 */
export function instantFromZoned(
  dayKey: string,
  hour: number,
  minute = 0,
  timeZone: string = FORECAST_TIME_ZONE,
): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(target - zoneOffsetMs(new Date(target), timeZone));
  instant = new Date(target - zoneOffsetMs(instant, timeZone));
  return instant;
}

/** Midnight at the start of a calendar day in `timeZone`. */
export function startOfZonedDay(
  dayKey: string,
  timeZone: string = FORECAST_TIME_ZONE,
): Date {
  return instantFromZoned(dayKey, 0, 0, timeZone);
}

/** Today's calendar day in `timeZone`, as "YYYY-MM-DD". */
export function todayKey(
  timeZone: string = FORECAST_TIME_ZONE,
  now: Date = new Date(),
): string {
  return zonedDayKey(now, timeZone);
}

/** Add whole days to a "YYYY-MM-DD" key, staying in the calendar. */
export function addDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** "07:30" for an instant, in `timeZone`. */
export function formatClock(
  date: Date,
  timeZone: string = FORECAST_TIME_ZONE,
): string {
  const { hour, minute } = zonedParts(date, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}

/** "07" for an hour number. */
export function formatHour(hour: number): string {
  return pad(hour);
}

const DANISH_WEEKDAYS = [
  "Søndag",
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
];

const DANISH_MONTHS_SHORT = [
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "maj",
  "jun.",
  "jul.",
  "aug.",
  "sep.",
  "okt.",
  "nov.",
  "dec.",
];

/**
 * Danish weekday name for a calendar day. Written out rather than delegated to
 * `toLocaleDateString`, so the label never depends on which locale data the
 * runtime happens to ship.
 */
export function danishWeekday(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return DANISH_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** "21. aug." for a calendar day. */
export function danishDate(dayKey: string): string {
  const [, month, day] = dayKey.split("-").map(Number);
  return `${day}. ${DANISH_MONTHS_SHORT[month - 1]}`;
}

/**
 * How a day is introduced: "I dag" / "I morgen" / weekday name, relative to
 * `today`.
 */
export function relativeDayLabel(dayKey: string, today: string): string {
  if (dayKey === today) return "I dag";
  if (dayKey === addDays(today, 1)) return "I morgen";
  return danishWeekday(dayKey);
}
