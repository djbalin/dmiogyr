import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCATION,
  findLocation,
  LOCATIONS,
  roundCoordinate,
} from "../locations";

describe("LOCATIONS", () => {
  it("has unique ids, which the URL and localStorage both rely on", () => {
    const ids = LOCATIONS.map((location) => location.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("places every entry inside Denmark's bounding box", () => {
    // Outside this box, DMI's HARMONIE DINI model has nothing to say.
    for (const location of LOCATIONS) {
      expect(location.lat).toBeGreaterThan(54);
      expect(location.lat).toBeLessThan(58);
      expect(location.lon).toBeGreaterThan(8);
      expect(location.lon).toBeLessThan(15.5);
    }
  });

  it("defaults to Copenhagen", () => {
    expect(DEFAULT_LOCATION.id).toBe("koebenhavn");
  });
});

describe("findLocation", () => {
  it("finds a known id", () => {
    expect(findLocation("aarhus").name).toBe("Aarhus");
  });

  it("falls back to the default for anything else", () => {
    expect(findLocation("nowhere").id).toBe(DEFAULT_LOCATION.id);
    expect(findLocation(null).id).toBe(DEFAULT_LOCATION.id);
    expect(findLocation(undefined).id).toBe(DEFAULT_LOCATION.id);
  });
});

describe("roundCoordinate", () => {
  it("trims to the four decimals both providers ask for", () => {
    expect(roundCoordinate(55.676098)).toBe(55.6761);
    expect(roundCoordinate(12.568337)).toBe(12.5683);
  });
});
