import { describe, expect, it } from "vitest";
import {
  addDays,
  danishDate,
  danishWeekday,
  formatClock,
  instantFromZoned,
  relativeDayLabel,
  zonedDayKey,
  zonedHour,
} from "../time";

describe("zoned day and hour", () => {
  it("puts a late-evening summer instant on the Copenhagen day, not the UTC one", () => {
    // 22:30 UTC on 20 August is 00:30 on 21 August in Copenhagen (CEST).
    const instant = new Date("2026-08-20T22:30:00Z");
    expect(zonedDayKey(instant)).toBe("2026-08-21");
    expect(zonedHour(instant)).toBe(0);
  });

  it("handles winter time, when the offset is one hour", () => {
    const instant = new Date("2026-01-15T23:30:00Z");
    expect(zonedDayKey(instant)).toBe("2026-01-16");
    expect(zonedHour(instant)).toBe(0);
  });

  it("reports midnight as hour 0, never 24", () => {
    expect(zonedHour(new Date("2026-08-20T22:00:00Z"))).toBe(0);
  });
});

describe("instantFromZoned", () => {
  it("resolves a summer wall-clock time through the +02:00 offset", () => {
    expect(instantFromZoned("2026-08-21", 12).toISOString()).toBe(
      "2026-08-21T10:00:00.000Z",
    );
  });

  it("resolves a winter wall-clock time through the +01:00 offset", () => {
    expect(instantFromZoned("2026-01-21", 12).toISOString()).toBe(
      "2026-01-21T11:00:00.000Z",
    );
  });

  it("round-trips across the spring forward transition", () => {
    // Denmark springs forward on the last Sunday of March 2026, the 29th.
    for (const hour of [0, 1, 3, 4, 12, 23]) {
      const instant = instantFromZoned("2026-03-29", hour);
      expect(zonedDayKey(instant)).toBe("2026-03-29");
      expect(zonedHour(instant)).toBe(hour);
    }
  });

  it("round-trips across the autumn fall back transition", () => {
    for (const hour of [0, 1, 2, 3, 12, 23]) {
      const instant = instantFromZoned("2026-10-25", hour);
      expect(zonedDayKey(instant)).toBe("2026-10-25");
      expect(zonedHour(instant)).toBe(hour);
    }
  });
});

describe("formatClock", () => {
  it("formats in the forecast timezone regardless of the machine's", () => {
    expect(formatClock(new Date("2026-08-21T03:53:00Z"))).toBe("05:53");
    expect(formatClock(new Date("2026-12-21T07:37:00Z"))).toBe("08:37");
  });
});

describe("calendar labels", () => {
  it("names Danish weekdays", () => {
    expect(danishWeekday("2026-08-21")).toBe("Fredag");
    expect(danishWeekday("2026-08-23")).toBe("Søndag");
  });

  it("formats Danish dates", () => {
    expect(danishDate("2026-08-21")).toBe("21. aug.");
    expect(danishDate("2026-05-01")).toBe("1. maj");
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("labels today and tomorrow relatively", () => {
    expect(relativeDayLabel("2026-08-21", "2026-08-21")).toBe("I dag");
    expect(relativeDayLabel("2026-08-22", "2026-08-21")).toBe("I morgen");
    expect(relativeDayLabel("2026-08-23", "2026-08-21")).toBe("Søndag");
  });
});
