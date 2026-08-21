import { describe, expect, it } from "vitest";
import { computeSunTimes, isNight } from "../sun";
import { formatClock, instantFromZoned } from "../time";

const COPENHAGEN = { lat: 55.6761, lon: 12.5683 };

/** Minutes between a computed time and an expected "HH:MM" wall clock. */
function minutesOff(actual: Date, expected: string): number {
  const [hours, minutes] = expected.split(":").map(Number);
  const [actualHours, actualMinutes] = formatClock(actual)
    .split(":")
    .map(Number);
  return Math.abs(actualHours * 60 + actualMinutes - (hours * 60 + minutes));
}

describe("computeSunTimes for Copenhagen", () => {
  // Reference values from timeanddate.com for Copenhagen. NOAA's equations are
  // quoted as accurate to better than a minute at these latitudes; two minutes
  // of slack keeps the test from being brittle about the exact horizon model.
  const cases: Array<[string, string, string]> = [
    ["2026-06-21", "04:26", "21:58"],
    ["2026-12-21", "08:37", "15:38"],
    ["2026-03-20", "06:11", "18:22"],
    ["2026-09-23", "06:57", "19:06"],
  ];

  for (const [day, sunrise, sunset] of cases) {
    it(`is within two minutes of the published times on ${day}`, () => {
      const sun = computeSunTimes(day, COPENHAGEN.lat, COPENHAGEN.lon);
      expect(sun.sunrise).not.toBeNull();
      expect(sun.sunset).not.toBeNull();
      expect(minutesOff(sun.sunrise as Date, sunrise)).toBeLessThanOrEqual(2);
      expect(minutesOff(sun.sunset as Date, sunset)).toBeLessThanOrEqual(2);
    });
  }

  it("applies summer time, which the old hardcoded +01:00 offset did not", () => {
    // In August, Copenhagen is on CEST. A sunrise reported as 04:53 instead of
    // 05:53 was the bug this replaced.
    const sun = computeSunTimes("2026-08-21", COPENHAGEN.lat, COPENHAGEN.lon);
    expect(formatClock(sun.sunrise as Date)).toBe("05:53");
  });

  it("puts sunrise before solar noon before sunset", () => {
    const sun = computeSunTimes("2026-08-21", COPENHAGEN.lat, COPENHAGEN.lon);
    expect((sun.sunrise as Date).getTime()).toBeLessThan(
      sun.solarNoon.getTime(),
    );
    expect(sun.solarNoon.getTime()).toBeLessThan(
      (sun.sunset as Date).getTime(),
    );
  });
});

describe("polar cases", () => {
  const TROMSO = { lat: 69.6496, lon: 18.956 };

  it("reports polar night in midwinter", () => {
    const sun = computeSunTimes("2026-12-21", TROMSO.lat, TROMSO.lon);
    expect(sun.sunrise).toBeNull();
    expect(sun.polarNight).toBe(true);
    expect(isNight(sun.solarNoon, sun)).toBe(true);
  });

  it("reports midnight sun in midsummer", () => {
    const sun = computeSunTimes("2026-06-21", TROMSO.lat, TROMSO.lon);
    expect(sun.sunset).toBeNull();
    expect(sun.polarNight).toBe(false);
    expect(isNight(sun.solarNoon, sun)).toBe(false);
  });
});

describe("isNight", () => {
  const sun = computeSunTimes("2026-08-21", COPENHAGEN.lat, COPENHAGEN.lon);

  it("is dark before sunrise and after sunset", () => {
    expect(isNight(instantFromZoned("2026-08-21", 3), sun)).toBe(true);
    expect(isNight(instantFromZoned("2026-08-21", 23), sun)).toBe(true);
  });

  it("is light between them", () => {
    expect(isNight(instantFromZoned("2026-08-21", 9), sun)).toBe(false);
    expect(isNight(instantFromZoned("2026-08-21", 20), sun)).toBe(false);
  });
});
