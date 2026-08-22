/**
 * Sunrise and sunset, computed locally with the NOAA solar equations.
 *
 * This used to be a call to MET Norway's sunrise API for each of the seven
 * days, which made the forecast unrenderable until all seven round-trips
 * finished and pinned the result to a hardcoded "+01:00" offset that is wrong
 * for the half of the year Denmark spends on summer time. The maths is short,
 * exact enough (NOAA quotes better than a minute below 72° latitude) and needs
 * no network at all.
 *
 * Reference: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */

export type SunTimes = {
  /** Null when the sun neither rises nor sets on this day. */
  sunrise: Date | null;
  /** Null when the sun neither rises nor sets on this day. */
  sunset: Date | null;
  solarNoon: Date;
  /** True when the sun stays below the horizon for the whole day. */
  polarNight: boolean;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Refraction-corrected solar zenith angle for the centre of the disc. */
const SUNRISE_ZENITH = 90.833;

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;
const J2000 = 2_451_545.0;

export function computeSunTimes(
  dayKey: string,
  lat: number,
  lon: number,
): SunTimes {
  // Anchor the orbital terms at solar noon for this longitude: the ephemeris
  // varies slowly enough that this is far more precision than we need, but it
  // keeps the result stable for locations far from Greenwich.
  const [year, month, day] = dayKey.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const julianDay =
    utcMidnight / MS_PER_DAY + UNIX_EPOCH_JULIAN_DAY + 0.5 - lon / 360;
  const t = (julianDay - J2000) / 36525;

  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const equationOfCentre =
    Math.sin(rad(meanAnomaly)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnomaly)) * 0.000289;

  const trueLongitude = meanLongitude + equationOfCentre;
  const apparentLongitude =
    trueLongitude - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));

  const meanObliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity =
    meanObliquity + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));

  const declination = deg(
    Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLongitude))),
  );

  const varY = Math.tan(rad(obliquity / 2)) ** 2;
  const equationOfTime =
    4 *
    deg(
      varY * Math.sin(2 * rad(meanLongitude)) -
        2 * eccentricity * Math.sin(rad(meanAnomaly)) +
        4 *
          eccentricity *
          varY *
          Math.sin(rad(meanAnomaly)) *
          Math.cos(2 * rad(meanLongitude)) -
        0.5 * varY * varY * Math.sin(4 * rad(meanLongitude)) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnomaly)),
    );

  // Minutes after 00:00 UTC.
  const solarNoonMinutes = 720 - 4 * lon - equationOfTime;
  const toInstant = (minutes: number) =>
    new Date(utcMidnight + minutes * 60_000);

  const hourAngleCosine =
    Math.cos(rad(SUNRISE_ZENITH)) /
      (Math.cos(rad(lat)) * Math.cos(rad(declination))) -
    Math.tan(rad(lat)) * Math.tan(rad(declination));

  const solarNoon = toInstant(solarNoonMinutes);

  if (hourAngleCosine > 1) {
    // The sun stays below the horizon all day: polar night.
    return { sunrise: null, sunset: null, solarNoon, polarNight: true };
  }
  if (hourAngleCosine < -1) {
    // The sun never sets: midnight sun.
    return { sunrise: null, sunset: null, solarNoon, polarNight: false };
  }

  const hourAngleMinutes = 4 * deg(Math.acos(hourAngleCosine));
  return {
    sunrise: toInstant(solarNoonMinutes - hourAngleMinutes),
    sunset: toInstant(solarNoonMinutes + hourAngleMinutes),
    solarNoon,
    polarNight: false,
  };
}

/** True when the sun is below the horizon at `instant`. */
export function isNight(instant: Date, sun: SunTimes): boolean {
  // With no sunrise or sunset the day is either wholly dark or wholly light,
  // and `polarNight` says which.
  if (!sun.sunrise || !sun.sunset) return sun.polarNight;
  const time = instant.getTime();
  return time < sun.sunrise.getTime() || time >= sun.sunset.getTime();
}

/** Sun times for each of a list of calendar days. */
export function sunTimesForDays(
  dayKeys: string[],
  lat: number,
  lon: number,
): Map<string, SunTimes> {
  const map = new Map<string, SunTimes>();
  for (const dayKey of dayKeys) {
    map.set(dayKey, computeSunTimes(dayKey, lat, lon));
  }
  return map;
}
